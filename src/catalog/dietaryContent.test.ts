import { describe, expect, it } from 'vitest'
import type { Catalogue, DietaryFacts } from '../domain'
import { ANGEL_N1 } from '../location/LocationProvider'
import { allergenIssues, contentIssues } from './dietaryContent'
import { MOCK_CATALOGUE } from './mock/MockCatalog'
import { validateCatalogue } from './validateCatalogue'

// The dietary flags are checked against what each dish is SAID to contain, not just its proteins.

const F = (over: Partial<DietaryFacts>): DietaryFacts => ({
  vegan: false,
  vegetarian: false,
  pescatarianSafe: false,
  containsPork: false,
  glutenFree: false,
  ...over,
})
const VEGAN = F({ vegan: true, vegetarian: true, pescatarianSafe: true })
const VEGETARIAN = F({ vegetarian: true, pescatarianSafe: true })
const PESCATARIAN = F({ pescatarianSafe: true })
const NO_PORK = F({ containsPork: false }) // "not containing pork" is the claim
const GLUTEN_FREE = F({ glutenFree: true, containsPork: true }) // pork allowed here so only the gluten rule speaks
const dish = (over: { name?: string; description?: string; ingredients?: string[]; archetype?: string }) => ({
  offeringName: over.name ?? 'Plain dish',
  offeringDescription: over.description ?? 'Nothing to see.',
  archetypeName: over.archetype ?? 'Plain',
  keyIngredients: over.ingredients ?? ['rice'],
})

const SIX_FIXED = [
  'cedar-and-sumac-shawarma-bowl',
  'zaatar-yard-chicken-fattoush-bowl',
  'morning-ground-cafe-turkish-eggs-on-sourdough',
  'scotch-bonnet-kitchen-jerk-chicken-rice-and-peas',
  'island-morning-ackee-and-saltfish',
  'kumasi-corner-puff-puff-and-chilli-honey',
]

describe('the real catalogue', () => {
  it('has no contradictions between flags and content', () => {
    expect(validateCatalogue(MOCK_CATALOGUE, ANGEL_N1).errors).toEqual([])
  })

  it('would have caught all six mislabelled dishes (the fixes removed), and nothing else', () => {
    const before: Catalogue = {
      ...MOCK_CATALOGUE,
      offerings: MOCK_CATALOGUE.offerings.map((o) => {
        if (!SIX_FIXED.includes(o.id)) return o
        const { overrides: _dropped, ...rest } = o
        return rest
      }),
    }
    const errors = validateCatalogue(before, ANGEL_N1).errors
    const flagged = new Set(errors.map((e) => /offering ([a-z0-9-]+):/.exec(e)![1]))
    expect(flagged).toEqual(new Set(SIX_FIXED))
    const about = (id: string) => errors.filter((e) => e.includes(id)).join()
    expect(about('kumasi-corner-puff-puff-and-chilli-honey')).toContain('"honey"')
    expect(about('zaatar-yard-chicken-fattoush-bowl')).toContain('"fattoush"')
    expect(about('morning-ground-cafe-turkish-eggs-on-sourdough')).toContain('"sourdough"')
    expect(about('scotch-bonnet-kitchen-jerk-chicken-rice-and-peas')).toContain('"festival"')
    expect(about('island-morning-ackee-and-saltfish')).toContain('"dumplings"')
  })

  it('the six fixes are offering-level overrides that only make the dish stricter', () => {
    for (const id of SIX_FIXED) {
      const o = MOCK_CATALOGUE.offerings.find((x) => x.id === id)!
      const a = MOCK_CATALOGUE.archetypes.find((x) => x.id === o.archetypeId)!
      const d = o.overrides!.dietary!
      for (const [k, v] of Object.entries(d))
        expect([k, a.dietary[k as keyof DietaryFacts], v]).toEqual([k, true, false])
    }
  })
})

describe('each contradiction type is caught', () => {
  it.each([
    ['honey', { name: 'Puff-Puff & Chilli Honey' }],
    ['milk', { description: 'Made with whole milk.' }],
    ['butter', { ingredients: ['rice', 'butter'] }],
    ['cream', { description: 'Finished with double cream.' }],
    ['cheese', { name: 'Cheese toastie' }],
    ['eggs', { description: 'Two fried eggs.' }],
    ['aioli', { description: 'Garlic aioli.' }],
    ['chicken', { ingredients: ['chicken thigh'] }],
    ['prawns', { description: 'Tiger prawns.' }],
  ])('vegan: %s', (word, over) => {
    expect(contentIssues(VEGAN, dish(over)).join()).toContain(`"${word}"`)
  })

  it.each([
    ['chicken', { description: 'Slow-cooked in chicken stock.' }],
    ['fish sauce', { ingredients: ['rice', 'fish sauce'] }],
    ['anchovy', { description: 'Anchovy croutons.' }],
    ['bacon', { name: 'Bacon roll' }],
    ['gelatine', { ingredients: ['gelatine'] }],
  ])('vegetarian: %s', (word, over) => {
    expect(contentIssues(VEGETARIAN, dish(over)).join()).toContain(`"${word}"`)
  })

  it.each([
    ['bacon', { description: 'Streaky bacon.' }],
    ['beef', { ingredients: ['beef mince'] }],
    ['chicken', { name: 'Chicken shawarma' }],
  ])('pescatarian: %s', (word, over) => {
    expect(contentIssues(PESCATARIAN, dish(over)).join()).toContain(`"${word}"`)
  })

  it.each([
    ['chorizo', { description: 'Spicy chorizo.' }],
    ['ham', { ingredients: ['ham hock'] }],
    ['lard', { description: 'Fried in lard.' }],
    ['char siu', { name: 'Char siu rice' }],
    ['bacon', { description: 'Bacon jam.' }],
  ])('no pork: %s', (word, over) => {
    expect(contentIssues(NO_PORK, dish(over)).join()).toContain(`"${word}"`)
  })

  it.each([
    ['bread', { description: 'With bread on the side.' }],
    ['pitta', { ingredients: ['warm pitta'] }],
    ['pita', { description: 'Pita chips.' }],
    ['fattoush', { description: 'Chicken over fattoush.' }],
    ['dumplings', { description: 'Fried dumplings.' }],
    ['flour', { ingredients: ['flour tortilla'] }],
    ['sourdough', { name: 'Eggs on Sourdough' }],
    ['festival', { description: 'Festival on the side.' }],
    ['soy sauce', { description: 'Glazed in soy sauce.' }],
    ['pasta', { ingredients: ['fresh pasta'] }],
    ['battered', { description: 'Battered cod.' }],
    ['noodles', { ingredients: ['wheat noodles'] }],
  ])('gluten-free: %s', (word, over) => {
    expect(contentIssues(GLUTEN_FREE, dish(over)).join()).toContain(`"${word}"`)
  })

  it.each([
    ['gluten-free', GLUTEN_FREE, ['cereals_gluten'], 'cereals_gluten'],
    ['vegan', VEGAN, ['milk'], 'milk'],
    ['vegan', VEGAN, ['eggs'], 'eggs'],
    ['vegetarian', VEGETARIAN, ['fish'], 'fish'],
    ['vegetarian', VEGETARIAN, ['crustaceans'], 'crustaceans'],
  ])('a declared allergen contradicts the flag: %s with %j', (_flag, facts, allergens, word) => {
    expect(allergenIssues(facts, allergens).join()).toContain(word)
  })

  it('names where the text was found', () => {
    expect(contentIssues(VEGAN, dish({ name: 'Honey glaze' }))[0]).toContain('its name')
    expect(contentIssues(VEGAN, dish({ description: 'Honey glaze.' }))[0]).toContain('its description')
    expect(contentIssues(VEGAN, dish({ ingredients: ['honey'] }))[0]).toContain('its ingredients')
  })
})

describe('what must NOT be flagged', () => {
  it.each([
    ['vegan: coconut cream', VEGAN, { description: 'Coconut cream and mango.' }],
    ['vegan: vegan cheese and ranch', VEGAN, { ingredients: ['vegan cheese', 'vegan ranch'] }],
    ['vegan: plant-based patty', VEGAN, { ingredients: ['plant-based chicken'] }],
    ['vegan: peanut butter', VEGAN, { description: 'Peanut butter sauce.' }],
    ['vegetarian: butter beans', VEGETARIAN, { description: 'Butter beans.' }],
    ['gluten-free: rice noodles', GLUTEN_FREE, { ingredients: ['rice noodles', 'rice vermicelli'] }],
    ['gluten-free: corn tortillas', GLUTEN_FREE, { ingredients: ['corn tortillas'] }],
    ['gluten-free: glutinous rice', GLUTEN_FREE, { description: 'Glutinous rice.' }],
    ['gluten-free: toasted rice', GLUTEN_FREE, { description: 'Toasted rice powder.' }],
    ['a word inside another word', VEGAN, { description: 'Kale, champagne vinegar, shamrock green.' }],
  ])('%s', (_name, facts, over) => {
    expect(contentIssues(facts, dish(over))).toEqual([])
  })

  it('a flag the dish does not claim is not checked (chicken in a meat dish is fine)', () => {
    expect(
      contentIssues(F({ containsPork: true }), dish({ description: 'Chicken with bacon, butter and flour.' })),
    ).toEqual([])
  })
})

describe('validateCatalogue reports content contradictions with the offering id', () => {
  const withEdit = (edit: (c: Catalogue) => void) => {
    const c = structuredClone(MOCK_CATALOGUE)
    edit(c)
    return validateCatalogue(c, ANGEL_N1).errors
  }
  const offering = (c: Catalogue, id: string) => c.offerings.find((o) => o.id === id)!

  it('an offering description', () => {
    const errors = withEdit((c) => {
      offering(c, 'ona-kitchen-puff-puff').description = 'Six pieces with honey.'
    })
    expect(errors).toEqual([
      expect.stringMatching(/^offering ona-kitchen-puff-puff: is vegan but its description mentions "honey"/),
    ])
  })

  it('an archetype ingredient, reported for every offering of that archetype', () => {
    const errors = withEdit((c) => {
      c.archetypes.find((a) => a.id === 'chana-masala')!.keyIngredients.push('ghee')
    })
    expect(errors).toHaveLength(MOCK_CATALOGUE.offerings.filter((o) => o.archetypeId === 'chana-masala').length)
    expect(errors.every((e) => e.includes('"ghee"'))).toBe(true)
  })

  it('a dish that claims gluten-free is caught, and an offering override that corrects it silences the error', () => {
    const claimed = withEdit((c) => {
      offering(c, 'nonna-tinas-porcini-risotto').description = 'Served with sourdough.'
    })
    expect(claimed).toEqual([expect.stringContaining('gluten-free but its description mentions "sourdough"')])
    const fixed = withEdit((c) => {
      const o = offering(c, 'nonna-tinas-porcini-risotto')
      o.description = 'Served with sourdough.'
      o.overrides = { dietary: { glutenFree: false } }
    })
    expect(fixed).toEqual([])
  })

  it('a dish that never claimed gluten-free may mention bread', () => {
    const errors = withEdit((c) => {
      offering(c, 'forno-rosso-margherita').description = 'On sourdough, with flour dusting.'
    })
    expect(errors).toEqual([])
  })
})
