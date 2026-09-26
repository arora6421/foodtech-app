import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { copy } from '../copy/en-GB'

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
      <main className="screen" role="alert">
        <h1 className="t-title" style={{ margin: '40px 0 10px' }}>
          {copy.error.title}
        </h1>
        <p className="t-body muted" style={{ margin: '0 0 20px' }}>
          {copy.error.body}
        </p>
        <button type="button" className="btn btn-primary" onClick={this.props.onReset}>
          {copy.error.restart}
        </button>
      </main>
    )
  }
}
