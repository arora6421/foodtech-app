import { copy, PRODUCT_NAME } from '../../copy/en-GB'
import type { ProgressModel } from '../../state/viewModels'
import { Icon } from '../primitives/Icon'

// Close · the masthead (with progress towards the decision under it: "Card 4 · a few more") · Undo.
export function DeckTopBar({
  progress,
  canUndo,
  onUndo,
  onClose,
}: {
  progress: ProgressModel
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
          {copy.deck.card(progress.card)} · {copy.deck.progress[progress.stage]}
        </span>
      </div>
      <button type="button" className="icon-btn" aria-label={copy.deck.undo} onClick={onUndo} disabled={!canUndo}>
        <Icon name="undo" />
      </button>
    </div>
  )
}
