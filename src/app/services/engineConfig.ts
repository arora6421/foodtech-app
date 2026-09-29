import { DEFAULT_CONFIG } from '../../engine/config'
import type { EngineConfig } from '../../engine/config'

// The ONE place the app decides which engine configuration it runs. Every call into the engine
// (createModel, buildPool, clusterArchetypes) takes its config from here; a test fails if any app
// module reaches the engine another way (engineConfig.test.ts).
//
// The engine and DEFAULT_CONFIG are the frozen M0 baseline and are not touched. The app runs the
// engine with one override: a budget is a limit, not a soft band. The engine already has the
// machinery (a hard cap at `budgetHardCapMultiple` × the ceiling); the baseline used 1.3, which let
// dishes up to 30% over the label through. With 1 the cap IS the ceiling, so "Up to £10" means
// £10.00 or less and the price-fit penalty is never non-zero for an eligible dish.

/** Sessions saved before the strict budget: replayed with the rules they were started under. */
export const RULES_SOFT_BUDGET = 1
/** Budget is a hard limit (budgetHardCapMultiple 1). */
export const RULES_STRICT_BUDGET = 2
/** Stamped on every new session record. Bump when the app changes the engine config again. */
export const CURRENT_RULES = RULES_STRICT_BUDGET

export const APP_ENGINE_CONFIG: EngineConfig = Object.freeze({ ...DEFAULT_CONFIG, budgetHardCapMultiple: 1 })

/** The frozen baseline config, used only to replay sessions saved under RULES_SOFT_BUDGET. */
const SOFT_BUDGET_CONFIG: EngineConfig = DEFAULT_CONFIG

/** A record with no marker predates the marker, so it is a soft-budget session. */
export function configForRules(rules: number | undefined): EngineConfig {
  return (rules ?? RULES_SOFT_BUDGET) >= RULES_STRICT_BUDGET ? APP_ENGINE_CONFIG : SOFT_BUDGET_CONFIG
}
