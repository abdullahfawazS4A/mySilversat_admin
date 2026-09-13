/**
 * Admin session.
 *
 * Status walks `unknown -> unauthenticated | authenticated`, and the router
 * redirects on that status rather than on the presence of a user object — a
 * screen never checks the session itself.
 *
 * Sign-in is two steps because the API makes it two: the password buys an SMS
 * challenge, the code buys the token. Only `verifyOtp` produces a session.
 *
 * The provider also listens for a token cleared by a 401 anywhere in the app,
 * so an expired session drops straight back to the login screen instead of
 * leaving the operator on a page that will not load.
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
import type { AdminSession, OtpChallenge } from '@/types';
import { onSessionCleared } from '@/data/http/session';
import { useRepos } from './RepositoryContext';

export type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  session: AdminSession | null;
  /** Step 1 — returns the challenge the OTP panel needs. */
  signIn: (phone: string, password: string) => Promise<OtpChallenge>;
  /** Step 2 — on success the app is authenticated. */
  verifyOtp: (challengeToken: string, code: string) => Promise<void>;
  resendOtp: (challengeToken: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  // A 401 on any request clears the token; the UI has to follow it down.
  useEffect(
    () =>
      onSessionCleared(() => {
        setSession(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const signIn = useCallback(
    (phone: string, password: string) => repos.auth.signIn(phone, password),
    [repos],
  );

  const verifyOtp = useCallback(
    async (challengeToken: string, code: string) => {
      const next = await repos.auth.verifyOtp(challengeToken, code);
      setSession(next);
      setStatus('authenticated');
    },
    [repos],
  );

  const resendOtp = useCallback(
    (challengeToken: string) => repos.auth.resendOtp(challengeToken),
    [repos],
  );

  const signOut = useCallback(async () => {
    await repos.auth.signOut();
    setSession(null);
    setStatus('unauthenticated');
  }, [repos]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, signIn, verifyOtp, resendOtp, signOut }),
    [status, session, signIn, verifyOtp, resendOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
