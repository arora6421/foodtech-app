import { CUISINE_FAMILY } from '../../domain'
import type { ArchetypeId, DishArchetype, Mood } from '../../domain'
import { namespaceOf } from '../features/featurize'
import type { FeatureId } from '../features/featurize'
import { confidence, pref } from '../profile/profile'
import { seededUnit } from '../rng'
import { belief, bestOffering, taste, topMass } from '../scoring/scoring'
import type { Belief } from '../scoring/scoring'
import type { CardChoice, Phase, Slot, SoloState } from '../session/types'
import { buildInfoGainModel } from './infoGain'

// Choosing the next card (MVP_SPEC §9, §10.3). Pure: same state → same card.

type DeckState = Pick<SoloState, 'model' | 'profile' | 'swipes' | 'excluded' | 'pivot' | 'notQuite'>

export function effectiveBeta(s: Pick<SoloState, 'model' | 'pivot'>): number {
  const { config } = s.model
  return s.pivot.flattenRemaining > 0 ? config.beta * config.pivotBetaFactor : config.beta
}

export function hypotheses(s: Pick<SoloState, 'model' | 'excluded'>): ArchetypeId[] {
  return s.model.pool.archetypeIds.filter((id) => !s.excluded.has(id))
}

export function currentBelief(s: Pick<SoloState, 'model' | 'profile' | 'excluded' | 'pivot'>): Belief {
  const H = hypotheses(s)
  const { pool, config } = s.model
  return belief(
    H,
    H.map((id) => taste(s.profile, pool.baseVectors.get(id)!, config)),
    effectiveBeta(s),
  )
}

export function matchesMood(a: DishArchetype, mood: Mood): boolean {
  return mood === 'spicy' ? a.axes.spice >= 3 : a.moods.includes(mood)
}

/** Cheap finalRank (no contribution breakdown): taste + WHERE fits of the best offering. */
export function rankValue(s: DeckState, id: ArchetypeId): number {
  const { pool, config, context } = s.model
  const t = taste(s.profile, pool.baseVectors.get(id)!, config)
  const { candidate } = bestOffering(s.profile, pool, id, context, config)
  return t + config.wPrice * candidate.priceFit + config.wDistance[context.fulfilment] * candidate.distanceFit
}

export function phaseFor(s: DeckState, cardNumber: number, m3: number): Phase {
  const { config, craving } = s.model
  if (s.notQuite.atSwipe !== null && cardNumber <= s.notQuite.atSwipe + config.notQuiteNarrowCards) return 'narrow'
  const probe = craving.intent === 'no_idea' ? config.probeCardsNoIdea : config.probeCards
  if (cardNumber <= probe) return 'probe'
  if (cardNumber > config.narrowLastCard || (cardNumber >= config.confirmEarliestCard && m3 >= config.confirmMassThreshold)) return 'confirm'
  return 'narrow'
}

function slotFor(s: DeckState, cardNumber: number, phase: Phase): Slot {
  const { config, craving } = s.model
  if (s.pivot.anchorPending) return 'anchor'
  if (phase === 'probe') return 'normal'
  if (craving.intent === 'something_new') {
    const from = config.somethingNewAdjacencyFrom
    return cardNumber >= from && (cardNumber - from) % config.somethingNewAdjacencyEvery === 0 ? 'adjacency' : 'normal'
  }
  return phase === 'narrow' && config.adjacencySlots.includes(cardNumber) ? 'adjacency' : 'normal'
}

/** Up to maxLiked features the user clearly likes, strongest first (§9.3). */
export function likedFeatures(s: DeckState): FeatureId[] {
  const { config } = s.model
  return [...s.profile.features.keys()]
    .map((f) => ({ f, p: pref(s.profile, f, config), c: confidence(s.profile, f, config) }))
    .filter((x) => x.p >= config.likedPref && x.c >= config.likedConfidence)
    .sort((a, b) => b.p * config.salience[namespaceOf(b.f)] - a.p * config.salience[namespaceOf(a.f)] || (a.f < b.f ? -1 : 1))
    .slice(0, config.maxLiked)
    .map((x) => x.f)
}

function isAdjacent(s: DeckState, id: ArchetypeId, liked: readonly FeatureId[]): boolean {
  const { pool, config } = s.model
  const v = pool.baseVectors.get(id)!
  if (!liked.some((f) => v.has(f))) return false
  let unexplored = 0
  for (const f of v.keys()) {
    const ns = namespaceOf(f)
    if ((ns === 'cuisine' || ns === 'family' || ns === 'format' || ns === 'protein') && confidence(s.profile, f, config) < config.unexploredConfidence) {
      unexplored++
    }
  }
  return unexplored >= 2
}

/** Clusters the user has rejected: ≥ 2 NOPEs and no YES this session. */
function coldClusters(s: DeckState): Set<number> {
  const { clustering } = s.model
  const tally = new Map<number, { yes: number; no: number }>()
  for (const r of s.swipes) {
    const c = clustering.clusterOf.get(r.card.archetypeId)
    if (c === undefined) continue
    const t = tally.get(c) ?? { yes: 0, no: 0 }
    if (r.verdict === 'no') t.no++
    else t.yes++
    tally.set(c, t)
  }
  const cold = new Set([...tally].filter(([, t]) => t.no >= 2 && t.yes === 0).map(([c]) => c))
  for (const r of s.swipes) {
    if (r.card.slot === 'anchor' && r.verdict === 'no') cold.add(clustering.clusterOf.get(r.card.archetypeId)!)
  }
  return cold
}

/** High-fidelity anchor from the nearest adjacent, non-cold cluster (§9.7, §10.3). */
export function pickAnchor(
  s: DeckState,
  candidates: readonly ArchetypeId[],
  topId: ArchetypeId,
  eigOf: (id: ArchetypeId) => number,
): ArchetypeId {
  const { clustering } = s.model
  const current = clustering.clusterOf.get(topId)!
  const cold = coldClusters(s)
  const available = new Set(candidates)
  const order = clustering.clusters
    .map((c) => c.index)
    .filter((c) => c !== current && !cold.has(c))
    .sort((a, b) => clustering.medoidSimilarity[current]![b]! - clustering.medoidSimilarity[current]![a]! || a - b)
  for (const c of order) {
    const members = clustering.clusters[c]!.members.filter((m) => available.has(m))
    if (members.length === 0) continue
    return members.sort(
      (a, b) =>
        clustering.fidelity.get(b)! - clustering.fidelity.get(a)! || eigOf(b) - eigOf(a) || (a < b ? -1 : 1),
    )[0]!
  }
  const outside = candidates.filter((id) => clustering.clusterOf.get(id) !== current)
  const pool = outside.length > 0 ? outside : candidates
  return [...pool].sort((a, b) => eigOf(b) - eigOf(a) || (a < b ? -1 : 1))[0]!
}

function repetitionPenalty(s: DeckState, a: DishArchetype, venueId: string): number {
  const { config } = s.model
  const r = config.repetition
  const recent = (k: number) => s.swipes.slice(-k).map((x) => s.model.pool.archetypes.get(x.card.archetypeId))
  let p = 0
  if (recent(r.cuisineWithin).some((x) => x?.cuisine === a.cuisine)) p += r.cuisine
  if (recent(r.formatWithin).some((x) => x?.format === a.format)) p += r.format
  if (s.swipes.slice(-r.venueWithin).some((x) => x.card.venueId === venueId)) p += r.venue
  return p
}

/**
 * Predictive probability of a YES on card c under the current belief (rev. 3, §9.1):
 * p_yes(c) = Σ_a P(a) · sim(a, c)^e. A niche card only gets a high p_yes if belief already sits near it,
 * so the deck splits the space instead of chasing niches.
 */
export function pYes(s: Pick<SoloState, 'model'>, b: Belief, cardId: ArchetypeId): number {
  const { config, similarity } = s.model
  const row = similarity.get(cardId)!
  let p = 0
  b.ids.forEach((id, i) => {
    p += b.probs[i]! * (row.get(id) ?? 0) ** config.yesSimilarityExponent
  })
  const [lo, hi] = config.pYesClamp
  return Math.min(hi, Math.max(lo, p))
}

const normaliser = (xs: number[]) => {
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  return (x: number) => (hi - lo < 1e-12 ? 0.5 : (x - lo) / (hi - lo))
}

export function selectNext(s: DeckState): CardChoice | null {
  const { pool, config, craving, seed, context } = s.model
  const cardNumber = s.swipes.length + 1
  const seen = new Set(s.swipes.map((r) => r.card.archetypeId))
  const H = hypotheses(s)
  let candidates = H.filter((id) => !seen.has(id))
  if (candidates.length === 0) return null

  const beta = effectiveBeta(s)
  const vectorOf = (id: ArchetypeId) => pool.baseVectors.get(id)!
  const b = belief(H, H.map((id) => taste(s.profile, vectorOf(id), config)), beta)
  const phase = phaseFor(s, cardNumber, topMass(b, 3))
  const slot = slotFor(s, cardNumber, phase)

  const infoModel = buildInfoGainModel(s.profile, H, vectorOf, beta, config)
  const eigCache = new Map<ArchetypeId, number>()
  const eigOf = (id: ArchetypeId) => {
    let e = eigCache.get(id)
    if (e === undefined) {
      e = infoModel.eig(id, vectorOf(id), pYes(s, b, id))
      eigCache.set(id, e)
    }
    return e
  }
  const rankCache = new Map<ArchetypeId, number>()
  const rankOf = (id: ArchetypeId) => {
    let r = rankCache.get(id)
    if (r === undefined) {
      r = rankValue(s, id)
      rankCache.set(id, r)
    }
    return r
  }
  const recentVenues = new Set(s.swipes.slice(-config.repetition.venueWithin).map((r) => r.card.venueId))
  const offeringCache = new Map<ArchetypeId, ReturnType<typeof bestOffering>>()
  const offeringOf = (id: ArchetypeId) => {
    let o = offeringCache.get(id)
    if (!o) {
      o = bestOffering(s.profile, pool, id, context, config, recentVenues)
      offeringCache.set(id, o)
    }
    return o
  }
  const choose = (id: ArchetypeId, usedSlot: Slot, value: number): CardChoice => {
    const { candidate } = offeringOf(id)
    return {
      cardIndex: cardNumber - 1,
      archetypeId: id,
      offeringId: candidate.offering.id,
      venueId: candidate.venue.id,
      phase,
      slot: usedSlot,
      eig: eigOf(id),
      finalRank: rankOf(id),
      value,
      flattened: s.pivot.flattenRemaining > 0,
    }
  }

  if (slot === 'anchor' && config.deckPolicy === 'eig') {
    const top = [...H].sort((x, y) => rankOf(y) - rankOf(x) || (x < y ? -1 : 1))[0]!
    return choose(pickAnchor(s, candidates, top, eigOf), 'anchor', 1)
  }

  if (slot === 'adjacency' && config.deckPolicy === 'eig') {
    const liked = likedFeatures(s)
    const adjacent = candidates.filter((id) => isAdjacent(s, id, liked))
    if (adjacent.length > 0) {
      const best = [...adjacent].sort((x, y) => eigOf(y) - eigOf(x) || (x < y ? -1 : 1))[0]!
      return choose(best, 'adjacency', 1)
    }
  }

  // Craving respect (§9.2): enough of the first cards must match a chosen mood.
  if (phase === 'probe' && craving.intent !== 'no_idea' && craving.moods.length > 0 && cardNumber <= config.cravingRespectInFirst) {
    const matches = (id: ArchetypeId) => craving.moods.some((m) => matchesMood(pool.archetypes.get(id)!, m))
    const matched = s.swipes.slice(0, config.cravingRespectInFirst).filter((r) => matches(r.card.archetypeId)).length
    const remaining = config.cravingRespectInFirst - cardNumber + 1
    if (config.cravingRespectCount - matched >= remaining) {
      const filtered = candidates.filter(matches)
      if (filtered.length > 0) candidates = filtered
    }
  }

  if (config.deckPolicy === 'random') {
    const pick = [...candidates].sort((x, y) => seededUnit(seed, `random:${cardNumber}:${x}`) - seededUnit(seed, `random:${cardNumber}:${y}`))[0]!
    return choose(pick, 'normal', 0)
  }
  let { info, exploit } = config.deckPolicy === 'greedy' ? { info: 0, exploit: 1 } : config.phaseWeights[phase]
  if (craving.intent === 'something_new') {
    const boosted = info * config.somethingNewInfoMultiplier
    info = boosted / (boosted + exploit)
    exploit = 1 - info
  }
  const eigs = candidates.map(eigOf)
  const ranks = candidates.map(rankOf)
  const nE = normaliser(eigs)
  const nR = normaliser(ranks)
  let best: { id: ArchetypeId; value: number } | undefined
  candidates.forEach((id, i) => {
    const a = pool.archetypes.get(id)!
    const venue = offeringOf(id).candidate.venue.id
    let value = info * nE(eigs[i]!) + exploit * nR(ranks[i]!) - repetitionPenalty(s, a, venue)
    if (phase === 'probe') value += config.probeJitter * seededUnit(seed, `${cardNumber}:${id}`)
    if (!best || value > best.value + 1e-12 || (Math.abs(value - best.value) <= 1e-12 && id < best.id)) {
      best = { id, value }
    }
  })
  return choose(best!.id, 'normal', best!.value)
}

/** Diversity helper for reports: distinct cuisine families among archetypes. */
export function familiesOf(s: Pick<SoloState, 'model'>, ids: readonly ArchetypeId[]): number {
  return new Set(ids.map((id) => CUISINE_FAMILY[s.model.pool.archetypes.get(id)!.cuisine])).size
}
