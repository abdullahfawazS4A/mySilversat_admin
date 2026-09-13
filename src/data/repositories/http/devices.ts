/**
 * Devices.
 *
 * The admin view lives at `/devices/all` — plain `/devices` is scoped to the
 * authenticated app user and would return nothing on an admin token. Reads go
 * to `/devices/all`; writes go to `/devices/{id}`, which is the same row.
 *
 * This is the one collection with a real server-side `search`, so the base
 * class's client-side fallback is bypassed.
 */

import { api, fetchAll } from '@/data/http/client';
import type { Device, Id, ListQuery, Page } from '@/types';
import type { DeviceFilter, DeviceInput, DevicesRepository } from '../types';
import { clean, toPage, toRange } from './crud';

export class HttpDevicesRepository implements DevicesRepository {
  async list(query?: ListQuery & DeviceFilter): Promise<Page<Device>> {
    const { search, page, pageSize, ...filter } = query ?? {};
    const result = await api.page<Device>('/devices/all', {
      ...clean(filter),
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...toRange({ page, pageSize }),
    });
    return toPage(result.items, result.total, { page, pageSize });
  }

  all(filter?: DeviceFilter): Promise<Device[]> {
    return fetchAll<Device>('/devices/all', clean(filter));
  }

  get(id: Id): Promise<Device> {
    return api.get<Device>(`/devices/${id}`);
  }

  create(input: DeviceInput): Promise<Device> {
    return api.post<Device>('/devices', input);
  }

  update(id: Id, input: Partial<DeviceInput>): Promise<Device> {
    return api.patch<Device>(`/devices/${id}`, input);
  }

  async remove(id: Id): Promise<void> {
    await api.delete(`/devices/${id}`);
  }
}
