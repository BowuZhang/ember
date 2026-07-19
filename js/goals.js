/**
 * Multi-goal savings planner: house down payment, a wedding, a car, kids'
 * education, or anything else outside retirement. Pure time-value-of-money
 * math (future value of current savings plus the level monthly payment
 * needed to close the remaining gap by the target date) — no external
 * figures to verify here, unlike the tax/benefit modules elsewhere.
 */

/**
 * @param {number} targetAmount goal cost in today's dollars
 * @param {number} currentSaved already saved toward this goal
 * @param {number} yearsAway time until the goal is needed
 * @param {number} annualReturnPct expected annual return on goal savings
 * @returns {number} level monthly contribution needed to hit the target
 */
function computeGoalMonthlyContribution(targetAmount, currentSaved, yearsAway, annualReturnPct) {
  if (yearsAway <= 0) return Math.max(0, targetAmount - currentSaved);
  const monthlyRate = annualReturnPct / 100 / 12;
  const numMonths = yearsAway * 12;
  const growthFactor = Math.pow(1 + monthlyRate, numMonths);
  const futureSavedValue = currentSaved * growthFactor;
  const remainingNeeded = Math.max(0, targetAmount - futureSavedValue);
  if (remainingNeeded <= 0) return 0;
  if (monthlyRate === 0) return remainingNeeded / numMonths;
  const annuityFactor = (growthFactor - 1) / monthlyRate;
  return remainingNeeded / annuityFactor;
}

function summarizeGoals(goals) {
  return goals.map((g) => ({
    ...g,
    requiredMonthly: computeGoalMonthlyContribution(g.targetAmount, g.currentSaved, g.yearsAway, g.annualReturnPct),
  }));
}
