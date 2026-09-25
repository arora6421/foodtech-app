// Safe browser storage (MVP_SPEC §18, m1-spec §3.3). Every access is wrapped: in private mode,
// with blocked site data or in tests, reads return null and writes are no-ops. Nothing throws.

export type StorageArea = 'local' | 'session'

function area(which: StorageArea): Storage | null {
  try {
    const s = which === 'local' ? globalThis.localStorage : globalThis.sessionStorage
    return s ?? null
  } catch {
    return null
  }
}

export function readJSON<T>(which: StorageArea, key: string, isValid: (x: unknown) => x is T): T | null {
  try {
    const raw = area(which)?.getItem(key)
    if (raw == null) return null
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeJSON(which: StorageArea, key: string, value: unknown): boolean {
  try {
    const s = area(which)
    if (!s) return false
    s.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(which: StorageArea, key: string): void {
  try {
    area(which)?.removeItem(key)
  } catch {
    // Storage unavailable: nothing to remove.
  }
}

export const STORAGE_KEYS = {
  settings: 'fde.settings.v1',
  saved: 'fde.saved.v1',
  session: 'fde.session.v1',
  events: 'fde.events.v1',
} as const
