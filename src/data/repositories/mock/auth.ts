/**
 * Mock auth.
 *
 * Any password of 4+ characters is accepted for a known, active username —
 * this is a UI prototype and there is nothing to authenticate against. The
 * session survives a reload through local storage, mirroring how the customer
 * app restores from shared_preferences.
 */

import type { AdminSession } from '@/types';
import type { AuthRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { ADMIN_ROLES } from '@/data/seed';

const STORAGE_KEY = 'silversat.admin.session';

function sessionFor(username: string): AdminSession | null {
  const admin = mockDb.tables.admins.find((a) => a.username === username);
  if (!admin) return null;
  const role = ADMIN_ROLES.find((r) => r.key === admin.role);
  return { admin, permissions: role?.permissions ?? [] };
}

export class MockAuthRepository implements AuthRepository {
  async restore(): Promise<AdminSession | null> {
    await mockDb.latency();
    let username: string | null = null;
    try {
      username = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode or storage disabled — treat as signed out.
      return null;
    }
    if (!username) return null;
    const session = sessionFor(username);
    if (session && session.admin.active) {
      mockDb.currentAdmin = session.admin;
      return session;
    }
    return null;
  }

  async signIn(username: string, password: string): Promise<AdminSession> {
    await mockDb.latency();
    const session = sessionFor(username.trim());
    if (!session) throw new Error('اسم المستخدم غير موجود');
    if (!session.admin.active) throw new Error('هذا الحساب موقوف — راجع مالك النظام');
    if (password.trim().length < 4) throw new Error('كلمة المرور قصيرة جداً');

    session.admin.lastLoginAt = new Date().toISOString();
    mockDb.currentAdmin = session.admin;
    mockDb.audit('login', 'admin', session.admin.id, 'تسجيل دخول إلى لوحة التحكم');
    try {
      localStorage.setItem(STORAGE_KEY, session.admin.username);
    } catch {
      // Non-fatal: the session simply will not survive a reload.
    }
    return session;
  }

  async signOut(): Promise<void> {
    await mockDb.latency();
    mockDb.currentAdmin = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }
}
