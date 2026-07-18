# 🔥 Ember — Retirement & FIRE Planner

A free, one-stop retirement planning tool: project your FIRE number, dig into state taxes and withdrawal strategies year-by-year, run Monte Carlo risk analysis, and see how you compare to national benchmarks — all running locally in your browser, no backend, no build step.

## Live site

Once GitHub Pages is enabled for this repo (Settings → Pages → Source: GitHub Actions), it'll deploy automatically on every push to `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Features

- **Calculator** — FIRE number, Coast FIRE, portfolio projection, contribution vs. growth chart, state tax & cost-of-living comparison, a year-by-year Tax Deep-Dive across three withdrawal-order strategies, Social Security estimate, Monte Carlo risk analysis, mortgage/debt payoff modeling, a healthcare bridge cost estimate, save/load plans (JSON + shareable link), and named scenario comparison.
- **US Retirement Statistics** — net worth and retirement-balance benchmarks by age, wealth percentile thresholds, and portfolio-to-income comparisons, sourced from the Federal Reserve SCF and US Census data.
- **Tax Savings Strategies** — a menu of account types and tactics (401k/IRA, HSA, backdoor Roth, tax-loss harvesting, and more).
- **Retirement Life** — a fun personality quiz sorting you into one of 8 retirement archetypes, each with ~14 activity ideas.

## Running locally

No build step — just open `index.html` in a browser, or serve the directory with anything static:

```bash
python3 -m http.server 8000
```

## Structure

```
index.html          Single-page app shell (all views)
styles.css           All styling
data/states.js       Per-state tax & cost-of-living data
js/                  One module per concern (projection, tax, strategy,
                     Monte Carlo, Social Security, mortgage, healthcare,
                     family planning, timeline, charts, content, geo, main)
```

All calculations run client-side. Optional features (state auto-detect, saved scenarios) are opt-in and disclosed in-app — nothing is transmitted to or stored on any server owned by this project.
