import type {
  ArchetypeId,
  Catalogue,
  CravingSelection,
  OfferingId,
  SessionContext,
  VenueId,
  Verdict,
} from '../../domain'
import type { Clustering } from '../clusters/clusters'
import type { EngineConfig } from '../config'
import type { Pool } from '../context/pool'
import type { Profile } from '../profile/profile'
import type { ScoreBreakdown } from '../scoring/scoring'

export interface SessionInput {
  catalogue: Catalogue
  context: SessionContext
  craving: CravingSelection
  seed: number
  config?: EngineConfig
  /** Clustering depends only on the catalogue + config; pass a cached one to skip recomputing. */
  clustering?: Clustering
}

/** Everything fixed for the life of a session. */
export interface SessionModel {
  pool: Pool
  clustering: Clustering
  context: SessionContext
  craving: CravingSelection
  seed: number
  config: EngineConfig
  /** Cosine similarity between eligible archetypes: similarity.get(a)!.get(b). */
  similarity: ReadonlyMap<ArchetypeId, ReadonlyMap<ArchetypeId, number>>
}

export type Phase = 'probe' | 'narrow' | 'confirm'
export type Slot = 'normal' | 'adjacency' | 'anchor'

export interface CardChoice {
  /** 0-based position in the deck. */
  cardIndex: number
  archetypeId: ArchetypeId
  offeringId: OfferingId
  venueId: VenueId
  phase: Phase
  slot: Slot
  eig: number
  finalRank: number
  value: number
  /** Chosen while the silent pivot was flattening the belief. */
  flattened: boolean
}

export interface SwipeRecord {
  card: CardChoice
  verdict: Verdict
}

export interface PivotLogEntry {
  atSwipe: number
  fromCluster: number
  anchorArchetypeId?: ArchetypeId
}

export interface PivotState {
  streak: number
  used: number
  flattenRemaining: number
  anchorPending: boolean
  log: readonly PivotLogEntry[]
}

export type StopReason =
  | 'confident'
  | 'converged'
  | 'max_reached'
  | 'pool_exhausted'
  | 'user_picked'
  | 'decide_for_me'
  | 'pick_list'

export type ConfidenceLabel = 'Strong match' | 'Good match' | 'Best guess'

export interface StopCheck {
  top: ArchetypeId | null
  topMass3: number
  support: boolean
  stable: boolean
}

export interface SessionResult {
  stopReason: StopReason
  confidenceLabel: ConfidenceLabel
  hero: ScoreBreakdown
  runnersUp: ScoreBreakdown[]
  /** Only after a second "Not quite": the top options to choose from. */
  pickList: ScoreBreakdown[] | null
  /** Other eligible offerings of the hero archetype (≤ 2). */
  alsoAt: OfferingId[]
  swipes: number
  topMass3: number
}

export type SoloEvent =
  | { type: 'swipe'; verdict: 'yes' | 'no' }
  | { type: 'pick' }
  | { type: 'decide' }
  | { type: 'not_quite' }

export interface SoloState {
  model: SessionModel
  /** Applied events only: replaying them reproduces this state exactly. */
  events: readonly SoloEvent[]
  profile: Profile
  swipes: readonly SwipeRecord[]
  excluded: ReadonlySet<ArchetypeId>
  current: CardChoice | null
  pivot: PivotState
  /** Top-3 archetypes at each stop check, oldest first. */
  topHistory: readonly (readonly ArchetypeId[])[]
  lastCheck: StopCheck | null
  counter: { raw: number; shown: number }
  notQuite: { count: number; extension: number; atSwipe: number | null }
  result: SessionResult | null
}
