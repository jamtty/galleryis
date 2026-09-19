import { Component, type ReactNode } from "react";
import i18n from "../i18n";

// Class component (React error boundaries have no hook API); reads the i18n
// singleton directly since useTranslation is unavailable here. The studio's
// ErrorBoundary, ported as Phase 6's error-handling baseline (§6).
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-ground px-6 text-center text-ink">
        <div className="space-y-4">
          <h1 className="font-display text-headline font-bold">
            {i18n.t("errorScreen.title")}
          </h1>
          <p className="text-sm text-ink-soft">{i18n.t("errorScreen.body")}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-full border border-line-lit px-5 py-2 text-sm transition-colors hover:border-ink hover:text-ink"
          >
            {i18n.t("errorScreen.reload")}
          </button>
        </div>
      </main>
    );
  }
}
