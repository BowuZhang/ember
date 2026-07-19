/**
 * "Stealth" tax and Medicare cliffs that specifically hit higher-income,
 * higher-asset retirees: IRMAA Medicare surcharges, the Net Investment
 * Income Tax (NIIT), and Social Security benefit taxation. All three use
 * a MAGI proxy built from the calculator's already-computed gross annual
 * withdrawal — a simplification, since actual MAGI depends on account mix
 * and year-by-year timing this app doesn't model in full, but a reasonable
 * planning-level estimate.
 *
 * 2026 figures: IRMAA brackets are inflation-adjusted annually (verified
 * against cms.gov). NIIT ($200k/$250k) and Social Security taxation
 * ($25k/$34k, $32k/$44k) thresholds are fixed by statute and have never
 * been indexed for inflation — NIIT since it began in 2013, Social
 * Security taxation since 1984 — so more retirees cross them every year
 * even without a real income increase.
 */

const IRMAA_BRACKETS = {
  single: [
    { upTo: 109000, partB: 0, partD: 0 },
    { upTo: 137000, partB: 81.2, partD: 14.5 },
    { upTo: 171000, partB: 202.9, partD: 37.5 },
    { upTo: 205000, partB: 324.6, partD: 60.4 },
    { upTo: 500000, partB: 446.3, partD: 83.3 },
    { upTo: Infinity, partB: 487.0, partD: 91.0 },
  ],
  married: [
    { upTo: 218000, partB: 0, partD: 0 },
    { upTo: 274000, partB: 81.2, partD: 14.5 },
    { upTo: 342000, partB: 202.9, partD: 37.5 },
    { upTo: 410000, partB: 324.6, partD: 60.4 },
    { upTo: 750000, partB: 446.3, partD: 83.3 },
    { upTo: Infinity, partB: 487.0, partD: 91.0 },
  ],
};

function estimateIRMAA(magi, filingStatus) {
  const brackets = IRMAA_BRACKETS[filingStatus];
  const tier = brackets.find((b) => magi <= b.upTo);
  const monthlySurcharge = tier.partB + tier.partD;
  return { monthlySurcharge, annualSurcharge: monthlySurcharge * 12, triggered: monthlySurcharge > 0 };
}

const NIIT_THRESHOLD = { single: 200000, married: 250000 };
const NIIT_RATE = 0.038;

function estimateNIIT(magi, netInvestmentIncome, filingStatus) {
  const threshold = NIIT_THRESHOLD[filingStatus];
  const excessMAGI = Math.max(0, magi - threshold);
  const taxableAmount = Math.min(netInvestmentIncome, excessMAGI);
  return { annualTax: taxableAmount * NIIT_RATE, triggered: taxableAmount > 0 };
}

const SS_TAX_THRESHOLDS = {
  single: { tier1: 25000, tier2: 34000 },
  married: { tier1: 32000, tier2: 44000 },
};

/**
 * A simplified version of the IRS Social Security Benefits Worksheet.
 * `otherIncome` should exclude the Social Security benefit itself.
 */
function estimateTaxableSocialSecurity(otherIncome, ssBenefit, filingStatus) {
  const { tier1, tier2 } = SS_TAX_THRESHOLDS[filingStatus];
  if (ssBenefit <= 0) return { taxablePortion: 0, taxablePct: 0 };
  const provisionalIncome = otherIncome + ssBenefit * 0.5;
  if (provisionalIncome <= tier1) return { taxablePortion: 0, taxablePct: 0 };

  let taxable;
  if (provisionalIncome <= tier2) {
    taxable = Math.min(ssBenefit * 0.5, (provisionalIncome - tier1) * 0.5);
  } else {
    const tier2Excess = provisionalIncome - tier2;
    taxable = Math.min(ssBenefit * 0.85, tier2Excess * 0.85 + Math.min(ssBenefit * 0.5, (tier2 - tier1) * 0.5));
  }
  return { taxablePortion: taxable, taxablePct: taxable / ssBenefit };
}
