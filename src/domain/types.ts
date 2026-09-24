import type { z } from 'zod'
import type {
  CatalogueSchema,
  DietaryFactsSchema,
  DishArchetypeSchema,
  GeoPointSchema,
  HandoffTargetSchema,
  ImageRefSchema,
  OfferingOverridesSchema,
  OfferingSchema,
  VenueSchema,
} from './schemas'
import type { Budget, DietConstraint, Fulfilment, Intent, Mood } from './taxonomy'

// ── Catalogue entities (inferred from the schemas) ─────────────────────────
export type GeoPoint = z.infer<typeof GeoPointSchema>
export type DietaryFacts = z.infer<typeof DietaryFactsSchema>
export type ImageRef = z.infer<typeof ImageRefSchema>
export type HandoffTarget = z.infer<typeof HandoffTargetSchema>
/** WHAT someone wants to eat. */
export type DishArchetype = z.infer<typeof DishArchetypeSchema>
/** WHERE: a fictional venue. */
export type Venue = z.infer<typeof VenueSchema>
export type OfferingOverrides = z.infer<typeof OfferingOverridesSchema>
/** A venue's version of an archetype: what appears on a card. */
export type Offering = z.infer<typeof OfferingSchema>
export type Catalogue = z.infer<typeof CatalogueSchema>

export type ArchetypeId = DishArchetype['id']
export type VenueId = Venue['id']
export type OfferingId = Offering['id']

// ── Session inputs ─────────────────────────────────────────────────────────
export interface SessionContext {
  origin: GeoPoint
  /** Injected; the engine never reads the clock. Local wall-clock minutes are taken from this. */
  now: Date
  fulfilment: Fulfilment
  budget: Budget
  diet: readonly DietConstraint[]
}

export interface CravingSelection {
  moods: readonly Mood[]
  intent: Intent
}

// ── Session events ─────────────────────────────────────────────────────────
/** super_yes = "That's the one" (solo) / "Love this" (group). */
export type Verdict = 'yes' | 'no' | 'super_yes'

export interface SwipeEvent {
  cardIndex: number
  archetypeId: ArchetypeId
  offeringId: OfferingId
  verdict: Verdict
}
