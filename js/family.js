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

  const extraExpensesByAge = {};
  const milestones = [];

  childrenAges.forEach((childAge, index) => {
    const yearsUntilCollege = COLLEGE_START_AGE - childAge;
    const parentAgeAtCollegeStart = currentAge + yearsUntilCollege;
    const label = childrenAges.length > 1 ? `Child ${index + 1} starts college` : "Child starts college";

    if (yearsUntilCollege >= 0) {
      milestones.push({ age: parentAgeAtCollegeStart, label });
      if (includeCollegeCosts) {
        for (let y = 0; y < COLLEGE_DURATION_YEARS; y++) {
          const age = parentAgeAtCollegeStart + y;
          extraExpensesByAge[age] = (extraExpensesByAge[age] || 0) + costPerYear;
        }
      }
    } else {
      milestones.push({ age: currentAge, label: `${label} (already in college)` });
    }
  });

  milestones.sort((a, b) => a.age - b.age);
  return { extraExpensesByAge, milestones, costPerYear };
}

/** A short, situational note — no assumptions based on gender, just timing. */
function buildFamilySuggestion(input) {
  const { currentAge, childrenAges } = input;
  if (childrenAges.length === 0) {
    return "No children entered — add ages above if you want college costs and milestones reflected in your plan.";
  }
  const nextToStart = Math.min(...childrenAges.map((age) => COLLEGE_START_AGE - age));
  if (nextToStart < 0) {
    return "At least one child is already college-aged — factor in any ongoing tuition support directly in your annual spending above.";
  }
  if (nextToStart === 0) {
    return "A child starts college this year — this is a good time to line up 529 withdrawals or other funding sources.";
  }
  return `You have about ${nextToStart} year${nextToStart === 1 ? "" : "s"} until your next child starts college — a 529 plan or dedicated education fund can reduce the hit to your retirement portfolio shown below.`;
}
