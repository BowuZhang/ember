/**
 * Multi-bucket (Traditional / Roth / Taxable) withdrawal-order simulator.
 * This is a separate, opt-in "advanced" calculation — it does not change
 * the simple single-bucket FIRE numbers in projection.js. Traditional
 * withdrawals are taxed as ordinary income (federal brackets + state rate,
 * computed in isolation per bucket — a simplification since real brackets
 * would stack against other income). Taxable withdrawals assume a flat
 * long-term capital-gains rate applied only to the gains portion. Roth
 * withdrawals are tax-free. All amounts are real (today's) dollars.
 */

const WITHDRAWAL_STRATEGIES = {
  "taxable-first": { label: "Taxable → Traditional → Roth (conventional)", order: ["taxable", "traditional", "roth"] },
  "traditional-first": { label: "Traditional → Taxable → Roth", order: ["traditional", "taxable", "roth"] },
  proportional: { label: "Proportional (blend all three)", order: null },
};

const FEDERAL_LTCG_RATE = 0.15;

function normalizeAccountSplit(split) {
  const sum = split.traditionalPct + split.rothPct + split.taxablePct;
  if (sum <= 0) return { traditionalPct: 1, rothPct: 0, taxablePct: 0 };
  return {
    traditionalPct: split.traditionalPct / sum,
    rothPct: split.rothPct / sum,
    taxablePct: split.taxablePct / sum,
  };
}

function simulateWithdrawalStrategy(input, split, strategyKey, adjustments) {
  const {
    currentAge, retirementAge, currentPortfolio, annualContribution,
    annualExpensesToday, filingStatus, stateCode, taxableGainsFraction,
  } = input;
  const stateInfo = STATE_DATA[stateCode];
  const preReturn = realReturn(input.preRetirementReturnPct, input.inflationPct);
  const postReturn = realReturn(input.postRetirementReturnPct, input.inflationPct);
  const gainsFraction = taxableGainsFraction > 0 ? taxableGainsFraction : 0.5;
  const extras = (adjustments && adjustments.extraExpensesByAge) || {};
  const externalIncome = (adjustments && adjustments.externalIncomeByAge) || {};
  const norm = normalizeAccountSplit(split);

  const buckets = {
    traditional: currentPortfolio * norm.traditionalPct,
    roth: currentPortfolio * norm.rothPct,
    taxable: currentPortfolio * norm.taxablePct,
  };

  for (let age = currentAge; age < retirementAge; age++) {
    const extra = extras[age] || 0;
    buckets.traditional = buckets.traditional * (1 + preReturn) + annualContribution * norm.traditionalPct;
    buckets.roth = buckets.roth * (1 + preReturn) + annualContribution * norm.rothPct;
    buckets.taxable = buckets.taxable * (1 + preReturn) + annualContribution * norm.taxablePct - extra;
  }
  const traditionalBalanceAtRetirement = buckets.traditional;

  function withdrawFromBucket(type, available, netTarget) {
    if (available <= 0 || netTarget <= 0) return { grossWithdrawn: 0, netAchieved: 0, federal: 0, state: 0 };
    let grossWanted;
    if (type === "roth") grossWanted = netTarget;
    else if (type === "taxable") {
      const rate = gainsFraction * (FEDERAL_LTCG_RATE + stateInfo.effectiveRetirementTaxRate);
      grossWanted = netTarget / (1 - rate);
    } else {
      grossWanted = grossUpForTaxes(netTarget, filingStatus, stateInfo);
    }
    const grossWithdrawn = Math.min(grossWanted, available);
    if (type === "roth") return { grossWithdrawn, netAchieved: grossWithdrawn, federal: 0, state: 0 };
    if (type === "taxable") {
      const federal = grossWithdrawn * gainsFraction * FEDERAL_LTCG_RATE;
      const state = grossWithdrawn * gainsFraction * stateInfo.effectiveRetirementTaxRate;
      return { grossWithdrawn, netAchieved: grossWithdrawn - federal - state, federal, state };
    }
    const federal = federalTax(grossWithdrawn, filingStatus);
    const state = stateTax(grossWithdrawn, stateInfo);
    return { grossWithdrawn, netAchieved: grossWithdrawn - federal - state, federal, state };
  }

  const rows = [];
  let depletedAge = null;
  let lifetimeFederalTax = 0;
  let lifetimeStateTax = 0;

  for (let age = retirementAge + 1; age <= MAX_PLANNING_AGE; age++) {
    buckets.traditional *= 1 + postReturn;
    buckets.roth *= 1 + postReturn;
    buckets.taxable *= 1 + postReturn;

    const extra = extras[age] || 0;
    const grossExternal = externalIncome[age] || 0;
    const netExternal = grossExternal * (stateInfo.taxesSocialSecurity ? 1 - stateInfo.effectiveRetirementTaxRate : 1);
    const targetTotal = Math.max(0, annualExpensesToday - netExternal) + extra;
    const withdrawals = { traditional: 0, roth: 0, taxable: 0 };
    let federalTaxPaid = 0;
    let stateTaxPaid = 0;
    let netAchieved = 0;

    if (strategyKey === "proportional") {
      const total = buckets.traditional + buckets.roth + buckets.taxable;
      if (total > 0) {
        ["traditional", "roth", "taxable"].forEach((type) => {
          const weight = buckets[type] / total;
          const res = withdrawFromBucket(type, buckets[type], targetTotal * weight);
          buckets[type] -= res.grossWithdrawn;
          withdrawals[type] += res.grossWithdrawn;
          federalTaxPaid += res.federal;
          stateTaxPaid += res.state;
          netAchieved += res.netAchieved;
        });
      }
    } else {
      let remainingNet = targetTotal;
      for (const type of WITHDRAWAL_STRATEGIES[strategyKey].order) {
        if (remainingNet <= 0) break;
        const res = withdrawFromBucket(type, buckets[type], remainingNet);
        buckets[type] -= res.grossWithdrawn;
        withdrawals[type] += res.grossWithdrawn;
        remainingNet -= res.netAchieved;
        federalTaxPaid += res.federal;
        stateTaxPaid += res.state;
      }
      netAchieved = targetTotal - Math.max(0, remainingNet);
    }

    const totalBalance = buckets.traditional + buckets.roth + buckets.taxable;
    rows.push({
      age,
      withdrawals,
      federalTax: federalTaxPaid,
      stateTax: stateTaxPaid,
      totalTax: federalTaxPaid + stateTaxPaid,
      netAchieved,
      shortfall: Math.max(0, targetTotal - netAchieved),
      balances: { ...buckets },
      totalBalance,
    });
    lifetimeFederalTax += federalTaxPaid;
    lifetimeStateTax += stateTaxPaid;

    if (totalBalance <= 0.01 && netAchieved < targetTotal - 0.01 && depletedAge === null) {
      depletedAge = age;
      break;
    }
  }

  return {
    strategyKey,
    label: WITHDRAWAL_STRATEGIES[strategyKey].label,
    rows,
    depletedAge,
    sustainable: depletedAge === null,
    lifetimeFederalTax,
    lifetimeStateTax,
    lifetimeTotalTax: lifetimeFederalTax + lifetimeStateTax,
    finalBalance: rows.length ? rows[rows.length - 1].totalBalance : 0,
    traditionalBalanceAtRetirement,
  };
}

function compareWithdrawalStrategies(input, split, adjustments) {
  return Object.keys(WITHDRAWAL_STRATEGIES).map((key) =>
    simulateWithdrawalStrategy(input, split, key, adjustments)
  );
}
