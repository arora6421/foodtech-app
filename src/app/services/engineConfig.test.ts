// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine/config'
import type * as ClustersModule from '../../engine/clusters/clusters'
import type * as PoolModule from '../../engine/context/pool'
import type * as SoloModule from '../../engine/session/solo'
import { ANGEL_N1, FixedLocationProvider } from '../../location/LocationProvider'
import { createSoloSessionStore } from '../state/soloSessionStore'
import { loadCatalogue, resetCatalogueCache } from './catalogueService'
import {
  APP_ENGINE_CONFIG,
  configForRules,
  CURRENT_RULES,
  RULES_SOFT_BUDGET,
  RULES_STRICT_BUDGET,
} from './engineConfig'

// Every call into the engine goes through one config constant. Two nets: a scan of the app's source
// (so a new call site that forgets the config fails here), and a spy on the real engine entry points
// while a full session runs (so the config that actually arrives is the one the app means to use).

vi.mock('../../engine/session/solo', async (importOriginal) => {
  const m = await importOriginal<typeof SoloModule>()
  return { ...m, createModel: vi.fn(m.createModel) }
})
vi.mock('../../engine/context/pool', async (importOriginal) => {
  const m = await importOriginal<typeof PoolModule>()
  return { ...m, buildPool: vi.fn(m.buildPool) }
})
vi.mock('../../engine/clusters/clusters', async (importOriginal) => {
  const m = await importOriginal<typeof ClustersModule>()
  return { ...m, clusterArchetypes: vi.fn(m.clusterArchetypes) }
})

const { createModel } = await import('../../engine/session/solo')
const { buildPool } = await import('../../engine/context/pool')
const { clusterArchetypes } = await import('../../engine/clusters/clusters')

describe('the app engine config', () => {
  it('differs from the frozen baseline config in exactly one value: the budget cap', () => {
    expect(DEFAULT_CONFIG.budgetHardCapMultiple).toBe(1.3) // the baseline is untouched
    expect(APP_ENGINE_CONFIG.budgetHardCapMultiple).toBe(1)
    expect({ ...APP_ENGINE_CONFIG, budgetHardCapMultiple: 1.3 }).toEqual(DEFAULT_CONFIG)
  })

  it('picks the rules a session was started under; a record with no marker is a soft-budget session', () => {
    expect(configForRules(undefined)).toBe(DEFAULT_CONFIG)
    expect(configForRules(RULES_SOFT_BUDGET)).toBe(DEFAULT_CONFIG)
    expect(configForRules(RULES_STRICT_BUDGET)).toBe(APP_ENGINE_CONFIG)
    expect(configForRules(CURRENT_RULES)).toBe(APP_ENGINE_CONFIG)
    expect(CURRENT_RULES).toBe(RULES_STRICT_BUDGET)
  })
})

// ── Net 1: the source ─────────────────────────────────────────────────────

const APP = join(process.cwd(), 'src', 'app')
function sources(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'debug' ? [] : sources(p) // the debug tools are dev-only and replay arbitrary configs on purpose
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : []
  })
}

/** The text of each call to `name(`, up to its closing paren. */
function calls(source: string, name: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(new RegExp(`\\b${name}\\(`, 'g'))) {
    let depth = 0
    let i = m.index! + name.length
    for (; i < source.length; i++) {
      if (source[i] === '(') depth++
      else if (source[i] === ')' && --depth === 0) break
    }
    out.push(source.slice(m.index!, i + 1))
  }
  return out
}

const ENTRY_POINTS = ['createModel', 'buildPool', 'clusterArchetypes', 'createSoloSession'] as const
/** Engine entry-point calls in `source` that don't take their config from engineConfig.ts. */
function callsWithoutSharedConfig(source: string): string[] {
  return ENTRY_POINTS.flatMap((name) =>
    calls(source, name).filter((c) => !/configForRules\(|APP_ENGINE_CONFIG/.test(c)),
  )
}

describe('no call into the engine can skip the shared config', () => {
  it('the check itself works: it flags a call with no config, or with the baseline config', () => {
    expect(callsWithoutSharedConfig('createModel({ catalogue, context })')).toHaveLength(1)
    expect(callsWithoutSharedConfig('buildPool(c, ctx, craving, DEFAULT_CONFIG)')).toHaveLength(1)
    expect(callsWithoutSharedConfig('createModel({ config: configForRules(dto.rules) })')).toHaveLength(0)
    expect(callsWithoutSharedConfig('clusterArchetypes(catalogue, APP_ENGINE_CONFIG)')).toHaveLength(0)
  })

  it('every engine entry-point call in the app passes the shared config', () => {
    const bad = sources().flatMap((f) =>
      callsWithoutSharedConfig(readFileSync(f, 'utf8')).map((c) => `${relative(APP, f)}: ${c}`),
    )
    expect(bad).toEqual([])
  })

  it('only engineConfig.ts touches DEFAULT_CONFIG', () => {
    const users = sources().filter((f) => /\bDEFAULT_CONFIG\b/.test(readFileSync(f, 'utf8')))
    expect(users.map((f) => relative(APP, f).replace(/\\/g, '/'))).toEqual(['services/engineConfig.ts'])
  })

  it('only the adapter and the catalogue service import the engine session, pool and cluster modules', () => {
    const importers = sources()
      .filter((f) =>
        /from '(\.\.\/)+engine\/(session\/solo|context\/pool|clusters\/clusters)'/.test(readFileSync(f, 'utf8')),
      )
      .map((f) => relative(APP, f).replace(/\\/g, '/'))
    expect(importers.sort()).toEqual(['services/catalogueService.ts', 'services/engineAdapter.ts'])
  })
})

// ── Net 2: what actually reaches the engine ───────────────────────────────

describe('at runtime, every engine call receives the app config', () => {
  beforeEach(() => {
    resetCatalogueCache()
    vi.mocked(createModel).mockClear()
    vi.mocked(buildPool).mockClear()
    vi.mocked(clusterArchetypes).mockClear()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('across load, counting, start, swipes, undo, a reload restore and a budget preview', async () => {
    const deps = () => ({
      loadCatalogue: () => loadCatalogue(),
      location: new FixedLocationProvider(ANGEL_N1),
      now: () => new Date('2026-09-24T19:30:00Z'),
      seed: () => 7,
      settings: () => ({ diet: ['vegetarian' as const], budget: 'mid' as const, fulfilment: 'either' as const }),
      schedule: (fn: () => void) => fn(),
    })
    const store = createSoloSessionStore(deps())
    await store.getState().init()
    store.getState().eligibleCount({ moods: [], intent: 'normal' })
    store.getState().eligibleCount({ moods: [], intent: 'normal' }, { budget: 'high' })
    expect(store.getState().start({ moods: ['spicy'], intent: 'normal' })).toBe(true)
    for (const v of ['yes', 'no', 'no'] as const) store.getState().swipe(v)
    store.getState().undo()
    // A reload: a second store restores the stored session by replaying it.
    const reloaded = createSoloSessionStore(deps())
    await reloaded.getState().init()
    expect(reloaded.getState().state).not.toBeNull()

    const configs = [
      ...vi.mocked(clusterArchetypes).mock.calls.map((c) => c[1]),
      ...vi.mocked(buildPool).mock.calls.map((c) => c[3]),
      ...vi.mocked(createModel).mock.calls.map((c) => c[0].config),
    ]
    expect(vi.mocked(clusterArchetypes)).toHaveBeenCalled()
    expect(vi.mocked(buildPool)).toHaveBeenCalled()
    expect(vi.mocked(createModel)).toHaveBeenCalled()
    for (const config of configs) expect(config).toBe(APP_ENGINE_CONFIG)
  })
})
