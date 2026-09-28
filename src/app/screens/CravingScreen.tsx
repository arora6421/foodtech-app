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

// S2 Craving & settings (MVP_SPEC §4), styled as a magazine contents page ("Crave", mockup 02): the
// seven moods and the two intents numbered 01–09, chosen rows marked "Tonight". Up to two moods
// (a third replaces the oldest); "I have no idea" clears the moods; settings (Diet, Budget, Eating)
// are remembered. The dish count updates live, so filters that are too tight show up before the
// user starts.

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, eligibleCount, craving, diet, budget, fulfilment],
  )

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

  const rows: { key: string; label: string; pressed: boolean; onClick: () => void }[] = [
    ...MOODS.map((m) => ({ key: m, label: copy.moods[m], pressed: moods.includes(m), onClick: () => toggleMood(m) })),
    {
      key: 'something_new',
      label: copy.craving.somethingNew,
      pressed: intent === 'something_new',
      onClick: () => toggleIntent('something_new'),
    },
    {
      key: 'no_idea',
      label: copy.craving.noIdea,
      pressed: intent === 'no_idea',
      onClick: () => toggleIntent('no_idea'),
    },
  ]

  return (
    <main className="screen contents-page">
      <div className="contents-bar">
        <button type="button" className="icon-btn" aria-label={copy.craving.back} onClick={() => navigate('/')}>
          <Icon name="back" />
        </button>
        <span className="t-kicker" aria-hidden="true">
          {copy.craving.contents}
        </span>
        <span className="contents-bar-spacer" />
      </div>
      <h1 className="contents-title">{copy.craving.title}</h1>
      <p className="contents-sub">{copy.craving.body}</p>
      <ol className="contents-list">
        {rows.map((r, i) => (
          <li key={r.key}>
            <button type="button" className="contents-row" aria-pressed={r.pressed} onClick={r.onClick}>
              <span className="contents-no" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="contents-label">{r.label}</span>
              {r.pressed && (
                <span className="tonight-sticker" aria-hidden="true">
                  {copy.craving.tonight}
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>

      <h2 className="t-kicker contents-filters-head">{copy.craving.filters}</h2>
      <div className="contents-filters">
        <button
          type="button"
          className="filter-row"
          aria-label={`${copy.craving.diet}: ${dietLabel}`}
          onClick={() => setSheet('diet')}
        >
          <span>{copy.craving.diet}</span>
          <b>{dietLabel}</b>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          className="filter-row"
          aria-label={`${copy.craving.budget}: ${copy.budget[budget]}`}
          onClick={() => setSheet('budget')}
        >
          <span>{copy.craving.budget}</span>
          <b>{copy.budget[budget]}</b>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          className="filter-row"
          aria-label={`${copy.craving.eating}: ${copy.fulfilment[fulfilment]}`}
          onClick={() => setSheet('eating')}
        >
          <span>{copy.craving.eating}</span>
          <b>{copy.fulfilment[fulfilment]}</b>
          <Icon name="chevron" />
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
        className="btn-cover-primary contents-go"
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
          className="btn-cover-primary w-full"
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
          className="btn-cover-primary w-full"
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
          className="btn-cover-primary w-full"
          style={{ marginTop: 16 }}
          onClick={() => setSheet(null)}
        >
          {copy.sheets.done}
        </button>
      </Sheet>
    </main>
  )
}
