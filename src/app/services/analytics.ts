import { ENGINE_VERSION } from '../../domain'
import type { AnalyticsEvent, EventName, EventProps, EventSink } from '../../analytics/events'
import { MOCK_CATALOGUE_VERSION } from '../../catalog/mock/MockCatalog'
import { readJSON, STORAGE_KEYS, writeJSON } from './storage'

// Local-only analytics (MVP_SPEC §21): an in-memory list plus a localStorage ring buffer of the
// last 500 events, readable from the debug overlay. No remote platform, no personal data.

const RING = 500

class LocalSink implements EventSink {
  readonly events: AnalyticsEvent[] = []

  emit(event: AnalyticsEvent): void {
    this.events.push(event)
    if (this.events.length > RING) this.events.splice(0, this.events.length - RING)
    const stored = readJSON('local', STORAGE_KEYS.events, (x): x is AnalyticsEvent[] => Array.isArray(x)) ?? []
    writeJSON('local', STORAGE_KEYS.events, [...stored, event].slice(-RING))
    if (import.meta.env?.DEV) console.debug('[event]', event.name, event.props)
  }
}

export const localSink = new LocalSink()
let sink: EventSink = localSink
let sessionId: string | null = null

export function setSink(next: EventSink): void {
  sink = next
}

export function setAnalyticsSession(id: string | null): void {
  sessionId = id
}

export function track(name: EventName, props: EventProps = {}): void {
  sink.emit({
    name,
    props,
    ts: Date.now(),
    sessionId,
    engineVersion: ENGINE_VERSION,
    catalogueVersion: MOCK_CATALOGUE_VERSION,
  })
}
