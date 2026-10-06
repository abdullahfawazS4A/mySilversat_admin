/**
 * The dashboard.
 *
 * One read: `GET /dashboard/summary` computes every figure in SQL (and caches
 * it server-side for ~45s). This screen used to compose the same numbers out
 * of the list routes — whole tables of codes, users and predictions plus a
 * walk over every active league's fixtures — which was up to ~300 requests.
 *
 * Revenue is sold codes valued at their category's `unitPrice`, which is the
 * list price the app charges. It is not payment data — the API has no ledger —
 * so it answers "what did we sell" rather than "what did we collect".
 */

import { api } from '@/data/http/client';
import type { DashboardSummary } from '@/types';
import { ARABIC_MONTHS } from '@/lib/format';
import type { DashboardRepository } from '../types';

/**
 * What `/dashboard/summary` returns, as measured against the live API — the
 * spec lists the route without a response schema. The scalar counts share
 * `DashboardSummary`'s names; the series come back as rows keyed by id.
 */
interface SummaryResponse {
  totalUsers: number;
  blockedUsers: number;
  newUsersThisMonth: number;
  totalDevices: number;
  totalProducts: number;
  totalCategories: number;
  codesAvailable: number;
  codesSold: number;
  codesDisabled: number;
  revenueAllTime: number | string;
  revenueThisMonth: number | string;
  soldThisMonth: number;
  liveMatches: number;
  openForPrediction: number;
  totalPredictions: number;
  pendingScoring: number;
  notificationsSent: number;
  activeRegions: number;
  totalRegions: number;
  /**
   * Governorates no active server serves, added 2026-10-06. The spec names the
   * figure but not its key or shape, so `uncoveredFrom` looks for it rather
   * than trusting a guessed name. TODO: pin the key once read off a live reply.
   */
  [key: string]: unknown;
  /** Last six months, oldest first, `month` as `2026-09`. */
  salesByMonth: { month: string; count: number; revenue: number | string }[];
  usersByProvince: { provinceId: string; provinceName: string; count: number }[];
  salesByCategory: { categoryId: string; name: string; productName: string; count: number }[];
  stockByCategory: {
    categoryId: string;
    name: string;
    productName: string;
    available: number;
    lowStockThreshold: number | null;
  }[];
}

/** SQL sums can arrive as decimal strings; the charts want numbers. */
function num(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** `2026-09` → `أيلول`. */
function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return ARABIC_MONTHS[index] ?? month;
}

function categoryLabel(row: { productName: string; name: string }): string {
  return `${row.productName?.trim() ?? ''} — ${row.name?.trim() ?? ''}`;
}

/**
 * The governorates with no active server, as names.
 *
 * Accepts the key under any of the spellings the backend is likely to have
 * used (`provincesWithoutActiveRegion`, `provincesWithoutRegion`, …), holding a
 * list of names, of `{ name }` rows, or only a count. Null when the reply
 * carries none of them — an older server, or a cached summary from before.
 */
function uncoveredFrom(raw: Record<string, unknown>): { count: number; names: string[] } | null {
  const key = Object.keys(raw).find((name) => /^provinces?without/i.test(name));
  if (!key) return null;
  const value = raw[key];
  if (Array.isArray(value)) {
    const names = value
      .map((row) =>
        typeof row === 'string'
          ? row
          : row && typeof row === 'object'
            ? String((row as { name?: unknown; provinceName?: unknown }).name ??
                (row as { provinceName?: unknown }).provinceName ?? '')
            : '',
      )
      .filter(Boolean);
    return { count: value.length, names };
  }
  if (typeof value === 'number' || typeof value === 'string') return { count: num(value), names: [] };
  return null;
}

function toSummary(raw: SummaryResponse): DashboardSummary {
  const byValueDesc = (a: { value: number }, b: { value: number }) => b.value - a.value;
  const months = raw.salesByMonth ?? [];

  return {
    totalUsers: num(raw.totalUsers),
    blockedUsers: num(raw.blockedUsers),
    newUsersThisMonth: num(raw.newUsersThisMonth),
    totalDevices: num(raw.totalDevices),
    totalProducts: num(raw.totalProducts),
    totalCategories: num(raw.totalCategories),
    codesAvailable: num(raw.codesAvailable),
    codesSold: num(raw.codesSold),
    codesDisabled: num(raw.codesDisabled),
    revenueAllTime: num(raw.revenueAllTime),
    revenueThisMonth: num(raw.revenueThisMonth),
    soldThisMonth: num(raw.soldThisMonth),
    liveMatches: num(raw.liveMatches),
    openForPrediction: num(raw.openForPrediction),
    totalPredictions: num(raw.totalPredictions),
    pendingScoring: num(raw.pendingScoring),
    notificationsSent: num(raw.notificationsSent),
    activeRegions: num(raw.activeRegions),
    totalRegions: num(raw.totalRegions),
    uncoveredProvinces: uncoveredFrom(raw),

    salesTrend: months.map((row) => ({ label: monthLabel(row.month), value: num(row.count) })),
    revenueTrend: months.map((row) => ({ label: monthLabel(row.month), value: num(row.revenue) })),

    usersByProvince: (raw.usersByProvince ?? [])
      .map((row) => ({ label: row.provinceName || '—', value: num(row.count) }))
      .sort(byValueDesc),

    salesByCategory: (raw.salesByCategory ?? [])
      .map((row) => ({ label: categoryLabel(row), value: num(row.count) }))
      .sort(byValueDesc),

    stockByCategory: (raw.stockByCategory ?? [])
      .map((row) => ({
        label: categoryLabel(row),
        value: num(row.available),
        threshold: row.lowStockThreshold,
      }))
      .sort((a, b) => a.value - b.value),
  };
}

/** Where the last summary is kept so a reload can show it while it refreshes. */
const CACHE_KEY = 'silversat.dashboard.summary';

/** Reads the last summary this tab computed, if storage allows it. */
function readCached(): DashboardSummary | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DashboardSummary) : undefined;
  } catch {
    return undefined;
  }
}

function writeCached(summary: DashboardSummary): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(summary));
  } catch {
    // Storage full or blocked — the cache is a convenience, not a requirement.
  }
}

export class HttpDashboardRepository implements DashboardRepository {
  /**
   * The last summary read, so returning to the screen shows numbers at once
   * while the fresh read runs. Session storage carries it across a page
   * reload; the in-memory copy covers a browser that refuses storage.
   */
  private last: DashboardSummary | undefined = readCached();

  cached(): DashboardSummary | undefined {
    return this.last;
  }

  async summary(): Promise<DashboardSummary> {
    const result = toSummary(await api.get<SummaryResponse>('/dashboard/summary'));
    this.last = result;
    writeCached(result);
    return result;
  }
}
