// The closed vocabularies (MVP_SPEC §6). This file is the contract between data and engine:
// every value a dish can carry is listed here, and changing any list bumps TAXONOMY_VERSION.

export const CUISINE_FAMILIES = [
  'east_asian',
  'southeast_asian',
  'south_asian',
  'middle_eastern',
  'mediterranean',
  'british',
  'north_american',
  'latin_american',
  'african_caribbean',
] as const
export type CuisineFamily = (typeof CUISINE_FAMILIES)[number]

export const CUISINE_FAMILY = {
  japanese: 'east_asian',
  korean: 'east_asian',
  chinese: 'east_asian',
  thai: 'southeast_asian',
  vietnamese: 'southeast_asian',
  indian: 'south_asian',
  lebanese: 'middle_eastern',
  turkish: 'middle_eastern',
  italian: 'mediterranean',
  greek: 'mediterranean',
  spanish: 'mediterranean',
  british: 'british',
  american: 'north_american',
  mexican: 'latin_american',
  caribbean: 'african_caribbean',
  west_african: 'african_caribbean',
} as const satisfies Record<string, CuisineFamily>
export type Cuisine = keyof typeof CUISINE_FAMILY
export const CUISINES = Object.keys(CUISINE_FAMILY) as Cuisine[]

export const FORMATS = [
  'noodles',
  'rice',
  'curry_stew',
  'soup',
  'burger',
  'sandwich_wrap',
  'pizza_flatbread',
  'pasta',
  'tacos_burrito',
  'salad_bowl',
  'dumplings_buns',
  'protein_plate',
  'small_plates',
  'pie_bake',
  'breakfast',
  'dessert',
] as const
export type Format = (typeof FORMATS)[number]

export const PROTEINS = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'fish',
  'shellfish',
  'tofu_tempeh',
  'egg',
  'legumes',
  'cheese_dairy',
] as const
export type Protein = (typeof PROTEINS)[number]
export const MEAT_PROTEINS: readonly Protein[] = ['chicken', 'beef', 'pork', 'lamb']
export const SEAFOOD_PROTEINS: readonly Protein[] = ['fish', 'shellfish']
export const ANIMAL_PRODUCT_PROTEINS: readonly Protein[] = [...MEAT_PROTEINS, ...SEAFOOD_PROTEINS, 'egg', 'cheese_dairy']

export const FLAVOURS = ['umami', 'tangy', 'sweet', 'smoky', 'herby', 'garlicky', 'cheesy', 'aromatic'] as const
export type Flavour = (typeof FLAVOURS)[number]

export const TEXTURES = ['crispy', 'crunchy', 'saucy', 'creamy', 'brothy', 'chewy'] as const
export type Texture = (typeof TEXTURES)[number]

/** Curated per archetype. 'spicy' is deliberately absent: it is derived from the spice axis. */
export const MOOD_TAGS = ['comforting', 'fresh', 'carby', 'indulgent', 'warm_soupy', 'sweet'] as const
export type MoodTag = (typeof MOOD_TAGS)[number]

/** What the user can pick on the craving screen. */
export const MOODS = ['spicy', ...MOOD_TAGS] as const
export type Mood = (typeof MOODS)[number]

export const INTENTS = ['normal', 'something_new', 'no_idea'] as const
export type Intent = (typeof INTENTS)[number]

export const MEAL_TYPES = ['main', 'light', 'breakfast', 'dessert'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const TEMPERATURES = ['hot', 'cold'] as const
export type Temperature = (typeof TEMPERATURES)[number]

export const AXES = ['spice', 'richness', 'adventurousness'] as const
export type Axis = (typeof AXES)[number]

export const LEVELS = [0, 1, 2, 3, 4] as const
export type Level = (typeof LEVELS)[number]

export const DIET_CONSTRAINTS = ['vegetarian', 'vegan', 'pescatarian', 'no_pork', 'gluten_free'] as const
export type DietConstraint = (typeof DIET_CONSTRAINTS)[number]

/** The UK's 14 regulated allergens. Display only; never used to claim safety. */
export const ALLERGENS = [
  'celery',
  'cereals_gluten',
  'crustaceans',
  'eggs',
  'fish',
  'lupin',
  'milk',
  'molluscs',
  'mustard',
  'tree_nuts',
  'peanuts',
  'sesame',
  'soya',
  'sulphites',
] as const
export type Allergen = (typeof ALLERGENS)[number]

export const FULFILMENTS = ['delivery', 'go_out', 'either'] as const
export type Fulfilment = (typeof FULFILMENTS)[number]

export const BUDGETS = ['any', 'low', 'mid', 'high'] as const
export type Budget = (typeof BUDGETS)[number]
