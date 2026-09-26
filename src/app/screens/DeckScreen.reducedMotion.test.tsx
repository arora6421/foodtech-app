// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { soloSessionStore } from '../state/soloSessionStore'
import { DeckScreen } from './DeckScreen'
import { withMotion } from '../testing/withMotion'

// Its own file: Motion reads prefers-reduced-motion once per module instance.
// Animations run for real here (no skipAnimations) so the outgoing card can be inspected.

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    // Motion asks the boolean form, "(prefers-reduced-motion)"; CSS may ask "(prefers-reduced-motion: reduce)".
    matches: query.includes('prefers-reduced-motion') && !query.includes('no-preference'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T19:30:00Z'))
})

beforeEach(async () => {
  sessionStorage.clear()
  const s = soloSessionStore.getState()
  await s.init()
  s.reset()
  s.start({ moods: [], intent: 'normal' })
})

afterEach(cleanup)

describe('DeckScreen with reduced motion', () => {
  it('never tilts or moves the card, and still stamps the verdict in words', async () => {
    const user = userEvent.setup()
    render(
      withMotion(
        <MemoryRouter initialEntries={['/deck']}>
          <Routes>
            <Route path="/deck" element={<DeckScreen />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Nope' }))
    const leaving = document.querySelector<HTMLElement>('.swipe-card[inert]')
    expect(leaving).not.toBeNull()
    expect(leaving!.style.transform).not.toMatch(/rotate|translateX/)
    expect(leaving!.querySelector<HTMLElement>('.stamp-no')!.style.opacity).toBe('1')
    expect(leaving!.querySelector<HTMLElement>('.stamp-yes')!.style.opacity).not.toBe('1')
    await waitFor(() => expect(document.querySelector('.swipe-card[inert]')).toBeNull(), { timeout: 2000 })
  })
})
