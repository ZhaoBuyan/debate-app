// client/src/components/common/ErrorBoundary.tsx
// 全局错误边界：渲染层异常时给出可恢复的兜底 UI

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : "未知错误",
    };
  }

  componentDidCatch(err: unknown) {
    console.error("[ErrorBoundary]", err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen app-bg text-white flex flex-col items-center justify-center gap-4 p-6">
          <div className="text-5xl" aria-hidden>
            💥
          </div>
          <h1 className="text-xl font-bold">页面出了点问题</h1>
          <p className="text-sm text-gray-400 max-w-md text-center break-all">
            {this.state.message}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, message: "" });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition"
            >
              刷新页面
            </button>
            <a
              href="/debates"
              className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition"
            >
              返回大厅
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
