// Analytics events (MVP_SPEC §21). Pure types plus the sink interface; no DOM, no network.
// M1 uses a local sink only; a remote provider can implement EventSink later.

export type EventName =
  | 'app_opened'
  | 'mode_selected'
  | 'craving_submitted'
  | 'card_shown'
  | 'swipe'
  | 'undo'
  | 'decide_for_me'
  | 'pivot_triggered'
  | 'match_shown'
  | 'match_action'
  | 'handoff_opened'
  | 'session_abandoned'
  | 'session_discarded'

export type EventProps = Record<string, string | number | boolean | null>

export interface AnalyticsEvent {
  name: EventName
  props: EventProps
  /** Milliseconds since epoch. */
  ts: number
  sessionId: string | null
  engineVersion: string
  catalogueVersion: string
}

export interface EventSink {
  emit(event: AnalyticsEvent): void
}
