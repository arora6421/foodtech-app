import { CUISINE_FAMILY } from '../../domain'
import type { ArchetypeId, OfferingId, SessionContext } from '../../domain'
import type { EngineConfig } from '../config'
import type { Candidate, Pool } from '../context/pool'
import type { FeatureId, FeatureVector } from '../features/featurize'
import { confidence, pref } from '../profile/profile'
import type { Profile } from '../profile/profile'

// Taste (WHAT), belief, final rank (WHAT + a little WHERE) and the breakdown contract
// (MVP_SPEC §8.3–8.6).

/** taste = Σ s_f · pref(f) / Σ s_f ∈ (−1, 1). */
export function taste(profile: Profile, vector: FeatureVector, config: EngineConfig): number {
  let num = 0
  let den = 0
  for (const [f, s] of vector) {
    num += s * pref(profile, f, config)
    den += s
  }
  return den === 0 ? 0 : num / den
}

/** Salience-weighted mean confidence of a dish's features (stop-rule "support"). */
export function meanConfidence(profile: Profile, vector: FeatureVector, config: EngineConfig): number {
  let num = 0
  let den = 0
  for (const [f, s] of vector) {
    num += s * confidence(profile, f, config)
    den += s
  }
  return den === 0 ? 0 : num / den
}

export interface Belief {
  ids: readonly ArchetypeId[]
  probs: readonly number[]
  entropy: number
}

/** P(a) ∝ exp(β · taste(a)) over the hypothesis set. Tastes may be precomputed and passed in. */
export function belief(ids: readonly ArchetypeId[], tastes: readonly number[], beta: number): Belief {
  let max = -Infinity
  for (const t of tastes) max = Math.max(max, t)
  const w = tastes.map((t) => Math.exp(beta * (t - max)))
  const z = w.reduce((a, b) => a + b, 0)
  const probs = w.map((x) => x / z)
  let entropy = 0
  for (const p of probs) if (p > 0) entropy -= p * Math.log(p)
  return { ids, probs, entropy }
}

/** Mass of the k most probable archetypes. */
export function topMass(b: Belief, k: number): number {
  return [...b.probs].sort((x, y) => y - x).slice(0, k).reduce((a, x) => a + x, 0)
}

export interface OfferingChoice {
  candidate: Candidate
  score: number
}

/** WHERE: the offering that best serves an archetype (§8.5). Ties: lower price, then id. */
export function bestOffering(
  profile: Profile,
  pool: Pool,
  archetypeId: ArchetypeId,
  ctx: SessionContext,
  config: EngineConfig,
  avoidVenues: ReadonlySet<string> = new Set(),
): OfferingChoice {
  const options = pool.byArchetype.get(archetypeId)
  if (!options || options.length === 0) throw new Error(`no eligible offering for ${archetypeId}`)
  const base = taste(profile, pool.baseVectors.get(archetypeId)!, config)
  const wD = config.wDistance[ctx.fulfilment]
  const scored = options
    .map((c) => ({
      candidate: c,
      score: config.wPrice * c.priceFit + wD * c.distanceFit + (taste(profile, c.vector, config) - base),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.offering.pricePence - b.candidate.offering.pricePence ||
        (a.candidate.offering.id < b.candidate.offering.id ? -1 : 1),
    )
  const best = scored[0]!
  // Deck-only nicety (§9.5): prefer a venue we haven't just shown, if it's nearly as good.
  if (avoidVenues.has(best.candidate.venue.id)) {
    const alt = scored.find(
      (s) => !avoidVenues.has(s.candidate.venue.id) && best.score - s.score <= config.venueDiversityTolerance,
    )
    if (alt) return alt
  }
  return best
}

export interface ScoreBreakdown {
  archetypeId: ArchetypeId
  offeringId: OfferingId
  taste: number
  priceFit: number
  distanceFit: number
  finalRank: number
  contributions: { featureId: FeatureId; salience: number; pref: number; confidence: number; value: number }[]
}

export function finalRank(
  profile: Profile,
  pool: Pool,
  archetypeId: ArchetypeId,
  ctx: SessionContext,
  config: EngineConfig,
): ScoreBreakdown {
  const vector = pool.baseVectors.get(archetypeId)!
  const t = taste(profile, vector, config)
  const { candidate } = bestOffering(profile, pool, archetypeId, ctx, config)
  const wD = config.wDistance[ctx.fulfilment]
  let den = 0
  for (const s of vector.values()) den += s
  const contributions = [...vector].map(([featureId, salience]) => {
    const p = pref(profile, featureId, config)
    return { featureId, salience, pref: p, confidence: confidence(profile, featureId, config), value: (salience * p) / den }
  })
  contributions.sort((a, b) => b.value - a.value || (a.featureId < b.featureId ? -1 : 1))
  return {
    archetypeId,
    offeringId: candidate.offering.id,
    taste: t,
    priceFit: candidate.priceFit,
    distanceFit: candidate.distanceFit,
    finalRank: t + config.wPrice * candidate.priceFit + wD * candidate.distanceFit,
    contributions,
  }
}

/** Rank a set of archetypes by finalRank; ties by id. */
export function rankArchetypes(
  profile: Profile,
  pool: Pool,
  ids: readonly ArchetypeId[],
  ctx: SessionContext,
  config: EngineConfig,
): ScoreBreakdown[] {
  return ids
    .map((id) => finalRank(profile, pool, id, ctx, config))
    .sort((a, b) => b.finalRank - a.finalRank || (a.archetypeId < b.archetypeId ? -1 : 1))
}

/** Hero + diverse runners-up: each must differ from the others in format or family (§10.5). */
export function shortlist(ranked: readonly ScoreBreakdown[], pool: Pool, runnersUp: number): ScoreBreakdown[] {
  const picked: ScoreBreakdown[] = []
  const key = (id: ArchetypeId) => {
    const a = pool.archetypes.get(id)!
    return { format: a.format, family: CUISINE_FAMILY[a.cuisine] }
  }
  for (const s of ranked) {
    if (picked.length === runnersUp + 1) break
    const k = key(s.archetypeId)
    const diverse = picked.every((p) => {
      const q = key(p.archetypeId)
      return q.format !== k.format || q.family !== k.family
    })
    if (picked.length === 0 || diverse) picked.push(s)
  }
  return picked
}
