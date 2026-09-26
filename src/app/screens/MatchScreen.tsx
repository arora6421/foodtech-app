import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { Navigate, useNavigate } from 'react-router'
import { copy, PRODUCT_NAME } from '../copy/en-GB'
import { coverFor } from '../design/covers'
import { MOTION } from '../design/motion'
import { nameTier } from '../design/nameFit'
import { DishTile } from '../components/food/DishCard'
import { DishImage, MenuMark, PlateArt } from '../components/food/DishImage'
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
// The payoff is a full-screen magazine cover in the dish's colour ("Crave", mockups 05 and 06): the
// dish as the cover story, its plate with the confidence sticker, and the engine's own reasons,
// numbered. It rises, the sticker is slapped on, the reasons tick in (≤ 900 ms, m1-spec §2
// MatchReveal); once on arrival, then switching between our match and an alternative crossfades.
// Reduced motion: a single short fade. Every word about the dish comes from real data.

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

function MatchCover({ model, entrance, onLanded }: { model: MatchModel; entrance: Entrance; onLanded: () => void }) {
  const [reveal] = useState(() => revealFor(entrance))
  const hero = model.hero
  const isMatch = model.mode === 'match'
  return (
    <m.section className="match-story" aria-labelledby="match-dish" {...reveal.ticket} onAnimationComplete={onLanded}>
      <h2 id="match-dish" className={`match-dish name-${nameTier(hero.archetypeName)}`}>
        {hero.archetypeName}
      </h2>
      <p className="match-sub">{copy.match.at(hero.venueName, hero.priceLabel, hero.distanceLabel)}</p>
      <div className="match-plate">
        <DishImage
          variant="plate"
          image={hero.image}
          tint={hero.tint}
          art={<PlateArt initial={hero.initial} />}
          priority
        />
        {isMatch && (
          <m.span className="match-sticker" {...reveal.stamp}>
            {model.confidenceLabel}
          </m.span>
        )}
      </div>
      {model.headline && (
        <m.p className="match-headline" {...reveal.line(0)}>
          {model.headline}
        </m.p>
      )}
      {model.reasons.length > 0 && (
        <>
          <h3 className={isMatch ? 'sr-only' : 'match-why'}>{isMatch ? copy.match.why : copy.match.altWhy}</h3>
          <ol className="match-reasons">
            {model.reasons.map((r, i) => (
              <m.li key={r.text} data-kind={r.kind} {...reveal.line(i + 1)}>
                <span className="reason-no" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="reason-text">{r.text}</span>
              </m.li>
            ))}
          </ol>
        </>
      )}
    </m.section>
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
  // In a pick-list session "our match" is the list itself, so the return action and the top dish's
  // tile say so; the approved runner-up copy applies everywhere else.
  const pickListSession = state.result.stopReason === 'pick_list'
  const returnLabel = pickListSession ? copy.match.pickListReturn : copy.match.altReturn

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

  const kicker = showPickList ? copy.match.pickTitle : model.mode === 'match' ? copy.match.kicker : copy.match.altLabel

  return (
    <main
      className={showPickList ? 'screen' : 'screen match-cover cover'}
      style={showPickList ? undefined : ({ '--cover': coverFor(hero.tint) } as CSSProperties)}
    >
      <div className="cover-bar">
        <span className="masthead" aria-hidden="true">
          {PRODUCT_NAME}
        </span>
        <button type="button" className="icon-btn" aria-label={copy.deck.close} onClick={() => navigate('/')}>
          <Icon name="close" />
        </button>
      </div>
      <div className="cover-rule" />
      <h1 ref={headingRef} tabIndex={-1} className="match-kicker">
        {kicker}
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
        <MatchCover
          key={`${model.mode}:${hero.archetypeId}`}
          model={model}
          entrance={reduced ? 'reduced' : landed ? 'switch' : 'full'}
          onLanded={() => setLanded(true)}
        />
      )}

      <m.div className="cover-actions" {...actionsReveal}>
        {inspecting ? (
          <>
            <button type="button" className="btn-cover-primary" onClick={chooseAlternative}>
              {copy.match.altChoose}
            </button>
            <button type="button" className="btn-cover" onClick={returnToMatch}>
              {returnLabel}
            </button>
          </>
        ) : (
          !showPickList && (
            <>
              <button type="button" className="btn-cover-primary" onClick={() => openSheet(primary)}>
                {primary === 'order' ? copy.match.order : copy.match.directions}
              </button>
              <div className="cover-actions-row">
                <button type="button" className="btn-cover" onClick={() => openSheet(secondary)}>
                  {secondary === 'order' ? copy.match.order : copy.match.directions}
                </button>
                <button
                  type="button"
                  className="btn-cover"
                  aria-pressed={!!savedEntry}
                  title={savedEntry ? copy.match.saved : undefined}
                  onClick={toggleSave}
                >
                  <Icon name="bookmark" filled={!!savedEntry} />
                  {copy.match.save}
                </button>
              </div>
            </>
          )
        )}
      </m.div>

      {!showPickList && model.alternatives.length > 0 && (
        <>
          <p className="or-try-head t-kicker">{copy.match.orTry}</p>
          <div className="or-try">
            {model.alternatives.map((alt) => {
              const isEngineHero = alt.archetypeId === state.result!.hero.archetypeId
              return (
                <button
                  key={alt.key}
                  type="button"
                  className="or-try-tile"
                  onClick={() =>
                    isEngineHero && !pickListSession ? returnToMatch() : viewAlternative(alt.archetypeId, isEngineHero)
                  }
                >
                  <DishImage
                    variant="mini"
                    image={alt.image}
                    tint={alt.tint}
                    art={<MenuMark text={alt.initial} />}
                    decorative
                  />
                  <span className="or-try-text">
                    {isEngineHero && (
                      <small className="or-try-label">
                        {pickListSession ? copy.match.pickListTop : copy.match.ourMatch}
                      </small>
                    )}
                    <span className="or-try-name">{alt.archetypeName}</span>
                    <span className="or-try-meta">
                      {alt.priceLabel} · {alt.distanceLabel}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {!showPickList && model.alsoAt.length > 0 && (
        <p className="also-at">
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

      <div className="cover-links">
        {model.mode === 'match' && !showPickList && (
          <button type="button" className="link-btn" onClick={notQuite}>
            {copy.match.somethingElse}
          </button>
        )}
        {model.mode === 'chosen-alternative' && (
          <button type="button" className="link-btn" onClick={returnToMatch}>
            {returnLabel}
          </button>
        )}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            track('match_action', { action: 'start_over' })
            reset()
            navigate('/craving')
          }}
        >
          {copy.match.startAgain}
        </button>
      </div>

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
