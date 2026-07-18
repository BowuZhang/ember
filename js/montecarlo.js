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

function randomNormal(mean, stdev) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdev;
}

function percentileOf(sortedArr, p) {
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * (sortedArr.length - 1)));
  return sortedArr[idx];
}

function runMonteCarloSimulation(input, adjustments, numSimulations) {
  const n = numSimulations || MC_NUM_SIMULATIONS;
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
        const r = randomNormal(preMeanReal, MC_PRE_RETIREMENT_VOLATILITY);
        balance = Math.max(0, balance * (1 + r) + annualContribution - (extras[age] || 0));
      }
    }
    let depleted = false;
    for (let age = retirementAge + 1; age <= MAX_PLANNING_AGE; age++) {
      const r = randomNormal(postMeanReal, MC_POST_RETIREMENT_VOLATILITY);
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
