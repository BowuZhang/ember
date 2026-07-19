/**
 * Simplified federal + state effective tax rate estimator, used to gross up
 * a desired after-tax retirement income into a required gross withdrawal.
 * Brackets are 2026 figures (IRS Rev. Proc. 2025-32 / OBBBA adjustments),
 * for planning purposes only.
 */

const FEDERAL_BRACKETS = {
  single: [
    { upTo: 12400, rate: 0.10 },
    { upTo: 50400, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256225, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married: [
    { upTo: 24800, rate: 0.10 },
    { upTo: 100800, rate: 0.12 },
    { upTo: 211400, rate: 0.22 },
    { upTo: 403550, rate: 0.24 },
    { upTo: 512450, rate: 0.32 },
    { upTo: 768700, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION = {
  single: 16100,
  married: 32200,
};

function federalTax(grossIncome, filingStatus) {
  const brackets = FEDERAL_BRACKETS[filingStatus];
  const taxable = Math.max(0, grossIncome - STANDARD_DEDUCTION[filingStatus]);
  let tax = 0;
  let lastCap = 0;
  for (const bracket of brackets) {
    if (taxable <= lastCap) break;
    const slice = Math.min(taxable, bracket.upTo) - lastCap;
    tax += slice * bracket.rate;
    lastCap = bracket.upTo;
  }
  return tax;
}

function stateTax(grossIncome, stateInfo) {
  return grossIncome * stateInfo.effectiveRetirementTaxRate;
}

/** Effective combined federal+state rate for a given gross retirement income. */
function combinedEffectiveRate(grossIncome, filingStatus, stateInfo) {
  if (grossIncome <= 0) return 0;
  const fed = federalTax(grossIncome, filingStatus);
  const state = stateTax(grossIncome, stateInfo);
  return (fed + state) / grossIncome;
}

/** Splits a gross income amount into federal tax, state tax, and net take-home. */
function taxBreakdown(grossIncome, filingStatus, stateInfo) {
  const federal = federalTax(grossIncome, filingStatus);
  const state = stateTax(grossIncome, stateInfo);
  return { federal, state, net: grossIncome - federal - state };
}

/**
 * Solve for the gross withdrawal needed so that, after federal + state tax,
 * the retiree nets `desiredAfterTaxIncome`. Uses fixed-point iteration since
 * the effective rate itself depends on the gross amount (progressive brackets).
 */
function grossUpForTaxes(desiredAfterTaxIncome, filingStatus, stateInfo) {
  let gross = desiredAfterTaxIncome;
  for (let i = 0; i < 25; i++) {
    const rate = combinedEffectiveRate(gross, filingStatus, stateInfo);
    const nextGross = desiredAfterTaxIncome / (1 - rate);
    if (Math.abs(nextGross - gross) < 1) {
      gross = nextGross;
      break;
    }
    gross = nextGross;
  }
  return gross;
}
