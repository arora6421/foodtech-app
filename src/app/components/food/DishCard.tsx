import { useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { copy } from '../../copy/en-GB'
import { coverFor } from '../../design/covers'
import { nameTier } from '../../design/nameFit'
import type { ResolvedImage } from '../../services/imageResolver'
import type { DishCardModel } from '../../state/viewModels'
import { DishImage, MenuMark, PlateArt } from './DishImage'

// The swipe card, as a magazine cover ("Crave", docs/design/crave-design-handoff/03 and 04).
//   kind + card number · rule · the dish name (two lines at most) ·
//   "Inside" (up to three key ingredients) beside the plate · the price sticker ·
//   tags · rule · venue and distance · listed allergens
// One layout for every dish, photo or not: every text zone has a fixed size, and the plate sits at
// the same position and size on every card on a given phone, bleeding off the right edge and never
// over any text (checked for every dish by scripts/card-layout-audit.mjs). Without a photo (or if it
// fails) the plate is drawn as an outline with the dish's initial. The article's label describes the
// dish, so everything visual inside is decorative.

export interface DishCardProps {
  model: DishCardModel
  /** Decorative layers drawn over the card, e.g. the YES/NOPE stamps the swipe gesture drives. */
  overlay?: ReactNode
}

const cardNo = (n: number) => String(n).padStart(2, '0')

export function DishCard({ model, overlay }: DishCardProps) {
  const hintId = useId()
  const allergenId = useId()
  const [showAllergens, setShowAllergens] = useState(false)
  return (
    <article
      className="dish-card cover"
      style={{ '--cover': coverFor(model.tint) } as CSSProperties}
      tabIndex={0}
      aria-label={model.a11yLabel}
      aria-describedby={hintId}
    >
      {overlay}
      {/* Read once, as the card's description; aria-hidden so it isn't read again as content. */}
      <span id={hintId} className="sr-only" aria-hidden="true">
        {copy.deck.cardHint}
      </span>
      <div className="card-top" aria-hidden="true">
        <span className="card-kind">{model.kind}</span>
        {model.cardNumber !== null && <span className="card-no">{cardNo(model.cardNumber)}</span>}
      </div>
      <div className="card-name-zone" aria-hidden="true">
        <h2 className={`card-name name-${nameTier(model.archetypeName)}`}>{model.archetypeName}</h2>
      </div>
      <div className="card-middle">
        <div className="card-inside" aria-hidden="true">
          <span className="t-kicker">{copy.deck.inside}</span>
          <ul>
            {model.inside.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
        <div className="card-plate">
          <DishImage
            variant="plate"
            image={model.image}
            tint={model.tint}
            art={<PlateArt initial={model.initial} />}
            decorative
            priority
          />
        </div>
        <div className="price-sticker" aria-hidden="true">
          {model.priceLabel}
        </div>
        {showAllergens && (
          <p id={allergenId} className="allergen-panel">
            {model.allergens.join(', ')}
          </p>
        )}
      </div>
      <div className="card-bottom">
        <p className="card-pills" aria-hidden="true">
          {[...model.tags, model.spiceTag].map((t) => (
            <span key={t} className="pill">
              {t}
            </span>
          ))}
        </p>
        <div className="card-where" aria-hidden="true">
          <span className="card-venue">{model.venueName}</span>
          <span className="card-distance">
            {model.distanceLabel} · {model.timeLabel}
          </span>
        </div>
        <div className="card-allergens">
          {model.allergens.length > 0 && (
            <button
              type="button"
              className="card-allergen-toggle"
              aria-expanded={showAllergens}
              aria-controls={showAllergens ? allergenId : undefined}
              onClick={() => setShowAllergens((v) => !v)}
            >
              {copy.deck.allergens}
            </button>
          )}
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
