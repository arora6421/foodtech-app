import type { CravingSelection } from '../../domain'
import type { EngineConfig } from '../config'
import { parseLevelFeature } from '../features/featurize'
import type { FeatureId, FeatureVector } from '../features/featurize'

// Session taste profile as per-feature evidence (MVP_SPEC §7.2–7.6).
//
// Recency decay (γ) is stored in scaled form: real swipe evidence = scaled × γ^n, and a swipe
// recorded as the n-th adds w × γ^(−n). That is exactly w_t = γ^(N − t) without rescaling
// every feature on every swipe, so hypothetical updates (used by information gain) stay cheap.

export interface Evidence {
  readonly cravingPos: number
  readonly cravingNeg: number
  readonly intentPos: number
  readonly intentNeg: number
  readonly swipePosScaled: number
  readonly swipeNegScaled: number
  /** Raw, undecayed counts of swiped cards carrying exactly this feature. */
  readonly yesSeen: number
  readonly noSeen: number
}

export interface Profile {
  readonly features: ReadonlyMap<FeatureId, Evidence>
  /** Swipes applied so far: the decay exponent. */
  readonly n: number
}

export type UpdateKind = 'yes' | 'super_yes' | 'no' | 'not_quite'

const EMPTY: Evidence = {
  cravingPos: 0,
  cravingNeg: 0,
  intentPos: 0,
  intentNeg: 0,
  swipePosScaled: 0,
  swipeNegScaled: 0,
  yesSeen: 0,
  noSeen: 0,
}

export const emptyProfile = (): Profile => ({ features: new Map(), n: 0 })

// ── Reading ────────────────────────────────────────────────────────────────

export interface EvidenceView {
  pos: number
  neg: number
  swipePos: number
  swipeNeg: number
  priorPos: number
  priorNeg: number
  cravingPos: number
  yesSeen: number
  noSeen: number
}

export function view(profile: Profile, f: FeatureId, gamma: number): EvidenceView {
  const e = profile.features.get(f) ?? EMPTY
  const scale = gamma ** profile.n
  const swipePos = e.swipePosScaled * scale
  const swipeNeg = e.swipeNegScaled * scale
  const priorPos = e.cravingPos + e.intentPos
  const priorNeg = e.cravingNeg + e.intentNeg
  return {
    pos: priorPos + swipePos,
    neg: priorNeg + swipeNeg,
    swipePos,
    swipeNeg,
    priorPos,
    priorNeg,
    cravingPos: e.cravingPos,
    yesSeen: e.yesSeen,
    noSeen: e.noSeen,
  }
}

function prefAndConfidence(profile: Profile, f: FeatureId, config: EngineConfig): [number, number] {
  const e = profile.features.get(f)
  if (!e) return [0, 0]
  const scale = config.gamma ** profile.n
  const pos = e.cravingPos + e.intentPos + e.swipePosScaled * scale
  const neg = e.cravingNeg + e.intentNeg + e.swipeNegScaled * scale
  const d = pos + neg + config.K
  return [(pos - neg) / d, (pos + neg) / d]
}

/** pref(f) = (pos − neg) / (pos + neg + K) ∈ (−1, 1). */
export function pref(profile: Profile, f: FeatureId, config: EngineConfig): number {
  return prefAndConfidence(profile, f, config)[0]
}

/** confidence(f) = (pos + neg) / (pos + neg + K) ∈ [0, 1). */
export function confidence(profile: Profile, f: FeatureId, config: EngineConfig): number {
  return prefAndConfidence(profile, f, config)[1]
}

/** Confidence counting swipe evidence only (explanations must not lean on the craving). */
export function swipeConfidence(profile: Profile, f: FeatureId, config: EngineConfig): number {
  const v = view(profile, f, config.gamma)
  const n = v.swipePos + v.swipeNeg
  return n / (n + config.K)
}

// ── Priors ─────────────────────────────────────────────────────────────────

export function withPriors(profile: Profile, craving: CravingSelection, config: EngineConfig): Profile {
  const features = new Map(profile.features)
  const add = (table: Record<string, number>, source: 'craving' | 'intent') => {
    for (const [f, strength] of Object.entries(table)) {
      const e = features.get(f) ?? EMPTY
      features.set(
        f,
        source === 'craving'
          ? { ...e, cravingPos: e.cravingPos + Math.max(0, strength), cravingNeg: e.cravingNeg + Math.max(0, -strength) }
          : { ...e, intentPos: e.intentPos + Math.max(0, strength), intentNeg: e.intentNeg + Math.max(0, -strength) },
      )
    }
  }
  if (craving.intent !== 'no_idea') for (const mood of craving.moods) add(config.cravingPriors[mood], 'craving')
  if (craving.intent === 'something_new') add(config.somethingNewPriors, 'intent')
  return { ...profile, features }
}

/** Silent pivot, step 3: soften whatever craving evidence remains (MVP_SPEC §10.3). */
export function scaleCravingPriors(profile: Profile, factor: number): Profile {
  const features = new Map<FeatureId, Evidence>()
  for (const [f, e] of profile.features) {
    features.set(f, { ...e, cravingPos: e.cravingPos * factor, cravingNeg: e.cravingNeg * factor })
  }
  return { ...profile, features }
}

// ── Swipe updates ──────────────────────────────────────────────────────────

/** NOPE blame per feature: uncertainty × salience, shielding confidently liked features (§7.3). */
export function nopeBlame(profile: Profile, vector: FeatureVector, eta: number, config: EngineConfig): Map<FeatureId, number> {
  const raw = new Map<FeatureId, number>()
  let rawSum = 0
  let salienceSum = 0
  for (const [f, s] of vector) {
    salienceSum += s
    const p = pref(profile, f, config)
    const u = 1 - confidence(profile, f, config)
    const shielded = p > config.shieldPref && view(profile, f, config.gamma).noSeen === 0
    let r = shielded ? 0 : s * u
    if (config.negativeFirstBlame && !shielded) r = s * Math.max(u, Math.max(0, -p))
    raw.set(f, r)
    rawSum += r
  }
  const blame = new Map<FeatureId, number>()
  if (rawSum === 0) return blame
  const total = eta * salienceSum
  for (const [f, r] of raw) {
    if (r === 0) continue
    const s = vector.get(f)!
    blame.set(f, Math.min((total * r) / rawSum, config.blameCapMultiple * eta * s))
  }
  return blame
}

function etaFor(kind: UpdateKind, config: EngineConfig): number {
  switch (kind) {
    case 'yes':
      return config.etaYes
    case 'super_yes':
      return config.etaSuperYes
    case 'no':
      return config.etaNo
    case 'not_quite':
      return config.etaNotQuite
  }
}

/** Neighbouring level features that receive spill-over, with their multipliers. */
function spillTargets(f: FeatureId, positive: boolean, config: EngineConfig): [FeatureId, number][] {
  const lvl = parseLevelFeature(f)
  if (!lvl) return []
  const out: [FeatureId, number][] = []
  const push = (level: number, m: number) => {
    if (level >= 0 && level <= 4 && m > 0) out.push([`${lvl.ns}:${level}`, m])
  }
  if (positive) {
    push(lvl.level - 1, config.spillYes)
    push(lvl.level + 1, config.spillYes)
  } else if (lvl.ns === 'spice') {
    config.spillSpiceNoUp.forEach((m, i) => push(lvl.level + i + 1, m))
  } else {
    push(lvl.level - 1, config.spillOtherNo)
    push(lvl.level + 1, config.spillOtherNo)
  }
  return out
}

export interface SwipeDeltas {
  positive: boolean
  /** Evidence added at full weight (before any later decay), including spill-over. */
  amounts: ReadonlyMap<FeatureId, number>
  /** Features whose raw yes/no count increments: exactly the card's own features. */
  counted: readonly FeatureId[]
}

/** What a swipe would add, computed on the pre-swipe profile. Shared by applySwipe and information gain. */
export function swipeDeltas(profile: Profile, vector: FeatureVector, kind: UpdateKind, config: EngineConfig): SwipeDeltas {
  const eta = etaFor(kind, config)
  const positive = kind === 'yes' || kind === 'super_yes'
  const amounts = new Map<FeatureId, number>()
  const add = (f: FeatureId, x: number) => {
    if (x > 0) amounts.set(f, (amounts.get(f) ?? 0) + x)
  }
  if (positive) {
    for (const [f, s] of vector) {
      add(f, eta * s)
      for (const [g, m] of spillTargets(f, true, config)) add(g, eta * s * m)
    }
  } else {
    const blame = nopeBlame(profile, vector, eta, config)
    for (const [f, b] of blame) {
      add(f, b)
      for (const [g, m] of spillTargets(f, false, config)) add(g, b * m)
    }
  }
  return { positive, amounts, counted: [...vector.keys()] }
}

export function applySwipe(profile: Profile, vector: FeatureVector, kind: UpdateKind, config: EngineConfig): Profile {
  const { positive, amounts, counted } = swipeDeltas(profile, vector, kind, config)
  const n = profile.n + 1
  const inv = config.gamma ** -n // weight 1 today, decayed by γ per later swipe
  const features = new Map(profile.features)
  const touch = (f: FeatureId, update: (e: Evidence) => Evidence) => features.set(f, update(features.get(f) ?? EMPTY))

  for (const [f, x] of amounts) {
    touch(f, (e) =>
      positive
        ? { ...e, swipePosScaled: e.swipePosScaled + x * inv }
        : { ...e, swipeNegScaled: e.swipeNegScaled + x * inv },
    )
  }
  for (const f of counted) {
    touch(f, (e) => (positive ? { ...e, yesSeen: e.yesSeen + 1 } : { ...e, noSeen: e.noSeen + 1 }))
  }
  return { features, n }
}
