/**
 * Long-term care (LTC) cost estimate for the retirement years. Uses
 * national median costs from the 2025 CareScout/Genworth Cost of Care
 * Survey, scaled by the state's cost-of-living index as a regional proxy —
 * the same simplification the healthcare-bridge estimate (healthcare.js)
 * already uses, since real per-state LTC data is far more volatile and
 * provider-specific than a single state average could responsibly capture.
 * About 70% of people who reach 65 develop a severe long-term care need
 * before they die, and 48% receive some paid care, per HHS/ASPE's 2022
 * lifetime-risk research brief — this is a real risk to plan for, not an
 * edge case.
 */

const LTC_CARE_TYPES = {
  homeHealthAide: {
    label: "Home health aide (part-time, ~44 hrs/week)",
    monthlyCostNational: (34 * 44 * 52) / 12, // $34/hr national median rate, Genworth/CareScout 2025
  },
  assistedLiving: {
    label: "Assisted living facility",
    monthlyCostNational: 6200,
  },
  nursingHomeSemiPrivate: {
    label: "Nursing home (semi-private room)",
    monthlyCostNational: 9576,
  },
  nursingHomePrivate: {
    label: "Nursing home (private room)",
    monthlyCostNational: 10792,
  },
};

const LTC_INSURANCE_SWEET_SPOT_MIN_AGE = 55;
const LTC_INSURANCE_SWEET_SPOT_MAX_AGE = 65;

/**
 * @param {string} careType key into LTC_CARE_TYPES
 * @param {number} careStartAge age long-term care is assumed to begin
 * @param {number} durationYears how many years of care are assumed
 * @param {object} stateInfo STATE_DATA entry, for regional cost scaling
 * @returns {object} {extraExpensesByAge, totalCost, monthlyRegionalCost}
 */
function buildLTCPlan(careType, careStartAge, durationYears, stateInfo) {
  const type = LTC_CARE_TYPES[careType];
  if (!type || !durationYears || durationYears <= 0) {
    return { extraExpensesByAge: {}, totalCost: 0, monthlyRegionalCost: 0, milestones: [] };
  }
  const monthlyRegionalCost = type.monthlyCostNational * (stateInfo.costOfLivingIndex / 100);
  const annualCost = monthlyRegionalCost * 12;
  const extraExpensesByAge = {};
  for (let age = careStartAge; age < careStartAge + durationYears; age++) {
    extraExpensesByAge[age] = annualCost;
  }
  return {
    extraExpensesByAge,
    totalCost: annualCost * durationYears,
    monthlyRegionalCost,
    milestones: [{ age: careStartAge, label: `Long-term care begins (est. ~${currency(annualCost)}/yr)` }],
  };
}
