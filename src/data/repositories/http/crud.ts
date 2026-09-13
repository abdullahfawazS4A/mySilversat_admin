/**
 * The generic REST collection.
 *
 * Nearly every resource on this API is the same six routes over one path, so
 * they share this class instead of repeating the same file fifteen times. The
 * only things a subclass usually needs are the path and a filter type.
 *
 * Two translations happen here and nowhere else:
 *
 *  - **Paging.** The UI thinks in one-based pages; the API takes `limit` and
 *    `offset`. The conversion lives in `toRange`/`toPage`.
 *  - **Search.** Only a couple of routes filter server-side, so `search` is
 *    applied over the fetched rows by `searchable()`. A subclass that *does*
 *    have a server-side search overrides `list` and passes it through.
 */

import { api, clampPageSize, fetchAll, type Query } from '@/data/http/client';
import type { Id, ListQuery, Page } from '@/types';
import { matchesSearch } from '@/lib/utils';
import type { CrudRepository } from '../types';

export const DEFAULT_PAGE_SIZE = 20;

/**
 * The page size a query actually gets.
 *
 * Clamped to what the API allows, and used by both `toRange` and `toPage` so
 * the offset, the request and the pager all agree on one number — a range
 * built from 500 while the pager reports 100 would skip four pages of rows.
 */
function sizeOf(query: ListQuery | undefined): number {
  return clampPageSize(query?.pageSize ?? DEFAULT_PAGE_SIZE);
}

/** Converts a one-based page query into the API's limit/offset pair. */
export function toRange(query: ListQuery | undefined): { limit: number; offset: number } {
  const pageSize = sizeOf(query);
  const page = Math.max(1, query?.page ?? 1);
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

/** Wraps rows in the page envelope the tables render. */
export function toPage<T>(items: T[], total: number, query: ListQuery | undefined): Page<T> {
  return {
    items,
    total,
    page: Math.max(1, query?.page ?? 1),
    pageSize: sizeOf(query),
  };
}

/**
 * Pages a list that has to be filtered client-side.
 *
 * The whole collection is fetched, filtered, then sliced — which is correct
 * rather than fast. Every collection that needs this is reference data
 * (provinces, categories, leagues); the big tables all filter server-side.
 */
export function localPage<T>(
  rows: T[],
  query: ListQuery | undefined,
  search: (row: T) => string,
): Page<T> {
  const needle = query?.search?.trim();
  const filtered = needle ? rows.filter((row) => matchesSearch(search(row), needle)) : rows;
  const { limit, offset } = toRange(query);
  return toPage(filtered.slice(offset, offset + limit), filtered.length, query);
}

/** Drops undefined keys so they never reach the query string. */
export function clean(filter: object | undefined): Query {
  const out: Query = {};
  for (const [key, value] of Object.entries(filter ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value as Query[string];
  }
  return out;
}

/**
 * A REST collection at `path`.
 *
 * `searchable` is what a client-side `search` matches against. Leaving it
 * undefined means the resource has no text search, and `search` is ignored.
 */
export class HttpCrudRepository<T, C, U = Partial<C>, F extends object = Record<string, never>>
  implements CrudRepository<T, C, U, F>
{
  constructor(
    protected readonly path: string,
    protected readonly searchable?: (row: T) => string,
  ) {}

  /** Query params sent on list/all. Subclasses widen this when needed. */
  protected filterQuery(filter: F | undefined): Query {
    return clean(filter);
  }

  async list(query?: ListQuery & F): Promise<Page<T>> {
    const { search, page, pageSize, ...filter } = (query ?? {}) as ListQuery & Record<string, unknown>;
    const filterQuery = this.filterQuery(filter as F);

    // A text search has to see every row, since the API cannot do it for us.
    if (search?.trim() && this.searchable) {
      const rows = await fetchAll<T>(this.path, filterQuery);
      return localPage(rows, { search, page, pageSize }, this.searchable);
    }

    const range = toRange({ page, pageSize });
    const result = await api.page<T>(this.path, { ...filterQuery, ...range });
    return toPage(result.items, result.total, { page, pageSize });
  }

  all(filter?: F): Promise<T[]> {
    return fetchAll<T>(this.path, this.filterQuery(filter));
  }

  get(id: Id): Promise<T> {
    return api.get<T>(`${this.path}/${id}`);
  }

  create(input: C): Promise<T> {
    return api.post<T>(this.path, input);
  }

  update(id: Id, input: U): Promise<T> {
    return api.patch<T>(`${this.path}/${id}`, input);
  }

  async remove(id: Id): Promise<void> {
    await api.delete(`${this.path}/${id}`);
  }
}
