'use client';

import React, { ReactNode, Component, ReactElement } from 'react';
import { Button, Card } from '@qzlcorp/react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch React rendering errors and prevent app crash.
 * Displays a user-friendly error message with recovery option.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactElement {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return <>{this.props.fallback(this.state.error, this.reset)}</>;
      }
      return (
        <div className="flex items-center justify-center w-full h-full p-6">
          <Card className="w-full max-w-md p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2 text-[var(--qzl-text)]">Something went wrong</h2>
            <p className="text-[var(--qzl-text-muted)] text-sm mb-4 break-words">
              {this.state.error.message || 'An unexpected error occurred'}
            </p>
            <Button
              onClick={this.reset}
              variant="primary"
              size="sm"
            >
              Try again
            </Button>
          </Card>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
