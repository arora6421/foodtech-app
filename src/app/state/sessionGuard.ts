import { effectiveDietary, satisfiesDiet } from '../../domain'
import type { DietConstraint } from '../../domain'
import type { SoloState } from '../../engine/session/types'
import { sameSettings } from '../services/engineAdapter'
import type { SessionInputDTO } from '../services/engineAdapter'
import type { LoadedCatalogue } from '../services/catalogueService'
import type { Settings } from './settingsStore'

// Two independent checks on a live session, run before anything from it is shown (deck and match).
//
//  1. settings_changed: the session was started under other settings than the ones in force now
//     (settings edited after leaving the deck with ×, in another tab, or a page reload that restored an
//     old session). The session is discarded, never carried on with settings the user no longer has.
//  2. diet_violation: a dish about to be shown fails the CURRENT diet. Diet is a hard rule with no
//     exceptions (MVP_SPEC §1.7), so this holds even if the session's own settings were wrong. It
//     re-derives the verdict from the dish's raw dietary facts, not from the engine's pool.
//
// Budget is deliberately not re-checked here: a session saved under the old soft-budget rules is
// replayed as it was (engineConfig.ts), so its dishes may legitimately sit above the new limit.

export type SessionProblem = 'settings_changed' | 'diet_violation'

/** Every offering the person would see from this state: the current card, or the whole match. */
export function shownOfferingIds(state: SoloState): string[] {
  const r = state.result
  if (!r) return state.current ? [state.current.offeringId] : []
  return [
    r.hero.offeringId,
    ...r.runnersUp.map((x) => x.offeringId),
    ...(r.pickList ?? []).map((x) => x.offeringId),
    ...r.alsoAt,
  ]
}

export function offeringFitsDiet(
  loaded: LoadedCatalogue,
  offeringId: string,
  diet: readonly DietConstraint[],
): boolean {
  const o = loaded.offerings.get(offeringId)
  const a = o && loaded.archetypes.get(o.archetypeId)
  if (!o || !a) return false // an unknown dish can't be shown as fitting
  return satisfiesDiet(effectiveDietary(a.dietary, o.overrides?.dietary), diet)
}

export function sessionProblem(
  loaded: LoadedCatalogue,
  state: SoloState,
  input: SessionInputDTO,
  settings: Settings,
): SessionProblem | null {
  if (!sameSettings(input, settings)) return 'settings_changed'
  for (const id of shownOfferingIds(state)) if (!offeringFitsDiet(loaded, id, settings.diet)) return 'diet_violation'
  return null
}
