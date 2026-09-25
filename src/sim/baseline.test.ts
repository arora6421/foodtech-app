import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ENGINE_VERSION } from '../domain'
import { MOCK_CATALOGUE, MOCK_CATALOGUE_VERSION } from '../catalog/mock/MockCatalog'
import { clusterArchetypes } from '../engine/clusters/clusters'
import { DEFAULT_CONFIG } from '../engine/config'
import { configHash, groupRecord, sessionRecord } from './fingerprint'
import { GROUP_SCENARIOS, PERSONAS } from './personas'
import { runGroup } from './runGroup'
import { runSession } from './runSession'
import type { Baseline } from './baseline'

// Golden sessions: a fast slice of the frozen M0 baseline, so `npm run check` fails on any
// engine behaviour change even when nobody runs `npm run sim:baseline`.
// If this fails, do NOT regenerate the baseline: report what changed (MVP M1 rule).

const baseline = JSON.parse(readFileSync('docs/baselines/m0-baseline.json', 'utf8')) as Baseline
const clustering = clusterArchetypes(MOCK_CATALOGUE, DEFAULT_CONFIG)

describe('frozen M0 engine baseline (golden sessions)', () => {
  it('has the same engine version, catalogue version and config', () => {
    expect({ engineVersion: ENGINE_VERSION, catalogueVersion: MOCK_CATALOGUE_VERSION, configHash: configHash(DEFAULT_CONFIG) }).toEqual({
      engineVersion: baseline.engineVersion,
      catalogueVersion: baseline.catalogueVersion,
      configHash: baseline.configHash,
    })
  })

  it.each(PERSONAS.map((p) => p.id))('%s seeds 1–2 reproduce card-for-card', (id) => {
    const persona = PERSONAS.find((p) => p.id === id)!
    for (const seed of [1, 2]) {
      const now = sessionRecord(runSession(persona, seed, MOCK_CATALOGUE, clustering, DEFAULT_CONFIG, 'eig').transcript)
      const was = baseline.fast.sessions[id]!.find((r) => r.seed === seed)!
      expect(now, `${id} seed ${seed}`).toEqual(was)
    }
  })

  it.each(GROUP_SCENARIOS.map((g) => g.id))('group %s seed 1 reproduces', (id) => {
    const scenario = GROUP_SCENARIOS.find((g) => g.id === id)!
    const now = groupRecord(runGroup(scenario, 1, MOCK_CATALOGUE, clustering, DEFAULT_CONFIG))
    expect(now).toEqual(baseline.fast.groups[id]!.find((r) => r.seed === 1))
  })
})
