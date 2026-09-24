import type { ArchetypeId } from '../../domain'
import { currentBelief, hypotheses, rankValue } from '../deck/selectNext'
import { finalRank, meanConfidence, rankArchetypes, shortlist, taste, topMass } from '../scoring/scoring'
import type { Belief } from '../scoring/scoring'
import type { CardChoice, ConfidenceLabel, SessionResult, SoloState, StopCheck, StopReason } from '../session/types'

// Stopping rule, narrowing counter and the shortlist result (MVP_SPEC §10).

type S = Pick<SoloState, 'model' | 'profile' | 'swipes' | 'excluded' | 'pivot' | 'notQuite' | 'topHistory'>

export interface StopDecision {
  reason: StopReason | null
  check: StopCheck
  top3: ArchetypeId[]
}

export function checkStop(s: S): StopDecision {
  const { pool, config } = s.model
  const n = s.swipes.length
  const H = hypotheses(s)
  const ranked = H.map((id) => ({ id, r: rankValue(s, id) })).sort((a, b) => b.r - a.r || (a.id < b.id ? -1 : 1))
  const top = ranked[0]?.id ?? null
  const top3 = ranked.slice(0, 3).map((x) => x.id)
  const b = currentBelief(s)
  const m3 = topMass(b, 3)

  let support = false
  if (top) {
    const v = pool.baseVectors.get(top)!
    support =
      taste(s.profile, v, config) >= config.supportTaste && meanConfidence(s.profile, v, config) >= config.supportConfidence
  }
  // Mass on the top dish's cluster: confidence about the neighbourhood, not one dish (rev. 3).
  const { clusterOf } = s.model.clustering
  const topCluster = top === null ? undefined : clusterOf.get(top)
  let clusterMass = 0
  b.ids.forEach((id, i) => {
    if (clusterOf.get(id) === topCluster) clusterMass += b.probs[i]!
  })
  // Stable: the top was already a contender, or at least in the same cluster as the previous top.
  const previous = s.topHistory.slice(-(config.stableChecks - 1))
  const stable =
    top !== null &&
    previous.length === config.stableChecks - 1 &&
    previous.every((l) => l.includes(top) || (l[0] !== undefined && clusterOf.get(l[0]) === topCluster))
  const check: StopCheck = { top, topMass3: m3, support, stable }

  const seen = new Set(s.swipes.map((r) => r.card.archetypeId))
  const unseen = H.filter((id) => !seen.has(id)).length
  const sinceNotQuite = s.notQuite.atSwipe === null ? Infinity : n - s.notQuite.atSwipe
  const minOk = n >= config.minSwipes && sinceNotQuite >= config.notQuiteMinSwipes

  let reason: StopReason | null = null
  if (n >= config.maxSwipes + s.notQuite.extension) reason = 'max_reached'
  else if (unseen < config.minUnseen) reason = 'pool_exhausted'
  else if (minOk && (m3 >= config.confidentMass || clusterMass >= config.clusterConfidentMass) && support && stable) reason = 'confident'
  else if (minOk && n >= config.relaxedFromSwipe && (m3 >= config.relaxedMass || clusterMass >= config.clusterRelaxedMass) && support) reason = 'converged'
  return { reason, check, top3 }
}

/** Offerings covering the smallest set of archetypes holding `mass` of the belief (§10.4). */
export function plausibleOfferings(s: Pick<SoloState, 'model'>, b: Belief, mass: number): number {
  const order = b.ids.map((id, i) => ({ id, p: b.probs[i]! })).sort((x, y) => y.p - x.p || (x.id < y.id ? -1 : 1))
  let acc = 0
  let count = 0
  for (const { id, p } of order) {
    count += s.model.pool.byArchetype.get(id)?.length ?? 0
    acc += p
    if (acc >= mass) break
  }
  return count
}

export function updateCounter(s: S & Pick<SoloState, 'counter'>): { raw: number; shown: number } {
  const raw = plausibleOfferings(s, currentBelief(s), s.model.config.counterMass)
  return { raw, shown: Math.min(s.counter.shown, raw) }
}

function labelFor(reason: StopReason, n: number, support: boolean, minSwipes: number): ConfidenceLabel {
  switch (reason) {
    case 'confident':
    case 'user_picked':
      return 'Strong match'
    case 'converged':
      return 'Good match'
    case 'decide_for_me':
      return n >= minSwipes && support ? 'Good match' : 'Best guess'
    default:
      return 'Best guess'
  }
}

export function buildResult(s: S, reason: StopReason, check: StopCheck, picked?: CardChoice): SessionResult {
  const { pool, config, context } = s.model
  let H = hypotheses(s)
  if (H.length === 0) H = [...pool.archetypeIds] // everything NOPEd: fall back to the whole pool
  const ranked = rankArchetypes(s.profile, pool, H, context, config)

  let list
  if (picked) {
    const hero = { ...finalRank(s.profile, pool, picked.archetypeId, context, config), offeringId: picked.offeringId }
    list = shortlist([hero, ...ranked.filter((r) => r.archetypeId !== picked.archetypeId)], pool, config.runnersUp)
  } else {
    list = shortlist(ranked, pool, config.runnersUp)
  }
  const hero = list[0]!
  const alsoAt = (pool.byArchetype.get(hero.archetypeId) ?? [])
    .filter((c) => c.offering.id !== hero.offeringId)
    .map((c) => ({ id: c.offering.id, score: bestOfferingScore(s, c.offering.id, hero.archetypeId) }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, 2)
    .map((x) => x.id)

  return {
    stopReason: reason,
    confidenceLabel: labelFor(reason, s.swipes.length, check.support, config.minSwipes),
    hero,
    runnersUp: list.slice(1),
    pickList: reason === 'pick_list' ? ranked.slice(0, config.pickListSize) : null,
    alsoAt,
    swipes: s.swipes.length,
    topMass3: check.topMass3,
  }
}

function bestOfferingScore(s: S, offeringId: string, archetypeId: ArchetypeId): number {
  const { pool, config, context } = s.model
  const c = pool.byArchetype.get(archetypeId)!.find((x) => x.offering.id === offeringId)!
  const base = taste(s.profile, pool.baseVectors.get(archetypeId)!, config)
  return config.wPrice * c.priceFit + config.wDistance[context.fulfilment] * c.distanceFit + taste(s.profile, c.vector, config) - base
}

