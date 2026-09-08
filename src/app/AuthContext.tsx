/**
 * Admin session + permission gate.
 *
 * Mirrors the app's AuthController: status walks
 * `unknown -> unauthenticated | authenticated`, and the router redirects on
 * that status rather than on the presence of a user object.
 *
 * `can()` hides controls the signed-in role may not use. It is a usability
 * feature, not a security boundary — a real backend must enforce the same
 * permission set server-side.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AdminSession, Permission } from '@/types';
import { useRepos } from './RepositoryContext';

export type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  session: AdminSession | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const repos = useRepos();
  const [status, setStatus] = useState<AuthStatus>('unknown');
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    repos.auth
      .restore()
      .then((restored) => {
        if (cancelled) return;
        setSession(restored);
        setStatus(restored ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, [repos]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const next = await repos.auth.signIn(username, password);
      setSession(next);
      setStatus('authenticated');
    },
    [repos],
  );

  const signOut = useCallback(async () => {
    await repos.auth.signOut();
    setSession(null);
    setStatus('unauthenticated');
  }, [repos]);

  const can = useCallback(
    (permission: Permission) => session?.permissions.includes(permission) ?? false,
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, signIn, signOut, can }),
    [status, session, signIn, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
