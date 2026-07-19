---
name: update-yearly-tax-figures
description: Use this skill whenever the user asks to update Ember's tax figures, contribution limits, IRS numbers, tax brackets, or any "yearly info" for a new year (e.g. "update to 2027", "refresh the tax numbers", "is the 401k limit current?", "check if our tax brackets are stale", "new year, update the app"). Also consult it proactively at the start of a new calendar year, or whenever editing js/tax.js, the TAX_STRATEGIES array in js/content.js, or js/socialsecurity.js, to check whether the government figures referenced there are still current. Walks through exactly which figures live where, how to verify them from primary sources without hallucinating numbers, and how to test/deploy the change in this specific repo.
---

# Updating Ember's yearly government figures

Ember (the retirement/FIRE planner) cites specific IRS and Census figures — tax
brackets, contribution limits, Social Security bend points — that change every
year. They're scattered across a few files as plain numbers with a year noted
in a comment or the disclaimer text next to them. Nothing enforces that they
stay current, so they silently go stale until someone notices. This skill is
the checklist for refreshing them deliberately, once a year, instead of
finding out from a user.

The single biggest risk here isn't missing a figure — it's **writing a wrong
one with total confidence**. Tax figures are exactly the kind of specific,
plausible-sounding number a model can misremember or blend between years
without any signal that something's off. Treat every figure below as unknown
until you've confirmed it from a primary source this session, even if it
feels familiar.

## The inventory — where each figure lives

Work through these in order. Each one names the file, what to look for, and
where the real number comes from.

### 1. Federal income tax brackets + standard deduction — `js/tax.js`

`FEDERAL_BRACKETS` (7 brackets × single/married) and `STANDARD_DEDUCTION`.
These feed the calculator's tax-deep-dive math directly, plus the Roth
conversion bracket-fill suggestion on the Tax Strategies page (it reads from
this same table, so fixing it here fixes both automatically).

- Source: search `irs.gov "tax inflation adjustments"` for the target tax
  year — the IRS posts a newsroom article each October/November for the
  *following* year.
- Cross-check: `taxfoundation.org` publishes the same table shortly after,
  usually as `taxfoundation.org/data/all/federal/<year>-tax-brackets/`.

### 2. Retirement account contribution limits — `js/content.js`, `TAX_STRATEGIES` array

Look for the `body` strings mentioning specific numbers: the `"401(k) / 403(b)"`
entry (employee limit + 50+ catch-up + 60–63 super catch-up), `"Traditional
vs. Roth IRA"` (limit + catch-up), `"HSA (Health Savings Account)"`
(individual + family + 55+ catch-up), and `"Qualified Charitable
Distributions"` (annual QCD cap).

- Source: search `irs.gov 401k limit increases <year>` — the IRS announces
  these together, usually via a specific Notice (e.g. Notice 2025-67 covered
  2026). The QCD limit is announced separately, closer to year-end — search
  `irs.gov qualified charitable distribution limit <year>`.
- Also update the disclaimer directly below the strategies grid ("Contribution
  limits shown are approximate for `<year>`...") and the calculator's state
  comparison disclaimer ("federal brackets reflect `<year>` figures").

### 3. Social Security bend points — `js/socialsecurity.js`

`SS_BEND_POINT_1` and `SS_BEND_POINT_2`, both commented with the year they're
from. **As of the last figures update these are still labeled 2024** — this
file wasn't touched in the 2026 pass, so treat it as already-outstanding work
the first time you run this skill, not something that was current until now.

- Source: search `ssa.gov bend points <year>` — the SSA publishes these as
  part of its annual COLA/benefit-formula announcement, typically in October.
- `SS_FULL_RETIREMENT_AGE` (currently 67) is not annual — it's fixed by birth
  year under current law and only needs revisiting if Congress changes the
  law, not on the yearly pass.

### 4. Things that look yearly but usually aren't — don't touch on the annual pass

- `RETIREMENT_STATS_BY_AGE` and `NET_WORTH_PERCENTILES` in `js/content.js` come
  from the Fed's **Survey of Consumer Finances**, released roughly every
  **three years** (2022 was the wave current as of this writing). Check
  `federalreserve.gov` for a newer wave before assuming these are stale — most
  years there won't be one.
- `HOUSEHOLD_INCOME_PERCENTILES` in `js/content.js` comes from the Census
  Bureau's **"Income in the United States"** report, released each
  **September** for the *prior* calendar year. If you're checking this before
  that year's September release has happened, the current figures are still
  the latest available — don't "update" them to a number that doesn't exist
  yet. Verify at `census.gov` whether a newer report has actually posted.

### 5. Sweep for stray year references

Once the numbers above are updated, grep the repo for the old year to catch
any disclaimer copy that still names it:

```bash
grep -rn "<old-year>" /workspace/ember/index.html /workspace/ember/js
```

Every remaining hit should be either intentional (a Census/SCF year that
genuinely hasn't changed yet — see above) or a copy string you missed.

## Verification process — don't skip this

For every figure, get **two independent sources that agree** before writing
it into the code. A single search result summary is not enough — search
snippets get compressed and occasionally blend adjacent years or filing
statuses. The pattern that worked well:

1. `WebSearch` for the figure (e.g. `"2027 401k contribution limit IRS"`).
2. `WebFetch` the actual `irs.gov` page the search turns up, and ask it to
   list the specific numbers you need — don't just trust the search engine's
   auto-generated summary of it.
3. `WebFetch` a second source (Tax Foundation is reliably fast to publish
   the full bracket tables) and compare.
4. If the two disagree, `irs.gov` wins — it's the primary source. This
   happened once already: a search summary had the wrong 12%/22% bracket
   boundary for single filers, and fetching the IRS page directly resolved it.

Never fill in a number from memory just because it seems close to last year's
plus a plausible inflation bump — the whole point of this process is that
"plausible" and "correct" aren't the same thing here.

## After updating: test and deploy

This repo (`/workspace/ember`) is the **only** copy of Ember's source — a
prior mirror at `/home/user/tictactoe/retirement-planner` was deliberately
removed, so don't recreate it or split changes across two places.

1. **Test with Playwright** (headless Chromium at `/opt/pw-browsers/chromium`,
   loaded via `file://` against `index.html`). At minimum:
   - Load the Calculator and Tax Strategies pages, fill in representative
     inputs, and confirm the new figures actually render (grep the rendered
     text for the new numbers, not just "no crash").
   - Run a full click-through of the calculator (open every collapsible
     panel, run Monte Carlo, save a scenario) and confirm zero console
     errors — this is the regression check used throughout this project.
2. **Commit and push** directly to `bowuzhang/ember` on `main` — GitHub
   Actions auto-deploys to GitHub Pages on push, there's no separate deploy
   step.
3. **Rebuild the single-file bundle**, if one exists for this session: the
   `build-artifact.js` script (usually in the session scratchpad directory)
   has `ROOT` pointed at `/workspace/ember` and concatenates everything into
   one HTML file. Re-run it and republish via the `Artifact` tool at the same
   file path if you'd previously published one — that keeps the same URL
   alive instead of minting a new one.
