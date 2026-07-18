/**
 * Horizontal life-milestone timeline: today, FIRE milestones, standard
 * retirement-benefit ages, family milestones, and the end of the plan.
 * Rendered as SVG sized to the container's real width so it stays legible
 * on phones (same approach as chart.js), with a horizontal-scroll fallback
 * on the wrapping container if milestones are dense.
 */

function buildTimelineMilestones(input, result, familyMilestones) {
  const { currentAge, retirementAge } = input;
  const milestones = [{ age: currentAge, label: "Today", kind: "today" }];

  if (result.coastFireAge !== null && result.coastFireAge !== currentAge) {
    milestones.push({ age: result.coastFireAge, label: "Coast FIRE reached", kind: "fire" });
  }
  if (result.fireAge !== null) {
    milestones.push({ age: result.fireAge, label: "FIRE number reached", kind: "fire" });
  }
  milestones.push({ age: retirementAge, label: "Target retirement", kind: "retire" });

  [
    { age: 62, label: "Social Security (early, reduced)" },
    { age: 65, label: "Medicare eligible" },
    { age: 67, label: "Social Security full retirement age" },
    { age: 73, label: "RMDs begin (Traditional accounts)" },
  ].forEach((m) => {
    if (m.age >= currentAge && m.age <= MAX_PLANNING_AGE) milestones.push({ ...m, kind: "benefit" });
  });

  familyMilestones.forEach((m) => {
    if (m.age >= currentAge && m.age <= MAX_PLANNING_AGE) milestones.push({ ...m, kind: "family" });
  });

  if (result.depletedAge !== null) {
    milestones.push({ age: result.depletedAge, label: "Portfolio depleted (est.)", kind: "warn" });
  } else {
    milestones.push({ age: MAX_PLANNING_AGE, label: "Plan horizon", kind: "end" });
  }

  // Merge milestones that land on the same age so labels don't collide.
  const byAge = new Map();
  milestones
    .sort((a, b) => a.age - b.age)
    .forEach((m) => {
      if (byAge.has(m.age)) {
        const existing = byAge.get(m.age);
        existing.label += " · " + m.label;
      } else {
        byAge.set(m.age, { ...m });
      }
    });

  return Array.from(byAge.values());
}

function renderTimeline(containerEl, milestones, currentAge) {
  const minSpacing = 160;
  const boxWidth = 150;
  const available = Math.max(280, containerEl.clientWidth || 720);
  const width = Math.max(available, milestones.length * minSpacing);
  const lanes = 4; // 2 above, 2 below, staggered so neighbors never share a lane
  const laneGap = 36;
  const lineY = 30 + lanes * laneGap;
  const height = lineY + lanes * laneGap + 20;
  const marginX = 24;
  const innerW = width - marginX * 2;

  const minAge = milestones[0].age;
  const maxAge = milestones[milestones.length - 1].age;
  const span = Math.max(1, maxAge - minAge);
  const xScale = (age) => marginX + ((age - minAge) / span) * innerW;

  const kindColor = {
    today: "var(--muted, #5c6d67)",
    fire: "var(--accent, #1f7a5c)",
    retire: "var(--accent-strong, #145940)",
    benefit: "#7b8a89",
    family: "#8a5cb0",
    warn: "var(--warn-text, #a8501c)",
    end: "var(--accent, #1f7a5c)",
  };

  // Cycle through lanes [-1, 1, -2, 2] (near-above, near-below, far-above,
  // far-below) so the two closest neighbors in the sequence never land on
  // the same side at the same distance from the baseline.
  const laneOrder = [-1, 1, -2, 2];

  // Milestones that landed on the same age get merged into one longer
  // label (see buildTimelineMilestones) — give those the far lane and
  // extra box height so the wrapped text has room.
  let mergedToggle = false;
  let markers = "";
  milestones.forEach((m, i) => {
    const xNum = Number(xScale(m.age).toFixed(1));
    const x = xNum.toFixed(1);
    const isMerged = m.label.includes(" · ");
    let lane;
    if (isMerged) {
      lane = mergedToggle ? 2 : -2;
      mergedToggle = !mergedToggle;
    } else {
      lane = laneOrder[i % laneOrder.length];
    }
    const above = lane < 0;
    const dist = Math.abs(lane) * laneGap;
    const boxHeight = isMerged ? laneGap * 2 - 4 : laneGap - 4;
    const ageLabelY = above ? lineY - dist - 6 : lineY + dist + 14;
    const textBoxY = above ? ageLabelY - boxHeight - 2 : ageLabelY + 4;
    const tickY1 = above ? lineY - 6 : lineY;
    const tickY2 = above ? lineY : lineY + 6;
    const color = kindColor[m.kind] || kindColor.benefit;
    const boxX = Math.min(Math.max(xNum - boxWidth / 2, 2), width - boxWidth - 2);

    markers += `
      <line x1="${x}" y1="${tickY1}" x2="${x}" y2="${tickY2}" stroke="${color}" stroke-width="1.5" />
      <circle cx="${x}" cy="${lineY}" r="5" fill="${color}" />
      <text x="${x}" y="${ageLabelY}" font-size="11" text-anchor="middle" fill="var(--text, #17231f)" font-weight="600">Age ${m.age}</text>
      <foreignObject x="${boxX.toFixed(1)}" y="${textBoxY}" width="${boxWidth}" height="${boxHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="timeline-label">${m.label}</div>
      </foreignObject>
    `;
  });

  containerEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="timeline-svg" role="img" aria-label="Life milestone timeline">
      <line x1="${marginX}" y1="${lineY}" x2="${width - marginX}" y2="${lineY}" class="timeline-baseline" />
      ${markers}
    </svg>
  `;
}
