import { useEffect, useMemo } from 'react'
import { sessionProblem } from '../state/sessionGuard'
import type { SessionProblem } from '../state/sessionGuard'
import { useSettings } from '../state/settingsStore'
import { useSolo } from '../state/soloSessionStore'

/**
 * The problem with the live session, if any (see sessionGuard.ts). It is computed in the same render
 * that would show the dish, so a screen that gets a problem back must render nothing from the
 * session. The session is discarded in an effect.
 */
export function useSessionGuard(): SessionProblem | null {
  const loaded = useSolo((s) => s.loaded)
  const state = useSolo((s) => s.state)
  const input = useSolo((s) => s.input)
  const discard = useSolo((s) => s.discard)
  const diet = useSettings((s) => s.diet)
  const budget = useSettings((s) => s.budget)
  const fulfilment = useSettings((s) => s.fulfilment)

  const problem = useMemo(
    () => (loaded && state && input ? sessionProblem(loaded, state, input, { diet, budget, fulfilment }) : null),
    [loaded, state, input, diet, budget, fulfilment],
  )
  useEffect(() => {
    if (problem) discard(problem)
  }, [problem, discard])
  return problem
}
