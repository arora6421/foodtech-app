import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { dietaryIssues, effectiveDietary, satisfiesDiet } from './diet'
import { DIET_CONSTRAINTS, PROTEINS } from './taxonomy'
import type { DietConstraint, Protein } from './taxonomy'

type Facts = Parameters<typeof satisfiesDiet>[0]
const facts = (over: Partial<Facts> = {}): Facts => ({
  vegetarian: false,
  vegan: false,
  pescatarianSafe: false,
  containsPork: false,
  glutenFree: false,
  ...over,
})

const VEGAN = facts({ vegan: true, vegetarian: true, pescatarianSafe: true })
const VEGETARIAN = facts({ vegetarian: true, pescatarianSafe: true })
const FISH = facts({ pescatarianSafe: true })
const CHICKEN = facts()
const PORK = facts({ containsPork: true })

describe('satisfiesDiet: full matrix', () => {
  const matrix: [string, Facts, DietConstraint, boolean][] = [
    ['vegan', VEGAN, 'vegan', true],
    ['vegan', VEGAN, 'vegetarian', true],
    ['vegan', VEGAN, 'pescatarian', true],
    ['vegan', VEGAN, 'no_pork', true],
    ['vegetarian', VEGETARIAN, 'vegan', false],
    ['vegetarian', VEGETARIAN, 'vegetarian', true],
    ['vegetarian', VEGETARIAN, 'pescatarian', true],
    ['fish', FISH, 'vegetarian', false],
    ['fish', FISH, 'pescatarian', true],
    ['fish', FISH, 'no_pork', true],
    ['chicken', CHICKEN, 'pescatarian', false],
    ['chicken', CHICKEN, 'no_pork', true],
    ['pork', PORK, 'no_pork', false],
    ['pork', PORK, 'pescatarian', false],
  ]
  it.each(matrix)('%s dish vs %s → %s', (_name, dish, constraint, expected) => {
    expect(satisfiesDiet(dish, [constraint])).toBe(expected)
  })

  it('gluten-free depends only on the glutenFree flag', () => {
    expect(satisfiesDiet(facts({ glutenFree: true }), ['gluten_free'])).toBe(true)
    expect(satisfiesDiet(VEGAN, ['gluten_free'])).toBe(false)
  })

  it('no constraints accepts everything', () => {
    expect(satisfiesDiet(PORK, [])).toBe(true)
  })

  it('property: combined constraints are the conjunction of single constraints', () => {
    const arbFacts = fc.record({
      vegetarian: fc.boolean(),
      vegan: fc.boolean(),
      pescatarianSafe: fc.boolean(),
      containsPork: fc.boolean(),
      glutenFree: fc.boolean(),
    })
    fc.assert(
      fc.property(arbFacts, fc.subarray([...DIET_CONSTRAINTS]), (f, cs) => {
        expect(satisfiesDiet(f, cs)).toBe(cs.every((c) => satisfiesDiet(f, [c])))
      }),
    )
  })
})

describe('effectiveDietary', () => {
  it('applies offering overrides over archetype facts', () => {
    expect(effectiveDietary(VEGETARIAN, { vegan: true }).vegan).toBe(true)
    expect(effectiveDietary(VEGETARIAN, undefined)).toEqual(VEGETARIAN)
  })
})

describe('dietaryIssues', () => {
  it('accepts consistent facts', () => {
    expect(dietaryIssues(VEGAN, ['tofu_tempeh', 'legumes'])).toEqual([])
    expect(dietaryIssues(VEGETARIAN, ['egg', 'cheese_dairy'])).toEqual([])
    expect(dietaryIssues(FISH, ['fish'])).toEqual([])
    expect(dietaryIssues(PORK, ['pork'])).toEqual([])
  })

  const inconsistent: [string, Facts, Protein[]][] = [
    ['vegan without vegetarian', facts({ vegan: true, pescatarianSafe: true }), []],
    ['vegetarian without pescatarianSafe', facts({ vegetarian: true }), []],
    ['vegetarian with fish', VEGETARIAN, ['fish']],
    ['vegan with egg', VEGAN, ['egg']],
    ['pescatarianSafe with chicken', FISH, ['chicken']],
    ['pork protein without containsPork', CHICKEN, ['pork']],
    ['containsPork and pescatarianSafe', facts({ containsPork: true, pescatarianSafe: true }), []],
  ]
  it.each(inconsistent)('rejects %s', (_name, f, proteins) => {
    expect(dietaryIssues(f, proteins).length).toBeGreaterThan(0)
  })

  it('property: facts derived from proteins are always consistent', () => {
    fc.assert(
      fc.property(fc.subarray([...PROTEINS]), (proteins) => {
        const meat = proteins.some((p) => ['chicken', 'beef', 'pork', 'lamb'].includes(p))
        const seafood = proteins.some((p) => ['fish', 'shellfish'].includes(p))
        const animal = meat || seafood || proteins.some((p) => ['egg', 'cheese_dairy'].includes(p))
        const f = facts({
          vegetarian: !meat && !seafood,
          vegan: !animal,
          pescatarianSafe: !meat,
          containsPork: proteins.includes('pork'),
        })
        expect(dietaryIssues(f, proteins)).toEqual([])
      }),
    )
  })
})
