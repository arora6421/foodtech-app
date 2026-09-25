// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { ENGINE_VERSION } from '../../domain'
import { ANGEL_N1, FixedLocationProvider } from '../../location/LocationProvider'
import { loadCatalogue } from '../services/catalogueService'
import { STORAGE_KEYS } from '../services/storage'
import { createSavedStore } from './savedStore'
import { createSettingsStore } from './settingsStore'
import { createSoloSessionStore } from './soloSessionStore'
import type { SoloStoreDeps } from './soloSessionStore'
import { matchModel, counterModel, currentCard, priceLabel, distanceLabel } from './viewModels'

const deps = (over: Partial<SoloStoreDeps> = {}): SoloStoreDeps => ({
  loadCatalogue: () => loadCatalogue(),
  location: new FixedLocationProvider(ANGEL_N1),
  now: () => new Date('2026-09-24T19:30:00Z'),
  seed: () => 7,
  settings: () => ({ diet: [], budget: 'any', fulfilment: 'either' }),
  schedule: (fn) => fn(),
  ...over,
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

async function finishedSession() {
  const store = createSoloSessionStore(deps())
  await store.getState().init()
  store.getState().start({ moods: ['spicy'], intent: 'normal' })
  for (let i = 0; i < 20 && !store.getState().state!.result; i++) store.getState().swipe(i % 3 === 0 ? 'yes' : 'no')
  return store
}

describe('soloSessionStore', () => {
  it('starts, swipes and persists the event log', async () => {
    const store = createSoloSessionStore(deps())
    await store.getState().init()
    expect(store.getState().status).toBe('ready')
    expect(store.getState().start({ moods: ['spicy'], intent: 'normal' })).toBe(true)
    store.getState().swipe('yes')
    store.getState().swipe('no')
    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.session)!)
    expect(persisted.events).toHaveLength(2)
    expect(persisted.engineVersion).toBe(ENGINE_VERSION)
  })

  it('a reload restores the identical session by replay', async () => {
    const a = createSoloSessionStore(deps())
    await a.getState().init()
    a.getState().start({ moods: ['comforting'], intent: 'normal' })
    for (const v of ['yes', 'no', 'yes'] as const) a.getState().swipe(v)
    const b = createSoloSessionStore(deps())
    await b.getState().init()
    expect(b.getState().state!.swipes).toEqual(a.getState().state!.swipes)
    expect(b.getState().state!.current).toEqual(a.getState().state!.current)
  })

  it('discards a stored session from a different engine version', async () => {
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ engineVersion: 'old', catalogueVersion: 'x', input: {}, events: [], view: { kind: 'match' } }))
    const store = createSoloSessionStore(deps())
    await store.getState().init()
    expect(store.getState().state).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull()
  })

  it('undo from the match screen goes back to the deck', async () => {
    const store = await finishedSession()
    expect(store.getState().state!.result).not.toBeNull()
    store.getState().undo()
    expect(store.getState().state!.result).toBeNull()
    expect(store.getState().state!.current).not.toBeNull()
  })

  it('runner-up inspection is UI-only: the engine result never changes, and Not quite is ignored there', async () => {
    const store = await finishedSession()
    const result = store.getState().state!.result!
    const alt = result.runnersUp[0]!.archetypeId
    store.getState().viewAlternative(alt)
    const loaded = store.getState().loaded!
    const m = matchModel(loaded, store.getState().state!, store.getState().view)!
    expect(m.mode).toBe('alternative')
    expect(m.hero.archetypeId).toBe(alt)
    store.getState().notQuite() // not offered in this view; must be a no-op
    expect(store.getState().state!.result).toBe(result)
    store.getState().chooseAlternative()
    expect(matchModel(loaded, store.getState().state!, store.getState().view)!.mode).toBe('chosen-alternative')
    store.getState().returnToMatch()
    expect(matchModel(loaded, store.getState().state!, store.getState().view)!.hero.archetypeId).toBe(result.hero.archetypeId)
    expect(store.getState().state!.result).toBe(result)
  })

  it('refuses to start when no dish survives the filters', async () => {
    // Manchester: every mock venue is ~160 miles away, so nothing is eligible.
    const store = createSoloSessionStore(deps({ location: new FixedLocationProvider({ lat: 53.4808, lng: -2.2426 }) }))
    await store.getState().init()
    expect(store.getState().start({ moods: [], intent: 'normal' })).toBe(false)
    expect(store.getState().state).toBeNull()
  })
})

describe('settings and saved stores', () => {
  it('persist and reload', () => {
    const s = createSettingsStore()
    s.getState().setDiet(['vegan', 'no_pork'])
    s.getState().setFulfilment('go_out')
    const again = createSettingsStore()
    expect(again.getState().diet).toEqual(['vegan', 'no_pork'])
    expect(again.getState().fulfilment).toBe('go_out')
  })

  it('ignores corrupt stored settings', () => {
    localStorage.setItem(STORAGE_KEYS.settings, '{"diet":["martian"],"budget":"any","fulfilment":"either"}')
    expect(createSettingsStore().getState().diet).toEqual([])
  })

  it('saves once per dish and removes', () => {
    const s = createSavedStore()
    const item = { archetypeId: 'a', offeringId: 'o', archetypeName: 'A', offeringName: 'O', venueName: 'V', priceLabel: '£1.00', tint: '#000000' }
    s.getState().save(item)
    s.getState().save(item)
    expect(s.getState().items).toHaveLength(1)
    expect(createSavedStore().getState().has('a', 'o')).toBe(true)
    s.getState().remove(s.getState().items[0]!.id)
    expect(s.getState().items).toHaveLength(0)
  })
})

describe('view models', () => {
  it('format prices and distances', () => {
    expect(priceLabel(1395)).toBe('£13.95')
    expect(distanceLabel(2.24)).toBe('2.2 mi')
  })

  it('describe the current card fully for screen readers', async () => {
    const store = createSoloSessionStore(deps())
    await store.getState().init()
    store.getState().start({ moods: [], intent: 'normal' })
    const { loaded, state } = store.getState()
    const card = currentCard(loaded!, state!, state!.current!)
    expect(card.a11yLabel).toContain(card.offeringName)
    expect(card.a11yLabel).toContain(card.priceLabel)
    expect(card.a11yLabel).toMatch(/Spice \d of 4/)
    expect(counterModel(state!).label).toMatch(/^\d+ left$/)
  })
})
