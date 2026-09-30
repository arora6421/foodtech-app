import assert from 'node:assert/strict'
import { test } from 'node:test'
import { issueLines } from './a11y-summary.mjs'

// What makes scripts/a11y-audit.mjs exit non-zero: every category that must fail it, and the one
// that must not. Run with `node --test scripts/`.

const clean = () => ({
  screen: 'Screen',
  axe: [],
  axeIncomplete: [],
  reflow: null,
  clipped: [],
  targets: [],
  keyboard: { stops: 3, problems: [] },
})

test('a clean screen has no issues', () => {
  assert.deepEqual(issueLines(clean()), [])
})

test('axe "needs review" items (colour contrast on every screen) are NOT issues', () => {
  assert.deepEqual(issueLines({ ...clean(), axeIncomplete: ['color-contrast', 'aria-valid-attr-value'] }), [])
})

test('a real axe violation is an issue', () => {
  const s = { ...clean(), axe: [{ id: 'button-name', impact: 'critical', help: 'Buttons need names', nodes: ['.x'] }] }
  assert.equal(issueLines(s).length, 1)
  assert.match(issueLines(s)[0], /axe critical: button-name/)
})

test('horizontal overflow is an issue', () => {
  assert.equal(issueLines({ ...clean(), reflow: 'scrollWidth 400 > 320' }).length, 1)
})

test('an undersized target is an issue, under 24px (AA) and under 44px (our bar)', () => {
  const tiny = { el: 'button.a', w: 20, h: 20, belowAA: true }
  const small = { el: 'button.b', w: 40, h: 40, belowAA: false }
  assert.match(issueLines({ ...clean(), targets: [tiny] })[0], /below 24px \(AA fail\)/)
  assert.match(issueLines({ ...clean(), targets: [small] })[0], /below 44px/)
})

test('an errored step is an issue', () => {
  const s = { ...clean(), error: 'Waiting for selector failed', axe: [], keyboard: { stops: 0, problems: [] } }
  assert.deepEqual(issueLines(s), ['STEP FAILED: Waiting for selector failed'])
})

test('clipped text and keyboard problems are issues too', () => {
  assert.equal(issueLines({ ...clean(), clipped: ['h1 cut off'] }).length, 1)
  assert.equal(issueLines({ ...clean(), keyboard: { stops: 2, problems: ['no focus ring on .y'] } }).length, 1)
})

test('issues add up and "needs review" alongside them changes nothing', () => {
  const s = { ...clean(), reflow: 'overflow', clipped: ['a', 'b'], axeIncomplete: ['color-contrast'] }
  assert.equal(issueLines(s).length, 3)
})
