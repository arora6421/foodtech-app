// What counts as an accessibility issue in scripts/a11y-audit.mjs, kept apart so it can be tested
// (scripts/a11y-summary.test.mjs) and so the exit code and the printed summary can't disagree.
//
// An issue is any of: an errored step, an axe violation, horizontal overflow (reflow), text clipped
// by an overflow-hidden box, an undersized touch target (under 24px fails WCAG 2.5.8 AA; under our
// own 44px bar also counts), or a keyboard problem (a stop with no visible focus, or hidden).
//
// Axe "needs review" results (`axeIncomplete`, e.g. colour contrast over the paper texture, which
// axe cannot compute) are NOT issues: they appear on every screen and are covered by the token
// contrast test instead.

/** The issue lines for one audited screen; empty means clean. */
export function issueLines(s) {
  return [
    ...(s.error ? [`STEP FAILED: ${s.error}`] : []),
    ...s.axe.map((v) => `axe ${v.impact}: ${v.id} (${v.help}) at ${v.nodes.join(' | ')}`),
    ...(s.reflow ? [`reflow: ${s.reflow}`] : []),
    ...s.clipped.map((c) => `clipped: ${c}`),
    ...s.targets.filter((t) => t.belowAA).map((t) => `target below 24px (AA fail): ${t.el} ${t.w}×${t.h}`),
    ...s.targets.filter((t) => !t.belowAA).map((t) => `target below 44px: ${t.el} ${t.w}×${t.h}`),
    ...s.keyboard.problems.map((p) => `keyboard: ${p}`),
  ]
}
