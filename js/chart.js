/**
 * Minimal dependency-free SVG line chart for the portfolio projection.
 * Renders a balance-vs-age line, a FIRE-number reference line, and a
 * marker at the retirement age.
 *
 * The SVG's viewBox is sized to the container's actual on-screen width
 * (not a fixed 720px design width) so that text renders at true CSS
 * pixel size on narrow phone screens instead of shrinking along with
 * the rest of the scaled artwork.
 */

function formatCurrencyShort(value) {
  if (Math.abs(value) >= 1e6) return "$" + (value / 1e6).toFixed(1) + "M";
  if (Math.abs(value) >= 1e3) return "$" + (value / 1e3).toFixed(0) + "k";
  return "$" + Math.round(value);
}

function renderProjectionChart(containerEl, points, fireNumber, retirementAge) {
  const width = Math.max(280, Math.min(720, containerEl.clientWidth || 720));
  const isNarrow = width < 420;
  const height = isNarrow ? 260 : 340;
  const margin = {
    top: isNarrow ? 26 : 20,
    right: isNarrow ? 8 : 20,
    bottom: isNarrow ? 32 : 36,
    left: isNarrow ? 46 : 64,
  };
  const tickFontSize = isNarrow ? 11 : 12;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const ages = points.map((p) => p.age);
  const balances = points.map((p) => p.balance);
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const maxBalance = Math.max(...balances, fireNumber) * 1.08;

  const xScale = (age) => margin.left + ((age - minAge) / (maxAge - minAge)) * innerW;
  const yScale = (bal) => margin.top + innerH - (bal / maxBalance) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.age).toFixed(1)} ${yScale(p.balance).toFixed(1)}`)
    .join(" ");

  const fireY = yScale(fireNumber).toFixed(1);
  const retireX = xScale(retirementAge).toFixed(1);

  // Y-axis gridlines/labels
  const tickCount = isNarrow ? 4 : 5;
  let yTicks = "";
  for (let i = 0; i <= tickCount; i++) {
    const val = (maxBalance / tickCount) * i;
    const y = yScale(val).toFixed(1);
    yTicks += `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid" />
      <text x="${margin.left - 8}" y="${Number(y) + 4}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="end">${formatCurrencyShort(val)}</text>
    `;
  }

  // X-axis labels — fewer ticks on narrow screens so they don't overlap
  const targetTicks = isNarrow ? 4 : 8;
  const ageStep = Math.max(1, Math.round((maxAge - minAge) / targetTicks));
  let xTicks = "";
  for (let age = minAge; age <= maxAge; age += ageStep) {
    const x = xScale(age).toFixed(1);
    xTicks += `<text x="${x}" y="${height - margin.bottom + 18}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="middle">${age}</text>`;
  }

  containerEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="projection-svg" role="img" aria-label="Projected portfolio balance by age">
      ${yTicks}
      <line x1="${margin.left}" y1="${fireY}" x2="${width - margin.right}" y2="${fireY}" class="chart-fire-line" />
      <text x="${width - margin.right}" y="${Number(fireY) - 6}" class="chart-fire-label" font-size="${tickFontSize}" text-anchor="end">FIRE number</text>
      <line x1="${retireX}" y1="${margin.top}" x2="${retireX}" y2="${height - margin.bottom}" class="chart-retire-line" />
      <text x="${retireX}" y="${margin.top - 8}" class="chart-retire-label" font-size="${tickFontSize}" text-anchor="middle">Retirement</text>
      <path d="${linePath}" class="chart-line" fill="none" />
      ${xTicks}
      <text x="${(width) / 2}" y="${height - 4}" class="chart-axis-title" font-size="${tickFontSize}" text-anchor="middle">Age</text>
    </svg>
  `;
}

/** Stacked area: cumulative contributions vs. cumulative investment growth, accumulation phase only. */
function renderContributionGrowthChart(containerEl, points, currentAge, currentPortfolio, annualContribution) {
  const accumulationPoints = points.filter((p) => p.phase === "accumulation");
  const width = Math.max(280, Math.min(720, containerEl.clientWidth || 720));
  const isNarrow = width < 420;
  const height = isNarrow ? 240 : 300;
  const margin = { top: 20, right: isNarrow ? 8 : 20, bottom: isNarrow ? 32 : 36, left: isNarrow ? 46 : 64 };
  const tickFontSize = isNarrow ? 11 : 12;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const minAge = accumulationPoints[0]?.age ?? currentAge;
  const maxAge = accumulationPoints[accumulationPoints.length - 1]?.age ?? currentAge;
  const maxBalance = Math.max(...accumulationPoints.map((p) => p.balance), 1) * 1.08;

  const xScale = (age) => margin.left + ((age - minAge) / Math.max(1, maxAge - minAge)) * innerW;
  const yScale = (bal) => margin.top + innerH - (bal / maxBalance) * innerH;

  const contributionsAt = (age) => currentPortfolio + annualContribution * (age - currentAge);

  const baseline = accumulationPoints.map((p) => `${xScale(p.age).toFixed(1)},${yScale(0).toFixed(1)}`);
  const contribTop = accumulationPoints.map((p) => `${xScale(p.age).toFixed(1)},${yScale(Math.min(contributionsAt(p.age), p.balance)).toFixed(1)}`);
  const totalTop = accumulationPoints.map((p) => `${xScale(p.age).toFixed(1)},${yScale(p.balance).toFixed(1)}`);

  const contribArea = `M ${baseline[0]} L ${contribTop.join(" L ")} L ${baseline[baseline.length - 1]} Z`;
  const growthArea = `M ${contribTop[0]} L ${totalTop.join(" L ")} L ${contribTop[contribTop.length - 1]} Z`;

  const tickCount = isNarrow ? 4 : 5;
  let yTicks = "";
  for (let i = 0; i <= tickCount; i++) {
    const val = (maxBalance / tickCount) * i;
    const y = yScale(val).toFixed(1);
    yTicks += `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid" />
      <text x="${margin.left - 8}" y="${Number(y) + 4}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="end">${formatCurrencyShort(val)}</text>
    `;
  }
  const targetTicks = isNarrow ? 4 : 8;
  const ageStep = Math.max(1, Math.round((maxAge - minAge) / targetTicks));
  let xTicks = "";
  for (let age = minAge; age <= maxAge; age += ageStep) {
    const x = xScale(age).toFixed(1);
    xTicks += `<text x="${x}" y="${height - margin.bottom + 18}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="middle">${age}</text>`;
  }

  containerEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="projection-svg" role="img" aria-label="Contributions versus investment growth over time">
      ${yTicks}
      <path d="${contribArea}" class="area-contrib" />
      <path d="${growthArea}" class="area-growth" />
      ${xTicks}
      <text x="${width / 2}" y="${height - 4}" class="chart-axis-title" font-size="${tickFontSize}" text-anchor="middle">Age</text>
    </svg>
    <div class="chart-legend">
      <span><i class="legend-swatch legend-contrib"></i>Your contributions</span>
      <span><i class="legend-swatch legend-growth"></i>Investment growth</span>
    </div>
  `;
}

/** Simple horizontal stacked bar: net take-home vs. federal tax vs. state tax. */
function renderTaxBreakdownBar(containerEl, breakdown) {
  const { net, federal, state } = breakdown;
  const total = Math.max(1, net + federal + state);
  const netPct = (net / total) * 100;
  const federalPct = (federal / total) * 100;
  const statePct = (state / total) * 100;

  containerEl.innerHTML = `
    <div class="tax-bar" role="img" aria-label="Breakdown of gross withdrawal into net income, federal tax, and state tax">
      <div class="tax-bar-segment tax-bar-net" style="width:${netPct}%">${netPct >= 12 ? "Net " + formatCurrencyShort(net) : ""}</div>
      <div class="tax-bar-segment tax-bar-federal" style="width:${federalPct}%">${federalPct >= 10 ? formatCurrencyShort(federal) : ""}</div>
      <div class="tax-bar-segment tax-bar-state" style="width:${statePct}%">${statePct >= 10 ? formatCurrencyShort(state) : ""}</div>
    </div>
    <div class="chart-legend">
      <span><i class="legend-swatch legend-net"></i>Net take-home (${netPct.toFixed(0)}%)</span>
      <span><i class="legend-swatch legend-federal"></i>Federal tax (${federalPct.toFixed(0)}%)</span>
      <span><i class="legend-swatch legend-state"></i>State tax (${statePct.toFixed(0)}%)</span>
    </div>
  `;
}

/** Multi-line comparison of total portfolio balance under different withdrawal-order strategies. */
function renderStrategyComparisonChart(containerEl, strategyResults, retirementAge) {
  const width = Math.max(280, Math.min(720, containerEl.clientWidth || 720));
  const isNarrow = width < 420;
  const height = isNarrow ? 260 : 320;
  const margin = { top: 20, right: isNarrow ? 8 : 20, bottom: isNarrow ? 32 : 36, left: isNarrow ? 46 : 64 };
  const tickFontSize = isNarrow ? 11 : 12;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const allAges = strategyResults[0].rows.map((r) => r.age);
  const minAge = retirementAge;
  const maxAge = Math.max(...allAges);
  const maxBalance = Math.max(1, ...strategyResults.flatMap((s) => s.rows.map((r) => r.totalBalance))) * 1.08;

  const xScale = (age) => margin.left + ((age - minAge) / Math.max(1, maxAge - minAge)) * innerW;
  const yScale = (bal) => margin.top + innerH - (bal / maxBalance) * innerH;

  const colors = ["#1f7a5c", "#8a5cb0", "#c07a1e"];
  const paths = strategyResults
    .map((s, i) => {
      const d = [`M ${xScale(retirementAge).toFixed(1)} ${yScale(s.rows[0] ? s.rows[0].totalBalance : 0).toFixed(1)}`]
        .concat(s.rows.map((r) => `L ${xScale(r.age).toFixed(1)} ${yScale(r.totalBalance).toFixed(1)}`))
        .join(" ");
      return `<path d="${d}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="2.5" />`;
    })
    .join("");

  const tickCount = isNarrow ? 4 : 5;
  let yTicks = "";
  for (let i = 0; i <= tickCount; i++) {
    const val = (maxBalance / tickCount) * i;
    const y = yScale(val).toFixed(1);
    yTicks += `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid" />
      <text x="${margin.left - 8}" y="${Number(y) + 4}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="end">${formatCurrencyShort(val)}</text>
    `;
  }
  const targetTicks = isNarrow ? 4 : 8;
  const ageStep = Math.max(1, Math.round((maxAge - minAge) / targetTicks));
  let xTicks = "";
  for (let age = minAge; age <= maxAge; age += ageStep) {
    const x = xScale(age).toFixed(1);
    xTicks += `<text x="${x}" y="${height - margin.bottom + 18}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="middle">${age}</text>`;
  }

  containerEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="projection-svg" role="img" aria-label="Portfolio balance in retirement under different withdrawal-order strategies">
      ${yTicks}
      ${paths}
      ${xTicks}
      <text x="${width / 2}" y="${height - 4}" class="chart-axis-title" font-size="${tickFontSize}" text-anchor="middle">Age</text>
    </svg>
    <div class="chart-legend">
      ${strategyResults.map((s, i) => `<span><i class="legend-swatch" style="background:${colors[i % colors.length]}"></i>${s.label}</span>`).join("")}
    </div>
  `;
}

/** Monte Carlo fan chart: shaded 10th-90th percentile band with a median line. */
function renderMonteCarloFanChart(containerEl, bands, retirementAge) {
  const width = Math.max(280, Math.min(720, containerEl.clientWidth || 720));
  const isNarrow = width < 420;
  const height = isNarrow ? 260 : 320;
  const margin = { top: 20, right: isNarrow ? 8 : 20, bottom: isNarrow ? 32 : 36, left: isNarrow ? 46 : 64 };
  const tickFontSize = isNarrow ? 11 : 12;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const minAge = bands[0].age;
  const maxAge = bands[bands.length - 1].age;
  const maxBalance = Math.max(...bands.map((b) => b.p90), 1) * 1.08;

  const xScale = (age) => margin.left + ((age - minAge) / Math.max(1, maxAge - minAge)) * innerW;
  const yScale = (bal) => margin.top + innerH - (bal / maxBalance) * innerH;

  const topPath = bands.map((b) => `${xScale(b.age).toFixed(1)},${yScale(b.p90).toFixed(1)}`);
  const bottomPath = bands
    .slice()
    .reverse()
    .map((b) => `${xScale(b.age).toFixed(1)},${yScale(b.p10).toFixed(1)}`);
  const bandArea = `M ${topPath.join(" L ")} L ${bottomPath.join(" L ")} Z`;
  const medianLine = bands
    .map((b, i) => `${i === 0 ? "M" : "L"} ${xScale(b.age).toFixed(1)} ${yScale(b.p50).toFixed(1)}`)
    .join(" ");

  const retireX = xScale(retirementAge).toFixed(1);

  const tickCount = isNarrow ? 4 : 5;
  let yTicks = "";
  for (let i = 0; i <= tickCount; i++) {
    const val = (maxBalance / tickCount) * i;
    const y = yScale(val).toFixed(1);
    yTicks += `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid" />
      <text x="${margin.left - 8}" y="${Number(y) + 4}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="end">${formatCurrencyShort(val)}</text>
    `;
  }
  const targetTicks = isNarrow ? 4 : 8;
  const ageStep = Math.max(1, Math.round((maxAge - minAge) / targetTicks));
  let xTicks = "";
  for (let age = minAge; age <= maxAge; age += ageStep) {
    const x = xScale(age).toFixed(1);
    xTicks += `<text x="${x}" y="${height - margin.bottom + 18}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="middle">${age}</text>`;
  }

  containerEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="projection-svg" role="img" aria-label="Monte Carlo simulated portfolio balance range by age">
      ${yTicks}
      <path d="${bandArea}" class="mc-band" />
      <path d="${medianLine}" class="chart-line" fill="none" />
      <line x1="${retireX}" y1="${margin.top}" x2="${retireX}" y2="${height - margin.bottom}" class="chart-retire-line" />
      ${xTicks}
      <text x="${width / 2}" y="${height - 4}" class="chart-axis-title" font-size="${tickFontSize}" text-anchor="middle">Age</text>
    </svg>
    <div class="chart-legend">
      <span><i class="legend-swatch" style="background:var(--accent)"></i>Median outcome</span>
      <span><i class="legend-swatch legend-mc-band"></i>10th–90th percentile range</span>
    </div>
  `;
}

/** Grouped bar chart: two series (e.g. net worth vs. retirement balance) per labeled category. */
function renderGroupedBarChart(containerEl, categories, seriesA, seriesB, userMarker) {
  const width = Math.max(280, Math.min(720, containerEl.clientWidth || 720));
  const isNarrow = width < 420;
  const height = isNarrow ? 300 : 340;
  const margin = { top: userMarker ? 40 : 20, right: isNarrow ? 8 : 20, bottom: isNarrow ? 54 : 46, left: isNarrow ? 46 : 64 };
  const tickFontSize = isNarrow ? 10 : 12;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const rawMax = Math.max(...categories.map((c) => Math.max(c[seriesA.key], c[seriesB.key])), userMarker ? userMarker.value : 0);
  const maxVal = rawMax * 1.1;
  const yScale = (v) => margin.top + innerH - (v / maxVal) * innerH;

  const groupWidth = innerW / categories.length;
  const barGap = isNarrow ? 3 : 6;
  const barWidth = (groupWidth - barGap * 3) / 2;

  const tickCount = isNarrow ? 4 : 5;
  let yTicks = "";
  for (let i = 0; i <= tickCount; i++) {
    const val = (maxVal / tickCount) * i;
    const y = yScale(val).toFixed(1);
    yTicks += `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid" />
      <text x="${margin.left - 8}" y="${Number(y) + 4}" class="chart-axis-label" font-size="${tickFontSize}" text-anchor="end">${formatCurrencyShort(val)}</text>
    `;
  }

  let bars = "";
  let markerX = null;
  categories.forEach((cat, i) => {
    const groupX = margin.left + i * groupWidth;
    const xA = groupX + barGap;
    const xB = xA + barWidth + barGap;
    const yA = yScale(cat[seriesA.key]);
    const yB = yScale(cat[seriesB.key]);
    if (userMarker && cat.label === userMarker.categoryLabel) {
      markerX = groupX + groupWidth / 2;
    }
    bars += `
      <rect x="${xA.toFixed(1)}" y="${yA.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${(margin.top + innerH - yA).toFixed(1)}" fill="${seriesA.color}" rx="2" />
      <rect x="${xB.toFixed(1)}" y="${yB.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${(margin.top + innerH - yB).toFixed(1)}" fill="${seriesB.color}" rx="2" />
      <text x="${(groupX + groupWidth / 2).toFixed(1)}" y="${height - margin.bottom + (isNarrow ? 16 : 18)}" font-size="${tickFontSize}" text-anchor="middle" class="chart-axis-label">${cat.label}</text>
    `;
  });

  let markerMarkup = "";
  if (userMarker && markerX !== null) {
    const mx = markerX.toFixed(1);
    const my = Number(yScale(userMarker.value).toFixed(1));
    markerMarkup = `
      <line x1="${mx}" y1="${margin.top - 12}" x2="${mx}" y2="${my}" class="chart-user-marker-line" />
      <path d="M ${mx} ${my - 7} L ${Number(mx) + 7} ${my} L ${mx} ${my + 7} L ${Number(mx) - 7} ${my} Z" class="chart-user-marker" />
      <text x="${mx}" y="${margin.top - 16}" class="chart-user-marker-label" font-size="${tickFontSize}" text-anchor="middle">${userMarker.label}</text>
    `;
  }

  containerEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="projection-svg" role="img" aria-label="${seriesA.label} versus ${seriesB.label} by age bracket${userMarker ? ", with your own position marked" : ""}">
      ${yTicks}
      ${bars}
      ${markerMarkup}
    </svg>
    <div class="chart-legend">
      <span><i class="legend-swatch" style="background:${seriesA.color}"></i>${seriesA.label}</span>
      <span><i class="legend-swatch" style="background:${seriesB.color}"></i>${seriesB.label}</span>
      ${userMarker ? `<span><i class="legend-swatch chart-user-marker-swatch"></i>${userMarker.legendLabel || "You"}</span>` : ""}
    </div>
  `;
}
