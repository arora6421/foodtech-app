import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { copy } from '../../copy/en-GB'
import type { ResolvedImage } from '../../services/imageResolver'

// One frame for every dish image. The frame's size comes from its variant (CSS), never from the
// image, so nothing shifts when a photo arrives. The designed no-photo art is always drawn
// underneath: while a photo loads, if it fails, or if there is none, that art is what you see.
// The photo fades in only once it has loaded; a failed photo is dropped, not shown broken.
// A cutout (transparent plate) is shown whole, centred on the tint with a soft shadow, and the art
// fades out as it arrives so nothing shows through the transparency. A photo is cropped to fill.

type Status = 'pending' | 'loaded' | 'failed'

export interface DishImageProps {
  image: ResolvedImage | null
  tint: string
  variant: 'card' | 'hero' | 'thumb' | 'mini' | 'plate'
  /** The no-photo art for this surface (a numeral, a menu initial). */
  art: ReactNode
  /** The surrounding text already names the dish (cards, tiles): hide the image from screen readers. */
  decorative?: boolean
  /** Above the fold and needed now (the top card, the match hero). */
  priority?: boolean
}

export function DishImage({ image, tint, variant, art, decorative = false, priority = false }: DishImageProps) {
  // Status belongs to one src; a new src starts pending again.
  const [loadState, setLoadState] = useState<{ src: string; status: Status } | null>(null)
  const status: Status = image && loadState?.src === image.src ? loadState.status : 'pending'
  const showNote =
    image?.illustrative && status === 'loaded' && (variant === 'card' || variant === 'hero' || variant === 'plate')
  return (
    <div
      className={`dish-media dish-media-${variant}`}
      data-state={image ? status : 'none'}
      data-kind={image ? (image.cutout ? 'cutout' : 'photo') : undefined}
      style={{ '--tint': tint } as CSSProperties}
      aria-hidden={decorative || !image || status === 'failed' ? true : undefined}
    >
      <div className="dish-media-art">{art}</div>
      {image && status !== 'failed' && (
        <img
          src={image.src}
          alt={decorative ? '' : image.alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          draggable={false}
          onLoad={() => setLoadState({ src: image.src, status: 'loaded' })}
          onError={() => setLoadState({ src: image.src, status: 'failed' })}
        />
      )}
      {showNote && <span className="dish-media-note">{copy.imagery.illustrative}</span>}
    </div>
  )
}

/** No-photo art: the dish's initial set large in the display italic, like a menu's drop cap. */
export function MenuMark({ text }: { text: string }) {
  return <span className="menu-mark">{text}</span>
}

/** No-photo plate (Crave): a plate outline with the dish's initial, at the plate's size and position. */
export function PlateArt({ initial }: { initial: string }) {
  return (
    <span className="plate-art">
      <span className="plate-initial">{initial}</span>
    </span>
  )
}
