import type { DishArchetype, ImageRef, Offering, Venue } from '../../domain'

// Dish imagery (m1-spec §2, M1.6). The catalogue says which image each dish *should* have
// (ImageRef); an ImageAssetSource says whether that asset is actually available, where, and what
// kind it is. Resolution order: the offering's own photo → the archetype's image → null, and null
// means the designed no-photo state, never a grey box. Changing where images come from (a CDN, a
// manifest of generated files, venue uploads) means swapping the source, and nothing else.
//
// Two kinds of image: a *cutout* (just the plate on a transparent background, shown whole and
// centred on the dish's tint with a soft shadow; the art direction since 2026-09-25) and a
// full-bleed *photo* (cropped to fill the frame; still supported, e.g. for venue uploads).

export interface AssetHit {
  src: string
  /** Transparent background: shown whole on the tint, never cropped. */
  cutout: boolean
}

export interface ImageAssetSource {
  /** Where to load this catalogue image from, or null when the asset isn't available. */
  url(ref: ImageRef): AssetHit | null
  /** False when the source can never return an image, so callers can skip prefetch work. */
  readonly enabled: boolean
}

export interface ResolvedImage {
  src: string
  /** Meaningful alt text built from the dish data. Surfaces that already name the dish mark the image decorative instead. */
  alt: string
  /** 'offering' = this venue's own dish; 'archetype' = a stand-in for the dish in general. */
  level: 'offering' | 'archetype'
  /** True unless it's the venue's photo of this exact dish. Illustrative images are labelled as such. */
  illustrative: boolean
  /** Transparent cutout (fit whole, on the tint) rather than a photo (crop to fill). */
  cutout: boolean
  credit?: string
}

/** M1 ships without photos: every dish resolves to the no-photo state. */
export const NO_IMAGES: ImageAssetSource = { url: () => null, enabled: false }

/** A source backed by a list of assets known to exist (e.g. a build-time manifest). */
export function manifestSource(
  available: Iterable<string>,
  { baseUrl = '', cutout = false }: { baseUrl?: string; cutout?: boolean } = {},
): ImageAssetSource {
  const set = new Set(available)
  return { enabled: set.size > 0, url: (ref) => (set.has(ref.src) ? { src: `${baseUrl}${ref.src}`, cutout } : null) }
}

const sentence = (s: string) => s.trim().replace(/[.\s]+$/, '')

export function resolveDishImage(
  source: ImageAssetSource,
  archetype: DishArchetype,
  offering: Offering,
  venue: Venue,
): ResolvedImage | null {
  if (!source.enabled) return null
  const own = offering.image ? source.url(offering.image) : null
  if (own && offering.image) {
    const venuePhoto = offering.image.kind === 'venue'
    return {
      src: own.src,
      cutout: own.cutout,
      alt: `${offering.name} at ${venue.name}: ${sentence(offering.description)}.${venuePhoto ? '' : ' Illustrative image.'}`,
      level: 'offering',
      illustrative: !venuePhoto,
      ...(offering.image.credit ? { credit: offering.image.credit } : {}),
    }
  }
  const general = source.url(archetype.image)
  if (general) {
    const ingredients = archetype.keyIngredients.slice(0, 3).join(', ')
    return {
      src: general.src,
      cutout: general.cutout,
      alt: `${archetype.name}${ingredients ? ` with ${ingredients}` : ''}. Illustrative image, not from ${venue.name}.`,
      level: 'archetype',
      illustrative: true,
      ...(archetype.image.credit ? { credit: archetype.image.credit } : {}),
    }
  }
  return null
}

let current: ImageAssetSource = NO_IMAGES

/** The app-wide source. Set once at start-up (or by the review tools); view models read it. */
export const imageSource = () => current
export function setImageSource(source: ImageAssetSource) {
  current = source
}
