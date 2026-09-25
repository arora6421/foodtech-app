import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { dirname } from 'node:path'
import { ENGINE_VERSION } from '../domain'
import { MOCK_CATALOGUE_VERSION } from '../catalog/mock/MockCatalog'
import { DEFAULT_CONFIG } from '../engine/config'
import type { EngineConfig } from '../engine/config'
import { configHash, groupRecord, sessionRecord } from './fingerprint'
import type { GroupRecord, SessionRecord } from './fingerprint'
import { GROUP_SCENARIOS, PERSONAS } from './personas'
import { chunk, runJobs, seedList } from './pool'
import { scorecard } from './report'
import type { Scorecard } from './report'
import type { SessionMetrics } from './runSession'
import type { Job } from './worker'

// The frozen M0 baseline guard (M1.0). A hard regression check: the engine's behaviour must not change.
//
//   npm run sim:baseline                   fast check (~30 s): 13 personas × 50 seeds + groups × 10
//   npm run sim:baseline -- --full         also re-measures the full 200-seed scorecard (~3–4 min)
//   npm run sim:baseline -- --write        creates the baseline file, only if none exists
//
// Overwriting an existing baseline needs --overwrite-with-approval "<who approved, and why>".
// Do not use it because numbers moved: a moved number is exactly what this guard exists to catch.

export const BASELINE_PATH = 'docs/baselines/m0-baseline.json'
const FAST_SEEDS = 50
const FAST_GROUP_SEEDS = 10
const FULL_SEEDS = 200
const FULL_GROUP_SEEDS = 50

export interface Baseline {
  schema: 1
  policy: string
  engineVersion: string
  catalogueVersion: string
  configHash: string
  fast: {
    seeds: number
    groupSeeds: number
    sessions: Record<string, SessionRecord[]>
    groups: Record<string, GroupRecord[]>
    scorecard: Scorecard
  }
  full: { seeds: number; groupSeeds: number; scorecard: Scorecard }
  history: { date: string; action: string; reason: string }[]
}

const workers = Math.max(1, cpus().length - 1)
const byPersona = <T extends { seed: number }>(entries: [string, T][]) => {
  const out: Record<string, T[]> = {}
  for (const [k, v] of entries) (out[k] ??= []).push(v)
  for (const k of Object.keys(out)) out[k]!.sort((a, b) => a.seed - b.seed)
  return out
}

async function measureFast() {
  const jobs: Job[] = [
    ...PERSONAS.flatMap((p) =>
      chunk(seedList(FAST_SEEDS), 10).map((seeds) => ({ kind: 'solo' as const, personaId: p.id, policy: 'eig', seeds, overrides: {}, transcripts: true })),
    ),
    ...GROUP_SCENARIOS.map((g) => ({ kind: 'group' as const, scenarioId: g.id, seeds: seedList(FAST_GROUP_SEEDS), overrides: {} })),
  ]
  const { solo, transcripts, group } = await runJobs(jobs, workers)
  return {
    seeds: FAST_SEEDS,
    groupSeeds: FAST_GROUP_SEEDS,
    sessions: byPersona(transcripts.map((t) => [t.personaId, sessionRecord(t)] as [string, SessionRecord])),
    groups: byPersona(group.map((g) => [g.scenarioId, groupRecord(g)] as [string, GroupRecord])),
    scorecard: scorecard(new Map([['eig', solo]]), group),
  }
}

async function measureFull() {
  const jobs: Job[] = []
  for (const policy of ['eig', 'greedy', 'random'] as const) {
    const overrides: Partial<EngineConfig> = policy === 'eig' ? {} : { deckPolicy: policy }
    for (const p of PERSONAS) for (const seeds of chunk(seedList(FULL_SEEDS), 20)) jobs.push({ kind: 'solo', personaId: p.id, policy, seeds, overrides, transcripts: false })
  }
  for (const g of GROUP_SCENARIOS) jobs.push({ kind: 'group', scenarioId: g.id, seeds: seedList(FULL_GROUP_SEEDS), overrides: {} })
  const { solo, group } = await runJobs(jobs, workers)
  const byPolicy = new Map<string, SessionMetrics[]>()
  for (const m of solo) byPolicy.set(m.policy, [...(byPolicy.get(m.policy) ?? []), m])
  return { seeds: FULL_SEEDS, groupSeeds: FULL_GROUP_SEEDS, scorecard: scorecard(byPolicy, group) }
}

function firstDivergence(a: string, b: string): string {
  const x = a.split(' ')
  const y = b.split(' ')
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) return `card ${i + 1}: baseline ${x[i] ?? '(stopped)'} → now ${y[i] ?? '(stopped)'}`
  }
  return 'same cards; result or explanation text differs'
}

function compareScorecards(label: string, was: Scorecard, now: Scorecard, problems: string[]) {
  for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (was[k] !== now[k]) problems.push(`${label} scorecard ${k}: baseline ${was[k]} → now ${now[k]}`)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const full = argv.includes('--full')
  const write = argv.includes('--write')
  const approvalIdx = argv.indexOf('--overwrite-with-approval')
  const approval = approvalIdx >= 0 ? argv[approvalIdx + 1] : undefined
  const config = DEFAULT_CONFIG
  const identity = { engineVersion: ENGINE_VERSION, catalogueVersion: MOCK_CATALOGUE_VERSION, configHash: configHash(config) }

  if (write || approval) {
    if (existsSync(BASELINE_PATH) && !approval) {
      console.error(`Refusing to overwrite ${BASELINE_PATH}. This is the frozen M0 baseline.\nIf the product owner has approved a new baseline, use --overwrite-with-approval "<who and why>".`)
      process.exit(2)
    }
    if (approval !== undefined && !approval.trim()) {
      console.error('--overwrite-with-approval needs a reason.')
      process.exit(2)
    }
    console.log('Measuring fast baseline…')
    const fast = await measureFast()
    console.log('Measuring full scorecard…')
    const fullCard = await measureFull()
    const previous: Baseline | undefined = existsSync(BASELINE_PATH) ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline) : undefined
    const baseline: Baseline = {
      schema: 1,
      policy: 'Frozen M0 engine baseline. Do not regenerate because numbers moved; a moved number means the engine changed. Overwriting requires product-owner approval, recorded in history.',
      ...identity,
      fast,
      full: fullCard,
      history: [
        ...(previous?.history ?? []),
        { date: new Date().toISOString().slice(0, 10), action: previous ? 'overwrite' : 'create', reason: approval ?? 'Initial freeze at M0 close' },
      ],
    }
    mkdirSync(dirname(BASELINE_PATH), { recursive: true })
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 1) + '\n')
    console.log(`Wrote ${BASELINE_PATH}`)
    console.log(JSON.stringify({ fast: fast.scorecard, full: fullCard.scorecard }, null, 1))
    return
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`No baseline at ${BASELINE_PATH}. Create it once with --write.`)
    process.exit(2)
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline
  const problems: string[] = []
  for (const k of ['engineVersion', 'catalogueVersion', 'configHash'] as const) {
    if (baseline[k] !== identity[k]) problems.push(`${k}: baseline ${baseline[k]} → now ${identity[k]}`)
  }

  console.log(`Checking fast baseline (${FAST_SEEDS} seeds × ${PERSONAS.length} personas, groups × ${FAST_GROUP_SEEDS})…`)
  const fast = await measureFast()
  let changedSessions = 0
  for (const [persona, records] of Object.entries(baseline.fast.sessions)) {
    const now = new Map((fast.sessions[persona] ?? []).map((r) => [r.seed, r]))
    for (const was of records) {
      const cur = now.get(was.seed)
      if (!cur || cur.fp !== was.fp) {
        changedSessions++
        if (changedSessions <= 25) {
          problems.push(
            `${persona} seed ${was.seed}: ${cur ? firstDivergence(was.cards, cur.cards) : 'missing'}` +
              (cur ? ` | swipes ${was.swipes}→${cur.swipes}, stop ${was.stop}→${cur.stop}, hero ${was.hero}→${cur.hero}` : ''),
          )
        }
      }
    }
  }
  if (changedSessions > 25) problems.push(`…and ${changedSessions - 25} more changed sessions`)
  for (const [scenario, records] of Object.entries(baseline.fast.groups)) {
    const now = new Map((fast.groups[scenario] ?? []).map((r) => [r.seed, r]))
    for (const was of records) {
      const cur = now.get(was.seed)
      if (!cur || cur.fp !== was.fp) {
        problems.push(`${scenario} seed ${was.seed}: outcome ${was.outcome}→${cur?.outcome}, hero ${was.hero}→${cur?.hero}, final ${was.final}→${cur?.final}`)
      }
    }
  }
  compareScorecards('fast', baseline.fast.scorecard, fast.scorecard, problems)

  if (full) {
    console.log(`Checking full scorecard (${FULL_SEEDS} seeds, eig/greedy/random)…`)
    compareScorecards('full', baseline.full.scorecard, (await measureFull()).scorecard, problems)
  }

  const total = Object.values(baseline.fast.sessions).reduce((a, r) => a + r.length, 0)
  if (problems.length === 0) {
    console.log(`\nBASELINE UNCHANGED ✅  ${total} sessions and ${Object.values(baseline.fast.groups).flat().length} group runs identical${full ? '; full scorecard identical' : ''}.`)
    return
  }
  console.error(`\nBASELINE CHANGED ❌  ${changedSessions}/${total} sessions differ. Stop and report before continuing:\n`)
  for (const p of problems) console.error(`  • ${p}`)
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
