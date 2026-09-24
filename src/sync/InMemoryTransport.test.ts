import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../engine/rng'
import { CODE_ALPHABET, GroupError } from './GroupTransport'
import type { GroupErrorCode, NewMember } from './GroupTransport'
import { InMemoryTransport } from './InMemoryTransport'

// Contract tests for GroupTransport (MVP_SPEC §19). The Supabase transport must pass these too.

const versions = { engineVersion: 'e1', catalogueVersion: 'c1' }
const m = (name: string): NewMember => ({ name, diet: [], craving: { moods: [], intent: 'normal' } })
const deck = [{ archetypeId: 'bibimbap', offeringId: 'hanok-house-dolsot-bibimbap' }]
const settings = { fulfilment: 'either' as const, budget: 'any' as const }

async function lobby() {
  const t = new InMemoryTransport(mulberry32(5))
  const { sessionId, code, memberId: host } = await t.createSession({ host: m('Host'), settings, seed: 1, versions })
  const { memberId: guest } = await t.joinSession(code, m('Guest'), versions)
  return { t, sessionId, code, host, guest }
}

const rejects = async (p: Promise<unknown>, code: GroupErrorCode) => {
  await expect(p).rejects.toBeInstanceOf(GroupError)
  await expect(p).rejects.toMatchObject({ code })
}

describe('InMemoryTransport contract', () => {
  it('issues 6-character codes without ambiguous characters', async () => {
    const { code } = await lobby()
    expect(code).toHaveLength(6)
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch)
    expect(code).not.toMatch(/[01OI]/)
  })

  it('refuses version mismatches, full sessions and unknown codes', async () => {
    const { t, code } = await lobby()
    await rejects(t.joinSession(code, m('X'), { ...versions, engineVersion: 'e2' }), 'version_mismatch')
    await rejects(t.joinSession('ZZZZZZ', m('X'), versions), 'not_found')
    for (let i = 0; i < 4; i++) await t.joinSession(code, m(`P${i}`), versions)
    await rejects(t.joinSession(code, m('Seventh'), versions), 'full')
  })

  it('suffixes duplicate names', async () => {
    const { t, code, sessionId } = await lobby()
    await t.joinSession(code, m('Guest'), versions)
    expect((await t.getSnapshot(sessionId)).members.map((x) => x.name)).toContain('Guest 2')
  })

  it('only the host can start, only once everyone is ready, and the deck is write-once', async () => {
    const { t, sessionId, host, guest } = await lobby()
    await rejects(t.startSession(sessionId, host, deck), 'not_ready')
    await t.updateMember(sessionId, host, { ready: true })
    await t.updateMember(sessionId, guest, { ready: true })
    await rejects(t.startSession(sessionId, guest, deck), 'not_host')
    await t.startSession(sessionId, host, deck)
    const snap = await t.getSnapshot(sessionId)
    expect(snap.status).toBe('swiping')
    expect(snap.sharedDeck).toEqual(deck)
    await rejects(t.startSession(sessionId, host, []), 'deck_already_written')
  })

  it('needs at least two members to start', async () => {
    const t = new InMemoryTransport(mulberry32(2))
    const { sessionId, memberId } = await t.createSession({ host: m('Solo'), settings, seed: 1, versions })
    await t.updateMember(sessionId, memberId, { ready: true })
    await rejects(t.startSession(sessionId, memberId, deck), 'too_few_members')
  })

  it('closes joining at Start (rev. 2)', async () => {
    const { t, sessionId, code, host, guest } = await lobby()
    await t.updateMember(sessionId, host, { ready: true })
    await t.updateMember(sessionId, guest, { ready: true })
    await t.startSession(sessionId, host, deck)
    await rejects(t.joinSession(code, m('Late'), versions), 'already_started')
  })

  it('upserts swipes on (member, cardIndex) so resends and undos never duplicate', async () => {
    const { t, sessionId, host, guest } = await lobby()
    await t.updateMember(sessionId, host, { ready: true })
    await t.updateMember(sessionId, guest, { ready: true })
    await t.startSession(sessionId, host, deck)
    const swipe = { memberId: guest, cardIndex: 0, ...deck[0]!, verdict: 'yes' as const }
    await t.submitSwipe(sessionId, swipe)
    await t.submitSwipe(sessionId, swipe)
    await t.submitSwipe(sessionId, { ...swipe, verdict: 'no' })
    const swipes = (await t.getSnapshot(sessionId)).swipes
    expect(swipes).toHaveLength(1)
    expect(swipes[0]!.verdict).toBe('no')
  })

  it('pushes every change to subscribers', async () => {
    const { t, sessionId, host } = await lobby()
    const seen: string[] = []
    const off = t.subscribe(sessionId, (s) => seen.push(s.members.find((x) => x.id === host)!.ready ? 'ready' : 'waiting'))
    await t.updateMember(sessionId, host, { ready: true })
    off()
    await t.updateMember(sessionId, host, { ready: false })
    expect(seen).toEqual(['ready'])
  })
})
