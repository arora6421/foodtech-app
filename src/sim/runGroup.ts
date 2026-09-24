import { ENGINE_VERSION } from '../domain'
import type { ArchetypeId, Catalogue } from '../domain'
import type { Clustering } from '../engine/clusters/clusters'
import type { EngineConfig } from '../engine/config'
import { computeGroupResult, groupModel, nextMemberCard, resolveFinalRound, sharedGroupDeck } from '../engine/group/group'
import type { GroupOutcome, GroupSnapshot } from '../engine/group/types'
import { hashString, mulberry32 } from '../engine/rng'
import { ANGEL_N1 } from '../location/LocationProvider'
import { personaById } from './personas'
import type { GroupScenario } from './personas'
import { SIM_NOW } from './runSession'

// Group scenarios with personas (MVP_SPEC §14.2). Pure snapshot updates; the transport's
// rules are covered by its own contract tests.

export interface GroupMetrics {
  scenarioId: string
  seed: number
  outcome: GroupOutcome
  expectedOutcome: boolean
  heroInTruthTop3: boolean
  /** The dish the group ends with: the hero for a WINNER, otherwise the final-round winner (personas approve what they'd say YES to). */
  finalInTruthTop3: boolean
  finalAcceptableToAll: boolean
  /** Some eligible dish is acceptable to every member (otherwise "acceptable to all" is impossible). */
  feasible: boolean
  deterministic: boolean
  dietViolations: number
  ms: number
}

export function runGroup(
  scenario: GroupScenario,
  seed: number,
  catalogue: Catalogue,
  clustering: Clustering,
  config: EngineConfig,
): GroupMetrics {
  const t0 = performance.now()
  const personas = scenario.members.map(personaById)
  let snapshot: GroupSnapshot = {
    sessionId: `sim-${scenario.id}-${seed}`,
    code: 'SIMSIM',
    seed,
    engineVersion: ENGINE_VERSION,
    catalogueVersion: catalogue.version,
    status: 'lobby',
    hostMemberId: 'm0',
    settings: { fulfilment: 'either', budget: 'any' },
    members: personas.map((p, i) => ({ id: `m${i}`, name: p.name, diet: p.diet, craving: p.craving, ready: true })),
    sharedDeck: null,
    swipes: [],
    votes: [],
    forced: false,
  }
  const g = groupModel(snapshot, catalogue, ANGEL_N1, SIM_NOW, config, clustering)
  snapshot = { ...snapshot, sharedDeck: sharedGroupDeck(g), status: 'swiping' }

  const rngs = personas.map((p) => mulberry32(hashString(`${scenario.id}:${p.id}`, seed)))
  const { pool } = g.base
  const total = config.group.sharedCards + config.group.personalCards
  for (let round = 0; round < total; round++) {
    personas.forEach((p, i) => {
      const card = nextMemberCard(g, snapshot, `m${i}`)
      if (!card) return
      const c = pool.byArchetype.get(card.archetypeId)!.find((x) => x.offering.id === card.offeringId)!
      const rng = rngs[i]!
      let yes = p.utility(c.archetype, c.offering) + p.noise.sd * (rng() * 2 - 1) > p.threshold
      if (rng() < p.noise.flipProb) yes = !yes
      snapshot = {
        ...snapshot,
        swipes: [...snapshot.swipes, { memberId: `m${i}`, cardIndex: round, ...card, verdict: yes ? 'yes' : 'no' }],
      }
    })
  }

  const result = computeGroupResult(g, snapshot)!
  const shuffled = { ...snapshot, members: [...snapshot.members].reverse(), swipes: [...snapshot.swipes].reverse() }
  const deterministic = JSON.stringify(computeGroupResult(g, shuffled)) === JSON.stringify(result)

  // Truth: average-without-misery over each persona's margin above its own YES threshold.
  const margin = (id: ArchetypeId) =>
    personas.map((p) => Math.max(...pool.byArchetype.get(id)!.map((c) => p.utility(c.archetype, c.offering))) - p.threshold)
  const truthScore = (id: ArchetypeId) => {
    const m = margin(id)
    return m.reduce((a, b) => a + b, 0) / m.length - m.reduce((a, x) => a + Math.max(0, -0.3 - x), 0)
  }
  const ranked = [...pool.archetypeIds].sort((a, b) => truthScore(b) - truthScore(a) || (a < b ? -1 : 1))
  const cutoff = truthScore(ranked[Math.min(2, ranked.length - 1)]!) - 1e-9
  const truthTop3 = ranked.filter((id) => truthScore(id) >= cutoff)

  const acceptable = (id: ArchetypeId, i: number) =>
    Math.max(...pool.byArchetype.get(id)!.map((c) => personas[i]!.utility(c.archetype, c.offering))) > personas[i]!.threshold
  const votes = result.finalRound.flatMap((pick) =>
    personas.map((_, i) => ({ memberId: `m${i}`, archetypeId: pick.archetypeId, approve: pool.byArchetype.has(pick.archetypeId) && acceptable(pick.archetypeId, i) })),
  )
  const final = result.outcome === 'WINNER' ? result.hero : resolveFinalRound(result, votes).winner
  const finalOk = pool.byArchetype.has(final.archetypeId)

  const diets = new Set(personas.flatMap((p) => p.diet))
  let dietViolations = 0
  for (const pick of [result.hero, ...result.finalRound]) {
    const o = catalogue.offerings.find((x) => x.id === pick.offeringId)!
    const a = catalogue.archetypes.find((x) => x.id === o.archetypeId)!
    const f = { ...a.dietary, ...o.overrides?.dietary }
    if ((diets.has('vegan') && !f.vegan) || (diets.has('vegetarian') && !f.vegetarian) || (diets.has('pescatarian') && !f.pescatarianSafe)) {
      dietViolations++
    }
  }

  return {
    scenarioId: scenario.id,
    seed,
    outcome: result.outcome,
    expectedOutcome: scenario.expected.includes(result.outcome),
    heroInTruthTop3: truthTop3.includes(result.hero.archetypeId),
    finalInTruthTop3: truthTop3.includes(final.archetypeId),
    finalAcceptableToAll: finalOk && personas.every((_, i) => acceptable(final.archetypeId, i)),
    feasible: pool.archetypeIds.some((id) => personas.every((_, i) => acceptable(id, i))),
    deterministic,
    dietViolations,
    ms: performance.now() - t0,
  }
}
