import { createStore, useStore } from 'zustand'
import { ENGINE_VERSION } from '../../domain'
import type { CravingSelection, GeoPoint } from '../../domain'
import { MOCK_CATALOGUE_VERSION } from '../../catalog/mock/MockCatalog'
import type { LocationProvider } from '../../location/LocationProvider'
import { FixedLocationProvider } from '../../location/LocationProvider'
import type { SoloEvent, SoloState } from '../../engine/session/types'
import { track, setAnalyticsSession } from '../services/analytics'
import { loadCatalogue } from '../services/catalogueService'
import type { LoadedCatalogue } from '../services/catalogueService'
import {
  applyEvent,
  createSession,
  makeInput,
  poolSize,
  precomputeBranch,
  restoreSession,
  undoLast,
} from '../services/engineAdapter'
import type { SessionInputDTO } from '../services/engineAdapter'
import { readJSON, removeKey, STORAGE_KEYS, writeJSON } from '../services/storage'
import { settingsStore } from './settingsStore'
import type { Settings } from './settingsStore'
import type { MatchView } from './viewModels'

// The solo session (MVP_SPEC §18, m1-spec §3.1). Engine state is event-sourced: the store keeps the
// input and the event log, persists both to sessionStorage, and rebuilds by replay on reload.
// Runner-up inspection is UI state only (M1 decision): it never changes the engine's result.

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SoloSessionState {
  status: LoadStatus
  loaded: LoadedCatalogue | null
  origin: GeoPoint | null
  input: SessionInputDTO | null
  state: SoloState | null
  view: MatchView
  init(): Promise<void>
  /** Returns false (and starts nothing) if no dish survives the hard filters. */
  start(craving: CravingSelection): boolean
  swipe(verdict: 'yes' | 'no'): void
  pick(): void
  decide(): void
  notQuite(): void
  undo(): void
  reset(): void
  /** Inspect a runner-up (or a pick-list dish). Passing chosen=true skips straight to the chosen state. */
  viewAlternative(archetypeId: string, chosen?: boolean): void
  /** Dishes that survive the hard filters for this craving with the current settings. */
  eligibleCount(craving: CravingSelection): number | null
  chooseAlternative(): void
  returnToMatch(): void
}

export interface SoloStoreDeps {
  loadCatalogue: () => Promise<LoadedCatalogue>
  location: LocationProvider
  now: () => Date
  seed: () => number
  settings: () => Settings
  /** Defers pre-computation until the browser is idle. Tests pass a synchronous version. */
  schedule: (fn: () => void) => void
}

interface PersistedSession {
  engineVersion: string
  catalogueVersion: string
  input: SessionInputDTO
  events: SoloEvent[]
  view: MatchView
}

const isPersisted = (x: unknown): x is PersistedSession =>
  !!x &&
  typeof x === 'object' &&
  Array.isArray((x as PersistedSession).events) &&
  typeof (x as PersistedSession).input === 'object'

const randomSeed = () => {
  try {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!
  } catch {
    return Math.floor(Math.random() * 2 ** 32)
  }
}

const idle = (fn: () => void) => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
  if (ric) ric(fn)
  else setTimeout(fn, 30)
}

export const defaultDeps: SoloStoreDeps = {
  loadCatalogue: () => loadCatalogue(),
  location: new FixedLocationProvider(),
  now: () => new Date(),
  seed: randomSeed,
  settings: () => {
    const s = settingsStore.getState()
    return { diet: s.diet, budget: s.budget, fulfilment: s.fulfilment }
  },
  schedule: idle,
}

export function createSoloSessionStore(deps: SoloStoreDeps = defaultDeps) {
  const store = createStore<SoloSessionState>()((set, get) => {
    /** Commit a new engine state: persist, pre-compute the next branches, emit analytics. */
    const commit = (next: SoloState, before: SoloState | null, view: MatchView = get().view) => {
      set({ state: next, view })
      const input = get().input
      if (input) {
        const persisted: PersistedSession = {
          engineVersion: ENGINE_VERSION,
          catalogueVersion: MOCK_CATALOGUE_VERSION,
          input,
          events: [...next.events],
          view,
        }
        writeJSON('session', STORAGE_KEYS.session, persisted)
      }
      if (next.current && !next.result) {
        const c = next.current
        track('card_shown', {
          cardIndex: c.cardIndex,
          archetypeId: c.archetypeId,
          offeringId: c.offeringId,
          phase: c.phase,
          slot: c.slot,
          eig: Number(c.eig.toFixed(4)),
          counterShown: next.counter.shown,
          counterRaw: next.counter.raw,
        })
        // One idle task per branch, not one for both: a tap that lands mid-precompute waits for at
        // most one engine step (M1.7: halves the worst swipe latency at 4× CPU). Same results.
        deps.schedule(() => {
          if (get().state !== next) return
          precomputeBranch(next, 'yes')
          deps.schedule(() => {
            if (get().state === next) precomputeBranch(next, 'no')
          })
        })
      }
      if (before && next.pivot.used > before.pivot.used) {
        const log = next.pivot.log[next.pivot.log.length - 1]
        track('pivot_triggered', {
          cardIndex: next.swipes.length,
          pivotNumber: next.pivot.used,
          fromClusterId: log?.fromCluster ?? null,
          anchorArchetypeId: log?.anchorArchetypeId ?? null,
        })
      }
      if (next.result && !before?.result) {
        track('match_shown', {
          stopReason: next.result.stopReason,
          swipes: next.result.swipes,
          confidenceLabel: next.result.confidenceLabel,
          heroArchetypeId: next.result.hero.archetypeId,
          m3: Number(next.result.topMass3.toFixed(3)),
        })
      }
    }

    const dispatch = (event: SoloEvent) => {
      const s = get().state
      if (!s) return
      commit(applyEvent(s, event), s)
    }

    return {
      status: 'idle',
      loaded: null,
      origin: null,
      input: null,
      state: null,
      view: { kind: 'match' },

      async init() {
        if (get().status === 'loading' || get().status === 'ready') return
        set({ status: 'loading' })
        try {
          const [loaded, origin] = await Promise.all([deps.loadCatalogue(), deps.location.getCurrentLocation()])
          set({ loaded, origin, status: 'ready' })
          // Refresh recovery: replay a stored session if it was made by this engine and catalogue.
          const saved = readJSON('session', STORAGE_KEYS.session, isPersisted)
          if (saved) {
            let restored = false
            if (saved.engineVersion === ENGINE_VERSION && saved.catalogueVersion === MOCK_CATALOGUE_VERSION) {
              // A stored session that can't be replayed (corrupted or edited storage) must not take the
              // whole app down on every reload: drop it and start fresh instead.
              try {
                const state = restoreSession(loaded, saved.input, saved.events)
                set({ input: saved.input })
                setAnalyticsSession(String(saved.input.seed))
                commit(state, null, saved.view)
                restored = true
              } catch {
                set({ input: null, state: null, view: { kind: 'match' } })
              }
            }
            if (!restored) removeKey('session', STORAGE_KEYS.session)
          }
          track('app_opened', {})
        } catch {
          set({ status: 'error' })
        }
      },

      start(craving) {
        const { loaded, origin } = get()
        if (!loaded || !origin) return false
        const input = makeInput(origin, deps.now(), deps.settings(), craving, deps.seed())
        if (poolSize(loaded, input).archetypes === 0) return false
        set({ input, view: { kind: 'match' } })
        setAnalyticsSession(String(input.seed))
        track('craving_submitted', {
          moods: craving.moods.join(','),
          intent: craving.intent,
          diet: input.context.diet.join(','),
          budget: input.context.budget,
          fulfilment: input.context.fulfilment,
        })
        commit(createSession(loaded, input), null, { kind: 'match' })
        return true
      },

      swipe(verdict) {
        const s = get().state
        if (!s?.current || s.result) return
        track('swipe', { cardIndex: s.current.cardIndex, verdict })
        dispatch({ type: 'swipe', verdict })
      },
      pick() {
        dispatch({ type: 'pick' })
      },
      decide() {
        const s = get().state
        if (s && !s.result) track('decide_for_me', { cardIndex: s.swipes.length })
        dispatch({ type: 'decide' })
      },
      notQuite() {
        const s = get().state
        // Only meaningful on the engine's own pick; the UI never offers it while an alternative is shown.
        if (!s?.result || get().view.kind !== 'match') return
        track('match_action', { action: 'not_quite' })
        commit(applyEvent(s, { type: 'not_quite' }), s, { kind: 'match' })
      },
      undo() {
        const s = get().state
        if (!s || s.events.length === 0) return
        track('undo', { cardIndex: s.swipes.length })
        commit(undoLast(s), s, { kind: 'match' })
      },
      reset() {
        set({ input: null, state: null, view: { kind: 'match' } })
        removeKey('session', STORAGE_KEYS.session)
        setAnalyticsSession(null)
      },

      viewAlternative(archetypeId, chosen = false) {
        const s = get().state
        if (!s?.result) return
        track('match_action', { action: chosen ? 'choose_alternative' : 'view_alternative', archetypeId })
        commit(s, s, { kind: 'alternative', archetypeId, chosen })
      },
      eligibleCount(craving) {
        const { loaded, origin } = get()
        if (!loaded || !origin) return null
        return poolSize(loaded, makeInput(origin, deps.now(), deps.settings(), craving, 0)).archetypes
      },
      chooseAlternative() {
        const { state: s, view } = get()
        if (!s || view.kind !== 'alternative') return
        track('match_action', { action: 'choose_alternative', archetypeId: view.archetypeId })
        commit(s, s, { ...view, chosen: true })
      },
      returnToMatch() {
        const s = get().state
        if (!s) return
        track('match_action', { action: 'return_to_match' })
        commit(s, s, { kind: 'match' })
      },
    }
  })
  return store
}

export const soloSessionStore = createSoloSessionStore()
export const useSolo = <T>(selector: (s: SoloSessionState) => T) => useStore(soloSessionStore, selector)
