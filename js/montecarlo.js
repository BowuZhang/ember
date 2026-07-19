/**
 * Monte Carlo / sequence-risk analysis. Instead of one fixed-return
 * projection, this runs many simulated paths with randomized annual
 * returns (normal distribution centered on your assumed return, with a
 * fixed, disclosed volatility typical of that kind of allocation) and
 * reports what share of paths never ran out of money, plus percentile
 * bands for a fan chart. These are SIMULATED random returns, not actual
 * historical market sequences — a simplification chosen over hand-coding
 * a historical dataset that couldn't be verified for accuracy here.
 */

const MC_NUM_SIMULATIONS = 500;
const MC_PRE_RETIREMENT_VOLATILITY = 0.16; // ~typical for an 80-100% stock allocation
const MC_POST_RETIREMENT_VOLATILITY = 0.10; // ~typical for a more conservative 60/40-ish mix

/**
 * Deterministic seeded PRNG (mulberry32). Used so that comparisons between
 * a baseline run and a "what if" lever run (see computeMonteCarloLevers)
 * draw from the same sequence of simulated markets instead of two
 * independent random samples — otherwise a lever that should strictly help
 * (like retiring later) can occasionally show a "worse" result purely from
 * sampling noise between the two runs, which would undermine trust in the
 * comparison for no real reason.
 */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomNormal(mean, stdev, rng) {
  const random = rng || Math.random;
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdev;
}

function percentileOf(sortedArr, p) {
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * (sortedArr.length - 1)));
  return sortedArr[idx];
}

/**
 * @param {number} [seed] optional — when provided, uses a deterministic
 *   RNG instead of Math.random(), so repeated calls with the same seed
 *   (and same simulation count) reproduce identical simulated markets.
 */
function runMonteCarloSimulation(input, adjustments, numSimulations, seed) {
  const n = numSimulations || MC_NUM_SIMULATIONS;
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const {
    currentAge, retirementAge, currentPortfolio, annualContribution,
    preRetirementReturnPct, postRetirementReturnPct, inflationPct,
    annualExpensesToday, filingStatus, stateCode,
  } = input;
  const stateInfo = STATE_DATA[stateCode];
  const preMeanReal = realReturn(preRetirementReturnPct, inflationPct);
  const postMeanReal = realReturn(postRetirementReturnPct, inflationPct);
  const extras = (adjustments && adjustments.extraExpensesByAge) || {};
  const externalIncome = (adjustments && adjustments.externalIncomeByAge) || {};

  const ages = [];
  for (let age = currentAge; age <= MAX_PLANNING_AGE; age++) ages.push(age);
  const balancesByAge = {};
  ages.forEach((age) => (balancesByAge[age] = []));

  let successCount = 0;

  for (let sim = 0; sim < n; sim++) {
    let balance = currentPortfolio;
    for (let age = currentAge; age <= retirementAge; age++) {
      balancesByAge[age].push(balance);
      if (age < retirementAge) {
        const r = randomNormal(preMeanReal, MC_PRE_RETIREMENT_VOLATILITY, rng);
        balance = Math.max(0, balance * (1 + r) + annualContribution - (extras[age] || 0));
      }
    }
    let depleted = false;
    for (let age = retirementAge + 1; age <= MAX_PLANNING_AGE; age++) {
      const r = randomNormal(postMeanReal, MC_POST_RETIREMENT_VOLATILITY, rng);
      const withdrawal = yearlyPortfolioWithdrawal(annualExpensesToday, externalIncome[age] || 0, filingStatus, stateInfo);
      balance = Math.max(0, balance * (1 + r) - withdrawal - (extras[age] || 0));
      balancesByAge[age].push(balance);
      if (balance <= 0) depleted = true;
    }
    if (!depleted) successCount++;
  }

  const bands = ages.map((age) => {
    const sorted = balancesByAge[age].slice().sort((a, b) => a - b);
    return {
      age,
      p10: percentileOf(sorted, 10),
      p50: percentileOf(sorted, 50),
      p90: percentileOf(sorted, 90),
    };
  });

  return {
    successRate: successCount / n,
    numSimulations: n,
    bands,
  };
}

/**
 * Flags sequence-of-returns risk: whether the risky outcomes concentrate in
 * the first decade of retirement (a bad market right after you stop working,
 * withdrawing from a shrinking base with no time to recover) versus being
 * spread evenly or showing up only much later (more a "not enough saved"
 * issue than a timing issue).
 */
function diagnoseSequenceRisk(bands, retirementAge) {
  const postRetirement = bands.filter((b) => b.age > retirementAge);
  if (postRetirement.length === 0) return { earlyRisk: false };
  const earlyWindow = postRetirement.slice(0, 10);
  const earlyRisk = earlyWindow.some((b) => b.p10 <= 0);
  const laterRisk = postRetirement.slice(10).some((b) => b.p10 <= 0);
  return { earlyRisk, laterRisk };
}

/**
 * Re-runs the simulation with a couple of common levers changed one at a
 * time (retiring later, spending less) so the result reads as "here's what
 * would actually help and by how much" instead of a single bare percentage.
 * Uses a smaller sample size than the headline run since these are
 * comparative, not the number of record.
 */
function computeMonteCarloLevers(input, adjustments, seed) {
  const LEVER_SIMULATIONS = 250;
  const levers = [];

  const retireLaterInput = { ...input, retirementAge: input.retirementAge + 2 };
  const retireLaterMC = runMonteCarloSimulation(retireLaterInput, adjustments, LEVER_SIMULATIONS, seed);
  levers.push({ label: `Retire 2 years later (age ${retireLaterInput.retirementAge})`, successRate: retireLaterMC.successRate });

  const spendLessInput = { ...input, annualExpensesToday: Math.round(input.annualExpensesToday * 0.9) };
  const spendLessMC = runMonteCarloSimulation(spendLessInput, adjustments, LEVER_SIMULATIONS, seed);
  levers.push({ label: `Spend 10% less (${formatCurrencyShort(spendLessInput.annualExpensesToday)}/yr)`, successRate: spendLessMC.successRate });

  return levers;
}
