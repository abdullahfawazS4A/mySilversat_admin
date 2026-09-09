/**
 * Mock renewals.
 *
 * Creating a renewal is the one place in the console that touches stock,
 * money, a device expiry and the draw at the same time, so the whole
 * side-effect chain lives here: burn a card out of the subscriber's own
 * governorate -> extend expiry -> record the transaction -> issue a coupon
 * when the package qualifies -> draw down the agent float.
 *
 * The card comes first on purpose. If the governorate is out of stock the
 * whole renewal fails before anything else has moved, rather than leaving an
 * extended subscription that no card paid for.
 */

import type { Id, Page, Renewal } from '@/types';
import type { RenewalListQuery, RenewalRow, RenewalsRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { addMonths, matchesSearch, newId } from '@/lib/utils';
import { daysUntil } from '@/lib/format';
import { paginate, requireById } from './helpers';
import { deriveStatus } from './devices';
import { takeCard } from './stock';

function toRow(renewal: Renewal): RenewalRow {
  const user = mockDb.tables.users.find((u) => u.id === renewal.userId);
  const device = mockDb.tables.devices.find((d) => d.id === renewal.deviceId);
  const agent = renewal.agentId
    ? mockDb.tables.agents.find((a) => a.id === renewal.agentId)
    : undefined;
  const card = renewal.cardId
    ? mockDb.tables.stockCards.find((c) => c.id === renewal.cardId)
    : undefined;
  return {
    ...renewal,
    userName: user?.fullName ?? '—',
    userPhone: user?.phone ?? '—',
    deviceNumber: device?.number ?? '—',
    governorateId: user?.governorateId ?? '',
    agentName: agent?.fullName,
    cardCode: card?.code,
  };
}

export class MockRenewalsRepository implements RenewalsRepository {
  async list(query: RenewalListQuery): Promise<Page<RenewalRow>> {
    await mockDb.latency();
    let rows = mockDb.tables.renewals.map(toRow);

    if (query.method && query.method !== 'all') rows = rows.filter((r) => r.method === query.method);
    if (query.status && query.status !== 'all') rows = rows.filter((r) => r.status === query.status);
    if (query.governorateId) rows = rows.filter((r) => r.governorateId === query.governorateId);
    if (query.agentId) rows = rows.filter((r) => r.agentId === query.agentId);
    if (query.from) rows = rows.filter((r) => r.createdAt >= query.from!);
    if (query.to) rows = rows.filter((r) => r.createdAt <= query.to!);
    if (query.search?.trim()) {
      const needle = query.search.trim();
      rows = rows.filter(
        (r) =>
          matchesSearch(r.userName, needle) ||
          matchesSearch(r.deviceNumber, needle) ||
          r.userPhone.includes(needle.replace(/\s/g, '')),
      );
    }

    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<RenewalRow>;
  }

  async create(input: {
    deviceId: Id;
    packageId: Id;
    method: Renewal['method'];
    agentId?: Id;
    note?: string;
  }): Promise<Renewal> {
    await mockDb.latency();
    const device = requireById(mockDb.tables.devices, input.deviceId, 'الجهاز');
    const pkg = requireById(mockDb.tables.packages, input.packageId, 'الباقة');
    if (input.method === 'cash_agent' && !input.agentId) {
      throw new Error('اختر الوكيل عند الدفع النقدي');
    }

    const owner = requireById(mockDb.tables.users, device.userId, 'المشترك');
    const renewalId = newId('rnw');

    // Stock first: a free grant is the one method that extends a subscription
    // without a card behind it, so it is also the only one that skips this.
    // Anything else throws here when the governorate has run out, before a
    // single expiry date has moved.
    const card =
      input.method === 'free_grant'
        ? null
        : takeCard(owner.governorateId, pkg.months, renewalId, device.id);

    // An expired device restarts from today; an active one is extended from its
    // current expiry so the customer never loses paid days.
    const base = daysUntil(device.expiryAt) < 0 ? new Date().toISOString() : device.expiryAt;
    const expiryBefore = device.expiryAt;
    // A bonus package grants one extra free month on top of what was bought.
    const grantedMonths = pkg.months + (pkg.bonus ? 1 : 0);
    device.expiryAt = addMonths(base, grantedMonths);
    device.periodStartAt = base;
    device.status = deriveStatus(device);

    const renewal: Renewal = {
      id: renewalId,
      userId: device.userId,
      deviceId: device.id,
      packageId: pkg.id,
      months: grantedMonths,
      price: pkg.price,
      method: input.method,
      agentId: input.agentId,
      status: 'completed',
      cardId: card?.id,
      createdAt: new Date().toISOString(),
      expiryBefore,
      expiryAfter: device.expiryAt,
      note: input.note,
    };

    // Qualifying renewals mint a draw coupon into the open draw of this year.
    if (pkg.months >= mockDb.tables.settings.couponMinMonths) {
      const year = new Date().getFullYear().toString();
      const couponId = newId('cpn');
      mockDb.tables.coupons.push({
        id: couponId,
        code: `SLV-${year.slice(2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(mockDb.tables.coupons.length + 1).toString().padStart(5, '0')}`,
        userId: device.userId,
        deviceId: device.id,
        renewalId: renewal.id,
        year,
        active: true,
        issuedAt: renewal.createdAt,
      });
      renewal.couponId = couponId;
    }

    mockDb.tables.renewals.push(renewal);

    if (input.agentId) {
      const agent = requireById(mockDb.tables.agents, input.agentId, 'الوكيل');
      agent.renewalCount += 1;
      agent.balance -= Math.round(pkg.price * (1 - agent.commissionRate));
    }

    const user = mockDb.tables.users.find((u) => u.id === device.userId);
    if (user) {
      user.totalRenewals += 1;
      user.totalSpend += pkg.price;
    }

    mockDb.audit(
      'create',
      'renewal',
      renewal.id,
      card
        ? `تجديد ${grantedMonths} أشهر للجهاز ${device.number} — كارت ${card.code}`
        : `منحة ${grantedMonths} أشهر للجهاز ${device.number} — بدون كارت`,
    );
    return renewal;
  }

  async refund(id: Id, reasonAr: string): Promise<Renewal> {
    await mockDb.latency();
    const renewal = requireById(mockDb.tables.renewals, id, 'التجديد');
    if (renewal.status === 'refunded') throw new Error('هذا التجديد مسترجع مسبقاً');

    renewal.status = 'refunded';
    renewal.note = reasonAr;

    // Roll the device expiry back to what it was before this transaction.
    const device = mockDb.tables.devices.find((d) => d.id === renewal.deviceId);
    if (device) {
      device.expiryAt = renewal.expiryBefore;
      device.status = deriveStatus(device);
    }
    // The card was already activated upstream, so a refund cannot put it back
    // on the shelf. It is marked void instead: the stock count drops for real,
    // and the loss stays visible in the card table rather than disappearing.
    if (renewal.cardId) {
      const card = mockDb.tables.stockCards.find((c) => c.id === renewal.cardId);
      if (card) {
        card.status = 'void';
        card.voidReasonAr = `تجديد مسترجع — ${reasonAr}`;
      }
    }
    // Void the coupon it generated so it cannot enter a draw.
    if (renewal.couponId) {
      const coupon = mockDb.tables.coupons.find((c) => c.id === renewal.couponId);
      if (coupon) {
        coupon.active = false;
        coupon.resultTextAr = 'ملغى — تجديد مسترجع';
      }
    }
    const user = mockDb.tables.users.find((u) => u.id === renewal.userId);
    if (user) {
      user.totalRenewals = Math.max(0, user.totalRenewals - 1);
      user.totalSpend = Math.max(0, user.totalSpend - renewal.price);
    }

    mockDb.audit('update', 'renewal', id, `استرجاع تجديد — ${reasonAr}`);
    return renewal;
  }
}
