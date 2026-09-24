import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { ArchetypeId, SessionContext } from '../../domain'
import { MOCK_CATALOGUE } from '../../catalog/mock/MockCatalog'
import { ANGEL_N1 } from '../../location/LocationProvider'
import { DEFAULT_CONFIG as C } from '../config'
import { buildPool } from '../context/pool'
import type { FeatureVector } from '../features/featurize'
import { applySwipe, emptyProfile, withPriors } from '../profile/profile'
import type { Profile } from '../profile/profile'
import { belief, taste } from '../scoring/scoring'
import { buildInfoGainModel } from './infoGain'

const ctx: SessionContext = {
  origin: ANGEL_N1,
  now: new Date('2026-09-24T19:30:00Z'),
  fulfilment: 'either',
  budget: 'any',
  diet: [],
}
const pool = buildPool(MOCK_CATALOGUE, ctx, { moods: [], intent: 'normal' }, C)
const ids = pool.archetypeIds
const vectorOf = (id: ArchetypeId) => pool.baseVectors.get(id)!

/** Reference implementation: apply the swipe for real and recompute everything. */
function slowEig(profile: Profile, hyp: readonly ArchetypeId[], card: ArchetypeId, pYes: number): number {
  const entropy = (p: Profile, set: readonly ArchetypeId[]) =>
    belief(set, set.map((id) => taste(p, vectorOf(id), C)), C.beta).entropy
  const now = entropy(profile, hyp)
  const yes = entropy(applySwipe(profile, vectorOf(card), 'yes', C), hyp)
  const no = entropy(
    applySwipe(profile, vectorOf(card), 'no', C),
    hyp.filter((id) => id !== card),
  )
  return now - (pYes * yes + (1 - pYes) * no)
}

describe('incremental EIG', () => {
  it('property: matches the slow reference on random histories', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(...ids), fc.boolean()), { maxLength: 8 }),
        fc.constantFrom(...ids),
        (history, card) => {
          let p = withPriors(emptyProfile(), { moods: ['spicy', 'comforting'], intent: 'normal' }, C)
          for (const [id, yes] of history) p = applySwipe(p, vectorOf(id), yes ? 'yes' : 'no', C)
          const pYes = Math.min(0.95, Math.max(0.05, 0.5 + taste(p, vectorOf(card), C)))
          const fast = buildInfoGainModel(p, ids, vectorOf, C.beta, C).eig(card, vectorOf(card), pYes)
          expect(fast).toBeCloseTo(slowEig(p, ids, card, pYes), 9)
        },
      ),
      { numRuns: 60 },
    )
  })

  it('on a flat belief, prefers a card that splits the space over a niche one', () => {
    const model = buildInfoGainModel(emptyProfile(), ids, vectorOf, C.beta, C)
    const niche: FeatureVector = new Map([['cuisine:west_african', 1]])
    const broad = vectorOf('chicken-katsu-curry') // many widely shared features
    expect(model.eig('x', broad, 0.5)).toBeGreaterThan(model.eig('y', niche, 0.5))
  })

  it('computes a full deck of EIGs quickly', () => {
    let p = withPriors(emptyProfile(), { moods: ['spicy'], intent: 'normal' }, C)
    for (const id of ids.slice(0, 6)) p = applySwipe(p, vectorOf(id), 'yes', C)
    const start = performance.now()
    const model = buildInfoGainModel(p, ids, vectorOf, C.beta, C)
    for (const id of ids) model.eig(id, vectorOf(id), 0.5)
    expect(performance.now() - start).toBeLessThan(50)
  })
})
