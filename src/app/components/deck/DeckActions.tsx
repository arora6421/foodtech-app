import { copy } from '../../copy/en-GB'
import { Icon } from '../primitives/Icon'

// NOPE · That's the one · YES. Each verdict has a word, a glyph and a side, never colour alone.
export function DeckActions({
  onNope,
  onYes,
  onPick,
  disabled = false,
}: {
  onNope: () => void
  onYes: () => void
  onPick: () => void
  disabled?: boolean
}) {
  return (
    <div className="grid items-center gap-2.5" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
      <button type="button" className="vote vote-no" onClick={onNope} disabled={disabled}>
        <Icon name="cross" />
        {copy.deck.nope}
      </button>
      <button type="button" className="btn btn-tertiary" onClick={onPick} disabled={disabled}>
        {copy.deck.theOne}
      </button>
      <button type="button" className="vote vote-yes" onClick={onYes} disabled={disabled}>
        <Icon name="check" />
        {copy.deck.yes}
      </button>
    </div>
  )
}
