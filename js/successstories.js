/**
 * Real, publicly self-documented early-retirement stories, structured with
 * the same fields Ember's own calculator collects — so a user can directly
 * compare their numbers, or load a story's starting point into the
 * calculator with one click. Every figure here is drawn from the person's
 * own blog and cross-checked against independent press coverage (Forbes,
 * CNBC, Fortune) — not estimated or invented. These are three real public
 * figures who chose to publish these exact numbers themselves as case
 * studies for the FIRE community; nothing here goes beyond what they've
 * already made public.
 *
 * This is a deliberately small, honest sample, not a rigorous study —
 * survivorship bias is real (people whose early retirement went badly
 * rarely blog about it for 20 years), and all three catch the same decade
 * of historically strong US stock returns. Financial Samurai is included
 * specifically because his story is more mixed than the other two — a
 * useful counterweight to a purely rosy picture.
 */

const SUCCESS_STORIES = [
  {
    id: "mmm",
    name: "Mr. Money Mustache (Peter Adeney)",
    blogUrl: "https://www.mrmoneymustache.com/",
    retirementYear: 2005,
    retirementAge: 30,
    stateCode: "CO",
    filingStatus: "married",
    familyAtRetirement: "Married, no kids yet (first child born the following year)",
    portfolioAtRetirement: 600000,
    annualSpendingAtRetirement: 25000,
    doubt:
      "Would a roughly 4% withdrawal rate really survive a full career's worth of unknowns on just $600,000 — including, as it turned out, the 2008 financial crisis three years into retirement?",
    whatHappened:
      "The portfolio not only survived 2008 and a growing family, it kept growing. Household spending is still under $40,000/yr almost two decades later. Blog income and other side projects came later and were never needed to cover normal living costs — by his own account, the original stash and a paid-off house were enough on their own.",
    outcomeNote: "Spending still under $40k/yr as of 2024 — comfortably within a 4% rule on the original $600k stash.",
    sources: [
      { label: "Forbes, 2013", url: "https://www.forbes.com/sites/laurashin/2013/10/03/how-mr-money-mustache-retired-at-age-30-and-how-you-can-too/" },
      { label: "mrmoneymustache.com", url: "https://www.mrmoneymustache.com/2012/01/13/the-shockingly-simple-math-behind-early-retirement/" },
    ],
  },
  {
    id: "rootofgood",
    name: "Root of Good (Justin McCurry)",
    blogUrl: "https://rootofgood.com/",
    retirementYear: 2013,
    retirementAge: 33,
    stateCode: "NC",
    filingStatus: "married",
    familyAtRetirement: "Married, 3 kids",
    portfolioAtRetirement: 1300000,
    annualSpendingAtRetirement: 40000,
    doubt:
      "Worried about sequence-of-returns risk, a market downturn early in retirement, and whether a roughly 3% withdrawal rate would really hold up for three kids across their entire childhoods.",
    whatHappened:
      "Net worth grew from $1.3 million at retirement to nearly $4 million by late 2025, despite 12+ years of ongoing withdrawals. Some of that came from his wife's part-time work for a few years and blog income, but by his own accounting the core portfolio would likely have been fine on investment growth alone — spending stayed close to the original $40,000/yr budget the whole way.",
    outcomeNote: "$1.3M (2013) → ~$3.96M (Nov 2025), spending ~$40k/yr the entire time.",
    sources: [
      { label: "rootofgood.com, About", url: "https://rootofgood.com/about/" },
      { label: "rootofgood.com, \"Didn't Go As Planned\"", url: "https://rootofgood.com/early-retirement-plans/" },
      { label: "CNBC, 2018", url: "https://www.cnbc.com/2018/11/09/couple-who-retired-early-with-over-1-million-living-their-best-lives.html" },
    ],
  },
  {
    id: "financialsamurai",
    name: "Financial Samurai (Sam Dogen)",
    blogUrl: "https://www.financialsamurai.com/",
    retirementYear: 2012,
    retirementAge: 34,
    stateCode: "CA",
    filingStatus: "married",
    familyAtRetirement: "Married, no kids yet — 2 kids born later (2017 & 2019)",
    portfolioAtRetirement: 3000000,
    annualSpendingAtRetirement: 80000,
    doubt:
      "Planned a modest, low-key retirement (at one point envisioning a fruit farm in Hawaii) on about $80,000/yr — the math worked, but the plan didn't anticipate having kids or where they'd end up raising them.",
    whatHappened:
      "The portfolio itself never ran out — passive income grew from $80,000/yr to roughly $200,000/yr. What changed was the plan: two unplanned kids, raised in San Francisco instead of Hawaii, pushed spending toward $230,000/yr for a family of four, and ~$1.5 million in future college costs became a real line item. In 2023, over a decade in, he said he'd likely go back to work — less because the money ran out, and more because the goalposts moved and he missed workplace structure.",
    outcomeNote: "Passive income $80k/yr → ~$200k/yr, but family spending grew to ~$230k/yr after two unplanned kids and a home in an expensive city — a lifestyle-change risk, not a portfolio-failure risk.",
    sources: [
      { label: "Fortune, 2023", url: "https://fortune.com/2023/04/09/early-retiree-fire-movement-returns-to-work-financial-samurai/" },
      { label: "Yahoo Finance, on $230k/yr spending", url: "https://finance.yahoo.com/news/financial-blogger-says-230-000-193011494.html" },
    ],
  },
];

function storyYearsRetired(story) {
  return new Date().getFullYear() - story.retirementYear;
}

function storyImpliedSWR(story) {
  return (story.annualSpendingAtRetirement / story.portfolioAtRetirement) * 100;
}

/** Maps a story onto the exact plan-data shape applyPlan() expects, so a story can be loaded straight into the calculator. */
function storyToPlanData(story) {
  const rawSWR = storyImpliedSWR(story);
  const clampedSWR = Math.min(6, Math.max(2.5, Math.round(rawSWR / 0.25) * 0.25));
  return {
    "current-age": story.retirementAge,
    "retirement-age": story.retirementAge,
    "current-portfolio": currency(story.portfolioAtRetirement),
    "annual-contribution": "$0",
    "pre-return": 7,
    "post-return": 5,
    "inflation": 3,
    "annual-expenses": currency(story.annualSpendingAtRetirement),
    "swr": clampedSWR,
    "filing-status": story.filingStatus,
    "state": story.stateCode,
  };
}
