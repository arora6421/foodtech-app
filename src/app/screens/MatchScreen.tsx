import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Navigate, useNavigate } from 'react-router'
import { copy } from '../copy/en-GB'
import { MOTION } from '../design/motion'
import { DishTile } from '../components/food/DishCard'
import { DirectionsSheet, OrderSheet } from '../components/handoff/HandoffSheets'
import { Icon } from '../components/primitives/Icon'
import { track } from '../services/analytics'
import { useSaved } from '../state/savedStore'
import { useSolo } from '../state/soloSessionStore'
import { matchModel } from '../state/viewModels'
import type { MatchModel } from '../state/viewModels'

// S4 Match Found (MVP_SPEC §4) plus the approved runner-up inspection state ("Alternative"):
// inspecting an alternative is UI-only, is labelled as such, and never offers "Show me something else".
//
// The payoff: the swiped card's colour carries into the ticket, which rises, gets its confidence
// stamped on, then ticks off the engine's own reasons (≤ 900 ms, m1-spec §2 MatchReveal). It plays
// once on arrival; switching between our match and an alternative is a quick crossfade.
// Reduced motion: a single short fade.

const sec = (ms: number) => ms / 1000

type Entrance = 'full' | 'switch' | 'reduced'

/** Motion props per element. Each element reads them once, at mount, so later changes never cut an entrance short. */
function revealFor(entrance: Entrance) {
  const none = { ticket: {}, stamp: {}, line: (_i: number) => ({}), actions: {} }
  if (entrance === 'reduced') {
    const fade = {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: sec(MOTION.reducedFadeMs) },
    }
    return { ...none, ticket: fade, actions: fade }
  }
  if (entrance === 'switch')
    return { ...none, ticket: { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } } }
  const ease = MOTION.settleEase
  return {
    ticket: { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.42, ease } },
    stamp: {
      initial: { opacity: 0, scale: 1.7, rotate: -14 },
      animate: { opacity: 1, scale: 1, rotate: -3 },
      transition: { delay: 0.34, duration: 0.2, ease: [0.5, 0, 0.2, 1] as const },
    },
    line: (i: number) => ({
      initial: { opacity: 0, x: -6 },
      animate: { opacity: 1, x: 0 },
      transition: { delay: 0.48 + i * sec(MOTION.reasonStaggerMs), duration: 0.22, ease },
    }),
    actions: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: { delay: 0.6, duration: 0.26, ease },
    },
  }
}

function MatchTicket({ model, entrance, onLanded }: { model: MatchModel; entrance: Entrance; onLanded: () => void }) {
  const [reveal] = useState(() => revealFor(entrance))
  const hero = model.hero
  return (
    <motion.section className="receipt" aria-labelledby="match-dish" {...reveal.ticket} onAnimationComplete={onLanded}>
      <div className="receipt-plate tinted" style={{ '--tint': hero.tint } as CSSProperties}>
        <div className="flex items-center justify-between gap-2">
          <span className="t-label">{hero.cuisineLabel}</span>
          <motion.span className="badge" {...reveal.stamp}>
            {model.mode === 'match' ? model.confidenceLabel : copy.match.altLabel}
          </motion.span>
        </div>
        <h2 id="match-dish" className="t-display-xl" style={{ margin: '14px 0 0' }}>
          {hero.archetypeName}
        </h2>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="t-body dot-list">
          {hero.showArchetype && <span>{hero.offeringName}</span>}
          <span>{hero.venueName}</span>
        </span>
        <span className="leader" />
        <span className="t-price">{hero.priceLabel}</span>
      </div>
      <p className="t-caption dot-list" style={{ margin: '2px 0 0' }}>
        <span>{hero.timeLabel}</span>
        <span>{hero.distanceLabel}</span>
      </p>
      {model.headline && (
        <motion.p className="t-lead" style={{ margin: '10px 0 4px' }} {...reveal.line(0)}>
          {model.headline}
        </motion.p>
      )}
      {model.reasons.length > 0 && (
        <>
          <h3 className="t-section" style={{ margin: '10px 0 2px' }}>
            {model.mode === 'match' ? copy.match.why : copy.match.altWhy}
          </h3>
          <ul className="reasons">
            {model.reasons.map((r, i) => (
              <motion.li key={r.text} data-kind={r.kind} {...reveal.line(i + 1)}>
                {r.text}
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </motion.section>
  )
}

export function MatchScreen() {
  const navigate = useNavigate()
  const status = useSolo((s) => s.status)
  const loaded = useSolo((s) => s.loaded)
  const state = useSolo((s) => s.state)
  const view = useSolo((s) => s.view)
  const notQuite = useSolo((s) => s.notQuite)
  const reset = useSolo((s) => s.reset)
  const viewAlternative = useSolo((s) => s.viewAlternative)
  const chooseAlternative = useSolo((s) => s.chooseAlternative)
  const returnToMatch = useSolo((s) => s.returnToMatch)
  const saveItem = useSaved((s) => s.save)
  const removeItem = useSaved((s) => s.remove)
  const items = useSaved((s) => s.items)
  const [sheet, setSheet] = useState<'order' | 'directions' | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const reduced = useReducedMotion() ?? false
  // Full choreography on arrival; once the first ticket has landed, switching tickets crossfades.
  const [landed, setLanded] = useState(false)
  const [actionsReveal] = useState(() => revealFor(reduced ? 'reduced' : 'full').actions)

  const model = loaded && state ? matchModel(loaded, state, view) : null
  const focusKey = model ? `${model.mode}:${model.hero.archetypeId}` : ''
  useEffect(() => {
    headingRef.current?.focus()
  }, [focusKey])

  if (status !== 'ready')
    return (
      <main className="screen" aria-busy="true">
        <p className="t-body muted">{copy.welcome.loading}</p>
      </main>
    )
  if (!state || !loaded) return <Navigate to="/craving" replace />
  if (!state.result || !model) return <Navigate to="/deck" replace />

  const hero = model.hero
  const savedEntry = items.find((i) => i.archetypeId === hero.archetypeId && i.offeringId === hero.offeringId)
  const inspecting = model.mode === 'alternative'
  const showPickList = model.pickList && model.mode === 'match'

  const toggleSave = () => {
    if (savedEntry) return removeItem(savedEntry.id)
    track('match_action', { action: 'save', archetypeId: hero.archetypeId })
    saveItem({
      archetypeId: hero.archetypeId,
      offeringId: hero.offeringId,
      archetypeName: hero.archetypeName,
      offeringName: hero.offeringName,
      venueName: hero.venueName,
      priceLabel: hero.priceLabel,
      tint: hero.tint,
    })
  }
  const openSheet = (kind: 'order' | 'directions') => {
    track('match_action', { action: kind, archetypeId: hero.archetypeId })
    setSheet(kind)
  }
  const primary = model.primaryAction
  const secondary = primary === 'order' ? 'directions' : 'order'

  return (
    <main className="screen">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="t-lead"
        style={{ fontSize: 30, lineHeight: 1, margin: '8px 0 12px', outlineOffset: 4 }}
      >
        {showPickList ? copy.match.pickTitle : copy.match.title}
      </h1>

      {showPickList ? (
        <>
          <p className="t-body muted" style={{ margin: '0 0 12px' }}>
            {copy.match.pickBody}
          </p>
          <div className="flex flex-col gap-2">
            {model.pickList!.map((d) => (
              <DishTile key={d.key} model={d} onClick={() => viewAlternative(d.archetypeId, true)} />
            ))}
          </div>
        </>
      ) : (
        <>
          <MatchTicket
            key={`${model.mode}:${hero.archetypeId}`}
            model={model}
            entrance={reduced ? 'reduced' : landed ? 'switch' : 'full'}
            onLanded={() => setLanded(true)}
          />

          {model.alsoAt.length > 0 && (
            <p className="t-caption" style={{ margin: '14px 0 0' }}>
              {copy.match.alsoAt}{' '}
              <span className="dot-list">
                {model.alsoAt.map((a) => (
                  <span key={a.venueName}>
                    {a.venueName} ({a.priceLabel})
                  </span>
                ))}
              </span>
            </p>
          )}

          {model.alternatives.length > 0 && (
            <div className="grid grid-cols-2 gap-2" style={{ marginTop: 10 }}>
              {model.alternatives.map((alt) => {
                const isEngineHero = alt.archetypeId === state.result!.hero.archetypeId
                return (
                  <button
                    key={alt.key}
                    type="button"
                    className="alt-tile"
                    onClick={() => (isEngineHero ? returnToMatch() : viewAlternative(alt.archetypeId))}
                  >
                    <small>{isEngineHero ? copy.match.ourMatch : copy.match.orTry}</small>
                    {alt.archetypeName}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      <motion.div style={{ marginTop: 'auto', paddingTop: 14 }} {...actionsReveal}>
        {inspecting ? (
          <div className="flex flex-col gap-2.5">
            <button type="button" className="btn btn-primary" onClick={chooseAlternative}>
              {copy.match.altChoose}
            </button>
            <button type="button" className="btn btn-secondary" onClick={returnToMatch}>
              {copy.match.altReturn}
            </button>
          </div>
        ) : (
          !showPickList && (
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 48px' }}>
              <button type="button" className="btn btn-primary" onClick={() => openSheet(primary)}>
                {primary === 'order' ? copy.match.order : copy.match.directions}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => openSheet(secondary)}>
                {secondary === 'order' ? copy.match.order : copy.match.directions}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                aria-label={copy.match.save}
                title={savedEntry ? copy.match.saved : copy.match.save}
                aria-pressed={!!savedEntry}
                onClick={toggleSave}
              >
                <Icon name="bookmark" filled={!!savedEntry} />
              </button>
            </div>
          )
        )}
        <div className="flex flex-wrap justify-center gap-x-4">
          {model.mode === 'match' && !showPickList && (
            <button type="button" className="btn btn-tertiary" onClick={notQuite}>
              {copy.match.somethingElse}
            </button>
          )}
          {model.mode === 'chosen-alternative' && (
            <button type="button" className="btn btn-tertiary" onClick={returnToMatch}>
              {copy.match.altReturn}
            </button>
          )}
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={() => {
              track('match_action', { action: 'start_over' })
              reset()
              navigate('/craving')
            }}
          >
            {copy.match.startAgain}
          </button>
        </div>
      </motion.div>

      <OrderSheet
        open={sheet === 'order'}
        onClose={() => setSheet(null)}
        venueName={hero.venueName}
        offeringName={hero.offeringName}
      />
      <DirectionsSheet
        open={sheet === 'directions'}
        onClose={() => setSheet(null)}
        venueName={hero.venueName}
        timeLabel={hero.timeLabel}
        distanceLabel={hero.distanceLabel}
      />
    </main>
  )
}
