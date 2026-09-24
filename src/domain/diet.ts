import { ANIMAL_PRODUCT_PROTEINS, MEAT_PROTEINS, SEAFOOD_PROTEINS } from './taxonomy'
import type { DietConstraint, Protein } from './taxonomy'

// Diet is a hard constraint, never a preference (MVP_SPEC §1.7, §8.2).
// Kept structural (not importing ./types) so schemas.ts can use it without a cycle.
interface Facts {
  vegetarian: boolean
  vegan: boolean
  pescatarianSafe: boolean
  containsPork: boolean
  glutenFree: boolean
}

const RULES: Record<DietConstraint, (f: Facts) => boolean> = {
  vegan: (f) => f.vegan,
  vegetarian: (f) => f.vegetarian,
  pescatarian: (f) => f.pescatarianSafe,
  no_pork: (f) => !f.containsPork,
  gluten_free: (f) => f.glutenFree,
}

/** True only if the dish satisfies every selected constraint. */
export function satisfiesDiet(facts: Facts, constraints: readonly DietConstraint[]): boolean {
  return constraints.every((c) => RULES[c](facts))
}

/** An offering's facts: the archetype's, with any explicit overrides applied. */
export function effectiveDietary(base: Facts, overrides?: Partial<Facts>): Facts {
  return { ...base, ...overrides }
}

/** Internal-consistency problems between the dietary flags and the listed proteins. Empty = consistent. */
export function dietaryIssues(f: Facts, proteins: readonly Protein[]): string[] {
  const issues: string[] = []
  const has = (list: readonly Protein[]) => proteins.some((p) => list.includes(p))

  if (f.vegan && !f.vegetarian) issues.push('vegan implies vegetarian')
  if (f.vegetarian && !f.pescatarianSafe) issues.push('vegetarian implies pescatarianSafe')
  if (f.containsPork && f.pescatarianSafe) issues.push('containsPork contradicts pescatarianSafe')
  if (proteins.includes('pork') && !f.containsPork) issues.push('pork protein requires containsPork')
  if (has(MEAT_PROTEINS) && f.pescatarianSafe) issues.push('meat protein contradicts pescatarianSafe')
  if (has(SEAFOOD_PROTEINS) && f.vegetarian) issues.push('seafood protein contradicts vegetarian')
  if (has(ANIMAL_PRODUCT_PROTEINS) && f.vegan) issues.push('animal-product protein contradicts vegan')
  return issues
}
