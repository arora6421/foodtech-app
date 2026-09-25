import { createHash } from 'node:crypto'
import type { EngineConfig } from '../engine/config'
import type { GroupMetrics } from './runGroup'
import type { SessionTranscript } from './runSession'

// Fingerprints for the frozen-baseline guard (M1). They cover only DISCRETE behaviour
// (which card, which offering, verdict, phase, slot, stop reason, hero, runners-up and
// explanation text), never raw floats, so they detect behaviour changes rather than
// last-digit arithmetic noise.

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)

export interface SessionRecord {
  seed: number
  fp: string
  /** Card sequence as "archetype+" / "archetype-", space-separated: lets a diff name the first divergence. */
  cards: string
  swipes: number
  stop: string
  hero: string
}

export function sessionRecord(t: SessionTranscript): SessionRecord {
  const canonical = JSON.stringify({
    cards: t.cards.map((c) => [c.archetypeId, c.offeringId, c.verdict, c.phase, c.slot]),
    stop: t.stopReason,
    label: t.confidenceLabel,
    hero: t.hero,
    heroOffering: t.heroOffering,
    runnersUp: t.runnersUp,
    headline: t.headline,
    reasons: t.reasons,
    avoided: t.avoided ?? null,
  })
  return {
    seed: t.seed,
    fp: sha(canonical),
    cards: t.cards.map((c) => `${c.archetypeId}${c.verdict === 'yes' ? '+' : '-'}`).join(' '),
    swipes: t.cards.length,
    stop: t.stopReason,
    hero: t.hero,
  }
}

export interface GroupRecord {
  seed: number
  fp: string
  outcome: string
  hero: string
  final: string
}

export function groupRecord(g: GroupMetrics): GroupRecord {
  const canonical = JSON.stringify([g.outcome, g.heroId, g.finalId, g.deterministic, g.dietViolations])
  return { seed: g.seed, fp: sha(canonical), outcome: g.outcome, hero: g.heroId, final: g.finalId }
}

export function configHash(config: EngineConfig): string {
  return sha(JSON.stringify(config))
}
