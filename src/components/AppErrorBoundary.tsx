import { Component, ReactNode, ErrorInfo } from 'react';
import ErrorPage from './ErrorPage';

interface State { error: Error | null }

/**
 * Top-level boundary for uncaught render errors anywhere in the tree (including
 * above the Router/Query providers). Route/loader errors are handled closer to
 * the source by `RouteErrorBoundary`; this is the last-resort catch-all.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return <ErrorPage error={this.state.error} fullScreen onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
