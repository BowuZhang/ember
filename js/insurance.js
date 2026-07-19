/**
 * Life insurance needs analysis (DIME method: Debt, Income replacement,
 * Mortgage, Education) and disability insurance coverage guidance.
 * DIME is a standard, widely-used rule-of-thumb worksheet — see e.g.
 * insurer/broker explainers (Ogletree Financial, Ritter Insurance
 * Marketing) — not a regulated figure, so no yearly-verification needed
 * the way tax/benefit thresholds are. Disability coverage guidance
 * (60-70% of gross income, 1-3% of income as annual premium) reflects
 * commonly cited industry benchmarks (Guardian, Policygenius).
 */

/**
 * @param {number} nonMortgageDebt credit cards, student loans, auto loans, etc.
 * @param {number} annualIncome income to replace
 * @param {number} incomeReplacementYears how many years of income to cover
 * @param {number} mortgageBalance remaining mortgage balance
 * @param {number} educationCost remaining education costs for dependents
 * @param {number} existingCoverage current life insurance already in force
 * @returns {object} {dimeTotal, gap}
 */
function computeDIMENeed(nonMortgageDebt, annualIncome, incomeReplacementYears, mortgageBalance, educationCost, existingCoverage) {
  const dimeTotal = nonMortgageDebt + annualIncome * incomeReplacementYears + mortgageBalance + educationCost;
  const gap = Math.max(0, dimeTotal - existingCoverage);
  return { dimeTotal, gap };
}

const DISABILITY_INCOME_REPLACEMENT_LOW = 0.6;
const DISABILITY_INCOME_REPLACEMENT_HIGH = 0.7;
const DISABILITY_PREMIUM_PCT_LOW = 0.01;
const DISABILITY_PREMIUM_PCT_HIGH = 0.03;

function estimateDisabilityCoverage(annualIncome) {
  return {
    monthlyBenefitLow: (annualIncome * DISABILITY_INCOME_REPLACEMENT_LOW) / 12,
    monthlyBenefitHigh: (annualIncome * DISABILITY_INCOME_REPLACEMENT_HIGH) / 12,
    annualPremiumLow: annualIncome * DISABILITY_PREMIUM_PCT_LOW,
    annualPremiumHigh: annualIncome * DISABILITY_PREMIUM_PCT_HIGH,
  };
}
