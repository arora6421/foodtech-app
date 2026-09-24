import type { ArchetypeId } from '../../domain'
import type { EngineConfig } from '../config'
import type { FeatureId, FeatureVector } from '../features/featurize'
import { swipeDeltas, view } from '../profile/profile'
import type { Profile } from '../profile/profile'

// Expected information gain of showing a card (MVP_SPEC §9.1):
//   EIG(c) = H(P) − [ p_yes · H(P⁺) + (1 − p_yes) · H(P⁻) ]
//
// Computed incrementally. Every hypothetical swipe advances decay by one step for *all*
// features, which is shared; only the few features the card touches then differ. So we
// precompute decayed-baseline prefs and tastes once, and adjust sparsely per hypothesis.
// `slowExpectedEntropy` in the tests is the obviously-correct reference.

interface FeatureStat {
  pp: number // prior pos
  pn: number // prior neg
  sp: number // swipe pos (real, current)
  sn: number // swipe neg (real, current)
}

export interface InfoGainModel {
  /** H(P) under the current profile. */
  entropyNow: number
  /** EIG for a card; the hypothesis set is fixed at construction. */
  eig(cardId: ArchetypeId, cardVector: FeatureVector, pYes: number): number
}

function entropyOfLogits(logits: Float64Array, skip: number): number {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) if (i !== skip && logits[i]! > max) max = logits[i]!
  let z = 0
  for (let i = 0; i < logits.length; i++) if (i !== skip) z += Math.exp(logits[i]! - max)
  let h = 0
  for (let i = 0; i < logits.length; i++) {
    if (i === skip) continue
    const p = Math.exp(logits[i]! - max) / z
    if (p > 0) h -= p * Math.log(p)
  }
  return h
}

export function buildInfoGainModel(
  profile: Profile,
  hypotheses: readonly ArchetypeId[],
  vectorOf: (id: ArchetypeId) => FeatureVector,
  beta: number,
  config: EngineConfig,
): InfoGainModel {
  const { gamma, K } = config
  const vectors = hypotheses.map(vectorOf)
  const salienceSums = vectors.map((v) => {
    let s = 0
    for (const w of v.values()) s += w
    return s
  })
  const index = new Map(hypotheses.map((id, i) => [id, i]))

  // Inverted index: feature → (hypothesis, salience).
  const holders = new Map<FeatureId, { i: number; s: number }[]>()
  vectors.forEach((v, i) => {
    for (const [f, s] of v) {
      const list = holders.get(f) ?? []
      list.push({ i, s })
      holders.set(f, list)
    }
  })

  const stats = new Map<FeatureId, FeatureStat>()
  for (const f of holders.keys()) {
    const v = view(profile, f, gamma)
    stats.set(f, { pp: v.priorPos, pn: v.priorNeg, sp: v.swipePos, sn: v.swipeNeg })
  }
  const prefWith = (st: FeatureStat, decay: number, dPos: number, dNeg: number) => {
    const pos = st.pp + decay * st.sp + dPos
    const neg = st.pn + decay * st.sn + dNeg
    return (pos - neg) / (pos + neg + K)
  }

  const tasteAt = (decay: number) =>
    vectors.map((v, i) => {
      let num = 0
      for (const [f, s] of v) num += s * prefWith(stats.get(f)!, decay, 0, 0)
      return salienceSums[i] === 0 ? 0 : num / salienceSums[i]!
    })

  const nowTastes = tasteAt(1)
  const baseTastes = tasteAt(gamma) // one decay step, no new evidence
  const basePref = new Map<FeatureId, number>()
  for (const [f, st] of stats) basePref.set(f, prefWith(st, gamma, 0, 0))

  const nowLogits = Float64Array.from(nowTastes, (t) => beta * t)
  const entropyNow = entropyOfLogits(nowLogits, -1)
  const scratch = new Float64Array(hypotheses.length)

  const expectedEntropyAfter = (cardVector: FeatureVector, kind: 'yes' | 'no', skip: number) => {
    const { amounts } = swipeDeltas(profile, cardVector, kind, config)
    for (let i = 0; i < scratch.length; i++) scratch[i] = baseTastes[i]!
    for (const [f, x] of amounts) {
      const list = holders.get(f)
      if (!list) continue
      const st = stats.get(f)!
      const after = kind === 'yes' ? prefWith(st, gamma, x, 0) : prefWith(st, gamma, 0, x)
      const d = after - basePref.get(f)!
      for (const { i, s } of list) scratch[i] = scratch[i]! + (s * d) / salienceSums[i]!
    }
    for (let i = 0; i < scratch.length; i++) scratch[i] = beta * scratch[i]!
    return entropyOfLogits(scratch, skip)
  }

  return {
    entropyNow,
    eig(cardId, cardVector, pYes) {
      const hYes = expectedEntropyAfter(cardVector, 'yes', -1)
      // A NOPE also removes the card's archetype from the answer set ("not right now").
      const hNo = expectedEntropyAfter(cardVector, 'no', index.get(cardId) ?? -1)
      return entropyNow - (pYes * hYes + (1 - pYes) * hNo)
    },
  }
}
