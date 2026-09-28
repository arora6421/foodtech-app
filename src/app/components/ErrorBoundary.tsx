import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { copy } from '../copy/en-GB'
import { PlateArt } from './food/DishImage'

// If a screen throws while rendering, React unmounts everything, leaving a blank page. This keeps
// the app shell and offers a way out: "Start again" clears the session and reloads from Welcome.

interface Props {
  children: ReactNode
  onReset: () => void
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen failed to render', error, info.componentStack)
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="screen contents-page" role="alert">
        <div className="empty-state">
          <span className="empty-plate" aria-hidden="true">
            <PlateArt initial="?" />
          </span>
          <h1 className="contents-title">{copy.error.title}</h1>
          <p className="empty-text">{copy.error.body}</p>
          <button type="button" className="btn-cover-primary" onClick={this.props.onReset}>
            {copy.error.restart}
          </button>
        </div>
      </main>
    )
  }
}
