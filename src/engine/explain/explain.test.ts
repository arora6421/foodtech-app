import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { CravingSelection } from '../../domain'
import { MOOD_TAGS } from '../../domain'
import { MOCK_CATALOGUE } from '../../catalog/mock/MockCatalog'
import { ANGEL_N1 } from '../../location/LocationProvider'
import { clusterArchetypes } from '../clusters/clusters'
import { DEFAULT_CONFIG as C } from '../config'
import { createSoloSession, soloReducer } from '../session/solo'
import type { SoloState } from '../session/types'
import { explainResult, noQuantifier, yesQuantifier } from './explain'
import type { Reason } from './explain'

const clustering = clusterArchetypes(MOCK_CATALOGUE, C)
const start = (craving: CravingSelection, seed = 3) =>
  createSoloSession({
    catalogue: MOCK_CATALOGUE,
    clustering,
    context: { origin: ANGEL_N1, now: new Date('2026-09-24T19:30:00Z'), fulfilment: 'either', budget: 'any', diet: [] },
    craving,
    seed,
  })

describe('quantifier rules (MVP_SPEC §11.3)', () => {
  it.each([
    [1, 1, undefined],
    [2, 2, 'both'],
    [3, 3, 'all 3'],
    [3, 4, '3 of 4'],
    [2, 3, '2 of 3'],
    [1, 2, undefined],
    [2, 4, undefined],
    [0, 3, undefined],
  ])('yes %i of %i → %s', (yes, seen, expected) => {
    expect(yesQuantifier(yes, seen)).toBe(expected)
  })
})

/** Every claim must be literally true of the recorded evidence. */
function assertFaithful(s: SoloState, r: Reason) {
  if (r.evidence.fromCraving) {
    expect(s.model.craving.intent).not.toBe('no_idea')
    return
  }
  const { yesSeen, noSeen } = r.evidence
  const seen = yesSeen + noSeen
  const yesQ = yesQuantifier(yesSeen, seen)
  const noQ = noQuantifier(noSeen, seen)
  expect(yesQ !== undefined || noQ !== undefined, r.text).toBe(true)
  if (r.text.startsWith('You said yes to')) expect(r.text).toContain(`yes to ${yesQ} `)
  if (r.text.startsWith('You passed on')) expect(r.text).toContain(`on ${noQ} `)
  // The counts quoted are the real, undecayed counts in the profile.
  const e = s.profile.features.get(r.featureId)!
  expect(e.yesSeen).toBe(yesSeen)
  expect(e.noSeen).toBe(noSeen)
}

describe('explanations are faithful (MVP_SPEC §11.7)', () => {
  it('property: no claim is ever unsupported, across random sessions', () => {
    fc.assert(
      fc.property(
        fc.subarray([...MOOD_TAGS, 'spicy' as const], { maxLength: 2 }),
        fc.array(fc.boolean(), { minLength: 15, maxLength: 15 }),
        fc.integer({ min: 1, max: 500 }),
        (moods, answers, seed) => {
          let s = start({ moods, intent: 'normal' }, seed)
          let i = 0
          while (!s.result) s = soloReducer(s, { type: 'swipe', verdict: answers[i++ % 15] ? 'yes' : 'no' })
          const e = explainResult(s)!
          expect(e.reasons.length).toBeLessThanOrEqual(3)
          for (const r of [...e.reasons, ...(e.avoided ? [e.avoided] : [])]) assertFaithful(s, r)
          for (const r of s.result!.runnersUp) {
            const alt = explainResult(s, r.archetypeId)!
            for (const x of alt.reasons) assertFaithful(s, x)
          }
        },
      ),
      { numRuns: 30 },
    )
  })

  it('names only what a consistent user actually kept choosing', () => {
    let s = start({ moods: [], intent: 'normal' })
    while (!s.result) {
      const a = s.model.pool.archetypes.get(s.current!.archetypeId)!
      s = soloReducer(s, { type: 'swipe', verdict: a.textures.includes('crispy') ? 'yes' : 'no' })
    }
    // The engine may explain the choice through whatever the YES'd cards shared (e.g. 'both burgers'),
    // but every swipe-based reason must name a feature that was on at least two YES'd cards.
    const e = explainResult(s)!
    const yesVectors = s.swipes.filter((r) => r.verdict !== 'no').map((r) => s.model.pool.baseVectors.get(r.card.archetypeId)!)
    const swipeReasons = e.reasons.filter((r) => !r.evidence.fromCraving)
    expect(swipeReasons.length).toBeGreaterThan(0)
    for (const r of swipeReasons) expect(yesVectors.filter((v) => v.has(r.featureId)).length).toBeGreaterThanOrEqual(2)
  })

  it('"Decide for me" before any swipe only quotes the craving', () => {
    const s = soloReducer(start({ moods: ['comforting'], intent: 'normal' }), { type: 'decide' })
    const e = explainResult(s)!
    expect(e.reasons.every((r) => r.evidence.fromCraving)).toBe(true)
    expect(e.headline).toBe("Based on what you told us, we'd go for this.")
    expect(e.confidenceLabel).toBe('Best guess')
  })

  it('"No idea" never quotes a craving', () => {
    const s = soloReducer(start({ moods: [], intent: 'no_idea' }), { type: 'decide' })
    expect(explainResult(s)!.reasons.some((r) => r.evidence.fromCraving)).toBe(false)
  })

  it('"That\'s the one" says it was the user\'s call', () => {
    const s = soloReducer(start({ moods: [], intent: 'normal' }), { type: 'pick' })
    expect(explainResult(s)!.headline).toMatch(/^Your call/)
  })
})
