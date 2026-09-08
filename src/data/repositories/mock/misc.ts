/**
 * Mock notifications, agents, admin accounts, audit and the dashboard rollup.
 *
 * These are grouped because each is small; splitting them further would add
 * files without adding clarity.
 */

import type {
  Agent,
  AdminUser,
  AppSettings,
  AuditEntry,
  DashboardSummary,
  Id,
  ListQuery,
  NotificationCampaign,
  Page,
} from '@/types';
import type {
  AdminRepository,
  AgentsRepository,
  NotificationsRepository,
} from '../types';
import { mockDb } from '@/data/mockDb';
import { matchesSearch, sameMonth, sumBy } from '@/lib/utils';
import { ARABIC_MONTHS } from '@/lib/format';
import { paginate, removeById, requireById, upsert } from './helpers';
import { deriveStatus } from './devices';

// --------------------------------------------------------- notifications ----

export class MockNotificationsRepository implements NotificationsRepository {
  async list(query: ListQuery): Promise<Page<NotificationCampaign>> {
    await mockDb.latency();
    let rows = [...mockDb.tables.campaigns];
    if (query.search?.trim()) {
      rows = rows.filter(
        (c) => matchesSearch(c.titleAr, query.search!) || matchesSearch(c.bodyAr, query.search!),
      );
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<NotificationCampaign>;
  }

  async save(
    campaign: Omit<NotificationCampaign, 'id' | 'createdAt' | 'createdBy'> & { id?: Id },
  ): Promise<NotificationCampaign> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.campaigns, campaign, 'cmp', {
      ...campaign,
      createdAt: new Date().toISOString(),
      createdBy: mockDb.currentAdmin?.id ?? 'system',
    } as Omit<NotificationCampaign, 'id'>);
    mockDb.audit(campaign.id ? 'update' : 'create', 'campaign', saved.id, `إشعار: ${saved.titleAr}`);
    return saved;
  }

  async remove(id: Id): Promise<void> {
    await mockDb.latency();
    const campaign = requireById(mockDb.tables.campaigns, id, 'الإشعار');
    if (campaign.state === 'sent') throw new Error('لا يمكن حذف إشعار مُرسل');
    removeById(mockDb.tables.campaigns, id);
    mockDb.audit('delete', 'campaign', id, `حذف إشعار: ${campaign.titleAr}`);
  }

  async audienceSize(
    audience: NotificationCampaign['audience'],
    targetIds: Id[],
  ): Promise<number> {
    await mockDb.latency();
    const users = mockDb.tables.users.filter((u) => u.status === 'active');
    switch (audience) {
      case 'all':
        return users.length;
      case 'governorate':
        return users.filter((u) => targetIds.includes(u.governorateId)).length;
      case 'single_user':
        return targetIds.length;
      case 'expiring_soon': {
        const owners = new Set(
          mockDb.tables.devices.filter((d) => deriveStatus(d) === 'expiring').map((d) => d.userId),
        );
        return users.filter((u) => owners.has(u.id)).length;
      }
      case 'expired': {
        const owners = new Set(
          mockDb.tables.devices.filter((d) => deriveStatus(d) === 'expired').map((d) => d.userId),
        );
        return users.filter((u) => owners.has(u.id)).length;
      }
      case 'predictors': {
        const predictors = new Set(mockDb.tables.predictions.map((p) => p.userId));
        return users.filter((u) => predictors.has(u.id)).length;
      }
      default:
        return 0;
    }
  }

  async send(id: Id): Promise<NotificationCampaign> {
    await mockDb.latency();
    const campaign = requireById(mockDb.tables.campaigns, id, 'الإشعار');
    if (campaign.state === 'sent') throw new Error('هذا الإشعار مُرسل مسبقاً');

    campaign.audienceSize = await this.audienceSize(campaign.audience, campaign.targetIds);
    if (campaign.audienceSize === 0) throw new Error('الجمهور المستهدف فارغ');

    campaign.state = 'sent';
    campaign.sentAt = new Date().toISOString();
    // Plausible delivery/open rates so the campaign table is not all zeroes.
    campaign.deliveredCount = Math.round(campaign.audienceSize * (0.9 + Math.random() * 0.08));
    campaign.openedCount = Math.round(campaign.deliveredCount * (0.35 + Math.random() * 0.25));

    mockDb.audit('send', 'campaign', id, `إرسال إشعار "${campaign.titleAr}" إلى ${campaign.audienceSize} مشترك`);
    return campaign;
  }
}

// ---------------------------------------------------------------- agents ----

export class MockAgentsRepository implements AgentsRepository {
  async list(
    query: ListQuery & { governorateId?: Id; active?: boolean | 'all' },
  ): Promise<Page<Agent>> {
    await mockDb.latency();
    let rows = [...mockDb.tables.agents];
    if (query.governorateId) rows = rows.filter((a) => a.governorateId === query.governorateId);
    if (typeof query.active === 'boolean') rows = rows.filter((a) => a.active === query.active);
    if (query.search?.trim()) {
      rows = rows.filter(
        (a) => matchesSearch(a.fullName, query.search!) || a.phone.includes(query.search!.replace(/\s/g, '')),
      );
    }
    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<Agent>;
  }

  async save(
    agent: Omit<Agent, 'id' | 'createdAt' | 'renewalCount'> & { id?: Id },
  ): Promise<Agent> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.agents, agent, 'agt', {
      ...agent,
      createdAt: new Date().toISOString(),
      renewalCount: 0,
    } as Omit<Agent, 'id'>);
    mockDb.audit(agent.id ? 'update' : 'create', 'agent', saved.id, `وكيل: ${saved.fullName}`);
    return saved;
  }

  async remove(id: Id): Promise<void> {
    await mockDb.latency();
    const agent = requireById(mockDb.tables.agents, id, 'الوكيل');
    if (mockDb.tables.renewals.some((r) => r.agentId === id)) {
      throw new Error('لا يمكن حذف وكيل عليه تجديدات — عطّله بدل الحذف');
    }
    removeById(mockDb.tables.agents, id);
    mockDb.audit('delete', 'agent', id, `حذف وكيل: ${agent.fullName}`);
  }

  async adjustBalance(id: Id, delta: number, reasonAr: string): Promise<Agent> {
    await mockDb.latency();
    const agent = requireById(mockDb.tables.agents, id, 'الوكيل');
    agent.balance += delta;
    mockDb.audit(
      'update',
      'agent',
      id,
      `${delta >= 0 ? 'شحن' : 'خصم'} رصيد الوكيل ${agent.fullName} — ${reasonAr}`,
    );
    return agent;
  }
}

// ----------------------------------------- admins, audit, settings, stats ----

export class MockAdminRepository implements AdminRepository {
  admins(): Promise<AdminUser[]> {
    return mockDb.read(() => [...mockDb.tables.admins]);
  }

  async saveAdmin(
    admin: Omit<AdminUser, 'id' | 'createdAt' | 'lastLoginAt'> & { id?: Id },
  ): Promise<AdminUser> {
    await mockDb.latency();
    const clash = mockDb.tables.admins.find(
      (a) => a.username === admin.username && a.id !== admin.id,
    );
    if (clash) throw new Error('اسم المستخدم محجوز');

    const saved = upsert(mockDb.tables.admins, admin, 'adm', {
      ...admin,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    } as Omit<AdminUser, 'id'>);
    mockDb.audit(admin.id ? 'update' : 'create', 'admin', saved.id, `مستخدم إداري: ${saved.fullName}`);
    return saved;
  }

  async removeAdmin(id: Id): Promise<void> {
    await mockDb.latency();
    const admin = requireById(mockDb.tables.admins, id, 'المستخدم الإداري');
    if (admin.id === mockDb.currentAdmin?.id) throw new Error('لا يمكنك حذف حسابك الحالي');
    if (admin.role === 'owner' && mockDb.tables.admins.filter((a) => a.role === 'owner').length === 1) {
      throw new Error('لا يمكن حذف آخر مالك للنظام');
    }
    removeById(mockDb.tables.admins, id);
    mockDb.audit('delete', 'admin', id, `حذف مستخدم إداري: ${admin.fullName}`);
  }

  async audit(query: ListQuery & { adminId?: Id; entityType?: string }): Promise<Page<AuditEntry>> {
    await mockDb.latency();
    let rows = [...mockDb.tables.audit];
    if (query.adminId) rows = rows.filter((e) => e.adminId === query.adminId);
    if (query.entityType) rows = rows.filter((e) => e.entityType === query.entityType);
    if (query.search?.trim()) {
      rows = rows.filter(
        (e) => matchesSearch(e.summaryAr, query.search!) || matchesSearch(e.adminName, query.search!),
      );
    }
    rows.sort((a, b) => b.at.localeCompare(a.at));
    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<AuditEntry>;
  }

  settings(): Promise<AppSettings> {
    return mockDb.read(() => ({ ...mockDb.tables.settings }));
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    await mockDb.latency();
    mockDb.tables.settings = { ...settings };
    // Re-derive every device status: changing the warning window moves the line
    // between "active" and "expiring soon".
    for (const device of mockDb.tables.devices) device.status = deriveStatus(device);
    mockDb.audit('update', 'settings', 'global', 'تعديل إعدادات النظام');
    return mockDb.tables.settings;
  }

  async dashboard(): Promise<DashboardSummary> {
    await mockDb.latency();
    const { users, devices, renewals, matches, predictions, coupons, draws, packages } = mockDb.tables;
    const now = new Date().toISOString();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const completed = renewals.filter((r) => r.status === 'completed');
    const thisMonth = completed.filter((r) => sameMonth(r.createdAt, now));
    const prevMonth = completed.filter((r) => sameMonth(r.createdAt, lastMonth.toISOString()));

    // Twelve-month trend, oldest first.
    const revenueTrend: { label: string; value: number }[] = [];
    const renewalTrend: { label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const cursor = new Date();
      cursor.setMonth(cursor.getMonth() - i);
      const bucket = completed.filter((r) => sameMonth(r.createdAt, cursor.toISOString()));
      const label = ARABIC_MONTHS[cursor.getMonth()];
      revenueTrend.push({ label, value: sumBy(bucket, (r) => r.price) });
      renewalTrend.push({ label, value: bucket.length });
    }

    const byGov = new Map<string, number>();
    for (const user of users) byGov.set(user.governorateId, (byGov.get(user.governorateId) ?? 0) + 1);
    const usersByGovernorate = [...byGov.entries()]
      .map(([governorateId, value]) => ({
        governorateId,
        label: mockDb.tables.governorates.find((g) => g.id === governorateId)?.nameAr ?? '—',
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const byPackage = new Map<string, number>();
    for (const renewal of completed) {
      byPackage.set(renewal.packageId, (byPackage.get(renewal.packageId) ?? 0) + 1);
    }
    const renewalsByPackage = [...byPackage.entries()]
      .map(([packageId, value]) => {
        const pkg = packages.find((p) => p.id === packageId);
        return { label: pkg ? `${pkg.months} أشهر` : 'منحة مجانية', value };
      })
      .sort((a, b) => b.value - a.value);

    const methodLabels: Record<string, string> = {
      kcard: 'كي كارد',
      cash_agent: 'نقدي (وكيل)',
      online: 'دفع إلكتروني',
      free_grant: 'منحة مجانية',
    };
    const byMethod = new Map<string, number>();
    for (const renewal of completed) {
      byMethod.set(renewal.method, (byMethod.get(renewal.method) ?? 0) + 1);
    }
    const renewalsByMethod = [...byMethod.entries()]
      .map(([method, value]) => ({ label: methodLabels[method] ?? method, value }))
      .sort((a, b) => b.value - a.value);

    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const statuses = devices.map(deriveStatus);

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === 'active').length,
      blockedUsers: users.filter((u) => u.status === 'blocked').length,
      newUsersThisMonth: users.filter((u) => sameMonth(u.joinedAt, now)).length,
      totalDevices: devices.length,
      activeDevices: statuses.filter((s) => s === 'active').length,
      expiringDevices: statuses.filter((s) => s === 'expiring').length,
      expiredDevices: statuses.filter((s) => s === 'expired').length,
      renewalsThisMonth: thisMonth.length,
      revenueThisMonth: sumBy(thisMonth, (r) => r.price),
      revenueLastMonth: sumBy(prevMonth, (r) => r.price),
      openPredictionMatches: matches.filter((m) => m.openForPredict && m.state === 'scheduled').length,
      liveMatches: matches.filter((m) => m.state === 'live').length,
      predictionsThisWeek: predictions.filter((p) => p.createdAt >= weekAgo).length,
      couponsIssued: coupons.filter((c) => c.active).length,
      pendingDraws: draws.filter((d) => d.state === 'open' || d.state === 'drawn').length,
      revenueTrend,
      renewalTrend,
      usersByGovernorate,
      renewalsByPackage,
      renewalsByMethod,
    };
  }

  async resetMockData(): Promise<void> {
    await mockDb.latency();
    const admin = mockDb.currentAdmin;
    mockDb.reset();
    mockDb.currentAdmin = admin;
    mockDb.audit('run', 'system', 'mock', 'إعادة تحميل البيانات التجريبية');
  }
}
