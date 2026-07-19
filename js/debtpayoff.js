/**
 * Debt avalanche vs. snowball payoff simulator. Avalanche orders debts by
 * highest interest rate first (minimizes total interest paid); snowball
 * orders by smallest balance first (faster early wins, shown by research
 * to help people stick with a payoff plan even though it costs more in
 * interest). Both roll a paid-off debt's minimum payment into the extra
 * payment pool for the next-priority debt, which is what actually produces
 * the accelerating "snowball" effect.
 */

const DEBT_PAYOFF_MAX_MONTHS = 600; // 50-year safety cap against runaway loops

function simulateDebtPayoff(debts, extraPayment, method) {
  const active = debts.filter((d) => d.balance > 0);
  if (active.length === 0) return { totalMonths: 0, totalInterest: 0, payoffOrder: [] };

  const order = [...active].sort((a, b) => (method === "avalanche" ? b.apr - a.apr : a.balance - b.balance));
  const working = order.map((d) => ({ ...d }));
  let month = 0;
  let totalInterest = 0;
  let currentExtra = extraPayment;
  const payoffMonth = {};

  while (working.some((d) => d.balance > 0.01) && month < DEBT_PAYOFF_MAX_MONTHS) {
    month++;
    for (const d of working) {
      if (d.balance <= 0) continue;
      const interest = d.balance * (d.apr / 100 / 12);
      totalInterest += interest;
      d.balance += interest;
      d.balance -= Math.min(d.minPayment, d.balance);
    }
    let extraLeft = currentExtra;
    for (const d of working) {
      if (extraLeft <= 0) break;
      if (d.balance <= 0) continue;
      const pay = Math.min(extraLeft, d.balance);
      d.balance -= pay;
      extraLeft -= pay;
    }
    for (const d of working) {
      if (d.balance <= 0.01 && !(d.id in payoffMonth)) {
        payoffMonth[d.id] = month;
        currentExtra += d.minPayment;
      }
    }
  }

  const payoffOrder = order
    .map((d) => ({ id: d.id, name: d.name, month: payoffMonth[d.id] ?? null }))
    .sort((a, b) => (a.month ?? Infinity) - (b.month ?? Infinity));

  return { totalMonths: month, totalInterest, payoffOrder, sustainable: month < DEBT_PAYOFF_MAX_MONTHS };
}

function compareDebtPayoffMethods(debts, extraPayment) {
  return {
    avalanche: simulateDebtPayoff(debts, extraPayment, "avalanche"),
    snowball: simulateDebtPayoff(debts, extraPayment, "snowball"),
  };
}
