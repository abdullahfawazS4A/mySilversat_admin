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
import type { AdminSession, OtpChallenge, ResetChallenge } from '@/types';
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
  /**
   * The reset pair. Neither touches the session: a reset ends with a password,
   * and the operator still signs in afterwards.
   */
  forgotPassword: (phone: string) => Promise<ResetChallenge>;
  resetPassword: (challengeToken: string, code: string, newPassword: string) => Promise<void>;
  resendResetOtp: (challengeToken: string) => Promise<void>;
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

  const forgotPassword = useCallback(
    (phone: string) => repos.auth.forgotPassword(phone),
    [repos],
  );

  const resetPassword = useCallback(
    (challengeToken: string, code: string, newPassword: string) =>
      repos.auth.resetPassword(challengeToken, code, newPassword),
    [repos],
  );

  const resendResetOtp = useCallback(
    (challengeToken: string) => repos.auth.resendResetOtp(challengeToken),
    [repos],
  );

  const signOut = useCallback(async () => {
    await repos.auth.signOut();
    setSession(null);
    setStatus('unauthenticated');
  }, [repos]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      signIn,
      verifyOtp,
      resendOtp,
      forgotPassword,
      resetPassword,
      resendResetOtp,
      signOut,
    }),
    [
      status,
      session,
      signIn,
      verifyOtp,
      resendOtp,
      forgotPassword,
      resetPassword,
      resendResetOtp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
