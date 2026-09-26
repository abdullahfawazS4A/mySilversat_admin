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
  League,
  Match,
  Prediction,
  Province,
  SilversatRegion,
} from '@/types';
import { provinceOfUser, toAmount } from '@/types';
import { ARABIC_MONTHS } from '@/lib/format';
import type { DashboardRepository } from '../types';

/** Asks a list route for its `total` without pulling the rows. */
async function countOf(path: string, query?: Record<string, string | number>): Promise<number> {
  const page = await api.page<unknown>(path, { ...query, limit: 1, offset: 0 });
  return page.total;
}

/**
 * How many fixtures the app is showing as live.
 *
 * Not the `total` of `/matches?status=live`. That counts every row the feed
 * has marked live, and a fixture under a league whose `isActive` is false is
 * hidden from the app entirely. Measured against the live API that is not an
 * edge case: all nine live rows sat under inactive leagues, so the tile read
 * nine where a subscriber could watch none.
 *
 * `/matches/live` is the route that would answer this as a page of one, and it
 * cannot be used here — it is an app-user route, an admin token gets a 401 on
 * it, and `send` clears the stored token on a 401. Reading it from the
 * dashboard would sign the operator out every time the screen loaded.
 *
 * So this counts rows rather than reading a total. It costs no more than the
 * count did: `/matches` joins the league onto every fixture with `isActive` on
 * it, so the answer needs no second request, and live is a handful of rows —
 * one page, not a walk.
 */
async function liveMatchCount(): Promise<number> {
  const rows = await fetchAll<Match>('/matches', { status: 'live' }, 500);
  // A fixture whose league did not come back is left out: without the league
  // there is nothing to say the app is showing it.
  return rows.filter((row) => row.league?.isActive).length;
}

/**
 * Fixtures open for prediction, over the leagues the app shows.
 *
 * Read one league at a time, which looks like the expensive shape and is the
 * cheap one. Three things force it:
 *
 *  - `/matches` accepts `isOpenForPrediction` and ignores it, so the switch
 *    has to be counted over rows rather than asked for.
 *  - `/leagues` accepts `isActive` and ignores it too — `true` and `false`
 *    both answer with all 1,237 rows — so the active set is found by reading
 *    the list, not by filtering it server-side.
 *  - Scheduled fixtures across every league number 8,411 and come back oldest
 *    first. Reading them whole is eighty-five requests; reading a capped
 *    prefix, which is what this did, spends the whole budget on the oldest
 *    fixtures in the archive and never reaches the ones actually open. That is
 *    where 1,958 came from — a slice of the wrong end of the list — against a
 *    true count of 18.
 *
 * Narrowing to the active leagues first collapses all of it: five leagues hold
 * forty-six scheduled fixtures between them, a page each.
 *
 * Sequential rather than parallel, for the reason the fixtures screen gives:
 * the API rate-limits, and a burst buys nothing here.
 */
async function openForPredictionCount(leagues: League[]): Promise<number> {
  let open = 0;
  for (const league of leagues) {
    const rows = await fetchAll<Match>('/matches', { status: 'scheduled', leagueId: league.id }, 500);
    open += rows.filter((row) => row.isOpenForPrediction).length;
  }
  return open;
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
      leagues,
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
      liveMatchCount(),
      fetchAll<League>('/leagues'),
    ]);

    // Unscored picks need the rows, not just a count.
    const pendingPredictions = await fetchAll<Prediction>('/predictions', undefined, 5000);
    const openForPrediction = await openForPredictionCount(
      leagues.filter((league) => league.isActive),
    );

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
      const provinceId = provinceOfUser(user);
      if (provinceId) usersByProvince.set(provinceId, (usersByProvince.get(provinceId) ?? 0) + 1);
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
      openForPrediction,
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
