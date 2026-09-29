import { AXES, CUISINES, LEVELS, MOOD_TAGS, CatalogueSchema, dietaryIssues, distanceMiles, effectiveDietary } from '../domain'
import type { Catalogue, GeoPoint, MoodTag } from '../domain'
import { allergenIssues, contentIssues } from './dietaryContent'

// Integrity and coverage checks for any catalogue (MVP_SPEC §5.3, §13.1).
// Integrity problems are errors; coverage is reported as numbers so tests can gate on them.

export interface CoverageStats {
  archetypes: number
  venues: number
  offerings: number
  archetypesPerCuisine: Record<string, number>
  share: {
    vegetarian: number
    vegan: number
    porkFree: number
    glutenFreeOfferings: number
    adventurous: number // adventurousness 3–4
    offeringsUnder10: number
    offeringsOver16: number
    venuesWithin1Mile: number
    venuesBetween1And2_5: number
    venuesBeyond2_5: number
    venuesWithoutDelivery: number
    venuesWithoutDineIn: number
  }
  spiceLevels: number[]
  richnessLevels: number[]
  moodCounts: Record<MoodTag, number>
  desserts: number
  breakfasts: number
}

export interface ValidationResult {
  errors: string[]
  stats: CoverageStats
}

export function validateCatalogue(catalogue: Catalogue, origin: GeoPoint): ValidationResult {
  const errors: string[] = []
  const parsed = CatalogueSchema.safeParse(catalogue)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`schema: ${issue.path.join('.')}: ${issue.message}`)
  }
  const { archetypes, venues, offerings } = catalogue

  const dupes = (ids: string[], kind: string) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) errors.push(`duplicate ${kind} id: ${id}`)
      seen.add(id)
    }
  }
  dupes(archetypes.map((a) => a.id), 'archetype')
  dupes(venues.map((v) => v.id), 'venue')
  dupes(offerings.map((o) => o.id), 'offering')
  dupes(venues.map((v) => v.name), 'venue name')

  const archetypeById = new Map(archetypes.map((a) => [a.id, a]))
  const venueById = new Map(venues.map((v) => [v.id, v]))

  for (const o of offerings) {
    const a = archetypeById.get(o.archetypeId)
    if (!a) errors.push(`offering ${o.id}: unknown archetype ${o.archetypeId}`)
    if (!venueById.has(o.venueId)) errors.push(`offering ${o.id}: unknown venue ${o.venueId}`)
    if (!a) continue
    for (const axis of AXES) {
      const override = o.overrides?.axes?.[axis]
      if (override !== undefined && Math.abs(override - a.axes[axis]) > 1) {
        errors.push(`offering ${o.id}: ${axis} override moves more than ±1`)
      }
    }
    for (const issue of dietaryIssues(effectiveDietary(a.dietary, o.overrides?.dietary), a.proteins)) {
      errors.push(`offering ${o.id}: effective dietary: ${issue}`)
    }
    // Flags against what the dish is said to contain (ingredients, name, description, allergens).
    const effective = effectiveDietary(a.dietary, o.overrides?.dietary)
    const dish = { archetypeName: a.name, keyIngredients: a.keyIngredients, offeringName: o.name, offeringDescription: o.description }
    for (const issue of contentIssues(effective, dish)) errors.push(`offering ${o.id}: ${issue}`)
    for (const issue of allergenIssues(effective, o.overrides?.declaredAllergens ?? a.declaredAllergens ?? [])) errors.push(`offering ${o.id}: ${issue}`)
  }

  const offeredArchetypes = new Set(offerings.map((o) => o.archetypeId))
  for (const a of archetypes) {
    if (!offeredArchetypes.has(a.id)) errors.push(`archetype ${a.id} has no offering`)
    // Mood curation rules (docs/labelling-rubric.md)
    if (a.moods.includes('fresh') && a.axes.richness >= 3) errors.push(`archetype ${a.id}: fresh but richness ≥ 3`)
    if (a.moods.includes('indulgent') && a.axes.richness <= 1) errors.push(`archetype ${a.id}: indulgent but richness ≤ 1`)
    if (a.moods.includes('warm_soupy') && a.temperature === 'cold') errors.push(`archetype ${a.id}: warm_soupy but cold`)
    if ((a.format === 'dessert') !== (a.mealType === 'dessert')) errors.push(`archetype ${a.id}: dessert format/mealType mismatch`)
    if (a.format === 'breakfast' && a.mealType !== 'breakfast') errors.push(`archetype ${a.id}: breakfast format needs breakfast mealType`)
  }

  for (const v of venues) {
    if (!v.offersDelivery && !v.dineIn) errors.push(`venue ${v.id}: neither delivery nor dine-in`)
    if (!offerings.some((o) => o.venueId === v.id)) errors.push(`venue ${v.id} has no offerings`)
  }

  // ── Coverage ──────────────────────────────────────────────────────────────
  const frac = (n: number, d: number) => (d === 0 ? 0 : n / d)
  const count = <T>(xs: readonly T[], pred: (x: T) => boolean) => xs.filter(pred).length
  const venueDistance = (id: string) => {
    const v = venueById.get(id)
    return v ? distanceMiles(origin, v.location) : Infinity
  }

  const moodCounts = Object.fromEntries(MOOD_TAGS.map((m) => [m, count(archetypes, (a) => a.moods.includes(m))])) as Record<
    MoodTag,
    number
  >
  const archetypesPerCuisine = Object.fromEntries(CUISINES.map((c) => [c, count(archetypes, (a) => a.cuisine === c)]))

  const stats: CoverageStats = {
    archetypes: archetypes.length,
    venues: venues.length,
    offerings: offerings.length,
    archetypesPerCuisine,
    share: {
      vegetarian: frac(count(archetypes, (a) => a.dietary.vegetarian), archetypes.length),
      vegan: frac(count(archetypes, (a) => a.dietary.vegan), archetypes.length),
      porkFree: frac(count(archetypes, (a) => !a.dietary.containsPork), archetypes.length),
      glutenFreeOfferings: frac(
        count(offerings, (o) => {
          const a = archetypeById.get(o.archetypeId)
          return !!a && effectiveDietary(a.dietary, o.overrides?.dietary).glutenFree
        }),
        offerings.length,
      ),
      adventurous: frac(count(archetypes, (a) => a.axes.adventurousness >= 3), archetypes.length),
      offeringsUnder10: frac(count(offerings, (o) => o.pricePence < 1000), offerings.length),
      offeringsOver16: frac(count(offerings, (o) => o.pricePence > 1600), offerings.length),
      venuesWithin1Mile: frac(count(venues, (v) => venueDistance(v.id) <= 1.0), venues.length),
      venuesBetween1And2_5: frac(count(venues, (v) => venueDistance(v.id) > 1.0 && venueDistance(v.id) <= 2.5), venues.length),
      venuesBeyond2_5: frac(count(venues, (v) => venueDistance(v.id) > 2.5), venues.length),
      venuesWithoutDelivery: frac(count(venues, (v) => !v.offersDelivery), venues.length),
      venuesWithoutDineIn: frac(count(venues, (v) => !v.dineIn), venues.length),
    },
    spiceLevels: LEVELS.map((l) => count(archetypes, (a) => a.axes.spice === l)),
    richnessLevels: LEVELS.map((l) => count(archetypes, (a) => a.axes.richness === l)),
    moodCounts,
    desserts: count(archetypes, (a) => a.mealType === 'dessert'),
    breakfasts: count(archetypes, (a) => a.mealType === 'breakfast'),
  }

  return { errors, stats }
}
