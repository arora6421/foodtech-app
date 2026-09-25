import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BUDGETS, DIET_CONSTRAINTS, FULFILMENTS, MOODS } from '../../domain'
import type { Intent, Mood } from '../../domain'
import { copy } from '../copy/en-GB'
import { Icon } from '../components/primitives/Icon'
import { Segmented } from '../components/primitives/Segmented'
import { Sheet } from '../components/primitives/Sheet'
import { FILTERS_TOO_TIGHT } from '../services/engineAdapter'
import { useSettings } from '../state/settingsStore'
import { useSolo } from '../state/soloSessionStore'

// S2 Craving & settings (MVP_SPEC §4). Up to two moods (a third replaces the oldest); "No idea" clears
// the moods; settings are remembered. The dish count updates live, so filters that are too tight
// show up before the user starts.

type SheetKind = 'diet' | 'budget' | 'eating' | null

export function CravingScreen() {
  const navigate = useNavigate()
  const start = useSolo((s) => s.start)
  const eligibleCount = useSolo((s) => s.eligibleCount)
  const status = useSolo((s) => s.status)
  const diet = useSettings((s) => s.diet)
  const budget = useSettings((s) => s.budget)
  const fulfilment = useSettings((s) => s.fulfilment)
  const setDiet = useSettings((s) => s.setDiet)
  const setBudget = useSettings((s) => s.setBudget)
  const setFulfilment = useSettings((s) => s.setFulfilment)

  const [moods, setMoods] = useState<Mood[]>([])
  const [intent, setIntent] = useState<Intent>('normal')
  const [sheet, setSheet] = useState<SheetKind>(null)

  const craving = useMemo(() => ({ moods, intent }), [moods, intent])
  // Recompute when any setting changes (eligibleCount reads the settings store).
  const count = useMemo(
    () => (status === 'ready' ? eligibleCount(craving) : null),
    [status, eligibleCount, craving, diet, budget, fulfilment],
  ) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMood = (m: Mood) => {
    if (intent === 'no_idea') setIntent('normal')
    setMoods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].slice(-2)))
  }
  const toggleIntent = (i: Exclude<Intent, 'normal'>) => {
    if (intent === i) return setIntent('normal')
    setIntent(i)
    if (i === 'no_idea') setMoods([])
  }
  const go = () => {
    if (start(craving)) navigate('/deck')
  }

  const dietLabel = diet.length === 0 ? copy.diet.none : diet.map((d) => copy.diet[d]).join(', ')

  return (
    <main className="screen">
      <div className="flex min-h-11 items-center justify-between">
        <button type="button" className="icon-btn t-label" onClick={() => navigate('/')}>
          <Icon name="back" />
          {copy.craving.back}
        </button>
        <span className="t-label muted">{copy.craving.step}</span>
      </div>
      <h1 className="t-title" style={{ margin: '10px 0 6px' }}>
        {copy.craving.title} <em>{copy.craving.titleEmphasis}</em>
      </h1>
      <p className="t-body muted" style={{ margin: '0 0 12px' }}>
        {copy.craving.body}
      </p>
      <ul className="tick-list">
        {MOODS.map((m) => (
          <li key={m}>
            <button type="button" className="tick-row" aria-pressed={moods.includes(m)} onClick={() => toggleMood(m)}>
              <span className="tick-box" aria-hidden="true">
                {moods.includes(m) ? '✓' : ''}
              </span>
              {copy.moods[m]}
            </button>
          </li>
        ))}
      </ul>
      <p className="t-lead muted" style={{ textAlign: 'center', margin: '8px 0 0', fontSize: 15 }}>
        {copy.craving.or}
      </p>
      <div className="flex justify-around">
        <button
          type="button"
          className="text-toggle"
          aria-pressed={intent === 'something_new'}
          onClick={() => toggleIntent('something_new')}
        >
          {copy.craving.somethingNew}
        </button>
        <button
          type="button"
          className="text-toggle"
          aria-pressed={intent === 'no_idea'}
          onClick={() => toggleIntent('no_idea')}
        >
          {copy.craving.noIdea}
        </button>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <button type="button" className="settings-row" onClick={() => setSheet('diet')}>
          {copy.craving.diet}
          <b>{dietLabel}</b>
        </button>
        <button type="button" className="settings-row" onClick={() => setSheet('budget')}>
          {copy.craving.budget}
          <b>{copy.budget[budget]}</b>
        </button>
        <button type="button" className="settings-row" onClick={() => setSheet('eating')}>
          {copy.craving.eating}
          <b>{copy.fulfilment[fulfilment]}</b>
        </button>
      </div>

      {count !== null && count > 0 && count < FILTERS_TOO_TIGHT && (
        <p className="notice" role="status" style={{ marginTop: 12 }}>
          {copy.craving.tooTight(count)}
        </p>
      )}
      {count === 0 && (
        <p className="notice" role="alert" style={{ marginTop: 12 }}>
          {copy.craving.none}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 12 }}
        onClick={go}
        disabled={status !== 'ready' || count === 0}
      >
        {status === 'ready' ? copy.craving.primary : copy.welcome.loading}
      </button>

      <Sheet open={sheet === 'diet'} title={copy.sheets.dietTitle} onClose={() => setSheet(null)}>
        <p className="t-body muted" style={{ margin: '0 0 12px' }}>
          {copy.sheets.dietBody}
        </p>
        <Segmented
          label={copy.sheets.dietTitle}
          options={DIET_CONSTRAINTS.map((d) => ({ value: d, label: copy.diet[d] }))}
          value={diet}
          onToggle={(d) => setDiet(diet.includes(d) ? diet.filter((x) => x !== d) : [...diet, d])}
        />
        <button
          type="button"
          className="btn btn-primary w-full"
          style={{ marginTop: 16 }}
          onClick={() => setSheet(null)}
        >
          {copy.sheets.done}
        </button>
      </Sheet>
      <Sheet open={sheet === 'budget'} title={copy.sheets.budgetTitle} onClose={() => setSheet(null)}>
        <Segmented
          label={copy.sheets.budgetTitle}
          options={BUDGETS.map((b) => ({ value: b, label: copy.budget[b] }))}
          value={[budget]}
          onToggle={setBudget}
        />
        <button
          type="button"
          className="btn btn-primary w-full"
          style={{ marginTop: 16 }}
          onClick={() => setSheet(null)}
        >
          {copy.sheets.done}
        </button>
      </Sheet>
      <Sheet open={sheet === 'eating'} title={copy.sheets.eatingTitle} onClose={() => setSheet(null)}>
        <Segmented
          label={copy.sheets.eatingTitle}
          options={FULFILMENTS.map((f) => ({ value: f, label: copy.fulfilment[f] }))}
          value={[fulfilment]}
          onToggle={setFulfilment}
        />
        <button
          type="button"
          className="btn btn-primary w-full"
          style={{ marginTop: 16 }}
          onClick={() => setSheet(null)}
        >
          {copy.sheets.done}
        </button>
      </Sheet>
    </main>
  )
}
