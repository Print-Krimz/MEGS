import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ApiError } from "../lib/api/client";
import { onSessionGenerationChange } from "../lib/auth/session-generation";
import { OPERATIONAL_QUERY_STALE_TIME_MS } from "../lib/query-policies";

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiError && error.status === 401) {
              // 401 redirect is already handled in apiClient
              return;
            }
            console.error("[Query Cache Error]:", error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (error instanceof ApiError && error.status === 401) {
              return;
            }
            console.error("[Mutation Cache Error]:", error);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: OPERATIONAL_QUERY_STALE_TIME_MS,
            gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
            refetchOnWindowFocus: true, // Automatically refetch latest server data when candidate/recruiter focuses the tab
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              // Never retry on 4xx client errors
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  // A new session must never see the previous session's data or in-flight requests.
  useEffect(
    () =>
      onSessionGenerationChange(() => {
        void queryClient.cancelQueries();
        // reset (not clear) so mounted observers drop A's data and refetch under the new session.
        void queryClient.resetQueries();
        queryClient.getMutationCache().clear();
      }),
    [queryClient]
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && import.meta.env.VITE_ENABLE_QUERY_DEVTOOLS === "true" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
};
