import { CatalogueSchema } from '../../domain'
import type { Catalogue } from '../../domain'
import type { CatalogRepository } from '../CatalogRepository'
import { ARCHETYPES } from './archetypes'
import { OFFERINGS } from './offerings'
import { VENUES } from './venues'

export const MOCK_CATALOGUE_VERSION = 'mock-1.0.0'

export const MOCK_CATALOGUE: Catalogue = {
  version: MOCK_CATALOGUE_VERSION,
  archetypes: ARCHETYPES,
  venues: VENUES,
  offerings: OFFERINGS,
}

/** Validates once, exactly as an API-backed repository would validate a response. */
export class MockCatalog implements CatalogRepository {
  private parsed: Catalogue | undefined

  getCatalogue(): Promise<Catalogue> {
    this.parsed ??= CatalogueSchema.parse(MOCK_CATALOGUE)
    return Promise.resolve(this.parsed)
  }
}
