import type { Mood } from '../../domain'
import type { FeatureId } from '../features/featurize'

// Words for features (MVP_SPEC §11.4). UK English. A feature missing here is never
// named in an explanation, which is safer than inventing a phrase for it.

const title = (s: string) =>
  s
    .split('_')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')

/** Plural noun phrase: "You said yes to both ___". */
export function nounFor(f: FeatureId): string | undefined {
  const [ns, value] = f.split(':') as [string, string]
  switch (ns) {
    case 'cuisine':
      return `${title(value)} dishes`
    case 'family':
      return `${title(value)} dishes`
    case 'format':
      return FORMAT_NOUNS[value]
    case 'protein':
      return PROTEIN_NOUNS[value]
    case 'texture':
      return `${value} dishes`
    case 'flavour':
      return FLAVOUR_NOUNS[value]
    case 'mood':
      return MOOD_NOUNS[value]
    case 'spice':
      return ({ '0': 'dishes with no heat', '1': 'mild dishes', '2': 'medium-spicy dishes', '3': 'properly spicy dishes', '4': 'fiery dishes' } as Record<string, string>)[value]
    case 'rich':
      return ({ '0': 'very light dishes', '1': 'lighter dishes', '3': 'rich dishes', '4': 'really rich dishes' } as Record<string, string>)[value]
    case 'adv':
      return ({ '0': 'familiar classics', '3': 'less familiar dishes', '4': 'unusual dishes' } as Record<string, string>)[value]
    default:
      return undefined // temp:* and mid levels are too vague to be a reason
  }
}

/** Adjective for the headline: "craving something ___". */
export function adjectiveFor(f: FeatureId): string | undefined {
  const [ns, value] = f.split(':') as [string, string]
  switch (ns) {
    case 'texture':
      return value
    case 'flavour':
      return ({ umami: 'savoury', tangy: 'tangy', sweet: 'sweet', smoky: 'smoky', herby: 'herby', garlicky: 'garlicky', cheesy: 'cheesy', aromatic: 'aromatic' } as Record<string, string>)[value]
    case 'mood':
      return MOOD_ADJECTIVES[value as Mood]
    case 'spice':
      return ({ '3': 'spicy', '4': 'fiery' } as Record<string, string>)[value]
    case 'rich':
      return ({ '0': 'light', '1': 'light', '3': 'rich', '4': 'rich' } as Record<string, string>)[value]
    default:
      return undefined
  }
}

export const MOOD_ADJECTIVES: Record<Mood, string> = {
  spicy: 'spicy',
  comforting: 'comforting',
  fresh: 'fresh',
  carby: 'carby',
  indulgent: 'indulgent',
  warm_soupy: 'warm and soupy',
  sweet: 'sweet',
}

const FORMAT_NOUNS: Record<string, string> = {
  noodles: 'noodle dishes',
  rice: 'rice dishes',
  curry_stew: 'curries and stews',
  soup: 'soups',
  burger: 'burgers',
  sandwich_wrap: 'wraps and sandwiches',
  pizza_flatbread: 'pizzas and flatbreads',
  pasta: 'pasta dishes',
  tacos_burrito: 'tacos and burritos',
  salad_bowl: 'salads',
  dumplings_buns: 'dumplings and buns',
  protein_plate: 'grilled and fried plates',
  small_plates: 'small plates',
  pie_bake: 'pies and bakes',
  breakfast: 'breakfasts',
  dessert: 'desserts',
}

const PROTEIN_NOUNS: Record<string, string> = {
  chicken: 'chicken dishes',
  beef: 'beef dishes',
  pork: 'pork dishes',
  lamb: 'lamb dishes',
  fish: 'fish dishes',
  shellfish: 'seafood dishes',
  tofu_tempeh: 'tofu dishes',
  egg: 'egg dishes',
  legumes: 'bean and chickpea dishes',
  cheese_dairy: 'cheesy dishes',
}

const FLAVOUR_NOUNS: Record<string, string> = {
  umami: 'savoury, umami-rich dishes',
  tangy: 'tangy dishes',
  sweet: 'sweet-leaning dishes',
  smoky: 'smoky dishes',
  herby: 'herby dishes',
  garlicky: 'garlicky dishes',
  cheesy: 'cheesy dishes',
  aromatic: 'aromatic, warm-spiced dishes',
}

const MOOD_NOUNS: Record<string, string> = {
  comforting: 'comforting dishes',
  fresh: 'fresh dishes',
  carby: 'carb-heavy dishes',
  indulgent: 'indulgent dishes',
  warm_soupy: 'warm, soupy dishes',
  sweet: 'sweet things',
}
