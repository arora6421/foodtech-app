import { copy } from '../../copy/en-GB'

// NOPE (outlined) and YES (filled ink): each verdict is a word on its own side, never colour alone.
// Under them, "That's the one" and "Decide for me".
export function DeckActions({
  onNope,
  onYes,
  onPick,
  onDecide,
  disabled = false,
}: {
  onNope: () => void
  onYes: () => void
  onPick: () => void
  onDecide: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="deck-votes">
        <button type="button" className="vote vote-no" onClick={onNope} disabled={disabled}>
          {copy.deck.nope}
        </button>
        <button type="button" className="vote vote-yes" onClick={onYes} disabled={disabled}>
          {copy.deck.yes}
        </button>
      </div>
      <div className="deck-links">
        <button type="button" className="link-btn" onClick={onPick} disabled={disabled}>
          {copy.deck.theOne}
        </button>
        <button type="button" className="link-btn" onClick={onDecide} disabled={disabled}>
          {copy.deck.decide}
        </button>
      </div>
    </div>
  )
}
