import { useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { copy } from '../../copy/en-GB'
import { coverFor } from '../../design/covers'
import { nameTier } from '../../design/nameFit'
import type { DishCardModel } from '../../state/viewModels'
import { DishImage, PlateArt } from './DishImage'

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
