/**
 * Simplified Social Security benefit estimator using the real SSA bend-point
 * formula and claiming-age adjustment rules, but approximating career-average
 * indexed earnings (AIME) with a single current-income estimate rather than
 * an actual 35-year wage history — disclosed clearly in the UI. Figures are
 * 2026 bend points (for workers first becoming eligible in 2026); the full
 * retirement age (67) reflects workers born 1960 or later, the relevant
 * group for a forward-looking planning tool.
 */

const SS_BEND_POINT_1 = 1286; // monthly AIME, 2026
const SS_BEND_POINT_2 = 7749;
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

const SPOUSAL_MAX_EARLY_MONTHS = 60; // spousal reduction window is also capped at 5 years before FRA

/**
 * The spousal benefit reduction schedule differs slightly from the worker's
 * own-record schedule (25/36 of 1%/mo vs. 5/9 of 1%/mo for the first 36
 * months) per 20 CFR 404.410. Unlike a worker's own benefit, the spousal
 * portion never grows for delaying past full retirement age — it's capped
 * at 50% of the other spouse's PIA regardless of when that spouse claims.
 */
function spousalReductionFactor(claimAge) {
  const monthsEarly = Math.max(0, Math.min(Math.round((SS_FULL_RETIREMENT_AGE - claimAge) * 12), SPOUSAL_MAX_EARLY_MONTHS));
  const first36 = Math.min(monthsEarly, 36);
  const remaining = monthsEarly - first36;
  const reductionPct = first36 * (25 / 36) + remaining * (5 / 12);
  return 1 - reductionPct / 100;
}

/**
 * Each spouse always receives their own record's benefit first; if half of
 * the higher earner's full PIA exceeds that, the difference is paid as a
 * "spousal top-up" (simplified — ignores deemed-filing timing and assumes
 * the higher earner has already filed).
 */
function estimateHouseholdSocialSecurity(ownPIA, otherPIA, ownClaimAge) {
  const ownBenefit = adjustPIAForClaimingAge(ownPIA, ownClaimAge);
  const topUpAtFRA = Math.max(0, otherPIA * 0.5 - ownPIA);
  const topUp = topUpAtFRA * spousalReductionFactor(ownClaimAge);
  return (ownBenefit + topUp) * 12;
}

/**
 * Grid-searches every combination of claiming ages (62-70 each) for both
 * spouses and returns the combination that maximizes total household
 * lifetime benefit (each spouse's benefit runs from their own claim age to
 * their own MAX_PLANNING_AGE), alongside the totals for whatever
 * combination the user currently has selected.
 */
function optimizeHouseholdClaimingStrategy(primaryIncome, primaryClaimAge, spouseIncome, spouseClaimAge) {
  const primaryPIA = computePIA(primaryIncome / 12);
  const spousePIA = computePIA(spouseIncome / 12);

  let best = null;
  for (let pAge = 62; pAge <= 70; pAge++) {
    for (let sAge = 62; sAge <= 70; sAge++) {
      const primaryAnnual = estimateHouseholdSocialSecurity(primaryPIA, spousePIA, pAge);
      const spouseAnnual = estimateHouseholdSocialSecurity(spousePIA, primaryPIA, sAge);
      const primaryYears = Math.max(0, MAX_PLANNING_AGE - pAge);
      const spouseYears = Math.max(0, MAX_PLANNING_AGE - sAge);
      const total = primaryAnnual * primaryYears + spouseAnnual * spouseYears;
      if (!best || total > best.total) {
        best = { primaryClaimAge: pAge, spouseClaimAge: sAge, total, primaryAnnual, spouseAnnual };
      }
    }
  }

  const currentPrimaryAnnual = estimateHouseholdSocialSecurity(primaryPIA, spousePIA, primaryClaimAge);
  const currentSpouseAnnual = estimateHouseholdSocialSecurity(spousePIA, primaryPIA, spouseClaimAge);
  const currentTotal =
    currentPrimaryAnnual * Math.max(0, MAX_PLANNING_AGE - primaryClaimAge) +
    currentSpouseAnnual * Math.max(0, MAX_PLANNING_AGE - spouseClaimAge);

  const higherEarnerIsPrimary = primaryPIA >= spousePIA;

  return {
    best,
    current: { primaryClaimAge, spouseClaimAge, total: currentTotal, primaryAnnual: currentPrimaryAnnual, spouseAnnual: currentSpouseAnnual },
    higherEarnerIsPrimary,
  };
}

/**
 * Builds the external-income schedule and timeline milestone(s) for Social
 * Security, or an empty plan if no income estimate was provided. When a
 * spouse's own income/claim age/current age are given, each spouse's
 * benefit includes any spousal top-up (via estimateHouseholdSocialSecurity)
 * and the spouse's income is translated onto the primary's age scale using
 * the age gap between them, so both incomes land in the shared projection
 * at the right (primary-relative) year.
 */
function buildSocialSecurityPlan(input) {
  const { annualIncomeEstimate, claimAge, currentAge, spouse } = input;
  const hasSpouse = !!spouse; // present once the user fills in the spouse's age, even with $0 own income

  const primaryPIA = computePIA((annualIncomeEstimate || 0) / 12);
  const spousePIA = hasSpouse ? computePIA((spouse.annualIncomeEstimate || 0) / 12) : 0;

  const primaryAnnualBenefit = estimateHouseholdSocialSecurity(primaryPIA, spousePIA, claimAge);

  if (primaryAnnualBenefit <= 0 && !hasSpouse) {
    return { externalIncomeByAge: {}, milestones: [], annualBenefit: 0 };
  }

  const externalIncomeByAge = {};
  const milestones = [];

  if (primaryAnnualBenefit > 0) {
    for (let age = claimAge; age <= MAX_PLANNING_AGE; age++) {
      externalIncomeByAge[age] = (externalIncomeByAge[age] || 0) + primaryAnnualBenefit;
    }
    milestones.push({ age: claimAge, label: `Social Security starts (est. ~$${Math.round(primaryAnnualBenefit / 1000)}k/yr)` });
  }

  if (hasSpouse) {
    const spouseAnnualBenefit = estimateHouseholdSocialSecurity(spousePIA, primaryPIA, spouse.claimAge);
    const ageGap = (spouse.currentAge || currentAge) - currentAge; // + if spouse is older
    const primaryAgeWhenSpouseClaims = spouse.claimAge - ageGap;
    if (spouseAnnualBenefit > 0 && primaryAgeWhenSpouseClaims <= MAX_PLANNING_AGE) {
      const startAge = Math.max(currentAge, primaryAgeWhenSpouseClaims);
      for (let age = startAge; age <= MAX_PLANNING_AGE; age++) {
        externalIncomeByAge[age] = (externalIncomeByAge[age] || 0) + spouseAnnualBenefit;
      }
      milestones.push({
        age: Math.round(primaryAgeWhenSpouseClaims),
        label: `Spouse's Social Security starts (est. ~$${Math.round(spouseAnnualBenefit / 1000)}k/yr)`,
      });
    }
  }

  return {
    externalIncomeByAge,
    milestones,
    annualBenefit: primaryAnnualBenefit,
  };
}
