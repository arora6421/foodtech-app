import { describe, expect, it } from 'vitest'
import { effectiveDietary, satisfiesDiet } from '../domain'
import type { DishArchetype } from '../domain'
import { MOCK_CATALOGUE, MOCK_CATALOGUE_VERSION } from '../catalog/mock/MockCatalog'
import { ANGEL_N1 } from '../location/LocationProvider'
import { InMemoryTransport } from './InMemoryTransport'
import type { NewMember } from './GroupTransport'
import { mulberry32 } from '../engine/rng'
import { clusterArchetypes } from '../engine/clusters/clusters'
import { DEFAULT_CONFIG as C } from '../engine/config'
import { ENGINE_VERSION } from '../domain'
import { computeGroupResult, groupModel, nextMemberCard, resolveFinalRound, sharedGroupDeck } from '../engine/group/group'
import type { GroupResult, GroupSnapshot } from '../engine/group/types'

const NOW = new Date('2026-09-24T19:30:00Z')
const clustering = clusterArchetypes(MOCK_CATALOGUE, C)
const versions = { engineVersion: ENGINE_VERSION, catalogueVersion: MOCK_CATALOGUE_VERSION }
const archetype = (id: string) => MOCK_CATALOGUE.archetypes.find((a) => a.id === id)!

type Taste = (a: DishArchetype) => boolean
interface SimMember {
  member: NewMember
  likes: Taste
  /** Stop after this many swipes (to simulate someone who never finishes). */
  quitAfter?: number
}

/** Runs a whole group through the transport, the way M2's clients will. */
async function playGroup(sims: SimMember[], seed = 11, settings = { fulfilment: 'either' as const, budget: 'any' as const }) {
  const t = new InMemoryTransport(mulberry32(seed))
  const [host, ...rest] = sims
  const { sessionId, memberId: hostId } = await t.createSession({ host: host!.member, settings, seed, versions })
  const ids = [hostId]
  for (const s of rest) ids.push((await t.joinSession((await t.getSnapshot(sessionId)).code, s.member, versions)).memberId)
  for (const id of ids) await t.updateMember(sessionId, id, { ready: true })

  // Host computes and writes the shared deck (rev. 2).
  let snap = await t.getSnapshot(sessionId)
  const g = groupModel(snap, MOCK_CATALOGUE, ANGEL_N1, NOW, C, clustering)
  await t.startSession(sessionId, hostId, sharedGroupDeck(g))

  // Members swipe in lock-step; each reads its next card from the latest snapshot.
  const seenByMember = new Map<string, string[]>()
  for (let round = 0; round < C.group.sharedCards + C.group.personalCards; round++) {
    for (let i = 0; i < sims.length; i++) {
      if (sims[i]!.quitAfter !== undefined && round >= sims[i]!.quitAfter!) continue
      snap = await t.getSnapshot(sessionId)
      const card = nextMemberCard(g, snap, ids[i]!)
      if (!card) continue
      seenByMember.set(ids[i]!, [...(seenByMember.get(ids[i]!) ?? []), card.archetypeId])
      await t.submitSwipe(sessionId, {
        memberId: ids[i]!,
        cardIndex: round,
        ...card,
        verdict: sims[i]!.likes(archetype(card.archetypeId)) ? 'yes' : 'no',
      })
    }
  }
  snap = await t.getSnapshot(sessionId)
  return { t, sessionId, hostId, ids, snap, g, seenByMember, result: computeGroupResult(g, snap)! }
}

const m = (name: string, over: Partial<NewMember> = {}): NewMember => ({
  name,
  diet: [],
  craving: { moods: [], intent: 'normal' },
  ...over,
})
const spicy: Taste = (a) => a.axes.spice >= 3
const noodles: Taste = (a) => a.format === 'noodles'
const light: Taste = (a) => a.axes.richness <= 1
const everything: Taste = () => true

describe('shared deck (rev. 2, MVP_SPEC §12.3)', () => {
  it('is 6 distinct, deterministic cards', async () => {
    const { snap, g } = await playGroup([{ member: m('A'), likes: spicy }, { member: m('B'), likes: spicy }])
    expect(snap.sharedDeck).toHaveLength(6)
    expect(new Set(snap.sharedDeck!.map((c) => c.archetypeId)).size).toBe(6)
    expect(sharedGroupDeck(g)).toEqual(snap.sharedDeck)
  })

  it('every member sees exactly the host-written cards first (card parity)', async () => {
    const { snap, seenByMember } = await playGroup([
      { member: m('A'), likes: spicy },
      { member: m('B'), likes: light },
      { member: m('C'), likes: noodles },
    ])
    const shared = snap.sharedDeck!.map((c) => c.archetypeId)
    for (const seen of seenByMember.values()) expect(seen.slice(0, 6)).toEqual(shared)
  })

  it('members read the snapshot: a tampered deck is what they see, not a recomputed one', async () => {
    const t = new InMemoryTransport(mulberry32(1))
    const { sessionId, memberId } = await t.createSession({ host: m('A'), settings: { fulfilment: 'either', budget: 'any' }, seed: 1, versions })
    const { memberId: b } = await t.joinSession((await t.getSnapshot(sessionId)).code, m('B'), versions)
    await t.updateMember(sessionId, memberId, { ready: true })
    await t.updateMember(sessionId, b, { ready: true })
    const g = groupModel(await t.getSnapshot(sessionId), MOCK_CATALOGUE, ANGEL_N1, NOW, C, clustering)
    const deck = [...sharedGroupDeck(g)].reverse()
    await t.startSession(sessionId, memberId, deck)
    expect(nextMemberCard(g, await t.getSnapshot(sessionId), b)).toEqual(deck[0])
  })

  it('personal cards (7–12) adapt to each member', async () => {
    const { seenByMember, ids } = await playGroup([{ member: m('A'), likes: spicy }, { member: m('B'), likes: light }])
    const a = seenByMember.get(ids[0]!)!.slice(6)
    const b = seenByMember.get(ids[1]!)!.slice(6)
    expect(a).toHaveLength(6)
    expect(a).not.toEqual(b)
  })
})

describe('group aggregation (MVP_SPEC §12.4–12.5)', () => {
  it('everyone likes everything → a unanimous WINNER', async () => {
    const { result } = await playGroup([{ member: m('A'), likes: everything }, { member: m('B'), likes: everything }])
    expect(result.outcome).toBe('WINNER')
    expect(result.unanimous).toBe(true)
  })

  it('shared tastes → a hero that fits them, with common ground named', async () => {
    const { result } = await playGroup([
      { member: m('A'), likes: spicy },
      { member: m('B'), likes: spicy },
      { member: m('C'), likes: (a) => spicy(a) || noodles(a) },
    ])
    expect(['WINNER', 'COMMON_GROUND']).toContain(result.outcome)
    expect(archetype(result.hero.archetypeId).axes.spice).toBeGreaterThanOrEqual(3)
    expect(result.commonGround.some((f) => f === 'spice:3' || f === 'spice:4')).toBe(true)
  })

  // One opposed axis dilutes to 'meh', not misery (taste averages ~12 features), so a light-lover and a
  // heavy-lover can legitimately land on COMMON_GROUND. Genuine disagreement is measured by the group
  // personas in the sims; this test pins the compromise path itself.
  it('a group that rejects everything → NOBODY_AGREES, relaxed, maximising the least-happy member', async () => {
    const { result } = await playGroup([{ member: m('A'), likes: () => false }, { member: m('B'), likes: () => false }])
    expect(result.outcome).toBe('NOBODY_AGREES')
    expect(result.relaxed).toBe(true)
    const [first, ...rest] = result.finalRound
    for (const r of rest) expect(first!.minMemberScore).toBeGreaterThanOrEqual(r.minMemberScore)
  })

  it('never picks something any included member NOPEd (unless vetoes had to be lifted)', async () => {
    const { result, snap } = await playGroup([{ member: m('A'), likes: spicy }, { member: m('B'), likes: noodles }])
    if (!result.vetoesLifted) {
      const noped = new Set(snap.swipes.filter((s) => s.verdict === 'no').map((s) => s.archetypeId))
      for (const p of [result.hero, ...result.finalRound]) expect(noped.has(p.archetypeId)).toBe(false)
    }
  })

  it('respects the union of diets for every card and every pick', async () => {
    const { result, snap } = await playGroup([
      { member: m('Vegan', { diet: ['vegan'] }), likes: spicy },
      { member: m('Meat', { diet: [] }), likes: everything },
    ])
    const offerings = [...snap.swipes.map((s) => s.offeringId), result.hero.offeringId, ...result.finalRound.map((p) => p.offeringId)]
    for (const id of offerings) {
      const o = MOCK_CATALOGUE.offerings.find((x) => x.id === id)!
      expect(satisfiesDiet(effectiveDietary(archetype(o.archetypeId).dietary, o.overrides?.dietary), ['vegan'])).toBe(true)
    }
  })

  it('leaves out and names members with fewer than 6 swipes', async () => {
    const { result, ids } = await playGroup([
      { member: m('A'), likes: spicy },
      { member: m('B'), likes: spicy },
      { member: m('Sam'), likes: light, quitAfter: 3 },
    ])
    expect(result.excludedMembers).toEqual([ids[2]])
    expect(Object.keys(result.hero.memberScores)).not.toContain(ids[2])
  })

  it('is identical on every client, whatever order the snapshot arrives in', async () => {
    const { snap, g, result } = await playGroup([
      { member: m('A'), likes: spicy },
      { member: m('B'), likes: light },
      { member: m('C'), likes: noodles },
    ])
    const shuffled: GroupSnapshot = { ...snap, members: [...snap.members].reverse(), swipes: [...snap.swipes].reverse() }
    expect(computeGroupResult(g, shuffled)).toEqual(result)
  })
})

describe('final round (MVP_SPEC §12.6)', () => {
  const fake = (): GroupResult => ({
    outcome: 'NOBODY_AGREES',
    hero: pick('a', 0.1, 0.0),
    finalRound: [pick('a', 0.1, 0.0), pick('b', 0.3, -0.05), pick('c', 0.2, 0.05)],
    unanimous: false,
    commonGround: [],
    conflicts: [],
    excludedMembers: [],
    vetoedCount: 0,
    vetoesLifted: false,
    relaxed: true,
  })
  const pick = (id: string, G: number, min: number) => ({ archetypeId: id, offeringId: `${id}-o`, groupScore: G, minMemberScore: min, memberScores: {} })

  it('picks the most approved', () => {
    const r = resolveFinalRound(fake(), [
      { memberId: 'x', archetypeId: 'c', approve: true },
      { memberId: 'y', archetypeId: 'c', approve: true },
      { memberId: 'y', archetypeId: 'a', approve: true },
    ])
    expect(r.winner.archetypeId).toBe('c')
    expect(r.pickedForYou).toBe(false)
  })
  it('breaks ties by group score', () => {
    const r = resolveFinalRound(fake(), [
      { memberId: 'x', archetypeId: 'a', approve: true },
      { memberId: 'y', archetypeId: 'b', approve: true },
    ])
    expect(r.winner.archetypeId).toBe('b')
  })
  it('with zero approvals, picks for them by the least-happy member', () => {
    const r = resolveFinalRound(fake(), [{ memberId: 'x', archetypeId: 'a', approve: false }])
    expect(r.pickedForYou).toBe(true)
    expect(r.winner.archetypeId).toBe('c')
  })
})
