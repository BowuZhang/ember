/**
 * Simplified Social Security benefit estimator using the real SSA bend-point
 * formula and claiming-age adjustment rules, but approximating career-average
 * indexed earnings (AIME) with a single current-income estimate rather than
 * an actual 35-year wage history — disclosed clearly in the UI. Figures are
 * 2024 bend points; the full retirement age (67) reflects workers born 1960
 * or later, the relevant group for a forward-looking planning tool.
 */

const SS_BEND_POINT_1 = 1174; // monthly AIME, 2024
const SS_BEND_POINT_2 = 7078;
const SS_FULL_RETIREMENT_AGE = 67;

function computePIA(monthlyAIME) {
  const aime = Math.max(0, monthlyAIME);
  if (aime <= SS_BEND_POINT_1) return aime * 0.9;
  if (aime <= SS_BEND_POINT_2) return SS_BEND_POINT_1 * 0.9 + (aime - SS_BEND_POINT_1) * 0.32;
  return SS_BEND_POINT_1 * 0.9 + (SS_BEND_POINT_2 - SS_BEND_POINT_1) * 0.32 + (aime - SS_BEND_POINT_2) * 0.15;
}

function adjustPIAForClaimingAge(pia, claimAge) {
  const monthsDiff = Math.round((claimAge - SS_FULL_RETIREMENT_AGE) * 12);
  if (monthsDiff === 0) return pia;
  if (monthsDiff > 0) {
    const cappedMonths = Math.min(monthsDiff, (70 - SS_FULL_RETIREMENT_AGE) * 12);
    return pia * (1 + (cappedMonths * (2 / 3)) / 100);
  }
  const monthsEarly = Math.min(-monthsDiff, 60);
  const first36 = Math.min(monthsEarly, 36);
  const remaining = monthsEarly - first36;
  const reductionPct = first36 * (5 / 9) + remaining * (5 / 12);
  return pia * (1 - reductionPct / 100);
}

/**
 * @param {number} annualIncomeEstimate a rough stand-in for career-average
 *   earnings — using current income overstates the benefit for someone
 *   early in their career and understates it for someone past their peak.
 * @param {number} claimAge 62–70
 * @returns {number} estimated annual benefit in today's dollars
 */
function estimateSocialSecurityAnnualBenefit(annualIncomeEstimate, claimAge) {
  if (!annualIncomeEstimate || annualIncomeEstimate <= 0) return 0;
  const monthlyAIME = annualIncomeEstimate / 12;
  const pia = computePIA(monthlyAIME);
  return adjustPIAForClaimingAge(pia, claimAge) * 12;
}

/**
 * Builds the external-income schedule and timeline milestone for Social
 * Security, or an empty plan if no income estimate was provided.
 */
function buildSocialSecurityPlan(input) {
  const { annualIncomeEstimate, claimAge } = input;
  const annualBenefit = estimateSocialSecurityAnnualBenefit(annualIncomeEstimate, claimAge);
  if (annualBenefit <= 0) {
    return { externalIncomeByAge: {}, milestones: [], annualBenefit: 0 };
  }
  const externalIncomeByAge = {};
  for (let age = claimAge; age <= MAX_PLANNING_AGE; age++) {
    externalIncomeByAge[age] = annualBenefit;
  }
  return {
    externalIncomeByAge,
    milestones: [{ age: claimAge, label: `Social Security starts (est. ~$${Math.round(annualBenefit / 1000)}k/yr)` }],
    annualBenefit,
  };
}
