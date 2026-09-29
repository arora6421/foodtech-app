import type { DietaryFacts } from '../domain'

// Catalogue validation of dietary flags against what a dish is SAID to contain (docs/labelling-rubric.md:
// "describe the dish as typically made"). The flag/protein consistency check in domain/diet.ts can't
// see an ingredient that isn't a protein, such as honey in a "vegan" dish or pitta in a "gluten-free"
// one; this reads the text people will read: the archetype's name and key ingredients and the
// offering's name and description.
//
// It can only catch what the text names, so it is a floor, not a guarantee: a sauce whose recipe
// isn't listed (soy, stock, dashi) is invisible to it. Each rule is a list of regex fragments matched
// as whole words, case-insensitively. Terms that mean something safe in context are removed first
// (SAFE_PHRASES), e.g. "coconut cream" is not cream and "rice noodles" are not wheat noodles.

const MEAT = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'mutton',
  'veal',
  'duck',
  'turkey',
  'steak',
  'brisket',
  'bacon',
  'ham',
  'gammon',
  'sausages?',
  'chorizo',
  "'?nduja",
  'guanciale',
  'pancetta',
  'prosciutto',
  'salami',
  'pepperoni',
  'lard',
  'lardons?',
  'suet',
  'gelatine',
  'chashu',
  'char siu',
  'doner',
  'shawarma',
  'bulgogi',
  'meatballs?',
  'mince',
]
const FISH = [
  'fish',
  'salmon',
  'tuna',
  'cod',
  'haddock',
  'sea bass',
  'anchov(?:y|ies)',
  'prawns?',
  'shrimps?',
  'mussels?',
  'clams?',
  'crab',
  'lobster',
  'oysters?',
  'squid',
  'octopus',
  'scallops?',
  'seafood',
  'saltfish',
  'katsuobushi',
  'bonito',
  'fish sauce',
  'oyster sauce',
  'worcestershire',
]
const DAIRY_EGG_HONEY = [
  'honey',
  'milk',
  'buttermilk',
  'butter',
  'cream',
  'cheese',
  'cheddar',
  'parmesan',
  'pecorino',
  'mozzarella',
  'fior di latte',
  'feta',
  'halloumi',
  'mascarpone',
  'ricotta',
  'yoghurt',
  'yogurt',
  'custard',
  'béchamel',
  'ghee',
  'paneer',
  'whey',
  'eggs?',
  'ajitama',
  'aioli',
  'mayo',
  'mayonnaise',
  'kewpie',
  'tzatziki',
  'brioche',
]
const PORK = [
  'pork',
  'bacon',
  'ham',
  'gammon',
  'sausages?',
  'chorizo',
  "'?nduja",
  'guanciale',
  'pancetta',
  'prosciutto',
  'salami',
  'pepperoni',
  'lard',
  'lardons?',
  'chashu',
  'char siu',
  'gelatine',
]
const GLUTEN = [
  'bread',
  'sourdough',
  'toast',
  'pitta',
  'pita',
  'flatbread',
  'naan',
  'roti',
  'chapati',
  'baguette',
  'buns?',
  'brioche',
  'croutons?',
  'breadcrumbs?',
  'crumb',
  'panko',
  'batter',
  'battered',
  'flour',
  'wheat',
  'barley',
  'rye',
  'malt',
  'pastry',
  'shortcrust',
  'filo',
  'pasta',
  'spaghetti',
  'penne',
  'macaroni',
  'noodles?',
  'ramen',
  'udon',
  'soba',
  'couscous',
  'bulgur',
  'freekeh',
  'tabbouleh',
  'fattoush',
  'festival',
  'dumplings?',
  'dough',
  'pancakes?',
  'churros',
  'sponge',
  'savoiardi',
  'beer',
  'ale',
  'soy sauce',
  'shoyu',
  'hoisin',
  'teriyaki',
  'seitan',
  'gochujang',
]

/** Phrases that contain a flagged word but mean something safe; removed before matching. */
const SAFE_PHRASES: RegExp[] = [
  /\bvegan (?:cheese|ranch|mayo|butter|cream|milk|chicken|patty|burger)\b/gi,
  /\bplant[- ]based(?: [a-z]+)?\b/gi,
  /\bplant patty\b/gi,
  /\b(?:coconut|oat|soya?|almond|cashew) (?:milk|cream|yoghurt|yogurt)\b/gi,
  /\b(?:peanut|cocoa|shea|butter) (?:butter|bean|beans)\b/gi,
  /\bbutter ?(?:bean|beans|nut)\b/gi,
  /\bcream of tartar\b/gi,
  /\b(?:rice|glass|mung bean) (?:noodles?|vermicelli|paper)\b/gi,
  /\bvermicelli\b/gi,
  /\bcorn tortillas?\b/gi,
  /\bbuckwheat\b/gi, // the grain itself is gluten-free; wheat-based soba is caught by "soba"
  /\bgluten[- ]free (?:bread|pasta|noodles|flour|batter)\b/gi,
]

export type DietFlag = 'vegan' | 'vegetarian' | 'pescatarianSafe' | 'noPork' | 'glutenFree'

interface Rule {
  /** True when the dish claims this flag (from its effective dietary facts). */
  claims: (f: DietaryFacts) => boolean
  flag: DietFlag
  label: string
  /** Words that contradict the claim. */
  contradicts: string[]
}

const RULES: Rule[] = [
  { flag: 'vegan', label: 'vegan', claims: (f) => f.vegan, contradicts: [...MEAT, ...FISH, ...DAIRY_EGG_HONEY] },
  { flag: 'vegetarian', label: 'vegetarian', claims: (f) => f.vegetarian, contradicts: [...MEAT, ...FISH] },
  { flag: 'pescatarianSafe', label: 'pescatarian', claims: (f) => f.pescatarianSafe, contradicts: MEAT },
  { flag: 'noPork', label: 'pork-free', claims: (f) => !f.containsPork, contradicts: PORK },
  { flag: 'glutenFree', label: 'gluten-free', claims: (f) => f.glutenFree, contradicts: GLUTEN },
]

// Longest terms first, so "fish sauce" is reported as such and not as "fish".
const matcher = (terms: string[]) =>
  new RegExp(`(?<![\\p{L}])(?:${[...terms].sort((x, y) => y.length - x.length).join('|')})(?![\\p{L}])`, 'giu')
const MATCHERS = new Map(RULES.map((r) => [r.flag, matcher(r.contradicts)]))

/** Contradicting words found in `text` for a rule, after safe phrases are removed. */
function found(rule: Rule, text: string): string[] {
  let t = text
  for (const safe of SAFE_PHRASES) t = t.replace(safe, ' ')
  return [...new Set([...t.matchAll(MATCHERS.get(rule.flag)!)].map((m) => m[0].toLowerCase()))]
}

export interface DishText {
  archetypeName: string
  keyIngredients: readonly string[]
  offeringName: string
  offeringDescription: string
}

/** One message per contradiction, e.g. `claims gluten-free but its name/description mentions "sourdough"`. */
export function contentIssues(f: DietaryFacts, dish: DishText): string[] {
  const sources: [string, string][] = [
    ['name', dish.offeringName],
    ['description', dish.offeringDescription],
    ['archetype', dish.archetypeName],
    ['ingredients', dish.keyIngredients.join(', ')],
  ]
  const issues: string[] = []
  for (const rule of RULES) {
    if (!rule.claims(f)) continue
    for (const [where, text] of sources) {
      const hits = found(rule, text)
      if (hits.length > 0)
        issues.push(`is ${rule.label} but its ${where} mentions ${hits.map((h) => `"${h}"`).join(', ')}`)
    }
  }
  return issues
}

/** Declared allergens that contradict a flag (an allergen the venue lists is present in the dish). */
export function allergenIssues(f: DietaryFacts, allergens: readonly string[]): string[] {
  const has = (...a: string[]) => a.filter((x) => allergens.includes(x))
  const issues: string[] = []
  const say = (label: string, hit: string[]) =>
    hit.length > 0 && issues.push(`is ${label} but declares allergen ${hit.join(', ')}`)
  if (f.glutenFree) say('gluten-free', has('cereals_gluten'))
  if (f.vegan) say('vegan', has('milk', 'eggs', 'fish', 'crustaceans', 'molluscs'))
  if (f.vegetarian) say('vegetarian', has('fish', 'crustaceans', 'molluscs'))
  return issues
}
