/** Mock customer accounts: search, detail, moderation and manual points. */

import type { AppUser, Id, Page, PredictionView } from '@/types';
import type { UserDetail, UserListQuery, UsersRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { matchesSearch, newId } from '@/lib/utils';
import { paginate, requireById } from './helpers';

/** Recomputes a user cached total from the ledger of the active season. */
export function recomputePoints(userId: Id): number {
  const season = mockDb.tables.seasons.find((s) => s.active);
  const total = mockDb.tables.pointsEntries
    .filter((e) => e.userId === userId && e.seasonId === season?.id)
    .reduce((sum, e) => sum + e.delta, 0);
  const user = mockDb.tables.users.find((u) => u.id === userId);
  if (user) user.points = Math.max(0, total);
  return Math.max(0, total);
}

export class MockUsersRepository implements UsersRepository {
  async list(query: UserListQuery): Promise<Page<AppUser>> {
    await mockDb.latency();
    let rows = [...mockDb.tables.users];

    if (query.governorateId) rows = rows.filter((u) => u.governorateId === query.governorateId);
    if (query.status && query.status !== 'all') rows = rows.filter((u) => u.status === query.status);
    if (typeof query.minPoints === 'number') rows = rows.filter((u) => u.points >= query.minPoints!);

    if (query.deviceStatus && query.deviceStatus !== 'all') {
      const owners = new Set(
        mockDb.tables.devices.filter((d) => d.status === query.deviceStatus).map((d) => d.userId),
      );
      rows = rows.filter((u) => owners.has(u.id));
    }

    if (query.search?.trim()) {
      const needle = query.search.trim();
      // Support also searches by receiver serial, so resolve those to owners.
      const byDevice = new Set(
        mockDb.tables.devices
          .filter((d) => matchesSearch(d.number, needle))
          .map((d) => d.userId),
      );
      rows = rows.filter(
        (u) =>
          matchesSearch(u.fullName, needle) ||
          u.phone.includes(needle.replace(/\s/g, '')) ||
          byDevice.has(u.id),
      );
    }

    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<AppUser>;
  }

  async detail(id: Id): Promise<UserDetail> {
    await mockDb.latency();
    const user = requireById(mockDb.tables.users, id, 'المشترك');
    const devices = mockDb.tables.devices.filter((d) => d.userId === id);
    const renewals = mockDb.tables.renewals
      .filter((r) => r.userId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const coupons = mockDb.tables.coupons
      .filter((c) => c.userId === id)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

    const predictions: PredictionView[] = mockDb.tables.predictions
      .filter((p) => p.userId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({
        ...p,
        userName: user.fullName,
        userPhone: user.phone,
        governorateId: user.governorateId,
      }));

    const pointsLedger = mockDb.tables.pointsEntries
      .filter((e) => e.userId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { user, devices, renewals, coupons, predictions, pointsLedger };
  }

  async save(user: AppUser): Promise<AppUser> {
    await mockDb.latency();
    const row = requireById(mockDb.tables.users, user.id, 'المشترك');
    Object.assign(row, user);
    mockDb.audit('update', 'user', row.id, `تعديل بيانات ${row.fullName}`);
    return row;
  }

  async setStatus(id: Id, status: AppUser['status'], reason?: string): Promise<AppUser> {
    await mockDb.latency();
    const row = requireById(mockDb.tables.users, id, 'المشترك');
    row.status = status;
    row.blockReason = status === 'blocked' ? reason : undefined;
    const label = status === 'blocked' ? 'حظر' : status === 'active' ? 'رفع الحظر عن' : 'تعليق';
    mockDb.audit('update', 'user', id, `${label} المشترك ${row.fullName}`);
    return row;
  }

  async adjustPoints(id: Id, delta: number, reasonAr: string): Promise<AppUser> {
    await mockDb.latency();
    const row = requireById(mockDb.tables.users, id, 'المشترك');
    const season = mockDb.tables.seasons.find((s) => s.active);
    if (!season) throw new Error('لا يوجد موسم فعّال');

    mockDb.tables.pointsEntries.push({
      id: newId('pts'),
      userId: id,
      seasonId: season.id,
      delta,
      kind: delta >= 0 ? 'bonus' : 'penalty',
      reasonAr,
      adminId: mockDb.currentAdmin?.id,
      createdAt: new Date().toISOString(),
    });
    recomputePoints(id);
    mockDb.audit(
      'update',
      'points',
      id,
      `${delta >= 0 ? 'إضافة' : 'خصم'} ${Math.abs(delta)} نقطة لـ ${row.fullName} — ${reasonAr}`,
    );
    return row;
  }

  async saveNote(id: Id, notes: string): Promise<AppUser> {
    await mockDb.latency();
    const row = requireById(mockDb.tables.users, id, 'المشترك');
    row.notes = notes;
    mockDb.audit('update', 'user', id, `تحديث ملاحظات ${row.fullName}`);
    return row;
  }
}
