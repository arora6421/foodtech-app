import { describe, expect, it } from 'vitest'
import { DishArchetypeSchema, OfferingSchema } from './schemas'

const archetype = {
  id: 'korean-fried-chicken',
  name: 'Korean fried chicken',
  cuisine: 'korean',
  format: 'protein_plate',
  proteins: ['chicken'],
  flavours: ['sweet', 'garlicky'],
  textures: ['crispy', 'saucy'],
  moods: ['comforting', 'indulgent'],
  mealType: 'main',
  temperature: 'hot',
  axes: { spice: 3, richness: 3, adventurousness: 1 },
  keyIngredients: ['chicken', 'gochujang', 'garlic'],
  dietary: { vegetarian: false, vegan: false, pescatarianSafe: false, containsPork: false, glutenFree: false },
  image: { kind: 'generated', src: 'kfc.avif', alt: 'Glossy fried chicken', dominantColour: '#8a3b1f' },
}

describe('DishArchetypeSchema', () => {
  it('accepts a valid archetype', () => {
    expect(DishArchetypeSchema.safeParse(archetype).success).toBe(true)
  })
  it('rejects values outside the taxonomy', () => {
    expect(DishArchetypeSchema.safeParse({ ...archetype, cuisine: 'martian' }).success).toBe(false)
    expect(DishArchetypeSchema.safeParse({ ...archetype, moods: ['spicy'] }).success).toBe(false)
    expect(DishArchetypeSchema.safeParse({ ...archetype, axes: { ...archetype.axes, spice: 5 } }).success).toBe(false)
  })
  it('rejects inconsistent dietary facts', () => {
    const bad = { ...archetype, dietary: { ...archetype.dietary, vegetarian: true, pescatarianSafe: true } }
    expect(DishArchetypeSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects missing alt text and duplicate tags', () => {
    expect(DishArchetypeSchema.safeParse({ ...archetype, image: { ...archetype.image, alt: '' } }).success).toBe(false)
    expect(DishArchetypeSchema.safeParse({ ...archetype, textures: ['crispy', 'crispy'] }).success).toBe(false)
  })
})

describe('OfferingSchema', () => {
  const offering = {
    id: 'hanok-house-seoul-fire-wings',
    venueId: 'hanok-house',
    archetypeId: 'korean-fried-chicken',
    name: 'Seoul Fire Wings',
    description: 'Double-fried wings in gochujang glaze.',
    pricePence: 1395,
  }
  it('accepts a valid offering and rejects out-of-range prices', () => {
    expect(OfferingSchema.safeParse(offering).success).toBe(true)
    expect(OfferingSchema.safeParse({ ...offering, pricePence: 13.95 }).success).toBe(false)
    expect(OfferingSchema.safeParse({ ...offering, pricePence: 9000 }).success).toBe(false)
  })
})
