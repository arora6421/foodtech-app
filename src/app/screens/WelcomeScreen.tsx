import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import { copy, PRODUCT_NAME } from '../copy/en-GB'
import { Icon } from '../components/primitives/Icon'
import { MOTION } from '../design/motion'
import { useSolo } from '../state/soloSessionStore'

// S1 Welcome (MVP_SPEC §4). The fanned dishes are decorative (no-photo placeholder: colour + name).
const FAN = [
  { tint: '#c8894a', cuisine: 'Japanese', name: 'Tonkotsu ramen' },
  { tint: '#4f7a34', cuisine: 'Thai', name: 'Chicken larb' },
  { tint: '#9b4a22', cuisine: 'Korean', name: 'Seoul Fire Wings' },
]
// Each dish is dealt from one stack into the fan: x offset (% of card width) and tilt (deg).
const FAN_POSE = [
  { x: '-55%', rotate: -4 },
  { x: '-45%', rotate: 3 },
  { x: '-50%', rotate: -1 },
]
const FAN_STEP = 84

export function WelcomeScreen() {
  const navigate = useNavigate()
  const status = useSolo((s) => s.status)
  const reduced = useReducedMotion() ?? false
  return (
    <main className="screen">
      <div className="flex min-h-11 items-center justify-between">
        <span className="wordmark">{PRODUCT_NAME}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label={copy.welcome.secondary}
          onClick={() => navigate('/saved')}
        >
          <Icon name="bookmark" />
        </button>
      </div>
      <h1 className="t-title" style={{ margin: '18px 0 8px' }}>
        {copy.welcome.title} <em>{copy.welcome.titleEmphasis}</em>
      </h1>
      <p className="t-body muted" style={{ margin: 0 }}>
        {copy.welcome.body}
      </p>
      <div aria-hidden="true" className="relative my-3 flex-1" style={{ minHeight: 330 }}>
        {FAN.map((d, i) => (
          <motion.div
            key={d.name}
            className="tinted absolute flex flex-col gap-1.5"
            style={{
              left: '50%',
              top: i * FAN_STEP,
              width: '80%',
              height: 150,
              padding: '12px 14px',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-card)',
              x: FAN_POSE[i]!.x,
              rotate: FAN_POSE[i]!.rotate,
              ...({ '--tint': d.tint } as CSSProperties),
            }}
            initial={reduced ? false : { y: (1 - i) * FAN_STEP, rotate: 0 }}
            animate={{ y: 0, rotate: FAN_POSE[i]!.rotate }}
            transition={{ delay: 0.12 + i * 0.07, duration: 0.5, ease: MOTION.settleEase }}
          >
            <span className="t-label">{d.cuisine}</span>
            <span className="t-display-l" style={{ fontSize: 26 }}>
              {d.name}
            </span>
          </motion.div>
        ))}
      </div>
      {status === 'error' && (
        <p className="notice" role="alert">
          {copy.welcome.loadError}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => navigate('/craving')}
        disabled={status === 'error'}
      >
        {copy.welcome.primary}
      </button>
      <button type="button" className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => navigate('/saved')}>
        {copy.welcome.secondary}
      </button>
    </main>
  )
}
