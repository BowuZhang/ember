/**
 * Optional family/kids planning helpers. Everything here is opt-in: with
 * no children entered, callers get empty milestones and no expense impact.
 */

const DEFAULT_COLLEGE_COST_PER_YEAR = 25000;
const COLLEGE_DURATION_YEARS = 4;
const COLLEGE_START_AGE = 18;

/** Parses a comma-separated list of ages (e.g. "4, 9, 14") into integers. */
function parseChildrenAges(text) {
  if (!text) return [];
  return text
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 25);
}

/**
 * Builds the { parentAge: extraExpense } map for college years, and a
 * parallel list of milestones, given the parent's current age and each
 * child's current age.
 */
function buildFamilyPlan(input) {
  const { currentAge, childrenAges, includeCollegeCosts, collegeCostPerYear } = input;
  const costPerYear = collegeCostPerYear > 0 ? collegeCostPerYear : DEFAULT_COLLEGE_COST_PER_YEAR;
  const costPerChild = costPerYear * COLLEGE_DURATION_YEARS;

  const extraExpensesByAge = {};
  const milestones = [];

  childrenAges.forEach((childAge, index) => {
    const yearsUntilCollege = COLLEGE_START_AGE - childAge;
    const parentAgeAtCollegeStart = currentAge + yearsUntilCollege;
    const label = childrenAges.length > 1 ? `Child ${index + 1} starts college` : "Child starts college";

    if (yearsUntilCollege >= 0) {
      milestones.push({ age: parentAgeAtCollegeStart, label, costImpact: includeCollegeCosts ? costPerChild : 0 });
      if (includeCollegeCosts) {
        for (let y = 0; y < COLLEGE_DURATION_YEARS; y++) {
          const age = parentAgeAtCollegeStart + y;
          extraExpensesByAge[age] = (extraExpensesByAge[age] || 0) + costPerYear;
        }
      }
    } else {
      milestones.push({ age: currentAge, label: `${label} (already in college)`, costImpact: 0 });
    }
  });

  milestones.sort((a, b) => a.age - b.age);
  const totalCollegeCost = Object.values(extraExpensesByAge).reduce((sum, v) => sum + v, 0);
  const upcomingChildCount = childrenAges.filter((age) => COLLEGE_START_AGE - age >= 0).length;
  return { extraExpensesByAge, milestones, costPerYear, costPerChild, totalCollegeCost, upcomingChildCount };
}

/**
 * A short, situational note that spells out exactly what's added and where
 * it shows up — no assumptions based on gender, just timing and dollars.
 */
function buildFamilySuggestion(input, familyPlan) {
  const { childrenAges, includeCollegeCosts } = input;
  if (childrenAges.length === 0) {
    return "No children entered — add ages above if you want college costs and milestones reflected in your plan.";
  }
  const nextToStart = Math.min(...childrenAges.map((age) => COLLEGE_START_AGE - age));
  if (nextToStart < 0 && familyPlan.upcomingChildCount === 0) {
    return "At least one child is already college-aged — factor in any ongoing tuition support directly in your annual spending above.";
  }

  const whenText = nextToStart <= 0 ? "starting this year" : `starting in about ${nextToStart} year${nextToStart === 1 ? "" : "s"}`;

  if (!includeCollegeCosts) {
    const wouldAddTotal = familyPlan.costPerChild * familyPlan.upcomingChildCount;
    return `Milestones below will show when each child starts college (${whenText}), but the cost isn't added to your plan yet. Check "Include estimated college costs" to add an estimated ${currency(wouldAddTotal)} total (${currency(familyPlan.costPerYear)}/yr for ${COLLEGE_DURATION_YEARS} years per child) directly to your projected balance in those years — shown as dips in the chart below. It won't change your FIRE number, which is based on your ongoing living expenses, not one-time costs.`;
  }

  return `We're adding ${currency(familyPlan.totalCollegeCost)} total to your plan — ${currency(familyPlan.costPerYear)}/yr for ${COLLEGE_DURATION_YEARS} years per child, ${whenText}. You'll see it as dips in your projected balance chart and noted on each milestone below; it doesn't change your FIRE number or annual withdrawal target, which are based on ongoing living expenses.`;
}
