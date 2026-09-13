/**
 * SilverSat regions — the upstream servers that actually activate codes.
 *
 * The health checks are the reason this is not a plain CRUD collection: the
 * vendor is a third party, so "is the region configured" and "is the region
 * reachable right now" are different questions, and only `check` answers the
 * second one.
 *
 * The vendor's reply shape is not documented, so `normalise` reads whichever
 * of the usual keys is present rather than trusting one.
 */

import { api } from '@/data/http/client';
import type { Id, RegionCheckResult, SilversatRegion } from '@/types';
import type { RegionInput, RegionsRepository } from '../types';
import { HttpCrudRepository } from './crud';

/** Pulls an ok/message pair out of whatever the check route returned. */
function normalise(id: Id, name: string, raw: unknown): RegionCheckResult {
  const body = (raw ?? {}) as Record<string, unknown>;
  const ok =
    typeof body.ok === 'boolean'
      ? body.ok
      : typeof body.success === 'boolean'
        ? body.success
        : typeof body.healthy === 'boolean'
          ? body.healthy
          : Boolean(body.token);

  const message =
    typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error
        : undefined;

  return {
    id: typeof body.id === 'string' ? body.id : id,
    name: typeof body.name === 'string' ? body.name : name,
    ok,
    message,
    latencyMs: typeof body.latencyMs === 'number' ? body.latencyMs : undefined,
  };
}

export class HttpRegionsRepository
  extends HttpCrudRepository<SilversatRegion, RegionInput>
  implements RegionsRepository
{
  constructor() {
    super('/silversat-regions', (row) => `${row.name} ${row.baseUrl ?? ''} ${row.userId ?? ''}`);
  }

  async check(id: Id): Promise<RegionCheckResult> {
    const started = performance.now();
    const raw = await api.post<unknown>(`/silversat-regions/${id}/check`);
    const result = normalise(id, '', raw);
    return { ...result, latencyMs: result.latencyMs ?? Math.round(performance.now() - started) };
  }

  async checkAll(): Promise<RegionCheckResult[]> {
    const raw = await api.post<unknown>('/silversat-regions/check-all');
    // The route answers with a list, but has been seen wrapping it in `results`.
    const rows = Array.isArray(raw)
      ? raw
      : ((raw as { results?: unknown[] })?.results ?? []);
    return rows.map((row, index) => normalise(String(index), '', row));
  }
}
