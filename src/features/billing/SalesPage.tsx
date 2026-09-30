/**
 * Sales.
 *
 * There is no transactions table on this API. What actually records a sale is
 * a **code changing state**: `status` becomes `sold`, `soldAt` is stamped and
 * `soldToAppUserId` is set. So this screen is `/codes?status=sold` read as a
 * ledger, which is the closest thing to one that exists.
 *
 * One honest limit comes with that, and it is stated on the screen rather than
 * papered over: the amount is the category's **current** list price, not what
 * was charged at the time — a reprice moves the historical figures.
 *
 * The totals are `/codes/sales-summary` under the category filter, so they
 * cover every sale in it rather than the page on screen.
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
import { toAmount, type Category, type Code, type Id, type Product } from '@/types';

/**
 * Labels a category with its product, since names repeat across provinces.
 *
 * The product is looked up rather than read off the category: a code's nested
 * category carries no product at all, and a category's nested product carries
 * no server — so only the product list knows the province.
 */
function categoryLabel(category: Category, product: Product | undefined): string {
  if (!product) return category.name;
  const province = product.silversatRegion?.province?.name;
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
  const products = useAsync(() => repos.catalog.products.all(), []);
  const productById = useMemo(
    () => new Map((products.data ?? []).map((row) => [row.id, row])),
    [products.data],
  );
  const productOf = (code: Code) =>
    code.category ? productById.get(code.category.productId) : undefined;
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
  const summary = useAsync(
    () => repos.stock.salesSummary({ categoryId: categoryId === 'all' ? undefined : categoryId }),
    [categoryId],
  );
  const scope = categoryId === 'all' ? 'كل المبيعات' : 'مبيعات الفئة';

  const exportCsv = () => {
    downloadCsv('sales.csv', [
      ['الكارت', 'الفئة', 'المنتج', 'المحافظة', 'سعر الفئة', 'تاريخ البيع'],
      ...rows.map((row) => [
        row.primaryValue,
        row.category?.name ?? '',
        productOf(row)?.displayName ?? '',
        productOf(row)?.silversatRegion?.province?.name ?? '',
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
          <span className="fs-tiny dim">{productOf(row)?.displayName ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'province',
      header: 'المحافظة',
      render: (row) => productOf(row)?.silversatRegion?.province?.name ?? '—',
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
          <span className="strong">سعر الفئة الحالي</span>، يعني تغيير السعر يغيّر أرقام الماضي.
        </Notice>

        <div className="grid grid-kpi-3">
          <StatTile label={scope} value={summary.data ? formatNumber(summary.data.count) : '—'} />
          <StatTile label={`قيمة ${scope}`} value={summary.data ? formatIqd(summary.data.revenue) : '—'} />
          <StatTile
            label={`هامش ${scope}`}
            value={summary.data ? formatIqd(summary.data.revenue - summary.data.cost) : '—'}
          />
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
                  label: categoryLabel(row, productById.get(row.productId)),
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
