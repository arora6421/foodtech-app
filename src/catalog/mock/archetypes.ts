import type {
  Allergen,
  Cuisine,
  DietaryFacts,
  DishArchetype,
  Flavour,
  Format,
  Level,
  MealType,
  MoodTag,
  Protein,
  Temperature,
  Texture,
} from '../../domain'

// Mock dish archetypes (MVP_SPEC §13), labelled against docs/labelling-rubric.md.

type DietKind = 'vegan' | 'vegetarian' | 'pescatarian' | 'meat' | 'pork'

const DIET: Record<DietKind, Omit<DietaryFacts, 'glutenFree'>> = {
  vegan: { vegan: true, vegetarian: true, pescatarianSafe: true, containsPork: false },
  vegetarian: { vegan: false, vegetarian: true, pescatarianSafe: true, containsPork: false },
  pescatarian: { vegan: false, vegetarian: false, pescatarianSafe: true, containsPork: false },
  meat: { vegan: false, vegetarian: false, pescatarianSafe: false, containsPork: false },
  pork: { vegan: false, vegetarian: false, pescatarianSafe: false, containsPork: true },
}

// Placeholder tones until the generated images exist (M1).
const FORMAT_COLOUR: Record<Format, string> = {
  noodles: '#c8894a',
  rice: '#d9b36c',
  curry_stew: '#b5651d',
  soup: '#c9783c',
  burger: '#8c5a2b',
  sandwich_wrap: '#c9a26b',
  pizza_flatbread: '#c0472b',
  pasta: '#e0b85a',
  tacos_burrito: '#b86b3a',
  salad_bowl: '#6f9a4a',
  dumplings_buns: '#e8d9b8',
  protein_plate: '#9b4a22',
  small_plates: '#b98a4e',
  pie_bake: '#a8692d',
  breakfast: '#d6a44c',
  dessert: '#6b3b24',
}

interface Spec {
  p: Protein[]
  f: Flavour[]
  t: Texture[]
  m: MoodTag[]
  /** [spice, richness, adventurousness] */
  axes: [Level, Level, Level]
  diet: DietKind
  gf?: boolean
  meal?: MealType
  temp?: Temperature
  ing: string[]
  allergens?: Allergen[]
}

function arch(id: string, name: string, cuisine: Cuisine, format: Format, s: Spec): DishArchetype {
  const [spice, richness, adventurousness] = s.axes
  return {
    id,
    name,
    cuisine,
    format,
    proteins: s.p,
    flavours: s.f,
    textures: s.t,
    moods: s.m,
    mealType: s.meal ?? 'main',
    temperature: s.temp ?? 'hot',
    axes: { spice, richness, adventurousness },
    keyIngredients: s.ing,
    dietary: { ...DIET[s.diet], glutenFree: s.gf ?? false },
    ...(s.allergens ? { declaredAllergens: s.allergens } : {}),
    image: {
      kind: 'generated',
      src: `/images/archetypes/${id}.avif`,
      alt: name,
      dominantColour: FORMAT_COLOUR[format],
    },
  }
}

export const ARCHETYPES: DishArchetype[] = [
  // ── Japanese ───────────────────────────────────────────────────────────────
  arch('tonkotsu-ramen', 'Tonkotsu ramen', 'japanese', 'noodles', {
    p: ['pork', 'egg'], f: ['umami', 'garlicky'], t: ['brothy', 'chewy'],
    m: ['comforting', 'warm_soupy', 'carby', 'indulgent'], axes: [0, 4, 1], diet: 'pork',
    ing: ['pork bone broth', 'ramen noodles', 'chashu pork', 'soft egg'],
  }),
  arch('spicy-chicken-ramen', 'Spicy chicken ramen', 'japanese', 'noodles', {
    p: ['chicken', 'egg'], f: ['umami', 'garlicky'], t: ['brothy', 'chewy'],
    m: ['comforting', 'warm_soupy', 'carby'], axes: [3, 2, 1], diet: 'meat',
    ing: ['chicken broth', 'chilli oil', 'ramen noodles', 'chicken thigh'],
  }),
  arch('miso-vegetable-ramen', 'Miso vegetable ramen', 'japanese', 'noodles', {
    p: ['tofu_tempeh'], f: ['umami'], t: ['brothy', 'chewy'],
    m: ['comforting', 'warm_soupy', 'carby'], axes: [1, 2, 1], diet: 'vegan',
    ing: ['miso broth', 'ramen noodles', 'tofu', 'pak choi'],
  }),
  arch('chicken-katsu-curry', 'Chicken katsu curry', 'japanese', 'curry_stew', {
    p: ['chicken'], f: ['sweet', 'umami'], t: ['crispy', 'saucy'],
    m: ['comforting', 'carby', 'indulgent'], axes: [1, 3, 0], diet: 'meat',
    ing: ['panko chicken', 'katsu curry sauce', 'steamed rice'],
  }),
  arch('sushi-platter', 'Sushi platter', 'japanese', 'rice', {
    p: ['fish', 'shellfish'], f: ['umami', 'tangy'], t: ['chewy'],
    m: ['fresh'], axes: [0, 0, 1], diet: 'pescatarian', temp: 'cold',
    ing: ['salmon', 'tuna', 'prawn', 'sushi rice'],
  }),
  arch('chicken-karaage', 'Chicken karaage', 'japanese', 'protein_plate', {
    p: ['chicken'], f: ['garlicky', 'umami'], t: ['crispy'],
    m: ['comforting', 'indulgent'], axes: [0, 3, 1], diet: 'meat',
    ing: ['chicken thigh', 'ginger', 'potato starch', 'Kewpie mayo'],
  }),
  arch('cold-soba', 'Cold soba noodles', 'japanese', 'noodles', {
    p: [], f: ['umami', 'tangy'], t: ['chewy'],
    m: ['fresh'], axes: [0, 0, 2], diet: 'vegan', temp: 'cold',
    ing: ['buckwheat noodles', 'kombu dipping sauce', 'spring onion'],
  }),

  // ── Korean ─────────────────────────────────────────────────────────────────
  arch('korean-fried-chicken', 'Korean fried chicken', 'korean', 'protein_plate', {
    p: ['chicken'], f: ['sweet', 'garlicky'], t: ['crispy', 'saucy'],
    m: ['comforting', 'indulgent'], axes: [3, 3, 1], diet: 'meat',
    ing: ['double-fried chicken', 'gochujang glaze', 'garlic', 'sesame'],
  }),
  arch('bibimbap', 'Bibimbap', 'korean', 'rice', {
    p: ['beef', 'egg'], f: ['umami', 'tangy'], t: ['crunchy', 'chewy'],
    m: ['comforting', 'carby'], axes: [2, 2, 2], diet: 'meat',
    ing: ['rice', 'marinated beef', 'fried egg', 'gochujang', 'namul vegetables'],
  }),
  arch('buldak-noodles', 'Fire chicken noodles', 'korean', 'noodles', {
    p: ['chicken'], f: ['umami', 'sweet'], t: ['chewy', 'saucy'],
    m: ['carby', 'indulgent'], axes: [4, 2, 3], diet: 'meat',
    ing: ['chewy noodles', 'fire sauce', 'shredded chicken', 'cheese'],
  }),
  arch('bulgogi', 'Beef bulgogi', 'korean', 'protein_plate', {
    p: ['beef'], f: ['sweet', 'garlicky', 'umami'], t: ['saucy', 'chewy'],
    m: ['comforting'], axes: [1, 2, 2], diet: 'meat',
    ing: ['marinated beef', 'pear', 'soy', 'garlic', 'rice'],
  }),
  arch('sundubu-jjigae', 'Soft tofu stew (sundubu)', 'korean', 'soup', {
    p: ['tofu_tempeh', 'shellfish'], f: ['umami', 'garlicky'], t: ['brothy', 'creamy'],
    m: ['comforting', 'warm_soupy'], axes: [4, 2, 3], diet: 'pescatarian', gf: true,
    ing: ['silken tofu', 'clams', 'gochugaru broth', 'egg'],
  }),

  // ── Chinese ────────────────────────────────────────────────────────────────
  arch('dan-dan-noodles', 'Dan dan noodles', 'chinese', 'noodles', {
    p: ['pork'], f: ['umami', 'garlicky'], t: ['chewy', 'saucy'],
    m: ['comforting', 'carby'], axes: [3, 3, 2], diet: 'pork',
    ing: ['wheat noodles', 'minced pork', 'chilli oil', 'Sichuan pepper', 'sesame paste'],
  }),
  arch('mapo-tofu', 'Mapo tofu', 'chinese', 'curry_stew', {
    p: ['tofu_tempeh'], f: ['umami', 'garlicky', 'aromatic'], t: ['saucy', 'creamy'],
    m: ['comforting'], axes: [4, 2, 3], diet: 'vegan',
    ing: ['silken tofu', 'doubanjiang', 'Sichuan pepper', 'rice'],
  }),
  arch('sweet-and-sour-chicken', 'Sweet & sour chicken', 'chinese', 'protein_plate', {
    p: ['chicken'], f: ['sweet', 'tangy'], t: ['crispy', 'saucy'],
    m: ['comforting', 'indulgent', 'sweet'], axes: [0, 3, 0], diet: 'meat',
    ing: ['battered chicken', 'pineapple', 'peppers', 'sweet & sour sauce'],
  }),
  arch('char-siu-bao', 'Char siu bao', 'chinese', 'dumplings_buns', {
    p: ['pork'], f: ['sweet', 'umami'], t: ['chewy'],
    m: ['comforting', 'carby'], axes: [0, 2, 2], diet: 'pork', meal: 'light',
    ing: ['steamed bun', 'barbecue pork', 'hoisin'],
  }),
  arch('har-gow', 'Prawn har gow', 'chinese', 'dumplings_buns', {
    p: ['shellfish'], f: ['umami'], t: ['chewy'],
    m: ['fresh'], axes: [0, 1, 2], diet: 'pescatarian', meal: 'light',
    ing: ['prawn', 'translucent wheat-starch wrapper', 'bamboo shoot'],
    allergens: ['crustaceans', 'cereals_gluten'],
  }),
  arch('vegetable-potstickers', 'Vegetable potstickers', 'chinese', 'dumplings_buns', {
    p: [], f: ['garlicky', 'umami'], t: ['crispy', 'chewy'],
    m: ['comforting'], axes: [0, 1, 1], diet: 'vegan', meal: 'light',
    ing: ['cabbage', 'shiitake', 'garlic chives', 'black vinegar dip'],
  }),

  // ── Thai ───────────────────────────────────────────────────────────────────
  arch('pad-thai', 'Pad thai', 'thai', 'noodles', {
    p: ['shellfish', 'egg'], f: ['tangy', 'sweet', 'umami'], t: ['chewy', 'crunchy'],
    m: ['carby', 'comforting'], axes: [1, 2, 1], diet: 'pescatarian', gf: true,
    ing: ['rice noodles', 'prawns', 'tamarind', 'peanuts', 'beansprouts'],
    allergens: ['peanuts', 'crustaceans', 'eggs', 'fish'],
  }),
  arch('thai-green-curry', 'Thai green curry', 'thai', 'curry_stew', {
    p: ['chicken'], f: ['aromatic', 'herby'], t: ['creamy', 'saucy'],
    m: ['comforting'], axes: [3, 3, 1], diet: 'meat', gf: true,
    ing: ['green curry paste', 'coconut milk', 'chicken', 'Thai basil', 'jasmine rice'],
  }),
  arch('som-tam', 'Som tam (papaya salad)', 'thai', 'salad_bowl', {
    p: ['shellfish'], f: ['tangy', 'herby'], t: ['crunchy'],
    m: ['fresh'], axes: [4, 0, 3], diet: 'pescatarian', gf: true, meal: 'light', temp: 'cold',
    ing: ['green papaya', 'bird’s eye chilli', 'lime', 'dried shrimp', 'peanuts'],
  }),
  arch('massaman-curry', 'Massaman curry', 'thai', 'curry_stew', {
    p: ['beef'], f: ['aromatic', 'sweet'], t: ['creamy', 'saucy'],
    m: ['comforting', 'indulgent'], axes: [1, 4, 2], diet: 'meat', gf: true,
    ing: ['slow-cooked beef', 'coconut milk', 'potato', 'peanuts', 'cinnamon'],
    allergens: ['peanuts'],
  }),
  arch('tom-yum', 'Tom yum soup', 'thai', 'soup', {
    p: ['shellfish'], f: ['tangy', 'herby'], t: ['brothy'],
    m: ['warm_soupy', 'fresh'], axes: [3, 0, 2], diet: 'pescatarian', gf: true,
    ing: ['prawns', 'lemongrass', 'galangal', 'lime leaf', 'chilli'],
  }),
  arch('chicken-larb', 'Chicken larb', 'thai', 'salad_bowl', {
    p: ['chicken'], f: ['herby', 'tangy'], t: ['crunchy'],
    m: ['fresh'], axes: [4, 0, 2], diet: 'meat', gf: true, temp: 'cold',
    ing: ['minced chicken', 'mint', 'toasted rice', 'lime', 'chilli'],
  }),
  arch('mango-sticky-rice', 'Mango sticky rice', 'thai', 'dessert', {
    p: [], f: ['sweet'], t: ['chewy', 'creamy'],
    m: ['sweet'], axes: [0, 2, 1], diet: 'vegan', gf: true, meal: 'dessert', temp: 'cold',
    ing: ['glutinous rice', 'ripe mango', 'coconut cream'],
  }),

  // ── Vietnamese ─────────────────────────────────────────────────────────────
  arch('beef-pho', 'Beef pho', 'vietnamese', 'noodles', {
    p: ['beef'], f: ['herby', 'aromatic'], t: ['brothy'],
    m: ['warm_soupy', 'comforting', 'fresh'], axes: [1, 1, 1], diet: 'meat', gf: true,
    ing: ['beef broth', 'rice noodles', 'rare beef', 'Thai basil', 'lime'],
  }),
  arch('tofu-pho', 'Tofu pho', 'vietnamese', 'noodles', {
    p: ['tofu_tempeh'], f: ['herby', 'aromatic'], t: ['brothy'],
    m: ['warm_soupy', 'comforting', 'fresh'], axes: [1, 0, 1], diet: 'vegan', gf: true,
    ing: ['star anise vegetable broth', 'rice noodles', 'tofu', 'herbs'],
  }),
  arch('banh-mi', 'Banh mi', 'vietnamese', 'sandwich_wrap', {
    p: ['pork'], f: ['herby', 'tangy'], t: ['crunchy'],
    m: ['fresh', 'carby'], axes: [2, 1, 1], diet: 'pork', temp: 'cold',
    ing: ['baguette', 'lemongrass pork', 'pickled carrot', 'coriander', 'chilli'],
  }),
  arch('summer-rolls', 'Prawn summer rolls', 'vietnamese', 'small_plates', {
    p: ['shellfish'], f: ['herby', 'sweet'], t: ['chewy', 'crunchy'],
    m: ['fresh'], axes: [0, 0, 1], diet: 'pescatarian', gf: true, meal: 'light', temp: 'cold',
    ing: ['rice paper', 'prawns', 'mint', 'vermicelli', 'peanut dip'],
  }),

  // ── Indian ─────────────────────────────────────────────────────────────────
  arch('butter-chicken', 'Butter chicken', 'indian', 'curry_stew', {
    p: ['chicken'], f: ['aromatic', 'sweet'], t: ['creamy', 'saucy'],
    m: ['comforting', 'indulgent'], axes: [1, 4, 0], diet: 'meat', gf: true,
    ing: ['tandoori chicken', 'tomato', 'butter', 'cream', 'fenugreek'],
  }),
  arch('chicken-tikka-masala', 'Chicken tikka masala', 'indian', 'curry_stew', {
    p: ['chicken'], f: ['aromatic', 'tangy'], t: ['creamy', 'saucy'],
    m: ['comforting', 'indulgent'], axes: [1, 3, 0], diet: 'meat', gf: true,
    ing: ['chicken tikka', 'spiced tomato sauce', 'cream', 'rice'],
  }),
  arch('lamb-vindaloo', 'Lamb vindaloo', 'indian', 'curry_stew', {
    p: ['lamb'], f: ['aromatic', 'tangy'], t: ['saucy'],
    m: ['comforting'], axes: [4, 3, 1], diet: 'meat', gf: true,
    ing: ['lamb', 'Kashmiri chilli', 'vinegar', 'garlic'],
  }),
  arch('chana-masala', 'Chana masala', 'indian', 'curry_stew', {
    p: ['legumes'], f: ['aromatic', 'tangy'], t: ['saucy'],
    m: ['comforting'], axes: [2, 2, 1], diet: 'vegan', gf: true,
    ing: ['chickpeas', 'tomato', 'amchur', 'ginger'],
  }),
  arch('lamb-biryani', 'Lamb biryani', 'indian', 'rice', {
    p: ['lamb'], f: ['aromatic'], t: ['crispy'],
    m: ['comforting', 'carby', 'indulgent'], axes: [2, 3, 1], diet: 'meat', gf: true,
    ing: ['basmati rice', 'lamb', 'saffron', 'crispy onions'],
  }),
  arch('masala-dosa', 'Masala dosa', 'indian', 'pizza_flatbread', {
    p: ['legumes'], f: ['aromatic', 'tangy'], t: ['crispy'],
    m: ['carby'], axes: [2, 1, 3], diet: 'vegan', gf: true,
    ing: ['rice & lentil crêpe', 'spiced potato', 'sambar', 'coconut chutney'],
  }),

  // ── Lebanese ───────────────────────────────────────────────────────────────
  arch('chicken-shawarma-wrap', 'Chicken shawarma wrap', 'lebanese', 'sandwich_wrap', {
    p: ['chicken'], f: ['garlicky', 'aromatic'], t: ['creamy', 'crunchy'],
    m: ['comforting', 'carby'], axes: [1, 2, 0], diet: 'meat',
    ing: ['shawarma chicken', 'toum', 'pickles', 'flatbread'],
  }),
  arch('falafel-wrap', 'Falafel wrap', 'lebanese', 'sandwich_wrap', {
    p: ['legumes'], f: ['herby', 'garlicky'], t: ['crispy', 'creamy'],
    m: ['fresh', 'carby'], axes: [1, 2, 1], diet: 'vegan',
    ing: ['falafel', 'tahini', 'parsley', 'pickled turnip', 'flatbread'],
  }),
  arch('mezze-platter', 'Mezze platter', 'lebanese', 'small_plates', {
    p: ['legumes', 'cheese_dairy'], f: ['herby', 'tangy', 'garlicky'], t: ['creamy', 'crunchy'],
    m: ['fresh'], axes: [0, 2, 1], diet: 'vegetarian', temp: 'cold',
    ing: ['hummus', 'tabbouleh', 'halloumi', 'baba ghanoush', 'pitta'],
    allergens: ['sesame', 'milk', 'cereals_gluten'],
  }),
  arch('chicken-shawarma-bowl', 'Chicken shawarma bowl', 'lebanese', 'salad_bowl', {
    p: ['chicken'], f: ['garlicky', 'tangy'], t: ['crunchy', 'creamy'],
    m: ['fresh'], axes: [1, 1, 0], diet: 'meat', gf: true, temp: 'cold',
    ing: ['shawarma chicken', 'fattoush salad', 'toum', 'pomegranate'],
  }),

  // ── Turkish ────────────────────────────────────────────────────────────────
  arch('doner-kebab', 'Lamb doner kebab', 'turkish', 'sandwich_wrap', {
    p: ['lamb'], f: ['garlicky', 'smoky'], t: ['crispy', 'saucy'],
    m: ['indulgent', 'carby', 'comforting'], axes: [2, 4, 0], diet: 'meat',
    ing: ['lamb doner', 'garlic sauce', 'chilli sauce', 'flatbread'],
  }),
  arch('adana-kebab', 'Adana kebab', 'turkish', 'protein_plate', {
    p: ['lamb'], f: ['smoky', 'aromatic'], t: ['chewy'],
    m: ['comforting'], axes: [3, 2, 1], diet: 'meat', gf: true,
    ing: ['chargrilled minced lamb', 'pul biber', 'sumac onions', 'rice'],
  }),
  arch('turkish-eggs', 'Turkish eggs (çılbır)', 'turkish', 'breakfast', {
    p: ['egg', 'cheese_dairy'], f: ['garlicky', 'tangy'], t: ['creamy'],
    m: ['comforting'], axes: [1, 3, 2], diet: 'vegetarian', gf: true, meal: 'breakfast',
    ing: ['poached eggs', 'garlic yoghurt', 'Aleppo chilli butter'],
  }),
  arch('baklava', 'Baklava', 'turkish', 'dessert', {
    p: [], f: ['sweet'], t: ['crispy', 'chewy'],
    m: ['sweet', 'indulgent'], axes: [0, 4, 1], diet: 'vegetarian', meal: 'dessert', temp: 'cold',
    ing: ['filo', 'pistachio', 'butter', 'syrup'],
    allergens: ['tree_nuts', 'cereals_gluten', 'milk'],
  }),

  // ── Italian ────────────────────────────────────────────────────────────────
  arch('margherita-pizza', 'Margherita pizza', 'italian', 'pizza_flatbread', {
    p: ['cheese_dairy'], f: ['cheesy', 'herby'], t: ['chewy'],
    m: ['comforting', 'carby'], axes: [0, 2, 0], diet: 'vegetarian',
    ing: ['sourdough base', 'San Marzano tomato', 'fior di latte', 'basil'],
  }),
  arch('nduja-pizza', 'Nduja pizza', 'italian', 'pizza_flatbread', {
    p: ['pork', 'cheese_dairy'], f: ['cheesy', 'smoky'], t: ['chewy'],
    m: ['comforting', 'carby', 'indulgent'], axes: [3, 3, 1], diet: 'pork',
    ing: ['sourdough base', 'nduja', 'mozzarella', 'hot honey'],
  }),
  arch('spaghetti-carbonara', 'Spaghetti carbonara', 'italian', 'pasta', {
    p: ['pork', 'egg', 'cheese_dairy'], f: ['cheesy', 'umami'], t: ['creamy'],
    m: ['comforting', 'carby', 'indulgent'], axes: [0, 4, 0], diet: 'pork',
    ing: ['spaghetti', 'guanciale', 'egg yolk', 'pecorino', 'black pepper'],
  }),
  arch('penne-arrabbiata', 'Penne arrabbiata', 'italian', 'pasta', {
    p: [], f: ['garlicky', 'tangy'], t: ['saucy'],
    m: ['comforting', 'carby'], axes: [2, 1, 0], diet: 'vegan',
    ing: ['penne', 'tomato', 'garlic', 'dried chilli'],
  }),
  arch('mushroom-risotto', 'Mushroom risotto', 'italian', 'rice', {
    p: ['cheese_dairy'], f: ['umami', 'cheesy'], t: ['creamy'],
    m: ['comforting', 'indulgent'], axes: [0, 3, 1], diet: 'vegetarian', gf: true,
    ing: ['carnaroli rice', 'porcini', 'parmesan', 'butter'],
  }),
  arch('tiramisu', 'Tiramisu', 'italian', 'dessert', {
    p: ['egg', 'cheese_dairy'], f: ['sweet'], t: ['creamy'],
    m: ['sweet', 'indulgent'], axes: [0, 4, 0], diet: 'vegetarian', meal: 'dessert', temp: 'cold',
    ing: ['mascarpone', 'espresso', 'savoiardi', 'cocoa'],
  }),

  // ── Greek ──────────────────────────────────────────────────────────────────
  arch('chicken-gyros', 'Chicken gyros', 'greek', 'sandwich_wrap', {
    p: ['chicken'], f: ['herby', 'garlicky'], t: ['creamy', 'chewy'],
    m: ['comforting', 'carby'], axes: [0, 2, 0], diet: 'meat',
    ing: ['chicken gyros', 'tzatziki', 'pitta', 'chips'],
  }),
  arch('greek-salad', 'Greek salad', 'greek', 'salad_bowl', {
    p: ['cheese_dairy'], f: ['tangy', 'herby'], t: ['crunchy'],
    m: ['fresh'], axes: [0, 1, 0], diet: 'vegetarian', gf: true, meal: 'light', temp: 'cold',
    ing: ['feta', 'tomato', 'cucumber', 'olives', 'oregano'],
  }),
  arch('moussaka', 'Moussaka', 'greek', 'pie_bake', {
    p: ['lamb', 'cheese_dairy'], f: ['aromatic', 'cheesy'], t: ['creamy'],
    m: ['comforting', 'indulgent'], axes: [0, 4, 1], diet: 'meat',
    ing: ['aubergine', 'spiced lamb', 'béchamel', 'cinnamon'],
  }),

  // ── Spanish ────────────────────────────────────────────────────────────────
  arch('seafood-paella', 'Seafood paella', 'spanish', 'rice', {
    p: ['shellfish'], f: ['smoky', 'aromatic'], t: ['chewy', 'crispy'],
    m: ['comforting'], axes: [0, 2, 1], diet: 'pescatarian', gf: true,
    ing: ['bomba rice', 'saffron', 'prawns', 'mussels', 'socarrat'],
  }),
  arch('patatas-bravas', 'Patatas bravas', 'spanish', 'small_plates', {
    p: [], f: ['smoky', 'garlicky'], t: ['crispy', 'creamy'],
    m: ['carby', 'comforting'], axes: [2, 2, 0], diet: 'vegetarian', gf: true, meal: 'light',
    ing: ['fried potatoes', 'smoked paprika sauce', 'aioli'],
  }),
  arch('churros-chocolate', 'Churros & chocolate', 'spanish', 'dessert', {
    p: [], f: ['sweet'], t: ['crispy', 'creamy'],
    m: ['sweet', 'indulgent'], axes: [0, 4, 0], diet: 'vegetarian', meal: 'dessert',
    ing: ['churros', 'cinnamon sugar', 'hot chocolate'],
  }),

  // ── British ────────────────────────────────────────────────────────────────
  arch('fish-and-chips', 'Fish & chips', 'british', 'protein_plate', {
    p: ['fish'], f: ['umami', 'tangy'], t: ['crispy'],
    m: ['comforting', 'carby', 'indulgent'], axes: [0, 4, 0], diet: 'pescatarian',
    ing: ['battered haddock', 'chips', 'mushy peas', 'tartare sauce'],
  }),
  arch('steak-and-ale-pie', 'Steak & ale pie', 'british', 'pie_bake', {
    p: ['beef'], f: ['umami'], t: ['crispy', 'saucy'],
    m: ['comforting', 'indulgent'], axes: [0, 4, 0], diet: 'meat',
    ing: ['braised beef', 'ale gravy', 'shortcrust pastry', 'mash'],
  }),
  arch('bangers-and-mash', 'Bangers & mash', 'british', 'protein_plate', {
    p: ['pork'], f: ['umami'], t: ['creamy', 'saucy'],
    m: ['comforting', 'carby'], axes: [0, 4, 0], diet: 'pork',
    ing: ['pork sausages', 'buttery mash', 'onion gravy'],
  }),
  arch('full-english', 'Full English breakfast', 'british', 'breakfast', {
    p: ['pork', 'egg'], f: ['smoky', 'umami'], t: ['crispy'],
    m: ['comforting', 'indulgent'], axes: [0, 4, 0], diet: 'pork', meal: 'breakfast',
    ing: ['bacon', 'sausage', 'fried egg', 'beans', 'toast'],
  }),
  arch('sticky-toffee-pudding', 'Sticky toffee pudding', 'british', 'dessert', {
    p: [], f: ['sweet'], t: ['saucy', 'chewy'],
    m: ['sweet', 'comforting', 'indulgent'], axes: [0, 4, 0], diet: 'vegetarian', meal: 'dessert',
    ing: ['date sponge', 'toffee sauce', 'custard'],
  }),
  arch('avocado-eggs-sourdough', 'Smashed avocado & poached eggs', 'british', 'breakfast', {
    p: ['egg'], f: ['herby', 'tangy'], t: ['creamy', 'crunchy'],
    m: ['fresh'], axes: [1, 2, 0], diet: 'vegetarian', meal: 'breakfast',
    ing: ['sourdough toast', 'avocado', 'poached eggs', 'chilli flakes'],
  }),

  // ── American ───────────────────────────────────────────────────────────────
  arch('smash-cheeseburger', 'Smash cheeseburger', 'american', 'burger', {
    p: ['beef', 'cheese_dairy'], f: ['cheesy', 'umami'], t: ['crispy', 'creamy'],
    m: ['indulgent', 'comforting', 'carby'], axes: [0, 4, 0], diet: 'meat',
    ing: ['smashed beef patties', 'American cheese', 'pickles', 'brioche bun'],
  }),
  arch('plant-smash-burger', 'Plant-based smash burger', 'american', 'burger', {
    p: [], f: ['umami'], t: ['crispy', 'creamy'],
    m: ['indulgent', 'comforting', 'carby'], axes: [0, 3, 0], diet: 'vegan',
    ing: ['plant patty', 'vegan cheese', 'burger sauce', 'bun'],
  }),
  arch('nashville-hot-chicken', 'Nashville hot chicken', 'american', 'protein_plate', {
    p: ['chicken'], f: ['smoky'], t: ['crispy'],
    m: ['indulgent', 'comforting'], axes: [4, 4, 1], diet: 'meat',
    ing: ['fried chicken', 'cayenne oil', 'pickles', 'white bread'],
  }),
  arch('mac-and-cheese', 'Mac & cheese', 'american', 'pasta', {
    p: ['cheese_dairy'], f: ['cheesy'], t: ['creamy'],
    m: ['comforting', 'indulgent', 'carby'], axes: [0, 4, 0], diet: 'vegetarian',
    ing: ['macaroni', 'cheddar sauce', 'breadcrumb crust'],
  }),
  arch('buttermilk-pancakes', 'Buttermilk pancakes', 'american', 'breakfast', {
    p: ['egg', 'cheese_dairy'], f: ['sweet'], t: ['creamy'],
    m: ['sweet', 'comforting', 'indulgent', 'carby'], axes: [0, 3, 0], diet: 'vegetarian', meal: 'breakfast',
    ing: ['buttermilk pancakes', 'maple syrup', 'berries', 'whipped butter'],
  }),
  arch('buffalo-cauliflower', 'Buffalo cauliflower bites', 'american', 'small_plates', {
    p: [], f: ['tangy'], t: ['crispy'],
    m: ['indulgent'], axes: [3, 2, 1], diet: 'vegan', meal: 'light',
    ing: ['battered cauliflower', 'buffalo sauce', 'vegan ranch'],
  }),
  arch('tuna-poke-bowl', 'Tuna poke bowl', 'american', 'rice', {
    p: ['fish'], f: ['umami', 'tangy'], t: ['chewy', 'crunchy'],
    m: ['fresh'], axes: [1, 0, 1], diet: 'pescatarian', temp: 'cold',
    ing: ['raw tuna', 'sushi rice', 'edamame', 'shoyu', 'cucumber'],
  }),
  arch('chicken-caesar-salad', 'Chicken Caesar salad', 'american', 'salad_bowl', {
    p: ['chicken', 'cheese_dairy'], f: ['cheesy', 'garlicky'], t: ['crunchy', 'creamy'],
    m: ['fresh'], axes: [0, 2, 0], diet: 'meat', temp: 'cold',
    ing: ['cos lettuce', 'grilled chicken', 'parmesan', 'croutons', 'Caesar dressing'],
  }),

  // ── Mexican ────────────────────────────────────────────────────────────────
  arch('birria-tacos', 'Birria tacos', 'mexican', 'tacos_burrito', {
    p: ['beef'], f: ['aromatic', 'smoky'], t: ['crispy', 'brothy'],
    m: ['comforting', 'indulgent', 'warm_soupy'], axes: [2, 4, 2], diet: 'meat', gf: true,
    ing: ['slow-braised beef', 'corn tortillas', 'consomé for dipping', 'cheese'],
  }),
  arch('fish-tacos', 'Fish tacos', 'mexican', 'tacos_burrito', {
    p: ['fish'], f: ['tangy', 'herby'], t: ['crispy', 'crunchy'],
    m: ['fresh'], axes: [1, 1, 1], diet: 'pescatarian',
    ing: ['battered cod', 'tortillas', 'slaw', 'chipotle crema', 'lime'],
  }),
  arch('chicken-burrito', 'Chicken burrito', 'mexican', 'tacos_burrito', {
    p: ['chicken', 'legumes'], f: ['smoky', 'tangy'], t: ['creamy', 'saucy'],
    m: ['carby', 'comforting'], axes: [2, 3, 0], diet: 'meat',
    ing: ['chipotle chicken', 'rice', 'black beans', 'sour cream', 'flour tortilla'],
  }),
  arch('black-bean-burrito-bowl', 'Black bean burrito bowl', 'mexican', 'salad_bowl', {
    p: ['legumes'], f: ['smoky', 'tangy', 'herby'], t: ['creamy', 'crunchy'],
    m: ['fresh'], axes: [1, 1, 0], diet: 'vegan', gf: true, temp: 'cold',
    ing: ['black beans', 'lime rice', 'pico de gallo', 'guacamole'],
  }),
  arch('sea-bass-ceviche', 'Sea bass ceviche', 'mexican', 'small_plates', {
    p: ['fish'], f: ['tangy', 'herby'], t: ['crunchy'],
    m: ['fresh'], axes: [2, 0, 2], diet: 'pescatarian', gf: true, meal: 'light', temp: 'cold',
    ing: ['sea bass', 'lime', 'red onion', 'jalapeño', 'tostadas'],
  }),

  // ── Caribbean ──────────────────────────────────────────────────────────────
  arch('jerk-chicken', 'Jerk chicken', 'caribbean', 'protein_plate', {
    p: ['chicken'], f: ['smoky', 'aromatic'], t: ['crispy', 'chewy'],
    m: ['comforting'], axes: [3, 2, 2], diet: 'meat', gf: true,
    ing: ['jerk-marinated chicken', 'scotch bonnet', 'allspice', 'rice & peas'],
  }),
  arch('curry-mutton', 'Curry mutton', 'caribbean', 'curry_stew', {
    p: ['lamb'], f: ['aromatic'], t: ['saucy'],
    m: ['comforting'], axes: [3, 3, 3], diet: 'meat', gf: true,
    ing: ['mutton on the bone', 'Caribbean curry', 'potato', 'rice'],
  }),
  arch('ackee-and-saltfish', 'Ackee & saltfish', 'caribbean', 'breakfast', {
    p: ['fish'], f: ['umami', 'herby'], t: ['creamy'],
    m: ['comforting'], axes: [1, 2, 4], diet: 'pescatarian', gf: true, meal: 'breakfast',
    ing: ['ackee', 'salt cod', 'peppers', 'thyme', 'fried dumpling'],
  }),
  arch('ital-stew', 'Ital stew', 'caribbean', 'curry_stew', {
    p: ['legumes'], f: ['aromatic', 'herby'], t: ['creamy', 'brothy'],
    m: ['comforting', 'warm_soupy'], axes: [2, 2, 4], diet: 'vegan', gf: true,
    ing: ['coconut', 'kidney beans', 'pumpkin', 'thyme', 'scotch bonnet'],
  }),

  // ── West African ───────────────────────────────────────────────────────────
  arch('jollof-rice', 'Jollof rice & chicken', 'west_african', 'rice', {
    p: ['chicken'], f: ['smoky', 'aromatic'], t: ['saucy'],
    m: ['comforting', 'carby'], axes: [2, 2, 3], diet: 'meat', gf: true,
    ing: ['smoky tomato rice', 'grilled chicken', 'fried plantain'],
  }),
  arch('beef-suya', 'Beef suya', 'west_african', 'protein_plate', {
    p: ['beef'], f: ['smoky', 'aromatic'], t: ['chewy', 'crispy'],
    m: ['indulgent'], axes: [4, 2, 3], diet: 'meat', gf: true,
    ing: ['beef skewers', 'yaji peanut spice', 'raw onion', 'tomato'],
    allergens: ['peanuts'],
  }),
  arch('egusi-soup', 'Egusi soup & pounded yam', 'west_african', 'soup', {
    p: ['fish'], f: ['umami', 'smoky'], t: ['saucy', 'chewy'],
    m: ['comforting', 'warm_soupy'], axes: [3, 3, 4], diet: 'pescatarian', gf: true,
    ing: ['ground melon seed', 'spinach', 'smoked fish', 'pounded yam'],
  }),
  arch('chicken-pepper-soup', 'Chicken pepper soup', 'west_african', 'soup', {
    p: ['chicken'], f: ['aromatic', 'herby'], t: ['brothy'],
    m: ['warm_soupy', 'comforting'], axes: [4, 1, 4], diet: 'meat', gf: true,
    ing: ['chicken', 'pepper soup spice', 'scent leaf', 'scotch bonnet'],
  }),
  arch('puff-puff', 'Puff-puff', 'west_african', 'dessert', {
    p: [], f: ['sweet'], t: ['chewy'],
    m: ['sweet', 'indulgent'], axes: [0, 3, 3], diet: 'vegan', meal: 'dessert',
    ing: ['fried dough', 'nutmeg', 'sugar'],
  }),
  arch('red-red', 'Red-red & plantain', 'west_african', 'curry_stew', {
    p: ['legumes'], f: ['sweet', 'smoky'], t: ['saucy', 'crispy'],
    m: ['comforting'], axes: [2, 2, 4], diet: 'vegan', gf: true,
    ing: ['black-eyed beans', 'red palm oil', 'tomato', 'fried plantain'],
  }),
]

/**
 * Sets of archetypes that differ in (mostly) one dimension, so the engine and the personas
 * can tell features apart (MVP_SPEC §13.2).
 */
export const MINIMAL_PAIRS: { dimension: string; ids: string[] }[] = [
  { dimension: 'protein & richness within ramen', ids: ['tonkotsu-ramen', 'spicy-chicken-ramen', 'miso-vegetable-ramen'] },
  { dimension: 'cuisine within crispy chicken', ids: ['korean-fried-chicken', 'nashville-hot-chicken', 'chicken-karaage'] },
  { dimension: 'cuisine within chicken curry', ids: ['chicken-katsu-curry', 'chicken-tikka-masala', 'thai-green-curry'] },
  { dimension: 'spice within pizza', ids: ['margherita-pizza', 'nduja-pizza'] },
  { dimension: 'format & cuisine within chicken salad', ids: ['chicken-caesar-salad', 'chicken-shawarma-bowl'] },
  { dimension: 'protein within pho', ids: ['beef-pho', 'tofu-pho'] },
  { dimension: 'protein within wrap', ids: ['chicken-shawarma-wrap', 'falafel-wrap'] },
  { dimension: 'protein within burger', ids: ['smash-cheeseburger', 'plant-smash-burger'] },
  { dimension: 'filling within dumplings', ids: ['har-gow', 'vegetable-potstickers', 'char-siu-bao'] },
  { dimension: 'richness within creamy curry', ids: ['butter-chicken', 'chicken-tikka-masala'] },
  { dimension: 'protein & richness within tacos', ids: ['birria-tacos', 'fish-tacos'] },
  { dimension: 'spice within noodles', ids: ['pad-thai', 'dan-dan-noodles', 'buldak-noodles'] },
  { dimension: 'format within shawarma', ids: ['chicken-shawarma-wrap', 'chicken-shawarma-bowl'] },
  { dimension: 'cuisine within vegan stew', ids: ['chana-masala', 'red-red', 'ital-stew'] },
]
