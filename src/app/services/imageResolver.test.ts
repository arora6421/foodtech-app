import { describe, expect, it } from 'vitest'
import type { ImageRef, Offering } from '../../domain'
import { loadCatalogue } from './catalogueService'
import { manifestSource, NO_IMAGES, resolveDishImage } from './imageResolver'

const loaded = await loadCatalogue()
const offering = loaded.offerings.get('koen-noodle-bar-karaage-bites')!
const archetype = loaded.archetypes.get(offering.archetypeId)!
const venue = loaded.venues.get(offering.venueId)!

const venuePhoto: ImageRef = {
  kind: 'venue',
  src: '/images/offerings/koen-karaage.avif',
  alt: 'Karaage',
  dominantColour: '#aa5533',
  credit: 'Kōen Noodle Bar',
}
const withPhoto = (image: ImageRef): Offering => ({ ...offering, image })

describe('resolveDishImage', () => {
  it('M1 default: no dish resolves to an image, so every surface shows the no-photo design', () => {
    for (const o of loaded.offerings.values()) {
      expect(
        resolveDishImage(NO_IMAGES, loaded.archetypes.get(o.archetypeId)!, o, loaded.venues.get(o.venueId)!),
      ).toBeNull()
    }
  })

  it('prefers the offering’s own photo', () => {
    const src = manifestSource([venuePhoto.src, archetype.image.src], { baseUrl: 'https://cdn.example' })
    const img = resolveDishImage(src, archetype, withPhoto(venuePhoto), venue)!
    expect(img).toMatchObject({
      level: 'offering',
      illustrative: false,
      src: `https://cdn.example${venuePhoto.src}`,
      credit: 'Kōen Noodle Bar',
    })
    expect(img.alt).toBe('Karaage Bites at Kōen Noodle Bar: Ginger-soy chicken thigh, yuzu mayo.')
  })

  it('falls back to the archetype image when the offering’s photo isn’t available', () => {
    const img = resolveDishImage(manifestSource([archetype.image.src]), archetype, withPhoto(venuePhoto), venue)!
    expect(img.level).toBe('archetype')
    expect(img.illustrative).toBe(true)
    expect(img.alt).toMatch(/^Chicken karaage with .+\. Illustrative image, not from Kōen Noodle Bar\.$/)
  })

  it('falls back to the no-photo state when neither is available', () => {
    expect(
      resolveDishImage(manifestSource(['/somewhere/else.avif']), archetype, withPhoto(venuePhoto), venue),
    ).toBeNull()
  })

  it('labels an offering image that isn’t the venue’s own photo as illustrative', () => {
    const generated: ImageRef = { ...venuePhoto, kind: 'generated' }
    const img = resolveDishImage(manifestSource([generated.src]), archetype, withPhoto(generated), venue)!
    expect(img.illustrative).toBe(true)
    expect(img.alt).toMatch(/Illustrative image\.$/)
  })

  it('passes through whether the asset is a transparent cutout (fit whole) or a photo (cropped)', () => {
    expect(
      resolveDishImage(manifestSource([archetype.image.src], { cutout: true }), archetype, offering, venue)!.cutout,
    ).toBe(true)
    expect(resolveDishImage(manifestSource([archetype.image.src]), archetype, offering, venue)!.cutout).toBe(false)
  })

  it('never reads the catalogue’s src as proof the file exists', () => {
    // Every archetype names /images/archetypes/<id>.avif; none of those files ship in M1.
    expect(archetype.image.src).toBe(`/images/archetypes/${archetype.id}.avif`)
    expect(resolveDishImage(manifestSource([]), archetype, offering, venue)).toBeNull()
  })
})
