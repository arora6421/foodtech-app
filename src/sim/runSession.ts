import { CUISINE_FAMILY, effectiveDietary, satisfiesDiet } from '../domain'
import type { ArchetypeId, Catalogue, SessionContext } from '../domain'
import type { Clustering } from '../engine/clusters/clusters'
import type { EngineConfig } from '../engine/config'
import { currentBelief } from '../engine/deck/selectNext'
import { explainResult, noQuantifier, yesQuantifier } from '../engine/explain/explain'
import { confidence, nopeBlame, pref } from '../engine/profile/profile'
import { hashString, mulberry32 } from '../engine/rng'
import { createSoloSession, soloReducer } from '../engine/session/solo'
import type { SoloState, StopReason } from '../engine/session/types'
import { ANGEL_N1 } from '../location/LocationProvider'
import type { Persona } from './personas'

// One simulated solo session and everything we measure about it (MVP_SPEC §14.3).

export const SIM_NOW = new Date('2026-09-24T19:30:00Z') // a Thursday evening in London

export interface CardLog {
  i: number
  archetypeId: ArchetypeId
  offeringId: string
  phase: string
  slot: string
  verdict: 'yes' | 'no'
  eig: number
  topAfter: ArchetypeId | null
  m3After: number
  entropyBefore: number
  entropyAfter: number
  counterShown: number
}

export interface SessionMetrics {
  personaId: string
  policy: string
  seed: number
  swipes: number
  stopReason: StopReason
  hit1: boolean
  /** The persona would have said YES to the hero (the product criterion: it found something I want). */
  acceptable: boolean
  hit3: boolean
  regret: number
  /** First swipe after which the engine's top stays in the truth top-3; maxSwipes + 1 if never. */
  swipesToCorrect: number
  featurePrecision: number
  prematureLock: boolean
  familiesFirst8: number
  bothModes: boolean
  pivots: number
  pivotsRecovered: number
  meanEntropyDrop: number
  reasons: number
  reasonsTrue: number
  unsupportedClaims: number
  innocentBlame: number
  totalBlame: number
  dietViolations: number
}

export interface SessionTranscript {
  /** Everything needed to rebuild and replay the session (the debug panel does this). */
  input: { context: Omit<SessionContext, 'now'> & { now: string }; craving: Persona['craving']; seed: number }
  personaId: string
  policy: string
  seed: number
  truthTop3: ArchetypeId[]
  cards: CardLog[]
  hero: ArchetypeId
  heroOffering: string
  runnersUp: ArchetypeId[]
  stopReason: StopReason
  confidenceLabel: string
  headline: string
  reasons: string[]
  avoided?: string
  events: SoloState['events']
}

export function personaContext(p: Persona): SessionContext {
  return { origin: ANGEL_N1, now: SIM_NOW, fulfilment: p.fulfilment, budget: p.budget, diet: p.diet }
}

/** Gaussian noise via Box–Muller on the persona's own RNG stream. */
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

export function runSession(
  persona: Persona,
  seed: number,
  catalogue: Catalogue,
  clustering: Clustering,
  config: EngineConfig,
  policy: string,
): { metrics: SessionMetrics; transcript: SessionTranscript } {
  let s = createSoloSession({ catalogue, clustering, config, seed, context: personaContext(persona), craving: persona.craving })
  const { pool } = s.model
  const rng = mulberry32(hashString(persona.id, seed * 7919))

  // Truth: utility of each eligible archetype at its best eligible offering.
  const utilityOf = new Map<ArchetypeId, number>()
  for (const id of pool.archetypeIds) {
    utilityOf.set(id, Math.max(...pool.byArchetype.get(id)!.map((c) => persona.utility(c.archetype, c.offering))))
  }
  const byUtility = [...pool.archetypeIds].sort((a, b) => utilityOf.get(b)! - utilityOf.get(a)! || (a < b ? -1 : 1))
  // Tie-inclusive: every archetype at least as good as the 3rd best counts as correct. (Cutting ties by id
  // would call 3 of 11 equally-loved noodle dishes "correct" and the other 8 "wrong".)
  const cutoff = utilityOf.get(byUtility[Math.min(2, byUtility.length - 1)]!)! - 1e-9
  const truthTop3 = byUtility.filter((id) => utilityOf.get(id)! >= cutoff)
  const truth = new Set(truthTop3)

  const cards: CardLog[] = []
  let innocentBlame = 0
  let totalBlame = 0
  while (!s.result && s.current) {
    const card = s.current
    const c = pool.byArchetype.get(card.archetypeId)!.find((x) => x.offering.id === card.offeringId)!
    let yes = persona.utility(c.archetype, c.offering) + persona.noise.sd * gaussian(rng) > persona.threshold
    if (rng() < persona.noise.flipProb) yes = !yes
    if (!yes) {
      for (const [f, b] of nopeBlame(s.profile, c.vector, config.etaNo, config)) {
        totalBlame += b
        if (persona.trueLikes.includes(f)) innocentBlame += b
      }
    }
    const entropyBefore = currentBelief(s).entropy
    s = soloReducer(s, { type: 'swipe', verdict: yes ? 'yes' : 'no' })
    cards.push({
      i: card.cardIndex,
      archetypeId: card.archetypeId,
      offeringId: card.offeringId,
      phase: card.phase,
      slot: card.slot,
      verdict: yes ? 'yes' : 'no',
      eig: card.eig,
      topAfter: s.lastCheck?.top ?? null,
      m3After: s.lastCheck?.topMass3 ?? 0,
      entropyBefore,
      entropyAfter: currentBelief(s).entropy,
      counterShown: s.counter.shown,
    })
  }
  const r = s.result!
  const explanation = explainResult(s)!

  // ── Metrics ──────────────────────────────────────────────────────────────
  const tops = cards.map((c) => c.topAfter)
  let swipesToCorrect = config.maxSwipes + 1
  const last = tops[tops.length - 1]
  if (last && truth.has(last)) {
    let j = tops.length - 1
    while (j > 0 && tops[j - 1] && truth.has(tops[j - 1]!)) j--
    swipesToCorrect = j + 1
  }

  const best = utilityOf.get(byUtility[0]!)!
  const worst = utilityOf.get(byUtility[byUtility.length - 1]!)!
  const regret = best === worst ? 0 : (best - utilityOf.get(r.hero.archetypeId)!) / (best - worst)

  const k = Math.min(5, persona.trueLikes.length)
  const engineTop = [...s.profile.features.keys()]
    .filter((f) => confidence(s.profile, f, config) >= 0.2)
    .sort((a, b) => pref(s.profile, b, config) - pref(s.profile, a, config) || (a < b ? -1 : 1))
    .slice(0, k)
  const featurePrecision = engineTop.filter((f) => persona.trueLikes.includes(f)).length / k

  const top4 = tops[3]
  const prematureLock = !!top4 && tops.slice(3).every((t) => t === top4) && !truth.has(top4)

  const familiesFirst8 = new Set(cards.slice(0, 8).map((c) => CUISINE_FAMILY[pool.archetypes.get(c.archetypeId)!.cuisine])).size
  const shownArch = cards.map((c) => pool.archetypes.get(c.archetypeId)!)
  const bothModes =
    shownArch.some((a) => a.cuisine === 'indian' && a.format === 'curry_stew') &&
    shownArch.some((a) => a.cuisine === 'mexican' && a.format === 'tacos_burrito')

  let pivotsRecovered = 0
  for (const p of s.pivot.log) if (cards.slice(p.atSwipe, p.atSwipe + 2).some((c) => c.verdict === 'yes')) pivotsRecovered++

  const drops = cards.map((c) => c.entropyBefore - c.entropyAfter)
  const meanEntropyDrop = drops.length ? drops.reduce((a, b) => a + b, 0) / drops.length : 0

  let unsupportedClaims = 0
  let reasonsTrue = 0
  const claims = [...explanation.reasons, ...(explanation.avoided ? [explanation.avoided] : [])]
  for (const reason of claims) {
    if (reason.evidence.fromCraving) continue
    const e = s.profile.features.get(reason.featureId)
    const seen = reason.evidence.yesSeen + reason.evidence.noSeen
    const q = reason === explanation.avoided ? noQuantifier(reason.evidence.noSeen, seen) : yesQuantifier(reason.evidence.yesSeen, seen)
    if (!e || e.yesSeen !== reason.evidence.yesSeen || e.noSeen !== reason.evidence.noSeen || !q || !reason.text.includes(` ${q} `)) {
      unsupportedClaims++
    }
    if (reason !== explanation.avoided && persona.trueLikes.includes(reason.featureId)) reasonsTrue++
  }
  const swipeReasons = explanation.reasons.filter((x) => !x.evidence.fromCraving).length

  const offeringIds = [...cards.map((c) => c.offeringId), r.hero.offeringId, ...r.runnersUp.map((x) => x.offeringId)]
  let dietViolations = 0
  for (const id of offeringIds) {
    const o = catalogue.offerings.find((x) => x.id === id)!
    const a = catalogue.archetypes.find((x) => x.id === o.archetypeId)!
    if (!satisfiesDiet(effectiveDietary(a.dietary, o.overrides?.dietary), persona.diet)) dietViolations++
  }

  const metrics: SessionMetrics = {
    personaId: persona.id,
    policy,
    seed,
    swipes: r.swipes,
    stopReason: r.stopReason,
    hit1: truth.has(r.hero.archetypeId),
    acceptable: (() => {
      const c = pool.byArchetype.get(r.hero.archetypeId)!.find((x) => x.offering.id === r.hero.offeringId)!
      return persona.utility(c.archetype, c.offering) > persona.threshold
    })(),
    hit3: [r.hero, ...r.runnersUp].some((x) => truth.has(x.archetypeId)),
    regret,
    swipesToCorrect,
    featurePrecision,
    prematureLock,
    familiesFirst8,
    bothModes,
    pivots: s.pivot.used,
    pivotsRecovered,
    meanEntropyDrop,
    reasons: swipeReasons,
    reasonsTrue,
    unsupportedClaims,
    innocentBlame,
    totalBlame,
    dietViolations,
  }
  const ctx = personaContext(persona)
  const transcript: SessionTranscript = {
    input: { context: { ...ctx, now: ctx.now.toISOString() }, craving: persona.craving, seed },
    personaId: persona.id,
    policy,
    seed,
    truthTop3,
    cards,
    hero: r.hero.archetypeId,
    heroOffering: r.hero.offeringId,
    runnersUp: r.runnersUp.map((x) => x.archetypeId),
    stopReason: r.stopReason,
    confidenceLabel: r.confidenceLabel,
    headline: explanation.headline,
    reasons: explanation.reasons.map((x) => x.text),
    ...(explanation.avoided ? { avoided: explanation.avoided.text } : {}),
    events: s.events,
  }
  return { metrics, transcript }
}
