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

/**
 * ACA premium tax credit (subsidy) estimate for the bridge years. The
 * "enhanced" subsidies (no income cap, capped at 8.5% of income) expired at
 * the end of 2025 — 2026 coverage reverts to the ORIGINAL ACA formula: a
 * hard cutoff at 400% of the federal poverty level (no subsidy at all above
 * it) and a steeper sliding-scale contribution below it. Verified against
 * IRS Rev. Proc. 2025-25 (applicable percentage table) and the 2025 HHS
 * poverty guidelines (used for 2026 coverage, per standard ACA timing).
 */
const ACA_FPL_HOUSEHOLD_1 = 15650; // 2025 guideline, 48 contiguous states + DC, used for 2026 coverage
const ACA_FPL_PER_ADDITIONAL_PERSON = 5500;

function acaFederalPovertyLevel(householdSize) {
  return ACA_FPL_HOUSEHOLD_1 + (householdSize - 1) * ACA_FPL_PER_ADDITIONAL_PERSON;
}

// 2026 applicable-percentage table (reverted to the original, non-enhanced formula).
const ACA_APPLICABLE_PERCENTAGE_TABLE = [
  { fplLow: 0, fplHigh: 133, pctLow: 0.021, pctHigh: 0.021 },
  { fplLow: 133, fplHigh: 150, pctLow: 0.0314, pctHigh: 0.0419 },
  { fplLow: 150, fplHigh: 200, pctLow: 0.0419, pctHigh: 0.066 },
  { fplLow: 200, fplHigh: 250, pctLow: 0.066, pctHigh: 0.0844 },
  { fplLow: 250, fplHigh: 300, pctLow: 0.0844, pctHigh: 0.0996 },
  { fplLow: 300, fplHigh: 400, pctLow: 0.0996, pctHigh: 0.0996 },
];

function acaApplicablePercentage(fplPct) {
  for (const tier of ACA_APPLICABLE_PERCENTAGE_TABLE) {
    if (fplPct <= tier.fplHigh) {
      const span = tier.fplHigh - tier.fplLow;
      const t = span > 0 ? (fplPct - tier.fplLow) / span : 0;
      return tier.pctLow + t * (tier.pctHigh - tier.pctLow);
    }
  }
  return null; // above 400% FPL — no subsidy
}

/**
 * @param {number} annualIncome MAGI proxy for the bridge years.
 * @param {number} householdSize 1 for single, 2 for married (Ember doesn't
 *   track dependents separately, so this mirrors the filing-status
 *   simplification used elsewhere in the app).
 * @param {number} benchmarkAnnualPremium the full unsubsidized premium
 *   already computed by estimateAnnualHealthcarePremium.
 */
function estimateACASubsidy(annualIncome, householdSize, benchmarkAnnualPremium) {
  const fpl = acaFederalPovertyLevel(householdSize);
  const fplPct = (annualIncome / fpl) * 100;
  if (fplPct > 400) {
    return { status: "above-cliff", fplPct, subsidizedPremium: benchmarkAnnualPremium, subsidy: 0 };
  }
  if (fplPct < 100) {
    return { status: "likely-medicaid", fplPct, subsidizedPremium: null, subsidy: null };
  }
  const pct = acaApplicablePercentage(fplPct);
  const requiredContribution = annualIncome * pct;
  const subsidy = Math.max(0, Math.min(benchmarkAnnualPremium, benchmarkAnnualPremium - requiredContribution));
  return { status: "subsidized", fplPct, subsidizedPremium: benchmarkAnnualPremium - subsidy, subsidy, requiredContribution };
}
