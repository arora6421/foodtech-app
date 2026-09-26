import { copy, PRODUCT_NAME } from '../../copy/en-GB'
import type { CounterModel } from '../../state/viewModels'
import { Icon } from '../primitives/Icon'

// Close · the masthead (with the narrowing counter under it) · Undo.
export function DeckTopBar({
  counter,
  canUndo,
  onUndo,
  onClose,
}: {
  counter: CounterModel
  canUndo: boolean
  onUndo: () => void
  onClose: () => void
}) {
  return (
    <div className="deck-bar">
      <button type="button" className="icon-btn" aria-label={copy.deck.close} onClick={onClose}>
        <Icon name="close" />
      </button>
      <div>
        <div className="masthead" aria-hidden="true">
          {PRODUCT_NAME}
        </div>
        <span className="deck-count">
          <span className="sr-only">
            {counter.likely} of {counter.total} dishes left
          </span>
          <span aria-hidden="true">
            {counter.likely} {copy.deck.left}
          </span>
        </span>
      </div>
      <button type="button" className="icon-btn" aria-label={copy.deck.undo} onClick={onUndo} disabled={!canUndo}>
        <Icon name="undo" />
      </button>
    </div>
  )
}
