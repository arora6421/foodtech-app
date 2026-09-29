// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FILTERS_TOO_TIGHT } from '../services/engineAdapter'
import { settingsStore } from '../state/settingsStore'
import type { Settings } from '../state/settingsStore'
import { soloSessionStore } from '../state/soloSessionStore'
import { CravingScreen } from './CravingScreen'

// The "fewer than 8 dishes" notice offers the budget one step up, only when that adds dishes, only
// when tapped, and never pads the deck: the count it shows is the count the deck will draw from.

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T19:30:00Z'))
})
beforeEach(async () => {
  sessionStorage.clear()
  localStorage.clear()
  await soloSessionStore.getState().init()
  soloSessionStore.getState().reset()
})
afterEach(cleanup)

const set = (s: Settings) => act(() => settingsStore.setState(s))
const renderCraving = () =>
  render(
    <MemoryRouter initialEntries={['/craving']}>
      <Routes>
        <Route path="/craving" element={<CravingScreen />} />
        <Route path="/deck" element={<p>deck</p>} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
const raiseButton = () => screen.queryByRole('button', { name: /^Raise budget/ })
const count = () => soloSessionStore.getState().eligibleCount({ moods: [], intent: 'normal' })!

describe('the "raise budget" button', () => {
  it('appears on the "fewer than 8" notice, names the next budget and what it adds, and does nothing until tapped', async () => {
    set({ diet: ['vegan'], budget: 'low', fulfilment: 'go_out' })
    renderCraving()
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
    const tight = count()
    expect(tight).toBeLessThan(FILTERS_TOO_TIGHT)
    const button = raiseButton()!
    expect(button.textContent).toMatch(/Raise budget: Up to £16 \(\d+ dishes\)/)
    expect(settingsStore.getState().budget).toBe('low') // shown, not applied
  })

  it('one tap raises the budget by one step and the count grows to what the button promised', async () => {
    const user = userEvent.setup()
    set({ diet: ['vegan'], budget: 'low', fulfilment: 'go_out' })
    renderCraving()
    const before = count()
    const promised = Number(raiseButton()!.textContent!.match(/\((\d+) dish/)![1])
    await user.click(raiseButton()!)
    expect(settingsStore.getState().budget).toBe('mid')
    expect(count()).toBe(promised)
    expect(promised).toBeGreaterThan(before)
  })

  it('appears when the pool is tight, and is absent when the pool is fine, when budget is Any, or when raising would add nothing', async () => {
    set({ diet: ['vegan'], budget: 'low', fulfilment: 'go_out' })
    renderCraving()
    expect(raiseButton()).not.toBeNull()
    cleanup()

    set({ diet: [], budget: 'low', fulfilment: 'either' }) // 17 dishes: not tight
    renderCraving()
    expect(raiseButton()).toBeNull()
    cleanup()

    set({ diet: ['vegan', 'gluten_free'], budget: 'any', fulfilment: 'go_out' }) // tight, but nothing to raise
    renderCraving()
    expect(raiseButton()).toBeNull()
    cleanup()

    set({ diet: ['vegan', 'gluten_free', 'pescatarian'], budget: 'high', fulfilment: 'go_out' }) // £££ → Any adds nothing (dearest dish is £24)
    renderCraving()
    expect(raiseButton()).toBeNull()
  })

  it('never starts a deck that pads: Start with a tight budget draws only from the shown count', async () => {
    const user = userEvent.setup()
    set({ diet: ['vegan'], budget: 'low', fulfilment: 'go_out' })
    renderCraving()
    await user.click(screen.getByRole('button', { name: 'Start swiping' }))
    const s = soloSessionStore.getState().state!
    expect(s.model.pool.archetypeIds.length).toBe(count())
    expect(s.model.pool.candidates.every((c) => c.offering.pricePence <= 1000)).toBe(true)
  })
})

describe('the Budget sheet', () => {
  it('states the rule: only dishes at or under the limit', async () => {
    const user = userEvent.setup()
    set({ diet: [], budget: 'low', fulfilment: 'either' })
    renderCraving()
    await user.click(screen.getByRole('button', { name: /^Budget: Up to £10/ }))
    expect(await screen.findByText('We only show dishes priced at or under your limit.')).toBeTruthy()
  })
})
