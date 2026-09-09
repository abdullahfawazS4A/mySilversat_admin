/**
 * Mock governorate API connections.
 *
 * A connection is the upstream system a governorate's renewals actually go
 * through. Every governorate runs the same software, so a connection is four
 * credentials plus the list of governorates it answers for.
 *
 * The one invariant enforced here: **a governorate answers to exactly one
 * connection.** Linking it somewhere new unlinks it from wherever it was, so
 * a renewal can never be ambiguous about which server it should hit.
 */

import type { ApiCheckResult, ApiConnection, Id } from '@/types';
import type { ApiRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { newId } from '@/lib/utils';
import { removeById, requireById } from './helpers';

/** Rejects a base URL the console could never call. */
function validateBaseUrl(raw: string): string {
  const value = raw.trim().replace(/\/+$/, '');
  if (!value) throw new Error('الدومين مطلوب');
  let parsed: URL;
  try {
    parsed = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    throw new Error('الدومين غير صالح — مثال: https://bgd.silversat.iq');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('الدومين لازم يبدأ بـ http أو https');
  }
  return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname);
}

export class MockApiRepository implements ApiRepository {
  list(): Promise<ApiConnection[]> {
    return mockDb.read(() =>
      [...mockDb.tables.apiConnections].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')),
    );
  }

  async save(
    connection: Omit<ApiConnection, 'id' | 'createdAt' | 'lastCheckAt' | 'lastCheckOk'> & {
      id?: Id;
    },
  ): Promise<ApiConnection> {
    await mockDb.latency();

    if (!connection.nameAr.trim()) throw new Error('اسم الاتصال مطلوب');
    const baseUrl = validateBaseUrl(connection.baseUrl);
    if (!connection.authKey.trim()) throw new Error('الـ Auth Key مطلوب');
    if (!connection.username.trim()) throw new Error('اسم المستخدم مطلوب');
    if (!connection.password.trim()) throw new Error('الرمز مطلوب');

    // Two connections on the same domain and username are the same connection
    // entered twice, which is how a governorate ends up double-charged.
    const clash = mockDb.tables.apiConnections.find(
      (row) =>
        row.id !== connection.id &&
        row.baseUrl.toLowerCase() === baseUrl.toLowerCase() &&
        row.username.trim().toLowerCase() === connection.username.trim().toLowerCase(),
    );
    if (clash) throw new Error(`هذا الدومين مسجل مسبقاً باسم "${clash.nameAr}"`);

    const existing = connection.id
      ? mockDb.tables.apiConnections.find((row) => row.id === connection.id)
      : undefined;

    const saved: ApiConnection = {
      id: existing?.id ?? newId('api'),
      nameAr: connection.nameAr.trim(),
      baseUrl,
      authKey: connection.authKey.trim(),
      username: connection.username.trim(),
      password: connection.password,
      active: connection.active,
      governorateIds: existing?.governorateIds ?? [],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastCheckAt: existing?.lastCheckAt ?? null,
      lastCheckOk: existing?.lastCheckOk ?? null,
      lastCheckMessageAr: existing?.lastCheckMessageAr,
    };

    // Credentials changing invalidates whatever the last check proved.
    if (
      existing &&
      (existing.baseUrl !== saved.baseUrl ||
        existing.authKey !== saved.authKey ||
        existing.username !== saved.username ||
        existing.password !== saved.password)
    ) {
      saved.lastCheckAt = null;
      saved.lastCheckOk = null;
      saved.lastCheckMessageAr = undefined;
    }

    if (existing) {
      const index = mockDb.tables.apiConnections.findIndex((row) => row.id === existing.id);
      mockDb.tables.apiConnections[index] = saved;
    } else {
      mockDb.tables.apiConnections.push(saved);
    }

    mockDb.audit(existing ? 'update' : 'create', 'api', saved.id, `اتصال ${saved.nameAr}`);
    return saved;
  }

  async remove(id: Id): Promise<void> {
    await mockDb.latency();
    const connection = requireById(mockDb.tables.apiConnections, id, 'الاتصال');
    if (connection.governorateIds.length > 0) {
      throw new Error('فك ارتباط المحافظات قبل الحذف');
    }
    removeById(mockDb.tables.apiConnections, id);
    mockDb.audit('delete', 'api', id, `حذف اتصال ${connection.nameAr}`);
  }

  async setGovernorates(id: Id, governorateIds: Id[]): Promise<ApiConnection> {
    await mockDb.latency();
    const connection = requireById(mockDb.tables.apiConnections, id, 'الاتصال');
    for (const governorateId of governorateIds) {
      requireById(mockDb.tables.governorates, governorateId, 'المحافظة');
    }

    const wanted = new Set(governorateIds);
    // One governorate, one connection: take each id away from everyone else.
    for (const other of mockDb.tables.apiConnections) {
      if (other.id === id) continue;
      other.governorateIds = other.governorateIds.filter((gid) => !wanted.has(gid));
    }
    connection.governorateIds = [...wanted];

    mockDb.audit(
      'update',
      'api',
      connection.id,
      `ربط ${wanted.size} محافظة بـ ${connection.nameAr}`,
    );
    return connection;
  }

  async test(id: Id): Promise<ApiCheckResult> {
    await mockDb.latency();
    const connection = requireById(mockDb.tables.apiConnections, id, 'الاتصال');

    // No real request to make, so the mock checks what it can actually see —
    // the shape of the credentials — and reports that honestly.
    const latencyMs = 90 + Math.round(Math.random() * 260);
    let result: ApiCheckResult;

    if (!connection.active) {
      result = { ok: false, messageAr: 'الاتصال معطّل — فعّله قبل الاختبار', latencyMs: 0 };
    } else if (connection.authKey.trim().length < 8) {
      result = { ok: false, messageAr: 'الـ Auth Key قصير — تأكد منه', latencyMs };
    } else if (!connection.baseUrl.startsWith('https://')) {
      result = { ok: false, messageAr: 'الدومين بدون https — الاتصال غير آمن', latencyMs };
    } else {
      result = { ok: true, messageAr: `الاتصال ناجح — ${latencyMs}ms`, latencyMs };
    }

    connection.lastCheckAt = new Date().toISOString();
    connection.lastCheckOk = result.ok;
    connection.lastCheckMessageAr = result.messageAr;

    mockDb.audit('run', 'api', connection.id, `اختبار اتصال ${connection.nameAr} — ${result.messageAr}`);
    return result;
  }
}
