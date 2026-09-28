// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'motion/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { savedStore } from '../state/savedStore'
import { soloSessionStore } from '../state/soloSessionStore'
import { matchModel } from '../state/viewModels'
import { MatchScreen } from './MatchScreen'
import { withMotion } from '../testing/withMotion'

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T19:30:00Z'))
})

async function finishSession(pattern: (i: number) => 'yes' | 'no' = (i) => (i % 3 === 0 ? 'yes' : 'no')) {
  const s = soloSessionStore.getState()
  await s.init()
  s.reset()
  s.start({ moods: ['comforting'], intent: 'normal' })
  for (let i = 0; i < 20 && !soloSessionStore.getState().state!.result; i++)
    soloSessionStore.getState().swipe(pattern(i))
}

beforeEach(async () => {
  sessionStorage.clear()
  localStorage.clear()
  for (const i of savedStore.getState().items) savedStore.getState().remove(i.id)
  await finishSession()
})

afterEach(cleanup)

const model = () => {
  const { loaded, state, view } = soloSessionStore.getState()
  return matchModel(loaded!, state!, view)!
}

function renderMatch() {
  return render(
    withMotion(
      <MemoryRouter initialEntries={['/match']}>
        <Routes>
          <Route path="/match" element={<MatchScreen />} />
          <Route path="/deck" element={<p>deck screen</p>} />
          <Route path="/craving" element={<p>craving screen</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  )
}

describe('MatchScreen', () => {
  it('shows the engine hero with exactly the engine’s reasons, nothing added', () => {
    renderMatch()
    const m = model()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(m.hero.archetypeName)
    const shown = [...document.querySelectorAll('.match-reasons .reason-text')].map((li) => li.textContent)
    expect(shown).toEqual(m.reasons.map((r) => r.text))
    expect(screen.getByText(m.confidenceLabel)).toBeTruthy()
  })

  it('moves focus to the heading on arrival', () => {
    renderMatch()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
  })

  it('inspects an alternative without offering “Show me something else”, then chooses or returns', async () => {
    const user = userEvent.setup()
    renderMatch()
    const hero = model().hero.archetypeName
    const engine = soloSessionStore.getState().state!
    const tile = document.querySelector<HTMLButtonElement>('.or-try-tile')
    expect(tile).not.toBeNull()
    await user.click(tile!)

    expect(screen.getByText('Alternative')).toBeTruthy()
    expect(screen.getByText('Why it could suit you')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose this instead' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show me something else' })).toBeNull()
    // Inspection is UI-only: the engine state (result and event log) is the very same object.
    expect(soloSessionStore.getState().state).toBe(engine)

    await user.click(screen.getByRole('button', { name: 'Choose this instead' }))
    expect(soloSessionStore.getState().state).toBe(engine)
    expect(screen.getByRole('button', { name: 'Order' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show me something else' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Return to our match' }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(hero)
    expect(screen.getByRole('button', { name: 'Show me something else' })).toBeTruthy()
  })

  it('Save is a stable-label toggle', async () => {
    const user = userEvent.setup()
    renderMatch()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save.getAttribute('aria-pressed')).toBe('false')
    await user.click(save)
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('aria-pressed')).toBe('true')
    expect(savedStore.getState().items).toHaveLength(1)
  })

  it('opens the Order hand-off for the hero’s venue and returns focus on Escape', async () => {
    const user = userEvent.setup()
    renderMatch()
    const order = screen.getByRole('button', { name: 'Order' })
    await user.click(order)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(`Order from ${model().hero.venueName}`)).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(order)
  })

  it('“Show me something else” goes back to the deck', async () => {
    const user = userEvent.setup()
    renderMatch()
    await user.click(screen.getByRole('button', { name: 'Show me something else' }))
    expect(await screen.findByText('deck screen')).toBeTruthy()
  })

  it('a second “Show me something else” offers the pick list', async () => {
    const s = soloSessionStore.getState()
    s.notQuite()
    for (let i = 0; i < 20 && !soloSessionStore.getState().state!.result; i++) soloSessionStore.getState().swipe('no')
    soloSessionStore.getState().notQuite()
    renderMatch()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Pick one of these')
    expect(screen.queryByRole('button', { name: 'Show me something else' })).toBeNull()
  })

  it('in a pick-list session, says "Back to the list" and "Top of the list", and each does what it says', async () => {
    const user = userEvent.setup()
    soloSessionStore.getState().notQuite()
    for (let i = 0; i < 20 && !soloSessionStore.getState().state!.result; i++) soloSessionStore.getState().swipe('no')
    soloSessionStore.getState().notQuite()
    const top = soloSessionStore.getState().state!.result!.hero.archetypeId
    renderMatch()

    // Choose a dish from the list that isn't the top one.
    const tiles = [...document.querySelectorAll<HTMLButtonElement>('main .issue-open')]
    await user.click(tiles[1] ?? tiles[0]!)
    expect(screen.getByRole('button', { name: 'Back to the list' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Return to our match' })).toBeNull()

    // The engine's top dish is labelled "Top of the list" and opens that dish (not the list).
    const topTile = [...document.querySelectorAll<HTMLButtonElement>('.or-try-tile')].find((b) =>
      b.textContent!.includes('Top of the list'),
    )
    expect(topTile).toBeTruthy()
    expect(document.body.textContent).not.toContain('Our match')
    await user.click(topTile!)
    expect(soloSessionStore.getState().view).toMatchObject({ kind: 'alternative', archetypeId: top })

    // "Back to the list" returns to the list.
    await user.click(screen.getByRole('button', { name: 'Back to the list' }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Pick one of these')
  })

  it('outside pick-list sessions the approved runner-up copy is unchanged', async () => {
    const user = userEvent.setup()
    renderMatch()
    await user.click(document.querySelector<HTMLButtonElement>('.or-try-tile')!)
    expect(screen.getByRole('button', { name: 'Return to our match' })).toBeTruthy()
    expect(screen.queryByText('Back to the list')).toBeNull()
    expect(screen.queryByText('Top of the list')).toBeNull()
  })
})
