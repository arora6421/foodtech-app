import type { CravingSelection, GeoPoint, SessionContext } from '../../domain'
import { buildPool } from '../../engine/context/pool'
import { explainResult } from '../../engine/explain/explain'
import type { Explanation } from '../../engine/explain/explain'
import { createModel, initialState, replay, soloReducer, undo } from '../../engine/session/solo'
import type { CardChoice, SoloEvent, SoloState } from '../../engine/session/types'
import type { LoadedCatalogue } from './catalogueService'
import { configForRules, CURRENT_RULES } from './engineConfig'

// The ONLY app module that calls the engine's session API (m1-spec §3.2). The engine is a frozen
// baseline: this adapter consumes it read-only and never changes its behaviour.

/** Everything needed to recreate a session. Serialisable, so it can live in sessionStorage. */
export interface SessionInputDTO {
  context: Omit<SessionContext, 'now' | 'diet'> & { now: string; diet: SessionContext['diet'] }
  craving: CravingSelection
  seed: number
  /** Which engine rules the session was started under (engineConfig.ts). Absent = before the marker. */
  rules?: number
}

export function toContext(dto: SessionInputDTO): SessionContext {
  return { ...dto.context, now: new Date(dto.context.now) }
}

export function makeInput(
  origin: GeoPoint,
  now: Date,
  settings: Pick<SessionContext, 'fulfilment' | 'budget' | 'diet'>,
  craving: CravingSelection,
  seed: number,
): SessionInputDTO {
  return {
    context: {
      origin,
      now: now.toISOString(),
      fulfilment: settings.fulfilment,
      budget: settings.budget,
      diet: [...settings.diet],
    },
    craving: { moods: [...craving.moods], intent: craving.intent },
    seed,
    rules: CURRENT_RULES,
  }
}

type SettingsOnly = Pick<SessionContext, 'fulfilment' | 'budget' | 'diet'>

/** True if the session was started with exactly these settings (diet compared as a set). */
export function sameSettings(dto: SessionInputDTO, settings: SettingsOnly): boolean {
  const c = dto.context
  // Stored data can be corrupt: anything that isn't the expected shape simply doesn't match.
  if (!c || !Array.isArray(c.diet)) return false
  return (
    c.budget === settings.budget &&
    c.fulfilment === settings.fulfilment &&
    c.diet.length === settings.diet.length &&
    c.diet.every((d) => settings.diet.includes(d))
  )
}

function model(loaded: LoadedCatalogue, dto: SessionInputDTO) {
  return createModel({
    catalogue: loaded.catalogue,
    clustering: loaded.clustering,
    context: toContext(dto),
    craving: dto.craving,
    seed: dto.seed,
    config: configForRules(dto.rules),
  })
}

export function createSession(loaded: LoadedCatalogue, dto: SessionInputDTO): SoloState {
  return initialState(model(loaded, dto))
}

/** Rebuild a session from its event log (refresh recovery; MVP_SPEC §18). */
export function restoreSession(loaded: LoadedCatalogue, dto: SessionInputDTO, events: readonly SoloEvent[]): SoloState {
  return replay(model(loaded, dto), events)
}

// ── Branch pre-computation (MVP_SPEC §9.6) ────────────────────────────────
// The reducer is pure, so the state after a YES or a NOPE can be computed while the user is still
// looking at the card. Using the cached result is exactly equivalent to computing it fresh.
const branches = new WeakMap<SoloState, { yes?: SoloState; no?: SoloState }>()

/** Pre-compute the state after one answer, so that swipe applies instantly. */
export function precomputeBranch(state: SoloState, verdict: 'yes' | 'no'): void {
  if (!state.current || state.result) return
  const cached = branches.get(state) ?? {}
  cached[verdict] ??= soloReducer(state, { type: 'swipe', verdict })
  branches.set(state, cached)
}

export function precomputeBranches(state: SoloState): void {
  precomputeBranch(state, 'yes')
  precomputeBranch(state, 'no')
}

/** The next card after each possible answer, for image prefetching. Null when the session would end. */
export function nextCards(state: SoloState): { yes: CardChoice | null; no: CardChoice | null } {
  const b = branches.get(state)
  return { yes: b?.yes?.current ?? null, no: b?.no?.current ?? null }
}

export function applyEvent(state: SoloState, event: SoloEvent): SoloState {
  if (event.type === 'swipe') {
    const cached = branches.get(state)?.[event.verdict]
    if (cached) return cached
  }
  return soloReducer(state, event)
}

export function undoLast(state: SoloState): SoloState {
  return undo(state)
}

export function explanationFor(state: SoloState, archetypeId?: string): Explanation | undefined {
  return explainResult(state, archetypeId)
}

/** How many dishes survive the hard filters, for the "filters too tight" warning (MVP_SPEC §23). */
export function poolSize(loaded: LoadedCatalogue, dto: SessionInputDTO): { archetypes: number; offerings: number } {
  const pool = buildPool(loaded.catalogue, toContext(dto), dto.craving, configForRules(dto.rules))
  return { archetypes: pool.archetypeIds.length, offerings: pool.candidates.length }
}

export const FILTERS_TOO_TIGHT = 8
