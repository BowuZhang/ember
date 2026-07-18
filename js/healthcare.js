/**
 * Healthcare bridge cost estimate: the gap between retiring and Medicare
 * eligibility at 65. Uses a simplified version of the ACA's default 3:1
 * age-rating curve on a national-average benchmark premium, scaled by the
 * state's cost-of-living index as a rough regional proxy. Deliberately
 * assumes the FULL unsubsidized premium — most early retirees qualify for
 * ACA premium tax credits that substantially lower this, so treat the
 * result as a conservative upper bound, not a precise estimate.
 */

const MEDICARE_ELIGIBILITY_AGE = 65;
const DEFAULT_MONTHLY_PREMIUM_AT_40 = 500;

// Approximate anchor points on the ACA's default age-rating curve (age: factor),
// relative to a 21-year-old at 1.0.
const ACA_AGE_CURVE = [
  [21, 1.0],
  [30, 1.135],
  [40, 1.278],
  [50, 1.786],
  [60, 2.609],
  [64, 3.0],
];

function acaAgeRatingFactor(age) {
  if (age <= ACA_AGE_CURVE[0][0]) return ACA_AGE_CURVE[0][1];
  if (age >= 64) return 3.0;
  for (let i = 0; i < ACA_AGE_CURVE.length - 1; i++) {
    const [a0, f0] = ACA_AGE_CURVE[i];
    const [a1, f1] = ACA_AGE_CURVE[i + 1];
    if (age >= a0 && age <= a1) {
      const t = (age - a0) / (a1 - a0);
      return f0 + t * (f1 - f0);
    }
  }
  return 3.0;
}

function estimateAnnualHealthcarePremium(age, stateInfo, monthlyPremiumAt40) {
  const base = monthlyPremiumAt40 > 0 ? monthlyPremiumAt40 : DEFAULT_MONTHLY_PREMIUM_AT_40;
  const ageFactor = acaAgeRatingFactor(age) / acaAgeRatingFactor(40);
  const costOfLivingFactor = stateInfo.costOfLivingIndex / 100;
  return base * ageFactor * costOfLivingFactor * 12;
}

function buildHealthcarePlan(input) {
  const { retirementAge, stateCode, monthlyPremiumAt40, includeHealthcareBridge } = input;
  if (!includeHealthcareBridge || retirementAge >= MEDICARE_ELIGIBILITY_AGE) {
    return { extraExpensesByAge: {}, firstYearEstimate: 0 };
  }
  const stateInfo = STATE_DATA[stateCode];
  const extraExpensesByAge = {};
  for (let age = retirementAge; age < MEDICARE_ELIGIBILITY_AGE; age++) {
    extraExpensesByAge[age] = estimateAnnualHealthcarePremium(age, stateInfo, monthlyPremiumAt40);
  }
  // Timeline milestones for retirement age and Medicare (65) already exist
  // elsewhere, so this plan only contributes costs, not new milestones.
  return { extraExpensesByAge, firstYearEstimate: extraExpensesByAge[retirementAge] || 0 };
}
