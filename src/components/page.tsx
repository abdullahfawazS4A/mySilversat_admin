/**
 * Page-level building blocks: the header wash every screen opens with, and the
 * generic table the list screens share.
 *
 * The table is generic on purpose — twelve screens render "filter, table,
 * pagination", and re-implementing selection, sorting and empty states twelve
 * times is how they drift apart.
 */

import { type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cx } from '@/lib/utils';
import { Pagination, TableSkeleton, EmptyState } from './ui';

// ----------------------------------------------------------- page header ---

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-wash">
      <div className="page-head">
        <div className="col">
          <span className="section-title">{title}</span>
          {subtitle ? <span className="section-sub">{subtitle}</span> : null}
        </div>
        {actions ? <div className="row row-gap-2 wrap">{actions}</div> : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- data table ---

export interface Column<T> {
  /** Also the sort key sent to the repository when `sortable` is set. */
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  /** Renders the cell with tabular digits and LTR direction. */
  numeric?: boolean;
  width?: number | string;
}

export interface SortState {
  by: string;
  dir: 'asc' | 'desc';
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  onRowClick,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  sort,
  onSort,
  empty,
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  /** Presence of this enables the checkbox column. */
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  sort?: SortState;
  onSort?: (next: SortState) => void;
  empty?: ReactNode;
  page?: number;
  pageSize?: number;
  total?: number;
  onPage?: (page: number) => void;
  /** Presence of this lets the pager change how many rows a page holds. */
  onPageSize?: (pageSize: number) => void;
}) {
  const selectable = Boolean(selectedIds && onToggleSelect);
  const allIds = rows.map(rowKey);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds!.has(id));

  const clickSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return;
    const nextDir: 'asc' | 'desc' =
      sort?.by === column.key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSort({ by: column.key, dir: nextDir });
  };

  if (loading) return <TableSkeleton cols={columns.length} />;

  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="ما بيها بيانات" hint="جرّب تغيّر الفلاتر أو البحث" />}</>;
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {selectable ? (
                <th style={{ width: 38 }}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleSelectAll?.(allIds)}
                    title="تحديد الكل"
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={cx(column.sortable && 'sortable')}
                  onClick={() => clickSort(column)}
                >
                  <span className="row row-gap-1" style={{ display: 'inline-flex' }}>
                    {column.header}
                    {column.sortable && sort?.by === column.key ? (
                      sort.dir === 'asc' ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  className={cx(onRowClick && 'clickable', selectedIds?.has(id) && 'selected')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable ? (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds!.has(id)}
                        onChange={() => onToggleSelect!(id)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} className={cx(column.numeric && 'table-num')}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {typeof page === 'number' && typeof pageSize === 'number' && typeof total === 'number' && onPage ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPage={onPage}
          onPageSize={onPageSize}
        />
      ) : null}
    </>
  );
}

/** A row of filter controls above a table. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

/** The bar that appears when rows are multi-selected. */
export function BulkBar({ count, children }: { count: number; children: ReactNode }) {
  return (
    <div className="bulkbar">
      <span className="fs-body strong">
        محدد <span className="num">{count}</span>
      </span>
      <div className="row row-gap-2 grow wrap">{children}</div>
    </div>
  );
}
