/**
 * App users — the customers.
 *
 * `/app-users` searches (name, phone, email) and filters by province and block
 * state itself, and `/app-users/leaderboard` ranks users with their prediction
 * counts and accuracy. What is left here:
 *
 *  - **`detail`** fans out to devices, predictions and purchased codes so the
 *    detail screen mounts with one call instead of four waterfalls.
 *  - **`leaderboard`** works around the route's paging (see there) and fills in
 *    each row's province, which the route does not return.
 */

import { api, fetchAll } from '@/data/http/client';
import type { AppUser, Code, Device, Id, LeaderboardRow, ListQuery, Page, Prediction } from '@/types';
import type { AppUserDetail, AppUserFilter, AppUserInput, AppUsersRepository } from '../types';
import { HttpCrudRepository, clean, toPage, toRange } from './crud';

/** A row of `/app-users/leaderboard`, as measured against the live API. */
interface LeaderboardEntry {
  rank: number;
  id: Id;
  name: string;
  phone: string;
  points: number;
  predictionCount: number;
  accuracy: number;
}

export class HttpAppUsersRepository
  extends HttpCrudRepository<AppUser, AppUserInput, Partial<AppUserInput>, AppUserFilter>
  implements AppUsersRepository
{
  protected readonly serverSearch = true;

  constructor() {
    super(
      '/app-users',
      (row) =>
        `${row.name} ${row.phone} ${row.email ?? ''} ${row.silversatRegion?.name ?? ''} ${row.silversatRegion?.province?.name ?? ''}`,
    );
  }

  async detail(id: Id): Promise<AppUserDetail> {
    const [user, devices, predictions, purchases] = await Promise.all([
      this.get(id),
      fetchAll<Device>('/devices/all', { appUserId: id }),
      fetchAll<Prediction>('/predictions', { appUserId: id }, 500),
      fetchAll<Code>('/codes', { status: 'sold', soldToAppUserId: id }),
    ]);

    predictions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    purchases.sort((a, b) => (b.soldAt ?? '').localeCompare(a.soldAt ?? ''));
    return { user, devices, predictions, purchases };
  }

  block(id: Id): Promise<AppUser> {
    return api.patch<AppUser>(`/app-users/${id}/block`);
  }

  unblock(id: Id): Promise<AppUser> {
    return api.patch<AppUser>(`/app-users/${id}/unblock`);
  }

  /**
   * Users ranked on points, one page at a time.
   *
   * `/app-users/leaderboard` filters and ranks on the server, but its paging is
   * broken: it ignores `limit` and answers with every row from the top, adding
   * `offset` to each rank. A response longer than the page asked for is that
   * bug, so the page is cut out of it here and the ranks put back. Once the
   * route honours `limit`, the response is already the page and passes through.
   *
   * The rows carry no province, so the users behind the page are read from
   * `/app-users` under the same filter — one request — for their server's
   * province name.
   */
  async leaderboard(query?: ListQuery & { provinceId?: Id }): Promise<Page<LeaderboardRow>> {
    const { limit, offset } = toRange(query);
    const filter = clean({ provinceId: query?.provinceId, search: query?.search?.trim() });

    const [board, users] = await Promise.all([
      api.page<LeaderboardEntry>('/app-users/leaderboard', { ...filter, limit, offset }),
      fetchAll<AppUser>('/app-users', filter),
    ]);

    const rows =
      board.items.length > limit
        ? board.items.slice(offset, offset + limit).map((row) => ({ ...row, rank: row.rank - offset }))
        : board.items;

    const userById = new Map(users.map((user) => [user.id, user]));
    return toPage(
      rows.map((row): LeaderboardRow => {
        const user = userById.get(row.id);
        return {
          rank: row.rank,
          user: user ?? ({ id: row.id, name: row.name, phone: row.phone } as AppUser),
          points: row.points,
          predictionCount: row.predictionCount,
          accuracy: row.accuracy,
        };
      }),
      board.total,
      query,
    );
  }
}
