import type { ArchetypeId } from '../../domain'
import { matchesMood } from '../deck/selectNext'
import { namespaceOf } from '../features/featurize'
import type { FeatureId } from '../features/featurize'
import { pref, swipeConfidence, view } from '../profile/profile'
import { finalRank } from '../scoring/scoring'
import type { ConfidenceLabel, SoloState, StopReason } from '../session/types'
import { MOOD_ADJECTIVES, adjectiveFor, nounFor } from './vocabulary'

// Evidence-backed explanations (MVP_SPEC §11). Every sentence is built from recorded
// counts, and the wording is limited by how much evidence there is.

export interface Reason {
  text: string
  featureId: FeatureId
  evidence: { yesSeen: number; noSeen: number; fromCraving: boolean }
}

export interface Explanation {
  confidenceLabel: ConfidenceLabel
  headline: string
  reasons: Reason[]
  avoided?: Reason
}

const MIN_PREF = 0.25
const MIN_SWIPE_CONFIDENCE = 0.35
const AVOID_PREF = -0.3
const AVOID_MIN_NO = 2

/**
 * The only quantifiers allowed for "said yes to Q of these" (§11.3). Returns undefined when
 * the evidence is too thin to support any claim.
 */
export function yesQuantifier(yes: number, seen: number): string | undefined {
  if (seen === 0 || yes === 0) return undefined
  if (yes === seen) {
    if (seen === 1) return undefined // a single YES is never a stand-alone reason
    return seen === 2 ? 'both' : `all ${seen}`
  }
  if (seen >= 3 && yes / seen >= 0.66) return `${yes} of ${seen}`
  return undefined
}

/** Same rules for "passed on Q of these". */
export function noQuantifier(no: number, seen: number): string | undefined {
  return yesQuantifier(no, seen)
}

function joinAdjectives(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

export function explain(state: SoloState, archetypeId: ArchetypeId, stopReason: StopReason, label: ConfidenceLabel): Explanation {
  const { pool, config, context, craving } = state.model
  const { profile } = state
  const archetype = pool.archetypes.get(archetypeId)!
  const breakdown = finalRank(profile, pool, archetypeId, context, config)

  // ── Reasons from swipe evidence ──────────────────────────────────────────
  const reasons: Reason[] = []
  const usedNamespaces = new Set<string>()
  for (const c of breakdown.contributions) {
    if (reasons.length === 3) break
    if (c.value <= 0 || c.pref < MIN_PREF) continue
    if (swipeConfidence(profile, c.featureId, config) < MIN_SWIPE_CONFIDENCE) continue
    const ns = namespaceOf(c.featureId)
    if (usedNamespaces.has(ns)) continue
    const noun = nounFor(c.featureId)
    const v = view(profile, c.featureId, config.gamma)
    const q = yesQuantifier(v.yesSeen, v.yesSeen + v.noSeen)
    if (!noun || !q) continue
    usedNamespaces.add(ns)
    reasons.push({
      text: `You said yes to ${q} ${noun}.`,
      featureId: c.featureId,
      evidence: { yesSeen: v.yesSeen, noSeen: v.noSeen, fromCraving: false },
    })
  }

  // ── One craving-backed reason, phrased as the user's own words ───────────
  const cravingMood = craving.intent === 'no_idea' ? undefined : craving.moods.find((m) => matchesMood(archetype, m))
  if (cravingMood && reasons.length < 3) {
    reasons.push({
      text: `You said you fancied something ${MOOD_ADJECTIVES[cravingMood]}.`,
      featureId: cravingMood === 'spicy' ? `spice:${archetype.axes.spice}` : `mood:${cravingMood}`,
      evidence: { yesSeen: 0, noSeen: 0, fromCraving: true },
    })
  }

  // ── What they steered clear of ───────────────────────────────────────────
  const heroFeatures = pool.baseVectors.get(archetypeId)!
  let avoided: Reason | undefined
  let lowest = AVOID_PREF
  for (const f of [...profile.features.keys()].sort()) {
    if (heroFeatures.has(f)) continue
    const p = pref(profile, f, config)
    const v = view(profile, f, config.gamma)
    const noun = nounFor(f)
    const q = noQuantifier(v.noSeen, v.yesSeen + v.noSeen)
    if (p <= lowest && v.noSeen >= AVOID_MIN_NO && noun && q) {
      lowest = p
      avoided = { text: `You passed on ${q} ${noun}.`, featureId: f, evidence: { yesSeen: v.yesSeen, noSeen: v.noSeen, fromCraving: false } }
    }
  }

  // ── Headline ─────────────────────────────────────────────────────────────
  const adjectives: string[] = []
  for (const c of breakdown.contributions) {
    if (adjectives.length === 3) break
    if (c.pref < MIN_PREF) continue
    const adj = adjectiveFor(c.featureId)
    if (adj && !adjectives.includes(adj)) adjectives.push(adj)
  }
  const swipeReasons = reasons.filter((r) => !r.evidence.fromCraving)
  let headline =
    adjectives.length >= 2
      ? `We think you're craving something ${joinAdjectives(adjectives)}.`
      : `We think you're in the mood for ${archetype.name.toLowerCase()}.`
  if (stopReason === 'user_picked') headline = swipeReasons.length > 0 ? 'Your call — and it fits.' : 'Your call.'
  else if (stopReason === 'decide_for_me' && swipeReasons.length === 0) headline = "Based on what you told us, we'd go for this."

  return { confidenceLabel: label, headline, reasons, ...(avoided ? { avoided } : {}) }
}

/** Explanation for the session's current result (or a promoted runner-up). */
export function explainResult(state: SoloState, archetypeId?: ArchetypeId): Explanation | undefined {
  const r = state.result
  if (!r) return undefined
  return explain(state, archetypeId ?? r.hero.archetypeId, r.stopReason, r.confidenceLabel)
}
