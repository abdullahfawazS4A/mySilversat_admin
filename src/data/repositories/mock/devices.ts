/** Mock receivers: the global device table plus support actions. */

import type { Device, Id, Page } from '@/types';
import type { DeviceListQuery, DeviceRow, DevicesRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { addMonths, matchesSearch, newId } from '@/lib/utils';
import { paginate, removeById, requireById } from './helpers';
import { daysUntil } from '@/lib/format';

/**
 * Derives the status a device should have from its expiry, unless an operator
 * has suspended it — a suspension always wins over the date.
 */
export function deriveStatus(device: Device): Device['status'] {
  if (device.status === 'suspended') return 'suspended';
  const left = daysUntil(device.expiryAt);
  const warnAt = mockDb.tables.settings.expiryWarningDays;
  if (left < 0) return 'expired';
  if (left <= warnAt) return 'expiring';
  return 'active';
}

function toRow(device: Device): DeviceRow {
  const owner = mockDb.tables.users.find((u) => u.id === device.userId);
  return {
    ...device,
    status: deriveStatus(device),
    ownerName: owner?.fullName ?? '—',
    ownerPhone: owner?.phone ?? '—',
    governorateId: owner?.governorateId ?? '',
  };
}

export class MockDevicesRepository implements DevicesRepository {
  async list(query: DeviceListQuery): Promise<Page<DeviceRow>> {
    await mockDb.latency();
    let rows = mockDb.tables.devices.map(toRow);

    if (query.userId) rows = rows.filter((d) => d.userId === query.userId);
    if (query.status && query.status !== 'all') rows = rows.filter((d) => d.status === query.status);
    if (query.governorateId) rows = rows.filter((d) => d.governorateId === query.governorateId);
    if (query.search?.trim()) {
      const needle = query.search.trim();
      rows = rows.filter(
        (d) =>
          matchesSearch(d.number, needle) ||
          matchesSearch(d.name, needle) ||
          matchesSearch(d.ownerName, needle) ||
          d.ownerPhone.includes(needle.replace(/\s/g, '')),
      );
    }

    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<DeviceRow>;
  }

  async get(id: Id): Promise<DeviceRow> {
    await mockDb.latency();
    return toRow(requireById(mockDb.tables.devices, id, 'الجهاز'));
  }

  async save(device: Device): Promise<Device> {
    await mockDb.latency();
    const row = requireById(mockDb.tables.devices, device.id, 'الجهاز');
    Object.assign(row, device);
    row.status = deriveStatus(row);
    mockDb.audit('update', 'device', row.id, `تعديل الجهاز ${row.number}`);
    return row;
  }

  async create(input: Omit<Device, 'id' | 'createdAt' | 'status'>): Promise<Device> {
    await mockDb.latency();
    if (mockDb.tables.devices.some((d) => d.number === input.number)) {
      throw new Error('رقم الجهاز مسجّل مسبقاً');
    }
    const device: Device = {
      ...input,
      id: newId('dev'),
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    device.status = deriveStatus(device);
    mockDb.tables.devices.push(device);
    mockDb.audit('create', 'device', device.id, `إضافة جهاز ${device.number}`);
    return device;
  }

  async remove(id: Id): Promise<void> {
    await mockDb.latency();
    const device = requireById(mockDb.tables.devices, id, 'الجهاز');
    if (mockDb.tables.renewals.some((r) => r.deviceId === id)) {
      throw new Error('لا يمكن حذف جهاز عليه تجديدات — علّقه بدل الحذف');
    }
    removeById(mockDb.tables.devices, id);
    mockDb.audit('delete', 'device', id, `حذف الجهاز ${device.number}`);
  }

  async setSuspended(id: Id, suspended: boolean, reason?: string): Promise<Device> {
    await mockDb.latency();
    const device = requireById(mockDb.tables.devices, id, 'الجهاز');
    if (suspended) {
      device.status = 'suspended';
      device.suspendReason = reason;
    } else {
      device.suspendReason = undefined;
      device.status = 'active';
      device.status = deriveStatus(device);
    }
    mockDb.audit('update', 'device', id, `${suspended ? 'تعليق' : 'إعادة تفعيل'} الجهاز ${device.number}`);
    return device;
  }

  async transfer(id: Id, toUserId: Id): Promise<Device> {
    await mockDb.latency();
    const device = requireById(mockDb.tables.devices, id, 'الجهاز');
    const target = requireById(mockDb.tables.users, toUserId, 'المشترك');
    const fromUserId = device.userId;
    device.userId = toUserId;
    // Renewal history follows the box, not the account, so support can still
    // trace a disputed payment after a transfer.
    for (const renewal of mockDb.tables.renewals) {
      if (renewal.deviceId === id) renewal.userId = toUserId;
    }
    for (const coupon of mockDb.tables.coupons) {
      if (coupon.deviceId === id) coupon.userId = toUserId;
    }
    mockDb.audit('update', 'device', id, `نقل الجهاز ${device.number} من ${fromUserId} إلى ${target.fullName}`);
    return device;
  }

  async grantMonths(id: Id, months: number, reasonAr: string): Promise<Device> {
    await mockDb.latency();
    const device = requireById(mockDb.tables.devices, id, 'الجهاز');
    const base = daysUntil(device.expiryAt) < 0 ? new Date().toISOString() : device.expiryAt;
    const before = device.expiryAt;
    device.expiryAt = addMonths(base, months);
    device.status = deriveStatus(device);

    // A grant is still a renewal row so it shows in the device history and in
    // revenue reports as a zero-value transaction.
    mockDb.tables.renewals.push({
      id: newId('rnw'),
      userId: device.userId,
      deviceId: device.id,
      packageId: 'grant',
      months,
      price: 0,
      method: 'free_grant',
      status: 'completed',
      createdAt: new Date().toISOString(),
      expiryBefore: before,
      expiryAfter: device.expiryAt,
      note: reasonAr,
    });
    mockDb.audit('update', 'device', id, `منح ${months} أشهر مجانية للجهاز ${device.number} — ${reasonAr}`);
    return device;
  }
}
