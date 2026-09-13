/**
 * Code stock — batches and the codes inside them.
 *
 * A batch is one import file; its counters (`codeAvailableCount` and friends)
 * are computed by the API, so the stock screen never scans `/codes` to draw a
 * level. Selling a code is what a renewal actually is, which makes
 * `status: 'sold'` the sales ledger of the whole system.
 *
 * `/codes` filters by status, category and batch server-side but has no text
 * search — `/codes/lookup` is the search, and it matches id, primary value and
 * secondary value at once.
 */

import { api } from '@/data/http/client';
import type { Batch, Code, Id, ListQuery, Page } from '@/types';
import type {
  BatchInput,
  CodeFilter,
  CodeInput,
  CrudRepository,
  StockRepository,
} from '../types';
import { HttpCrudRepository, toPage, toRange } from './crud';

type BatchFilter = { categoryId?: Id; status?: 'active' | 'disabled'; fileName?: string };

class HttpBatchesRepository extends HttpCrudRepository<
  Batch,
  BatchInput,
  Partial<BatchInput>,
  BatchFilter
> {
  constructor() {
    super('/batches', (row) => `${row.fileName} ${row.notes ?? ''} ${row.category?.name ?? ''}`);
  }

  createWithCodes(input: {
    categoryId: Id;
    fileName: string;
    status?: 'active' | 'disabled';
    notes?: string | null;
    codes: { primaryValue: string; secondaryValue?: string | null }[];
  }): Promise<Batch> {
    return api.post<Batch>('/batches/with-codes', input);
  }
}

class HttpCodesRepository extends HttpCrudRepository<
  Code,
  CodeInput,
  Partial<CodeInput>,
  CodeFilter
> {
  constructor() {
    super('/codes');
  }

  /**
   * Overridden because the code search is its own route rather than a `q`
   * parameter on the list. A lookup ignores the status/category filters — it
   * is the "customer read me this number" path and has to find the row
   * wherever it sits.
   */
  async list(query?: ListQuery & CodeFilter): Promise<Page<Code>> {
    const search = query?.search?.trim();
    if (!search) return super.list(query);

    const rows = await api.get<Code[]>('/codes/lookup', { q: search });
    const { limit, offset } = toRange(query);
    return toPage(rows.slice(offset, offset + limit), rows.length, query);
  }
}

export class HttpStockRepository implements StockRepository {
  readonly batches = new HttpBatchesRepository();
  readonly codes: CrudRepository<Code, CodeInput, Partial<CodeInput>, CodeFilter> =
    new HttpCodesRepository();

  lookup(q: string): Promise<Code[]> {
    return api.get<Code[]>('/codes/lookup', { q });
  }
}
