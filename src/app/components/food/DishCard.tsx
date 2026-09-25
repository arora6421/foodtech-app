import { useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { copy } from '../../copy/en-GB'
import type { DishCardModel } from '../../state/viewModels'
import { Chilli } from '../primitives/Icon'

// The no-photo typographic card (M1 ships without dish photos; an image slot can be added later
// without changing this card's structure). Direction A: paper tinted with the dish's colour,
// a faint italic card number, a menu-style price line.

export interface DishCardProps {
  model: DishCardModel
  /** Decorative layers drawn over the card, e.g. the YES/NOPE stamps the swipe gesture drives. */
  overlay?: ReactNode
}

export function DishCard({ model, overlay }: DishCardProps) {
  const hintId = useId()
  const [showAllergens, setShowAllergens] = useState(false)
  return (
    <article
      className="dish-card tinted"
      style={{ '--tint': model.tint } as CSSProperties}
      tabIndex={0}
      aria-label={model.a11yLabel}
      aria-describedby={hintId}
    >
      {model.cardNumber !== null && (
        <span className="big-num" aria-hidden="true">
          {model.cardNumber}
        </span>
      )}
      {overlay}
      <span id={hintId} className="sr-only">
        {copy.deck.cardHint}
      </span>
      <div className="flex justify-between" aria-hidden="true">
        <span className="t-label">{model.cuisineLabel}</span>
        {model.cardNumber !== null && <span className="t-label">Card {model.cardNumber}</span>}
      </div>
      <h2 className="t-display-l" style={{ marginTop: 'auto', marginBottom: 4 }}>
        {model.offeringName}
      </h2>
      <div aria-hidden="true">
        {model.showArchetype && <p className="arch">{model.archetypeName}</p>}
        <p className="t-label dot-list" style={{ margin: '0 0 12px' }}>
          {model.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </p>
        <div className="spice t-label" style={{ marginBottom: 12 }}>
          {[1, 2, 3, 4].map((n) => (
            <Chilli key={n} off={n > model.spiceLevel} />
          ))}
          <span style={{ marginLeft: 4 }}>{model.spiceWord}</span>
        </div>
        <div className="foot">
          <div className="flex items-baseline gap-2">
            <span className="t-body">{model.venueName}</span>
            <span className="leader" />
            <span className="t-price">{model.priceLabel}</span>
          </div>
          <p className="t-caption dot-list" style={{ margin: '4px 0 0' }}>
            <span>{model.timeLabel}</span>
            <span>{model.distanceLabel}</span>
          </p>
        </div>
      </div>
      {model.allergens.length > 0 && (
        <div style={{ margin: '-4px 0 -12px' }}>
          <button
            type="button"
            className="t-caption"
            style={{
              minHeight: 44,
              background: 'none',
              border: 0,
              padding: 0,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
            aria-expanded={showAllergens}
            onClick={() => setShowAllergens((v) => !v)}
          >
            {copy.deck.allergens}
          </button>
          {showAllergens && (
            <p className="t-caption" style={{ margin: 0 }}>
              {model.allergens.join(', ')}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

/** A compact tinted tile for lists (Saved, pick list). */
export interface TileModel {
  archetypeName: string
  offeringName: string
  venueName: string
  priceLabel: string
  tint: string
  cuisineLabel?: string
}

export function DishTile({ model, onClick, action }: { model: TileModel; onClick?: () => void; action?: ReactNode }) {
  const body = (
    <>
      {model.cuisineLabel && <span className="t-label muted">{model.cuisineLabel}</span>}
      <span className="t-display-l" style={{ fontSize: 24 }}>
        {model.archetypeName}
      </span>
      <span className="t-caption">
        {model.offeringName} · {model.venueName} · {model.priceLabel}
      </span>
    </>
  )
  return (
    <div
      className="tinted flex items-center gap-3"
      style={{ '--tint': model.tint, borderRadius: 'var(--radius-card)', padding: '12px 14px' } as CSSProperties}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex min-h-11 flex-1 flex-col items-start gap-1 text-left"
          style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}
        >
          {body}
        </button>
      ) : (
        <div className="flex flex-1 flex-col gap-1">{body}</div>
      )}
      {action}
    </div>
  )
}
