import React from 'react';
import { Button } from '@/components/ui/button';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unexpected application error' };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppErrorBoundary]', error, errorInfo);
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background px-6 py-12">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">System Alert</p>
            <h1 className="mt-3 text-3xl font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The app encountered an unexpected issue. You can safely refresh and continue.
            </p>
            <p className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
              {this.state.errorMessage}
            </p>
            <div className="mt-5">
              <Button onClick={this.handleReload}>Reload application</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
