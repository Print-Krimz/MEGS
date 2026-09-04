import React from "react";
import { RouterProvider } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "./routes";
import { useAuth } from "./hooks/useAuth";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { FeedbackToaster } from "./components/common/FeedbackToaster";
import { Loader2 } from "lucide-react";

export const AppContent: React.FC = () => {
  const auth = useAuth();
  const queryClient = useQueryClient();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
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
