import { copy } from '../../copy/en-GB'
import type { CounterModel } from '../../state/viewModels'
import { Icon } from '../primitives/Icon'

export function DeckTopBar({
  counter,
  canUndo,
  onUndo,
  onDecide,
}: {
  counter: CounterModel
  canUndo: boolean
  onUndo: () => void
  onDecide: () => void
}) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2">
      <button type="button" className="icon-btn t-label" onClick={onUndo} disabled={!canUndo}>
        <Icon name="undo" />
        {copy.deck.undo}
      </button>
      <div className="counter">
        <span className="sr-only">
          {counter.likely} of {counter.total} dishes left
        </span>
        <span aria-hidden="true">
          {counter.likely < counter.total && (
            <>
              <span className="from">{counter.total}</span>
              <span className="arrow">→</span>
            </>
          )}
          <b>{counter.likely}</b>
          <span className="lbl">{copy.deck.left}</span>
        </span>
      </div>
      <button type="button" className="icon-btn t-label" onClick={onDecide} style={{ textAlign: 'right' }}>
        {copy.deck.decide}
      </button>
    </div>
  )
}
