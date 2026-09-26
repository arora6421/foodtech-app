import type { ImageAssetSource } from '../services/imageResolver'

// PREVIEW-ONLY images for the cover-story branch (Crave redesign review). These are the product
// owner's six *test* cutouts (not final; chicken larb is known to be inaccurate), converted to WebP.
// They're included only when Vercel builds a preview (VERCEL_ENV=preview, see vite.config.ts), so the
// photo version of the card and Match can be reviewed on a phone. Production builds never contain them.
//
// Before cover-story is merged: delete this file and preview-images/, and SQUASH-merge, so the test
// images never enter main's history (product owner's instruction, 2026-09-26).

const files = import.meta.glob('./preview-images/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>
const byArchetype = new Map(Object.entries(files).map(([path, url]) => [path.replace(/^.*\/|\.webp$/g, ''), url]))

export const previewImageSource: ImageAssetSource = {
  enabled: byArchetype.size > 0,
  url: (ref) => {
    const src = byArchetype.get(ref.src.replace(/^.*\/|\.[a-z]+$/gi, ''))
    return src ? { src, cutout: true } : null
  },
}
