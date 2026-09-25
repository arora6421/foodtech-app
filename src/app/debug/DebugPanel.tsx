import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { DIET_CONSTRAINTS, MOODS, distanceMiles } from '../../domain'
import type { Budget, CravingSelection, DietConstraint, Fulfilment, Intent, Mood, SessionContext } from '../../domain'
import { MOCK_CATALOGUE } from '../../catalog/mock/MockCatalog'
import { ANGEL_N1 } from '../../location/LocationProvider'
import { clusterArchetypes } from '../../engine/clusters/clusters'
import { DEFAULT_CONFIG, withConfig } from '../../engine/config'
import type { EngineConfig } from '../../engine/config'
import { currentBelief } from '../../engine/deck/selectNext'
import { explainResult } from '../../engine/explain/explain'
import { confidence, pref, view } from '../../engine/profile/profile'
import { createSoloSession, soloReducer, undo } from '../../engine/session/solo'
import type { SoloEvent, SoloState } from '../../engine/session/types'

// Developer debug panel (MVP_SPEC §4 D1). Deliberately plain: it exists to make the engine inspectable.

const EVENING = '2026-09-24T19:30:00Z'
const MORNING = '2026-09-24T08:00:00Z'

interface Setup {
  moods: Mood[]
  intent: Intent
  diet: DietConstraint[]
  budget: Budget
  fulfilment: Fulfilment
  seed: number
  now: string
}

interface TranscriptFile {
  overrides: Partial<EngineConfig>
  transcripts: {
    personaId: string
    seed: number
    input: { context: Omit<SessionContext, 'now'> & { now: string }; craving: CravingSelection; seed: number }
    events: SoloEvent[]
    stopReason: string
    hero: string
  }[]
}

const clusteringCache = new Map<string, ReturnType<typeof clusterArchetypes>>()
function start(context: SessionContext, craving: CravingSelection, seed: number, config: EngineConfig): SoloState {
  const key = `${config.clusterCount}`
  if (!clusteringCache.has(key)) clusteringCache.set(key, clusterArchetypes(MOCK_CATALOGUE, config))
  return createSoloSession({
    catalogue: MOCK_CATALOGUE,
    context,
    craving,
    seed,
    config,
    clustering: clusteringCache.get(key)!,
  })
}

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`
const bar = (x: number, colour: string) => (
  <span style={{ display: 'inline-block', width: 80, height: 8, background: '#eee', verticalAlign: 'middle' }}>
    <span style={{ display: 'block', width: `${Math.min(100, Math.abs(x) * 100)}%`, height: 8, background: colour }} />
  </span>
)

export function DebugPanel() {
  const [setup, setSetup] = useState<Setup>({
    moods: [],
    intent: 'normal',
    diet: [],
    budget: 'any',
    fulfilment: 'either',
    seed: 1,
    now: EVENING,
  })
  const [config, setConfig] = useState<EngineConfig>(DEFAULT_CONFIG)
  const [state, setState] = useState<SoloState | null>(null)
  const [replay, setReplay] = useState<{ file: TranscriptFile; index: number; step: number } | null>(null)

  const begin = () =>
    setState(
      start(
        {
          origin: ANGEL_N1,
          now: new Date(setup.now),
          fulfilment: setup.fulfilment,
          budget: setup.budget,
          diet: setup.diet,
        },
        { moods: setup.moods, intent: setup.intent },
        setup.seed,
        config,
      ),
    )
  const send = (e: SoloEvent) => state && setState(soloReducer(state, e))

  const onFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]
    if (!f) return
    const file = JSON.parse(await f.text()) as TranscriptFile
    setConfig(withConfig(file.overrides))
    setReplay({ file, index: 0, step: 0 })
    loadTranscript(file, 0, 0)
  }
  const loadTranscript = (file: TranscriptFile, index: number, step: number) => {
    const t = file.transcripts[index]!
    const cfg = withConfig(file.overrides)
    let s = start({ ...t.input.context, now: new Date(t.input.context.now) }, t.input.craving, t.input.seed, cfg)
    for (const e of t.events.slice(0, step)) s = soloReducer(s, e)
    setState(s)
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        padding: 16,
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'minmax(260px, 320px) 1fr',
      }}
    >
      <section>
        <h2 style={{ marginTop: 0 }}>Engine debug panel</h2>
        <fieldset>
          <legend>Craving (≤ 2)</legend>
          {MOODS.map((m) => (
            <label key={m} style={{ marginRight: 8 }}>
              <input
                type="checkbox"
                checked={setup.moods.includes(m)}
                onChange={() =>
                  setSetup((s) => ({
                    ...s,
                    moods: s.moods.includes(m) ? s.moods.filter((x) => x !== m) : [...s.moods, m].slice(-2),
                  }))
                }
              />
              {m}
            </label>
          ))}
          <div>
            Intent:{' '}
            <select
              value={setup.intent}
              onChange={(e) => setSetup((s) => ({ ...s, intent: e.target.value as Intent }))}
            >
              <option value="normal">normal</option>
              <option value="something_new">something new</option>
              <option value="no_idea">no idea</option>
            </select>
          </div>
        </fieldset>
        <fieldset>
          <legend>Settings</legend>
          {DIET_CONSTRAINTS.map((d) => (
            <label key={d} style={{ marginRight: 8 }}>
              <input
                type="checkbox"
                checked={setup.diet.includes(d)}
                onChange={() =>
                  setSetup((s) => ({ ...s, diet: s.diet.includes(d) ? s.diet.filter((x) => x !== d) : [...s.diet, d] }))
                }
              />
              {d}
            </label>
          ))}
          <div>
            Budget{' '}
            <select
              value={setup.budget}
              onChange={(e) => setSetup((s) => ({ ...s, budget: e.target.value as Budget }))}
            >
              {['any', 'low', 'mid', 'high'].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>{' '}
            Eating{' '}
            <select
              value={setup.fulfilment}
              onChange={(e) => setSetup((s) => ({ ...s, fulfilment: e.target.value as Fulfilment }))}
            >
              {['either', 'delivery', 'go_out'].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            Seed{' '}
            <input
              type="number"
              value={setup.seed}
              style={{ width: 60 }}
              onChange={(e) => setSetup((s) => ({ ...s, seed: Number(e.target.value) }))}
            />{' '}
            <label>
              <input
                type="checkbox"
                checked={setup.now === MORNING}
                onChange={(e) => setSetup((s) => ({ ...s, now: e.target.checked ? MORNING : EVENING }))}
              />
              morning
            </label>
          </div>
        </fieldset>
        <button onClick={begin}>Start session</button>

        <fieldset style={{ marginTop: 12 }}>
          <legend>Replay a sim transcript</legend>
          <input type="file" accept=".json" onChange={onFile} />
          {replay && (
            <div>
              <select
                value={replay.index}
                onChange={(e) => {
                  const index = Number(e.target.value)
                  setReplay({ ...replay, index, step: 0 })
                  loadTranscript(replay.file, index, 0)
                }}
              >
                {replay.file.transcripts.map((t, i) => (
                  <option key={i} value={i}>
                    {t.personaId} seed {t.seed} → {t.stopReason} ({t.hero})
                  </option>
                ))}
              </select>
              <div>
                <button
                  disabled={replay.step === 0}
                  onClick={() => {
                    setReplay({ ...replay, step: replay.step - 1 })
                    loadTranscript(replay.file, replay.index, replay.step - 1)
                  }}
                >
                  ◀ step
                </button>{' '}
                step {replay.step}/{replay.file.transcripts[replay.index]!.events.length}{' '}
                <button
                  disabled={replay.step >= replay.file.transcripts[replay.index]!.events.length}
                  onClick={() => {
                    setReplay({ ...replay, step: replay.step + 1 })
                    loadTranscript(replay.file, replay.index, replay.step + 1)
                  }}
                >
                  step ▶
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </section>

      {state ? (
        <SessionView state={state} send={send} onUndo={() => setState(undo(state))} />
      ) : (
        <p>Start a session or load a transcript.</p>
      )}
    </div>
  )
}

export function SessionView({
  state,
  send,
  onUndo,
}: {
  state: SoloState
  send: (e: SoloEvent) => void
  onUndo: () => void
}) {
  const { pool, config, clustering, context } = state.model
  const card = state.current
  const candidate = card
    ? pool.byArchetype.get(card.archetypeId)!.find((c) => c.offering.id === card.offeringId)!
    : null
  const b = useMemo(() => currentBelief(state), [state])
  const topBelief = b.ids
    .map((id, i) => ({ id, p: b.probs[i]! }))
    .sort((x, y) => y.p - x.p)
    .slice(0, 10)
  const features = [...state.profile.features.keys()]
    .map((f) => ({
      f,
      p: pref(state.profile, f, config),
      c: confidence(state.profile, f, config),
      v: view(state.profile, f, config.gamma),
    }))
    .sort((x, y) => y.p - x.p)
  const explanation = explainResult(state)
  const top = state.lastCheck?.top
  const topCluster = top ? clustering.clusterOf.get(top) : undefined

  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        alignContent: 'start',
      }}
    >
      <div style={{ border: '1px solid #ccc', padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>
          {pool.candidates.length} dishes → {state.counter.shown} likely <small>(raw {state.counter.raw})</small>
        </h3>
        {card && candidate && !state.result ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{candidate.offering.name}</div>
            <div>
              {candidate.archetype.name} · {candidate.venue.name} · {pounds(candidate.offering.pricePence)} ·{' '}
              {distanceMiles(context.origin, candidate.venue.location).toFixed(1)} mi · spice{' '}
              {candidate.vector.has('spice:4') ? 4 : candidate.archetype.axes.spice}
            </div>
            <div style={{ color: '#666' }}>
              card {card.cardIndex + 1} · {card.phase} / {card.slot}
              {card.flattened ? ' · flattened' : ''} · EIG {card.eig.toFixed(3)} · rank {card.finalRank.toFixed(3)} ·
              value {card.value.toFixed(3)}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => send({ type: 'swipe', verdict: 'no' })}>✗ NOPE</button>
              <button onClick={() => send({ type: 'swipe', verdict: 'yes' })}>✓ YES</button>
              <button onClick={() => send({ type: 'pick' })}>That’s the one</button>
              <button onClick={() => send({ type: 'decide' })}>Decide for me</button>
              <button onClick={onUndo} disabled={state.events.length === 0}>
                Undo
              </button>
            </div>
          </>
        ) : null}
        {state.result && (
          <div>
            <div style={{ fontWeight: 600 }}>
              {state.result.confidenceLabel} · {state.result.stopReason} after {state.result.swipes}
            </div>
            <div style={{ fontSize: 18 }}>{pool.archetypes.get(state.result.hero.archetypeId)!.name}</div>
            <div>runners-up: {state.result.runnersUp.map((r) => r.archetypeId).join(', ')}</div>
            <div>also at: {state.result.alsoAt.join(', ') || '—'}</div>
            {state.result.pickList && (
              <div>pick list: {state.result.pickList.map((r) => r.archetypeId).join(', ')}</div>
            )}
            {explanation && (
              <div style={{ marginTop: 8 }}>
                <em>{explanation.headline}</em>
                <ul>
                  {explanation.reasons.map((r) => (
                    <li key={r.featureId}>
                      {r.text}{' '}
                      <small style={{ color: '#666' }}>
                        [{r.featureId} yes {r.evidence.yesSeen} / no {r.evidence.noSeen}
                        {r.evidence.fromCraving ? ' · craving' : ''}]
                      </small>
                    </li>
                  ))}
                  {explanation.avoided && (
                    <li>
                      {explanation.avoided.text}{' '}
                      <small style={{ color: '#666' }}>[{explanation.avoided.featureId}]</small>
                    </li>
                  )}
                </ul>
              </div>
            )}
            <button onClick={() => send({ type: 'not_quite' })}>Not quite</button>{' '}
            <button onClick={onUndo}>Undo</button>
          </div>
        )}
      </div>

      <div style={{ border: '1px solid #ccc', padding: 12 }}>
        <h4 style={{ marginTop: 0 }}>Stop rule</h4>
        {state.lastCheck ? (
          <div>
            top <b>{state.lastCheck.top}</b> · top-3 mass {state.lastCheck.topMass3.toFixed(2)} (≥{' '}
            {config.confidentMass}) · support {String(state.lastCheck.support)} · stable{' '}
            {String(state.lastCheck.stable)} · swipes {state.swipes.length} (min {config.minSwipes}, max{' '}
            {config.maxSwipes + state.notQuite.extension})
          </div>
        ) : (
          <div>no swipes yet</div>
        )}
        <h4>Silent pivot</h4>
        <div>
          streak {state.pivot.streak}/{config.pivotStreak} · used {state.pivot.used}/{config.maxPivots} · flatten{' '}
          {state.pivot.flattenRemaining} · anchor pending {String(state.pivot.anchorPending)}
        </div>
        {state.pivot.log.map((l, i) => (
          <div key={i}>
            pivot at swipe {l.atSwipe} from cluster {l.fromCluster} → anchor {l.anchorArchetypeId ?? '—'}
          </div>
        ))}
        <h4>Clusters</h4>
        <div>
          current: {topCluster ?? '—'}
          {topCluster !== undefined &&
            ` (medoid ${clustering.clusters[topCluster]!.medoid}: ${clustering.clusters[topCluster]!.members.join(', ')})`}
        </div>
      </div>

      <div style={{ border: '1px solid #ccc', padding: 12 }}>
        <h4 style={{ marginTop: 0 }}>
          Belief (top 10, H = {b.ids.length}, entropy {b.entropy.toFixed(2)})
        </h4>
        {topBelief.map(({ id, p }) => (
          <div key={id}>
            {bar(p, '#4a7')} {(p * 100).toFixed(1)}% {id}
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #ccc', padding: 12, maxHeight: 420, overflow: 'auto' }}>
        <h4 style={{ marginTop: 0 }}>Profile ({features.length} features)</h4>
        <table>
          <thead>
            <tr>
              <th align="left">feature</th>
              <th>pref</th>
              <th>conf</th>
              <th>yes/no</th>
              <th>prior</th>
            </tr>
          </thead>
          <tbody>
            {features.map(({ f, p, c, v }) => (
              <tr key={f}>
                <td>{f}</td>
                <td>
                  {bar(p, p >= 0 ? '#4a7' : '#c55')} {p.toFixed(2)}
                </td>
                <td>{c.toFixed(2)}</td>
                <td>
                  {v.yesSeen}/{v.noSeen}
                </td>
                <td>{v.priorPos || v.priorNeg ? `+${v.priorPos.toFixed(1)} −${v.priorNeg.toFixed(1)}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ border: '1px solid #ccc', padding: 12 }}>
        <h4 style={{ marginTop: 0 }}>History</h4>
        <ol>
          {state.swipes.map((r) => (
            <li key={r.card.cardIndex}>
              {r.verdict === 'no' ? '✗' : '✓'} {r.card.archetypeId}{' '}
              <small style={{ color: '#666' }}>
                ({r.card.phase}/{r.card.slot})
              </small>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
