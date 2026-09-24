import type {
  GroupMember,
  GroupSettings,
  GroupSnapshot,
  GroupStatus,
  GroupSwipe,
  GroupVote,
  SharedCard,
} from '../engine/group/types'

// The only way group state moves between devices (MVP_SPEC §19.1). The engine never sees
// this interface; the app feeds snapshots from it into pure engine functions.

export type NewMember = Pick<GroupMember, 'name' | 'diet' | 'craving'>

export interface ClientVersions {
  engineVersion: string
  catalogueVersion: string
}

export interface GroupTransport {
  createSession(input: {
    host: NewMember
    settings: GroupSettings
    seed: number
    versions: ClientVersions
  }): Promise<{ sessionId: string; code: string; memberId: string }>
  joinSession(code: string, member: NewMember, versions: ClientVersions): Promise<{ sessionId: string; memberId: string }>
  updateMember(sessionId: string, memberId: string, patch: Partial<NewMember & { ready: boolean }>): Promise<void>
  /** Host only: writes the shared deck and flips status to 'swiping' in one step. The deck is write-once. */
  startSession(sessionId: string, memberId: string, sharedDeck: SharedCard[]): Promise<void>
  /** Idempotent on (memberId, cardIndex): a resend or an undo overwrites, never duplicates. */
  submitSwipe(sessionId: string, swipe: GroupSwipe): Promise<void>
  submitVote(sessionId: string, vote: GroupVote): Promise<void>
  /** Host only. `forced` records "Show results now". */
  setStatus(sessionId: string, memberId: string, status: GroupStatus, forced?: boolean): Promise<void>
  getSnapshot(sessionId: string): Promise<GroupSnapshot>
  subscribe(sessionId: string, onSnapshot: (s: GroupSnapshot) => void): () => void
}

export type GroupErrorCode =
  | 'not_found'
  | 'already_started'
  | 'not_host'
  | 'deck_already_written'
  | 'too_few_members'
  | 'not_ready'
  | 'full'
  | 'version_mismatch'
  | 'not_swiping'

export class GroupError extends Error {
  constructor(readonly code: GroupErrorCode) {
    super(code)
    this.name = 'GroupError'
  }
}

/** 6 characters, no 0/O/1/I (MVP_SPEC §19.2, §22). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
