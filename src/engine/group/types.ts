import type {
  ArchetypeId,
  Budget,
  CravingSelection,
  DietConstraint,
  Fulfilment,
  OfferingId,
  Verdict,
} from '../../domain'
import type { FeatureId } from '../features/featurize'

// The shared group snapshot (MVP_SPEC §12, §19.2). Plain data: the same shape lives in
// Supabase in M2 and in the in-memory transport today.

export type GroupStatus = 'lobby' | 'swiping' | 'results' | 'final_round' | 'done'

export interface GroupMember {
  id: string
  name: string
  diet: DietConstraint[]
  craving: CravingSelection
  ready: boolean
}

export interface GroupSettings {
  fulfilment: Fulfilment
  budget: Budget
}

export interface SharedCard {
  archetypeId: ArchetypeId
  offeringId: OfferingId
}

export interface GroupSwipe {
  memberId: string
  cardIndex: number
  archetypeId: ArchetypeId
  offeringId: OfferingId
  verdict: Verdict
}

export interface GroupVote {
  memberId: string
  archetypeId: ArchetypeId
  approve: boolean
}

export interface GroupSnapshot {
  sessionId: string
  code: string
  seed: number
  engineVersion: string
  catalogueVersion: string
  status: GroupStatus
  hostMemberId: string
  settings: GroupSettings
  members: GroupMember[]
  /** Written once by the host at Start (rev. 2). Members read it; they never compute it. */
  sharedDeck: SharedCard[] | null
  swipes: GroupSwipe[]
  votes: GroupVote[]
  /** The host pressed "Show results now". */
  forced: boolean
}

export type GroupOutcome = 'WINNER' | 'COMMON_GROUND' | 'NOBODY_AGREES'

export interface GroupPick {
  archetypeId: ArchetypeId
  offeringId: OfferingId
  groupScore: number
  minMemberScore: number
  memberScores: Record<string, number>
}

export interface GroupResult {
  outcome: GroupOutcome
  hero: GroupPick
  /** Top 3, diverse; the final-round ballot. */
  finalRound: GroupPick[]
  unanimous: boolean
  commonGround: FeatureId[]
  conflicts: FeatureId[]
  /** Members left out for having fewer than the minimum swipes (named in the UI). */
  excludedMembers: string[]
  vetoedCount: number
  vetoesLifted: boolean
  relaxed: boolean
}

export interface FinalRoundOutcome {
  winner: GroupPick
  approvals: Record<ArchetypeId, number>
  /** Nobody approved anything: "Fine. We picked for you." */
  pickedForYou: boolean
}
