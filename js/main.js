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

  renderProjectionChart(document.getElementById("chart-container"), result.points, result.fireNumber, input.retirementAge);
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
  document.getElementById("family-suggestion").textContent = buildFamilySuggestion(familyInput);
  const familyMilestonesEl = document.getElementById("family-milestones");
  familyMilestonesEl.innerHTML =
    familyPlan.milestones.length === 0
      ? ""
      : familyPlan.milestones.map((m) => `<li>${m.label} — you'll be about age ${m.age}</li>`).join("");

  // --- Life after retirement ---
  document.getElementById("life-after-intro").textContent = buildLifeAfterIntro(input, familyInput.childrenAges);

  // --- Cross-page personalization (Statistics + Tax Strategies) ---
  renderStatsChart();
  renderTaxPersonalization();

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

/** Fills in the state-aware personalization callout on the Tax Savings Strategies page. */
function renderTaxPersonalization() {
  const calloutEl = document.getElementById("tax-personal-callout");
  if (!calloutEl) return;
  if (lastInput) {
    calloutEl.textContent = describeTaxPersonalization(lastInput);
    calloutEl.hidden = false;
  } else {
    calloutEl.hidden = true;
  }
}

function renderStaticContent() {
  document.getElementById("life-after-categories").innerHTML = LIFE_AFTER_CATEGORIES.map(
    (cat) => `
      <div class="info-card">
        <h4>${cat.title}</h4>
        <ul>${cat.items.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
    `
  ).join("");

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

// --- Location detection (opt-in) ---

const detectBtn = document.getElementById("detect-state-btn");
const detectStatus = document.getElementById("detect-state-status");

detectBtn.addEventListener("click", () => {
  detectBtn.disabled = true;
  const originalLabel = detectBtn.textContent;
  detectBtn.textContent = "Detecting…";
  detectStatus.textContent = "";

  detectMyState((error, stateCode) => {
    detectBtn.disabled = false;
    detectBtn.textContent = originalLabel;
    if (error) {
      detectStatus.textContent = error.message;
      detectStatus.className = "detect-status detect-status-error";
      return;
    }
    stateSelect.value = stateCode;
    detectStatus.textContent = `Detected: ${STATE_DATA[stateCode].name}`;
    detectStatus.className = "detect-status detect-status-ok";
    attemptRender(false);
  });
});

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
  }
}

document.querySelectorAll(".panel-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const body = document.getElementById(btn.getAttribute("aria-controls"));
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
  });
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (hasCalculated) render(readInputs());
    renderStaticContent();
  }, 150);
});

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
  btn.disabled = true;
  btn.textContent = "Running…";
  setTimeout(() => {
    const mc = runMonteCarloSimulation(lastInput, lastAdjustments);
    resultEl.hidden = false;
    resultEl.textContent = `${Math.round(mc.successRate * 100)}% of ${mc.numSimulations} simulated markets never ran out of money by age ${MAX_PLANNING_AGE}.`;
    resultEl.className = mc.successRate >= 0.8 ? "status-ok" : "status-warn";
    renderMonteCarloFanChart(document.getElementById("montecarlo-chart-container"), mc.bands, lastInput.retirementAge);
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
  fetch(EMAIL_CAPTURE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, source: "ember-retirement-planner" }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("bad response");
      statusEl.textContent = "Thanks! Check your inbox shortly.";
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

function resetQuiz() {
  quizIndex = 0;
  quizScores = {};
  QUIZ_TYPE_ORDER.forEach((t) => (quizScores[t] = 0));
  document.getElementById("quiz-result-container").hidden = true;
  document.getElementById("quiz-question-container").hidden = false;
  renderQuizQuestion();
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
      if (quizIndex < QUIZ_QUESTIONS.length) renderQuizQuestion();
      else showQuizResult();
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
    </div>
  `;
}

function showQuizResult() {
  document.getElementById("quiz-question-container").hidden = true;
  const maxScore = Math.max(...Object.values(quizScores));
  const winners = QUIZ_TYPE_ORDER.filter((t) => quizScores[t] === maxScore);
  const resultEl = document.getElementById("quiz-result-container");
  resultEl.hidden = false;
  const intro =
    winners.length > 1
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
    </div>
  `;
}

function selectPersonalityTab(key) {
  renderPersonalityTabs(key);
}

populateStateDropdowns();
renderStaticContent();
renderScenarios();
resetQuiz();
renderPersonalityTabs(activePersonalityKey);
const initialView = parseInitialHash();
attemptRender(false);
showView(initialView);
