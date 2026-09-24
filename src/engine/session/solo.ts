import { clusterArchetypes } from '../clusters/clusters'
import { DEFAULT_CONFIG } from '../config'
import { buildPool } from '../context/pool'
import { cosine } from '../features/featurize'
import { selectNext } from '../deck/selectNext'
import { applySwipe, emptyProfile, scaleCravingPriors, withPriors } from '../profile/profile'
import type { UpdateKind } from '../profile/profile'
import { buildResult, checkStop, updateCounter } from '../stopping/stopping'
import type { CardChoice, PivotState, SessionInput, SessionModel, SoloEvent, SoloState, StopCheck } from './types'

// The solo session as a pure, event-sourced reducer (MVP_SPEC §3.1–3.2, §18).
// state = replay(model, events). Undo is replay without the last event.

export function createModel(input: SessionInput): SessionModel {
  const config = input.config ?? DEFAULT_CONFIG
  const pool = buildPool(input.catalogue, input.context, input.craving, config)
  const similarity = new Map(
    pool.archetypeIds.map((a) => [
      a,
      new Map(pool.archetypeIds.map((b) => [b, cosine(pool.baseVectors.get(a)!, pool.baseVectors.get(b)!)])),
    ]),
  )
  return {
    pool,
    similarity,
    clustering: input.clustering ?? clusterArchetypes(input.catalogue, config),
    context: input.context,
    craving: input.craving,
    seed: input.seed,
    config,
  }
}

const EMPTY_PIVOT: PivotState = { streak: 0, used: 0, flattenRemaining: 0, anchorPending: false, log: [] }

export function initialState(model: SessionModel): SoloState {
  const base: SoloState = {
    model,
    events: [],
    profile: withPriors(emptyProfile(), model.craving, model.config),
    swipes: [],
    excluded: new Set(),
    current: null,
    pivot: EMPTY_PIVOT,
    topHistory: [],
    lastCheck: null,
    counter: { raw: model.pool.candidates.length, shown: model.pool.candidates.length },
    notQuite: { count: 0, extension: 0, atSwipe: null },
    result: null,
  }
  return { ...base, current: selectNext(base) }
}

export function createSoloSession(input: SessionInput): SoloState {
  return initialState(createModel(input))
}

export function replay(model: SessionModel, events: readonly SoloEvent[]): SoloState {
  return events.reduce(soloReducer, initialState(model))
}

export function undo(state: SoloState): SoloState {
  return state.events.length === 0 ? state : replay(state.model, state.events.slice(0, -1))
}

const EMPTY_CHECK: StopCheck = { top: null, topMass3: 0, support: false, stable: false }

/** Record a swipe on the current card and advance: pivot bookkeeping, counter, stop check, next card. */
function recordSwipe(state: SoloState, card: CardChoice, kind: UpdateKind): SoloState {
  const { model } = state
  const { config, pool } = model
  const positive = kind === 'yes' || kind === 'super_yes'
  const vector = pool.byArchetype.get(card.archetypeId)!.find((c) => c.offering.id === card.offeringId)!.vector

  let profile = applySwipe(state.profile, vector, kind, config)
  const excluded = positive ? state.excluded : new Set([...state.excluded, card.archetypeId])
  const swipes = [...state.swipes, { card, verdict: kind === 'super_yes' ? ('super_yes' as const) : positive ? ('yes' as const) : ('no' as const) }]

  // Silent pivot (§10.3): Narrow-phase NOPEs build the streak (configurable for experiments); any YES resets it.
  const counts = (phase: string) => (config.pivotCounts === 'narrow' ? phase === 'narrow' : phase !== 'probe')
  let pivot: PivotState = {
    ...state.pivot,
    streak: positive ? 0 : counts(card.phase) ? state.pivot.streak + 1 : state.pivot.streak,
    flattenRemaining: card.flattened ? Math.max(0, state.pivot.flattenRemaining - 1) : state.pivot.flattenRemaining,
    anchorPending: card.slot === 'anchor' ? false : state.pivot.anchorPending,
  }
  if (pivot.streak >= config.pivotStreak && pivot.used < config.maxPivots) {
    profile = scaleCravingPriors(profile, config.pivotCravingFactor)
    pivot = {
      streak: 0,
      used: pivot.used + 1,
      flattenRemaining: config.pivotFlattenCards,
      anchorPending: true,
      log: [...pivot.log, { atSwipe: swipes.length, fromCluster: model.clustering.clusterOf.get(card.archetypeId) ?? -1 }],
    }
  }

  const next: SoloState = { ...state, profile, excluded, swipes, pivot, current: null }
  const counter = updateCounter(next)
  const decision = checkStop(next)
  const advanced: SoloState = {
    ...next,
    counter,
    lastCheck: decision.check,
    topHistory: [...state.topHistory, decision.top3],
  }
  if (decision.reason) return { ...advanced, result: buildResult(advanced, decision.reason, decision.check) }

  const current = selectNext(advanced)
  if (!current) return { ...advanced, result: buildResult(advanced, 'pool_exhausted', decision.check) }
  // Record which anchor the pivot actually used, for the debug panel and analytics.
  if (current.slot === 'anchor' && advanced.pivot.log.length > 0) {
    const log = [...advanced.pivot.log]
    log[log.length - 1] = { ...log[log.length - 1]!, anchorArchetypeId: current.archetypeId }
    return { ...advanced, current, pivot: { ...advanced.pivot, log } }
  }
  return { ...advanced, current }
}

export function soloReducer(state: SoloState, event: SoloEvent): SoloState {
  const logged = (s: SoloState): SoloState => ({ ...s, events: [...state.events, event] })

  switch (event.type) {
    case 'swipe': {
      if (!state.current || state.result) return state
      return logged(recordSwipe(state, state.current, event.verdict))
    }
    case 'pick': {
      if (!state.current || state.result) return state
      const card = state.current
      const after = recordSwipe(state, card, 'super_yes')
      // Whatever the stop rule said, the user has decided.
      return logged({ ...after, current: null, result: buildResult(after, 'user_picked', after.lastCheck ?? EMPTY_CHECK, card) })
    }
    case 'decide': {
      if (state.result) return state
      const check = state.lastCheck ?? checkStop(state).check
      return logged({ ...state, current: null, result: buildResult(state, 'decide_for_me', check) })
    }
    case 'not_quite': {
      if (!state.result || state.result.stopReason === 'pick_list') return state
      const hero = state.result.hero
      if (state.notQuite.count >= 1) {
        return logged({
          ...state,
          notQuite: { ...state.notQuite, count: state.notQuite.count + 1 },
          result: buildResult(state, 'pick_list', state.lastCheck ?? EMPTY_CHECK),
        })
      }
      const { pool, config } = state.model
      const vector = pool.byArchetype.get(hero.archetypeId)!.find((c) => c.offering.id === hero.offeringId)!.vector
      const next: SoloState = {
        ...state,
        profile: applySwipe(state.profile, vector, 'not_quite', config),
        excluded: new Set([...state.excluded, hero.archetypeId]),
        notQuite: { count: 1, extension: config.notQuiteExtension, atSwipe: state.swipes.length },
        result: null,
      }
      const current = selectNext(next)
      if (!current) return logged({ ...next, result: buildResult(next, 'pick_list', state.lastCheck ?? EMPTY_CHECK) })
      return logged({ ...next, current })
    }
  }
}
