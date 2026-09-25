import { createStore, useStore } from 'zustand'
import { BUDGETS, DIET_CONSTRAINTS, FULFILMENTS } from '../../domain'
import type { Budget, DietConstraint, Fulfilment } from '../../domain'
import { readJSON, STORAGE_KEYS, writeJSON } from '../services/storage'

// Remembered settings (MVP_SPEC §4 S2): diet, budget, eating context. Persisted locally, versioned.

export interface Settings {
  diet: DietConstraint[]
  budget: Budget
  fulfilment: Fulfilment
}

export interface SettingsState extends Settings {
  setDiet(diet: DietConstraint[]): void
  setBudget(budget: Budget): void
  setFulfilment(fulfilment: Fulfilment): void
}

export const DEFAULT_SETTINGS: Settings = { diet: [], budget: 'any', fulfilment: 'either' }

const isSettings = (x: unknown): x is Settings => {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  return (
    Array.isArray(s.diet) &&
    s.diet.every((d) => (DIET_CONSTRAINTS as readonly unknown[]).includes(d)) &&
    (BUDGETS as readonly unknown[]).includes(s.budget) &&
    (FULFILMENTS as readonly unknown[]).includes(s.fulfilment)
  )
}

export function createSettingsStore() {
  const initial = readJSON('local', STORAGE_KEYS.settings, isSettings) ?? DEFAULT_SETTINGS
  const store = createStore<SettingsState>()((set) => ({
    ...initial,
    setDiet: (diet) => set({ diet: DIET_CONSTRAINTS.filter((d) => diet.includes(d)) }),
    setBudget: (budget) => set({ budget }),
    setFulfilment: (fulfilment) => set({ fulfilment }),
  }))
  store.subscribe((s) =>
    writeJSON('local', STORAGE_KEYS.settings, { diet: s.diet, budget: s.budget, fulfilment: s.fulfilment }),
  )
  return store
}

export const settingsStore = createSettingsStore()
export const useSettings = <T>(selector: (s: SettingsState) => T) => useStore(settingsStore, selector)
