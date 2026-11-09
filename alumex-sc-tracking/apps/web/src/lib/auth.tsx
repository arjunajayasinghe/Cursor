"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type PermissionsMe } from "@/lib/api";

const STORAGE_KEY = "alumex-demo-role";

type AuthState = {
  role: string;
  me: PermissionsMe | null;
  loading: boolean;
  setRole: (role: string) => void;
  refresh: () => Promise<void>;
  canView: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  level: (moduleKey: string) => number;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState("Administrator");
  const [hydrated, setHydrated] = useState(false);
  const [me, setMe] = useState<PermissionsMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setRoleState(saved);
    setHydrated(true);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.permissionsMe();
      setMe(data);
      setRoleState(data.role);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, role);
    api.setDemoRole(role);
    void refresh();
  }, [role, refresh, hydrated]);

  const setRole = useCallback((next: string) => {
    setRoleState(next);
  }, []);

  const level = useCallback(
    (moduleKey: string) => {
      if (role === "Administrator") return 2;
      return me?.access?.[moduleKey] ?? 0;
    },
    [me, role],
  );

  const value = useMemo<AuthState>(
    () => ({
      role,
      me,
      loading: loading || !hydrated,
      setRole,
      refresh,
      level,
      canView: (moduleKey: string) => level(moduleKey) >= 1,
      canEdit: (moduleKey: string) => level(moduleKey) >= 2,
    }),
    [role, me, loading, hydrated, setRole, refresh, level],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
