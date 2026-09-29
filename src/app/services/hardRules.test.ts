import { beforeAll, describe, expect, it } from 'vitest'
import { DIET_CONSTRAINTS, effectiveDietary } from '../../domain'
import type { DietConstraint } from '../../domain'
import { ANGEL_N1 } from '../../location/LocationProvider'
import type { SoloState } from '../../engine/session/types'
import { loadCatalogue } from './catalogueService'
import type { LoadedCatalogue } from './catalogueService'
import { applyEvent, createSession, makeInput, poolSize } from './engineAdapter'
import type { SessionInputDTO } from './engineAdapter'

// The user's two hard rules, checked against every card the app can show, through the app's own
// adapter (so the app's engine config is the one under test). The rules are restated here from
// MVP_SPEC §8.2 and the budget labels ("Up to £10 / £16 / £25"), NOT imported from the code they check.

const NOW = new Date('2026-09-24T19:30:00Z') // an evening: breakfast dishes are out, desserts follow the mood
const BUDGET_LIMIT_PENCE = { low: 1000, mid: 1600, high: 2500 } as const
const BUDGETS = ['any', 'low', 'mid', 'high'] as const
const FULFILMENTS = ['delivery', 'go_out', 'either'] as const
const CRAVINGS = [
  { moods: [], intent: 'normal' },
  { moods: ['sweet'], intent: 'normal' }, // lets desserts into the pool
  { moods: ['spicy', 'comforting'], intent: 'something_new' },
] as const

/** Every combination of the five diet options, including none and all five together. */
const DIET_SETS: DietConstraint[][] = Array.from({ length: 1 << DIET_CONSTRAINTS.length }, (_, mask) =>
  DIET_CONSTRAINTS.filter((_, i) => mask & (1 << i)),
)

let loaded: LoadedCatalogue
beforeAll(async () => {
  loaded = await loadCatalogue()
})

function fitsDiet(offeringId: string, diet: readonly DietConstraint[]): boolean {
  const o = loaded.offerings.get(offeringId)!
  const f = effectiveDietary(loaded.archetypes.get(o.archetypeId)!.dietary, o.overrides?.dietary)
  const rule: Record<DietConstraint, boolean> = {
    vegan: f.vegan,
    vegetarian: f.vegetarian,
    pescatarian: f.pescatarianSafe,
    no_pork: !f.containsPork,
    gluten_free: f.glutenFree,
  }
  return diet.every((d) => rule[d])
}

/** Everything a person could be shown in one session: every card, then the whole match. */
function playAndCollect(input: SessionInputDTO, seedOffset: number): { shown: string[]; state: SoloState } {
  let s = createSession(loaded, input)
  const shown = new Set<string>(s.model.pool.candidates.map((c) => c.offering.id)) // every card that COULD come up
  const take = () => {
    if (s.current) shown.add(s.current.offeringId)
    const r = s.result
    if (r) for (const o of [r.hero, ...r.runnersUp, ...(r.pickList ?? [])]) shown.add(o.offeringId)
    for (const id of r?.alsoAt ?? []) shown.add(id)
  }
  let n = seedOffset
  for (let i = 0; i < 40 && !s.result; i++) {
    take()
    s = applyEvent(s, { type: 'swipe', verdict: n++ % 4 === 0 ? 'yes' : 'no' })
  }
  take()
  for (let k = 0; k < 3 && s.result; k++) {
    s = applyEvent(s, { type: 'not_quite' })
    for (let i = 0; i < 40 && !s.result; i++) {
      take()
      s = applyEvent(s, { type: 'swipe', verdict: 'no' })
    }
    take()
  }
  return { shown: [...shown], state: s }
}

function forEachCombination(
  budgets: readonly (typeof BUDGETS)[number][],
  visit: (input: SessionInputDTO, label: string, i: number) => void,
) {
  let i = 0
  for (const diet of DIET_SETS)
    for (const budget of budgets)
      for (const fulfilment of FULFILMENTS)
        for (const craving of CRAVINGS) {
          const input = makeInput(ANGEL_N1, NOW, { diet, budget, fulfilment }, craving, 1000 + i)
          if (poolSize(loaded, input).archetypes === 0) continue // the app refuses to start these
          visit(
            input,
            `diet=[${diet}] budget=${budget} ${fulfilment} ${craving.moods.join('+')}/${craving.intent}`,
            i++,
          )
        }
}

describe('diet is a hard rule: every diet option against every card', () => {
  it('no card, match, runner-up, pick-list entry or "also at" venue ever breaks the diet', () => {
    const violations: string[] = []
    let sessions = 0
    forEachCombination(BUDGETS, (input, label, i) => {
      sessions++
      for (const id of playAndCollect(input, i).shown)
        if (!fitsDiet(id, input.context.diet)) violations.push(`${label}: ${loaded.offerings.get(id)!.name}`)
    })
    expect(sessions).toBeGreaterThan(1000) // the grid really ran
    expect(violations).toEqual([])
  })

  it('each single diet option leaves a usable deck at any budget and eating option', () => {
    for (const d of DIET_CONSTRAINTS)
      for (const fulfilment of FULFILMENTS)
        expect(
          poolSize(loaded, makeInput(ANGEL_N1, NOW, { diet: [d], budget: 'any', fulfilment }, CRAVINGS[0], 1))
            .archetypes,
        ).toBeGreaterThan(8)
  })
})

describe('budget is a limit: every budget option against every card', () => {
  it('no card, match, runner-up, pick-list entry or "also at" venue costs more than the limit', () => {
    const over: string[] = []
    forEachCombination(['low', 'mid', 'high'], (input, label, i) => {
      const limit = BUDGET_LIMIT_PENCE[input.context.budget as keyof typeof BUDGET_LIMIT_PENCE]
      for (const id of playAndCollect(input, i).shown) {
        const o = loaded.offerings.get(id)!
        if (o.pricePence > limit) over.push(`${label}: ${o.name} £${(o.pricePence / 100).toFixed(2)} > £${limit / 100}`)
      }
    })
    expect(over).toEqual([])
  })

  it('the limit is inclusive and exact: £10.00 is within "Up to £10", £10.01 is not', () => {
    const base = [...loaded.offerings.values()].find((o) => o.pricePence <= 1000)!
    for (const [budget, limit] of Object.entries(BUDGET_LIMIT_PENCE)) {
      const at = { ...base, id: 'probe-at-limit', pricePence: limit }
      const over = { ...base, id: 'probe-over-limit', pricePence: limit + 1 }
      const probe: LoadedCatalogue = { ...loaded, catalogue: { ...loaded.catalogue, offerings: [at, over] } }
      const input = makeInput(
        ANGEL_N1,
        NOW,
        { diet: [], budget: budget as 'low', fulfilment: 'either' },
        CRAVINGS[0],
        1,
      )
      const ids = createSession(probe, input).model.pool.candidates.map((c) => c.offering.id)
      expect(ids, budget).toEqual(['probe-at-limit'])
    }
  })

  it('a short deck stays honest: tight budgets end early rather than pad with dearer dishes', () => {
    // The tightest settings that still start: every card stays within the limit and the session ends.
    let tight = 0
    forEachCombination(['low'], (input, label, i) => {
      if (poolSize(loaded, input).archetypes >= 8) return
      tight++
      const { shown, state } = playAndCollect(input, i)
      expect(state.result, label).not.toBeNull()
      for (const id of shown) expect(loaded.offerings.get(id)!.pricePence, label).toBeLessThanOrEqual(1000)
      expect(state.swipes.length, label).toBeLessThanOrEqual(poolSize(loaded, input).archetypes)
    })
    expect(tight).toBeGreaterThan(20) // there really are short-deck combinations in the grid
  })
})
