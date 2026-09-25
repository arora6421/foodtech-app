import { useNavigate, useParams } from 'react-router'
import { copy } from '../copy/en-GB'
import { DishTile } from '../components/food/DishCard'
import { Icon } from '../components/primitives/Icon'
import { useSaved } from '../state/savedStore'

// S7 Saved (MVP_SPEC §4): a list kept on this device, with a simple detail view.

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export function SavedScreen() {
  const navigate = useNavigate()
  const items = useSaved((s) => s.items)
  const remove = useSaved((s) => s.remove)
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
                model={i}
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
  return (
    <main className="screen">
      <div className="flex min-h-11 items-center">
        <button type="button" className="icon-btn t-label" onClick={() => navigate('/saved')}>
          <Icon name="back" />
          {copy.saved.back}
        </button>
      </div>
      {item ? (
        <>
          <h1 className="t-display-xl" style={{ margin: '14px 0 8px' }}>
            {item.archetypeName}
          </h1>
          <p className="t-body" style={{ margin: 0 }}>
            {item.offeringName.toLowerCase() === item.archetypeName.toLowerCase()
              ? item.venueName
              : `${item.offeringName} · ${item.venueName}`}
          </p>
          <p className="t-price" style={{ margin: '8px 0 4px' }}>
            {item.priceLabel}
          </p>
          <p className="t-caption">{copy.saved.savedOn(date(item.savedAt))}</p>
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
