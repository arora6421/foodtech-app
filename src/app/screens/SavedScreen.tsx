import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { copy, PRODUCT_NAME } from '../copy/en-GB'
import { DishImage, PlateArt } from '../components/food/DishImage'
import { IssueTile } from '../components/food/IssueTile'
import { Icon } from '../components/primitives/Icon'
import { coverFor } from '../design/covers'
import { nameTier } from '../design/nameFit'
import { useSaved } from '../state/savedStore'
import { useSolo } from '../state/soloSessionStore'
import { savedDishArt } from '../state/viewModels'

// S7 Saved as "Back issues" ("Crave", mockup 07): each saved dish is a mini cover in its own
// colour, numbered in the order it was saved, with its date. Kept on this device. Images are
// resolved afresh from the catalogue, so saves made before photos existed get them too.

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function ContentsBar({ onBack, kicker }: { onBack: () => void; kicker: string }) {
  return (
    <div className="contents-bar">
      <button type="button" className="icon-btn" aria-label={copy.saved.back} onClick={onBack}>
        <Icon name="back" />
      </button>
      <span className="t-kicker" aria-hidden="true">
        {kicker}
      </span>
      <span className="contents-bar-spacer" />
    </div>
  )
}

function EmptyState({ text, action }: { text: string; action: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-plate" aria-hidden="true">
        <PlateArt initial="" />
      </span>
      <p className="empty-text">{text}</p>
      {action}
    </div>
  )
}

export function SavedScreen() {
  const navigate = useNavigate()
  const items = useSaved((s) => s.items)
  const remove = useSaved((s) => s.remove)
  const loaded = useSolo((s) => s.loaded)
  // Numbered in the order they were saved: the oldest is No. 01.
  const byAge = [...items].sort((a, b) => a.savedAt.localeCompare(b.savedAt)).map((i) => i.id)
  return (
    <main className="screen contents-page">
      <ContentsBar onBack={() => navigate('/')} kicker={copy.saved.kicker} />
      <h1 className="contents-title">{copy.saved.title}</h1>
      <p className="contents-sub">{copy.saved.body}</p>
      {items.length === 0 ? (
        <EmptyState
          text={copy.saved.empty}
          action={
            <button type="button" className="btn-cover-primary" onClick={() => navigate('/craving')}>
              {copy.saved.emptyAction}
            </button>
          }
        />
      ) : (
        <ul className="issue-grid">
          {items.map((i) => {
            const kicker = copy.saved.issue(byAge.indexOf(i.id) + 1, date(i.savedAt))
            return (
              <li key={i.id}>
                <IssueTile
                  model={{ ...i, ...savedDishArt(loaded, i.archetypeId, i.offeringId, i.archetypeName) }}
                  kicker={kicker}
                  meta={i.priceLabel}
                  onOpen={() => navigate(`/saved/${encodeURIComponent(i.id)}`)}
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
            )
          })}
        </ul>
      )}
    </main>
  )
}

/** A saved dish as its own cover, in the Match cover's style. */
export function SavedDetailScreen() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const item = useSaved((s) => s.items.find((i) => i.id === id))
  const remove = useSaved((s) => s.remove)
  const loaded = useSolo((s) => s.loaded)
  if (!item)
    return (
      <main className="screen contents-page">
        <ContentsBar onBack={() => navigate('/saved')} kicker={copy.saved.kicker} />
        <EmptyState
          text={copy.saved.missing}
          action={
            <button type="button" className="btn-cover-primary" onClick={() => navigate('/saved')}>
              {copy.saved.title}
            </button>
          }
        />
      </main>
    )
  const art = savedDishArt(loaded, item.archetypeId, item.offeringId, item.archetypeName)
  const sameName = item.offeringName.toLowerCase() === item.archetypeName.toLowerCase()
  return (
    <main className="screen match-cover saved-cover cover" style={{ '--cover': coverFor(item.tint) } as CSSProperties}>
      <div className="cover-bar">
        <button type="button" className="icon-btn" aria-label={copy.saved.back} onClick={() => navigate('/saved')}>
          <Icon name="back" />
        </button>
        <span className="masthead" aria-hidden="true">
          {PRODUCT_NAME}
        </span>
        <span className="contents-bar-spacer" />
      </div>
      <div className="cover-rule" />
      <p className="match-kicker">{copy.saved.savedOn(date(item.savedAt))}</p>
      <h1 className={`match-dish name-${nameTier(item.archetypeName)}`}>{item.archetypeName}</h1>
      <p className="match-sub">
        {sameName ? '' : `${item.offeringName} · `}
        {item.venueName} · {item.priceLabel}
      </p>
      <div className="match-plate">
        <DishImage
          variant="plate"
          image={art.image}
          tint={item.tint}
          art={<PlateArt initial={art.initial} />}
          priority
        />
      </div>
      <div className="cover-actions">
        <button
          type="button"
          className="btn-cover"
          onClick={() => {
            remove(item.id)
            navigate('/saved')
          }}
        >
          {copy.saved.remove}
        </button>
      </div>
    </main>
  )
}
