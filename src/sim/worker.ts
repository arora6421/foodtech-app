import { parentPort } from 'node:worker_threads'
import { MOCK_CATALOGUE } from '../catalog/mock/MockCatalog'
import { clusterArchetypes } from '../engine/clusters/clusters'
import type { Clustering } from '../engine/clusters/clusters'
import { withConfig } from '../engine/config'
import type { EngineConfig } from '../engine/config'
import { GROUP_SCENARIOS, personaById } from './personas'
import { runGroup } from './runGroup'
import { runSession } from './runSession'

export type Job =
  | { kind: 'solo'; personaId: string; policy: string; seeds: number[]; overrides: Partial<EngineConfig>; transcripts: boolean }
  | { kind: 'group'; scenarioId: string; seeds: number[]; overrides: Partial<EngineConfig> }

const clusterings = new Map<string, Clustering>()
const clusteringFor = (config: EngineConfig) => {
  const key = `${config.clusterCount}|${JSON.stringify(config.salience)}`
  let c = clusterings.get(key)
  if (!c) {
    c = clusterArchetypes(MOCK_CATALOGUE, config)
    clusterings.set(key, c)
  }
  return c
}

parentPort!.on('message', (job: Job) => {
  const config = withConfig(job.overrides)
  const clustering = clusteringFor(config)
  if (job.kind === 'solo') {
    const persona = personaById(job.personaId)
    const out = job.seeds.map((seed) => runSession(persona, seed, MOCK_CATALOGUE, clustering, config, job.policy))
    parentPort!.postMessage({
      kind: 'solo',
      metrics: out.map((o) => o.metrics),
      transcripts: job.transcripts ? out.map((o) => o.transcript) : [],
    })
  } else {
    const scenario = GROUP_SCENARIOS.find((s) => s.id === job.scenarioId)!
    parentPort!.postMessage({ kind: 'group', metrics: job.seeds.map((seed) => runGroup(scenario, seed, MOCK_CATALOGUE, clustering, config)) })
  }
})
