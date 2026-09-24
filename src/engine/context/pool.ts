import { distanceMiles, effectiveDietary, satisfiesDiet } from '../../domain'
import type {
  ArchetypeId,
  Catalogue,
  CravingSelection,
  DishArchetype,
  Offering,
  SessionContext,
  Venue,
} from '../../domain'
import type { EngineConfig } from '../config'
import { featurize } from '../features/featurize'
import type { FeatureVector } from '../features/featurize'

// Hard eligibility and the WHERE-side fits (MVP_SPEC §8.2, §8.5).

export interface Candidate {
  offering: Offering
  venue: Venue
  archetype: DishArchetype
  /** Archetype features with this offering's overrides applied. */
  vector: FeatureVector
  distanceMiles: number
  priceFit: number
  distanceFit: number
}

export interface Pool {
  candidates: readonly Candidate[]
  byArchetype: ReadonlyMap<ArchetypeId, readonly Candidate[]>
  /** Eligible archetype ids, sorted: the stable order every tie-break falls back to. */
  archetypeIds: readonly ArchetypeId[]
  archetypes: ReadonlyMap<ArchetypeId, DishArchetype>
  baseVectors: ReadonlyMap<ArchetypeId, FeatureVector>
}

export type Ineligibility = 'diet' | 'fulfilment' | 'distance' | 'budget' | 'meal_time' | 'dessert'

/** Minutes past midnight in the configured time zone. Pure: depends only on the injected date. */
export function localMinutes(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {})
  return Number(parts.hour) * 60 + Number(parts.minute)
}

const minutesMemo = new Map<string, number>()
function cachedMinutes(now: Date, timeZone: string): number {
  const key = now.getTime() + '|' + timeZone
  let m = minutesMemo.get(key)
  if (m === undefined) {
    m = localMinutes(now, timeZone)
    if (minutesMemo.size > 1000) minutesMemo.clear()
    minutesMemo.set(key, m)
  }
  return m
}

export function budgetCeiling(ctx: SessionContext, config: EngineConfig): number | undefined {
  return ctx.budget === 'any' ? undefined : config.budgetCeilingPence[ctx.budget]
}

export function maxDistance(ctx: SessionContext, config: EngineConfig): number {
  return config.maxDistanceMiles[ctx.fulfilment]
}

export function ineligibility(
  offering: Offering,
  venue: Venue,
  archetype: DishArchetype,
  ctx: SessionContext,
  craving: CravingSelection,
  config: EngineConfig,
): Ineligibility | undefined {
  if (!satisfiesDiet(effectiveDietary(archetype.dietary, offering.overrides?.dietary), ctx.diet)) return 'diet'
  if (ctx.fulfilment === 'delivery' && !venue.offersDelivery) return 'fulfilment'
  if (ctx.fulfilment === 'go_out' && !venue.dineIn) return 'fulfilment'
  if (distanceMiles(ctx.origin, venue.location) > maxDistance(ctx, config)) return 'distance'
  const ceiling = budgetCeiling(ctx, config)
  if (ceiling !== undefined && offering.pricePence > ceiling * config.budgetHardCapMultiple) return 'budget'
  if (archetype.mealType === 'dessert' && !craving.moods.includes('sweet')) return 'dessert'
  if (archetype.mealType === 'breakfast') {
    const m = cachedMinutes(ctx.now, config.timeZone)
    if (m < config.breakfastWindow[0] || m > config.breakfastWindow[1]) return 'meal_time'
  }
  return undefined
}

export function priceFit(pricePence: number, ctx: SessionContext, config: EngineConfig): number {
  const ceiling = budgetCeiling(ctx, config)
  if (ceiling === undefined || pricePence <= ceiling) return 0
  return -Math.min(1, (pricePence - ceiling) / (config.priceSoftBand * ceiling))
}

export function distanceFit(miles: number, ctx: SessionContext, config: EngineConfig): number {
  return -((miles / maxDistance(ctx, config)) ** 2)
}

export function buildPool(
  catalogue: Catalogue,
  ctx: SessionContext,
  craving: CravingSelection,
  config: EngineConfig,
): Pool {
  const archetypes = new Map(catalogue.archetypes.map((a) => [a.id, a]))
  const venues = new Map(catalogue.venues.map((v) => [v.id, v]))
  const candidates: Candidate[] = []
  for (const offering of catalogue.offerings) {
    const archetype = archetypes.get(offering.archetypeId)
    const venue = venues.get(offering.venueId)
    if (!archetype || !venue) continue
    if (ineligibility(offering, venue, archetype, ctx, craving, config)) continue
    const miles = distanceMiles(ctx.origin, venue.location)
    candidates.push({
      offering,
      venue,
      archetype,
      vector: featurize(archetype, config, offering.overrides),
      distanceMiles: miles,
      priceFit: priceFit(offering.pricePence, ctx, config),
      distanceFit: distanceFit(miles, ctx, config),
    })
  }
  candidates.sort((a, b) => (a.offering.id < b.offering.id ? -1 : 1))

  const byArchetype = new Map<ArchetypeId, Candidate[]>()
  for (const c of candidates) {
    const list = byArchetype.get(c.archetype.id) ?? []
    list.push(c)
    byArchetype.set(c.archetype.id, list)
  }
  const archetypeIds = [...byArchetype.keys()].sort()
  const eligibleArchetypes = new Map(archetypeIds.map((id) => [id, archetypes.get(id)!]))
  const baseVectors = new Map(archetypeIds.map((id) => [id, featurize(archetypes.get(id)!, config)]))
  return { candidates, byArchetype, archetypeIds, archetypes: eligibleArchetypes, baseVectors }
}
