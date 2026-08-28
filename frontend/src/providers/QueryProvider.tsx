import React, { useState } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ApiError } from "../lib/api/client";

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
            staleTime: 1000 * 15, // 15 seconds for reactive synchronization
            gcTime: 1000 * 60 * 30, // 30 minutes
            refetchOnWindowFocus: true,
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && import.meta.env.VITE_ENABLE_QUERY_DEVTOOLS === "true" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
};
