/**
 * Sales.
 *
 * There is no transactions table on this API. What actually records a sale is
 * a **code changing state**: `status` becomes `sold`, `soldAt` is stamped and
 * `soldToAppUserId` is set. So this screen is `/codes?status=sold` read as a
 * ledger, which is the closest thing to one that exists.
 *
 * Two honest limits come with that, and both are stated on the screen rather
 * than papered over:
 *
 *  - the amount is the category's **current** list price, not what was charged
 *    at the time — a reprice moves the historical figures;
 *  - the totals are over the loaded page, because the API has no aggregate
 *    route and summing every sold code on every render would be a heavy read.
 */

import { useMemo, useState } from 'react';
import { Banknote, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  EmptyState,
  Notice,
  SearchInput,
  Select,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import { formatDateTimeAr, formatIqd, formatNumber } from '@/lib/format';
import { downloadCsv } from '@/lib/utils';
import { toAmount, type Category, type Code, type Id } from '@/types';

/** Labels a category with its product, since names repeat across provinces. */
function categoryLabel(category: Category): string {
  const product = category.product;
  if (!product) return category.name;
  const province = product.province?.name;
  return `${product.displayName} — ${category.name}${province ? ` (${province})` : ''}`;
}

export function SalesPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [categoryId, setCategoryId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const categories = useAsync(() => repos.catalog.categories.all(), []);
  const sales = useAsync(
    () =>
      repos.stock.codes.list({
        status: 'sold',
        categoryId: categoryId === 'all' ? undefined : categoryId,
        search: debounced,
        page,
        pageSize: 25,
      }),
    [categoryId, debounced, page],
  );

  const rows = sales.data?.items ?? [];
  const pageRevenue = useMemo(
    () => rows.reduce((sum, row) => sum + toAmount(row.category?.unitPrice), 0),
    [rows],
  );
  const pageCost = useMemo(
    () => rows.reduce((sum, row) => sum + toAmount(row.category?.costPrice), 0),
    [rows],
  );

  const exportCsv = () => {
    downloadCsv('sales.csv', [
      ['الكارت', 'الفئة', 'المنتج', 'المحافظة', 'سعر الفئة', 'تاريخ البيع'],
      ...rows.map((row) => [
        row.primaryValue,
        row.category?.name ?? '',
        row.category?.product?.displayName ?? '',
        row.category?.product?.province?.name ?? '',
        toAmount(row.category?.unitPrice),
        formatDateTimeAr(row.soldAt),
      ]),
    ]);
    toast('تم تصدير الصفحة الحالية');
  };

  const columns: Column<Code>[] = [
    {
      key: 'code',
      header: 'الكارت',
      render: (row) => <span className="fs-body strong num">{row.primaryValue}</span>,
    },
    {
      key: 'category',
      header: 'الفئة',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-body">{row.category?.name ?? '—'}</span>
          <span className="fs-tiny dim">{row.category?.product?.displayName ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'province',
      header: 'المحافظة',
      render: (row) => row.category?.product?.province?.name ?? '—',
    },
    {
      key: 'buyer',
      header: 'المشتري',
      render: (row) =>
        row.soldToAppUserId ? (
          <Link className="fs-small" to={`/users/${row.soldToAppUserId}`}>
            فتح سجل المشترك
          </Link>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'price',
      header: 'سعر الفئة',
      numeric: true,
      render: (row) => (
        <span className="num strong">{formatIqd(toAmount(row.category?.unitPrice))}</span>
      ),
    },
    {
      key: 'soldAt',
      header: 'تاريخ البيع',
      render: (row) => <span className="fs-small">{formatDateTimeAr(row.soldAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="المبيعات"
        subtitle="الكارتات المباعة — كل كارت مباع هو عملية بيع بحد ذاتها"
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={exportCsv}>
            تصدير الصفحة
          </Button>
        }
      />

      <div className="page">
        <Notice tone="info">
          ماكو جدول معاملات بالـ API — سجل البيع هو حالة الكارت نفسه. المبالغ محسوبة على{' '}
          <span className="strong">سعر الفئة الحالي</span>، يعني تغيير السعر يغيّر أرقام الماضي،
          والمجاميع تحت محسوبة على الصفحة المعروضة بس.
        </Notice>

        <div className="grid grid-kpi-3">
          <StatTile label="مبيعات هذه الصفحة" value={formatNumber(rows.length)} />
          <StatTile label="قيمة هذه الصفحة" value={formatIqd(pageRevenue)} />
          <StatTile label="هامش هذه الصفحة" value={formatIqd(pageRevenue - pageCost)} />
        </div>

        <Card>
          <Toolbar>
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              placeholder="ابحث برقم الكارت…"
            />
            <Select
              value={categoryId}
              onChange={(next) => {
                setCategoryId(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل الفئات' },
                ...(categories.data ?? []).map((row) => ({
                  value: row.id,
                  label: categoryLabel(row),
                })),
              ]}
            />
          </Toolbar>

          <AsyncBlock state={sales}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(row) => row.id}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  <EmptyState
                    icon={<Banknote size={20} />}
                    title="ماكو مبيعات"
                    hint="ما انباع أي كارت بهذه الفلاتر"
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>
    </>
  );
}
