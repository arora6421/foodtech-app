import type { Catalogue, DishArchetype, Offering, Venue } from '../../domain'
import type { CatalogRepository } from '../../catalog/CatalogRepository'
import { MockCatalog } from '../../catalog/mock/MockCatalog'
import { clusterArchetypes } from '../../engine/clusters/clusters'
import type { Clustering } from '../../engine/clusters/clusters'
import { APP_ENGINE_CONFIG } from './engineConfig'

// Loads the catalogue once and precomputes what every session reuses (m1-spec §3.2).
// Clustering takes ~180 ms in the browser, so it runs once, while the Welcome screen is showing.

export interface LoadedCatalogue {
  catalogue: Catalogue
  clustering: Clustering
  archetypes: ReadonlyMap<string, DishArchetype>
  venues: ReadonlyMap<string, Venue>
  offerings: ReadonlyMap<string, Offering>
}

let pending: Promise<LoadedCatalogue> | null = null

export function loadCatalogue(repo: CatalogRepository = new MockCatalog()): Promise<LoadedCatalogue> {
  pending ??= repo.getCatalogue().then((catalogue) => ({
    catalogue,
    clustering: clusterArchetypes(catalogue, APP_ENGINE_CONFIG),
    archetypes: new Map(catalogue.archetypes.map((a) => [a.id, a])),
    venues: new Map(catalogue.venues.map((v) => [v.id, v])),
    offerings: new Map(catalogue.offerings.map((o) => [o.id, o])),
  }))
  return pending
}

/** Test helper: forget the cached catalogue. */
export function resetCatalogueCache(): void {
  pending = null
}
