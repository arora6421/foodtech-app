import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router'
import { copy } from '../copy/en-GB'
import { DishTile } from '../components/food/DishCard'
import { DishImage, MenuMark } from '../components/food/DishImage'
import { Icon } from '../components/primitives/Icon'
import { useSaved } from '../state/savedStore'
import { useSolo } from '../state/soloSessionStore'
import { savedDishArt } from '../state/viewModels'

// S7 Saved (MVP_SPEC §4): a list kept on this device, and each saved dish as the ticket you kept.
// Images are resolved afresh from the catalogue, so saves made before photos existed get them too.

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export function SavedScreen() {
  const navigate = useNavigate()
  const items = useSaved((s) => s.items)
  const remove = useSaved((s) => s.remove)
  const loaded = useSolo((s) => s.loaded)
  return (
    <main className="screen">
      <div className="flex min-h-11 items-center">
        <button type="button" className="icon-btn t-label" onClick={() => navigate('/')}>
          <Icon name="back" />
          {copy.saved.back}
        </button>
      </div>
      <h1 className="t-title" style={{ margin: '10px 0 14px' }}>
        {copy.saved.title}
      </h1>
      {items.length === 0 ? (
        <p className="t-body muted">{copy.saved.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((i) => (
            <li key={i.id}>
              <DishTile
                model={{ ...i, ...savedDishArt(loaded, i.archetypeId, i.offeringId, i.archetypeName) }}
                onClick={() => navigate(`/saved/${encodeURIComponent(i.id)}`)}
                action={
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${copy.saved.remove} ${i.archetypeName}`}
                    onClick={() => remove(i.id)}
                  >
                    <Icon name="close" />
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export function SavedDetailScreen() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const item = useSaved((s) => s.items.find((i) => i.id === id))
  const remove = useSaved((s) => s.remove)
  const loaded = useSolo((s) => s.loaded)
  const art = item ? savedDishArt(loaded, item.archetypeId, item.offeringId, item.archetypeName) : null
  return (
    <main className="screen">
      <div className="flex min-h-11 items-center">
        <button type="button" className="icon-btn t-label" onClick={() => navigate('/saved')}>
          <Icon name="back" />
          {copy.saved.back}
        </button>
      </div>
      {item && art ? (
        <>
          <section className="receipt" aria-labelledby="saved-dish" style={{ marginTop: 14 }}>
            {art.image && (
              <DishImage
                variant="hero"
                image={art.image}
                tint={item.tint}
                art={<MenuMark text={art.initial} />}
                priority
              />
            )}
            <div className="receipt-plate tinted" style={{ '--tint': item.tint } as CSSProperties}>
              <p className="t-caption" style={{ margin: 0 }}>
                {copy.saved.savedOn(date(item.savedAt))}
              </p>
              <h1 id="saved-dish" className="t-display-xl" style={{ margin: '14px 0 0' }}>
                {item.archetypeName}
              </h1>
            </div>
            <div className="price-line flex items-baseline gap-2">
              <span className="t-body dot-list">
                {item.offeringName.toLowerCase() !== item.archetypeName.toLowerCase() && (
                  <span>{item.offeringName}</span>
                )}
                <span>{item.venueName}</span>
              </span>
              <span className="leader" />
              <span className="t-price">{item.priceLabel}</span>
            </div>
          </section>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 'auto' }}
            onClick={() => {
              remove(item.id)
              navigate('/saved')
            }}
          >
            {copy.saved.remove}
          </button>
        </>
      ) : (
        <p className="t-body muted">{copy.saved.missing}</p>
      )}
    </main>
  )
}
