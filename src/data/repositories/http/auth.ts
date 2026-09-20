/**
 * Admin authentication.
 *
 * Sign-in is two calls, not one: `/auth/login` checks the password and texts a
 * six-digit code, `/auth/verify-otp` trades that code for the JWT. Only the
 * second step produces a session, which is why `signIn` returns a challenge
 * and the login screen renders two panels.
 *
 * The token is written to local storage the moment it arrives, because the
 * HTTP client reads it from there rather than from React state.
 *
 * Resetting a forgotten password is a third, parallel pair of calls —
 * `/auth/forgot-password` then `/auth/reset-password` — which look like the
 * sign-in pair but are not: the code arrives over WhatsApp rather than SMS,
 * the two challenges are not interchangeable, and finishing one produces a
 * password rather than a session.
 */

import { ApiError, api } from '@/data/http/client';
import {
  clearToken,
  isTokenExpired,
  readToken,
  readUser,
  writeToken,
  writeUser,
} from '@/data/http/session';
import type { AdminSession, AdminUser, OtpChallenge, ResetChallenge } from '@/types';
import type { AuthRepository } from '../types';

/** What `/auth/verify-otp` answers with. */
interface VerifyResponse {
  access_token: string;
  user: Pick<AdminUser, 'id' | 'email' | 'name' | 'role'>;
}

/**
 * Whether a failed `/auth/me` means the token was rejected.
 *
 * Only a 401 does. A network blip or a 500 says nothing about the credential,
 * and signing out over one would turn a flaky minute into a re-login.
 */
function isRejectedToken(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export class HttpAuthRepository implements AuthRepository {
  /**
   * Rebuilds the session from the stored token.
   *
   * The cached profile is returned immediately so the shell can paint, and the
   * API is asked for a fresh one in the background — a token that was revoked
   * server-side fails here and signs the operator out.
   */
  async restore(): Promise<AdminSession | null> {
    const token = readToken();
    if (!token) return null;

    // The token says itself that it is done; no point spending a round trip
    // to be told so, and no point leaving it in storage to fail every later
    // request.
    if (isTokenExpired()) {
      clearToken();
      return null;
    }

    const cached = readUser();
    if (cached) {
      // Verify in the background so the shell paints from cache immediately.
      void this.verifyToken();
      return { admin: cached, token };
    }

    try {
      const admin = await this.me();
      return { admin, token };
    } catch (err) {
      if (isRejectedToken(err)) clearToken();
      return null;
    }
  }

  /**
   * Confirms the stored token is still one the server accepts.
   *
   * The client no longer treats every 401 as a dead session — it cannot tell a
   * revoked token from a route the operator's role may not open. `/auth/me` is
   * the exception: it asks nothing but "who is this token", so a 401 *here* is
   * about the credential and nothing else, and is the one answer that earns a
   * forced sign-out.
   */
  private async verifyToken(): Promise<void> {
    try {
      await this.me();
    } catch (err) {
      if (isRejectedToken(err)) clearToken();
    }
  }

  signIn(phone: string, password: string): Promise<OtpChallenge> {
    return api.anonPost<OtpChallenge>('/auth/login', { phone: phone.trim(), password });
  }

  async verifyOtp(challengeToken: string, code: string): Promise<AdminSession> {
    const result = await api.anonPost<VerifyResponse>('/auth/verify-otp', {
      challengeToken,
      code: code.trim(),
    });
    writeToken(result.access_token);

    // The verify response carries a trimmed user; `/auth/me` has the full row.
    const admin = await this.me();
    return { admin, token: result.access_token };
  }

  async resendOtp(challengeToken: string): Promise<void> {
    await api.anonPost('/auth/resend-otp', { challengeToken });
  }

  /**
   * Starts a password reset.
   *
   * Anonymous like the login routes, and for a stronger reason: an operator
   * who has lost the password may well be holding a token that has since been
   * revoked, and sending it would only invite a 401 on a route that never
   * needed one.
   */
  forgotPassword(phone: string): Promise<ResetChallenge> {
    return api.anonPost<ResetChallenge>('/auth/forgot-password', { phone: phone.trim() });
  }

  /**
   * Finishes a reset.
   *
   * Sets the password and nothing else — the API answers with no token, so the
   * operator signs in afterwards the ordinary way, password then SMS code.
   * That is the API's decision, not a shortcut taken here.
   */
  async resetPassword(
    challengeToken: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await api.anonPost('/auth/reset-password', {
      challengeToken,
      code: code.trim(),
      newPassword,
    });
  }

  async resendResetOtp(challengeToken: string): Promise<void> {
    await api.anonPost('/auth/resend-password-reset-otp', { challengeToken });
  }

  async signOut(): Promise<void> {
    // The API issues stateless JWTs, so signing out is purely local.
    clearToken();
  }

  async me(): Promise<AdminUser> {
    const admin = await api.get<AdminUser>('/auth/me');
    writeUser(admin);
    return admin;
  }

  async updateProfile(input: { name?: string; email?: string; phone?: string }): Promise<AdminUser> {
    await api.patch('/users', input);
    return this.me();
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.patch('/users/change-password', { currentPassword, newPassword });
  }
}
