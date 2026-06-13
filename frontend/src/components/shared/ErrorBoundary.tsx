'use client';

import { Component, type ReactNode } from 'react';

interface Props { fallback?: ReactNode; children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="border rounded-lg p-6 bg-red-50">
          <p className="text-red-600 font-medium">组件加载失败</p>
          <p className="text-red-500 text-sm mt-1">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
