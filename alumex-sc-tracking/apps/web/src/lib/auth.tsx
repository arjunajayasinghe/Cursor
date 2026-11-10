"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type PermissionsMe } from "@/lib/api";
import { DEFAULT_SAFE_ROLE, DEMO_ROLE_SWITCHING } from "@/lib/demo-mode";

const STORAGE_KEY = "alumex-demo-role";

type AuthState = {
  role: string;
  me: PermissionsMe | null;
  loading: boolean;
  demoRoleSwitching: boolean;
  setRole: (role: string) => void;
  refresh: () => Promise<void>;
  canView: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  level: (moduleKey: string) => number;
};

const AuthContext = createContext<AuthState | null>(null);

function sanitizeStoredRole(saved: string | null): string {
  if (!DEMO_ROLE_SWITCHING) return DEFAULT_SAFE_ROLE;
  if (!saved) return DEFAULT_SAFE_ROLE;
  if (saved === "Administrator" && process.env.NODE_ENV === "production" && !DEMO_ROLE_SWITCHING) {
    return DEFAULT_SAFE_ROLE;
  }
  return saved;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState(DEFAULT_SAFE_ROLE);
  const [hydrated, setHydrated] = useState(false);
  const [me, setMe] = useState<PermissionsMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    const next = sanitizeStoredRole(saved);
    setRoleState(next);
    if (saved !== next) localStorage.setItem(STORAGE_KEY, next);
    setHydrated(true);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.permissionsMe();
      setMe(data);
      setRoleState(data.role || DEFAULT_SAFE_ROLE);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, DEMO_ROLE_SWITCHING ? role : DEFAULT_SAFE_ROLE);
    }
    api.setDemoRole(DEMO_ROLE_SWITCHING ? role : DEFAULT_SAFE_ROLE);
    void refresh();
  }, [role, refresh, hydrated]);

  const setRole = useCallback((next: string) => {
    if (!DEMO_ROLE_SWITCHING) return;
    setRoleState(next || DEFAULT_SAFE_ROLE);
  }, []);

  const level = useCallback(
    (moduleKey: string) => {
      // Never trust client-only Administrator elevation — use server access matrix.
      return me?.access?.[moduleKey] ?? 0;
    },
    [me],
  );

  const value = useMemo<AuthState>(
    () => ({
      role,
      me,
      loading: loading || !hydrated,
      demoRoleSwitching: DEMO_ROLE_SWITCHING,
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
