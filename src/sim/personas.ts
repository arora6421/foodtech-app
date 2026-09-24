import type {
  Axis,
  Budget,
  CravingSelection,
  DietConstraint,
  DishArchetype,
  Fulfilment,
  Level,
  Offering,
} from '../domain'

// Synthetic users with hidden, known preferences (MVP_SPEC §14.2).
//
// Their utility functions deliberately use a DIFFERENT form from the engine's additive
// feature model (hard ceilings, either/or modes, interactions), so a good score means the
// engine learned something real rather than agreeing with itself.

export interface Persona {
  id: string
  name: string
  tests: string
  craving: CravingSelection
  diet: DietConstraint[]
  fulfilment: Fulfilment
  budget: Budget
  /** Hidden truth. Roughly in [−1, 1]; YES when utility + noise > threshold. */
  utility: (a: DishArchetype, o: Offering) => number
  threshold: number
  noise: { flipProb: number; sd: number }
  /** Features this persona genuinely likes: the yardstick for recovery, blame and explanation checks. */
  trueLikes: string[]
  /** Counted in the exit-criteria aggregates (P9, P10 and P13 are reported separately). */
  gated: boolean
}

const ax = (a: DishArchetype, o: Offering, axis: Axis): Level => o.overrides?.axes?.[axis] ?? a.axes[axis]
const has = <T>(xs: readonly T[], x: T) => xs.includes(x)
const QUIET = { flipProb: 0.05, sd: 0.1 }
const normal = (moods: CravingSelection['moods'] = []): CravingSelection => ({ moods, intent: 'normal' })

const heatSeeker = (a: DishArchetype, o: Offering) => {
  const spice = ax(a, o, 'spice')
  return (spice >= 3 ? 0.6 : spice === 2 ? 0.1 : -0.4) + (has(a.textures, 'crispy') ? 0.3 : 0) + (has(a.proteins, 'chicken') ? 0.3 : 0)
}

export const PERSONAS: Persona[] = [
  {
    id: 'P1',
    name: 'Heat seeker',
    tests: 'axis learning, texture',
    craving: normal(['spicy']),
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: heatSeeker,
    threshold: 0.35,
    noise: QUIET,
    trueLikes: ['spice:3', 'spice:4', 'texture:crispy', 'protein:chicken'],
    gated: true,
  },
  {
    id: 'P2',
    name: 'Comfort classicist',
    tests: 'spice ceiling detection',
    craving: normal(['comforting']),
    diet: [],
    fulfilment: 'go_out',
    budget: 'mid',
    utility: (a, o) => {
      if (ax(a, o, 'spice') >= 2) return -0.8 // hard ceiling
      const cuisine = a.cuisine === 'british' || a.cuisine === 'italian' ? 0.5 : a.cuisine === 'american' ? 0.2 : 0
      const rich = ax(a, o, 'richness') >= 3 ? 0.3 : -0.2
      const adv = ax(a, o, 'adventurousness')
      return cuisine + rich + (adv === 0 ? 0.2 : adv >= 2 ? -0.4 : 0)
    },
    threshold: 0.4,
    noise: QUIET,
    trueLikes: ['cuisine:british', 'cuisine:italian', 'rich:3', 'rich:4', 'adv:0', 'spice:0'],
    gated: true,
  },
  {
    id: 'P3',
    name: 'Fresh & light',
    tests: 'negative richness evidence; fish is liked (innocent-blame check)',
    craving: normal(['fresh']),
    diet: [],
    fulfilment: 'delivery',
    budget: 'any',
    utility: (a, o) => {
      const rich = ax(a, o, 'richness')
      return (
        (rich <= 1 ? 0.5 : rich === 2 ? 0 : -0.6) +
        (a.cuisine === 'vietnamese' || a.cuisine === 'japanese' ? 0.3 : 0) +
        (a.format === 'salad_bowl' ? 0.2 : 0) +
        (has(a.proteins, 'fish') || has(a.proteins, 'shellfish') ? 0.2 : 0)
      )
    },
    threshold: 0.45,
    noise: QUIET,
    trueLikes: ['rich:0', 'rich:1', 'cuisine:vietnamese', 'cuisine:japanese', 'protein:fish', 'protein:shellfish'],
    gated: true,
  },
  {
    id: 'P4',
    name: 'Vegan explorer',
    tests: 'hard filter + novelty',
    craving: { moods: [], intent: 'something_new' },
    diet: ['vegan'],
    fulfilment: 'either',
    budget: 'any',
    utility: (a, o) => {
      const adv = ax(a, o, 'adventurousness')
      return (adv >= 3 ? 0.6 : adv === 2 ? 0.2 : -0.3) + (has(a.flavours, 'aromatic') ? 0.3 : 0) + (ax(a, o, 'spice') >= 2 ? 0.1 : 0)
    },
    threshold: 0.45,
    noise: QUIET,
    trueLikes: ['adv:3', 'adv:4', 'flavour:aromatic'],
    gated: true,
  },
  {
    id: 'P5',
    name: 'Noodle monomaniac',
    tests: 'format dominance',
    craving: normal(['carby']),
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: (a) => (a.format === 'noodles' ? 0.9 : a.format === 'dumplings_buns' || has(a.textures, 'brothy') ? 0.1 : -0.2),
    threshold: 0.4,
    noise: QUIET,
    trueLikes: ['format:noodles'],
    gated: true,
  },
  {
    id: 'P6',
    name: 'Needle in a haystack',
    tests: 'information gain from a standing start',
    craving: { moods: [], intent: 'no_idea' },
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: (a) => (a.format === 'dumplings_buns' ? 1.0 : 0.2 + (a.cuisine === 'chinese' ? 0.1 : 0)),
    threshold: 0.35,
    noise: { flipProb: 0.05, sd: 0.15 },
    trueLikes: ['format:dumplings_buns'],
    gated: true,
  },
  {
    id: 'P7',
    name: 'Mis-stated craving',
    tests: 'swipes must override priors (taps Fresh, wants indulgent)',
    craving: normal(['fresh']),
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: (a, o) => {
      const rich = ax(a, o, 'richness')
      return (has(a.moods, 'indulgent') ? 0.6 : 0) + (rich >= 3 ? 0.3 : rich <= 1 ? -0.4 : 0) + (has(a.textures, 'crispy') ? 0.1 : 0)
    },
    threshold: 0.45,
    noise: QUIET,
    trueLikes: ['mood:indulgent', 'rich:3', 'rich:4'],
    gated: true,
  },
  {
    id: 'P8',
    name: 'Pescatarian Mediterranean',
    tests: 'diet + cuisine family',
    craving: normal([]),
    diet: ['pescatarian'],
    fulfilment: 'either',
    budget: 'any',
    utility: (a, o) => {
      const fam =
        a.cuisine === 'italian' || a.cuisine === 'greek' || a.cuisine === 'spanish'
          ? 0.5
          : a.cuisine === 'lebanese' || a.cuisine === 'turkish'
            ? 0.25
            : 0
      return (
        fam +
        (has(a.proteins, 'fish') || has(a.proteins, 'shellfish') ? 0.35 : 0) +
        (has(a.flavours, 'herby') || has(a.flavours, 'garlicky') ? 0.1 : 0) -
        (ax(a, o, 'spice') >= 3 ? 0.3 : 0)
      )
    },
    threshold: 0.45,
    noise: QUIET,
    trueLikes: ['family:mediterranean', 'protein:fish', 'protein:shellfish', 'cuisine:italian', 'cuisine:greek', 'cuisine:spanish'],
    gated: true,
  },
  {
    id: 'P9',
    name: 'Picky',
    tests: 'silent pivot recovery, max-reached',
    craving: normal([]),
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: (a) => (a.format === 'burger' || (a.format === 'pizza_flatbread' && a.cuisine === 'italian') ? 0.9 : -0.2),
    threshold: 0.6,
    noise: { flipProb: 0, sd: 0.05 },
    trueLikes: ['format:burger', 'format:pizza_flatbread'],
    gated: false,
  },
  {
    id: 'P10',
    name: 'Noisy swiper',
    tests: 'robustness: P1 tastes, 20% random flips',
    craving: normal(['spicy']),
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: heatSeeker,
    threshold: 0.35,
    noise: { flipProb: 0.2, sd: 0.1 },
    trueLikes: ['spice:3', 'spice:4', 'texture:crispy', 'protein:chicken'],
    gated: false,
  },
  {
    id: 'P11',
    name: 'Two modes',
    tests: 'echo chamber / premature lock',
    craving: normal([]),
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: (a) =>
      (a.cuisine === 'indian' && a.format === 'curry_stew') || (a.cuisine === 'mexican' && a.format === 'tacos_burrito') ? 0.9 : -0.1,
    threshold: 0.4,
    noise: QUIET,
    trueLikes: ['cuisine:indian', 'cuisine:mexican', 'format:curry_stew', 'format:tacos_burrito'],
    gated: true,
  },
  {
    id: 'P12',
    name: 'Easy yes',
    tests: 'discrimination with little signal',
    craving: normal([]),
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: (a, o) => 0.3 * (ax(a, o, 'spice') / 4) - (ax(a, o, 'adventurousness') >= 3 ? 0.1 : 0),
    threshold: -0.05,
    noise: { flipProb: 0.05, sd: 0.2 },
    trueLikes: ['spice:3', 'spice:4', 'spice:2'],
    gated: true,
  },
  {
    id: 'P13',
    name: 'Interaction',
    tests: 'non-additive truth: spicy only on noodles (reported, not gated)',
    craving: normal([]),
    diet: [],
    fulfilment: 'either',
    budget: 'any',
    utility: (a, o) => {
      const spice = ax(a, o, 'spice')
      return a.format === 'noodles' ? (spice >= 3 ? 0.9 : -0.2) : spice <= 1 ? 0.3 : -0.3
    },
    threshold: 0.4,
    noise: QUIET,
    trueLikes: ['format:noodles', 'spice:3', 'spice:4'],
    gated: false,
  },
]

export const personaById = (id: string) => PERSONAS.find((p) => p.id === id)!

export interface GroupScenario {
  id: string
  description: string
  members: string[]
  expected: ('WINNER' | 'COMMON_GROUND' | 'NOBODY_AGREES')[]
}

export const GROUP_SCENARIOS: GroupScenario[] = [
  { id: 'G-A', description: 'Heat seeker + noodle lover + spicy-noodle lover', members: ['P1', 'P5', 'P13'], expected: ['WINNER', 'COMMON_GROUND'] },
  { id: 'G-B', description: 'Vegan explorer + heat seeker (vegan pool)', members: ['P4', 'P1'], expected: ['WINNER', 'COMMON_GROUND'] },
  { id: 'G-C', description: 'Fresh & light + comfort classicist + picky', members: ['P3', 'P2', 'P9'], expected: ['NOBODY_AGREES'] },
  {
    id: 'G-D',
    description: 'Six members, mixed diets (stress)',
    members: ['P1', 'P3', 'P4', 'P8', 'P11', 'P12'],
    expected: ['WINNER', 'COMMON_GROUND', 'NOBODY_AGREES'],
  },
]
