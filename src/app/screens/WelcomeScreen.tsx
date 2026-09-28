import type { CSSProperties } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import { copy, PRODUCT_NAME } from '../copy/en-GB'
import { DishImage, PlateArt } from '../components/food/DishImage'
import { DEFAULT_COVER } from '../design/covers'
import { MOTION } from '../design/motion'
import { useSolo } from '../state/soloSessionStore'
import { welcomePlates } from '../state/viewModels'

// S1 Welcome as a magazine cover ("Crave", mockup 01): the masthead, the cover line, three real
// dishes spread across the page (photos when available, else the no-photo plate), and the way in.
// "With friends" is shown as coming soon; group mode isn't built.

// Where each plate sits on the plate area (which runs edge to edge). A plate's size is a share of
// the area's width or height, whichever is smaller, so on a short phone the plates shrink rather
// than run into the buttons; a bleed off the edge is a share of the plate, so it stays in view.
const PLATE_POSE: { size: number; top: number; side: 'left' | 'right'; offset: string }[] = [
  { size: 76, top: 0, side: 'right', offset: 'calc(var(--size) * -0.25)' }, // the big plate
  { size: 51, top: 30, side: 'left', offset: 'calc(var(--size) * -0.12)' },
  { size: 38, top: 58, side: 'right', offset: '8%' },
]

export function WelcomeScreen() {
  const navigate = useNavigate()
  const status = useSolo((s) => s.status)
  const loaded = useSolo((s) => s.loaded)
  const reduced = useReducedMotion() ?? false
  const plates = welcomePlates(loaded)
  return (
    <main className="screen welcome-cover cover" style={{ '--cover': DEFAULT_COVER } as CSSProperties}>
      <div className="issue-line t-kicker" aria-hidden="true">
        <span>{copy.welcome.issue}</span>
        <span>{copy.welcome.strap}</span>
      </div>
      <div className="welcome-masthead" aria-hidden="true">
        {PRODUCT_NAME}
      </div>
      <div className="cover-rule" />
      <h1 className="welcome-headline">{copy.welcome.title}</h1>
      <p className="welcome-sub">{copy.welcome.body}</p>

      <div className="welcome-plates">
        {plates.map((p, i) => {
          const pose = PLATE_POSE[i]!
          const position: Record<string, string> = {
            '--size': `min(${pose.size}cqw, ${pose.size}cqh)`,
            top: `${pose.top}%`,
            [pose.side]: pose.offset,
          }
          return (
            <div key={p.id} className="welcome-plate" style={position as CSSProperties} aria-hidden="true">
              <m.div
                className="welcome-plate-in"
                initial={reduced ? false : { y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: MOTION.settleEase }}
              >
                <DishImage
                  variant="plate"
                  image={p.image}
                  tint={p.tint}
                  art={<PlateArt initial={p.initial} />}
                  decorative
                  note={false}
                />
              </m.div>
            </div>
          )
        })}
        {plates.some((p) => p.image?.illustrative) && (
          <span className="welcome-note dish-media-note">{copy.imagery.illustrativePlural}</span>
        )}
        <span className="swipes-sticker">
          <small>{copy.welcome.swipes.about}</small>
          <b>{copy.welcome.swipes.count}</b>
          <small>{copy.welcome.swipes.unit}</small>
        </span>
      </div>

      {status === 'error' && (
        <p className="notice" role="alert">
          {copy.welcome.loadError}
        </p>
      )}
      <div className="cover-actions">
        <button
          type="button"
          className="btn-cover-primary"
          onClick={() => navigate('/craving')}
          disabled={status === 'error'}
        >
          {copy.welcome.primary}
        </button>
        <button type="button" className="btn-cover soon-btn" disabled aria-label={copy.welcome.withFriendsLabel}>
          {copy.welcome.withFriends}
          <span className="soon-sticker" aria-hidden="true">
            {copy.welcome.soon}
          </span>
        </button>
      </div>
      <div className="cover-links">
        <button type="button" className="link-btn" onClick={() => navigate('/saved')}>
          {copy.welcome.secondary}
        </button>
      </div>
    </main>
  )
}
