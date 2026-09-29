// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'motion/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ENGINE_VERSION } from '../../domain'
import { MOCK_CATALOGUE_VERSION } from '../../catalog/mock/MockCatalog'
import { ANGEL_N1, FixedLocationProvider } from '../../location/LocationProvider'
import { loadCatalogue } from '../services/catalogueService'
import type { LoadedCatalogue } from '../services/catalogueService'
import { applyEvent, createSession, makeInput } from '../services/engineAdapter'
import { APP_ENGINE_CONFIG, CURRENT_RULES } from '../services/engineConfig'
import { STORAGE_KEYS } from '../services/storage'
import { DeckScreen } from '../screens/DeckScreen'
import { MatchScreen } from '../screens/MatchScreen'
import { withMotion } from '../testing/withMotion'
import { sessionProblem } from './sessionGuard'
import { settingsStore } from './settingsStore'
import type { Settings } from './settingsStore'
import { createSoloSessionStore, soloSessionStore } from './soloSessionStore'
import type { SoloStoreDeps } from './soloSessionStore'

// The session must always match the settings on screen, and diet must hold no matter what the
// session says about itself. Screens are rendered the way App renders them.

const NOW = new Date('2026-09-24T19:30:00Z')
const CRAVING = { moods: [], intent: 'normal' } as const
const DEFAULTS: Settings = { diet: [], budget: 'any', fulfilment: 'either' }

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

let loaded: LoadedCatalogue
beforeEach(async () => {
  sessionStorage.clear()
  localStorage.clear()
  act(() => settingsStore.setState(DEFAULTS))
  await soloSessionStore.getState().init()
  soloSessionStore.getState().reset()
  loaded = soloSessionStore.getState().loaded!
})
afterEach(cleanup)

const deps = (settings: () => Settings = () => DEFAULTS): SoloStoreDeps => ({
  loadCatalogue: () => loadCatalogue(),
  location: new FixedLocationProvider(ANGEL_N1),
  now: () => NOW,
  seed: () => 11,
  settings,
  schedule: (fn) => fn(),
})

const isVegan = (offeringId: string) => {
  const o = loaded.offerings.get(offeringId)!
  return loaded.archetypes.get(o.archetypeId)!.dietary.vegan
}

/** The deck as App routes it, with a Craving stub that links back (the browser's Back, or the × then forward). */
function renderApp(start: '/deck' | '/match' = '/deck') {
  return render(
    withMotion(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/deck" element={<DeckScreen />} />
          <Route path="/match" element={<MatchScreen />} />
          <Route
            path="/craving"
            element={
              <p>
                craving screen <Link to="/deck">back to the deck</Link>
              </p>
            }
          />
        </Routes>
      </MemoryRouter>,
    ),
  )
}
const topCard = () => document.querySelector<HTMLElement>('.swipe-card:not([inert]) .dish-card')

describe('changing settings mid-session restarts the deck', () => {
  it('× leaves the session alive, but coming back after a settings change discards it', async () => {
    const user = userEvent.setup()
    expect(soloSessionStore.getState().start(CRAVING)).toBe(true)
    renderApp()
    expect(topCard()).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Close' })) // ×: to the Craving screen
    expect(screen.getByText(/craving screen/)).toBeTruthy()
    expect(soloSessionStore.getState().state).not.toBeNull() // × alone does not end the session

    act(() => settingsStore.getState().setDiet(['vegan']))
    await user.click(screen.getByRole('link', { name: 'back to the deck' })) // Back / forward to /deck

    await waitFor(() => expect(soloSessionStore.getState().state).toBeNull()) // discarded, not resumed
    expect(screen.getByText(/craving screen/)).toBeTruthy() // sent back to choose again
    expect(topCard()).toBeNull() // no card from the old session was shown

    // Starting again uses the new settings, and every card honours them.
    expect(soloSessionStore.getState().start(CRAVING)).toBe(true)
    expect(soloSessionStore.getState().input!.context.diet).toEqual(['vegan'])
    for (let i = 0; i < 12 && !soloSessionStore.getState().state!.result; i++) {
      expect(isVegan(soloSessionStore.getState().state!.current!.offeringId)).toBe(true)
      soloSessionStore.getState().swipe(i % 3 === 0 ? 'yes' : 'no')
    }
  })

  it('× then back with the settings UNCHANGED resumes the same session', async () => {
    const user = userEvent.setup()
    soloSessionStore.getState().start(CRAVING)
    const first = soloSessionStore.getState().state!.current!.offeringId
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('link', { name: 'back to the deck' }))
    expect(soloSessionStore.getState().state!.current!.offeringId).toBe(first)
    expect(topCard()).not.toBeNull()
  })

  it.each([
    ['diet', () => settingsStore.getState().setDiet(['vegetarian'])],
    ['budget', () => settingsStore.getState().setBudget('low')],
    ['eating', () => settingsStore.getState().setFulfilment('go_out')],
  ])('a change to %s while the deck is showing throws the session away', async (_name, change) => {
    soloSessionStore.getState().start(CRAVING)
    renderApp()
    expect(topCard()).not.toBeNull()
    act(() => change())
    await waitFor(() => expect(soloSessionStore.getState().state).toBeNull())
    expect(screen.getByText(/craving screen/)).toBeTruthy()
  })

  it('the same holds on the match screen', async () => {
    soloSessionStore.getState().start(CRAVING)
    for (let i = 0; i < 20 && !soloSessionStore.getState().state!.result; i++)
      soloSessionStore.getState().swipe(i % 3 === 0 ? 'yes' : 'no')
    expect(soloSessionStore.getState().state!.result).not.toBeNull()
    act(() => settingsStore.getState().setDiet(['pescatarian']))
    renderApp('/match')
    await waitFor(() => expect(soloSessionStore.getState().state).toBeNull())
    expect(screen.getByText(/craving screen/)).toBeTruthy()
  })

  it('a page reload does not restore a session started under other settings', async () => {
    const a = createSoloSessionStore(deps())
    await a.getState().init()
    a.getState().start(CRAVING)
    a.getState().swipe('no')
    expect(sessionStorage.getItem(STORAGE_KEYS.session)).not.toBeNull()

    for (const changed of [
      { ...DEFAULTS, diet: ['vegan' as const] },
      { ...DEFAULTS, budget: 'mid' as const },
      { ...DEFAULTS, fulfilment: 'delivery' as const },
    ]) {
      const b = createSoloSessionStore(deps(() => changed))
      await b.getState().init()
      expect(b.getState().state, JSON.stringify(changed)).toBeNull()
      expect(b.getState().status).toBe('ready')
      expect(sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull() // and it is forgotten
      // put it back for the next round
      const again = createSoloSessionStore(deps())
      await again.getState().init()
      again.getState().start(CRAVING)
    }
  })

  it('a page reload with the same settings (diet listed in another order) restores the session', async () => {
    const two = { ...DEFAULTS, diet: ['vegetarian' as const, 'no_pork' as const] }
    const a = createSoloSessionStore(deps(() => two))
    await a.getState().init()
    a.getState().start(CRAVING)
    a.getState().swipe('yes')
    const b = createSoloSessionStore(deps(() => ({ ...two, diet: ['no_pork', 'vegetarian'] })))
    await b.getState().init()
    expect(b.getState().state!.events).toEqual(a.getState().state!.events)
  })
})

describe('diet holds at the moment a dish is shown, even if the session is wrong', () => {
  /** A session started with NO diet, dressed up as if it had been started with the current diet. */
  function tamperedSession() {
    soloSessionStore.getState().start(CRAVING)
    for (let i = 0; i < 12 && isVegan(soloSessionStore.getState().state!.current!.offeringId); i++)
      soloSessionStore.getState().swipe('no')
    expect(isVegan(soloSessionStore.getState().state!.current!.offeringId)).toBe(false) // a card a vegan must never see
    act(() => settingsStore.getState().setDiet(['vegan']))
    const input = soloSessionStore.getState().input!
    act(() => soloSessionStore.setState({ input: { ...input, context: { ...input.context, diet: ['vegan'] } } }))
  }

  it('the guard reports it, independently of the session settings check', () => {
    tamperedSession()
    const { state, input } = soloSessionStore.getState()
    expect(sessionProblem(loaded, state!, input!, settingsStore.getState())).toBe('diet_violation')
  })

  it('the deck never renders the breaking card, and the session is discarded', async () => {
    tamperedSession()
    const shown = soloSessionStore.getState().state!.current!.offeringId
    renderApp()
    expect(topCard()).toBeNull() // not even for one frame
    expect(document.body.textContent).not.toContain(loaded.offerings.get(shown)!.name)
    await waitFor(() => expect(soloSessionStore.getState().state).toBeNull())
    expect(screen.getByText(/craving screen/)).toBeTruthy()
  })

  it('the match screen never renders a breaking dish either', async () => {
    // A finished session whose match includes a dish a vegan must not see (seeds are random: retry).
    let hero = ''
    for (let attempt = 0; attempt < 20 && !hero; attempt++) {
      soloSessionStore.getState().reset()
      soloSessionStore.getState().start(CRAVING)
      for (let i = 0; i < 25 && !soloSessionStore.getState().state!.result; i++)
        soloSessionStore.getState().swipe(i % 3 === 0 ? 'yes' : 'no')
      const r = soloSessionStore.getState().state!.result!
      if ([r.hero, ...r.runnersUp].some((x) => !isVegan(x.offeringId)))
        hero = loaded.offerings.get(r.hero.offeringId)!.name
    }
    expect(hero).not.toBe('')
    act(() => settingsStore.getState().setDiet(['vegan']))
    const input = soloSessionStore.getState().input!
    act(() => soloSessionStore.setState({ input: { ...input, context: { ...input.context, diet: ['vegan'] } } }))
    renderApp('/match')
    expect(document.body.textContent).not.toContain(hero) // nothing of the match on screen
    expect(document.querySelector('h1')).toBeNull()
    await waitFor(() => expect(soloSessionStore.getState().state).toBeNull())
    expect(screen.getByText(/craving screen/)).toBeTruthy()
  })
})

describe('sessions saved before the version marker still load, under the rules they started with', () => {
  const settings: Settings = { diet: [], budget: 'low', fulfilment: 'either' }
  const legacyRecord = (mutate: (input: Record<string, unknown>) => void = () => {}) => {
    const input = makeInput(ANGEL_N1, NOW, settings, CRAVING, 5) as unknown as Record<string, unknown>
    delete input.rules // exactly what a record written before this change looks like
    mutate(input)
    let s = createSession(loaded, input as never)
    for (const v of ['no', 'yes', 'no'] as const) s = applyEvent(s, { type: 'swipe', verdict: v })
    return {
      input,
      s,
      record: {
        engineVersion: ENGINE_VERSION,
        catalogueVersion: MOCK_CATALOGUE_VERSION,
        input,
        events: s.events,
        view: { kind: 'match' },
      },
    }
  }
  const above = (ids: Iterable<string>) => [...ids].filter((id) => loaded.offerings.get(id)!.pricePence > 1000)

  it('a record with no marker restores with its cards intact, under the old (soft) budget rules', async () => {
    const { s, record } = legacyRecord()
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(record))
    const store = createSoloSessionStore(deps(() => settings))
    await store.getState().init()

    const restored = store.getState().state!
    expect(store.getState().status).toBe('ready')
    expect(restored.events).toEqual(s.events)
    expect(restored.current).toEqual(s.current)
    expect(restored.model.config.budgetHardCapMultiple).toBe(1.3)
    expect(above(restored.model.pool.candidates.map((c) => c.offering.id)).length).toBeGreaterThan(0) // as it was
    store.getState().swipe('no') // and it carries on
    expect(store.getState().state!.events).toHaveLength(s.events.length + 1)
  })

  it('it stays a soft-budget session across further reloads, and no marker is invented for it', async () => {
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(legacyRecord().record))
    const first = createSoloSessionStore(deps(() => settings))
    await first.getState().init()
    first.getState().swipe('no')
    const second = createSoloSessionStore(deps(() => settings))
    await second.getState().init()
    expect(second.getState().state!.model.config.budgetHardCapMultiple).toBe(1.3)
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.session)!).input.rules).toBeUndefined()
  })

  it('an unreadable marker falls back to the old rules rather than breaking', async () => {
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(legacyRecord((i) => (i.rules = 'banana')).record))
    const store = createSoloSessionStore(deps(() => settings))
    await store.getState().init()
    expect(store.getState().status).toBe('ready')
    expect(store.getState().state).not.toBeNull()
    expect(store.getState().state!.model.config.budgetHardCapMultiple).toBe(1.3)
  })

  it('a new session is stamped with the current rules, uses the strict budget, and restores as such', async () => {
    const store = createSoloSessionStore(deps(() => settings))
    await store.getState().init()
    expect(store.getState().start(CRAVING)).toBe(true)
    const record = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.session)!)
    expect(record.input.rules).toBe(CURRENT_RULES)
    expect(store.getState().state!.model.config).toBe(APP_ENGINE_CONFIG)
    expect(above(store.getState().state!.model.pool.candidates.map((c) => c.offering.id))).toEqual([]) // nothing over £10

    const reloaded = createSoloSessionStore(deps(() => settings))
    await reloaded.getState().init()
    expect(reloaded.getState().state!.model.config).toBe(APP_ENGINE_CONFIG)
    expect(reloaded.getState().state!.events).toEqual(store.getState().state!.events)
  })
})
