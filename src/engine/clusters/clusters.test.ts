import { describe, expect, it } from 'vitest'
import { MOCK_CATALOGUE } from '../../catalog/mock/MockCatalog'
import { DEFAULT_CONFIG as C } from '../config'
import { clusterArchetypes } from './clusters'

const clustering = clusterArchetypes(MOCK_CATALOGUE, C)

describe('clusterArchetypes (MVP_SPEC §9.7)', () => {
  it('produces k clusters that partition every archetype', () => {
    expect(clustering.clusters).toHaveLength(C.clusterCount)
    const all = clustering.clusters.flatMap((c) => c.members)
    expect(all.length).toBe(MOCK_CATALOGUE.archetypes.length)
    expect(new Set(all).size).toBe(all.length)
  })

  it('keeps every cluster between 3 and 12 members', () => {
    const sizes = clustering.clusters.map((c) => c.members.length)
    for (const s of sizes) {
      expect(s, `sizes: ${sizes.join(',')}`).toBeGreaterThanOrEqual(3)
      expect(s, `sizes: ${sizes.join(',')}`).toBeLessThanOrEqual(12)
    }
  })

  it('is deterministic', () => {
    const again = clusterArchetypes({ ...MOCK_CATALOGUE, archetypes: [...MOCK_CATALOGUE.archetypes].reverse() }, C)
    expect(again.clusters.map((c) => c.members)).toEqual(clustering.clusters.map((c) => c.members))
  })

  it('gives medoids fidelity 1 and members fidelity ≤ 1', () => {
    for (const c of clustering.clusters) {
      expect(clustering.fidelity.get(c.medoid)).toBeCloseTo(1)
      for (const m of c.members) expect(clustering.fidelity.get(m)!).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('groups obviously similar dishes together', () => {
    const same = (a: string, b: string) => clustering.clusterOf.get(a) === clustering.clusterOf.get(b)
    expect(same('beef-pho', 'tofu-pho')).toBe(true)
    expect(same('butter-chicken', 'chicken-tikka-masala')).toBe(true)
    expect(same('tiramisu', 'greek-salad')).toBe(false)
  })
})
