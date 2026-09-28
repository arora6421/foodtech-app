import { deliveryMinutes, distanceMiles, walkMinutes } from '../../domain'
import type { DishArchetype, Flavour, Format, Fulfilment, Offering, Texture, Venue } from '../../domain'
import { effectiveAxes } from '../../engine/features/featurize'
import type { Explanation } from '../../engine/explain/explain'
import type { CardChoice, ConfidenceLabel, SoloState, StopReason } from '../../engine/session/types'
import type { LoadedCatalogue } from '../services/catalogueService'
import { explanationFor, nextCards } from '../services/engineAdapter'
import { imageSource, resolveDishImage } from '../services/imageResolver'
import type { ResolvedImage } from '../services/imageResolver'

// View models: the only shapes presentational components receive (m1-spec §2.3). All display
// formatting (prices, distances, times, labels) happens here and nowhere else.

export interface DishCardModel {
  key: string
  archetypeId: string
  offeringId: string
  cardNumber: number | null
  offeringName: string
  archetypeName: string
  /** False when the venue's name for the dish is just the dish name again (e.g. "Chana Masala"). */
  showArchetype: boolean
  cuisineLabel: string
  venueName: string
  priceLabel: string
  timeLabel: string
  distanceLabel: string
  spiceLevel: 0 | 1 | 2 | 3 | 4
  spiceWord: string
  /** The spice level as a tag, e.g. "Mild heat". */
  spiceTag: string
  tags: string[]
  /** Cuisine and format, e.g. "Japanese noodles": the card's top line. */
  kind: string
  /** Up to three key ingredients from the catalogue: the card's "Inside" list. */
  inside: string[]
  tint: string
  /** The dish's photo, or null for the designed no-photo state. */
  image: ResolvedImage | null
  /** Drawn on the no-photo thumbnail: the dish's initial, menu style. */
  initial: string
  allergens: string[]
  a11yLabel: string
}

export interface ReasonModel {
  text: string
  kind: 'swipe' | 'craving' | 'avoided'
}

export type MatchView = { kind: 'match' } | { kind: 'alternative'; archetypeId: string; chosen: boolean }

export interface MatchModel {
  mode: 'match' | 'alternative' | 'chosen-alternative'
  stopReason: StopReason
  confidenceLabel: ConfidenceLabel
  hero: DishCardModel
  headline: string
  reasons: ReasonModel[]
  alsoAt: { venueName: string; offeringName: string; priceLabel: string }[]
  alternatives: DishCardModel[]
  primaryAction: 'order' | 'directions'
  pickList: DishCardModel[] | null
}

/** Progress towards a decision ("Card 4 · a few more"), never a count of what's left: a big
 *  remaining number makes the deck feel like a long list, which the product exists to avoid. */
export interface ProgressModel {
  card: number
  stage: 'more' | 'nearly'
}

const CUISINE_LABEL = (c: string) =>
  c
    .split('_')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
const TEXTURE_WORD: Record<Texture, string> = {
  crispy: 'Crispy',
  crunchy: 'Crunchy',
  saucy: 'Saucy',
  creamy: 'Creamy',
  brothy: 'Brothy',
  chewy: 'Chewy',
}
const FLAVOUR_WORD: Record<Flavour, string> = {
  umami: 'Savoury',
  tangy: 'Tangy',
  sweet: 'Sweet',
  smoky: 'Smoky',
  herby: 'Herby',
  garlicky: 'Garlicky',
  cheesy: 'Cheesy',
  aromatic: 'Warm spice',
}
export const SPICE_WORD = ['No heat', 'Mild', 'Medium', 'Hot', 'Very hot'] as const
export const SPICE_TAG = ['No heat', 'Mild heat', 'Medium heat', 'Hot', 'Very hot'] as const

/** The catalogue format as words, for "Japanese noodles". Where a format covers two kinds of dish,
 *  both are named rather than guessing which this one is. */
const FORMAT_LABEL: Record<Format, string> = {
  noodles: 'noodles',
  rice: 'rice',
  curry_stew: 'curry or stew',
  soup: 'soup',
  burger: 'burger',
  sandwich_wrap: 'sandwich or wrap',
  pizza_flatbread: 'pizza or flatbread',
  pasta: 'pasta',
  tacos_burrito: 'tacos or burrito',
  salad_bowl: 'salad or bowl',
  dumplings_buns: 'dumplings or buns',
  protein_plate: 'grill',
  small_plates: 'small plates',
  pie_bake: 'pie or bake',
  breakfast: 'breakfast',
  dessert: 'dessert',
}

export const priceLabel = (pence: number) => `£${(pence / 100).toFixed(2)}`
export const distanceLabel = (miles: number) => `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`

/** "12 min walk" or "30 min delivery", depending on the eating context and what the venue offers. */
export function timeLabel(venue: Venue, miles: number, fulfilment: Fulfilment): string {
  const walk = `${walkMinutes(miles)} min walk`
  const delivery = `${deliveryMinutes(miles)} min delivery`
  if (fulfilment === 'delivery') return delivery
  if (fulfilment === 'go_out') return walk
  if (venue.dineIn && miles <= 1.5) return walk
  return venue.offersDelivery ? delivery : walk
}

export function tagsFor(a: DishArchetype): string[] {
  return [...a.textures.map((t) => TEXTURE_WORD[t]), ...a.flavours.map((f) => FLAVOUR_WORD[f])].slice(0, 3)
}

const initialOf = (name: string) => [...name.trim()][0]?.toUpperCase() ?? ''

/** Image and initial for a saved dish, resolved afresh so a new image source applies to old saves too. */
export function savedDishArt(
  loaded: LoadedCatalogue | null,
  archetypeId: string,
  offeringId: string,
  name: string,
): { image: ResolvedImage | null; initial: string } {
  const a = loaded?.archetypes.get(archetypeId)
  const o = loaded?.offerings.get(offeringId)
  const v = o ? loaded?.venues.get(o.venueId) : undefined
  return { image: a && o && v ? resolveDishImage(imageSource(), a, o, v) : null, initial: initialOf(name) }
}

/** Image URLs for whichever card comes next (after YES or after NOPE), once the adapter has pre-computed them. */
export function nextCardImages(loaded: LoadedCatalogue, state: SoloState): string[] {
  if (!imageSource().enabled) return []
  const { yes, no } = nextCards(state)
  return [yes, no]
    .filter((c): c is CardChoice => c !== null)
    .map((c) => dishCard(loaded, state, c.archetypeId, c.offeringId, null).image?.src)
    .filter((src): src is string => !!src)
}

export function dishCard(
  loaded: LoadedCatalogue,
  state: SoloState,
  archetypeId: string,
  offeringId: string,
  cardNumber: number | null,
): DishCardModel {
  const a = loaded.archetypes.get(archetypeId)!
  const o: Offering = loaded.offerings.get(offeringId)!
  const v = loaded.venues.get(o.venueId)!
  const miles = distanceMiles(state.model.context.origin, v.location)
  const spice = effectiveAxes(a, o.overrides).spice
  const price = priceLabel(o.pricePence)
  const time = timeLabel(v, miles, state.model.context.fulfilment)
  const dist = distanceLabel(miles)
  const showArchetype = o.name.trim().toLowerCase() !== a.name.trim().toLowerCase()
  const allergens = (o.overrides?.declaredAllergens ?? a.declaredAllergens ?? []).map((x) => x.replace(/_/g, ' '))
  return {
    key: o.id,
    archetypeId: a.id,
    offeringId: o.id,
    cardNumber,
    offeringName: o.name,
    archetypeName: a.name,
    showArchetype,
    cuisineLabel: CUISINE_LABEL(a.cuisine),
    venueName: v.name,
    priceLabel: price,
    timeLabel: time,
    distanceLabel: dist,
    spiceLevel: spice,
    spiceWord: SPICE_WORD[spice],
    spiceTag: SPICE_TAG[spice],
    tags: tagsFor(a),
    kind: `${CUISINE_LABEL(a.cuisine)} ${FORMAT_LABEL[a.format]}`,
    inside: a.keyIngredients.slice(0, 3),
    tint: a.image.dominantColour,
    image: resolveDishImage(imageSource(), a, o, v),
    initial: initialOf(a.name),
    allergens,
    a11yLabel: `${o.name}. ${showArchetype ? `${a.name}, ` : ''}${CUISINE_LABEL(a.cuisine)}. ${v.name}, ${price}, ${time}, ${dist}. Spice ${spice} of 4, ${SPICE_WORD[spice].toLowerCase()}.`,
  }
}

export function currentCard(loaded: LoadedCatalogue, state: SoloState, card: CardChoice): DishCardModel {
  return dishCard(loaded, state, card.archetypeId, card.offeringId, card.cardIndex + 1)
}

/**
 * Read-only use of the engine's own stopping signals (nothing here changes what it does):
 * "nearly there" once a stop is within reach, i.e. past the minimum swipes but one and close to the
 * confidence it needs (the top candidates' combined weight at ≥ 80% of the threshold, with support),
 * or within two cards of the hard maximum. Otherwise "a few more".
 */
export function progressModel(state: SoloState): ProgressModel {
  const { minSwipes, maxSwipes, confidentMass } = state.model.config
  const swiped = state.swipes.length
  const check = state.lastCheck
  const closeToConfident = !!check && check.support && check.topMass3 >= 0.8 * confidentMass
  const nearly = swiped >= maxSwipes - 2 || (swiped >= minSwipes - 1 && closeToConfident)
  return { card: (state.current?.cardIndex ?? swiped) + 1, stage: nearly ? 'nearly' : 'more' }
}

function reasonsFrom(e: Explanation | undefined): ReasonModel[] {
  if (!e) return []
  return [
    ...e.reasons.map((r) => ({
      text: r.text,
      kind: r.evidence.fromCraving ? ('craving' as const) : ('swipe' as const),
    })),
    ...(e.avoided ? [{ text: e.avoided.text, kind: 'avoided' as const }] : []),
  ]
}

/** Other places for the same dish, nearest first (≤ 2). */
function otherVenues(state: SoloState, archetypeId: string, exceptOfferingId: string) {
  return (state.model.pool.byArchetype.get(archetypeId) ?? [])
    .filter((c) => c.offering.id !== exceptOfferingId)
    .sort((x, y) => x.distanceMiles - y.distanceMiles || (x.offering.id < y.offering.id ? -1 : 1))
    .slice(0, 2)
    .map((c) => ({
      venueName: c.venue.name,
      offeringName: c.offering.name,
      priceLabel: priceLabel(c.offering.pricePence),
    }))
}

export function matchModel(loaded: LoadedCatalogue, state: SoloState, view: MatchView): MatchModel | null {
  const r = state.result
  if (!r) return null
  const heroCard = dishCard(loaded, state, r.hero.archetypeId, r.hero.offeringId, null)
  const runners = r.runnersUp.map((x) => dishCard(loaded, state, x.archetypeId, x.offeringId, null))
  const primaryAction = state.model.context.fulfilment === 'go_out' ? 'directions' : 'order'
  const pickList = r.pickList ? r.pickList.map((x) => dishCard(loaded, state, x.archetypeId, x.offeringId, null)) : null

  if (view.kind === 'alternative') {
    const alt =
      runners.find((c) => c.archetypeId === view.archetypeId) ??
      pickList?.find((c) => c.archetypeId === view.archetypeId)
    if (alt) {
      const e = explanationFor(state, alt.archetypeId)
      return {
        mode: view.chosen ? 'chosen-alternative' : 'alternative',
        stopReason: r.stopReason,
        confidenceLabel: r.confidenceLabel,
        hero: alt,
        // The headline describes the session's craving, so it belongs to our match only; it would read as a re-diagnosis here.
        headline: '',
        reasons: reasonsFrom(e),
        alsoAt: otherVenues(state, alt.archetypeId, alt.offeringId),
        alternatives: [heroCard, ...runners.filter((c) => c.archetypeId !== alt.archetypeId)].slice(0, 2),
        primaryAction,
        pickList,
      }
    }
  }
  const e = explanationFor(state)
  return {
    mode: 'match',
    stopReason: r.stopReason,
    confidenceLabel: r.confidenceLabel,
    hero: heroCard,
    headline: e?.headline ?? '',
    reasons: reasonsFrom(e),
    alsoAt: r.alsoAt.map((id) => {
      const o = loaded.offerings.get(id)!
      return {
        venueName: loaded.venues.get(o.venueId)!.name,
        offeringName: o.name,
        priceLabel: priceLabel(o.pricePence),
      }
    }),
    alternatives: runners,
    primaryAction,
    pickList,
  }
}
