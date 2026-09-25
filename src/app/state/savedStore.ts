import { createStore, useStore } from 'zustand'
import { readJSON, STORAGE_KEYS, writeJSON } from '../services/storage'

// Saved dishes (MVP_SPEC §4 S7), kept on the device. A display snapshot is stored too, so a saved
// dish still shows sensibly if the catalogue changes later.

export interface SavedMatch {
  id: string
  archetypeId: string
  offeringId: string
  archetypeName: string
  offeringName: string
  venueName: string
  priceLabel: string
  tint: string
  savedAt: string
}

export interface SavedState {
  items: SavedMatch[]
  save(item: Omit<SavedMatch, 'id' | 'savedAt'>, now?: Date): void
  remove(id: string): void
  has(archetypeId: string, offeringId: string): boolean
}

const isList = (x: unknown): x is SavedMatch[] =>
  Array.isArray(x) &&
  x.every(
    (i) =>
      i &&
      typeof i === 'object' &&
      typeof (i as SavedMatch).id === 'string' &&
      typeof (i as SavedMatch).archetypeId === 'string',
  )

export const savedId = (archetypeId: string, offeringId: string) => `${archetypeId}::${offeringId}`

export function createSavedStore() {
  const store = createStore<SavedState>()((set, get) => ({
    items: readJSON('local', STORAGE_KEYS.saved, isList) ?? [],
    save: (item, now = new Date()) => {
      const id = savedId(item.archetypeId, item.offeringId)
      if (get().items.some((i) => i.id === id)) return
      set({ items: [{ ...item, id, savedAt: now.toISOString() }, ...get().items] })
    },
    remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
    has: (archetypeId, offeringId) => get().items.some((i) => i.id === savedId(archetypeId, offeringId)),
  }))
  store.subscribe((s) => writeJSON('local', STORAGE_KEYS.saved, s.items))
  return store
}

export const savedStore = createSavedStore()
export const useSaved = <T>(selector: (s: SavedState) => T) => useStore(savedStore, selector)
