import React, { useEffect, useState, useCallback } from "react";
import type { User, LoginResponse } from "../lib/types/auth.types";
import { authApi } from "../lib/api/auth.api";
import { ApiError } from "../lib/api/client";
import { AuthContext, type AuthContextType } from "../context/AuthContext";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSession = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await authApi.getMe();
      if (localStorage.getItem("access_token") !== token) return;
      setUser(currentUser);
    } catch (error) {
      if (localStorage.getItem("access_token") !== token) return;
      // Temporary API/network outages do not invalidate credentials. An initial
      // failed check still leaves user null, so it cannot grant authenticated access.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
      }
    } finally {
      if (localStorage.getItem("access_token") === token || !localStorage.getItem("access_token")) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const syncSession = (event: StorageEvent) => {
      if (!event.key || event.key === "access_token") {
        setUser(null);
        setIsLoading(true);
        void fetchSession();
      }
    };
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, [fetchSession]);

  const login = useCallback((data: LoginResponse) => {
    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
      window.dispatchEvent(new Event("auth-token-changed"));
    }
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    setUser(data.user);
  }, []);


  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on signout
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
      window.location.href = "/login";
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
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
