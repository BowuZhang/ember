/**
 * Simplified, illustrative U.S. state tax & cost-of-living dataset.
 *
 * Figures are approximate composites (income tax treatment of retirement
 * income, average combined sales tax, average effective property tax rate,
 * and a cost-of-living index where 100 = U.S. average). Real rates change
 * yearly and depend on individual circumstances (filing status, income
 * level, exclusions/credits for seniors, local jurisdiction, etc).
 *
 * This dataset is for RELATIVE COMPARISON and ROUGH PLANNING ONLY.
 * Always confirm current figures with your state's Department of Revenue
 * or a tax professional before making financial decisions.
 */

const STATE_DATA = {
  AL: { name: "Alabama", effectiveRetirementTaxRate: 0.03, taxesSocialSecurity: false, salesTaxRate: 9.24, propertyTaxRate: 0.41, costOfLivingIndex: 87 },
  AK: { name: "Alaska", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 1.76, propertyTaxRate: 1.19, costOfLivingIndex: 125 },
  AZ: { name: "Arizona", effectiveRetirementTaxRate: 0.02, taxesSocialSecurity: false, salesTaxRate: 8.40, propertyTaxRate: 0.62, costOfLivingIndex: 102 },
  AR: { name: "Arkansas", effectiveRetirementTaxRate: 0.03, taxesSocialSecurity: false, salesTaxRate: 9.44, propertyTaxRate: 0.62, costOfLivingIndex: 86 },
  CA: { name: "California", effectiveRetirementTaxRate: 0.06, taxesSocialSecurity: false, salesTaxRate: 8.85, propertyTaxRate: 0.75, costOfLivingIndex: 138 },
  CO: { name: "Colorado", effectiveRetirementTaxRate: 0.035, taxesSocialSecurity: true, salesTaxRate: 7.81, propertyTaxRate: 0.51, costOfLivingIndex: 105 },
  CT: { name: "Connecticut", effectiveRetirementTaxRate: 0.05, taxesSocialSecurity: true, salesTaxRate: 6.35, propertyTaxRate: 2.15, costOfLivingIndex: 121 },
  DE: { name: "Delaware", effectiveRetirementTaxRate: 0.03, taxesSocialSecurity: false, salesTaxRate: 0.00, propertyTaxRate: 0.57, costOfLivingIndex: 103 },
  FL: { name: "Florida", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 7.02, propertyTaxRate: 0.86, costOfLivingIndex: 100 },
  GA: { name: "Georgia", effectiveRetirementTaxRate: 0.01, taxesSocialSecurity: false, salesTaxRate: 7.40, propertyTaxRate: 0.92, costOfLivingIndex: 92 },
  HI: { name: "Hawaii", effectiveRetirementTaxRate: 0.02, taxesSocialSecurity: false, salesTaxRate: 4.50, propertyTaxRate: 0.29, costOfLivingIndex: 184 },
  ID: { name: "Idaho", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: false, salesTaxRate: 6.02, propertyTaxRate: 0.63, costOfLivingIndex: 96 },
  IL: { name: "Illinois", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 8.82, propertyTaxRate: 2.08, costOfLivingIndex: 94 },
  IN: { name: "Indiana", effectiveRetirementTaxRate: 0.025, taxesSocialSecurity: false, salesTaxRate: 7.00, propertyTaxRate: 0.85, costOfLivingIndex: 90 },
  IA: { name: "Iowa", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 6.94, propertyTaxRate: 1.52, costOfLivingIndex: 89 },
  KS: { name: "Kansas", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: false, salesTaxRate: 8.70, propertyTaxRate: 1.41, costOfLivingIndex: 87 },
  KY: { name: "Kentucky", effectiveRetirementTaxRate: 0.025, taxesSocialSecurity: false, salesTaxRate: 6.00, propertyTaxRate: 0.85, costOfLivingIndex: 91 },
  LA: { name: "Louisiana", effectiveRetirementTaxRate: 0.02, taxesSocialSecurity: false, salesTaxRate: 9.55, propertyTaxRate: 0.55, costOfLivingIndex: 93 },
  ME: { name: "Maine", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: false, salesTaxRate: 5.50, propertyTaxRate: 1.28, costOfLivingIndex: 113 },
  MD: { name: "Maryland", effectiveRetirementTaxRate: 0.05, taxesSocialSecurity: false, salesTaxRate: 6.00, propertyTaxRate: 1.05, costOfLivingIndex: 116 },
  MA: { name: "Massachusetts", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: false, salesTaxRate: 6.25, propertyTaxRate: 1.21, costOfLivingIndex: 132 },
  MI: { name: "Michigan", effectiveRetirementTaxRate: 0.02, taxesSocialSecurity: false, salesTaxRate: 6.00, propertyTaxRate: 1.44, costOfLivingIndex: 90 },
  MN: { name: "Minnesota", effectiveRetirementTaxRate: 0.05, taxesSocialSecurity: true, salesTaxRate: 7.49, propertyTaxRate: 1.11, costOfLivingIndex: 95 },
  MS: { name: "Mississippi", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 7.07, propertyTaxRate: 0.79, costOfLivingIndex: 85 },
  MO: { name: "Missouri", effectiveRetirementTaxRate: 0.02, taxesSocialSecurity: false, salesTaxRate: 8.29, propertyTaxRate: 0.98, costOfLivingIndex: 87 },
  MT: { name: "Montana", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: true, salesTaxRate: 0.00, propertyTaxRate: 0.83, costOfLivingIndex: 101 },
  NE: { name: "Nebraska", effectiveRetirementTaxRate: 0.035, taxesSocialSecurity: false, salesTaxRate: 6.94, propertyTaxRate: 1.63, costOfLivingIndex: 91 },
  NV: { name: "Nevada", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 8.23, propertyTaxRate: 0.55, costOfLivingIndex: 104 },
  NH: { name: "New Hampshire", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 0.00, propertyTaxRate: 2.09, costOfLivingIndex: 109 },
  NJ: { name: "New Jersey", effectiveRetirementTaxRate: 0.02, taxesSocialSecurity: false, salesTaxRate: 6.60, propertyTaxRate: 2.47, costOfLivingIndex: 114 },
  NM: { name: "New Mexico", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: true, salesTaxRate: 7.72, propertyTaxRate: 0.73, costOfLivingIndex: 89 },
  NY: { name: "New York", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: false, salesTaxRate: 8.53, propertyTaxRate: 1.72, costOfLivingIndex: 125 },
  NC: { name: "North Carolina", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: false, salesTaxRate: 6.98, propertyTaxRate: 0.78, costOfLivingIndex: 93 },
  ND: { name: "North Dakota", effectiveRetirementTaxRate: 0.015, taxesSocialSecurity: false, salesTaxRate: 6.96, propertyTaxRate: 1.00, costOfLivingIndex: 98 },
  OH: { name: "Ohio", effectiveRetirementTaxRate: 0.02, taxesSocialSecurity: false, salesTaxRate: 7.24, propertyTaxRate: 1.53, costOfLivingIndex: 90 },
  OK: { name: "Oklahoma", effectiveRetirementTaxRate: 0.025, taxesSocialSecurity: false, salesTaxRate: 8.98, propertyTaxRate: 0.89, costOfLivingIndex: 86 },
  OR: { name: "Oregon", effectiveRetirementTaxRate: 0.06, taxesSocialSecurity: false, salesTaxRate: 0.00, propertyTaxRate: 0.93, costOfLivingIndex: 113 },
  PA: { name: "Pennsylvania", effectiveRetirementTaxRate: 0.005, taxesSocialSecurity: false, salesTaxRate: 6.34, propertyTaxRate: 1.53, costOfLivingIndex: 96 },
  RI: { name: "Rhode Island", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: true, salesTaxRate: 7.00, propertyTaxRate: 1.53, costOfLivingIndex: 116 },
  SC: { name: "South Carolina", effectiveRetirementTaxRate: 0.03, taxesSocialSecurity: false, salesTaxRate: 7.46, propertyTaxRate: 0.56, costOfLivingIndex: 96 },
  SD: { name: "South Dakota", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 6.11, propertyTaxRate: 1.24, costOfLivingIndex: 101 },
  TN: { name: "Tennessee", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 9.55, propertyTaxRate: 0.66, costOfLivingIndex: 89 },
  TX: { name: "Texas", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 8.20, propertyTaxRate: 1.68, costOfLivingIndex: 92 },
  UT: { name: "Utah", effectiveRetirementTaxRate: 0.035, taxesSocialSecurity: true, salesTaxRate: 7.19, propertyTaxRate: 0.58, costOfLivingIndex: 96 },
  VT: { name: "Vermont", effectiveRetirementTaxRate: 0.05, taxesSocialSecurity: true, salesTaxRate: 6.24, propertyTaxRate: 1.90, costOfLivingIndex: 114 },
  VA: { name: "Virginia", effectiveRetirementTaxRate: 0.04, taxesSocialSecurity: false, salesTaxRate: 5.75, propertyTaxRate: 0.82, costOfLivingIndex: 100 },
  WA: { name: "Washington", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 9.38, propertyTaxRate: 0.94, costOfLivingIndex: 115 },
  WV: { name: "West Virginia", effectiveRetirementTaxRate: 0.035, taxesSocialSecurity: true, salesTaxRate: 6.50, propertyTaxRate: 0.58, costOfLivingIndex: 88 },
  WI: { name: "Wisconsin", effectiveRetirementTaxRate: 0.045, taxesSocialSecurity: false, salesTaxRate: 5.43, propertyTaxRate: 1.68, costOfLivingIndex: 95 },
  WY: { name: "Wyoming", effectiveRetirementTaxRate: 0.00, taxesSocialSecurity: false, salesTaxRate: 5.44, propertyTaxRate: 0.56, costOfLivingIndex: 92 },
  DC: { name: "District of Columbia", effectiveRetirementTaxRate: 0.05, taxesSocialSecurity: false, salesTaxRate: 6.00, propertyTaxRate: 0.56, costOfLivingIndex: 155 },
};
