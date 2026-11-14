import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected UI rendering failure.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#131C31] border border-rose-500/40 rounded-xl p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-lg bg-rose-500/15 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Shield Fail-Safe Engaged
            </h2>
            <p className="text-sm text-slate-300 mb-5 leading-relaxed">
              An unexpected display exception was safely caught. Core coercion detection remains isolated and intact.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restore Console View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
