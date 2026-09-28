import type { CSSProperties, ReactNode } from 'react'
import { coverFor } from '../../design/covers'
import { nameTier } from '../../design/nameFit'
import type { ResolvedImage } from '../../services/imageResolver'
import { DishImage, PlateArt } from './DishImage'

// A mini cover ("Crave", mockup 07): a small kicker line, the dish name, a meta line (the price) at
// the bottom, and the plate bleeding off the bottom-right corner, all on the dish's cover colour.
// Used for Saved ("Back issues") and the Match pick list. The name is sized like the swipe card's
// (two lines at most), and the tile grows rather than let the plate cover text. The whole tile
// opens the dish; an optional action (Remove) sits in the top-right corner.

export interface IssueTileModel {
  archetypeName: string
  tint: string
  image: ResolvedImage | null
  initial: string
}

export function IssueTile({
  model,
  kicker,
  detail,
  meta,
  onOpen,
  action,
}: {
  model: IssueTileModel
  kicker: string
  /** A small line under the name (the venue, in the pick list). */
  detail?: string
  /** At the foot of the tile: the price. */
  meta: string
  onOpen: () => void
  action?: ReactNode
}) {
  return (
    <div
      className={action ? 'issue-tile cover has-action' : 'issue-tile cover'}
      style={{ '--cover': coverFor(model.tint) } as CSSProperties}
    >
      <button
        type="button"
        className="issue-open"
        onClick={onOpen}
        // Its text in reading order, with pauses (the spans would otherwise run together).
        aria-label={[kicker, model.archetypeName, detail, meta].filter(Boolean).join(', ')}
      >
        <span className="issue-kicker">{kicker}</span>
        <span className={`issue-name name-${nameTier(model.archetypeName)}`}>{model.archetypeName}</span>
        {detail && <span className="issue-detail">{detail}</span>}
        <span className="issue-meta">{meta}</span>
        <span className="issue-plate" aria-hidden="true">
          <DishImage
            variant="plate"
            image={model.image}
            tint={model.tint}
            art={<PlateArt initial={model.initial} />}
            decorative
            note={false}
          />
        </span>
      </button>
      {action && <span className="issue-action">{action}</span>}
    </div>
  )
}
