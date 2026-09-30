# Pre-merge checklist

Run from the repo root. Every step must pass; if one fails, stop and report rather than working around it.

- [ ] **1. Typecheck, lint and the full test suite** (about 1 minute)

  ```
  npm run check
  ```

  Includes the golden baseline test (`src/sim/baseline.test.ts`), the diet and budget grids, and the
  catalogue validation.

- [ ] **2. Baseline guard, full comparison** (about 4 minutes)

  ```
  npm run sim:baseline -- --full
  ```

  Read-only. It must end with `BASELINE UNCHANGED ✅` (650 sessions, 40 group runs, full 200-seed
  scorecard identical). If it reports a change, do NOT regenerate the baseline: stop and report what
  moved. Never run it with `--write` or `--overwrite-with-approval` without the product owner's OK.

- [ ] **3. Accessibility audit** (about 2 minutes; needs Chrome, or set `CHROME_PATH`)

  ```
  npm run test:scripts   # the audit's issue-counting rules
  npm run a11y           # builds production, walks every screen and sheet at 390, 320 and 195 px
  ```

  `npm run a11y` must exit 0 and print `0 issue(s) in total`. It exits 1 on an errored step, an axe
  violation, horizontal overflow, clipped text, an undersized target or a keyboard problem. The
  `needs review: color-contrast` notes on every screen are expected and do not fail it (contrast is
  covered by `src/app/services/contrast.test.ts`). A screen state that is not walked by
  `scripts/a11y-audit.mjs` is not audited: if you add one, add a step for it.

## Before merging `cover-story` into `main`

- [ ] **Squash-merge**, so the preview-only test images never enter `main`'s history.
- [ ] **Delete the preview-only images first**: `src/app/debug/preview-images/` and
      `src/app/debug/previewImages.ts` (and anything importing it).
- [ ] The product owner has approved the redesign on the preview.
