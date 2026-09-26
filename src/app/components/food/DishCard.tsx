import { useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { copy } from '../../copy/en-GB'
import type { ResolvedImage } from '../../services/imageResolver'
import type { DishCardModel } from '../../state/viewModels'
import { Chilli } from '../primitives/Icon'
import { DishImage, MenuMark } from './DishImage'

// The swipe card. One layout for every dish, photo or not, so the deck never changes size:
//   header · name (two-line slot) + dish type · FRAME · tags · spice · venue/price · allergens
// Every text row has a fixed height; the frame is the largest box of the chosen shape that fits
// what's left, so it's identical on every card on a given phone and shrinks rather than scrolls
// on short screens. With no photo (or a failed one) the frame shows the no-photo art: the card
// number, menu style. Direction A: paper tinted with the dish's colour, a menu-style price line.
// The article's label describes the dish, so everything visual inside is decorative.

export interface DishCardProps {
  model: DishCardModel
  /** Decorative layers drawn over the card, e.g. the YES/NOPE stamps the swipe gesture drives. */
  overlay?: ReactNode
}

export function DishCard({ model, overlay }: DishCardProps) {
  const hintId = useId()
  const allergenId = useId()
  const [showAllergens, setShowAllergens] = useState(false)
  return (
    <article
      className="dish-card tinted"
      style={{ '--tint': model.tint } as CSSProperties}
      tabIndex={0}
      aria-label={model.a11yLabel}
      aria-describedby={hintId}
    >
      {overlay}
      {/* Read once, as the card's description; aria-hidden so it isn't read again as content. */}
      <span id={hintId} className="sr-only" aria-hidden="true">
        {copy.deck.cardHint}
      </span>
      <div className="card-head" aria-hidden="true">
        <span className="t-label">{model.cuisineLabel}</span>
        {model.cardNumber !== null && <span className="t-label">Card {model.cardNumber}</span>}
      </div>
      <div className="card-title" aria-hidden="true">
        <h2 className="card-name">{model.offeringName}</h2>
        <p className="arch">{model.showArchetype ? model.archetypeName : ' '}</p>
      </div>
      <div className="card-frame-slot">
        <DishImage
          variant="card"
          image={model.image}
          tint={model.tint}
          art={<MenuMark text={model.cardNumber !== null ? String(model.cardNumber) : model.initial} />}
          decorative
          priority
        />
        {showAllergens && (
          <p id={allergenId} className="allergen-panel t-caption">
            {model.allergens.join(', ')}
          </p>
        )}
      </div>
      <div className="card-details">
        <p className="t-label dot-list card-row" aria-hidden="true">
          {model.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </p>
        <div className="spice t-label card-row" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <Chilli key={n} off={n > model.spiceLevel} />
          ))}
          <span style={{ marginLeft: 4 }}>{model.spiceWord}</span>
        </div>
        <div className="foot">
          <div className="price-line flex items-baseline gap-2" aria-hidden="true">
            <span className="t-body card-venue">{model.venueName}</span>
            <span className="leader" />
            <span className="t-price">{model.priceLabel}</span>
          </div>
          {/* Time and distance share their line with the allergen toggle: no extra row. */}
          <div className="card-meta">
            <p className="t-caption dot-list" aria-hidden="true">
              <span>{model.timeLabel}</span>
              <span>{model.distanceLabel}</span>
            </p>
            {model.allergens.length > 0 && (
              <button
                type="button"
                className="t-caption card-allergen-toggle"
                aria-expanded={showAllergens}
                aria-controls={showAllergens ? allergenId : undefined}
                onClick={() => setShowAllergens((v) => !v)}
              >
                {copy.deck.allergens}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

/** A compact tinted tile for lists (Saved, pick list), with a thumbnail that is a photo or the dish's initial. */
export interface TileModel {
  archetypeName: string
  offeringName: string
  venueName: string
  priceLabel: string
  tint: string
  cuisineLabel?: string
  image: ResolvedImage | null
  initial: string
}

export function DishTile({ model, onClick, action }: { model: TileModel; onClick?: () => void; action?: ReactNode }) {
  const body = (
    <>
      {model.cuisineLabel && <span className="t-label muted">{model.cuisineLabel}</span>}
      <span className="t-display-l" style={{ fontSize: 24 }}>
        {model.archetypeName}
      </span>
      <span className="t-caption dot-list">
        {model.offeringName.toLowerCase() !== model.archetypeName.toLowerCase() && <span>{model.offeringName}</span>}
        <span>{model.venueName}</span>
        <span>{model.priceLabel}</span>
      </span>
    </>
  )
  return (
    <div
      className="dish-tile tinted flex items-center gap-3"
      style={{ '--tint': model.tint, borderRadius: 'var(--radius-card)', padding: '12px 14px' } as CSSProperties}
    >
      <DishImage
        variant="thumb"
        image={model.image}
        tint={model.tint}
        art={<MenuMark text={model.initial} />}
        decorative
      />
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex min-h-11 min-w-0 flex-1 flex-col items-start gap-1 text-left [overflow-wrap:anywhere]"
          style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1 [overflow-wrap:anywhere]">{body}</div>
      )}
      {action}
    </div>
  )
}
