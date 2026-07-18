/**
 * Mortgage/debt payoff modeling. Assumes the "desired annual spending"
 * input already represents your steady-state, post-payoff budget, and
 * adds the payment back as an extra cost for the years until payoff —
 * mirroring how family college costs are modeled.
 */

function buildMortgagePlan(input) {
  const { currentAge, monthlyPayment, yearsRemaining, includeMortgage } = input;
  if (!includeMortgage || monthlyPayment <= 0 || yearsRemaining <= 0) {
    return { extraExpensesByAge: {}, milestones: [] };
  }

  const payoffAge = currentAge + yearsRemaining;
  const annualPayment = monthlyPayment * 12;
  const extraExpensesByAge = {};
  for (let age = currentAge; age < payoffAge; age++) {
    extraExpensesByAge[age] = (extraExpensesByAge[age] || 0) + annualPayment;
  }

  return {
    extraExpensesByAge,
    milestones: [{ age: Math.round(payoffAge), label: "Mortgage paid off" }],
  };
}
