// Bundle report (M1.7): a production build, broken down by where the bytes come from.
//   node scripts/bundle-report.mjs [label] [--mode review]
// Writes docs/perf/bundle-<label>.json and prints a table.
// Two builds: the real one (true chunk sizes, as shipped), and a measuring build that puts each
// source group in its own chunk so its minified, gzipped size is exact rather than estimated.
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { build } from 'vite'

const label = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'current'
const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex > -1 ? process.argv[modeIndex + 1] : 'production'

function groupOf(id) {
  const p = id.replace(/\\/g, '/').replace(/^\0/, '')
  const nm = p.lastIndexOf('/node_modules/')
  if (nm > -1) {
    const rest = p.slice(nm + 14).split('/')
    const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]
    if (/^(motion|framer-motion|motion-dom|motion-utils)$/.test(name)) return 'motion'
    if (/^(react|react-dom|scheduler)$/.test(name)) return 'react'
    return name
  }
  const m = /\/src\/([^/]+)(?:\/([^/]+))?/.exec(p)
  if (!m) return 'other'
  if (m[1] === 'app') return m[2] === 'debug' ? 'app/debug' : 'app'
  return m[1] // engine, catalog, domain, sim, analytics, location, sync
}

// Every source group the app can contain; each becomes its own chunk in the measuring build.
const GROUPS = [
  'react',
  'motion',
  'react-router',
  'zod',
  'zustand',
  'engine',
  'catalog',
  'domain',
  'location',
  'analytics',
  'sync',
  'sim',
  'app/debug',
  'app',
  'other',
]

const chunks = []
const assets = []
const report = {
  name: 'bundle-report',
  generateBundle(_options, bundle) {
    for (const out of Object.values(bundle)) {
      if (out.type === 'asset') {
        const size = typeof out.source === 'string' ? Buffer.byteLength(out.source) : out.source.length
        assets.push({ file: out.fileName, bytes: size })
        continue
      }
      const code = Buffer.from(out.code)
      const groups = {}
      for (const [id, info] of Object.entries(out.modules ?? {})) {
        const g = groupOf(id)
        groups[g] = (groups[g] ?? 0) + (info.renderedLength ?? 0)
      }
      chunks.push({
        file: out.fileName,
        entry: out.isEntry,
        dynamic: out.isDynamicEntry,
        bytes: code.length,
        gzip: gzipSync(code, { level: 9 }).length,
        brotli: brotliCompressSync(code).length,
        groups,
        imports: out.imports ?? [],
      })
    }
  },
}

await build({
  mode,
  logLevel: 'error',
  build: { outDir: '.compare/report-dist', emptyOutDir: true },
  plugins: [report],
})
const shipped = chunks.splice(0)
assets.length = 0
await build({
  mode,
  logLevel: 'error',
  build: {
    outDir: '.compare/report-split',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: GROUPS.map((g) => ({ name: `g-${g.replace(/[@/]/g, '_')}`, test: (id) => groupOf(id) === g })),
        },
      },
    },
  },
  plugins: [report],
})
const split = chunks.splice(0)

const kb = (n) => (n / 1024).toFixed(1)
const sum = (cs, k) => cs.reduce((a, c) => a + c[k], 0)
const js = { bytes: sum(shipped, 'bytes'), gzip: sum(shipped, 'gzip'), brotli: sum(shipped, 'brotli') }
// Loaded up front = the entry chunk plus everything it imports statically (not lazy chunks).
const byFile = new Map(shipped.map((c) => [c.fileName ?? c.file, c]))
const upFront = new Set()
const visit = (c) => {
  if (!c || upFront.has(c)) return
  upFront.add(c)
  c.imports.forEach((f) => visit(byFile.get(f)))
}
shipped.filter((c) => c.entry).forEach(visit)
const initial = sum([...upFront], 'gzip')
const totals = {}
for (const c of split) {
  const g = /g-([^-.]+(?:_[^-.]+)?)/.exec(c.file)?.[1]?.replace(/_/g, '/') ?? Object.keys(c.groups)[0] ?? 'other'
  const t = (totals[g] ??= { bytes: 0, gzip: 0, brotli: 0 })
  t.bytes += c.bytes
  t.gzip += c.gzip
  t.brotli += c.brotli
}
const byExt = {}
for (const a of assets) {
  const ext = a.file.split('.').pop()
  byExt[ext] = (byExt[ext] ?? 0) + a.bytes
}

console.log(`
Bundle report "${label}" (mode ${mode})`)
console.log(`Shipped JS: ${kb(js.bytes)} KB minified | ${kb(js.gzip)} KB gzip | ${kb(js.brotli)} KB brotli`)
console.log(
  `Loaded up front (entry + static imports): ${kb(initial)} KB gzip | chunks: ${shipped.map((c) => `${c.file.replace('assets/', '')} ${kb(c.gzip)}${c.entry ? ' (entry)' : upFront.has(c) ? ' (up front)' : ' (lazy)'}`).join(', ')}`,
)
console.log('\nBy source (exact, measured in isolation)   min KB   gzip KB   brotli KB')
for (const [g, t] of Object.entries(totals).sort((a, b) => b[1].gzip - a[1].gzip)) {
  console.log(`  ${g.padEnd(40)} ${kb(t.bytes).padStart(7)}   ${kb(t.gzip).padStart(7)}   ${kb(t.brotli).padStart(8)}`)
}
console.log(
  '\nOther assets: ' +
    Object.entries(byExt)
      .map(([e, b]) => `${e} ${kb(b)} KB`)
      .join(' | '),
)

mkdirSync('docs/perf', { recursive: true })
writeFileSync(
  `docs/perf/bundle-${label}.json`,
  JSON.stringify(
    { label, mode, date: new Date().toISOString(), js, initialGzip: initial, chunks: shipped, groups: totals, assets },
    null,
    2,
  ),
)
console.log(`\nWrote docs/perf/bundle-${label}.json`)
