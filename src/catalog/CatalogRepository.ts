import type { Catalogue, GeoPoint } from '../domain'

/**
 * Where dish data comes from (MVP_SPEC §20.1). Async from day one so the mock can be
 * replaced by an API without touching call sites. A real implementation may use the
 * query to return a pre-filtered slice (e.g. a PostGIS radius search); the mock ignores it.
 */
export interface CatalogueQuery {
  origin?: GeoPoint
  maxDistanceMiles?: number
}

export interface CatalogRepository {
  getCatalogue(query?: CatalogueQuery): Promise<Catalogue>
}
