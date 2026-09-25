// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'motion/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { dragVerdict } from '../components/deck/SwipeDeck'
import { soloSessionStore } from '../state/soloSessionStore'
import { DeckScreen } from './DeckScreen'

// Motion's timing is covered by the browser pass; here every animation completes at once so the
// tests pin behaviour: what commits, what the engine receives, where focus and navigation go.

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T19:30:00Z')) // venues open, so the pool is never empty
})

beforeEach(async () => {
  sessionStorage.clear()
  const s = soloSessionStore.getState()
  await s.init()
  s.reset()
  expect(s.start({ moods: [], intent: 'normal' })).toBe(true)
})

afterEach(cleanup)

const events = () => soloSessionStore.getState().state!.events
const topCard = () => document.querySelector<HTMLElement>('.swipe-card:not([inert]) .dish-card')!
const topName = () => topCard().querySelector('h2')!.textContent

function renderDeck() {
  return render(
    <MemoryRouter initialEntries={['/deck']}>
      <Routes>
        <Route path="/deck" element={<DeckScreen />} />
        <Route path="/match" element={<p>match screen</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('dragVerdict', () => {
  it('commits past 30% of the width, either way', () => {
    expect(dragVerdict(100, 0, 300)).toBe('yes')
    expect(dragVerdict(-100, 0, 300)).toBe('no')
    expect(dragVerdict(80, 0, 300)).toBeNull()
  })

  it('commits a short fast fling only in the direction it was dragged', () => {
    expect(dragVerdict(30, 900, 300)).toBe('yes')
    expect(dragVerdict(-30, -900, 300)).toBe('no')
    expect(dragVerdict(30, -900, 300)).toBeNull() // flicked back towards the centre
    expect(dragVerdict(0, 900, 300)).toBeNull()
  })
})

describe('DeckScreen', () => {
  it('YES and NOPE buttons send the verdict and bring up the next card', async () => {
    const user = userEvent.setup()
    renderDeck()
    const first = topName()
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    expect(events().at(-1)).toMatchObject({ type: 'swipe', verdict: 'yes' })
    await waitFor(() => expect(topName()).not.toBe(first))
    await user.click(screen.getByRole('button', { name: 'Nope' }))
    expect(events().at(-1)).toMatchObject({ type: 'swipe', verdict: 'no' })
  })

  it('never makes a quick swiper wait for an animation', async () => {
    const user = userEvent.setup()
    renderDeck()
    await user.click(screen.getByRole('button', { name: 'Nope' }))
    await user.click(screen.getByRole('button', { name: 'Nope' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    expect(events()).toHaveLength(3)
  })

  it('arrow keys swipe, Backspace undoes back to the same card', async () => {
    const user = userEvent.setup()
    renderDeck()
    const first = topName()
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(topName()).not.toBe(first))
    await user.keyboard('{Backspace}')
    expect(events()).toHaveLength(0)
    await waitFor(() => expect(topName()).toBe(first))
  })

  it('keeps keyboard focus on the top card after a verdict', async () => {
    const user = userEvent.setup()
    renderDeck()
    topCard().focus()
    await user.keyboard('{ArrowLeft}')
    await waitFor(() => expect(document.activeElement).toBe(topCard()))
  })

  it('announces the new card to screen readers', async () => {
    const user = userEvent.setup()
    renderDeck()
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')!.textContent).toMatch(/^Card 2\. /))
  })

  it('shows verdicts in words, not colour alone', () => {
    renderDeck()
    const stamps = [...topCard().querySelectorAll('.stamp')].map((s) => s.textContent)
    expect(stamps).toEqual(['Yes', 'Nope'])
  })

  it('Enter on the card picks it and goes to the match', async () => {
    const user = userEvent.setup()
    renderDeck()
    topCard().focus()
    await user.keyboard('{Enter}')
    expect(soloSessionStore.getState().state!.result?.stopReason).toBe('user_picked')
    expect(await screen.findByText('match screen')).toBeTruthy()
  })

  it('reaches the match after the last card has flown', async () => {
    renderDeck()
    for (let i = 0; i < 20 && !soloSessionStore.getState().state!.result; i++) {
      act(() => screen.getByRole('button', { name: i % 2 ? 'Nope' : 'Yes' }).click())
    }
    expect(soloSessionStore.getState().state!.result).not.toBeNull()
    expect(await screen.findByText('match screen')).toBeTruthy()
  })
})
