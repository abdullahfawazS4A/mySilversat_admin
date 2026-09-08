/** Shared paging/sorting helpers used by every mock repository. */

import type { ListQuery, Page } from '@/types';
import { newId } from '@/lib/utils';

/** Applies sort, then slices the page. Filtering happens before this. */
export function paginate<T extends Record<string, unknown>>(
  items: T[],
  query: ListQuery | undefined,
): Page<T> {
  const page = query?.page ?? 1;
  const pageSize = query?.pageSize ?? 25;
  let rows = items;

  if (query?.sortBy) {
    const key = query.sortBy;
    const dir = query.sortDir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ar') * dir;
    });
  }

  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

/**
 * Upserts into a table. Returns the stored record so callers always get the
 * generated id back — the same contract a REST POST/PUT would have.
 */
export function upsert<T extends { id: string }>(
  table: T[],
  input: Partial<T> & { id?: string },
  idPrefix: string,
  defaults: Omit<T, 'id'>,
): T {
  if (input.id) {
    const index = table.findIndex((row) => row.id === input.id);
    if (index >= 0) {
      const merged = { ...table[index], ...input } as T;
      table[index] = merged;
      return merged;
    }
  }
  const created = { ...defaults, ...input, id: input.id ?? newId(idPrefix) } as T;
  table.push(created);
  return created;
}

/** Removes by id, returning whether anything was removed. */
export function removeById<T extends { id: string }>(table: T[], id: string): boolean {
  const index = table.findIndex((row) => row.id === id);
  if (index < 0) return false;
  table.splice(index, 1);
  return true;
}

/** Finds by id or throws an Arabic error the UI can surface directly. */
export function requireById<T extends { id: string }>(table: T[], id: string, label: string): T {
  const found = table.find((row) => row.id === id);
  if (!found) throw new Error(`${label} غير موجود`);
  return found;
}
