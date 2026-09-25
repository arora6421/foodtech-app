import { useEffect } from 'react'
import { Navigate } from 'react-router'
import { copy } from '../copy/en-GB'
import { DishCard } from '../components/food/DishCard'
import { DeckActions } from '../components/deck/DeckActions'
import { DeckTopBar } from '../components/deck/DeckTopBar'
import { useSolo } from '../state/soloSessionStore'
import { counterModel, currentCard } from '../state/viewModels'

// S3 Swipe deck (MVP_SPEC §4). M1.4: buttons and keyboard; drag gestures and motion arrive in M1.5.
// Keyboard: ← nope, → yes, Enter "that's the one", Backspace or Ctrl/⌘+Z undo.

export function DeckScreen() {
  const status = useSolo((s) => s.status)
  const loaded = useSolo((s) => s.loaded)
  const state = useSolo((s) => s.state)
  const swipe = useSolo((s) => s.swipe)
  const pick = useSolo((s) => s.pick)
  const decide = useSolo((s) => s.decide)
  const undo = useSolo((s) => s.undo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.closest('[role="dialog"]'))) return
      if (e.key === 'ArrowRight') swipe('yes')
      else if (e.key === 'ArrowLeft') swipe('no')
      else if (e.key === 'Enter' && t?.classList.contains('dish-card')) pick()
      else if (e.key === 'Backspace' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) undo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [swipe, pick, undo])

  if (status !== 'ready') return <main className="screen" aria-busy="true"><p className="t-body muted">{copy.welcome.loading}</p></main>
  if (!state || !loaded) return <Navigate to="/craving" replace />
  if (state.result) return <Navigate to="/match" replace />
  if (!state.current) return <Navigate to="/craving" replace />

  const card = currentCard(loaded, state, state.current)
  const counter = counterModel(state)

  return (
    <main className="screen">
      <h1 className="sr-only">
        {card.offeringName}, card {card.cardNumber}
      </h1>
      <DeckTopBar counter={counter} canUndo={state.events.length > 0} onUndo={undo} onDecide={decide} />
      <div className="relative flex-1" style={{ margin: '8px 0 14px', minHeight: 420 }}>
        <DishCard key={card.key} model={card} />
      </div>
      <DeckActions onNope={() => swipe('no')} onYes={() => swipe('yes')} onPick={pick} />
    </main>
  )
}
