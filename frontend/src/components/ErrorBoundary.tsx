import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-bg px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-500">
            <AlertTriangle size={26} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">Something went wrong</p>
            <p className="mt-1 text-sm text-gray-500">
              An unexpected error occurred. Try reloading the page.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
