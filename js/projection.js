/**
 * Portfolio projection engine. All dollar amounts are in TODAY's (real,
 * inflation-adjusted) dollars — growth rates passed in should already be
 * real rates (nominal return minus inflation), which keeps the whole
 * projection in constant purchasing power and avoids compounding two
 * separate inflation adjustments.
 */

const MAX_PLANNING_AGE = 100;

function realReturn(nominalRatePct, inflationRatePct) {
  const nominal = nominalRatePct / 100;
  const inflation = inflationRatePct / 100;
  return (1 + nominal) / (1 + inflation) - 1;
}

/**
 * Computes the gross portfolio withdrawal needed in a single retirement
 * year, after netting out any external income (e.g. Social Security)
 * available that year. External income is taxed at the state's Social
 * Security rate if that state taxes it, otherwise assumed untaxed — federal
 * partial taxation of Social Security is not modeled (a simplification).
 */
function yearlyPortfolioWithdrawal(annualExpensesToday, externalIncomeThisYear, filingStatus, stateInfo) {
  const netExternal = externalIncomeThisYear * (stateInfo.taxesSocialSecurity ? 1 - stateInfo.effectiveRetirementTaxRate : 1);
  const neededNet = Math.max(0, annualExpensesToday - netExternal);
  return neededNet > 0 ? grossUpForTaxes(neededNet, filingStatus, stateInfo) : 0;
}

/**
 * Runs a full accumulation + drawdown projection.
 *
 * @param {object} input
 *   currentAge, retirementAge, currentPortfolio, annualContribution,
 *   preRetirementReturnPct, postRetirementReturnPct, inflationPct,
 *   annualExpensesToday, swrPct, filingStatus, stateCode
 * @param {object} [adjustments]
 *   extraExpensesByAge: {age: amount} one-off costs (college, healthcare
 *     bridge, mortgage) subtracted directly from the balance each year.
 *   externalIncomeByAge: {age: amount} gross external income (e.g. Social
 *     Security) that reduces the portfolio withdrawal needed that year.
 * @returns {object} projection results
 */
function runProjection(input, adjustments) {
  const {
    currentAge,
    retirementAge,
    currentPortfolio,
    annualContribution,
    preRetirementReturnPct,
    postRetirementReturnPct,
    inflationPct,
    annualExpensesToday,
    swrPct,
    filingStatus,
    stateCode,
  } = input;
  const extras = (adjustments && adjustments.extraExpensesByAge) || {};
  const externalIncome = (adjustments && adjustments.externalIncomeByAge) || {};

  const stateInfo = STATE_DATA[stateCode];
  const preReturn = realReturn(preRetirementReturnPct, inflationPct);
  const postReturn = realReturn(postRetirementReturnPct, inflationPct);
  const swr = swrPct / 100;

  // Gross annual withdrawal needed (today's dollars) to net the desired
  // after-tax spending, ignoring external income — this is the
  // conservative, fully-self-funded figure used for the FIRE number.
  const grossAnnualWithdrawal = grossUpForTaxes(annualExpensesToday, filingStatus, stateInfo);
  const fireNumber = grossAnnualWithdrawal / swr;

  // Coast FIRE: portfolio value at any given age that would grow to the
  // FIRE number by retirement age with zero further contributions.
  const coastFireNumberAt = (age) => fireNumber / Math.pow(1 + preReturn, Math.max(0, retirementAge - age));
  const coastFireNumber = coastFireNumberAt(currentAge);
  const alreadyCoastFire = currentPortfolio >= coastFireNumber;

  const points = [];
  let balance = currentPortfolio;
  let fireAge = null;
  let coastFireAge = alreadyCoastFire ? currentAge : null;

  // Accumulation phase
  for (let age = currentAge; age <= retirementAge; age++) {
    points.push({ age, balance, phase: "accumulation" });
    if (fireAge === null && balance >= fireNumber) fireAge = age;
    if (coastFireAge === null && balance >= coastFireNumberAt(age)) coastFireAge = age;
    if (age < retirementAge) {
      balance = balance * (1 + preReturn) + annualContribution - (extras[age] || 0);
    }
  }

  // Drawdown phase
  let depletedAge = null;
  let drawdownBalance = balance;
  for (let age = retirementAge + 1; age <= MAX_PLANNING_AGE; age++) {
    const withdrawal = yearlyPortfolioWithdrawal(annualExpensesToday, externalIncome[age] || 0, filingStatus, stateInfo);
    drawdownBalance = drawdownBalance * (1 + postReturn) - withdrawal - (extras[age] || 0);
    points.push({ age, balance: Math.max(0, drawdownBalance), phase: "drawdown" });
    if (drawdownBalance <= 0 && depletedAge === null) {
      depletedAge = age;
      break;
    }
  }

  const sustainable = depletedAge === null;

  return {
    points,
    fireNumber,
    grossAnnualWithdrawal,
    fireAge,
    coastFireNumber,
    coastFireAge,
    alreadyCoastFire,
    depletedAge,
    sustainable,
    balanceAtRetirement: points.find((p) => p.age === retirementAge)?.balance ?? balance,
    preReturn,
    postReturn,
  };
}

/** Suggests which FIRE variant best matches the user's numbers. */
function classifyFireType(input, result) {
  const { annualExpensesToday } = input;
  if (result.alreadyCoastFire && input.currentAge < input.retirementAge) {
    return {
      label: "Coast FIRE",
      description:
        "Your current portfolio is already large enough to grow to your FIRE number by your target retirement age without any further contributions — you could stop saving and just cover living expenses until then.",
    };
  }
  if (annualExpensesToday <= 40000) {
    return {
      label: "Lean FIRE",
      description:
        "Your target spending is modest, consistent with a minimalist, low-cost lifestyle. Lean FIRE requires the smallest portfolio but leaves little cushion for surprises.",
    };
  }
  if (annualExpensesToday >= 100000) {
    return {
      label: "Fat FIRE",
      description:
        "Your target spending supports a comfortable, higher-cost lifestyle in retirement. Fat FIRE requires a larger portfolio but provides more margin and flexibility.",
    };
  }
  return {
    label: "Traditional FIRE",
    description:
      "Your target spending is in the typical middle-class range — a balanced approach between Lean and Fat FIRE.",
  };
}
