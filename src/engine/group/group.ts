import { CUISINE_FAMILY, DIET_CONSTRAINTS } from '../../domain'
import type { ArchetypeId, Catalogue, CravingSelection, GeoPoint, Mood, SessionContext } from '../../domain'
import type { Clustering } from '../clusters/clusters'
import { clusterArchetypes } from '../clusters/clusters'
import type { EngineConfig } from '../config'
import { buildPool } from '../context/pool'
import type { Pool } from '../context/pool'
import { cosine } from '../features/featurize'
import type { FeatureId } from '../features/featurize'
import { buildInfoGainModel } from '../deck/infoGain'
import { pYes, selectNext } from '../deck/selectNext'
import { applySwipe, confidence, emptyProfile, pref, withPriors } from '../profile/profile'
import type { Profile } from '../profile/profile'
import { seededUnit } from '../rng'
import { belief, bestOffering, taste } from '../scoring/scoring'
import type { CardChoice, SessionModel, SwipeRecord } from '../session/types'
import type {
  FinalRoundOutcome,
  GroupMember,
  GroupPick,
  GroupResult,
  GroupSnapshot,
  GroupVote,
  SharedCard,
} from './types'

// Group matching (MVP_SPEC §12). Pure: the same snapshot gives the same result on every device.

const byId = <T extends { id: string }>(xs: readonly T[]) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1))

/** Everyone swipes only on what everyone can eat: the union of diets, the host's context (§12.1). */
export function groupContext(snapshot: GroupSnapshot, origin: GeoPoint, now: Date): SessionContext {
  const diets = new Set(snapshot.members.flatMap((m) => m.diet))
  return {
    origin,
    now,
    fulfilment: snapshot.settings.fulfilment,
    budget: snapshot.settings.budget,
    diet: DIET_CONSTRAINTS.filter((d) => diets.has(d)),
  }
}

/** Desserts are eligible if anyone asked for something sweet. */
function unionCraving(members: readonly GroupMember[]): CravingSelection {
  const moods = [...new Set(members.flatMap((m) => (m.craving.intent === 'no_idea' ? [] : m.craving.moods)))].sort() as Mood[]
  return { moods, intent: 'normal' }
}

export interface GroupModel {
  /** Neutral model over the group pool; member models share its pool. */
  base: SessionModel
  catalogue: Catalogue
}

export function groupModel(
  snapshot: GroupSnapshot,
  catalogue: Catalogue,
  origin: GeoPoint,
  now: Date,
  config: EngineConfig,
  clustering?: Clustering,
): GroupModel {
  const context = groupContext(snapshot, origin, now)
  const craving = unionCraving(snapshot.members)
  const pool = buildPool(catalogue, context, craving, config)
  return { catalogue, base: modelFor(pool, context, craving, snapshot.seed, config, clustering ?? clusterArchetypes(catalogue, config)) }
}

function modelFor(
  pool: Pool,
  context: SessionContext,
  craving: CravingSelection,
  seed: number,
  config: EngineConfig,
  clustering: Clustering,
): SessionModel {
  const similarity = new Map(
    pool.archetypeIds.map((a) => [
      a,
      new Map(pool.archetypeIds.map((b) => [b, cosine(pool.baseVectors.get(a)!, pool.baseVectors.get(b)!)])),
    ]),
  )
  return { pool, clustering, context, craving, seed, config, similarity }
}

const memberModel = (g: GroupModel, member: GroupMember): SessionModel => ({ ...g.base, craving: member.craving })

/**
 * The 6 shared cards (§12.3), computed by the HOST only and written into the snapshot.
 * EIG over a neutral profile, with a diversity penalty so the set covers the space
 * (no answers are known yet, so the cards can't adapt to each other).
 */
export function sharedGroupDeck(g: GroupModel): SharedCard[] {
  const { pool, config, seed, context } = g.base
  const ids = pool.archetypeIds
  const neutral = emptyProfile()
  const vectorOf = (id: ArchetypeId) => pool.baseVectors.get(id)!
  const b = belief(ids, ids.map(() => 0), config.beta)
  const info = buildInfoGainModel(neutral, ids, vectorOf, config.beta, config)
  const eig = new Map(ids.map((id) => [id, info.eig(id, vectorOf(id), pYes({ model: g.base }, b, id))]))
  const lo = Math.min(...eig.values())
  const hi = Math.max(...eig.values())
  const norm = (x: number) => (hi - lo < 1e-12 ? 0.5 : (x - lo) / (hi - lo))

  const chosen: ArchetypeId[] = []
  const count = Math.min(config.group.sharedCards, ids.length)
  while (chosen.length < count) {
    let best: { id: ArchetypeId; v: number } | undefined
    for (const id of ids) {
      if (chosen.includes(id)) continue
      const overlap = Math.max(0, ...chosen.map((c) => g.base.similarity.get(id)!.get(c)!))
      const v = norm(eig.get(id)!) - config.group.sharedDiversity * overlap + config.probeJitter * seededUnit(seed, `shared:${id}`)
      if (!best || v > best.v + 1e-12) best = { id, v }
    }
    chosen.push(best!.id)
  }
  return chosen.map((id) => ({
    archetypeId: id,
    offeringId: bestOffering(neutral, pool, id, context, config).candidate.offering.id,
  }))
}

function recordsFor(g: GroupModel, snapshot: GroupSnapshot, memberId: string): SwipeRecord[] {
  const { pool } = g.base
  return snapshot.swipes
    .filter((s) => s.memberId === memberId)
    .sort((a, b) => a.cardIndex - b.cardIndex)
    .map((s) => {
      const c = pool.byArchetype.get(s.archetypeId)?.find((x) => x.offering.id === s.offeringId)
      const card: CardChoice = {
        cardIndex: s.cardIndex,
        archetypeId: s.archetypeId,
        offeringId: s.offeringId,
        venueId: c?.venue.id ?? '',
        phase: s.cardIndex < g.base.config.group.sharedCards ? 'probe' : 'narrow',
        slot: 'normal',
        eig: 0,
        finalRank: 0,
        value: 0,
        flattened: false,
      }
      return { card, verdict: s.verdict }
    })
}

export function memberProfile(g: GroupModel, snapshot: GroupSnapshot, member: GroupMember): Profile {
  const { pool, config } = g.base
  let p = withPriors(emptyProfile(), member.craving, config)
  for (const r of recordsFor(g, snapshot, member.id)) {
    const c = pool.byArchetype.get(r.card.archetypeId)?.find((x) => x.offering.id === r.card.offeringId)
    if (!c) continue
    p = applySwipe(p, c.vector, r.verdict === 'no' ? 'no' : r.verdict === 'super_yes' ? 'super_yes' : 'yes', config)
  }
  return p
}

/** The member's next card: shared cards from the snapshot first, then personal ones. */
export function nextMemberCard(g: GroupModel, snapshot: GroupSnapshot, memberId: string): SharedCard | null {
  const member = snapshot.members.find((m) => m.id === memberId)
  if (!member || !snapshot.sharedDeck) return null
  const { config } = g.base
  const swipes = recordsFor(g, snapshot, memberId)
  const n = swipes.length
  if (n < snapshot.sharedDeck.length) return snapshot.sharedDeck[n]!
  if (n >= config.group.sharedCards + config.group.personalCards) return null
  const next = selectNext({
    model: memberModel(g, member),
    profile: memberProfile(g, snapshot, member),
    swipes,
    excluded: new Set(swipes.filter((r) => r.verdict === 'no').map((r) => r.card.archetypeId)),
    pivot: { streak: 0, used: 0, flattenRemaining: 0, anchorPending: false, log: [] },
    notQuite: { count: 0, extension: 0, atSwipe: null },
  })
  return next ? { archetypeId: next.archetypeId, offeringId: next.offeringId } : null
}

// ── Aggregation (§12.4–12.5) ───────────────────────────────────────────────

interface Scored {
  id: ArchetypeId
  G: number
  min: number
  scores: Record<string, number>
}

function diverseTop(list: readonly Scored[], pool: Pool, n: number): Scored[] {
  const out: Scored[] = []
  for (const s of list) {
    if (out.length === n) break
    const a = pool.archetypes.get(s.id)!
    const ok = out.every((o) => {
      const b = pool.archetypes.get(o.id)!
      return a.format !== b.format || CUISINE_FAMILY[a.cuisine] !== CUISINE_FAMILY[b.cuisine]
    })
    if (ok) out.push(s)
  }
  return out
}

export function computeGroupResult(g: GroupModel, snapshot: GroupSnapshot): GroupResult | null {
  const { config } = g.base
  const gc = config.group
  const members = byId(snapshot.members)
  const counts = new Map(members.map((m) => [m.id, snapshot.swipes.filter((s) => s.memberId === m.id).length]))
  const included = members.filter((m) => (counts.get(m.id) ?? 0) >= gc.minSwipes)
  const excludedMembers = members.filter((m) => !included.includes(m)).map((m) => m.id)
  if (included.length === 0) return null

  const profiles = new Map(included.map((m) => [m.id, memberProfile(g, snapshot, m)]))
  const verdicts = (id: ArchetypeId) =>
    included.map((m) => snapshot.swipes.find((s) => s.memberId === m.id && s.archetypeId === id)?.verdict)
  const vetoed = (id: ArchetypeId) => verdicts(id).includes('no')
  const unanimousYes = (id: ArchetypeId) => verdicts(id).every((v) => v === 'yes' || v === 'super_yes')

  const score = (pool: Pool, ids: readonly ArchetypeId[]): Scored[] =>
    ids.map((id) => {
      const scores: Record<string, number> = {}
      for (const m of included) scores[m.id] = taste(profiles.get(m.id)!, pool.baseVectors.get(id)!, config)
      const xs = Object.values(scores)
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length
      const misery = xs.reduce((a, x) => a + Math.max(0, gc.tau - x), 0)
      return { id, G: mean - gc.lambda * misery, min: Math.min(...xs), scores }
    })

  const where = (pool: Pool, ctx: SessionContext, id: ArchetypeId) => {
    const { candidate } = bestOffering(emptyProfile(), pool, id, ctx, config)
    return { candidate, fit: config.wPrice * candidate.priceFit + config.wDistance[ctx.fulfilment] * candidate.distanceFit }
  }
  const pick = (pool: Pool, ctx: SessionContext, s: Scored): GroupPick => ({
    archetypeId: s.id,
    offeringId: where(pool, ctx, s.id).candidate.offering.id,
    groupScore: s.G,
    minMemberScore: s.min,
    memberScores: s.scores,
  })

  const ctx = g.base.context
  const pool = g.base.pool
  const allVetoed = pool.archetypeIds.filter(vetoed)
  const open = pool.archetypeIds.filter((id) => !vetoed(id))
  const fit = new Map(open.map((id) => [id, where(pool, ctx, id).fit]))
  const ranked = score(pool, open).sort((a, b) => b.G + fit.get(b.id)! - (a.G + fit.get(a.id)!) || (a.id < b.id ? -1 : 1))

  // Common ground and conflicts, over every feature any member has evidence on.
  const features = [...new Set(included.flatMap((m) => [...profiles.get(m.id)!.features.keys()]))].sort()
  const commonGround = features.filter((f) =>
    included.every(
      (m) => pref(profiles.get(m.id)!, f, config) >= gc.commonGroundPref && confidence(profiles.get(m.id)!, f, config) >= gc.commonGroundConfidence,
    ),
  )
  const conflicts: FeatureId[] = features.filter((f) => {
    const ps = included.map((m) => pref(profiles.get(m.id)!, f, config))
    return ps.some((p) => p >= gc.conflictHigh) && ps.some((p) => p <= gc.conflictLow)
  })

  const unanimous = ranked.filter((s) => unanimousYes(s.id)).sort((a, b) => b.G - a.G || (a.id < b.id ? -1 : 1))
  const top = ranked[0]
  const base = { commonGround, conflicts, excludedMembers, vetoedCount: allVetoed.length }

  if (unanimous.length > 0 || (top && top.G >= gc.winnerScore && top.min >= gc.winnerMin)) {
    const hero = unanimous[0] ?? top!
    const rest = ranked.filter((s) => s.id !== hero.id)
    return {
      ...base,
      outcome: 'WINNER',
      unanimous: unanimous.length > 0,
      hero: pick(pool, ctx, hero),
      finalRound: diverseTop([hero, ...rest], pool, 3).map((s) => pick(pool, ctx, s)),
      vetoesLifted: false,
      relaxed: false,
    }
  }
  if (top && top.G >= gc.okScore && top.min >= gc.tau) {
    return {
      ...base,
      outcome: 'COMMON_GROUND',
      unanimous: false,
      hero: pick(pool, ctx, top),
      finalRound: diverseTop(ranked, pool, 3).map((s) => pick(pool, ctx, s)),
      vetoesLifted: false,
      relaxed: false,
    }
  }

  // NOBODY_AGREES → compromise: widen distance, drop the budget cap, maximise the least-happy member.
  const relaxedConfig: EngineConfig = {
    ...config,
    maxDistanceMiles: {
      delivery: config.maxDistanceMiles.delivery * gc.relaxDistance,
      go_out: config.maxDistanceMiles.go_out * gc.relaxDistance,
      either: config.maxDistanceMiles.either * gc.relaxDistance,
    },
  }
  const relaxedCtx: SessionContext = { ...ctx, budget: 'any' }
  const relaxedPool = buildPool(g.catalogue, relaxedCtx, g.base.craving, relaxedConfig)
  let candidates = relaxedPool.archetypeIds.filter((id) => !vetoed(id))
  const vetoesLifted = candidates.length < 3
  if (vetoesLifted) candidates = [...relaxedPool.archetypeIds]
  const egalitarian = score(relaxedPool, candidates).sort((a, b) => b.min - a.min || b.G - a.G || (a.id < b.id ? -1 : 1))
  const hero = egalitarian[0]!
  return {
    ...base,
    outcome: 'NOBODY_AGREES',
    unanimous: false,
    hero: pick(relaxedPool, relaxedCtx, hero),
    finalRound: diverseTop(egalitarian, relaxedPool, 3).map((s) => pick(relaxedPool, relaxedCtx, s)),
    vetoesLifted,
    relaxed: true,
  }
}

/** Approval vote (§12.6): most approvals; ties → higher G, higher min, id. Nobody approves → egalitarian top. */
export function resolveFinalRound(result: GroupResult, votes: readonly GroupVote[]): FinalRoundOutcome {
  const approvals: Record<ArchetypeId, number> = {}
  for (const p of result.finalRound) {
    approvals[p.archetypeId] = votes.filter((v) => v.archetypeId === p.archetypeId && v.approve).length
  }
  const total = Object.values(approvals).reduce((a, b) => a + b, 0)
  if (total === 0) {
    const winner = [...result.finalRound].sort(
      (a, b) => b.minMemberScore - a.minMemberScore || b.groupScore - a.groupScore || (a.archetypeId < b.archetypeId ? -1 : 1),
    )[0]!
    return { winner, approvals, pickedForYou: true }
  }
  const winner = [...result.finalRound].sort(
    (a, b) =>
      approvals[b.archetypeId]! - approvals[a.archetypeId]! ||
      b.groupScore - a.groupScore ||
      b.minMemberScore - a.minMemberScore ||
      (a.archetypeId < b.archetypeId ? -1 : 1),
  )[0]!
  return { winner, approvals, pickedForYou: false }
}
