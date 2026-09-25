import { describe, expect, it } from 'vitest'
import { soloReducer } from '../../engine/session/solo'
import { ANGEL_N1 } from '../../location/LocationProvider'
import { loadCatalogue } from './catalogueService'
import {
  applyEvent,
  createSession,
  makeInput,
  nextCards,
  poolSize,
  precomputeBranches,
  restoreSession,
} from './engineAdapter'
import { readJSON, writeJSON } from './storage'

const NOW = new Date('2026-09-24T19:30:00Z')
const settings = { diet: [] as never[], budget: 'any' as const, fulfilment: 'either' as const }
const input = makeInput(ANGEL_N1, NOW, settings, { moods: ['spicy'], intent: 'normal' }, 42)

describe('engineAdapter (read-only consumer of the frozen engine)', () => {
  it('restores a session from its events exactly (refresh recovery)', async () => {
    const loaded = await loadCatalogue()
    let s = createSession(loaded, input)
    for (const verdict of ['yes', 'no', 'no', 'yes'] as const) s = applyEvent(s, { type: 'swipe', verdict })
    const restored = restoreSession(loaded, input, s.events)
    expect(restored.swipes).toEqual(s.swipes)
    expect(restored.current).toEqual(s.current)
    expect(restored.counter).toEqual(s.counter)
  })

  it('a pre-computed branch is exactly the fresh reducer result', async () => {
    const loaded = await loadCatalogue()
    const s = createSession(loaded, input)
    precomputeBranches(s)
    for (const verdict of ['yes', 'no'] as const) {
      const fresh = soloReducer(s, { type: 'swipe', verdict })
      const cached = applyEvent(s, { type: 'swipe', verdict })
      expect(cached.current).toEqual(fresh.current)
      expect(cached.swipes).toEqual(fresh.swipes)
      expect(cached.counter).toEqual(fresh.counter)
    }
    expect(nextCards(s).yes).toEqual(soloReducer(s, { type: 'swipe', verdict: 'yes' }).current)
  })

  it('the input survives a JSON round trip (it lives in sessionStorage)', async () => {
    const loaded = await loadCatalogue()
    const roundTripped = JSON.parse(JSON.stringify(input))
    expect(createSession(loaded, roundTripped).current).toEqual(createSession(loaded, input).current)
  })

  it('poolSize reflects the hard filters', async () => {
    const loaded = await loadCatalogue()
    const all = poolSize(loaded, input)
    const vegan = poolSize(
      loaded,
      makeInput(ANGEL_N1, NOW, { ...settings, diet: ['vegan'] }, { moods: [], intent: 'normal' }, 1),
    )
    expect(vegan.archetypes).toBeLessThan(all.archetypes)
    expect(vegan.archetypes).toBeGreaterThan(0)
  })
})

describe('storage wrapper', () => {
  it('never throws when storage is unavailable (node has none)', () => {
    expect(readJSON('local', 'x', (v): v is number => typeof v === 'number')).toBeNull()
    expect(writeJSON('session', 'x', 1)).toBe(false)
  })
})
