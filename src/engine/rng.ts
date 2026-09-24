// The engine's only source of randomness (MVP_SPEC §8.7). Seeded, so sessions replay exactly.

/** mulberry32: a small, fast, well-distributed 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable hash of a string, for deriving per-card jitter from (seed, id) without shared state. */
export function hashString(s: string, seed = 0): number {
  let h = (0x811c9dc5 ^ seed) >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** Deterministic value in [0, 1) for a (seed, key) pair. Order-independent, unlike a stream. */
export function seededUnit(seed: number, key: string): number {
  return mulberry32(hashString(key, seed))()
}
