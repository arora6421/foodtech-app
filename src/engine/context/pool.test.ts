import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { DIET_CONSTRAINTS, effectiveDietary, satisfiesDiet } from '../../domain'
import type { SessionContext } from '../../domain'
import { MOCK_CATALOGUE } from '../../catalog/mock/MockCatalog'
import { ANGEL_N1 } from '../../location/LocationProvider'
import { DEFAULT_CONFIG as C } from '../config'
import { buildPool, distanceFit, localMinutes, priceFit } from './pool'

const EVENING = new Date('2026-09-24T19:30:00Z') // 20:30 BST
const MORNING = new Date('2026-09-24T08:00:00Z') // 09:00 BST

const ctx = (over: Partial<SessionContext> = {}): SessionContext => ({
  origin: ANGEL_N1,
  now: EVENING,
  fulfilment: 'either',
  budget: 'any',
  diet: [],
  ...over,
})
const normal = { moods: [], intent: 'normal' as const }

describe('localMinutes', () => {
  it('uses Europe/London wall-clock time regardless of the runtime zone', () => {
    expect(localMinutes(EVENING, 'Europe/London')).toBe(20 * 60 + 30)
    expect(localMinutes(new Date('2026-01-15T08:00:00Z'), 'Europe/London')).toBe(8 * 60) // GMT in winter
  })
})

describe('buildPool: hard eligibility (MVP_SPEC §8.2)', () => {
  it('property: no candidate ever violates the selected diet', () => {
    fc.assert(
      fc.property(fc.subarray([...DIET_CONSTRAINTS]), (diet) => {
        const pool = buildPool(MOCK_CATALOGUE, ctx({ diet }), normal, C)
        for (const c of pool.candidates) {
          expect(satisfiesDiet(effectiveDietary(c.archetype.dietary, c.offering.overrides?.dietary), diet)).toBe(true)
        }
      }),
      { numRuns: 40 },
    )
  })

  it('respects fulfilment and distance limits', () => {
    const goOut = buildPool(MOCK_CATALOGUE, ctx({ fulfilment: 'go_out' }), normal, C)
    expect(goOut.candidates.length).toBeGreaterThan(0)
    for (const c of goOut.candidates) {
      expect(c.venue.dineIn).toBe(true)
      expect(c.distanceMiles).toBeLessThanOrEqual(1.5)
    }
    const delivery = buildPool(MOCK_CATALOGUE, ctx({ fulfilment: 'delivery' }), normal, C)
    for (const c of delivery.candidates) {
      expect(c.venue.offersDelivery).toBe(true)
      expect(c.distanceMiles).toBeLessThanOrEqual(4.0)
    }
  })

  it('caps price at 1.3 × the budget ceiling', () => {
    const low = buildPool(MOCK_CATALOGUE, ctx({ budget: 'low' }), normal, C)
    for (const c of low.candidates) expect(c.offering.pricePence).toBeLessThanOrEqual(1300)
  })

  it('only shows desserts when the craving includes sweet', () => {
    const plain = buildPool(MOCK_CATALOGUE, ctx(), normal, C)
    expect(plain.candidates.some((c) => c.archetype.mealType === 'dessert')).toBe(false)
    const sweet = buildPool(MOCK_CATALOGUE, ctx(), { moods: ['sweet'], intent: 'normal' }, C)
    expect(sweet.candidates.some((c) => c.archetype.mealType === 'dessert')).toBe(true)
  })

  it('only shows breakfast dishes in the morning window', () => {
    const evening = buildPool(MOCK_CATALOGUE, ctx(), normal, C)
    expect(evening.candidates.some((c) => c.archetype.mealType === 'breakfast')).toBe(false)
    const morning = buildPool(MOCK_CATALOGUE, ctx({ now: MORNING }), normal, C)
    expect(morning.candidates.some((c) => c.archetype.mealType === 'breakfast')).toBe(true)
  })

  it('groups candidates by archetype in stable id order', () => {
    const pool = buildPool(MOCK_CATALOGUE, ctx(), normal, C)
    expect([...pool.archetypeIds]).toEqual([...pool.archetypeIds].sort())
    for (const id of pool.archetypeIds) expect(pool.byArchetype.get(id)!.length).toBeGreaterThan(0)
    expect(pool.archetypeIds.length).toBeGreaterThan(60)
  })

  it('applies offering axis overrides to the card vector', () => {
    const pool = buildPool(MOCK_CATALOGUE, ctx(), normal, C)
    const wings = pool.candidates.find((c) => c.offering.name === 'Seoul Fire Wings')!
    expect(wings.vector.has('spice:4')).toBe(true)
    expect(pool.baseVectors.get('korean-fried-chicken')!.has('spice:3')).toBe(true)
  })
})

describe('fits (MVP_SPEC §8.5)', () => {
  it('priceFit is 0 within budget, then falls to -1 across the soft band', () => {
    const mid = ctx({ budget: 'mid' })
    expect(priceFit(1500, mid, C)).toBe(0)
    expect(priceFit(1600, mid, C)).toBe(0)
    expect(priceFit(1600 + 0.15 * 1600, mid, C)).toBeCloseTo(-0.5)
    expect(priceFit(4000, mid, C)).toBe(-1)
    expect(priceFit(4000, ctx(), C)).toBe(0)
  })
  it('distanceFit is quadratic in the share of the max distance', () => {
    expect(distanceFit(0, ctx(), C)).toBeCloseTo(0)
    expect(distanceFit(1.5, ctx(), C)).toBeCloseTo(-0.25) // either: max 3.0
    expect(distanceFit(1.5, ctx({ fulfilment: 'go_out' }), C)).toBeCloseTo(-1)
  })
})
