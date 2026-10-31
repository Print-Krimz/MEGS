import React, { useEffect, useRef, useState, useCallback } from "react";
import type { User, LoginResponse } from "../lib/types/auth.types";
import { authApi } from "../lib/api/auth.api";
import { ApiError } from "../lib/api/client";
import { bumpSessionGeneration, getSessionGeneration, onSessionGenerationChange, tokenSubject } from "../lib/auth/session-generation";
import { AuthContext, type AuthContextType } from "../context/AuthContext";
import { canOpenPath, getHomePath, markLandingRedirected } from "../lib/home-path";
import { clearLastActivity, writeLastActivity } from "../lib/auth/idle-activity";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSession = useCallback(async (): Promise<User | null> => {
    const generation = getSessionGeneration();
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    // A newer session generation settles loading itself; this one must not.
    let stale = false;
    try {
      const currentUser = await authApi.getMe();
      if (generation !== getSessionGeneration()) {
        stale = true;
        return null;
      }
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (generation !== getSessionGeneration()) {
        stale = true;
        return null;
      }
      // Temporary API/network outages do not invalidate credentials. An initial
      // failed check still leaves user null, so it cannot grant authenticated access.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        bumpSessionGeneration();
        setUser(null);
      }
    } finally {
      if (!stale) setIsLoading(false);
    }
    return null;
  }, []);

  useEffect(() => {
    // Credentials cleared elsewhere (e.g. a failed refresh in the API client) end
    // the session: settle startup loading instead of waiting for a /me that was dropped.
    const offGeneration = onSessionGenerationChange(() => {
      if (!localStorage.getItem("access_token")) {
        setUser(null);
        setIsLoading(false);
      }
    });
    fetchSession();
    const syncSession = (event: StorageEvent) => {
      if (!event.key || event.key === "access_token") {
        // Another tab refreshing the same account's token is not a new session.
        const oldSub = event.key ? tokenSubject(event.oldValue) : null;
        if (oldSub && event.newValue && oldSub === tokenSubject(event.newValue)) return;
        bumpSessionGeneration();
        setUser(null);
        setIsLoading(true);
        // Another tab signed in as a different role: this tab's page now belongs to the old role, so go home.
        void fetchSession().then((next) => {
          if (next && !canOpenPath(next, window.location.pathname)) window.location.replace(getHomePath(next));
        });
      }
    };
    window.addEventListener("storage", syncSession);
    return () => {
      offGeneration();
      window.removeEventListener("storage", syncSession);
    };
  }, [fetchSession]);

  const login = useCallback((data: LoginResponse) => {
    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    // New login: drop the previous session's caches and in-flight work before rendering it.
    bumpSessionGeneration();
    if (data.access_token) {
      window.dispatchEvent(new Event("auth-token-changed"));
    }
    // Just signed in: the landing page is not a detour on the way back from the app.
    markLandingRedirected();
    writeLastActivity();
    setUser(data.user);
    setIsLoading(false);
  }, []);


  const signingOutRef = useRef(false);

  const logout = useCallback(async (options?: { reason?: "idle" }) => {
    // The page navigates away below, so a repeat call (StrictMode effects, a double click) must not
    // send a second request whose 401 would overwrite the redirect.
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    const idle = options?.reason === "idle";
    // Captured before the tokens go, so signing back in returns to the page the user left.
    const { pathname, search } = window.location;
    try {
      await authApi.logout(idle ? "idle" : undefined);
    } catch {
      // Ignore errors on signout
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      clearLastActivity();
      bumpSessionGeneration();
      setUser(null);
      const params = new URLSearchParams();
      if (idle) {
        params.set("reason", "idle");
        if (pathname !== "/" && !pathname.startsWith("/login")) params.set("redirect", pathname + search);
      }
      const query = params.toString();
      window.location.href = query ? `/login?${query}` : "/login";
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const generation = getSessionGeneration();
    try {
      const updatedUser = await authApi.getMe();
      if (generation === getSessionGeneration()) setUser(updatedUser);
    } catch {
      // Ignored
    }
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: Boolean(user && localStorage.getItem("access_token")),
    isLoading,
    mustChangePassword: Boolean(user?.mustChangePassword),
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
