import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { previewOnlyPresent, referencesTo } from './check-no-preview-images.mjs'

// The merge guard: fails while the preview-only images (or their loader) exist. Run with
// `npm run test:scripts`.

const repo = () => {
  const root = mkdtempSync(join(tmpdir(), 'merge-guard-'))
  mkdirSync(join(root, 'src/app/debug'), { recursive: true })
  return root
}
const run = (root) =>
  spawnSync(process.execPath, [join(import.meta.dirname, 'check-no-preview-images.mjs'), root], { encoding: 'utf8' })

test('a clean tree passes (exit 0)', () => {
  const root = repo()
  try {
    assert.deepEqual(previewOnlyPresent(root), [])
    assert.equal(run(root).status, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the images directory alone fails, even with a single file in it', () => {
  const root = repo()
  try {
    mkdirSync(join(root, 'src/app/debug/preview-images'))
    writeFileSync(join(root, 'src/app/debug/preview-images/beef-suya.webp'), 'x')
    assert.deepEqual(previewOnlyPresent(root), ['src/app/debug/preview-images'])
    const r = run(root)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /MERGE BLOCKED/)
    assert.match(r.stderr, /preview-images/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the loader file alone fails', () => {
  const root = repo()
  try {
    writeFileSync(join(root, 'src/app/debug/previewImages.ts'), 'export {}')
    assert.deepEqual(previewOnlyPresent(root), ['src/app/debug/previewImages.ts'])
    assert.equal(run(root).status, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('it names the source files that still reference them', () => {
  const root = repo()
  try {
    writeFileSync(join(root, 'src/app/debug/previewImages.ts'), 'export {}')
    writeFileSync(join(root, 'src/main.tsx'), "import './app/debug/previewImages'")
    assert.deepEqual(referencesTo(root), ['src/main.tsx'])
    assert.match(run(root).stderr, /src\/main\.tsx/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
