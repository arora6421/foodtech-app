import { describe, expect, it } from 'vitest'
import { distanceMiles } from '../domain'
import { ANGEL_N1 } from '../location/LocationProvider'
import { MINIMAL_PAIRS } from './mock/archetypes'
import { MOCK_CATALOGUE, MockCatalog } from './mock/MockCatalog'
import { validateCatalogue } from './validateCatalogue'

const { errors, stats } = validateCatalogue(MOCK_CATALOGUE, ANGEL_N1)

describe('mock catalogue: integrity (MVP_SPEC §5.3)', () => {
  it('has no integrity errors', () => {
    expect(errors).toEqual([])
  })

  it('loads through the repository with schema validation', async () => {
    const catalogue = await new MockCatalog().getCatalogue()
    expect(catalogue.archetypes.length).toBe(MOCK_CATALOGUE.archetypes.length)
  })

  it('every archetype is reachable within the default "Either" radius (3 miles)', () => {
    const venues = new Map(MOCK_CATALOGUE.venues.map((v) => [v.id, v]))
    for (const a of MOCK_CATALOGUE.archetypes) {
      const reachable = MOCK_CATALOGUE.offerings.some(
        (o) => o.archetypeId === a.id && distanceMiles(ANGEL_N1, venues.get(o.venueId)!.location) <= 3.0,
      )
      expect(reachable, a.id).toBe(true)
    }
  })

  it('every minimal-pair set references real archetypes of the same kind', () => {
    const ids = new Set(MOCK_CATALOGUE.archetypes.map((a) => a.id))
    expect(MINIMAL_PAIRS.length).toBeGreaterThanOrEqual(12)
    for (const set of MINIMAL_PAIRS) for (const id of set.ids) expect(ids, `${set.dimension}: ${id}`).toContain(id)
  })
})

describe('mock catalogue: coverage (MVP_SPEC §13.1)', () => {
  it('has roughly the specified size', () => {
    expect(stats.archetypes).toBeGreaterThanOrEqual(72)
    expect(stats.venues).toBeGreaterThanOrEqual(34)
    expect(stats.offerings).toBeGreaterThanOrEqual(130)
  })

  it('covers all 16 cuisines with ≥ 3 archetypes each', () => {
    for (const [cuisine, n] of Object.entries(stats.archetypesPerCuisine)) expect(n, cuisine).toBeGreaterThanOrEqual(3)
  })

  it('meets dietary coverage', () => {
    expect(stats.share.vegetarian).toBeGreaterThanOrEqual(0.25)
    expect(stats.share.vegan).toBeGreaterThanOrEqual(0.12)
    expect(stats.share.porkFree).toBeGreaterThanOrEqual(0.75)
    expect(stats.share.glutenFreeOfferings).toBeGreaterThanOrEqual(0.15)
  })

  it('spreads spice and richness: each level ≥ 10% of archetypes', () => {
    for (const n of stats.spiceLevels) expect(n / stats.archetypes).toBeGreaterThanOrEqual(0.1)
    for (const n of stats.richnessLevels) expect(n / stats.archetypes).toBeGreaterThanOrEqual(0.1)
  })

  it('has enough adventurous dishes and mood coverage', () => {
    expect(stats.share.adventurous).toBeGreaterThanOrEqual(0.15)
    for (const [mood, n] of Object.entries(stats.moodCounts)) expect(n, mood).toBeGreaterThanOrEqual(8)
    expect(stats.desserts).toBeGreaterThanOrEqual(5)
    expect(stats.breakfasts).toBeGreaterThanOrEqual(5)
  })

  it('spreads prices across the budget bands', () => {
    expect(stats.share.offeringsUnder10).toBeGreaterThanOrEqual(0.2)
    expect(stats.share.offeringsOver16).toBeGreaterThanOrEqual(0.15)
  })

  it('spreads venues by distance and service type', () => {
    expect(stats.share.venuesWithin1Mile).toBeGreaterThanOrEqual(0.3)
    expect(stats.share.venuesBetween1And2_5).toBeGreaterThanOrEqual(0.3)
    expect(stats.share.venuesBeyond2_5).toBeGreaterThanOrEqual(0.12)
    expect(stats.share.venuesWithoutDelivery).toBeGreaterThanOrEqual(0.15)
    expect(stats.share.venuesWithoutDineIn).toBeGreaterThanOrEqual(0.15)
  })
})
