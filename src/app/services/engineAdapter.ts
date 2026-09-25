import type { CravingSelection, GeoPoint, SessionContext } from '../../domain'
import { DEFAULT_CONFIG } from '../../engine/config'
import { buildPool } from '../../engine/context/pool'
import { explainResult } from '../../engine/explain/explain'
import type { Explanation } from '../../engine/explain/explain'
import { createModel, initialState, replay, soloReducer, undo } from '../../engine/session/solo'
import type { CardChoice, SoloEvent, SoloState } from '../../engine/session/types'
import type { LoadedCatalogue } from './catalogueService'

// The ONLY app module that calls the engine's session API (m1-spec §3.2). The engine is a frozen
// baseline: this adapter consumes it read-only and never changes its behaviour.

/** Everything needed to recreate a session. Serialisable, so it can live in sessionStorage. */
export interface SessionInputDTO {
  context: Omit<SessionContext, 'now' | 'diet'> & { now: string; diet: SessionContext['diet'] }
  craving: CravingSelection
  seed: number
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
  }
}

function model(loaded: LoadedCatalogue, dto: SessionInputDTO) {
  return createModel({
    catalogue: loaded.catalogue,
    clustering: loaded.clustering,
    context: toContext(dto),
    craving: dto.craving,
    seed: dto.seed,
    config: DEFAULT_CONFIG,
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

export function precomputeBranches(state: SoloState): void {
  if (!state.current || state.result) return
  const cached = branches.get(state) ?? {}
  cached.yes ??= soloReducer(state, { type: 'swipe', verdict: 'yes' })
  cached.no ??= soloReducer(state, { type: 'swipe', verdict: 'no' })
  branches.set(state, cached)
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
  const pool = buildPool(loaded.catalogue, toContext(dto), dto.craving, DEFAULT_CONFIG)
  return { archetypes: pool.archetypeIds.length, offerings: pool.candidates.length }
}

export const FILTERS_TOO_TIGHT = 8
