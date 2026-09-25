import type { StopReason } from '../engine/session/types'
import { PERSONAS } from './personas'
import type { GroupMetrics } from './runGroup'
import type { SessionMetrics } from './runSession'

// Aggregation, exit criteria (MVP_SPEC §14.4) and the markdown report.

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 1e-9))]!
}
const rate = (xs: boolean[]) => mean(xs.map((x) => (x ? 1 : 0)))
const pct = (x: number) => `${(x * 100).toFixed(0)}%`
const f2 = (x: number) => x.toFixed(2)

export interface Aggregate {
  n: number
  medianSwipes: number
  p90Swipes: number
  maxReached: number
  hit1: number
  hit3: number
  acceptable: number
  regret: number
  medianSwipesToCorrect: number
  featurePrecision: number
  pivotRate: number
  pivotRecovery: number
  prematureLock: number
  familiesFirst8: number
  bothModes: number
  entropyDrop: number
  reasonTruth: number
  unsupported: number
  innocentShare: number
  dietViolations: number
  stopReasons: Partial<Record<StopReason, number>>
}

export function aggregate(ms: SessionMetrics[]): Aggregate {
  const pivots = ms.reduce((a, m) => a + m.pivots, 0)
  const reasons = ms.reduce((a, m) => a + m.reasons, 0)
  const blame = ms.reduce((a, m) => a + m.totalBlame, 0)
  const stopReasons: Partial<Record<StopReason, number>> = {}
  for (const m of ms) stopReasons[m.stopReason] = (stopReasons[m.stopReason] ?? 0) + 1 / ms.length
  return {
    n: ms.length,
    medianSwipes: quantile(ms.map((m) => m.swipes), 0.5),
    p90Swipes: quantile(ms.map((m) => m.swipes), 0.9),
    maxReached: rate(ms.map((m) => m.stopReason === 'max_reached')),
    hit1: rate(ms.map((m) => m.hit1)),
    hit3: rate(ms.map((m) => m.hit3)),
    acceptable: rate(ms.map((m) => m.acceptable)),
    regret: mean(ms.map((m) => m.regret)),
    medianSwipesToCorrect: quantile(ms.map((m) => m.swipesToCorrect), 0.5),
    featurePrecision: mean(ms.map((m) => m.featurePrecision)),
    pivotRate: rate(ms.map((m) => m.pivots > 0)),
    pivotRecovery: pivots ? ms.reduce((a, m) => a + m.pivotsRecovered, 0) / pivots : 0,
    prematureLock: rate(ms.map((m) => m.prematureLock)),
    familiesFirst8: mean(ms.map((m) => m.familiesFirst8)),
    bothModes: rate(ms.map((m) => m.bothModes)),
    entropyDrop: mean(ms.map((m) => m.meanEntropyDrop)),
    reasonTruth: reasons ? ms.reduce((a, m) => a + m.reasonsTrue, 0) / reasons : 0,
    unsupported: ms.reduce((a, m) => a + m.unsupportedClaims, 0),
    innocentShare: blame ? ms.reduce((a, m) => a + m.innocentBlame, 0) / blame : 0,
    dietViolations: ms.reduce((a, m) => a + m.dietViolations, 0),
    stopReasons,
  }
}

export interface Criterion {
  name: string
  target: string
  actual: string
  pass: boolean
  /** Deferred by decision at M0 close: reported, not counted. */
  deferred?: string
}

const GATED = PERSONAS.filter((p) => p.gated).map((p) => p.id)

export function exitCriteria(byPolicy: Map<string, SessionMetrics[]>, groups: GroupMetrics[]): Criterion[] {
  const eig = byPolicy.get('eig') ?? []
  const of = (ids: string[], list = eig) => list.filter((m) => ids.includes(m.personaId))
  const gated = aggregate(of(GATED))
  const gatedExceptEasyYes = aggregate(of(GATED.filter((id) => id !== 'P12')))
  const noisy = aggregate(of(['P10']))
  const p7 = aggregate(of(['P7']))
  const p11 = aggregate(of(['P11']))
  const all = aggregate(eig)
  const out: Criterion[] = [
    {
      name: 'Median swipes to stop (gated personas)',
      target: '8–12, p90 ≤ 14',
      actual: `median ${gated.medianSwipes}, p90 ${gated.p90Swipes}`,
      pass: gated.medianSwipes >= 8 && gated.medianSwipes <= 12 && gated.p90Swipes <= 14,
    },
    // Criteria as approved at M0 close (docs/m0-report.md §4A).
    {
      name: 'Max-reached rate (gated, excl. P12)',
      target: '≤ 10%',
      actual: pct(gatedExceptEasyYes.maxReached),
      pass: gatedExceptEasyYes.maxReached <= 0.1,
    },
    {
      name: 'Acceptable hero / hit@3 (gated)',
      target: '≥ 90% / ≥ 80% (hit@1 reported)',
      actual: `${pct(gated.acceptable)} / ${pct(gated.hit3)} (hit@1 ${pct(gated.hit1)})`,
      pass: gated.acceptable >= 0.9 && gated.hit3 >= 0.8,
    },
    {
      name: 'Acceptable hero (P10 noisy)',
      target: '≥ 90% (hit@1/@3 reported)',
      actual: `${pct(noisy.acceptable)} (hit@1 ${pct(noisy.hit1)}, hit@3 ${pct(noisy.hit3)})`,
      pass: noisy.acceptable >= 0.9,
    },
  ]
  const greedy = byPolicy.get('greedy')
  if (greedy) {
    const g = aggregate(of(GATED, greedy))
    const fewer = (g.medianSwipesToCorrect - gated.medianSwipesToCorrect) / Math.max(1, g.medianSwipesToCorrect)
    out.push({
      name: 'EIG vs greedy',
      target: '≥ 15% fewer swipes-to-correct OR ≥ 10pt hit@1',
      actual: `STC ${gated.medianSwipesToCorrect} vs ${g.medianSwipesToCorrect}; hit@1 ${pct(gated.hit1)} vs ${pct(g.hit1)}`,
      pass: fewer >= 0.15 || gated.hit1 - g.hit1 >= 0.1,
    })
  }
  const random = byPolicy.get('random')
  if (random) {
    const r = aggregate(of(GATED, random))
    out.push({
      name: 'EIG vs random',
      target: 'better on STC and hit@1',
      actual: `STC ${gated.medianSwipesToCorrect} vs ${r.medianSwipesToCorrect}; hit@1 ${pct(gated.hit1)} vs ${pct(r.hit1)}`,
      pass: gated.medianSwipesToCorrect < r.medianSwipesToCorrect && gated.hit1 > r.hit1,
    })
  }
  out.push(
    {
      name: 'Feature recovery precision@k (gated)',
      target: '≥ 0.6',
      actual: f2(gated.featurePrecision),
      pass: gated.featurePrecision >= 0.6,
      deferred: 'with explanation contrast logic',
    },
    { name: 'P7 mis-stated craving hit@3', target: '≥ 70%', actual: pct(p7.hit3), pass: p7.hit3 >= 0.7 },
    { name: 'P11 premature lock', target: '≤ 20%', actual: pct(p11.prematureLock), pass: p11.prematureLock <= 0.2 },
    {
      name: 'Diet violations / unsupported claims',
      target: '0 / 0 (hard gate)',
      actual: `${all.dietViolations} / ${all.unsupported}`,
      pass: all.dietViolations === 0 && all.unsupported === 0,
    },
  )
  if (groups.length) {
    const finalTop3 = rate(groups.map((g) => g.finalInTruthTop3))
    const det = rate(groups.map((g) => g.deterministic))
    const diet = groups.reduce((a, g) => a + g.dietViolations, 0)
    out.push({
      name: 'Group determinism / diet (hard gates)',
      target: '100% / 0',
      actual: `${pct(det)} / ${diet}`,
      pass: det === 1 && diet === 0,
    })
    out.push({
      name: 'Group final pick in true top 3',
      target: 'threshold to be set in M2',
      actual: pct(finalTop3),
      pass: false,
      deferred: 'group tuning deferred to M2',
    })
  }
  return out
}

export function renderReport(
  byPolicy: Map<string, SessionMetrics[]>,
  groups: GroupMetrics[],
  meta: { seeds: number; overrides: Record<string, unknown>; seconds: number; deterministic: boolean },
): string {
  const lines: string[] = []
  const eig = byPolicy.get('eig') ?? []
  lines.push('# Engine simulation report', '')
  lines.push(`Seeds per persona: **${meta.seeds}** · config overrides: \`${JSON.stringify(meta.overrides)}\` · ${meta.seconds.toFixed(0)} s · transcript determinism: **${meta.deterministic ? 'pass' : 'FAIL'}**`, '')

  const criteria = exitCriteria(byPolicy, groups)
  lines.push('## Exit criteria (MVP_SPEC §14.4)', '', '| Criterion | Target | Actual | |', '|---|---|---|---|')
  for (const c of criteria) lines.push(`| ${c.name} | ${c.target} | ${c.actual} | ${c.deferred ? `⏸ deferred (${c.deferred})` : c.pass ? '✅' : '❌'} |`)
  const counted = criteria.filter((c) => !c.deferred)
  lines.push('', `**${counted.filter((c) => c.pass).length} / ${counted.length} passing** (${criteria.length - counted.length} deferred).`, '')

  lines.push('## Per persona (EIG policy)', '')
  lines.push('| Persona | Swipes med / p90 | Max-reached | hit@1 | hit@3 | Acceptable hero | Regret | STC med | Feature prec. | Pivot rate / recovery | Premature lock | Families in first 8 | Reasons true | Innocent blame |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const p of PERSONAS) {
    const a = aggregate(eig.filter((m) => m.personaId === p.id))
    if (!a.n) continue
    lines.push(
      `| ${p.id} ${p.name}${p.gated ? '' : ' *'} | ${a.medianSwipes} / ${a.p90Swipes} | ${pct(a.maxReached)} | ${pct(a.hit1)} | ${pct(a.hit3)} | ${pct(a.acceptable)} | ${f2(a.regret)} | ${a.medianSwipesToCorrect} | ${f2(a.featurePrecision)} | ${pct(a.pivotRate)} / ${pct(a.pivotRecovery)} | ${pct(a.prematureLock)} | ${a.familiesFirst8.toFixed(1)} | ${pct(a.reasonTruth)} | ${pct(a.innocentShare)} |`,
    )
  }
  lines.push('', '\\* not gated (reported only). STC = swipes until the engine’s top pick is in the persona’s true top 3 and stays there (16 = never).', '')
  const p11 = aggregate(eig.filter((m) => m.personaId === 'P11'))
  lines.push(`P11 two-modes: both modes shown in **${pct(p11.bothModes)}** of sessions.`, '')

  lines.push('## Stop reasons (EIG policy)', '', '| Persona | confident | converged | max_reached | pool_exhausted |', '|---|---|---|---|---|')
  for (const p of PERSONAS) {
    const a = aggregate(eig.filter((m) => m.personaId === p.id))
    if (!a.n) continue
    const r = a.stopReasons
    lines.push(`| ${p.id} | ${pct(r.confident ?? 0)} | ${pct(r.converged ?? 0)} | ${pct(r.max_reached ?? 0)} | ${pct(r.pool_exhausted ?? 0)} |`)
  }

  lines.push('', '## Ablations (gated personas)', '', '| Policy | Swipes med | hit@1 | hit@3 | Acceptable | STC med | Entropy drop / swipe | Families in first 8 | Innocent blame |', '|---|---|---|---|---|---|---|---|---|')
  const gatedIds = PERSONAS.filter((p) => p.gated).map((p) => p.id)
  for (const [policy, ms] of byPolicy) {
    const a = aggregate(ms.filter((m) => gatedIds.includes(m.personaId)))
    lines.push(`| ${policy} | ${a.medianSwipes} | ${pct(a.hit1)} | ${pct(a.hit3)} | ${pct(a.acceptable)} | ${a.medianSwipesToCorrect} | ${a.entropyDrop.toFixed(3)} | ${a.familiesFirst8.toFixed(1)} | ${pct(a.innocentShare)} |`)
  }

  if (groups.length) {
    lines.push('', '## Group scenarios', '', '| Scenario | Seeds | Outcomes | Expected outcome | Hero in true top 3 | Final pick in true top 3 | Final pick acceptable to all (when possible) | Deterministic | Diet violations | ms / run |', '|---|---|---|---|---|---|---|---|---|---|')
    for (const id of [...new Set(groups.map((g) => g.scenarioId))]) {
      const gs = groups.filter((g) => g.scenarioId === id)
      const outcomes = ['WINNER', 'COMMON_GROUND', 'NOBODY_AGREES'].map((o) => `${o} ${pct(rate(gs.map((g) => g.outcome === o)))}`).join(', ')
      lines.push(
        `| ${id} | ${gs.length} | ${outcomes} | ${pct(rate(gs.map((g) => g.expectedOutcome)))} | ${pct(rate(gs.map((g) => g.heroInTruthTop3)))} | ${pct(rate(gs.map((g) => g.finalInTruthTop3)))} | ${gs.some((g) => g.feasible) ? pct(rate(gs.filter((g) => g.feasible).map((g) => g.finalAcceptableToAll))) + ` (${gs.filter((g) => g.feasible).length} runs)` : 'n/a: no such dish'} | ${pct(rate(gs.map((g) => g.deterministic)))} | ${gs.reduce((a, g) => a + g.dietViolations, 0)} | ${mean(gs.map((g) => g.ms)).toFixed(0)} |`,
      )
    }
  }
  return lines.join('\n') + '\n'
}

/** The M0 scorecard as plain numbers (rounded to 4 dp), for the frozen-baseline guard. */
export type Scorecard = Record<string, number>

export function scorecard(byPolicy: Map<string, SessionMetrics[]>, groups: GroupMetrics[]): Scorecard {
  const r4 = (x: number) => Math.round(x * 1e4) / 1e4
  const eig = byPolicy.get('eig') ?? []
  const of = (ids: string[], list: SessionMetrics[] = eig) => list.filter((m) => ids.includes(m.personaId))
  const gated = aggregate(of(GATED))
  const out: Scorecard = {
    medianSwipes: gated.medianSwipes,
    p90Swipes: gated.p90Swipes,
    maxReachedGatedExclP12: r4(aggregate(of(GATED.filter((id) => id !== 'P12'))).maxReached),
    acceptableHero: r4(gated.acceptable),
    hit1: r4(gated.hit1),
    hit3: r4(gated.hit3),
    swipesToCorrectEig: gated.medianSwipesToCorrect,
    p10AcceptableHero: r4(aggregate(of(['P10'])).acceptable),
    p7Hit3: r4(aggregate(of(['P7'])).hit3),
    p11PrematureLock: r4(aggregate(of(['P11'])).prematureLock),
    featurePrecision: r4(gated.featurePrecision),
    dietViolations: aggregate(eig).dietViolations,
    unsupportedClaims: aggregate(eig).unsupported,
  }
  const greedy = byPolicy.get('greedy')
  if (greedy) {
    const g = aggregate(of(GATED, greedy))
    out.swipesToCorrectGreedy = g.medianSwipesToCorrect
    out.hit1Greedy = r4(g.hit1)
  }
  const random = byPolicy.get('random')
  if (random) {
    const x = aggregate(of(GATED, random))
    out.swipesToCorrectRandom = x.medianSwipesToCorrect
    out.hit1Random = r4(x.hit1)
  }
  if (groups.length) {
    out.groupDeterminism = r4(rate(groups.map((g) => g.deterministic)))
    out.groupDietViolations = groups.reduce((a, g) => a + g.dietViolations, 0)
    out.groupFinalPickTop3 = r4(rate(groups.map((g) => g.finalInTruthTop3)))
  }
  return out
}
