// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'motion/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetImagePrefetch } from '../hooks/useImagePrefetch'
import { manifestSource, NO_IMAGES, setImageSource } from '../services/imageResolver'
import { soloSessionStore } from '../state/soloSessionStore'
import { DeckScreen } from './DeckScreen'
import { MatchScreen } from './MatchScreen'
import { withMotion } from '../testing/withMotion'

// Imagery must never stand between the user and a decision: jsdom never loads images, which is
// exactly the "very slow network" case, and firing `error` covers the failed case.

const requested: string[] = []
const RealImage = globalThis.Image

beforeAll(async () => {
  MotionGlobalConfig.skipAnimations = true
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T19:30:00Z'))
  // Record off-page prefetches instead of fetching.
  globalThis.Image = class {
    decoding = 'auto'
    set src(v: string) {
      requested.push(v)
    }
  } as unknown as typeof Image
  const s = soloSessionStore.getState()
  await s.init()
  // Every archetype image "exists"; no offering has its own photo in the mock catalogue.
  setImageSource(manifestSource([...soloSessionStore.getState().loaded!.archetypes.values()].map((a) => a.image.src)))
})

afterAll(() => {
  globalThis.Image = RealImage
  setImageSource(NO_IMAGES)
})

beforeEach(() => {
  sessionStorage.clear()
  requested.length = 0
  resetImagePrefetch()
  soloSessionStore.getState().reset()
  soloSessionStore.getState().start({ moods: [], intent: 'normal' })
})

afterEach(cleanup)

const renderAt = (path: string) =>
  render(
    withMotion(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/deck" element={<DeckScreen />} />
          <Route path="/match" element={<MatchScreen />} />
        </Routes>
      </MemoryRouter>,
    ),
  )
const topCard = () => document.querySelector<HTMLElement>('.swipe-card:not([inert]) .dish-card')!

describe('imagery never blocks the decision', () => {
  it('swiping works while the top card’s photo is still loading', async () => {
    const user = userEvent.setup()
    renderAt('/deck')
    expect(topCard().querySelector('.dish-media')!.getAttribute('data-state')).toBe('pending')
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    await user.keyboard('{ArrowLeft}')
    expect(soloSessionStore.getState().state!.events).toHaveLength(2)
  })

  it('a failed photo leaves the designed card and swiping carries on', async () => {
    const user = userEvent.setup()
    renderAt('/deck')
    fireEvent.error(topCard().querySelector('img')!)
    expect(topCard().querySelector('.dish-media')!.getAttribute('data-state')).toBe('failed')
    expect(topCard().querySelector('.menu-mark')!.textContent).toBe('1')
    await user.click(screen.getByRole('button', { name: 'Nope' }))
    expect(soloSessionStore.getState().state!.events).toHaveLength(1)
  })

  it('preloads both possible next photos off-page, without showing the next card', async () => {
    renderAt('/deck')
    await waitFor(() => expect(requested.length).toBeGreaterThan(0), { timeout: 2000 })
    const onPage = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(onPage).toHaveLength(1) // only the top card's photo is in the DOM
    expect(requested).not.toContain(onPage[0])
    expect(requested.every((src) => src.startsWith('/images/archetypes/'))).toBe(true)
    expect(document.querySelector('.deck-edge')!.children).toHaveLength(0) // the stack edge stays plain
  })

  it('the Match screen is complete and usable before its photo loads, and labels it illustrative once shown', async () => {
    const user = userEvent.setup()
    for (let i = 0; i < 20 && !soloSessionStore.getState().state!.result; i++)
      soloSessionStore.getState().swipe(i % 3 ? 'no' : 'yes')
    renderAt('/match')
    const hero = document.querySelector<HTMLElement>('.dish-media-hero')!
    expect(hero.getAttribute('data-state')).toBe('pending')
    expect(hero.querySelector('img')!.getAttribute('alt')).toMatch(/Illustrative image, not from /)
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Order' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.load(hero.querySelector('img')!)
    expect(screen.getByText('Illustrative image')).toBeTruthy()
  })
})
