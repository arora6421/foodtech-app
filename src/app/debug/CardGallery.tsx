import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { DishCard } from '../components/food/DishCard'
import { soloSessionStore } from '../state/soloSessionStore'
import { dishCard } from '../state/viewModels'
import type { DishCardModel } from '../state/viewModels'

// ?debug=panel … ?debug=cards (dev and review builds only): every dish in the catalogue as a deck
// card, each at exactly the size the real deck gives a card on this screen (?w=&h=, measured by
// scripts/card-layout-audit.mjs from the live deck). The audit checks each one: the name in two
// lines, and no text under the plate or the price sticker.

export function CardGallery() {
  const [cards, setCards] = useState<DishCardModel[] | null>(null)
  const params = new URLSearchParams(location.search)
  const w = Number(params.get('w')) || 358
  const h = Number(params.get('h')) || 620

  useEffect(() => {
    void (async () => {
      const store = soloSessionStore.getState()
      await store.init()
      store.start({ moods: [], intent: 'normal' })
      const { loaded, state } = soloSessionStore.getState()
      if (!loaded || !state) return
      const all = [...loaded.offerings.values()].map((o, i) =>
        dishCard(loaded, state, o.archetypeId, o.id, (i % 15) + 1),
      )
      setCards(all)
    })()
  }, [])

  if (!cards) return <p>Loading every card…</p>
  return (
    <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }} data-gallery-ready="">
      {cards.map((c) => (
        <div
          key={c.key}
          className="gallery-slot"
          data-dish={c.archetypeName}
          data-offering={c.offeringId}
          style={{ position: 'relative', width: w, height: h, flex: 'none' } as CSSProperties}
        >
          <DishCard model={c} />
        </div>
      ))}
    </main>
  )
}
