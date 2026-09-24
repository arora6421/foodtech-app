import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MOCK_CATALOGUE } from '../../catalog/mock/MockCatalog'
import { ANGEL_N1 } from '../../location/LocationProvider'
import { createSoloSession, soloReducer } from '../../engine/session/solo'
import { DebugPanel, SessionView } from './DebugPanel'

const noop = () => {}

describe('debug panel (MVP_SPEC §4 D1)', () => {
  it('renders the setup form', () => {
    expect(renderToString(<DebugPanel />)).toContain('Start session')
  })

  it('renders a live card and a finished session with its explanation', () => {
    let s = createSoloSession({
      catalogue: MOCK_CATALOGUE,
      seed: 1,
      craving: { moods: ['spicy'], intent: 'normal' },
      context: { origin: ANGEL_N1, now: new Date('2026-09-24T19:30:00Z'), fulfilment: 'either', budget: 'any', diet: [] },
    })
    expect(renderToString(<SessionView state={s} send={noop} onUndo={noop} />)).toContain('NOPE')
    while (!s.result) {
      const a = s.model.pool.archetypes.get(s.current!.archetypeId)!
      s = soloReducer(s, { type: 'swipe', verdict: a.axes.spice >= 2 ? 'yes' : 'no' })
    }
    const html = renderToString(<SessionView state={s} send={noop} onUndo={noop} />)
    expect(html).toContain(s.result.confidenceLabel)
    expect(html).toContain('Not quite')
  })
})
