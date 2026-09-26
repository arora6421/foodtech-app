import type { ImageAssetSource } from '../services/imageResolver'

// Image review tools (dev server and the `review` preview build only; see main.tsx).
//   ?images=demo    a drawn stand-in plate per dish, on a transparent background (a cutout)
//   ?images=broken  every image points at a missing file, to exercise failures
//   ?images=review  real test images from the git-ignored review-images/ folder
//   ?images=crops   the earlier square photo crops from review-images/crops/, for comparison
// Review files are named after the archetype they depict (e.g. beef-suya.png). PNG and WebP files
// are treated as cutouts (transparent); JPEGs as photos. Anything missing shows the no-photo art.

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

function samplePlateSvg(key: string, colour: string): string {
  const h = hash(key)
  const r = 40 + (h % 6)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><radialGradient id="p" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#fbf7ef"/><stop offset="1" stop-color="#e9e1d2"/></radialGradient></defs>
<circle cx="50" cy="50" r="${r}" fill="url(#p)"/><circle cx="50" cy="50" r="${r - 12}" fill="${colour}" opacity="0.75"/>
<text x="50" y="53" text-anchor="middle" font-family="sans-serif" font-size="5" fill="#1d1a16" opacity="0.7">SAMPLE</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const demoImageSource: ImageAssetSource = {
  enabled: true,
  url: (ref) => ({ src: samplePlateSvg(ref.src, ref.dominantColour), cutout: true }),
}

export const brokenImageSource: ImageAssetSource = {
  enabled: true,
  url: (ref) => ({ src: `/__missing__${ref.src}`, cutout: true }),
}

const stem = (path: string) => path.replace(/^.*\/|\.[a-z]+$/gi, '')

function folderSource(files: Record<string, string>): ImageAssetSource {
  const byArchetype = new Map(
    Object.entries(files).map(([path, url]) => [stem(path), { src: url, cutout: /\.(png|webp)$/i.test(path) }]),
  )
  return { enabled: byArchetype.size > 0, url: (ref) => byArchetype.get(stem(ref.src)) ?? null }
}

export const reviewImageSource = folderSource(
  import.meta.glob('./review-images/*.{png,jpg,jpeg,webp,avif}', { eager: true, query: '?url', import: 'default' }),
)

export const cropsImageSource = folderSource(
  import.meta.glob('./review-images/crops/*.{png,jpg,jpeg,webp,avif}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
)

export const IMAGE_SOURCES = {
  demo: demoImageSource,
  broken: brokenImageSource,
  review: reviewImageSource,
  crops: cropsImageSource,
}
