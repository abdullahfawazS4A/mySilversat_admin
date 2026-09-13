/**
 * Reading a whole list out of a paged repository.
 *
 * The CSV exports need every row, and the obvious way to ask for that —
 * `pageSize: 100000` — is a request the API refuses outright: every list DTO
 * validates `limit` as 1..100, so an oversized page is a 400 rather than a big
 * answer. The pages are walked instead, at the largest size it will accept.
 *
 * The caller composes the query itself and spreads the paging in, which keeps
 * each resource's own filters fully typed at the call site:
 *
 *     collectAll((paging) => repos.predictions.list({ matchId, ...paging }))
 *
 * The cap is a guard, not a policy: it stops a runaway table from freezing the
 * browser, and hitting it simply returns fewer rows than the server's `total`.
 */

import { MAX_PAGE_SIZE } from '@/data/http/client';
import type { Page } from '@/types';

/** Rows per request while collecting — the most the API will hand over. */
const PAGE_SIZE = MAX_PAGE_SIZE;

export async function collectAll<T>(
  fetchPage: (paging: { page: number; pageSize: number }) => Promise<Page<T>>,
  cap = 5000,
): Promise<T[]> {
  const out: T[] = [];

  for (let page = 1; out.length < cap; page += 1) {
    const result = await fetchPage({ page, pageSize: PAGE_SIZE });
    out.push(...result.items);
    // Stop on a short page as well as on the total, since a total that is
    // computed rather than counted can disagree with what was returned.
    if (result.items.length < PAGE_SIZE || out.length >= result.total) break;
  }

  return out;
}
