/**
 * Required Minimum Distribution projection. Uses the IRS Uniform Lifetime
 * Table (unchanged since 2022, verified against IRS Pub. 590-B and two
 * independent secondary sources) and the SECURE 2.0 starting-age schedule:
 * age 73 for people born 1951-1959, age 75 for people born 1960 or later.
 * Applied against the Traditional-bucket balance path from the multi-bucket
 * withdrawal-strategy simulator (strategy.js), so it reflects whatever
 * withdrawal order the user has selected there.
 */

const UNIFORM_LIFETIME_TABLE = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7,
  89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
  97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9,
  105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3,
  113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};

function rmdDistributionFactor(age) {
  if (age >= 120) return UNIFORM_LIFETIME_TABLE[120];
  if (age <= 73) return UNIFORM_LIFETIME_TABLE[73];
  return UNIFORM_LIFETIME_TABLE[age];
}

/** SECURE 2.0: RMD age is 73 for those born 1951-1959, 75 for 1960 or later. */
function rmdStartAge(currentAge) {
  const birthYear = new Date().getFullYear() - currentAge;
  return birthYear <= 1959 ? 73 : 75;
}

/**
 * @param {Array} rows withdrawal-strategy simulation rows (strategy.js),
 *   each with {age, withdrawals: {traditional}, balances: {traditional}}.
 * @param {number} startAge RMD starting age from rmdStartAge().
 * @param {number} traditionalBalanceAtRetirement the Traditional bucket's
 *   balance the moment retirement begins — used as the "prior year-end"
 *   basis for the very first RMD year, since no simulated row precedes it.
 */
function buildRMDProjection(rows, startAge, traditionalBalanceAtRetirement) {
  const projection = [];
  let priorYearEndBalance = traditionalBalanceAtRetirement;
  for (const row of rows) {
    if (row.age >= startAge) {
      const factor = rmdDistributionFactor(row.age);
      const requiredRMD = priorYearEndBalance / factor;
      const actualWithdrawal = row.withdrawals.traditional;
      const shortfall = Math.max(0, requiredRMD - actualWithdrawal);
      projection.push({ age: row.age, requiredRMD, actualWithdrawal, shortfall });
    }
    priorYearEndBalance = row.balances.traditional;
  }
  return projection;
}
