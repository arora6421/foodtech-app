import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { SessionContext } from '../../domain'
import { MOCK_CATALOGUE } from '../../catalog/mock/MockCatalog'
import { ANGEL_N1 } from '../../location/LocationProvider'
import { DEFAULT_CONFIG as C, withConfig } from '../config'
import { buildPool } from '../context/pool'
import { applySwipe, emptyProfile, pref } from '../profile/profile'
import { belief, bestOffering, finalRank, rankArchetypes, shortlist, taste, topMass } from './scoring'

const ctx: SessionContext = {
  origin: ANGEL_N1,
  now: new Date('2026-09-24T19:30:00Z'),
  fulfilment: 'either',
  budget: 'any',
  diet: [],
}
const pool = buildPool(MOCK_CATALOGUE, ctx, { moods: [], intent: 'normal' }, C)
const vectorOf = (id: string) => pool.baseVectors.get(id)!

describe('taste', () => {
  it('is 0 for an empty profile and stays within (−1, 1)', () => {
    expect(taste(emptyProfile(), vectorOf('bibimbap'), C)).toBe(0)
    let p = emptyProfile()
    for (let i = 0; i < 20; i++) p = applySwipe(p, vectorOf('bibimbap'), 'yes', C)
    const t = taste(p, vectorOf('bibimbap'), C)
    // With decay, evidence plateaus at s/(1−γ), so low-salience features cap near 0.6.
    expect(t).toBeGreaterThan(0.6)
    expect(t).toBeLessThan(1)
  })

  it('generalises: a YES on Korean fried chicken lifts karaage more than a salad', () => {
    const p = applySwipe(emptyProfile(), vectorOf('korean-fried-chicken'), 'yes', C)
    expect(taste(p, vectorOf('chicken-karaage'), C)).toBeGreaterThan(taste(p, vectorOf('greek-salad'), C))
  })

  it('learns a spice ceiling: loves spice 3, rejects spice 4', () => {
    let p = emptyProfile()
    for (const id of ['korean-fried-chicken', 'dan-dan-noodles', 'jerk-chicken']) p = applySwipe(p, vectorOf(id), 'yes', C)
    for (const id of ['buldak-noodles', 'lamb-vindaloo']) p = applySwipe(p, vectorOf(id), 'no', C)
    expect(pref(p, 'spice:3', C)).toBeGreaterThan(pref(p, 'spice:4', C))
    expect(pref(p, 'spice:3', C)).toBeGreaterThan(0.3)
  })
})

describe('belief', () => {
  it('is uniform with equal tastes and sums to 1', () => {
    const b = belief(['a', 'b', 'c', 'd'], [0, 0, 0, 0], C.beta)
    expect(b.probs).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(b.entropy).toBeCloseTo(Math.log(4))
  })
  it('property: probabilities sum to 1 and entropy is within [0, ln n]', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 1, maxLength: 50 }), (tastes) => {
        const ids = tastes.map((_, i) => `a${i}`)
        const b = belief(ids, tastes, C.beta)
        expect(b.probs.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9)
        expect(b.entropy).toBeGreaterThanOrEqual(-1e-12)
        expect(b.entropy).toBeLessThanOrEqual(Math.log(tastes.length) + 1e-9)
      }),
    )
  })
  it('topMass sums the k largest', () => {
    const b = belief(['a', 'b', 'c'], [1, 0, -1], 1)
    expect(topMass(b, 3)).toBeCloseTo(1)
    expect(topMass(b, 1)).toBeCloseTo(Math.max(...b.probs))
  })
})

describe('bestOffering / finalRank', () => {
  it('prefers the nearer, in-budget offering when taste is equal', () => {
    const choice = bestOffering(emptyProfile(), pool, 'butter-chicken', ctx, C)
    const options = pool.byArchetype.get('butter-chicken')!
    const nearest = [...options].sort((a, b) => a.distanceMiles - b.distanceMiles)[0]!
    expect(choice.candidate.offering.id).toBe(nearest.offering.id)
  })

  it('picks the extra-hot version for someone who loves heat, distance held equal', () => {
    let p = emptyProfile()
    for (const id of ['buldak-noodles', 'lamb-vindaloo', 'nashville-hot-chicken']) p = applySwipe(p, vectorOf(id), 'yes', C)
    const noWhere = withConfig({ wDistance: { go_out: 0, either: 0, delivery: 0 } })
    const choice = bestOffering(p, pool, 'korean-fried-chicken', ctx, noWhere)
    expect(choice.candidate.vector.has('spice:4')).toBe(true)
  })

  it('breaks down into contributions that sum to taste', () => {
    const p = applySwipe(emptyProfile(), vectorOf('bibimbap'), 'yes', C)
    const b = finalRank(p, pool, 'bulgogi', ctx, C)
    const sum = b.contributions.reduce((a, c) => a + c.value, 0)
    expect(sum).toBeCloseTo(b.taste, 10)
    expect(b.finalRank).toBeCloseTo(b.taste + C.wPrice * b.priceFit + C.wDistance.either * b.distanceFit, 10)
  })

  it('is deterministic, with ties broken by id', () => {
    const a = rankArchetypes(emptyProfile(), pool, pool.archetypeIds, ctx, C).map((s) => s.archetypeId)
    const b = rankArchetypes(emptyProfile(), pool, [...pool.archetypeIds].reverse(), ctx, C).map((s) => s.archetypeId)
    expect(a).toEqual(b)
  })
})

describe('shortlist', () => {
  it('rejects a runner-up with the same format and family as the hero', () => {
    let p = emptyProfile()
    for (let i = 0; i < 3; i++) p = applySwipe(p, vectorOf('korean-fried-chicken'), 'yes', C)
    const ranked = rankArchetypes(p, pool, pool.archetypeIds, ctx, C)
    const list = shortlist(ranked, pool, 2)
    expect(list).toHaveLength(3)
    expect(list[0]!.archetypeId).toBe('korean-fried-chicken')
    const heroKey = ['protein_plate', 'east_asian']
    for (const r of list.slice(1)) {
      const a = pool.archetypes.get(r.archetypeId)!
      expect([a.format, a.cuisine === 'japanese' || a.cuisine === 'korean' || a.cuisine === 'chinese' ? 'east_asian' : 'x']).not.toEqual(heroKey)
    }
  })
})
