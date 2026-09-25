import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { copy } from '../copy/en-GB'
import { DishTile } from '../components/food/DishCard'
import { DirectionsSheet, OrderSheet } from '../components/handoff/HandoffSheets'
import { Icon } from '../components/primitives/Icon'
import { track } from '../services/analytics'
import { useSaved } from '../state/savedStore'
import { useSolo } from '../state/soloSessionStore'
import { matchModel } from '../state/viewModels'

// S4 Match Found (MVP_SPEC §4) plus the approved runner-up inspection state ("Alternative"):
// inspecting an alternative is UI-only, is labelled as such, and never offers "Show me something else".

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

  const model = loaded && state ? matchModel(loaded, state, view) : null
  const focusKey = model ? `${model.mode}:${model.hero.archetypeId}` : ''
  useEffect(() => {
    headingRef.current?.focus()
  }, [focusKey])

  if (status !== 'ready') return <main className="screen" aria-busy="true"><p className="t-body muted">{copy.welcome.loading}</p></main>
  if (!state || !loaded) return <Navigate to="/craving" replace />
  if (!state.result || !model) return <Navigate to="/deck" replace />

  const hero = model.hero
  const savedEntry = items.find((i) => i.archetypeId === hero.archetypeId && i.offeringId === hero.offeringId)
  const inspecting = model.mode === 'alternative'
  const showPickList = model.pickList && model.mode === 'match'

  const toggleSave = () => {
    if (savedEntry) return removeItem(savedEntry.id)
    track('match_action', { action: 'save', archetypeId: hero.archetypeId })
    saveItem({ archetypeId: hero.archetypeId, offeringId: hero.offeringId, archetypeName: hero.archetypeName, offeringName: hero.offeringName, venueName: hero.venueName, priceLabel: hero.priceLabel, tint: hero.tint })
  }
  const openSheet = (kind: 'order' | 'directions') => {
    track('match_action', { action: kind, archetypeId: hero.archetypeId })
    setSheet(kind)
  }
  const primary = model.primaryAction
  const secondary = primary === 'order' ? 'directions' : 'order'

  return (
    <main className="screen">
      <h1 ref={headingRef} tabIndex={-1} className="t-lead" style={{ fontSize: 30, lineHeight: 1, margin: '8px 0 12px', outlineOffset: 4 }}>
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
          <section className="receipt" aria-labelledby="match-dish">
            <span className="badge">{model.mode === 'match' ? model.confidenceLabel : copy.match.altLabel}</span>
            <h2 id="match-dish" className="t-display-xl" style={{ margin: '8px 0 6px' }}>
              {hero.archetypeName}
            </h2>
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
              <p className="t-lead" style={{ margin: '10px 0 4px' }}>
                {model.headline}
              </p>
            )}
            {model.reasons.length > 0 && (
              <>
                <h3 className="t-section" style={{ margin: '10px 0 2px' }}>
                  {model.mode === 'match' ? copy.match.why : copy.match.altWhy}
                </h3>
                <ul className="reasons">
                  {model.reasons.map((r) => (
                    <li key={r.text} data-kind={r.kind}>
                      {r.text}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

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
                  <button key={alt.key} type="button" className="alt-tile" onClick={() => (isEngineHero ? returnToMatch() : viewAlternative(alt.archetypeId))}>
                    <small>{isEngineHero ? copy.match.ourMatch : copy.match.orTry}</small>
                    {alt.archetypeName}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 14 }}>
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
              <button type="button" className="btn btn-secondary btn-icon" aria-label={copy.match.save} title={savedEntry ? copy.match.saved : copy.match.save} aria-pressed={!!savedEntry} onClick={toggleSave}>
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
      </div>

      <OrderSheet open={sheet === 'order'} onClose={() => setSheet(null)} venueName={hero.venueName} offeringName={hero.offeringName} />
      <DirectionsSheet open={sheet === 'directions'} onClose={() => setSheet(null)} venueName={hero.venueName} timeLabel={hero.timeLabel} distanceLabel={hero.distanceLabel} />
    </main>
  )
}
