/**
 * SilverSat regions — the upstream servers that actually activate codes.
 *
 * The health checks are the reason this is not a plain CRUD collection: the
 * vendor is a third party, so "is the region configured" and "is the region
 * reachable right now" are different questions, and only `check` answers the
 * second one.
 *
 * Credentials are **write-only**. The API accepts `baseUrl`, `authKey`,
 * `userId` and `password` and never gives any of them back — not on the list,
 * not on a single read, not to a super admin. So a region read from here
 * carries a name and two flags, and anything that wants to show its address
 * has to get it from a check result, which is the one response that includes
 * one.
 */

import { api, fetchAll } from '@/data/http/client';
import type { Id, RegionCheckResult, SilversatRegion } from '@/types';
import type { RegionInput, RegionsRepository } from '../types';
import { HttpCrudRepository } from './crud';

/** The check route's row, as the API actually sends it. */
interface CheckRow {
  regionId?: unknown;
  id?: unknown;
  name?: unknown;
  baseUrl?: unknown;
  ok?: unknown;
  success?: unknown;
  healthy?: unknown;
  token?: unknown;
  latencyMs?: unknown;
  /** The vendor's own sentence on success. */
  info?: unknown;
  /** The vendor's own sentence on failure. Null when it succeeded. */
  error?: unknown;
  message?: unknown;
}

/** The first of these that is actually a string. */
function firstString(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

/**
 * Pulls an ok/message pair out of a check row.
 *
 * The vendor's sentence arrives under `error` when the check failed and under
 * `info` when it passed, and it is the only thing that says *why* a server is
 * down. Reading `message` alone — which is what this did — meant every failure
 * rendered as a red pill with no reason beside it.
 */
function normalise(fallbackId: Id, fallbackName: string, raw: unknown): RegionCheckResult {
  const body = (raw ?? {}) as CheckRow;

  const ok =
    typeof body.ok === 'boolean'
      ? body.ok
      : typeof body.success === 'boolean'
        ? body.success
        : typeof body.healthy === 'boolean'
          ? body.healthy
          : Boolean(body.token);

  return {
    id: firstString(body.regionId, body.id) ?? fallbackId,
    name: firstString(body.name) ?? fallbackName,
    baseUrl: firstString(body.baseUrl),
    ok,
    message: firstString(body.error, body.message, body.info),
    latencyMs: typeof body.latencyMs === 'number' ? body.latencyMs : undefined,
  };
}

export class HttpRegionsRepository
  extends HttpCrudRepository<SilversatRegion, RegionInput>
  implements RegionsRepository
{
  constructor() {
    // Only the name is searchable, because it is the only text a region row
    // comes back with — the address and the user are write-only upstream.
    super('/silversat-regions', (row) => row.name);
  }

  async check(id: Id): Promise<RegionCheckResult> {
    const started = performance.now();
    const raw = await api.post<unknown>(`/silversat-regions/${id}/check`);
    const result = normalise(id, '', raw);
    return { ...result, latencyMs: result.latencyMs ?? Math.round(performance.now() - started) };
  }

  /**
   * Checks every region at once.
   *
   * The rows come back in the order the server finished them, not the order it
   * was asked — a slow region sinks to the bottom — and each one names its own
   * `regionId`. Zipping them onto the regions list by position, which is what
   * this used to do, therefore hung most of the results on the wrong server:
   * with twelve regions the two orders agreed on two of them. So the id on the
   * row is what identifies it, and a row without one is dropped rather than
   * guessed at.
   */
  async checkAll(): Promise<RegionCheckResult[]> {
    const raw = await api.post<unknown>('/silversat-regions/check-all');
    // The route answers with a list, but has been seen wrapping it in `results`.
    const rows = Array.isArray(raw) ? raw : ((raw as { results?: unknown[] })?.results ?? []);

    const results = rows.map((row) => normalise('', '', row)).filter((row) => row.id);

    // A name is only filled in when the row left one out; the check route sends
    // one, so this is a fallback rather than the normal path.
    if (results.every((row) => row.name)) return results;
    const regions = await fetchAll<SilversatRegion>('/silversat-regions');
    const nameById = new Map(regions.map((row) => [row.id, row.name]));
    return results.map((row) => ({ ...row, name: row.name || (nameById.get(row.id) ?? '') }));
  }
}
