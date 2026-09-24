import { CUISINE_FAMILY } from '../../domain'
import type { Axis, DishArchetype, Level, OfferingOverrides } from '../../domain'
import type { EngineConfig, Namespace } from '../config'

// The single path by which dish data reaches the engine (MVP_SPEC §7.1).

export type FeatureId = string
/** Sparse vector: feature id → salience weight. */
export type FeatureVector = ReadonlyMap<FeatureId, number>

const AXIS_NAMESPACE: Record<Axis, Namespace> = { spice: 'spice', richness: 'rich', adventurousness: 'adv' }

export const levelFeature = (axis: Axis, level: number): FeatureId => `${AXIS_NAMESPACE[axis]}:${level}`

export function namespaceOf(id: FeatureId): Namespace {
  return id.slice(0, id.indexOf(':')) as Namespace
}

/** Level-feature helpers: `spice:3` → { ns: 'spice', level: 3 }. */
export function parseLevelFeature(id: FeatureId): { ns: 'spice' | 'rich' | 'adv'; level: number } | undefined {
  const ns = namespaceOf(id)
  if (ns !== 'spice' && ns !== 'rich' && ns !== 'adv') return undefined
  return { ns, level: Number(id.slice(id.indexOf(':') + 1)) }
}

export function effectiveAxes(archetype: DishArchetype, overrides?: OfferingOverrides): Record<Axis, Level> {
  return { ...archetype.axes, ...(overrides?.axes ?? {}) }
}

export function featurize(archetype: DishArchetype, config: EngineConfig, overrides?: OfferingOverrides): FeatureVector {
  const v = new Map<FeatureId, number>()
  const add = (ns: Namespace, values: readonly string[]) => {
    if (values.length === 0) return
    const base = config.salience[ns]
    const w = config.splitNamespaces.includes(ns) ? base / Math.sqrt(values.length) : base
    for (const value of values) v.set(`${ns}:${value}`, w)
  }
  add('cuisine', [archetype.cuisine])
  add('family', [CUISINE_FAMILY[archetype.cuisine]])
  add('format', [archetype.format])
  add('protein', archetype.proteins)
  add('mood', archetype.moods)
  add('texture', archetype.textures)
  add('flavour', archetype.flavours)
  add('temp', [archetype.temperature])
  const axes = effectiveAxes(archetype, overrides)
  v.set(levelFeature('spice', axes.spice), config.salience.spice)
  v.set(levelFeature('richness', axes.richness), config.salience.rich)
  v.set(levelFeature('adventurousness', axes.adventurousness), config.salience.adv)
  return v
}

export function totalSalience(v: FeatureVector): number {
  let s = 0
  for (const w of v.values()) s += w
  return s
}

/** Cosine similarity between two sparse vectors. */
export function cosine(a: FeatureVector, b: FeatureVector): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const [f, w] of a) {
    na += w * w
    const wb = b.get(f)
    if (wb !== undefined) dot += w * wb
  }
  for (const w of b.values()) nb += w * w
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}
