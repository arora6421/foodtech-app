// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { savedStore } from '../state/savedStore'
import { SavedDetailScreen, SavedScreen } from './SavedScreen'

// S7 "Back issues": mini covers numbered in the order they were saved, removable, and each opening
// its own cover.

const dish = (n: number) => ({
  archetypeId: `dish-${n}`,
  offeringId: `offer-${n}`,
  archetypeName: `Dish ${n}`,
  offeringName: `Dish ${n}`,
  venueName: `Venue ${n}`,
  priceLabel: `£1${n}.00`,
  tint: '#c8894a',
})

function renderSaved(path = '/saved') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/saved" element={<SavedScreen />} />
        <Route path="/saved/:id" element={<SavedDetailScreen />} />
        <Route path="/craving" element={<p>craving screen</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  for (const i of savedStore.getState().items) savedStore.getState().remove(i.id)
})
afterEach(cleanup)

describe('Saved: Back issues', () => {
  it('shows an empty state with a way to find a dish', async () => {
    renderSaved()
    expect(screen.getByRole('heading', { level: 1, name: 'Back issues' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Find tonight’s dish' }))
    expect(screen.getByText('craving screen')).toBeTruthy()
  })

  it('numbers issues in the order they were saved, newest first, and renumbers after a removal', async () => {
    savedStore.getState().save(dish(1), new Date('2026-09-20T19:00:00Z'))
    savedStore.getState().save(dish(2), new Date('2026-09-22T19:00:00Z'))
    savedStore.getState().save(dish(3), new Date('2026-09-24T19:00:00Z'))
    renderSaved()
    const kickers = () => [...document.querySelectorAll('.issue-kicker')].map((k) => k.textContent)
    expect(kickers()).toEqual(['No. 03 · 24 Sept', 'No. 02 · 22 Sept', 'No. 01 · 20 Sept'])
    expect(document.querySelector('.issue-meta')!.textContent).toBe('£13.00')

    await userEvent.click(screen.getByRole('button', { name: 'Remove Dish 1' }))
    expect(kickers()).toEqual(['No. 02 · 24 Sept', 'No. 01 · 22 Sept'])
  })

  it('opens a saved dish as its own cover, where it can be removed', async () => {
    savedStore.getState().save({ ...dish(4), offeringName: 'House special' }, new Date('2026-09-24T19:00:00Z'))
    renderSaved()
    await userEvent.click(screen.getByRole('button', { name: 'No. 01 · 24 Sept, Dish 4, £14.00' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Dish 4' })).toBeTruthy()
    expect(screen.getByText(/House special · Venue 4 · £14\.00/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(savedStore.getState().items).toEqual([])
    expect(screen.getByRole('heading', { level: 1, name: 'Back issues' })).toBeTruthy()
  })

  it('says so when a saved dish is no longer there', () => {
    renderSaved('/saved/missing')
    expect(screen.getByText('That saved dish is no longer here.')).toBeTruthy()
  })
})
