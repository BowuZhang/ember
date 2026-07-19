const form = document.getElementById("planner-form");
const stateSelect = document.getElementById("state");
const compareStateSelect = document.getElementById("compare-state");
const fireTypeBadge = document.getElementById("fire-type-badge");
const fireTypeDescription = document.getElementById("fire-type-description");

let selectedFireTypeKey = null; // null = follow the computed recommendation
let hasCalculated = false;

/** Fires a GoatCounter custom event; no-ops silently if analytics is blocked or unavailable. */
function trackGoatCounterEvent(path) {
  try {
    if (window.goatcounter && typeof window.goatcounter.count === "function") {
      window.goatcounter.count({ path, title: path, event: true });
    }
  } catch (e) {
    // analytics is best-effort — never let it break the app
  }
}

function populateStateDropdowns() {
  const options = Object.entries(STATE_DATA)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([code, info]) => `<option value="${code}">${info.name}</option>`)
    .join("");
  stateSelect.innerHTML = options;
  compareStateSelect.innerHTML = `<option value="">No comparison</option>` + options;
  stateSelect.value = "CA";
}

function currency(value) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function percent(value) {
  return (value * 100).toFixed(1) + "%";
}

/** Parses a possibly "$1,234"-formatted text input back into a number. */
function parseCurrency(value) {
  return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
}

function readInputs() {
  return {
    currentAge: Number(document.getElementById("current-age").value),
    retirementAge: Number(document.getElementById("retirement-age").value),
    currentPortfolio: parseCurrency(document.getElementById("current-portfolio").value),
    annualContribution: parseCurrency(document.getElementById("annual-contribution").value),
    preRetirementReturnPct: Number(document.getElementById("pre-return").value),
    postRetirementReturnPct: Number(document.getElementById("post-return").value),
    inflationPct: Number(document.getElementById("inflation").value),
    annualExpensesToday: parseCurrency(document.getElementById("annual-expenses").value),
    swrPct: Number(document.getElementById("swr").value),
    filingStatus: document.getElementById("filing-status").value,
    stateCode: stateSelect.value,
  };
}

function readFamilyInputs(currentAge) {
  return {
    currentAge,
    childrenAges: parseChildrenAges(document.getElementById("children-ages").value),
    includeCollegeCosts: document.getElementById("include-college-costs").checked,
    collegeCostPerYear: parseCurrency(document.getElementById("college-cost-per-year").value),
  };
}

function readSocialSecurityInputs() {
  return {
    annualIncomeEstimate: parseCurrency(document.getElementById("ss-income").value),
    claimAge: Number(document.getElementById("ss-claim-age").value),
  };
}

function readMortgageInputs(currentAge) {
  return {
    currentAge,
    includeMortgage: document.getElementById("include-mortgage").checked,
    monthlyPayment: parseCurrency(document.getElementById("mortgage-payment").value),
    yearsRemaining: Number(document.getElementById("mortgage-years").value),
  };
}

function readHealthcareInputs(retirementAge, stateCode) {
  return {
    retirementAge,
    stateCode,
    includeHealthcareBridge: document.getElementById("include-healthcare-bridge").checked,
    monthlyPremiumAt40: parseCurrency(document.getElementById("healthcare-premium").value),
  };
}

/** Merges any number of {age: amount} maps by summing overlapping ages. */
function mergeAmountMaps(...maps) {
  const merged = {};
  maps.forEach((map) => {
    Object.entries(map).forEach(([age, amount]) => {
      merged[age] = (merged[age] || 0) + amount;
    });
  });
  return merged;
}

/** Wires a text input to live-format as "$1,234,567" while preserving cursor position. */
function formatCurrencyField(input) {
  const reformat = () => {
    const start = input.selectionStart ?? input.value.length;
    const digitsAfterCursor = input.value.slice(start).replace(/[^0-9]/g, "").length;
    const raw = input.value.replace(/[^0-9]/g, "");
    const formatted = raw === "" ? "" : "$" + Number(raw).toLocaleString("en-US");
    input.value = formatted;
    let pos = formatted.length;
    let seen = 0;
    while (pos > 0 && seen < digitsAfterCursor) {
      pos--;
      if (/[0-9]/.test(formatted[pos])) seen++;
    }
    input.setSelectionRange(pos, pos);
  };
  input.addEventListener("input", reformat);
  reformat();
}

function readAccountSplit() {
  return {
    traditionalPct: Number(document.getElementById("split-traditional").value) / 100,
    rothPct: Number(document.getElementById("split-roth").value) / 100,
    taxablePct: Number(document.getElementById("split-taxable").value) / 100,
  };
}

function readTaxableGainsFraction() {
  return Number(document.getElementById("taxable-gains-fraction").value) / 100;
}

function buildStateCard(stateCode, input, result) {
  const info = STATE_DATA[stateCode];
  const rate = combinedEffectiveRate(result.grossAnnualWithdrawal, input.filingStatus, info);
  return `
    <div class="state-card">
      <h4>${info.name}</h4>
      <ul>
        <li><span>State tax on retirement withdrawals</span><strong>${percent(info.effectiveRetirementTaxRate)}</strong></li>
        <li><span>Taxes Social Security</span><strong>${info.taxesSocialSecurity ? "Yes" : "No"}</strong></li>
        <li><span>Avg. combined sales tax</span><strong>${info.salesTaxRate.toFixed(2)}%</strong></li>
        <li><span>Avg. effective property tax</span><strong>${info.propertyTaxRate.toFixed(2)}%</strong></li>
        <li><span>Cost of living index</span><strong>${info.costOfLivingIndex} <small>(100 = US avg)</small></strong></li>
        <li><span>Est. combined tax rate on withdrawals</span><strong>${percent(rate)}</strong></li>
        <li><span>Gross withdrawal needed for ${currency(input.annualExpensesToday)}/yr spending</span><strong>${currency(grossUpForTaxes(input.annualExpensesToday, input.filingStatus, info))}</strong></li>
      </ul>
    </div>
  `;
}

/**
 * Ranks every state by lowest gross withdrawal needed to fund the user's
 * desired spending — i.e. tax efficiency. Several states genuinely tie at
 * $0 effective retirement tax (their real policy, not a bug), so ties are
 * broken by cost of living rather than left to arbitrary insertion order —
 * that keeps the display order meaningful without changing what "best"
 * means for the primary ranking.
 */
function rankStatesForPlan(input) {
  return Object.entries(STATE_DATA)
    .map(([code, info]) => {
      const grossWithdrawal = grossUpForTaxes(input.annualExpensesToday, input.filingStatus, info);
      const rate = combinedEffectiveRate(grossWithdrawal, input.filingStatus, info);
      return { code, name: info.name, grossWithdrawal, rate, colIndex: info.costOfLivingIndex };
    })
    .sort((a, b) => a.grossWithdrawal - b.grossWithdrawal || a.colIndex - b.colIndex);
}

function renderBestStatesTable(input) {
  const ranked = rankStatesForPlan(input);
  const currentIndex = ranked.findIndex((s) => s.code === input.stateCode);
  const currentEntry = ranked[currentIndex];
  const currentRank = currentIndex + 1;

  const introEl = document.getElementById("best-states-intro");
  const potentialSavings = currentEntry.grossWithdrawal - ranked[0].grossWithdrawal;
  const introBase = `Ranked by lowest gross withdrawal needed to fund your ${currency(input.annualExpensesToday)}/yr spending — a rough proxy for tax efficiency.`;
  if (potentialSavings < 1) {
    introEl.textContent = `${introBase} Your state, ${currentEntry.name}, already ties for the most tax-efficient tier — there's no purely tax-driven reason to move on this measure alone.`;
  } else if (currentRank > 5) {
    introEl.textContent = `${introBase} Your state, ${currentEntry.name}, ranks #${currentRank} of ${ranked.length}; the #1 state would need roughly ${currency(potentialSavings)}/yr less from your portfolio at the same spending level.`;
  } else {
    introEl.textContent = `${introBase} Your state, ${currentEntry.name}, is already in the top 5.`;
  }

  const displayed = currentRank > 5 ? [...ranked.slice(0, 5), currentEntry] : ranked.slice(0, 5);
  document.getElementById("best-states-body").innerHTML = displayed
    .map((s) => {
      const rank = ranked.indexOf(s) + 1;
      const isCurrent = s.code === input.stateCode;
      const savings = currentEntry.grossWithdrawal - s.grossWithdrawal;
      const savingsText = isCurrent || Math.abs(savings) < 1 ? "—" : savings > 0 ? `${currency(savings)}/yr less needed` : `${currency(-savings)}/yr more needed`;
      return `
        <tr class="${isCurrent ? "best-states-current" : ""}">
          <td>${rank}</td>
          <td>${s.name}${isCurrent ? " (yours)" : ""}</td>
          <td>${percent(s.rate)}</td>
          <td>${currency(s.grossWithdrawal)}</td>
          <td>${s.colIndex}</td>
          <td>${savingsText}</td>
        </tr>
      `;
    })
    .join("");
}

function renderFireTypeTabs(computedKey) {
  const activeKey = selectedFireTypeKey || computedKey;
  const tabsEl = document.getElementById("fire-type-tabs");
  tabsEl.innerHTML = FIRE_TYPES.map(
    (t) => `
      <button type="button" class="fire-tab ${t.key === activeKey ? "active" : ""}" data-fire-key="${t.key}">
        ${t.label}${computedKey && t.key === computedKey ? '<span class="fire-tab-recommended">Recommended</span>' : ""}
      </button>
    `
  ).join("");
  const active = FIRE_TYPES.find((t) => t.key === activeKey) || FIRE_TYPES[FIRE_TYPES.length - 1];
  document.getElementById("fire-type-panel-description").textContent = active.description;

  tabsEl.querySelectorAll(".fire-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFireTypeKey = btn.getAttribute("data-fire-key");
      renderFireTypeTabs(computedKey);
    });
  });
}

function renderYearByYearTable(result) {
  const rows = result.rows
    .map(
      (r) => `
      <tr>
        <td>${r.age}</td>
        <td>${currency(r.withdrawals.traditional)}</td>
        <td>${currency(r.withdrawals.roth)}</td>
        <td>${currency(r.withdrawals.taxable)}</td>
        <td>${currency(r.federalTax)}</td>
        <td>${currency(r.stateTax)}</td>
        <td>${currency(r.netAchieved)}</td>
        <td>${currency(r.totalBalance)}</td>
      </tr>
    `
    )
    .join("");
  document.getElementById("year-by-year-body").innerHTML = rows;
}

function renderStrategyComparisonTable(allResults) {
  document.getElementById("strategy-comparison-body").innerHTML = allResults
    .map(
      (s) => `
      <tr>
        <td>${s.label}</td>
        <td>${currency(s.lifetimeTotalTax)}</td>
        <td>${s.sustainable ? "Lasts to 100" : "Runs out at age " + s.depletedAge}</td>
        <td>${currency(s.finalBalance)}</td>
      </tr>
    `
    )
    .join("");
}

let lastInput = null;
let lastAdjustments = null;
let lastResult = null;
let lastSSPlan = null;

function render(input) {
  const familyInput = readFamilyInputs(input.currentAge);
  const familyPlan = buildFamilyPlan(familyInput);

  const mortgageInput = readMortgageInputs(input.currentAge);
  const mortgagePlan = buildMortgagePlan(mortgageInput);

  const healthcareInput = readHealthcareInputs(input.retirementAge, input.stateCode);
  const healthcarePlan = buildHealthcarePlan(healthcareInput);

  const ssInput = readSocialSecurityInputs();
  const ssPlan = buildSocialSecurityPlan(ssInput);

  const adjustments = {
    extraExpensesByAge: mergeAmountMaps(
      familyPlan.extraExpensesByAge,
      mortgagePlan.extraExpensesByAge,
      healthcarePlan.extraExpensesByAge
    ),
    externalIncomeByAge: ssPlan.externalIncomeByAge,
  };
  lastInput = input;
  lastAdjustments = adjustments;

  const result = runProjection(input, adjustments);
  lastResult = result;
  lastSSPlan = ssPlan;

  // --- ACA subsidy estimate for the healthcare bridge ---
  const acaNoteEl = document.getElementById("aca-subsidy-note");
  acaNoteEl.innerHTML = `<span class="strategy-tag">Healthcare bridge</span><h4>Would you qualify for ACA subsidies?</h4><p>${buildACASubsidyNote(input, result.grossAnnualWithdrawal)}</p>`;
  acaNoteEl.hidden = false;

  const fireType = classifyFireType(input, result);
  const computedFireKey = FIRE_TYPE_KEY_BY_LABEL[fireType.label] || "traditional";

  // --- Social Security card ---
  const ssBenefitEl = document.getElementById("ss-benefit");
  const ssBenefitNoteEl = document.getElementById("ss-benefit-note");
  if (ssPlan.annualBenefit > 0) {
    ssBenefitEl.textContent = currency(ssPlan.annualBenefit) + " / yr";
    ssBenefitNoteEl.textContent = `Starting at age ${ssInput.claimAge}, reduces portfolio withdrawals`;
  } else {
    ssBenefitEl.textContent = "—";
    ssBenefitNoteEl.textContent = "Add your income above to estimate";
  }

  // --- Your Plan ---
  document.getElementById("fire-number").textContent = currency(result.fireNumber);
  const fireAgeEl = document.getElementById("fire-age");
  const fireAgeReached = result.fireAge !== null;
  fireAgeEl.textContent = fireAgeReached ? `Age ${result.fireAge}` : "Not reached by target age";
  fireAgeEl.classList.toggle("card-value-small", !fireAgeReached);

  document.getElementById("balance-at-retirement").textContent = currency(result.balanceAtRetirement);
  document.getElementById("gross-withdrawal").textContent = currency(result.grossAnnualWithdrawal) + " / yr";
  document.getElementById("coast-fire-number").textContent = currency(result.coastFireNumber);

  const sustainabilityEl = document.getElementById("sustainability");
  if (result.sustainable) {
    sustainabilityEl.textContent = `Your portfolio is projected to last through age ${MAX_PLANNING_AGE}.`;
    sustainabilityEl.className = "status-ok";
  } else {
    sustainabilityEl.textContent = `Your portfolio is projected to run out around age ${result.depletedAge}. Consider a lower withdrawal rate, working longer, or reducing expenses.`;
    sustainabilityEl.className = "status-warn";
  }

  fireTypeBadge.textContent = fireType.label;
  fireTypeDescription.textContent = fireType.description;

  const RMD_START_AGE = 73;
  const projectionMarkers = [];
  if (ssPlan.annualBenefit > 0) {
    projectionMarkers.push({
      age: ssInput.claimAge,
      label: "Social Security",
      lineClass: "chart-ss-line",
      labelClass: "chart-ss-label",
    });
  }
  projectionMarkers.push({
    age: RMD_START_AGE,
    label: "RMDs begin",
    lineClass: "chart-rmd-line",
    labelClass: "chart-rmd-label",
  });
  renderProjectionChart(document.getElementById("chart-container"), result.points, result.fireNumber, input.retirementAge, projectionMarkers);
  renderContributionGrowthChart(
    document.getElementById("contribution-chart-container"),
    result.points,
    input.currentAge,
    input.currentPortfolio,
    input.annualContribution
  );

  // --- Timeline ---
  const allMilestones = [...familyPlan.milestones, ...mortgagePlan.milestones, ...ssPlan.milestones];
  const milestones = buildTimelineMilestones(input, result, allMilestones);
  renderTimeline(document.getElementById("timeline-container"), milestones, input.currentAge);

  // --- State comparison ---
  let stateHtml = buildStateCard(input.stateCode, input, result);
  if (compareStateSelect.value) stateHtml += buildStateCard(compareStateSelect.value, input, result);
  document.getElementById("state-comparison").innerHTML = stateHtml;
  renderBestStatesTable(input);

  // --- Tax deep-dive ---
  const stateInfo = STATE_DATA[input.stateCode];
  const breakdown = taxBreakdown(result.grossAnnualWithdrawal, input.filingStatus, stateInfo);
  renderTaxBreakdownBar(document.getElementById("tax-breakdown-container"), breakdown);

  const split = readAccountSplit();
  const gainsFraction = readTaxableGainsFraction();
  const strategyInput = { ...input, taxableGainsFraction: gainsFraction };
  const strategyKey = document.getElementById("withdrawal-strategy").value;
  const selectedResult = simulateWithdrawalStrategy(strategyInput, split, strategyKey, adjustments);
  renderYearByYearTable(selectedResult);

  const allStrategyResults = compareWithdrawalStrategies(strategyInput, split, adjustments);
  renderStrategyComparisonTable(allStrategyResults);
  renderStrategyComparisonChart(document.getElementById("strategy-chart-container"), allStrategyResults, input.retirementAge);

  // --- FIRE Plan ---
  renderFireTypeTabs(computedFireKey);

  // --- Family ---
  document.getElementById("family-suggestion").textContent = buildFamilySuggestion(familyInput, familyPlan);
  const familyMilestonesEl = document.getElementById("family-milestones");
  familyMilestonesEl.innerHTML =
    familyPlan.milestones.length === 0
      ? ""
      : familyPlan.milestones
          .map(
            (m) =>
              `<li>${m.label} — you'll be about age ${m.age}${m.costImpact > 0 ? ` <span class="milestone-cost">(adds ${currency(m.costImpact)} to your plan)</span>` : ""}</li>`
          )
          .join("");

  // --- Life after retirement ---
  document.getElementById("life-after-intro").textContent = buildLifeAfterIntro(input, familyInput.childrenAges);

  // --- Cross-page personalization (Statistics + Tax Strategies) ---
  renderStatsChart();
  renderTaxPersonalization();

  // --- Refresh any already-rendered budget-fit gauges on Retirement Life ---
  if (!document.getElementById("quiz-result-container").hidden) {
    const maxScore = Math.max(...Object.values(quizScores));
    const winners = QUIZ_TYPE_ORDER.filter((t) => quizScores[t] === maxScore);
    winners.forEach((key) => {
      const el = document.getElementById(`budget-fit-${key}`);
      if (el) renderBudgetFitGauge(el, findPersonality(key).budgetRange, input.annualExpensesToday);
    });
  }
  const activeBudgetFitEl = document.getElementById("personality-budget-fit");
  if (activeBudgetFitEl) {
    renderBudgetFitGauge(activeBudgetFitEl, findPersonality(activePersonalityKey).budgetRange, input.annualExpensesToday);
  }

  renderHomeSummary();

  saveLastPlan();
}

/** Renders the net-worth-by-age bar chart, adding a "you are here" marker once calculator data exists. */
function renderStatsChart() {
  let userMarker = null;
  const calloutEl = document.getElementById("stats-personal-callout");
  if (lastInput) {
    const bracketLabel = ageToBracketLabel(lastInput.currentAge);
    userMarker = {
      categoryLabel: bracketLabel,
      value: lastInput.currentPortfolio,
      label: "You: " + formatCurrencyShort(lastInput.currentPortfolio),
      legendLabel: `You (age ${lastInput.currentAge})`,
    };
    calloutEl.textContent = `Based on your calculator inputs: your current portfolio of ${currency(lastInput.currentPortfolio)} ${describeNetWorthRank(lastInput.currentPortfolio)}, compared to the ${bracketLabel} age bracket shown below.`;
    calloutEl.hidden = false;
  } else {
    calloutEl.hidden = true;
  }
  renderGroupedBarChart(
    document.getElementById("stats-chart-container"),
    RETIREMENT_STATS_BY_AGE,
    { key: "netWorth", label: "Median net worth (all households)", color: "#1f7a5c" },
    { key: "retirementBalance", label: "Median retirement balance (households with one)", color: "#8a5cb0" },
    userMarker
  );
}

/** Fills in the Roth-conversion and state-tax strategy panel on the Tax Savings Strategies page. */
function renderTaxPersonalization() {
  const cta = document.getElementById("personalized-tax-cta");
  const content = document.getElementById("personalized-tax-content");
  if (!cta || !content) return;
  if (lastInput && lastResult) {
    document.getElementById("roth-conversion-strategy").innerHTML = buildRothConversionStrategy(lastInput);
    document.getElementById("state-tax-strategy").innerHTML = buildStateTaxStrategy(lastInput);
    document.getElementById("high-income-impact").innerHTML = buildHighIncomeImpact(
      lastInput,
      lastResult.grossAnnualWithdrawal,
      lastSSPlan ? lastSSPlan.annualBenefit : 0
    );
    cta.hidden = true;
    content.hidden = false;
  } else {
    cta.hidden = false;
    content.hidden = true;
  }
}

function renderStaticContent() {
  document.getElementById("life-after-categories").innerHTML = LIFE_AFTER_CATEGORIES.map((cat) => {
    const resources = LIFE_AFTER_RESOURCES[cat.title] || [];
    const resourcesHtml =
      resources.length === 0
        ? ""
        : `
          <p class="resource-heading">Go deeper</p>
          <ul class="resource-list">
            ${resources.map((r) => `<li><a href="${r.url}" target="_blank" rel="noopener">${r.name} ↗</a></li>`).join("")}
          </ul>
        `;
    return `
      <div class="info-card">
        <h4>${cat.title}</h4>
        <ul>${cat.items.map((item) => `<li>${item}</li>`).join("")}</ul>
        ${resourcesHtml}
      </div>
    `;
  }).join("");

  document.getElementById("tax-strategies-grid").innerHTML = TAX_STRATEGIES.map(
    (s) => `<div class="info-card"><h4>${s.title}</h4><p>${s.body}</p></div>`
  ).join("");

  document.getElementById("affiliate-partners-grid").innerHTML = AFFILIATE_PARTNERS.map(
    (p) => `
      <div class="info-card">
        <h4>${p.name} <span class="panel-tag">${p.category}</span></h4>
        <p>${p.description}</p>
        <a href="${p.url}" target="_blank" rel="noopener sponsored" class="link-btn" data-goatcounter-click="affiliate-${p.name.toLowerCase().replace(/\s+/g, "-")}">Visit ${p.name} →</a>
      </div>
    `
  ).join("");

  renderStatsChart();
  document.getElementById("stats-table-body").innerHTML = RETIREMENT_STATS_BY_AGE.map(
    (row) => `<tr><td>${row.label}</td><td>${currency(row.netWorth)}</td><td>${currency(row.retirementBalance)}</td></tr>`
  ).join("");

  document.getElementById("percentile-table-body").innerHTML = NET_WORTH_PERCENTILES.map(
    (row) => `<tr><td>${row.label}</td><td>${currency(row.netWorth)}</td></tr>`
  ).join("");

  document.getElementById("portfolio-tier-body").innerHTML = PORTFOLIO_TIERS.map(
    (row) => `<tr><td>${currency(row.portfolio)}</td><td>${currency(row.annualIncome)}/yr</td><td>${row.context}</td></tr>`
  ).join("");

  // Initial FIRE tab render with no computed recommendation yet.
  renderFireTypeTabs(null);
}

// --- Deferred calculation: no results until the core inputs are complete ---

function setGatedMessage(text) {
  document.querySelectorAll(".gated-message").forEach((el) => (el.textContent = text));
}

function revealResults() {
  document.querySelectorAll(".gated-empty").forEach((el) => (el.hidden = true));
  document.querySelectorAll(".gated-content").forEach((el) => (el.hidden = false));
}

function attemptRender(forceSpinner) {
  if (!form.checkValidity()) return; // stay in the empty state, or keep the last good render
  const shouldSpin = forceSpinner || !hasCalculated;
  if (shouldSpin) {
    document.querySelectorAll(".gated-spinner").forEach((el) => (el.hidden = false));
    setGatedMessage("Calculating your plan…");
    setTimeout(() => {
      render(readInputs());
      hasCalculated = true;
      revealResults();
    }, 350);
  } else {
    render(readInputs());
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  selectedFireTypeKey = null;
  attemptRender(true);
});

document.addEventListener("input", (e) => {
  if (e.target.classList && e.target.classList.contains("plan-input")) {
    attemptRender(false);
  }
});

// --- Slider live-value readouts ---

document.querySelectorAll('input[type="range"]').forEach((slider) => {
  const output = document.querySelector(`output[for="${slider.id}"]`);
  if (!output) return;
  const format = slider.dataset.format || "plain";
  const updateOutput = () => {
    const v = slider.value;
    if (format === "percent") output.textContent = `${v}%`;
    else if (format === "age") output.textContent = `Age ${v}`;
    else output.textContent = v;
  };
  updateOutput();
  slider.addEventListener("input", updateOutput);
});

// --- Recommended-value marks on sliders (e.g. the classic 4% SWR) ---

document.querySelectorAll("input[type=\"range\"][data-recommended]").forEach((slider) => {
  const mark = slider.parentElement.querySelector(".slider-mark");
  if (!mark) return;
  const min = Number(slider.min);
  const max = Number(slider.max);
  const recommended = Number(slider.dataset.recommended);
  const fraction = (recommended - min) / (max - min);
  mark.style.setProperty("--mark-pos", fraction);
  const format = slider.dataset.format || "plain";
  const label = format === "percent" ? `${recommended}%` : format === "age" ? `age ${recommended}` : recommended;
  mark.title = `Typical starting point: ${label}`;
});

// --- Location detection (automatic, browser permission prompt gates it) ---

const detectStatus = document.getElementById("detect-state-status");

/** Auto-detects the user's state on first visit only — never overrides a shared-link or restored plan. */
function maybeAutoDetectState() {
  const hasQueryPlan = location.hash.includes("?");
  const hasSavedPlan = !!loadLastPlan();
  if (hasQueryPlan || hasSavedPlan) return;

  detectMyState((error, stateCode) => {
    if (error) return; // permission denied or lookup failed — keep the default state, no error noise
    stateSelect.value = stateCode;
    detectStatus.textContent = `Detected: ${STATE_DATA[stateCode].name}`;
    detectStatus.className = "detect-status detect-status-ok";
    attemptRender(false);
  });
}

document.getElementById("see-fire-plan-link").addEventListener("click", () => {
  showView("calculator");
  openPanel("panel-fire-plan");
  document.getElementById("panel-fire-plan").scrollIntoView({ behavior: "smooth", block: "start" });
});

function openPanel(panelId) {
  const toggle = document.querySelector(`.panel-toggle[aria-controls="${panelId}-body"]`);
  const body = document.getElementById(`${panelId}-body`);
  if (toggle && body && toggle.getAttribute("aria-expanded") !== "true") {
    toggle.setAttribute("aria-expanded", "true");
    body.hidden = false;
    savePanelState();
  }
}

document.querySelectorAll(".panel-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const body = document.getElementById(btn.getAttribute("aria-controls"));
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
    savePanelState();
  });
});

// --- Panel density: remember a returning visitor's expand/collapse choices ---

const PANEL_STATE_STORAGE_KEY = "ember-panel-state";
const HINT_DISMISSED_STORAGE_KEY = "ember-hint-dismissed";

function savePanelState() {
  try {
    const state = {};
    document.querySelectorAll("#view-calculator .panel-toggle").forEach((btn) => {
      state[btn.getAttribute("aria-controls")] = btn.getAttribute("aria-expanded") === "true";
    });
    localStorage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage unavailable — fail silently
  }
}

function restorePanelState() {
  const returningVisitor = !!loadLastPlan();
  if (!returningVisitor) {
    const hintEl = document.getElementById("first-time-hint");
    let dismissed = false;
    try {
      dismissed = !!localStorage.getItem(HINT_DISMISSED_STORAGE_KEY);
    } catch (e) {
      dismissed = false;
    }
    if (hintEl && !dismissed) hintEl.hidden = false;
    return;
  }
  try {
    const raw = localStorage.getItem(PANEL_STATE_STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    Object.entries(state).forEach(([bodyId, expanded]) => {
      const body = document.getElementById(bodyId);
      const toggle = document.querySelector(`.panel-toggle[aria-controls="${bodyId}"]`);
      if (!body || !toggle) return;
      toggle.setAttribute("aria-expanded", String(expanded));
      body.hidden = !expanded;
    });
  } catch (e) {
    // ignore malformed saved state
  }
}

document.getElementById("dismiss-hint-btn").addEventListener("click", () => {
  document.getElementById("first-time-hint").hidden = true;
  try {
    localStorage.setItem(HINT_DISMISSED_STORAGE_KEY, "1");
  } catch (e) {
    // localStorage unavailable — fail silently
  }
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (hasCalculated) render(readInputs());
    renderStaticContent();
    syncQuicknavOffset();
  }, 150);
});

// --- Calculator quick-nav ---

function syncQuicknavOffset() {
  const topnav = document.querySelector(".topnav");
  const quicknav = document.getElementById("calc-quicknav");
  if (!topnav || !quicknav) return;
  quicknav.style.setProperty("--quicknav-top", `${topnav.getBoundingClientRect().height}px`);
}

const quicknavButtons = document.querySelectorAll("#calc-quicknav [data-jump]");
quicknavButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const panelId = btn.getAttribute("data-jump");
    openPanel(panelId);
    document.getElementById(panelId).scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

if ("IntersectionObserver" in window) {
  const quicknavObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const btn = document.querySelector(`#calc-quicknav [data-jump="${entry.target.id}"]`);
        if (!btn) return;
        quicknavButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  quicknavButtons.forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute("data-jump"));
    if (panel) quicknavObserver.observe(panel);
  });
}

syncQuicknavOffset();

// --- Personalized home-page summary ---

function renderHomeSummary() {
  const el = document.getElementById("home-summary");
  if (!el) return;
  if (!lastInput || !lastResult) {
    el.hidden = true;
    return;
  }
  el.hidden = false;

  const fireAgeText =
    lastResult.fireAge !== null
      ? `on track to hit your FIRE number around age ${lastResult.fireAge}`
      : `not yet on track to hit your FIRE number by age ${lastInput.retirementAge}`;
  const sustainabilityText = lastResult.sustainable
    ? `your portfolio is projected to last through age ${MAX_PLANNING_AGE}`
    : `it's projected to run out around age ${lastResult.depletedAge}`;

  let personalityHtml = "";
  const quizState = loadQuizState();
  if (quizState && quizState.completed && quizState.quizScores) {
    const maxScore = Math.max(...Object.values(quizState.quizScores));
    const winnerKey = QUIZ_TYPE_ORDER.find((t) => quizState.quizScores[t] === maxScore);
    const personality = findPersonality(winnerKey);
    if (personality) {
      personalityHtml = `<p class="home-summary-personality">Your retirement style: <strong>${personality.emoji} ${personality.label}</strong> — <button type="button" class="link-btn" data-view="retirement-life">see your activities →</button></p>`;
    }
  }

  el.innerHTML = `
    <p class="home-summary-greeting">Welcome back — here's where your plan stands:</p>
    <div class="home-summary-stats">
      <div class="home-summary-stat"><span class="home-summary-value">${currency(lastResult.fireNumber)}</span><span class="home-summary-label">FIRE number</span></div>
      <div class="home-summary-stat"><span class="home-summary-value">${currency(lastInput.currentPortfolio)}</span><span class="home-summary-label">Current portfolio</span></div>
      <div class="home-summary-stat"><span class="home-summary-value">${lastInput.currentAge} → ${lastInput.retirementAge}</span><span class="home-summary-label">Now → retirement age</span></div>
    </div>
    <p>You're ${fireAgeText}, and ${sustainabilityText}.</p>
    ${personalityHtml}
    <button type="button" class="primary-btn" data-view="calculator">View full plan →</button>
  `;
  el.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showView(btn.getAttribute("data-view"));
      closeHamburgerMenu();
    });
  });
}

// --- Page navigation ---

const VIEWS = ["home", "calculator", "statistics", "tax-strategies", "retirement-life"];

function showView(name) {
  if (!VIEWS.includes(name)) name = "home";
  VIEWS.forEach((v) => {
    document.getElementById("view-" + v).hidden = v !== name;
  });
  document.querySelectorAll(".topnav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-view") === name);
  });
  if (name === "home") renderHomeSummary();
  window.scrollTo(0, 0);
  if (location.hash.slice(1) !== name) location.hash = name;
}

document.querySelectorAll("[data-view]").forEach((el) => {
  el.addEventListener("click", () => {
    showView(el.getAttribute("data-view"));
    closeHamburgerMenu();
  });
});

window.addEventListener("hashchange", () => showView(location.hash.slice(1) || "home"));

// --- Hamburger menu (mobile nav) ---

const hamburgerBtn = document.getElementById("hamburger-btn");
const topnavLinks = document.getElementById("topnav-links");

function closeHamburgerMenu() {
  topnavLinks.classList.remove("open");
  hamburgerBtn.setAttribute("aria-expanded", "false");
}

hamburgerBtn.addEventListener("click", () => {
  const isOpen = topnavLinks.classList.toggle("open");
  hamburgerBtn.setAttribute("aria-expanded", String(isOpen));
});

// --- Info tips ---

document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("info-icon")) return;
  const tip = e.target.closest("label").querySelector(".input-tip");
  if (tip) tip.hidden = !tip.hidden;
});

// --- Currency-formatted inputs ---

document.querySelectorAll(".currency-input").forEach(formatCurrencyField);

// --- Save as PDF (browser print dialog) ---

document.getElementById("save-pdf-btn").addEventListener("click", () => {
  window.print();
});

// --- Monte Carlo simulation (run on demand — heavier than the live recompute) ---

document.getElementById("run-montecarlo-btn").addEventListener("click", () => {
  if (!lastInput) return;
  const btn = document.getElementById("run-montecarlo-btn");
  const resultEl = document.getElementById("montecarlo-result");
  const diagnosisEl = document.getElementById("montecarlo-diagnosis");
  const leversEl = document.getElementById("montecarlo-levers");
  const leversLoadingEl = document.getElementById("montecarlo-levers-loading");
  const leversListEl = document.getElementById("montecarlo-levers-list");
  btn.disabled = true;
  btn.textContent = "Running…";
  diagnosisEl.hidden = true;
  leversEl.hidden = true;
  leversListEl.innerHTML = "";
  setTimeout(() => {
    const mc = runMonteCarloSimulation(lastInput, lastAdjustments);
    resultEl.hidden = false;
    resultEl.textContent = `${Math.round(mc.successRate * 100)}% of ${mc.numSimulations} simulated markets never ran out of money by age ${MAX_PLANNING_AGE}.`;
    resultEl.className = mc.successRate >= 0.8 ? "status-ok" : "status-warn";
    renderMonteCarloFanChart(document.getElementById("montecarlo-chart-container"), mc.bands, lastInput.retirementAge);

    // --- Sequence-of-returns diagnosis ---
    const diagnosis = diagnoseSequenceRisk(mc.bands, lastInput.retirementAge);
    if (diagnosis.earlyRisk) {
      diagnosisEl.hidden = false;
      diagnosisEl.innerHTML = `
        <span class="strategy-tag">Risk diagnosis</span>
        <h4>Your riskiest years are early</h4>
        <p>The worst-case paths run out of money within the first decade of retirement — a bad market right after you stop working does outsized damage, since you're withdrawing from a shrinking base with no time for it to recover before the drawdown really starts (sequence-of-returns risk). Two common responses: keep 1–2 years of spending in cash or short-term bonds specifically to avoid selling into an early downturn, or build in flexibility to trim spending in a genuinely bad year rather than withdrawing a fixed amount regardless of the market.</p>
      `;
    } else if (diagnosis.laterRisk) {
      diagnosisEl.hidden = false;
      diagnosisEl.innerHTML = `
        <span class="strategy-tag">Risk diagnosis</span>
        <h4>Your risk builds up over time</h4>
        <p>The worst-case paths don't fail early — they run low later in retirement, which points more toward "not quite enough saved" than a bad-timing problem. The levers below (working longer or spending less) tend to help more directly here than a cash buffer would.</p>
      `;
    }

    // --- Quantified levers, only when there's real room to improve ---
    // Uses a shared seed and matched simulation count for the comparison
    // baseline and every lever, so each pair of runs sees the same
    // simulated markets — otherwise a lever that should strictly help
    // (like retiring later) could occasionally show a "worse" result from
    // pure sampling noise between two independent random runs.
    if (mc.successRate < 0.9) {
      leversEl.hidden = false;
      leversLoadingEl.hidden = false;
      setTimeout(() => {
        const LEVER_SIMULATIONS = 250;
        const seed = Math.floor(Math.random() * 2 ** 31);
        const comparisonBaseline = runMonteCarloSimulation(lastInput, lastAdjustments, LEVER_SIMULATIONS, seed);
        const levers = computeMonteCarloLevers(lastInput, lastAdjustments, seed);
        leversLoadingEl.hidden = true;
        leversListEl.innerHTML = levers
          .map((l) => {
            const delta = Math.round((l.successRate - comparisonBaseline.successRate) * 100);
            const deltaText = delta > 0 ? `+${delta} points` : `${delta} points`;
            return `<li>${l.label}: <strong>${Math.round(l.successRate * 100)}% success</strong> (${deltaText})</li>`;
          })
          .join("");
      }, 30);
    }

    btn.disabled = false;
    btn.textContent = "Run Monte Carlo simulation";
  }, 30);
});

// --- Save / load / share a plan ---

function serializePlan() {
  const data = {};
  document.querySelectorAll(".plan-input").forEach((el) => {
    data[el.id] = el.type === "checkbox" ? el.checked : el.value;
  });
  return data;
}

function applyPlan(data) {
  Object.entries(data).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = value === true || value === "true";
    else el.value = value;
  });
  document.querySelectorAll(".currency-input").forEach((el) => el.dispatchEvent(new Event("input")));
  document.querySelectorAll('input[type="range"]').forEach((el) => el.dispatchEvent(new Event("input")));
  selectedFireTypeKey = null;
  attemptRender(true);
}

function inputFromPlanData(data) {
  return {
    currentAge: Number(data["current-age"]),
    retirementAge: Number(data["retirement-age"]),
    currentPortfolio: parseCurrency(data["current-portfolio"]),
    annualContribution: parseCurrency(data["annual-contribution"]),
    preRetirementReturnPct: Number(data["pre-return"]),
    postRetirementReturnPct: Number(data["post-return"]),
    inflationPct: Number(data["inflation"]),
    annualExpensesToday: parseCurrency(data["annual-expenses"]),
    swrPct: Number(data["swr"]),
    filingStatus: data["filing-status"],
    stateCode: data["state"],
  };
}

function showPlanIOStatus(message, isError) {
  const el = document.getElementById("plan-io-status");
  el.textContent = message;
  el.className = "detect-status no-print " + (isError ? "detect-status-error" : "detect-status-ok");
}

document.getElementById("download-plan-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(serializePlan(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ember-retirement-plan.json";
  a.click();
  URL.revokeObjectURL(url);
  showPlanIOStatus("Plan downloaded.", false);
});

document.getElementById("load-plan-btn").addEventListener("click", () => {
  document.getElementById("load-plan-file").click();
});

document.getElementById("load-plan-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyPlan(JSON.parse(reader.result));
      showPlanIOStatus("Plan loaded.", false);
    } catch (err) {
      showPlanIOStatus("Couldn't read that file — make sure it's a plan exported from Ember.", true);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("copy-link-btn").addEventListener("click", () => {
  const params = new URLSearchParams(serializePlan()).toString();
  const url = `${location.origin}${location.pathname}#calculator?${params}`;
  navigator.clipboard
    .writeText(url)
    .then(() => showPlanIOStatus("Link copied to clipboard.", false))
    .catch(() => showPlanIOStatus("Couldn't copy automatically — select and copy the address bar instead.", true));
});

document.getElementById("email-capture-btn").addEventListener("click", () => {
  const input = document.getElementById("email-capture-input");
  const statusEl = document.getElementById("email-capture-status");
  const email = input.value.trim();
  if (!email || !email.includes("@")) {
    statusEl.textContent = "Enter a valid email address.";
    statusEl.className = "detect-status detect-status-error";
    return;
  }
  const body = new FormData();
  body.append("email_address", email);
  fetch(EMAIL_CAPTURE_ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  })
    .then((res) => {
      if (!res.ok) throw new Error("bad response");
      return res.json();
    })
    .then((data) => {
      if (data.status === "quarantined" && data.url) {
        statusEl.textContent = "Almost there — click to verify you're human, then check your inbox: ";
        const link = document.createElement("a");
        link.href = data.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Complete verification →";
        statusEl.appendChild(link);
      } else {
        statusEl.textContent = "Thanks! Check your inbox shortly.";
      }
      statusEl.className = "detect-status detect-status-ok";
      input.value = "";
      trackGoatCounterEvent("email-capture-success");
    })
    .catch(() => {
      statusEl.textContent = "Couldn't submit right now — please try again later.";
      statusEl.className = "detect-status detect-status-error";
    });
});

// --- Auto-save/restore calculator inputs (localStorage) ---

const PLAN_STORAGE_KEY = "ember-last-plan";

function saveLastPlan() {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(serializePlan()));
  } catch (e) {
    // localStorage unavailable (private browsing, quota, etc.) — fail silently
  }
}

function loadLastPlan() {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearLastPlan() {
  try {
    localStorage.removeItem(PLAN_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

document.getElementById("clear-saved-btn").addEventListener("click", () => {
  clearLastPlan();
  clearQuizState();
  resetQuiz();
  showPlanIOStatus("Saved data cleared from this browser.", false);
});

function parseInitialHash() {
  const raw = location.hash.slice(1);
  const [viewPart, queryPart] = raw.split("?");
  if (queryPart) {
    try {
      applyPlan(Object.fromEntries(new URLSearchParams(queryPart)));
    } catch (e) {
      // ignore malformed shared links
    }
  } else {
    const saved = loadLastPlan();
    if (saved) {
      try {
        applyPlan(saved);
      } catch (e) {
        // ignore corrupted saved data
      }
    }
  }
  return viewPart || "home";
}

// --- Saved scenarios (localStorage) ---

const SCENARIO_STORAGE_KEY = "ember-scenarios";
const MAX_SCENARIOS = 5;

function getScenarios() {
  try {
    return JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveScenarios(list) {
  localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(list));
}

function renderScenarios() {
  const scenarios = getScenarios();
  const listEl = document.getElementById("scenario-list");
  const compareBody = document.getElementById("scenario-compare-body");

  if (scenarios.length === 0) {
    listEl.innerHTML = `<p class="panel-intro">No saved scenarios yet.</p>`;
    compareBody.innerHTML = "";
    return;
  }

  listEl.innerHTML = scenarios
    .map(
      (s, i) => `
      <div class="info-card scenario-card">
        <h4>${s.name}</h4>
        <div class="detect-row">
          <button type="button" class="secondary-btn" data-load-scenario="${i}">Load</button>
          <button type="button" class="secondary-btn" data-delete-scenario="${i}">Delete</button>
        </div>
      </div>
    `
    )
    .join("");

  listEl.querySelectorAll("[data-load-scenario]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scenarios2 = getScenarios();
      const idx = Number(btn.getAttribute("data-load-scenario"));
      if (scenarios2[idx]) applyPlan(scenarios2[idx].data);
    });
  });
  listEl.querySelectorAll("[data-delete-scenario]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scenarios2 = getScenarios();
      scenarios2.splice(Number(btn.getAttribute("data-delete-scenario")), 1);
      saveScenarios(scenarios2);
      renderScenarios();
    });
  });

  compareBody.innerHTML = scenarios
    .map((s) => {
      const scenarioInput = inputFromPlanData(s.data);
      const result = runProjection(scenarioInput);
      return `
        <tr>
          <td>${s.name}</td>
          <td>${currency(result.fireNumber)}</td>
          <td>${result.fireAge !== null ? "Age " + result.fireAge : "Not reached"}</td>
          <td>${result.sustainable ? "Lasts to 100" : "Runs out at age " + result.depletedAge}</td>
        </tr>
      `;
    })
    .join("");
}

document.getElementById("save-scenario-btn").addEventListener("click", () => {
  const nameInput = document.getElementById("scenario-name");
  const scenarios = getScenarios();
  const name = nameInput.value.trim() || `Scenario ${scenarios.length + 1}`;
  scenarios.push({ name, data: serializePlan(), savedAt: Date.now() });
  while (scenarios.length > MAX_SCENARIOS) scenarios.shift();
  saveScenarios(scenarios);
  nameInput.value = "";
  renderScenarios();
});

// --- Retirement Life: personality quiz ---

let quizIndex = 0;
let quizScores = {};

const QUIZ_STORAGE_KEY = "ember-quiz-state";

function saveQuizState(completed) {
  try {
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({ quizIndex, quizScores, completed: !!completed }));
  } catch (e) {
    // localStorage unavailable — fail silently
  }
}

function loadQuizState() {
  try {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearQuizState() {
  try {
    localStorage.removeItem(QUIZ_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

function resetQuiz() {
  quizIndex = 0;
  quizScores = {};
  QUIZ_TYPE_ORDER.forEach((t) => (quizScores[t] = 0));
  clearQuizState();
  document.getElementById("quiz-result-container").hidden = true;
  document.getElementById("quiz-question-container").hidden = false;
  renderQuizQuestion();
}

/** Restores a completed result or in-progress answers from a previous visit; starts fresh otherwise. */
function initQuiz() {
  const saved = loadQuizState();
  if (saved && saved.completed && saved.quizScores) {
    quizScores = saved.quizScores;
    showQuizResult(true);
  } else if (saved && saved.quizIndex > 0 && saved.quizScores) {
    quizIndex = saved.quizIndex;
    quizScores = saved.quizScores;
    document.getElementById("quiz-result-container").hidden = true;
    document.getElementById("quiz-question-container").hidden = false;
    renderQuizQuestion();
  } else {
    resetQuiz();
  }
}

function renderQuizQuestion() {
  const q = QUIZ_QUESTIONS[quizIndex];
  const container = document.getElementById("quiz-question-container");
  container.innerHTML = `
    <p class="quiz-progress">Question ${quizIndex + 1} of ${QUIZ_QUESTIONS.length}</p>
    <h3 class="quiz-question">${q.question}</h3>
    <div class="quiz-options">
      ${q.options.map((opt) => `<button type="button" class="quiz-option" data-type="${opt.type}">${opt.text}</button>`).join("")}
    </div>
  `;
  container.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizScores[btn.getAttribute("data-type")]++;
      quizIndex++;
      if (quizIndex < QUIZ_QUESTIONS.length) {
        saveQuizState(false);
        renderQuizQuestion();
      } else {
        showQuizResult();
      }
    });
  });
}

function findPersonality(key) {
  return RETIREMENT_PERSONALITIES.find((p) => p.key === key);
}

function buildPersonalityResultCard(key) {
  const p = findPersonality(key);
  return `
    <div class="personality-result-card" style="--tab-color:${p.color}">
      <span class="personality-emoji-big">${p.emoji}</span>
      <h3>You're ${p.label}!</h3>
      <p class="personality-tagline">"${p.tagline}"</p>
      <p>${p.description}</p>
      <p class="budget-fit-heading">Does this fit your budget?</p>
      <div id="budget-fit-${p.key}" class="budget-fit"></div>
    </div>
  `;
}

function showQuizResult(restored) {
  document.getElementById("quiz-question-container").hidden = true;
  const maxScore = Math.max(...Object.values(quizScores));
  const winners = QUIZ_TYPE_ORDER.filter((t) => quizScores[t] === maxScore);
  const resultEl = document.getElementById("quiz-result-container");
  resultEl.hidden = false;
  saveQuizState(true);
  const intro = restored
    ? `<p class="quiz-tie-note">Picked up from your last visit — hit "Retake the quiz" for a fresh result.</p>`
    : winners.length > 1
      ? `<p class="quiz-tie-note">🎉 It's a close one — you're a genuine blend of ${winners.length} types:</p>`
      : "";
  resultEl.innerHTML = `
    ${intro}
    ${winners.map(buildPersonalityResultCard).join("")}
    <div class="detect-row">
      <button type="button" class="secondary-btn" id="retake-quiz-btn">🔄 Retake the quiz</button>
      <button type="button" class="primary-btn" id="jump-to-activities-btn">See my activities ↓</button>
    </div>
  `;
  document.getElementById("retake-quiz-btn").addEventListener("click", resetQuiz);
  document.getElementById("jump-to-activities-btn").addEventListener("click", () => {
    selectPersonalityTab(winners[0]);
    document.getElementById("personality-detail").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  winners.forEach((key) => {
    const p = findPersonality(key);
    renderBudgetFitGauge(document.getElementById(`budget-fit-${key}`), p.budgetRange, lastInput ? lastInput.annualExpensesToday : null);
  });
}

let activePersonalityKey = "adventurer";

function renderPersonalityTabs(activeKey) {
  activePersonalityKey = activeKey;
  const tabsEl = document.getElementById("personality-tabs");
  tabsEl.innerHTML = RETIREMENT_PERSONALITIES.map(
    (p) => `
      <button type="button" class="personality-tab ${p.key === activeKey ? "active" : ""}" data-personality-key="${p.key}" style="--tab-color:${p.color}">
        <span>${p.emoji}</span> ${p.label}
      </button>
    `
  ).join("");
  tabsEl.querySelectorAll(".personality-tab").forEach((btn) => {
    btn.addEventListener("click", () => selectPersonalityTab(btn.getAttribute("data-personality-key")));
  });
  renderPersonalityDetail(activeKey);
}

function renderPersonalityDetail(key) {
  const p = findPersonality(key);
  const gettingStartedHtml = (p.gettingStarted || [])
    .map(
      (tip) =>
        `<li>${tip.url ? `<a href="${tip.url}" target="_blank" rel="noopener">${tip.text} ↗</a>` : tip.text}</li>`
    )
    .join("");
  document.getElementById("personality-detail").innerHTML = `
    <div class="personality-detail-card" style="--tab-color:${p.color}">
      <div class="personality-detail-header">
        <span class="personality-emoji-big">${p.emoji}</span>
        <div>
          <h3>${p.label}</h3>
          <p class="personality-tagline">"${p.tagline}"</p>
        </div>
      </div>
      <p>${p.description}</p>
      <h4>Activities to steal</h4>
      <ul class="activity-list">${p.activities.map((a) => `<li>${a}</li>`).join("")}</ul>
      <h4>Getting started</h4>
      <ul class="getting-started-list">${gettingStartedHtml}</ul>
      <h4>Does this fit your budget?</h4>
      <div id="personality-budget-fit" class="budget-fit"></div>
    </div>
  `;
  renderBudgetFitGauge(document.getElementById("personality-budget-fit"), p.budgetRange, lastInput ? lastInput.annualExpensesToday : null);
}

function selectPersonalityTab(key) {
  renderPersonalityTabs(key);
}

populateStateDropdowns();
renderStaticContent();
renderScenarios();
initQuiz();
renderPersonalityTabs(activePersonalityKey);
const initialView = parseInitialHash();
attemptRender(false);
showView(initialView);
maybeAutoDetectState();
restorePanelState();
