/**
 * Static reference content: FIRE-variant descriptions and post-retirement
 * guidance. Kept as plain data so main.js just renders it.
 */

const FIRE_TYPES = [
  {
    key: "lean",
    label: "Lean FIRE",
    description:
      "Retiring on a minimal, frugal budget (often under ~$40,000/yr). Requires the smallest FIRE number and the fastest path there, but leaves little room for lifestyle inflation, healthcare surprises, or economic downturns. Works best paired with a genuinely low-cost lifestyle and a low-tax, low-cost-of-living state.",
  },
  {
    key: "fat",
    label: "Fat FIRE",
    description:
      "Retiring with a much larger portfolio to support an above-average, comfortable lifestyle (often $100,000+/yr in spending). Takes longer to reach and usually requires a high income, but provides far more cushion and flexibility, including for travel, dependents, or a higher cost-of-living area.",
  },
  {
    key: "coast",
    label: "Coast FIRE",
    description:
      "You've saved enough that, left alone to compound with zero further contributions, your portfolio will grow to your full FIRE number by traditional retirement age. Once you hit this point you can stop saving for retirement entirely and just cover current living costs — often by working a lower-stress or lower-paying job.",
  },
  {
    key: "barista",
    label: "Barista FIRE",
    description:
      "A middle ground: your portfolio covers most of your expenses, and you work part-time (often for supplemental income and employer health insurance) to cover the rest. Reduces the FIRE number needed versus full retirement while still dramatically increasing freedom and flexibility.",
  },
  {
    key: "traditional",
    label: "Traditional FIRE",
    description:
      "A balanced approach between Lean and Fat FIRE — typical middle-class spending levels in retirement, requiring a moderately sized portfolio without extreme frugality or excess.",
  },
];

const FIRE_TYPE_KEY_BY_LABEL = {
  "Lean FIRE": "lean",
  "Fat FIRE": "fat",
  "Coast FIRE": "coast",
  "Barista FIRE": "barista",
  "Traditional FIRE": "traditional",
};

const LIFE_AFTER_CATEGORIES = [
  {
    title: "Purpose & work",
    items: [
      "Consider part-time, consulting, or an \"encore career\" in a field you find meaningful — stopping work entirely and abruptly can be jarring after decades of structure.",
      "Volunteering or board work can replace workplace structure and social connection without income pressure.",
      "Mentoring or teaching, formally or informally, is a common way to keep using decades of expertise.",
    ],
  },
  {
    title: "Health & benefits",
    items: [
      "Enroll in Medicare during your Initial Enrollment Period around age 65 — missing it can mean lasting penalties.",
      "Decide when to claim Social Security: as early as 62 (reduced), full retirement age (~67), or as late as 70 (increased) — delaying generally raises your monthly benefit.",
      "If retiring before 65, plan the health-insurance bridge: ACA marketplace plans, COBRA, or a part-time job with benefits.",
      "Consider long-term care insurance or a dedicated care fund while you're still insurable.",
    ],
  },
  {
    title: "Family & legacy",
    items: [
      "Review or create a will, powers of attorney, and beneficiary designations — these quietly go stale for years.",
      "If you're still supporting children financially, plan those cash flows explicitly rather than drawing them ad hoc from savings.",
      "Decide on a gifting or estate strategy if leaving an inheritance is a goal.",
    ],
  },
  {
    title: "Lifestyle & adventure",
    items: [
      "Big travel or relocation plans are often easiest in the first few active years of retirement.",
      "Downsizing or relocating to a lower-tax, lower-cost state (see the comparison above) can meaningfully stretch your portfolio.",
      "Revisit hobbies or interests that were sidelined during your career — many retirees underestimate how much unstructured time they'll suddenly have.",
    ],
  },
];

/** Spending-level tiers used to calibrate life-after-retirement suggestions — $50k/yr and $200k/yr call for very different framing. */
const LIFE_AFTER_SPENDING_TIERS = [
  {
    max: 40000,
    label: "lean",
    note: "free and low-cost options will do most of the work — library programs, national and state parks, community-college classes, and volunteering all add up to a rich life without straining the budget",
  },
  {
    max: 80000,
    label: "moderate",
    note: "there's real room for regular hobbies, occasional travel, and the occasional paid class or gear upgrade without much second-guessing",
  },
  {
    max: 150000,
    label: "comfortable",
    note: "premium versions of most pursuits — real equipment, guided trips, private instruction — are realistically within reach",
  },
  {
    max: Infinity,
    label: "abundant",
    note: "budget is rarely the limiting factor here — time and energy become the real constraints, not money",
  },
];

function lifeAfterSpendingTier(annualExpenses) {
  return LIFE_AFTER_SPENDING_TIERS.find((t) => annualExpenses <= t.max) || LIFE_AFTER_SPENDING_TIERS[LIFE_AFTER_SPENDING_TIERS.length - 1];
}

function buildLifeAfterIntro(input, childrenAges) {
  const tier = lifeAfterSpendingTier(input.annualExpensesToday);
  let kidsPart = "";
  if (childrenAges && childrenAges.length > 0) {
    const yearsToRetirement = input.retirementAge - input.currentAge;
    const stillDependent = childrenAges.some((age) => age + yearsToRetirement < 18);
    kidsPart = stillDependent
      ? " With children still at home when you retire, this next chapter will likely blend continued family support with your own plans."
      : " With your kids grown and independent by the time you retire, this next chapter is squarely your own.";
  }
  const article = /^[aeiou]/i.test(tier.label) ? "an" : "a";
  return `Money is only half the plan.${kidsPart} At ${article} ${tier.label} ${currency(input.annualExpensesToday)}/year spending level, ${tier.note}. A few areas worth planning deliberately:`;
}

/** A few stable, well-known starting points per life-after-retirement category — not exhaustive, just a place to start digging. */
const LIFE_AFTER_RESOURCES = {
  "Purpose & work": [
    { name: "SCORE — free small-business mentoring", url: "https://www.score.org" },
    { name: "VolunteerMatch", url: "https://www.volunteermatch.org" },
    { name: "AARP — working & volunteering in retirement", url: "https://www.aarp.org" },
  ],
  "Health & benefits": [
    { name: "Medicare.gov", url: "https://www.medicare.gov" },
    { name: "Social Security Administration", url: "https://www.ssa.gov" },
    { name: "HealthCare.gov (ACA marketplace)", url: "https://www.healthcare.gov" },
  ],
  "Family & legacy": [
    { name: "National Association of Estate Planners & Councils", url: "https://www.naepc.org" },
    { name: "IRS — retirement & estate basics", url: "https://www.irs.gov" },
  ],
  "Lifestyle & adventure": [
    { name: "National Park Service", url: "https://www.nps.gov" },
    { name: "AARP — livable communities & relocation", url: "https://www.aarp.org" },
  ],
};

/**
 * Household net worth and retirement-account balances by age bracket,
 * from the Federal Reserve's 2022 Survey of Consumer Finances (released
 * Oct 2023 — the most recent wave available). Net worth is the median
 * across ALL households in the bracket; retirement-account balance is
 * the median among the roughly 55–65% of households that have one
 * (most households without an account would otherwise pull that median
 * toward zero and be misleading).
 */
const RETIREMENT_STATS_BY_AGE = [
  { label: "Under 35", netWorth: 39000, retirementBalance: 18880 },
  { label: "35–44", netWorth: 135000, retirementBalance: 45000 },
  { label: "45–54", netWorth: 247000, retirementBalance: 115000 },
  { label: "55–64", netWorth: 364000, retirementBalance: 185000 },
  { label: "65–74", netWorth: 410000, retirementBalance: 200000 },
  { label: "75+", netWorth: 335000, retirementBalance: 130000 },
];

/**
 * Household net worth needed to reach each percentile nationally, from
 * analysis of the Federal Reserve's 2022 Survey of Consumer Finances
 * (DQYDJ's percentile breakdown of the same SCF data). Estimates at the
 * extreme end (top 0.1–0.5%) carry much wider error bars — the SCF
 * intentionally oversamples wealthy households but very small samples at
 * the top mean these figures should be read as rough orders of magnitude.
 */
const NET_WORTH_PERCENTILES = [
  { label: "Top 0.1%", netWorth: 61800000 },
  { label: "Top 0.5%", netWorth: 20100000 },
  { label: "Top 1%", netWorth: 13700000 },
  { label: "Top 2%", netWorth: 5500000 },
  { label: "Top 5%", netWorth: 3800000 },
  { label: "Top 10%", netWorth: 1920000 },
  { label: "Median (top 50%)", netWorth: 192000 },
];

/**
 * 2024 US Census household income percentile thresholds, used only as a
 * reference point for comparing a retirement portfolio's safe-withdrawal
 * income against how working households' incomes are distributed.
 */
const HOUSEHOLD_INCOME_PERCENTILES = [
  { label: "Median household income", income: 80020 },
  { label: "Top 10% threshold", income: 234769 },
  { label: "Top 5% threshold", income: 315504 },
  { label: "Top 1% threshold", income: 631500 },
];

function incomePercentileContext(annualIncome) {
  const p = HOUSEHOLD_INCOME_PERCENTILES;
  if (annualIncome >= p[3].income) return "above the top 1% household income threshold";
  if (annualIncome >= p[2].income) return "between the top 5% and top 1% household income thresholds";
  if (annualIncome >= p[1].income) return "between the top 10% and top 5% household income thresholds";
  if (annualIncome >= p[0].income) return "above median household income, below the top 10% threshold";
  return "below median household income";
}

/**
 * Portfolio size translated into annual income at a 4% safe withdrawal
 * rate, compared against 2024 household income percentiles. Financial
 * framing only — lifestyle/activity content is out of scope here (see
 * the planned Retirement Life section).
 */
const PORTFOLIO_TIERS = [1000000, 3000000, 5000000, 10000000].map((portfolio) => {
  const annualIncome = portfolio * 0.04;
  return { portfolio, annualIncome, context: incomePercentileContext(annualIncome) };
});

const TAX_STRATEGIES = [
  {
    title: "401(k) / 403(b)",
    body: "Pre-tax salary deferral lowers your taxable income now and grows tax-deferred until withdrawal. 2026 employee limit: $24,500 ($32,500 if 50+, up to $35,750 for ages 60–63 under SECURE 2.0's higher catch-up). An employer match is free money — contribute at least enough to capture all of it.",
  },
  {
    title: "Traditional vs. Roth IRA",
    body: "Traditional IRA contributions may be deductible now and are taxed on withdrawal; Roth IRA contributions are after-tax but grow and withdraw tax-free. 2026 limit: $7,500 ($8,600 if 50+), with Roth eligibility phased out at higher incomes.",
  },
  {
    title: "Backdoor Roth IRA",
    body: "High earners above the Roth income limit can contribute to a Traditional IRA (nondeductible) and convert it to Roth soon after — mind the pro-rata rule if you hold other pre-tax IRA balances, which can make the conversion partly taxable.",
  },
  {
    title: "HSA (Health Savings Account)",
    body: "The only triple-tax-advantaged account: pre-tax contributions, tax-free growth, and tax-free withdrawals for qualified medical expenses. After 65, non-medical withdrawals are taxed like a Traditional IRA with no penalty. 2026 limit: $4,400 individual / $8,750 family (plus $1,000 catch-up at 55+).",
  },
  {
    title: "Mega backdoor Roth",
    body: "Some 401(k) plans allow after-tax contributions beyond the standard employee limit, which can then be converted to Roth — potentially tens of thousands more in tax-advantaged room per year, if your specific plan allows it.",
  },
  {
    title: "Tax-loss harvesting",
    body: "Selling taxable-account investments at a loss to offset capital gains (and up to $3,000 of ordinary income per year) can reduce your tax bill without changing your overall allocation — just mind the wash-sale rule when re-buying.",
  },
  {
    title: "Qualified Charitable Distributions",
    body: "At 70½+, you can direct up to roughly $111,000/yr (2026 figure, indexed annually) from an IRA straight to charity. It counts toward your Required Minimum Distribution but isn't included in your taxable income.",
  },
  {
    title: "Asset location",
    body: "Placing tax-inefficient investments (bonds, REITs) in tax-deferred or Roth accounts, and tax-efficient ones (broad index funds) in taxable accounts, can reduce the tax drag on your portfolio independent of your overall asset allocation.",
  },
];

/** Maps an age to the matching RETIREMENT_STATS_BY_AGE bracket label. */
function ageToBracketLabel(age) {
  if (age < 35) return "Under 35";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  if (age < 65) return "55–64";
  if (age < 75) return "65–74";
  return "75+";
}

/** A short, human sentence describing where a net worth ranks among NET_WORTH_PERCENTILES. */
function describeNetWorthRank(netWorth) {
  const sorted = NET_WORTH_PERCENTILES; // already ordered richest-first, median last
  for (const tier of sorted) {
    if (netWorth >= tier.netWorth) {
      return `puts you above the ${tier.label.toLowerCase()} threshold (~${(tier.netWorth).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })})`;
    }
  }
  return "is below the national median";
}

const PENALTY_FREE_ACCOUNT_AGE = 59.5;
const RMD_START_AGE_REF = 73;

/**
 * Personalized Roth-conversion guidance built from the calculator's own
 * retirement age and filing status — the gap between retiring and 59½ (or,
 * absent that gap, the runway before RMDs/Social Security) is framed as a
 * conversion window, with a rule-of-thumb bracket-filling target reusing
 * the same federal bracket table the tax deep-dive uses.
 */
function buildRothConversionStrategy(input) {
  const gapYears = PENALTY_FREE_ACCOUNT_AGE - input.retirementAge;
  const bracket12Top = FEDERAL_BRACKETS[input.filingStatus][1].upTo;
  const suggestedCeiling = STANDARD_DEDUCTION[input.filingStatus] + bracket12Top;
  const filingLabel = input.filingStatus === "married" ? "married filing jointly" : "single filers";

  const windowText =
    gapYears > 0
      ? `Retiring at ${input.retirementAge} leaves roughly ${gapYears.toFixed(1)} years (ages ${input.retirementAge}–59½) before you can tap Traditional 401(k)/IRA funds penalty-free. That gap is one of the best windows you'll get for Roth conversions: with no salary and no Traditional withdrawals yet, taxable income is often unusually low, so converting fills up cheap tax brackets that would otherwise go unused.`
      : `Retiring at ${input.retirementAge} means you're already past the 59½ penalty-free access age, so there's no low-income "gap" before then — but the years between retirement and age ${RMD_START_AGE_REF} (when RMDs begin) or before you claim Social Security are still worth targeting for conversions, since income tends to be lower and more controllable before both of those kick in.`;

  const ladderNote =
    gapYears > 0
      ? `If you plan to actually spend converted funds before 59½, remember each conversion needs 5 tax years to season before its principal can come out penalty-free — a "Roth conversion ladder" means converting every year, starting at least 5 years before you'll need that money. The Rule of 55 (for a 401(k) left with your last employer) and 72(t)/SEPP distributions are the other common ways to access retirement funds early without the ladder.`
      : `Even without an early-access gap, converting steadily rather than all at once still helps — a big single-year conversion can push you into a much higher bracket than spreading the same amount over several years.`;

  const ceilingNote = `A common rule of thumb: convert enough each year to fill up to the top of the 12% federal bracket without going higher — for ${filingLabel}, that's roughly ${currency(suggestedCeiling)} of total taxable income (standard deduction plus bracket room) in today's dollars. Other income that year changes this number — treat it as a starting point, not a target to hit exactly.`;

  return `
    <h4>Your Roth conversion window</h4>
    <p>${windowText}</p>
    <p>${ladderNote}</p>
    <p>${ceilingNote}</p>
  `;
}

/** State-aware Roth-conversion and withdrawal tax guidance, using the calculator's saved state. */
function buildStateTaxStrategy(input) {
  const stateInfo = STATE_DATA[input.stateCode];
  if (!stateInfo) return "";
  const rateNote =
    stateInfo.effectiveRetirementTaxRate === 0
      ? `${stateInfo.name} doesn't tax retirement withdrawals — Roth conversions done while you're a resident here cost federal tax only, which is about as favorable as conversion timing gets.`
      : `${stateInfo.name} taxes retirement withdrawals at roughly ${(stateInfo.effectiveRetirementTaxRate * 100).toFixed(1)}% effectively. Roth conversions are generally taxed as ordinary income by both the IRS and most states in the year you convert — the same rate that applies to your regular income, not necessarily any special lower rate a state reserves for retirement withdrawals after a certain age.`;
  const ssNote = stateInfo.taxesSocialSecurity ? ` ${stateInfo.name} also taxes Social Security benefits, which is worth factoring in once you start claiming.` : "";
  const relocationNote = `If relocating to a lower- or no-tax state in retirement is on the table, timing large conversions to happen after you've established residency there — not before — can meaningfully cut the state tax bill on the conversion. State tax residency is usually based on where you physically live and intend to stay, not just a mailing address, so confirm the specifics with a professional before a big conversion year.`;
  return `
    <h4>State tax considerations</h4>
    <p>${rateNote}${ssNote}</p>
    <p>${relocationNote}</p>
  `;
}
