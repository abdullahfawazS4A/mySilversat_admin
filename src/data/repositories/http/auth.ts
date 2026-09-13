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
 */

import { api } from '@/data/http/client';
import { clearToken, readToken, readUser, writeToken, writeUser } from '@/data/http/session';
import type { AdminSession, AdminUser, OtpChallenge } from '@/types';
import type { AuthRepository } from '../types';

/** What `/auth/verify-otp` answers with. */
interface VerifyResponse {
  access_token: string;
  user: Pick<AdminUser, 'id' | 'email' | 'name' | 'role'>;
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

    const cached = readUser();
    if (cached) {
      // Verify in the background; a 401 clears the token via the client.
      void this.me().catch(() => undefined);
      return { admin: cached, token };
    }

    try {
      const admin = await this.me();
      return { admin, token };
    } catch {
      clearToken();
      return null;
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
