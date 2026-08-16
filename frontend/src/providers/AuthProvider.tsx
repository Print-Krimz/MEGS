import React, { useEffect, useState, useCallback } from "react";
import type { User, LoginResponse } from "../lib/types/auth.types";
import { authApi } from "../lib/api/auth.api";
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
      setUser(currentUser);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const login = useCallback((data: LoginResponse) => {
    localStorage.setItem("access_token", data.access_token);
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
