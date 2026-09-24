import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { MOCK_CATALOGUE } from '../catalog/mock/MockCatalog'
import { clusterArchetypes } from '../engine/clusters/clusters'
import { withConfig } from '../engine/config'
import type { EngineConfig } from '../engine/config'
import { GROUP_SCENARIOS, PERSONAS, personaById } from './personas'
import { exitCriteria, renderReport } from './report'
import type { GroupMetrics } from './runGroup'
import { runSession } from './runSession'
import type { SessionMetrics, SessionTranscript } from './runSession'
import type { Job } from './worker'

// npm run sim -- [--seeds 200] [--group-seeds 50] [--policies eig,greedy,random,no-decay]
//                [--set beta=20 --set supportTaste=0.25] [--transcripts] [--sweep] [--workers 7]

const POLICIES: Record<string, Partial<EngineConfig>> = {
  eig: {},
  greedy: { deckPolicy: 'greedy' },
  random: { deckPolicy: 'random' },
  'no-decay': { gamma: 1 },
}

function args() {
  const a = process.argv.slice(2)
  const get = (flag: string) => {
    const i = a.indexOf(flag)
    return i >= 0 ? a[i + 1] : undefined
  }
  const overrides: Record<string, unknown> = {}
  a.forEach((x, i) => {
    if (x === '--set') {
      const [k, v] = a[i + 1]!.split('=')
      overrides[k!] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v)
    }
  })
  return {
    seeds: Number(get('--seeds') ?? 200),
    groupSeeds: Number(get('--group-seeds') ?? 50),
    policies: (get('--policies') ?? 'eig,greedy,random,no-decay').split(','),
    overrides: overrides as Partial<EngineConfig>,
    transcripts: a.includes('--transcripts'),
    sweep: a.includes('--sweep'),
    sweepSeeds: Number(get('--sweep-seeds') ?? 40),
    workers: Number(get('--workers') ?? Math.max(1, cpus().length - 1)),
    out: get('--out') ?? 'sim-output',
  }
}

/** A tiny worker pool; each worker runs TypeScript via the same loader (tsx) as this process. */
async function runJobs(jobs: Job[], workers: number): Promise<{ solo: SessionMetrics[]; transcripts: SessionTranscript[]; group: GroupMetrics[] }> {
  const solo: SessionMetrics[] = []
  const transcripts: SessionTranscript[] = []
  const group: GroupMetrics[] = []
  const queue = [...jobs]
  let done = 0
  const pool = Array.from({ length: Math.min(workers, jobs.length) }, () => new Worker(new URL('./worker.ts', import.meta.url), { execArgv: process.execArgv }))
  await Promise.all(
    pool.map(
      (w) =>
        new Promise<void>((resolve, reject) => {
          const next = () => {
            const job = queue.shift()
            if (!job) return resolve()
            w.postMessage(job)
          }
          w.on('message', (msg: { kind: string; metrics: never[]; transcripts?: SessionTranscript[] }) => {
            if (msg.kind === 'solo') {
              solo.push(...(msg.metrics as SessionMetrics[]))
              transcripts.push(...(msg.transcripts ?? []))
            } else group.push(...(msg.metrics as GroupMetrics[]))
            done++
            process.stdout.write(`\r  ${done}/${jobs.length} jobs`)
            next()
          })
          w.on('error', reject)
          next()
        }),
    ),
  )
  await Promise.all(pool.map((w) => w.terminate()))
  process.stdout.write('\n')
  return { solo, transcripts, group }
}

const seedList = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
const chunk = (xs: number[], size: number) => Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, (i + 1) * size))

async function main() {
  const opt = args()
  mkdirSync(opt.out, { recursive: true })
  const started = performance.now()

  if (opt.sweep) {
    const grid: Partial<EngineConfig>[] = []
    for (const beta of [20, 25]) for (const supportTaste of [0.15, 0.2]) for (const supportConfidence of [0.25, 0.3, 0.35]) grid.push({ beta, supportTaste, supportConfidence })
    const rows: string[] = ['| β | supportTaste | supportConfidence | criteria passing | swipes med | p90 | hit@1 | hit@3 | acceptable | max-reached |', '|---|---|---|---|---|---|---|---|---|---|']
    for (const g of grid) {
      const overrides = { ...opt.overrides, ...g }
      const jobs: Job[] = PERSONAS.flatMap((p) => chunk(seedList(opt.sweepSeeds), 10).map((seeds) => ({ kind: 'solo' as const, personaId: p.id, policy: 'eig', seeds, overrides, transcripts: false })))
      const { solo } = await runJobs(jobs, opt.workers)
      const crit = exitCriteria(new Map([['eig', solo]]), [])
      const gated = solo.filter((m) => personaById(m.personaId).gated)
      const sorted = [...gated.map((m) => m.swipes)].sort((a, b) => a - b)
      const med = sorted[Math.floor(sorted.length / 2)]
      const p90 = sorted[Math.floor(sorted.length * 0.9)]
      const r = (f: (m: SessionMetrics) => boolean) => `${((gated.filter(f).length / gated.length) * 100).toFixed(0)}%`
      rows.push(`| ${g.beta} | ${g.supportTaste} | ${g.supportConfidence} | ${crit.filter((c) => c.pass && !c.deferred).length}/${crit.filter((c) => !c.deferred).length} | ${med} | ${p90} | ${r((m) => m.hit1)} | ${r((m) => m.hit3)} | ${r((m) => m.acceptable)} | ${r((m) => m.stopReason === 'max_reached')} |`)
      console.log(rows[rows.length - 1])
    }
    writeFileSync(join(opt.out, 'sweep.md'), `# Parameter sweep (${opt.sweepSeeds} seeds per persona)\n\n${rows.join('\n')}\n`)
    console.log(`Wrote ${join(opt.out, 'sweep.md')}`)
    return
  }

  const jobs: Job[] = []
  for (const policy of opt.policies) {
    const overrides = { ...opt.overrides, ...POLICIES[policy] }
    for (const p of PERSONAS) {
      for (const seeds of chunk(seedList(opt.seeds), 20)) {
        jobs.push({ kind: 'solo', personaId: p.id, policy, seeds, overrides, transcripts: opt.transcripts && policy === 'eig' })
      }
    }
  }
  for (const sc of GROUP_SCENARIOS) jobs.push({ kind: 'group', scenarioId: sc.id, seeds: seedList(opt.groupSeeds), overrides: opt.overrides })

  console.log(`Running ${jobs.length} jobs on ${opt.workers} workers…`)
  const { solo, transcripts, group } = await runJobs(jobs, opt.workers)

  // Determinism: the same persona and seed must give a byte-identical transcript.
  const config = withConfig(opt.overrides)
  const clustering = clusterArchetypes(MOCK_CATALOGUE, config)
  const a = runSession(personaById('P1'), 1, MOCK_CATALOGUE, clustering, config, 'eig').transcript
  const b = runSession(personaById('P1'), 1, MOCK_CATALOGUE, clustering, config, 'eig').transcript
  const deterministic = JSON.stringify(a) === JSON.stringify(b)

  const byPolicy = new Map<string, SessionMetrics[]>()
  for (const m of solo) byPolicy.set(m.policy, [...(byPolicy.get(m.policy) ?? []), m])
  for (const ms of byPolicy.values()) ms.sort((x, y) => (x.personaId < y.personaId ? -1 : x.personaId > y.personaId ? 1 : x.seed - y.seed))

  const report = renderReport(byPolicy, group, { seeds: opt.seeds, overrides: opt.overrides, seconds: (performance.now() - started) / 1000, deterministic })
  writeFileSync(join(opt.out, 'sim-report.md'), report)
  writeFileSync(join(opt.out, 'sim-metrics.json'), JSON.stringify({ solo, group }, null, 1))
  if (opt.transcripts) {
    transcripts.sort((x, y) => (x.personaId < y.personaId ? -1 : x.personaId > y.personaId ? 1 : x.seed - y.seed))
    writeFileSync(join(opt.out, 'transcripts.json'), JSON.stringify({ overrides: opt.overrides, transcripts }))
  }
  console.log(report.split('\n## Per persona')[0])
  console.log(`Wrote ${join(opt.out, 'sim-report.md')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
