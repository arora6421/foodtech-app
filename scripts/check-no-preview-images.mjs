// Merge guard: fails if the preview-only test cutout images are still in the tree.
//   node scripts/check-no-preview-images.mjs [repoRoot]
// They live on `cover-story` only, for the Vercel preview, and must never reach `main`
// (PRE_MERGE.md). Run as the last part of `npm run check:merge`. `npm run check` deliberately does
// not include it, since the branch needs the images until the day it is merged.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** What must not exist at merge time, relative to the repo root. */
export const PREVIEW_ONLY = ['src/app/debug/preview-images', 'src/app/debug/previewImages.ts']

/** The preview-only paths that exist under `root` (a directory counts even if empty). */
export function previewOnlyPresent(root) {
  return PREVIEW_ONLY.filter((p) => existsSync(join(root, p)))
}

/** Source files that still mention the preview images, so the person deleting them knows what to unpick. */
export function referencesTo(root) {
  const skip = new Set(PREVIEW_ONLY.map((p) => resolve(root, p)))
  const found = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (skip.has(resolve(path))) continue
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(ts|tsx|css|mjs)$/.test(name) && /previewImages|preview-images/.test(readFileSync(path, 'utf8')))
        found.push(relative(root, path).split('\\').join('/'))
    }
  }
  if (existsSync(join(root, 'src'))) walk(join(root, 'src'))
  return found
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(process.argv[2] ?? '.')
  const present = previewOnlyPresent(root)
  if (present.length === 0) {
    console.log('Preview-only images: none in the tree.')
  } else {
    console.error('MERGE BLOCKED: the preview-only test images are still in the tree:')
    for (const p of present) console.error(`  • ${p}`)
    const refs = referencesTo(root)
    if (refs.length) console.error(`Still referenced by (remove these references too):\n${refs.map((r) => `  • ${r}`).join('\n')}`)
    console.error('Delete them before merging (PRE_MERGE.md), then squash-merge.')
    process.exitCode = 1
  }
}
