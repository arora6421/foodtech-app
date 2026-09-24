import type { GroupSnapshot, GroupStatus, GroupSwipe, GroupVote, SharedCard } from '../engine/group/types'
import { CODE_ALPHABET, GroupError } from './GroupTransport'
import type { ClientVersions, GroupTransport, NewMember } from './GroupTransport'

// A faithful in-process implementation of the group rules, for tests, simulations and
// local development. The Supabase transport (M2) must pass the same contract tests.

const MAX_MEMBERS = 6
const MIN_MEMBERS = 2

export class InMemoryTransport implements GroupTransport {
  private sessions = new Map<string, GroupSnapshot>()
  private listeners = new Map<string, Set<(s: GroupSnapshot) => void>>()
  private nextId = 1

  /** `rng` only picks join codes; inject a seeded one for reproducible tests. */
  constructor(private readonly rng: () => number = Math.random) {}

  private id(prefix: string) {
    return `${prefix}-${this.nextId++}`
  }

  private get(sessionId: string): GroupSnapshot {
    const s = this.sessions.get(sessionId)
    if (!s) throw new GroupError('not_found')
    return s
  }

  private commit(next: GroupSnapshot) {
    this.sessions.set(next.sessionId, next)
    for (const cb of this.listeners.get(next.sessionId) ?? []) cb(structuredClone(next))
  }

  private newCode(): string {
    for (;;) {
      let code = ''
      for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(this.rng() * CODE_ALPHABET.length)]
      if (![...this.sessions.values()].some((s) => s.code === code)) return code
    }
  }

  async createSession(input: { host: NewMember; settings: GroupSnapshot['settings']; seed: number; versions: ClientVersions }) {
    const sessionId = this.id('session')
    const memberId = this.id('member')
    const code = this.newCode()
    this.commit({
      sessionId,
      code,
      seed: input.seed,
      engineVersion: input.versions.engineVersion,
      catalogueVersion: input.versions.catalogueVersion,
      status: 'lobby',
      hostMemberId: memberId,
      settings: input.settings,
      members: [{ id: memberId, ...input.host, ready: false }],
      sharedDeck: null,
      swipes: [],
      votes: [],
      forced: false,
    })
    return { sessionId, code, memberId }
  }

  async joinSession(code: string, member: NewMember, versions: ClientVersions) {
    const s = [...this.sessions.values()].find((x) => x.code === code.toUpperCase())
    if (!s) throw new GroupError('not_found')
    if (s.engineVersion !== versions.engineVersion || s.catalogueVersion !== versions.catalogueVersion) {
      throw new GroupError('version_mismatch')
    }
    if (s.status !== 'lobby') throw new GroupError('already_started')
    if (s.members.length >= MAX_MEMBERS) throw new GroupError('full')
    const memberId = this.id('member')
    // Duplicate names get a suffix ("Sam 2").
    const taken = new Set(s.members.map((m) => m.name))
    let name = member.name
    for (let i = 2; taken.has(name); i++) name = `${member.name} ${i}`
    this.commit({ ...s, members: [...s.members, { id: memberId, ...member, name, ready: false }] })
    return { sessionId: s.sessionId, memberId }
  }

  async updateMember(sessionId: string, memberId: string, patch: Partial<NewMember & { ready: boolean }>) {
    const s = this.get(sessionId)
    if (s.status !== 'lobby') throw new GroupError('already_started')
    this.commit({ ...s, members: s.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)) })
  }

  async startSession(sessionId: string, memberId: string, sharedDeck: SharedCard[]) {
    const s = this.get(sessionId)
    if (memberId !== s.hostMemberId) throw new GroupError('not_host')
    if (s.sharedDeck !== null) throw new GroupError('deck_already_written')
    if (s.status !== 'lobby') throw new GroupError('already_started')
    if (s.members.length < MIN_MEMBERS) throw new GroupError('too_few_members')
    if (!s.members.every((m) => m.ready)) throw new GroupError('not_ready')
    this.commit({ ...s, sharedDeck, status: 'swiping' })
  }

  async submitSwipe(sessionId: string, swipe: GroupSwipe) {
    const s = this.get(sessionId)
    if (s.status !== 'swiping') throw new GroupError('not_swiping')
    const others = s.swipes.filter((x) => !(x.memberId === swipe.memberId && x.cardIndex === swipe.cardIndex))
    this.commit({ ...s, swipes: [...others, swipe] })
  }

  async submitVote(sessionId: string, vote: GroupVote) {
    const s = this.get(sessionId)
    const others = s.votes.filter((v) => !(v.memberId === vote.memberId && v.archetypeId === vote.archetypeId))
    this.commit({ ...s, votes: [...others, vote] })
  }

  async setStatus(sessionId: string, memberId: string, status: GroupStatus, forced = false) {
    const s = this.get(sessionId)
    if (memberId !== s.hostMemberId) throw new GroupError('not_host')
    this.commit({ ...s, status, forced: s.forced || forced })
  }

  async getSnapshot(sessionId: string) {
    return structuredClone(this.get(sessionId))
  }

  subscribe(sessionId: string, onSnapshot: (s: GroupSnapshot) => void) {
    const set = this.listeners.get(sessionId) ?? new Set()
    set.add(onSnapshot)
    this.listeners.set(sessionId, set)
    return () => set.delete(onSnapshot)
  }
}
