import type { Budget, Fulfilment, Mood } from '../domain'

// Every tunable constant in the engine, with the MVP_SPEC section it comes from.
// Passed in (never imported as a global) so simulations can sweep it.

export type Namespace =
  | 'cuisine'
  | 'family'
  | 'format'
  | 'protein'
  | 'mood'
  | 'texture'
  | 'flavour'
  | 'temp'
  | 'spice'
  | 'rich'
  | 'adv'

export interface PhaseWeights {
  info: number
  exploit: number
}

/** Pseudo-evidence added by a craving: feature id → strength (negative = neg evidence). */
export type PriorTable = Record<string, number>

export interface EngineConfig {
  // §7.1 features
  salience: Record<Namespace, number>
  /** Namespaces whose multiple values share salience as 1/√k. */
  splitNamespaces: readonly Namespace[]

  // §7.2–7.3 evidence
  K: number
  etaYes: number
  etaSuperYes: number
  etaNo: number
  etaNotQuite: number
  gamma: number
  shieldPref: number
  blameCapMultiple: number
  spillYes: number
  spillSpiceNoUp: readonly number[]
  spillOtherNo: number
  /** Off by default (rev. 2). The §7.3 fallback if the explaining-away risk shows up in sims. */
  negativeFirstBlame: boolean

  // §7.5–7.6 priors
  cravingPriors: Record<Mood, PriorTable>
  somethingNewPriors: PriorTable

  // §8 scoring
  beta: number
  /** p_yes(c) = Σ P(a) · sim(a, c)^exponent, clamped (rev. 3, §9.1). */
  yesSimilarityExponent: number
  pYesClamp: readonly [number, number]
  wPrice: number
  wDistance: Record<Fulfilment, number>
  budgetCeilingPence: Record<Exclude<Budget, 'any'>, number>
  budgetHardCapMultiple: number
  priceSoftBand: number
  maxDistanceMiles: Record<Fulfilment, number>
  /** Local (Europe/London) minutes-of-day when breakfast dishes are eligible. */
  breakfastWindow: readonly [number, number]
  timeZone: string

  // §9 deck
  /** Card policy. 'greedy' and 'random' exist for the M0 ablations (§14.3). */
  deckPolicy: 'eig' | 'greedy' | 'random'
  probeCards: number
  probeCardsNoIdea: number
  narrowLastCard: number
  confirmMassThreshold: number
  phaseWeights: { probe: PhaseWeights; narrow: PhaseWeights; confirm: PhaseWeights }
  somethingNewInfoMultiplier: number
  cravingRespectInFirst: number
  cravingRespectCount: number
  adjacencySlots: readonly number[]
  somethingNewAdjacencyFrom: number
  somethingNewAdjacencyEvery: number
  likedPref: number
  likedConfidence: number
  maxLiked: number
  unexploredConfidence: number
  repetition: { cuisineWithin: number; cuisine: number; formatWithin: number; format: number; venueWithin: number; venue: number }
  venueDiversityTolerance: number
  probeJitter: number

  // §9.7 clusters
  clusterCount: number

  // §10 stopping
  minSwipes: number
  confidentMass: number
  /** Rev. 3: also stop when this much belief sits in the top dish's cluster (class-level wants, e.g. "any noodles"). > 1 disables. */
  clusterConfidentMass: number
  clusterRelaxedMass: number
  /** Rev. 3: Confirm can't start before this card, so a fast-sharpening belief doesn't skip Narrow. */
  confirmEarliestCard: number
  relaxedFromSwipe: number
  relaxedMass: number
  supportTaste: number
  supportConfidence: number
  stableChecks: number
  maxSwipes: number
  notQuiteExtension: number
  notQuiteMinSwipes: number
  notQuiteNarrowCards: number
  minUnseen: number
  counterMass: number
  runnersUp: number
  pickListSize: number

  // §10.3 silent pivot
  pivotStreak: number
  /** Which NOPEs build the streak. 'narrow' (the spec) measured far better than 'post_probe' in M0.13. */
  pivotCounts: 'narrow' | 'post_probe'
  maxPivots: number
  pivotFlattenCards: number
  pivotBetaFactor: number
  pivotCravingFactor: number

  // §12 group
  group: {
    sharedCards: number
    personalCards: number
    minSwipes: number
    minMembers: number
    maxMembers: number
    lambda: number
    tau: number
    winnerScore: number
    winnerMin: number
    okScore: number
    commonGroundPref: number
    commonGroundConfidence: number
    conflictHigh: number
    conflictLow: number
    relaxDistance: number
    sharedDiversity: number
  }
}

export const DEFAULT_CONFIG: EngineConfig = {
  salience: {
    cuisine: 1.0,
    family: 0.5,
    format: 1.0,
    protein: 0.8,
    mood: 0.6,
    texture: 0.5,
    flavour: 0.35,
    temp: 0.4,
    spice: 0.9,
    rich: 0.5,
    adv: 0.35,
  },
  splitNamespaces: ['protein', 'mood', 'texture', 'flavour'],

  K: 2,
  etaYes: 1.0,
  etaSuperYes: 1.5,
  etaNo: 0.6,
  etaNotQuite: 1.0,
  gamma: 0.92,
  shieldPref: 0.5,
  blameCapMultiple: 2,
  spillYes: 0.4,
  spillSpiceNoUp: [0.6, 0.3],
  spillOtherNo: 0.3,
  negativeFirstBlame: false,

  cravingPriors: {
    spicy: { 'spice:3': 1.5, 'spice:4': 1.0, 'spice:2': 0.5, 'spice:0': -1.0 },
    comforting: { 'mood:comforting': 1.5, 'temp:hot': 0.5 },
    carby: { 'mood:carby': 1.5 },
    fresh: { 'mood:fresh': 1.5, 'rich:0': 0.5, 'rich:1': 0.5, 'rich:4': -0.5 },
    indulgent: { 'mood:indulgent': 1.5, 'rich:3': 0.5, 'rich:4': 0.5 },
    warm_soupy: { 'mood:warm_soupy': 1.5, 'texture:brothy': 1.0, 'temp:hot': 0.5 },
    sweet: { 'mood:sweet': 1.5 },
  },
  somethingNewPriors: { 'adv:3': 1.0, 'adv:4': 0.75, 'adv:0': -0.5 },

  beta: 20, // M0.13 tuning: 6 left the belief flat (91% of sessions hit the cap); 25 overcommits
  yesSimilarityExponent: 2,
  pYesClamp: [0.05, 0.95],
  wPrice: 0.25,
  wDistance: { go_out: 0.3, either: 0.2, delivery: 0.1 },
  budgetCeilingPence: { low: 1000, mid: 1600, high: 2500 },
  budgetHardCapMultiple: 1.3,
  priceSoftBand: 0.3,
  maxDistanceMiles: { delivery: 4.0, go_out: 1.5, either: 3.0 },
  breakfastWindow: [6 * 60, 11 * 60 + 30],
  timeZone: 'Europe/London',

  deckPolicy: 'eig',
  probeCards: 3,
  probeCardsNoIdea: 5,
  narrowLastCard: 9,
  confirmMassThreshold: 0.45,
  phaseWeights: {
    probe: { info: 0.85, exploit: 0.15 },
    narrow: { info: 0.5, exploit: 0.5 },
    confirm: { info: 0.2, exploit: 0.8 },
  },
  somethingNewInfoMultiplier: 1.6,
  cravingRespectInFirst: 3,
  cravingRespectCount: 2,
  adjacencySlots: [6, 9],
  somethingNewAdjacencyFrom: 4,
  somethingNewAdjacencyEvery: 3,
  likedPref: 0.3,
  likedConfidence: 0.3,
  maxLiked: 3,
  unexploredConfidence: 0.25,
  repetition: { cuisineWithin: 2, cuisine: 0.15, formatWithin: 2, format: 0.1, venueWithin: 3, venue: 0.1 },
  venueDiversityTolerance: 0.05,
  probeJitter: 0.03,

  clusterCount: 13,

  minSwipes: 8, // M0.13: 6 → 8 puts the median in the 8–12 target and lifts hit@1 by ~6 points
  confidentMass: 0.6,
  clusterConfidentMass: 0.75,
  clusterRelaxedMass: 0.6,
  confirmEarliestCard: 6,
  relaxedFromSwipe: 10,
  relaxedMass: 0.45,
  supportTaste: 0.15, // M0.13 tuning: 0.3 kept class-level wants ("any noodles") from ever stopping
  supportConfidence: 0.35,
  stableChecks: 2,
  maxSwipes: 15,
  notQuiteExtension: 5,
  notQuiteMinSwipes: 3,
  notQuiteNarrowCards: 3,
  minUnseen: 2,
  counterMass: 0.9,
  runnersUp: 2,
  pickListSize: 5,

  pivotStreak: 3,
  pivotCounts: 'narrow',
  maxPivots: 2,
  pivotFlattenCards: 3,
  pivotBetaFactor: 0.5,
  pivotCravingFactor: 0.5,

  group: {
    sharedCards: 6,
    personalCards: 6,
    minSwipes: 6,
    minMembers: 2,
    maxMembers: 6,
    lambda: 1.0,
    tau: -0.1,
    winnerScore: 0.35,
    winnerMin: 0.2,
    okScore: 0.1,
    commonGroundPref: 0.2,
    commonGroundConfidence: 0.3,
    conflictHigh: 0.4,
    conflictLow: -0.3,
    relaxDistance: 1.5,
    sharedDiversity: 0.5,
  },
}

/** Shallow-merge helper for sims and tests. */
export function withConfig(overrides: Partial<EngineConfig>): EngineConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}
