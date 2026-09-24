import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { DIET_CONSTRAINTS, effectiveDietary, satisfiesDiet } from '../../domain'
import type { CravingSelection, SessionContext } from '../../domain'
import { MOCK_CATALOGUE } from '../../catalog/mock/MockCatalog'
import { ANGEL_N1 } from '../../location/LocationProvider'
import { clusterArchetypes } from '../clusters/clusters'
import { DEFAULT_CONFIG as C } from '../config'
import { matchesMood } from '../deck/selectNext'
import { view } from '../profile/profile'
import { createSoloSession, replay, soloReducer, undo } from './solo'
import type { SoloEvent, SoloState } from './types'

const clustering = clusterArchetypes(MOCK_CATALOGUE, C)
const ctx = (over: Partial<SessionContext> = {}): SessionContext => ({
  origin: ANGEL_N1,
  now: new Date('2026-09-24T19:30:00Z'),
  fulfilment: 'either',
  budget: 'any',
  diet: [],
  ...over,
})
const start = (craving: CravingSelection = { moods: [], intent: 'normal' }, over: Partial<SessionContext> = {}, seed = 7) =>
  createSoloSession({ catalogue: MOCK_CATALOGUE, clustering, context: ctx(over), craving, seed })

const run = (s: SoloState, decide: (s: SoloState) => SoloEvent, maxSteps = 40) => {
  for (let i = 0; i < maxSteps && !s.result; i++) s = soloReducer(s, decide(s))
  return s
}
const allNo = (): SoloEvent => ({ type: 'swipe', verdict: 'no' })
const archetypeOf = (s: SoloState, id: string) => s.model.pool.archetypes.get(id)!

describe('solo session: determinism and replay (MVP_SPEC §8.7, §18)', () => {
  it('same seed and answers give the identical deck', () => {
    const decide = (s: SoloState): SoloEvent => ({
      type: 'swipe',
      verdict: archetypeOf(s, s.current!.archetypeId).axes.spice >= 2 ? 'yes' : 'no',
    })
    const a = run(start(), decide)
    const b = run(start(), decide)
    expect(a.swipes.map((r) => r.card)).toEqual(b.swipes.map((r) => r.card))
    expect(a.result).toEqual(b.result)
  })

  it('replaying the event log reproduces the state exactly', () => {
    const s = run(start({ moods: ['comforting'], intent: 'normal' }), (st) => ({
      type: 'swipe',
      verdict: st.swipes.length % 3 === 0 ? 'yes' : 'no',
    }))
    const again = replay(s.model, s.events)
    expect(again.swipes).toEqual(s.swipes)
    expect(again.result).toEqual(s.result)
    expect(again.counter).toEqual(s.counter)
  })

  it('undo equals replaying without the last event, including across a pivot', () => {
    let s = start()
    for (let i = 0; i < 7; i++) s = soloReducer(s, allNo())
    expect(s.pivot.used).toBeGreaterThan(0)
    const undone = undo(s)
    expect(undone.events).toEqual(s.events.slice(0, -1))
    expect(undone.current).toEqual(replay(s.model, s.events.slice(0, -1)).current)
    expect(undo(start()).events).toEqual([])
  })
})

describe('solo session: budget and stopping (MVP_SPEC §10)', () => {
  it('never exceeds 15 swipes in the normal flow', () => {
    const s = run(start(), allNo)
    expect(s.result?.stopReason).toBe('max_reached')
    expect(s.swipes.length).toBe(C.maxSwipes)
    expect(s.result?.confidenceLabel).toBe('Best guess')
  })

  it('never stops before the minimum without a user shortcut', () => {
    const s = run(start(), () => ({ type: 'swipe', verdict: 'yes' }) as const, 5)
    expect(s.result).toBeNull()
  })

  it('"That\'s the one" ends immediately with that card as the hero', () => {
    const s0 = start()
    const card = s0.current!
    const s = soloReducer(s0, { type: 'pick' })
    expect(s.result?.stopReason).toBe('user_picked')
    expect(s.result?.hero.archetypeId).toBe(card.archetypeId)
    expect(s.result?.hero.offeringId).toBe(card.offeringId)
    expect(s.result?.confidenceLabel).toBe('Strong match')
  })

  it('"Decide for me" at card 0 is a best guess', () => {
    const s = soloReducer(start({ moods: ['spicy'], intent: 'normal' }), { type: 'decide' })
    expect(s.result?.stopReason).toBe('decide_for_me')
    expect(s.result?.confidenceLabel).toBe('Best guess')
    expect(s.result?.swipes).toBe(0)
  })

  it('"Not quite" resumes once, then offers a pick-list', () => {
    let s = soloReducer(start(), { type: 'decide' })
    const firstHero = s.result!.hero.archetypeId
    s = soloReducer(s, { type: 'not_quite' })
    expect(s.result).toBeNull()
    expect(s.current).not.toBeNull()
    expect(s.excluded.has(firstHero)).toBe(true)
    s = soloReducer(s, { type: 'decide' })
    expect(s.result!.hero.archetypeId).not.toBe(firstHero)
    s = soloReducer(s, { type: 'not_quite' })
    expect(s.result?.stopReason).toBe('pick_list')
    expect(s.result?.pickList).toHaveLength(C.pickListSize)
  })

  it('ignores events that make no sense in the current state', () => {
    const done = soloReducer(start(), { type: 'decide' })
    expect(soloReducer(done, { type: 'swipe', verdict: 'yes' })).toBe(done)
    expect(soloReducer(start(), { type: 'not_quite' }).events).toEqual([])
  })

  it('the narrowing counter never goes up', () => {
    const s = run(start({ moods: ['fresh'], intent: 'normal' }), (st) => ({
      type: 'swipe',
      verdict: archetypeOf(st, st.current!.archetypeId).axes.richness <= 1 ? 'yes' : 'no',
    }))
    const shown: number[] = []
    let t = start({ moods: ['fresh'], intent: 'normal' })
    for (const e of s.events) {
      t = soloReducer(t, e)
      shown.push(t.counter.shown)
    }
    for (let i = 1; i < shown.length; i++) expect(shown[i]!).toBeLessThanOrEqual(shown[i - 1]!)
  })
})

describe('solo session: silent pivot (rev. 2, MVP_SPEC §10.3)', () => {
  it('fires after 3 consecutive Narrow NOPEs, at most twice, with a 3-card flatten and an anchor', () => {
    let s = start()
    let pivotSeenAt = -1
    while (!s.result) {
      const before = s.pivot.used
      s = soloReducer(s, allNo())
      if (s.pivot.used > before && pivotSeenAt < 0) {
        pivotSeenAt = s.swipes.length
        const narrowNos = s.swipes.filter((r) => r.card.phase === 'narrow' && r.verdict === 'no').length
        expect(narrowNos).toBe(3)
        expect(s.pivot.flattenRemaining).toBe(3)
        if (s.current) expect(s.current.slot).toBe('anchor')
      }
    }
    expect(s.pivot.used).toBe(C.maxPivots)
    expect(pivotSeenAt).toBeGreaterThan(0)
  })

  it('never fires on probe NOPEs alone', () => {
    let s = start({ moods: [], intent: 'no_idea' }) // 5 probe cards
    for (let i = 0; i < 5; i++) s = soloReducer(s, allNo())
    expect(s.swipes.every((r) => r.card.phase === 'probe')).toBe(true)
    expect(s.pivot.used).toBe(0)
  })

  it('halves craving priors but never touches the user\'s settings', () => {
    let s = start({ moods: ['comforting'], intent: 'normal' }, { diet: ['no_pork'], fulfilment: 'delivery' })
    const before = view(s.profile, 'mood:comforting', C.gamma).cravingPos
    while (s.pivot.used === 0 && !s.result) s = soloReducer(s, allNo())
    expect(view(s.profile, 'mood:comforting', C.gamma).cravingPos).toBeCloseTo(before * C.pivotCravingFactor)
    expect(s.pivot.used).toBeGreaterThan(0)
    expect(s.model.context.diet).toEqual(['no_pork'])
    expect(s.model.context.fulfilment).toBe('delivery')
  })
})

describe('solo session: craving respect and hard constraints', () => {
  it('at least 2 of the first 3 cards match a chosen mood', () => {
    for (const mood of ['spicy', 'fresh', 'warm_soupy', 'carby'] as const) {
      for (const seed of [1, 2, 3]) {
        let s = start({ moods: [mood], intent: 'normal' }, {}, seed)
        for (let i = 0; i < 3; i++) s = soloReducer(s, allNo())
        const matched = s.swipes.filter((r) => matchesMood(archetypeOf(s, r.card.archetypeId), mood)).length
        expect(matched, `${mood}/${seed}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('property: no card, hero, runner-up or alternative ever violates the diet', () => {
    fc.assert(
      fc.property(
        fc.subarray([...DIET_CONSTRAINTS], { minLength: 1 }),
        fc.array(fc.boolean(), { minLength: 15, maxLength: 15 }),
        fc.integer({ min: 1, max: 1000 }),
        (diet, answers, seed) => {
          let s = start({ moods: [], intent: 'normal' }, { diet }, seed)
          if (s.model.pool.archetypeIds.length === 0) return
          let i = 0
          while (!s.result && i < answers.length) s = soloReducer(s, { type: 'swipe', verdict: answers[i++] ? 'yes' : 'no' })
          if (!s.result) s = soloReducer(s, { type: 'decide' })
          const offerings = [
            ...s.swipes.map((r) => r.card.offeringId),
            s.result!.hero.offeringId,
            ...s.result!.runnersUp.map((r) => r.offeringId),
            ...s.result!.alsoAt,
          ]
          for (const id of offerings) {
            const o = MOCK_CATALOGUE.offerings.find((x) => x.id === id)!
            const a = MOCK_CATALOGUE.archetypes.find((x) => x.id === o.archetypeId)!
            expect(satisfiesDiet(effectiveDietary(a.dietary, o.overrides?.dietary), diet)).toBe(true)
          }
        },
      ),
      { numRuns: 25 },
    )
  })
})
