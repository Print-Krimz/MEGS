import React, { useEffect } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "./routes";
import { useAuth } from "./hooks/useAuth";
import { landingRedirectPending, markLandingRedirected } from "./lib/home-path";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { FeedbackToaster } from "./components/common/FeedbackToaster";
import { Loader2 } from "lucide-react";

export const AppContent: React.FC = () => {
  const auth = useAuth();
  const queryClient = useQueryClient();

  // Public pages (landing, auth, tracking slip, offer link) never need the session, so skip the staff loader.
  // A stored session opening "/" waits for it too, so the landing page does not flash before the redirect home.
  const path = window.location.pathname;
  const isPublicPath =
    /^\/($|t\/|offer\/|check-in(\/|$)|(login|register|forgot-password|reset-password)(\/|$))/.test(path) &&
    !(path === "/" && landingRedirectPending());
  const showLoader = auth.isLoading && !isPublicPath;

  // Opening the app directly counts as the once-per-session landing visit, so the logo link does not bounce the user back.
  useEffect(() => {
    if (auth.user && window.location.pathname !== "/") markLandingRedirected();
  }, [auth.user]);

  // Public pages mount the router while the session loads, so re-run the login/register guards with the real one.
  useEffect(() => {
    if (!auth.isLoading && isPublicPath) void router.invalidate();
  }, [auth.isLoading, isPublicPath]);

  // While the spinner waits for /api/me, fetch the page's code. loadRouteChunk skips beforeLoad and loaders.
  useEffect(() => {
    if (!showLoader) return;
    try {
      for (const route of router.getMatchedRoutes(window.location.pathname)[0]) {
        void router.loadRouteChunk(route)?.catch(() => undefined);
      }
    } catch {
      // Prefetch is best effort; the router loads the chunk itself after sign-in.
    }
  }, [showLoader]);

  if (showLoader) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
          <span className="text-sm font-medium">
            Opening your recruitment workspace…
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} context={{ auth, queryClient }} />
      <FeedbackToaster />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
