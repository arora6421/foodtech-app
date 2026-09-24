import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { DEFAULT_CONFIG as C, withConfig } from '../config'
import type { FeatureVector } from '../features/featurize'
import {
  applySwipe,
  confidence,
  emptyProfile,
  nopeBlame,
  pref,
  scaleCravingPriors,
  swipeConfidence,
  view,
  withPriors,
} from './profile'
import type { Profile } from './profile'

const vec = (entries: Record<string, number>): FeatureVector => new Map(Object.entries(entries))
const CHICKEN_SALAD = vec({ 'protein:chicken': 0.8, 'format:salad_bowl': 1, 'mood:fresh': 0.6, 'rich:0': 0.5 })
const CHICKEN_CURRY = vec({ 'protein:chicken': 0.8, 'format:curry_stew': 1, 'mood:comforting': 0.6, 'rich:3': 0.5 })

const swipes = (p: Profile, v: FeatureVector, kind: 'yes' | 'no', times: number, config = C) => {
  for (let i = 0; i < times; i++) p = applySwipe(p, v, kind, config)
  return p
}

describe('pref / confidence', () => {
  it('are 0 with no evidence and shrink towards 0 with little evidence', () => {
    const p = emptyProfile()
    expect(pref(p, 'x', C)).toBe(0)
    expect(confidence(p, 'x', C)).toBe(0)
    const one = applySwipe(p, vec({ x: 1 }), 'yes', C)
    expect(pref(one, 'x', C)).toBeCloseTo(1 / 3)
    expect(confidence(one, 'x', C)).toBeCloseTo(1 / 3)
  })
})

describe('recency decay (rev. 2)', () => {
  it('matches the closed form w_t = γ^(N − t)', () => {
    const N = 12
    const p = swipes(emptyProfile(), vec({ x: 1 }), 'yes', N)
    let expected = 0
    for (let t = 1; t <= N; t++) expected += C.gamma ** (N - t)
    expect(view(p, 'x', C.gamma).swipePos).toBeCloseTo(expected, 10)
  })

  it('decays earlier evidence when later, unrelated swipes happen', () => {
    let p = applySwipe(emptyProfile(), vec({ x: 1 }), 'yes', C)
    p = swipes(p, vec({ y: 1 }), 'yes', 9)
    expect(view(p, 'x', C.gamma).swipePos).toBeCloseTo(C.gamma ** 9, 10)
  })

  it('never decays priors or raw counts', () => {
    let p = withPriors(emptyProfile(), { moods: ['comforting'], intent: 'normal' }, C)
    p = swipes(p, vec({ 'mood:comforting': 0.6 }), 'yes', 10)
    const v = view(p, 'mood:comforting', C.gamma)
    expect(v.priorPos).toBe(1.5)
    expect(v.yesSeen).toBe(10)
  })

  it('γ = 1 disables decay', () => {
    const noDecay = withConfig({ gamma: 1 })
    const p = swipes(emptyProfile(), vec({ x: 1 }), 'yes', 5, noDecay)
    expect(view(p, 'x', 1).swipePos).toBeCloseTo(5)
  })
})

describe('NOPE blame allocation (rev. 2)', () => {
  it('on a fresh profile, blame is proportional to salience and sums to η_no · Σs', () => {
    const blame = nopeBlame(emptyProfile(), CHICKEN_SALAD, C.etaNo, C)
    const total = [...blame.values()].reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(C.etaNo * (0.8 + 1 + 0.6 + 0.5))
    expect(blame.get('format:salad_bowl')! / blame.get('rich:0')!).toBeCloseTo(1 / 0.5)
  })

  it('shields a confidently liked feature on its first NOPE and lifts the shield on the second', () => {
    let p = swipes(emptyProfile(), CHICKEN_CURRY, 'yes', 3)
    expect(pref(p, 'protein:chicken', C)).toBeGreaterThan(0.5)
    expect(nopeBlame(p, CHICKEN_SALAD, C.etaNo, C).has('protein:chicken')).toBe(false)

    p = applySwipe(p, CHICKEN_SALAD, 'no', C)
    expect(view(p, 'protein:chicken', C.gamma).noSeen).toBe(1)
    expect(view(p, 'protein:chicken', C.gamma).swipeNeg).toBe(0) // no blame the first time

    const second = nopeBlame(p, CHICKEN_SALAD, C.etaNo, C)
    expect(second.get('protein:chicken')).toBeGreaterThan(0)
  })

  it('gives a well-evidenced feature much less blame than an unseen one', () => {
    const p = swipes(emptyProfile(), vec({ a: 1 }), 'no', 8) // 'a' is confidently disliked (confidence ≈ 0.67)
    const blame = nopeBlame(p, vec({ a: 1, b: 1 }), C.etaNo, C)
    expect(blame.get('a')! * 2).toBeLessThan(blame.get('b')!)
  })

  it('caps any single feature at 2 × η_no · s_f', () => {
    const p = swipes(emptyProfile(), vec({ a: 1, b: 1, c: 1 }), 'yes', 4) // a, b, c shielded
    const blame = nopeBlame(p, vec({ a: 1, b: 1, c: 1, d: 0.5 }), C.etaNo, C)
    expect(blame.get('d')).toBeCloseTo(2 * C.etaNo * 0.5)
    expect([...blame.keys()]).toEqual(['d'])
  })

  it('records no feature blame when everything is shielded, but still counts the NOPE', () => {
    let p = swipes(emptyProfile(), vec({ a: 1 }), 'yes', 4)
    expect(nopeBlame(p, vec({ a: 1 }), C.etaNo, C).size).toBe(0)
    p = applySwipe(p, vec({ a: 1 }), 'no', C)
    expect(view(p, 'a', C.gamma).noSeen).toBe(1)
    expect(view(p, 'a', C.gamma).swipeNeg).toBe(0)
  })

  it('property: blame is non-negative and never exceeds η_no · Σs', () => {
    const arbVec = fc.dictionary(fc.constantFrom('a', 'b', 'c', 'd', 'e'), fc.double({ min: 0.1, max: 1, noNaN: true }), {
      minKeys: 1,
    })
    const arbHistory = fc.array(fc.tuple(arbVec, fc.boolean()), { maxLength: 8 })
    fc.assert(
      fc.property(arbHistory, arbVec, (history, target) => {
        let p = emptyProfile()
        for (const [v, yes] of history) p = applySwipe(p, vec(v), yes ? 'yes' : 'no', C)
        const blame = nopeBlame(p, vec(target), C.etaNo, C)
        const salience = Object.values(target).reduce((a, b) => a + b, 0)
        const total = [...blame.values()].reduce((a, b) => a + b, 0)
        for (const b of blame.values()) expect(b).toBeGreaterThanOrEqual(0)
        expect(total).toBeLessThanOrEqual(C.etaNo * salience + 1e-9)
      }),
    )
  })
})

describe('level spill-over', () => {
  it('YES spills ±1 at 0.4, without touching raw counts', () => {
    const p = applySwipe(emptyProfile(), vec({ 'spice:2': 0.9 }), 'yes', C)
    expect(view(p, 'spice:1', C.gamma).swipePos).toBeCloseTo(0.9 * 0.4)
    expect(view(p, 'spice:3', C.gamma).swipePos).toBeCloseTo(0.9 * 0.4)
    expect(view(p, 'spice:3', C.gamma).yesSeen).toBe(0)
    expect(view(p, 'spice:2', C.gamma).yesSeen).toBe(1)
  })

  it('a spice NOPE spills upwards only, scaled by the blame the level received', () => {
    const p0 = emptyProfile()
    const v = vec({ 'spice:3': 0.9 })
    const b = nopeBlame(p0, v, C.etaNo, C).get('spice:3')!
    const p = applySwipe(p0, v, 'no', C)
    expect(view(p, 'spice:4', C.gamma).swipeNeg).toBeCloseTo(b * 0.6)
    expect(view(p, 'spice:2', C.gamma).swipeNeg).toBe(0)
  })

  it('a richness NOPE spills ±1 at 0.3', () => {
    const p0 = emptyProfile()
    const v = vec({ 'rich:2': 0.5 })
    const b = nopeBlame(p0, v, C.etaNo, C).get('rich:2')!
    const p = applySwipe(p0, v, 'no', C)
    expect(view(p, 'rich:1', C.gamma).swipeNeg).toBeCloseTo(b * 0.3)
    expect(view(p, 'rich:3', C.gamma).swipeNeg).toBeCloseTo(b * 0.3)
  })
})

describe('priors', () => {
  it('adds craving priors, and none for "no idea"', () => {
    const spicy = withPriors(emptyProfile(), { moods: ['spicy'], intent: 'normal' }, C)
    expect(pref(spicy, 'spice:3', C)).toBeGreaterThan(0)
    expect(pref(spicy, 'spice:0', C)).toBeLessThan(0)
    const noIdea = withPriors(emptyProfile(), { moods: ['spicy'], intent: 'no_idea' }, C)
    expect(noIdea.features.size).toBe(0)
  })

  it('keeps intent priors separate from craving priors', () => {
    const p = withPriors(emptyProfile(), { moods: [], intent: 'something_new' }, C)
    expect(view(p, 'adv:3', C.gamma).cravingPos).toBe(0)
    expect(view(p, 'adv:3', C.gamma).priorPos).toBe(1)
  })

  it('scaleCravingPriors halves craving evidence only', () => {
    let p = withPriors(emptyProfile(), { moods: ['comforting'], intent: 'something_new' }, C)
    p = scaleCravingPriors(p, 0.5)
    expect(view(p, 'mood:comforting', C.gamma).priorPos).toBeCloseTo(0.75)
    expect(view(p, 'adv:3', C.gamma).priorPos).toBe(1)
  })

  it('swipeConfidence ignores priors', () => {
    const p = withPriors(emptyProfile(), { moods: ['comforting'], intent: 'normal' }, C)
    expect(confidence(p, 'mood:comforting', C)).toBeGreaterThan(0)
    expect(swipeConfidence(p, 'mood:comforting', C)).toBe(0)
  })
})
