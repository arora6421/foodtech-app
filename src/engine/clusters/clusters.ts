import type { ArchetypeId, Catalogue } from '../../domain'
import type { EngineConfig } from '../config'
import { cosine, featurize } from '../features/featurize'
import type { FeatureVector } from '../features/featurize'

// Deterministic k-medoids over archetype feature vectors (MVP_SPEC §9.7).
// Used by the silent pivot to find a neighbouring cluster and its most textbook dish.

export interface Cluster {
  index: number
  medoid: ArchetypeId
  members: readonly ArchetypeId[]
}

export interface Clustering {
  clusters: readonly Cluster[]
  clusterOf: ReadonlyMap<ArchetypeId, number>
  /** Cosine similarity of each archetype to its cluster's medoid. */
  fidelity: ReadonlyMap<ArchetypeId, number>
  /** Medoid-to-medoid cosine similarity, indexed [i][j]. */
  medoidSimilarity: readonly (readonly number[])[]
}

export function clusterArchetypes(catalogue: Catalogue, config: EngineConfig): Clustering {
  const ids = catalogue.archetypes.map((a) => a.id).sort()
  const byId = new Map(catalogue.archetypes.map((a) => [a.id, a]))
  const vectors: FeatureVector[] = ids.map((id) => featurize(byId.get(id)!, config))
  const n = ids.length
  const k = Math.min(config.clusterCount, n)
  const D = ids.map((_, i) => ids.map((_, j) => (i === j ? 0 : 1 - cosine(vectors[i]!, vectors[j]!))))
  const row = (i: number) => D[i]!

  // PAM (Kaufman & Rousseeuw): greedy BUILD, then SWAP until no swap lowers total cost.
  // Every loop scans in index (= id) order and only accepts strict improvements, so ties are deterministic.
  const cost = (meds: readonly number[]) => {
    let total = 0
    for (let i = 0; i < n; i++) {
      let best = Infinity
      for (const m of meds) best = Math.min(best, row(i)[m]!)
      total += best
    }
    return total
  }

  const medoids: number[] = []
  while (medoids.length < k) {
    let bestIdx = -1
    let bestCost = Infinity
    for (let i = 0; i < n; i++) {
      if (medoids.includes(i)) continue
      const c = cost([...medoids, i])
      if (c < bestCost - 1e-12) {
        bestCost = c
        bestIdx = i
      }
    }
    medoids.push(bestIdx)
  }

  let current = cost(medoids)
  for (let iter = 0; iter < 200; iter++) {
    let best: { slot: number; candidate: number; cost: number } | undefined
    for (let slot = 0; slot < medoids.length; slot++) {
      for (let o = 0; o < n; o++) {
        if (medoids.includes(o)) continue
        const trial = medoids.map((m, s) => (s === slot ? o : m))
        const c = cost(trial)
        if (c < (best?.cost ?? current) - 1e-12) best = { slot, candidate: o, cost: c }
      }
    }
    if (!best) break
    medoids[best.slot] = best.candidate
    current = best.cost
  }

  const assignment = ids.map((_, i) => {
    let best = 0
    for (let c = 1; c < medoids.length; c++) if (row(i)[medoids[c]!]! < row(i)[medoids[best]!]!) best = c
    return best
  })

  const clusters: Cluster[] = medoids.map((m, c) => ({
    index: c,
    medoid: ids[m]!,
    members: ids.filter((_, i) => assignment[i] === c),
  }))
  const clusterOf = new Map(ids.map((id, i) => [id, assignment[i]!]))
  const fidelity = new Map(ids.map((id, i) => [id, 1 - row(i)[medoids[assignment[i]!]!]!]))
  const medoidSimilarity = medoids.map((a) => medoids.map((b) => 1 - row(a)[b]!))
  return { clusters, clusterOf, fidelity, medoidSimilarity }
}
