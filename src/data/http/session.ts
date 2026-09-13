/**
 * Where the bearer token lives.
 *
 * Kept in `localStorage` so a refresh does not throw the operator back to the
 * login screen. The client reads it on every request and clears it on any 401,
 * which is the single place a dead session is detected.
 *
 * This module deliberately knows nothing about React — the HTTP client needs
 * the token outside any component tree.
 */

import type { AdminUser } from '@/types';

const TOKEN_KEY = 'silversat.admin.token';
const USER_KEY = 'silversat.admin.user';

/** Notified when the token is cleared by a 401, so the UI can sign out. */
type Listener = () => void;
const listeners = new Set<Listener>();

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode — the session just will not survive a refresh */
  }
}

export function readUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export function writeUser(user: AdminUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignored, same reason as writeToken */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignored */
  }
  for (const listener of listeners) listener();
}

/** Subscribes to forced sign-outs. Returns the unsubscribe function. */
export function onSessionCleared(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
