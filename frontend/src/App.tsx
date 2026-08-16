import React from "react";
import { RouterProvider } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "./routes";
import { useAuth } from "./hooks/useAuth";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Loader2 } from "lucide-react";

export const AppContent: React.FC = () => {
  const auth = useAuth();
  const queryClient = useQueryClient();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
          <span className="font-mono text-sm tracking-wide">
            INITIALIZING RECRUITMENT PORTAL...
          </span>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} context={{ auth, queryClient }} />;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
