/**
 * The dashboard.
 *
 * There is no summary endpoint, so this composes one out of the list routes.
 * Two techniques keep that from being expensive:
 *
 *  - **A count is a page of one.** The envelope carries `total`, so asking for
 *    `limit=1` returns the number without the rows.
 *  - **Only the collections a chart actually reads are fetched whole** — sold
 *    codes for revenue, users for the province split, categories for the
 *    restock queue. Everything else is a count.
 *
 * Revenue is sold codes valued at their category's `unitPrice`, which is the
 * list price the app charges. It is not payment data — the API has no ledger —
 * so it answers "what did we sell" rather than "what did we collect".
 */

import { api, fetchAll } from '@/data/http/client';
import type {
  AppUser,
  Category,
  Code,
  DashboardSummary,
  Id,
  Match,
  Prediction,
  Province,
  SilversatRegion,
} from '@/types';
import { toAmount } from '@/types';
import { ARABIC_MONTHS } from '@/lib/format';
import type { DashboardRepository } from '../types';

/** Asks a list route for its `total` without pulling the rows. */
async function countOf(path: string, query?: Record<string, string | number>): Promise<number> {
  const page = await api.page<unknown>(path, { ...query, limit: 1, offset: 0 });
  return page.total;
}

/** `2026-09` — the bucket key every trend groups on. */
function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** The last `count` months, oldest first, as [key, arabic label] pairs. */
function recentMonths(count: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const month = new Date(cursor);
    month.setUTCMonth(cursor.getUTCMonth() - i);
    out.push({
      key: month.toISOString().slice(0, 7),
      label: ARABIC_MONTHS[month.getUTCMonth()],
    });
  }
  return out;
}

export class HttpDashboardRepository implements DashboardRepository {
  async summary(): Promise<DashboardSummary> {
    const [
      users,
      soldCodes,
      categories,
      provinces,
      regions,
      totalDevices,
      totalProducts,
      codesAvailable,
      codesDisabled,
      totalPredictions,
      notificationsSent,
      liveMatches,
    ] = await Promise.all([
      fetchAll<AppUser>('/app-users'),
      fetchAll<Code>('/codes', { status: 'sold' }, 10000),
      fetchAll<Category>('/categories'),
      fetchAll<Province>('/provinces'),
      fetchAll<SilversatRegion>('/silversat-regions'),
      countOf('/devices/all'),
      countOf('/products'),
      countOf('/codes', { status: 'available' }),
      countOf('/codes', { status: 'disabled' }),
      countOf('/predictions'),
      countOf('/notifications'),
      countOf('/matches', { status: 'live' }),
    ]);

    // Open fixtures and unscored picks both need the rows, not just a count.
    const [openMatches, pendingPredictions] = await Promise.all([
      fetchAll<Match>('/matches', { status: 'scheduled' }, 2000),
      fetchAll<Prediction>('/predictions', undefined, 5000),
    ]);

    const priceOf = new Map(categories.map((row) => [row.id, toAmount(row.unitPrice)]));
    const nameOf = new Map(categories.map((row) => [row.id, `${row.product?.displayName ?? ''} — ${row.name}`]));
    const provinceName = new Map(provinces.map((row) => [row.id, row.name]));

    const thisMonth = monthKey(new Date().toISOString());
    const months = recentMonths(6);

    // ------------------------------------------------------------ money ----
    let revenueAllTime = 0;
    let revenueThisMonth = 0;
    let soldThisMonth = 0;
    const salesByMonth = new Map<string, number>();
    const revenueByMonth = new Map<string, number>();
    const salesByCategory = new Map<Id, number>();

    for (const code of soldCodes) {
      const price = priceOf.get(code.categoryId) ?? 0;
      revenueAllTime += price;
      salesByCategory.set(code.categoryId, (salesByCategory.get(code.categoryId) ?? 0) + 1);

      const when = code.soldAt ?? code.updatedAt;
      const key = monthKey(when);
      salesByMonth.set(key, (salesByMonth.get(key) ?? 0) + 1);
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + price);

      if (key === thisMonth) {
        revenueThisMonth += price;
        soldThisMonth += 1;
      }
    }

    // ------------------------------------------------------------ people ---
    const usersByProvince = new Map<Id, number>();
    let newUsersThisMonth = 0;
    let blockedUsers = 0;
    for (const user of users) {
      usersByProvince.set(user.provinceId, (usersByProvince.get(user.provinceId) ?? 0) + 1);
      if (monthKey(user.createdAt) === thisMonth) newUsersThisMonth += 1;
      if (user.isBlocked) blockedUsers += 1;
    }

    // ------------------------------------------------------------- stock ---
    const availableByCategory = new Map<Id, number>();
    for (const category of categories) availableByCategory.set(category.id, 0);
    const availableRows = await fetchAll<Code>('/codes', { status: 'available' }, 10000);
    for (const code of availableRows) {
      availableByCategory.set(code.categoryId, (availableByCategory.get(code.categoryId) ?? 0) + 1);
    }

    const byValueDesc = (a: { value: number }, b: { value: number }) => b.value - a.value;

    return {
      totalUsers: users.length,
      blockedUsers,
      newUsersThisMonth,
      totalDevices,
      totalProducts,
      totalCategories: categories.length,
      codesAvailable,
      codesSold: soldCodes.length,
      codesDisabled,
      revenueAllTime,
      revenueThisMonth,
      soldThisMonth,
      liveMatches,
      openForPrediction: openMatches.filter((match) => match.isOpenForPrediction).length,
      totalPredictions,
      pendingScoring: pendingPredictions.filter(
        (row) => row.pointsEarned === null && row.match?.status === 'finished',
      ).length,
      notificationsSent,
      activeRegions: regions.filter((row) => row.isActive).length,
      totalRegions: regions.length,

      salesTrend: months.map(({ key, label }) => ({ label, value: salesByMonth.get(key) ?? 0 })),
      revenueTrend: months.map(({ key, label }) => ({ label, value: revenueByMonth.get(key) ?? 0 })),

      usersByProvince: [...usersByProvince.entries()]
        .map(([id, value]) => ({ label: provinceName.get(id) ?? '—', value }))
        .sort(byValueDesc),

      salesByCategory: [...salesByCategory.entries()]
        .map(([id, value]) => ({ label: nameOf.get(id) ?? '—', value }))
        .sort(byValueDesc),

      stockByCategory: categories
        .map((category) => ({
          label: `${category.product?.displayName ?? ''} — ${category.name}`,
          value: availableByCategory.get(category.id) ?? 0,
          threshold: category.lowStockThreshold,
        }))
        .sort((a, b) => a.value - b.value),
    };
  }
}
