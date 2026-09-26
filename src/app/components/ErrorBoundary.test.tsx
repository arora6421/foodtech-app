// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Broken(): never {
  throw new Error('render failed')
}

describe('ErrorBoundary', () => {
  it('shows its children when nothing fails', () => {
    render(
      <ErrorBoundary onReset={() => {}}>
        <p>fine</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('fine')).toBeTruthy()
  })

  it('replaces a screen that throws with a way out, instead of a blank page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}) // React and the boundary both log
    const onReset = vi.fn()
    render(
      <ErrorBoundary onReset={onReset}>
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start again' }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
