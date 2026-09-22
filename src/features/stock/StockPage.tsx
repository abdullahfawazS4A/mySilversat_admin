/**
 * The stock screen, as a drill-down.
 *
 * Stock is not a flat list of cards, it is a tree, and every level of it is a
 * different question an operator actually asks:
 *
 *   المنتجات  →  الفئات  →  الرفعات  →  الكارتات
 *
 * A **product** is one service in one province, and it carries the two
 * bindings everything else depends on: the province whose stock this is, and
 * the SilverSat server that will activate its cards. Both are set here, on the
 * product, because that is the only row in the system that holds them — a code
 * has no province and no server of its own, it inherits them by being in a
 * category of a product.
 *
 * A **category** is a purchasable tier of that product and the row that
 * carries prices. Stock levels are per category, not per product: "we are out"
 * always means one tier is out.
 *
 * A **batch** (رفعة) is one import file. The API keeps its counters, so every
 * level above reads those instead of scanning `/codes` — the whole tree is
 * three reads, not one per row.
 *
 * The path lives in the URL (`?product=…&category=…&batch=…`) so the back
 * button walks back up the tree, a level can be linked to from elsewhere, and
 * a reload lands where the operator was rather than at the root.
 */

import { useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Boxes,
  ChevronLeft,
  Layers,
  Package,
  Pencil,
  Plus,
  Server,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  FilterChips,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  TextInput,
  useDraft,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import { formatDateAr, formatDateTimeAr, formatIqd, formatNumber } from '@/lib/format';
import { ACTIVATION_API, BATCH_STATUS, CODE_STATUS } from '@/lib/labels';
import { matchesSearch } from '@/lib/utils';
import {
  SPREADSHEET_ACCEPT,
  SpreadsheetError,
  looksLikeHeader,
  readSpreadsheet,
  type Sheet,
} from '@/lib/spreadsheet';
import {
  toAmount,
  type Batch,
  type Category,
  type Code,
  type CodeStatus,
  type Id,
  type Product,
} from '@/types';
import type { CategoryInput, ProductInput } from '@/data/repositories/types';
import {
  CategoryFields,
  blankCategory,
  categoryToInput,
  validateCategory,
} from '../shared/categoryForm';
import {
  ProductFields,
  blankProduct,
  productToInput,
  validateProduct,
  type Option,
} from '../shared/productForm';

/** Counters rolled up from a set of batches. */
interface Counts {
  available: number;
  sold: number;
  disabled: number;
  total: number;
  batches: number;
}

const ZERO: Counts = { available: 0, sold: 0, disabled: 0, total: 0, batches: 0 };

function add(a: Counts, b: Counts): Counts {
  return {
    available: a.available + b.available,
    sold: a.sold + b.sold,
    disabled: a.disabled + b.disabled,
    total: a.total + b.total,
    batches: a.batches + b.batches,
  };
}

/**
 * The whole tree, in three reads.
 *
 * Every level needs counts, and a batch already carries its own — computed by
 * the API over its codes. So one read of `/batches` rolls up into categories
 * and then into products, and `/codes` is never scanned to draw a level. The
 * codes list is read only at the bottom, for one batch at a time.
 */
function useStockTree() {
  const repos = useRepos();

  return useAsync(async () => {
    const [products, categories, batches] = await Promise.all([
      repos.catalog.products.all(),
      repos.catalog.categories.all(),
      repos.stock.batches.all(),
    ]);

    const byCategory = new Map<Id, Counts>();
    for (const batch of batches) {
      const current = byCategory.get(batch.categoryId) ?? ZERO;
      byCategory.set(
        batch.categoryId,
        add(current, {
          available: batch.codeAvailableCount,
          sold: batch.codeSoldCount,
          disabled: batch.codeDisabledCount,
          total: batch.allCodeCount,
          batches: 1,
        }),
      );
    }

    const categoriesOf = new Map<Id, Category[]>();
    for (const category of categories) {
      const list = categoriesOf.get(category.productId) ?? [];
      list.push(category);
      categoriesOf.set(category.productId, list);
    }
    for (const list of categoriesOf.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

    const byProduct = new Map<Id, Counts>();
    for (const product of products) {
      let counts = ZERO;
      for (const category of categoriesOf.get(product.id) ?? []) {
        counts = add(counts, byCategory.get(category.id) ?? ZERO);
      }
      byProduct.set(product.id, counts);
    }

    return { products, categories, categoriesOf, byCategory, byProduct };
  }, []);
}

type Tree = NonNullable<ReturnType<typeof useStockTree>['data']>;

// ------------------------------------------------------------------ page ---

export function StockPage() {
  const repos = useRepos();
  const [params, setParams] = useSearchParams();

  const tree = useStockTree();
  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const regions = useAsync(() => repos.regions.all(), []);

  const provinceOptions: Option[] = (provinces.data ?? []).map((row) => ({
    value: row.id,
    label: row.name,
  }));
  const regionOptions: Option[] = (regions.data ?? []).map((row) => ({
    value: row.id,
    label: row.name,
  }));

  /**
   * One setter for the whole path.
   *
   * Descending keeps what is above it; ascending has to clear what is below,
   * because a category id from another product is a path that cannot exist and
   * would render an empty level with nothing to explain it.
   */
  const go = (next: { product?: Id | null; category?: Id | null; batch?: Id | null }) => {
    const nextParams = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
    }
    if (next.product === null) {
      nextParams.delete('category');
      nextParams.delete('batch');
    }
    if (next.category === null) nextParams.delete('batch');
    setParams(nextParams, { replace: false });
  };

  const productId = params.get('product');
  const categoryId = params.get('category');
  const batchId = params.get('batch');

  const product = tree.data?.products.find((row) => row.id === productId) ?? null;
  const category = tree.data?.categories.find((row) => row.id === categoryId) ?? null;

  // A path that no longer resolves — a deleted product, a stale link — is
  // shown as itself rather than silently redirected to the root, which would
  // read as the console having lost the operator's place.
  const broken = (productId && tree.data && !product) || (categoryId && tree.data && !category);

  return (
    <AsyncBlock state={tree}>
      {(data) => (
        <>
          <Breadcrumb product={product} category={category} batchId={batchId} onGo={go} />

          {broken ? (
            <div className="page">
              <Notice tone="warning">
                هذا المسار ما عاد موجود — يمكن المنتج أو الفئة انحذفت.{' '}
                <button type="button" className="link-button" onClick={() => go({ product: null })}>
                  ارجع للمنتجات
                </button>
              </Notice>
            </div>
          ) : batchId && category ? (
            <CodesLevel batchId={batchId} category={category} />
          ) : category && product ? (
            <BatchesLevel
              product={product}
              category={category}
              counts={data.byCategory.get(category.id) ?? ZERO}
              onOpen={(id) => go({ batch: id })}
              onChanged={tree.reload}
            />
          ) : product ? (
            <CategoriesLevel
              product={product}
              tree={data}
              onOpen={(id) => go({ category: id })}
              onChanged={tree.reload}
              provinceOptions={provinceOptions}
              regionOptions={regionOptions}
            />
          ) : (
            <ProductsLevel
              tree={data}
              provinceOptions={provinceOptions}
              regionOptions={regionOptions}
              onOpen={(id) => go({ product: id })}
              onChanged={tree.reload}
            />
          )}
        </>
      )}
    </AsyncBlock>
  );
}

/** The path, and the only way back up it besides the browser's own button. */
function Breadcrumb({
  product,
  category,
  batchId,
  onGo,
}: {
  product: Product | null;
  category: Category | null;
  batchId: string | null;
  onGo: (next: { product?: Id | null; category?: Id | null; batch?: Id | null }) => void;
}) {
  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: 'المنتجات', onClick: product ? () => onGo({ product: null }) : undefined },
  ];
  if (product) {
    crumbs.push({
      label: product.displayName,
      onClick: category ? () => onGo({ category: null }) : undefined,
    });
  }
  if (category) {
    crumbs.push({
      label: category.name,
      onClick: batchId ? () => onGo({ batch: null }) : undefined,
    });
  }
  if (batchId) crumbs.push({ label: 'الكارتات' });

  return (
    <div className="page-wash" style={{ paddingBottom: 0 }}>
      <nav className="row row-gap-2 wrap" aria-label="المسار">
        {crumbs.map((crumb, index) => (
          <span key={index} className="row row-gap-2">
            {index > 0 ? <ChevronLeft size={14} className="dim" /> : null}
            {crumb.onClick ? (
              <button type="button" className="link-button" onClick={crumb.onClick}>
                {crumb.label}
              </button>
            ) : (
              <span className="fs-small strong">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}

// -------------------------------------------------------------- products ---

function ProductsLevel({
  tree,
  provinceOptions,
  regionOptions,
  onOpen,
  onChanged,
}: {
  tree: Tree;
  provinceOptions: Option[];
  regionOptions: Option[];
  onOpen: (id: Id) => void;
  onChanged: () => void;
}) {
  const repos = useRepos();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  // Honours `?province=` so the province screen can link straight into the
  // stock of one governorate.
  const [provinceId, setProvinceId] = useState<Id | 'all'>(params.get('province') ?? 'all');

  const [editing, setEditing] = useState<{ row: Product | null } | null>(null);
  const [removing, setRemoving] = useState<Product | null>(null);

  const rows = useMemo(() => {
    let out = tree.products;
    if (provinceId !== 'all') out = out.filter((row) => row.provinceId === provinceId);
    if (debounced.trim()) {
      out = out.filter((row) =>
        matchesSearch(
          `${row.displayName} ${row.name} ${row.province?.name ?? ''} ${row.silversatRegion?.name ?? ''}`,
          debounced,
        ),
      );
    }
    return out;
  }, [tree.products, provinceId, debounced]);

  const totals = useMemo(
    () => rows.reduce((sum, row) => add(sum, tree.byProduct.get(row.id) ?? ZERO), ZERO),
    [rows, tree.byProduct],
  );

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'المنتج',
      render: (row) => (
        <button type="button" className="link-button col" onClick={() => onOpen(row.id)}>
          <span className="fs-body strong">{row.displayName}</span>
          <span className="fs-tiny dim">{row.name || '—'}</span>
        </button>
      ),
    },
    {
      key: 'province',
      header: 'المحافظة',
      render: (row) =>
        row.province?.name ? (
          <span className="fs-body">{row.province.name}</span>
        ) : (
          <Pill tone="danger">بدون محافظة</Pill>
        ),
    },
    {
      key: 'api',
      header: 'الـ API',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          {row.silversatRegion ? (
            <span className="fs-small">{row.silversatRegion.name}</span>
          ) : row.activationApi === 'silvers' ? (
            <Pill tone="danger">غير مربوط</Pill>
          ) : (
            <span className="dim">—</span>
          )}
          <span className="fs-tiny dim">{ACTIVATION_API[row.activationApi]}</span>
        </div>
      ),
    },
    {
      key: 'tiers',
      header: 'الفئات',
      numeric: true,
      width: 100,
      render: (row) => {
        const count = (tree.categoriesOf.get(row.id) ?? []).length;
        return count === 0 ? (
          <Pill tone="danger">ماكو فئات</Pill>
        ) : (
          <span className="num">{count}</span>
        );
      },
    },
    {
      key: 'stock',
      header: 'المخزن',
      render: (row) => {
        const counts = tree.byProduct.get(row.id) ?? ZERO;
        return (
          <div className="row row-gap-1 wrap">
            <Pill tone={counts.available === 0 ? 'danger' : 'success'}>
              متاح {formatNumber(counts.available)}
            </Pill>
            <Pill tone="neutral">مباع {formatNumber(counts.sold)}</Pill>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: 92,
      render: (row) => (
        <div className="row row-gap-1">
          <Button
            variant="ghost"
            size="sm"
            title="تعديل المنتج"
            icon={<Pencil size={14} />}
            onClick={() => setEditing({ row })}
          />
          <Button
            variant="ghost"
            size="sm"
            title="حذف المنتج"
            icon={<Trash2 size={14} />}
            onClick={() => setRemoving(row)}
          />
        </div>
      ),
    },
  ];

  const unbound = rows.filter(
    (row) => row.activationApi === 'silvers' && !row.silversatRegionId,
  ).length;

  return (
    <>
      <PageHeader
        title="المخزن"
        subtitle="المنتجات — وكل منتج مربوط بمحافظة وبسيرفر API، وجوّاه فئاته ورفعاته"
        actions={
          <Button
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => setEditing({ row: null })}
          >
            إضافة منتج
          </Button>
        }
      />

      <div className="page">
        {unbound > 0 ? (
          <Notice tone="danger">
            <span className="strong num">{unbound}</span> منتج تفعيله عبر سلفرسات بس ما مربوط
            بسيرفر — كارتاته ما راح تتفعّل. افتح تعديل المنتج واربطه.
          </Notice>
        ) : null}

        <div className="grid grid-kpi">
          <StatTile label="منتجات" value={formatNumber(rows.length)} />
          <StatTile
            label="كارتات متاحة"
            value={formatNumber(totals.available)}
            tone={totals.available === 0 ? 'danger' : undefined}
          />
          <StatTile label="كارتات مباعة" value={formatNumber(totals.sold)} />
          <StatTile label="رفعات" value={formatNumber(totals.batches)} />
        </div>

        <Card>
          <Toolbar>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="ابحث باسم المنتج أو المحافظة أو السيرفر…"
            />
            <Select
              value={provinceId}
              onChange={setProvinceId}
              options={[
                { value: 'all' as const, label: 'كل المحافظات' },
                ...provinceOptions,
              ]}
            />
          </Toolbar>

          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                icon={<Package size={20} />}
                title="ماكو منتجات"
                hint="أضف منتج واربطه بمحافظة وسيرفر حتى يبدأ مخزنه"
              />
            }
          />
        </Card>
      </div>

      {editing ? (
        <ProductDialog
          row={editing.row}
          provinceOptions={provinceOptions}
          regionOptions={regionOptions}
          defaultProvinceId={provinceId === 'all' ? (provinceOptions[0]?.value ?? '') : provinceId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}

      {removing ? (
        <DeleteDialog
          title="حذف المنتج"
          message={
            <>
              راح ينحذف المنتج <span className="strong">{removing.displayName}</span> وفئاته تظل بلا
              منتج. الكارتات المرفوعة ما تنحذف.
            </>
          }
          onConfirm={() => repos.catalog.products.remove(removing.id)}
          onCancel={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}

// ------------------------------------------------------------ categories ---

function CategoriesLevel({
  product,
  tree,
  onOpen,
  onChanged,
  provinceOptions,
  regionOptions,
}: {
  product: Product;
  tree: Tree;
  onOpen: (id: Id) => void;
  onChanged: () => void;
  provinceOptions: Option[];
  regionOptions: Option[];
}) {
  const repos = useRepos();
  const rows = tree.categoriesOf.get(product.id) ?? [];
  const counts = tree.byProduct.get(product.id) ?? ZERO;

  const [editing, setEditing] = useState<{ row: Category | null } | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState(false);

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'الفئة',
      render: (row) => (
        <button type="button" className="link-button col" onClick={() => onOpen(row.id)}>
          <span className="fs-body strong">{row.name}</span>
          <span className="fs-tiny dim">{row.nameKu || '—'}</span>
        </button>
      ),
    },
    {
      key: 'unit',
      header: 'سعر التطبيق',
      numeric: true,
      render: (row) => <span className="num strong">{formatIqd(toAmount(row.unitPrice))}</span>,
    },
    {
      key: 'cost',
      header: 'الكلفة',
      numeric: true,
      render: (row) => <span className="num dim">{formatIqd(toAmount(row.costPrice))}</span>,
    },
    {
      key: 'stock',
      header: 'المخزن',
      render: (row) => {
        const tier = tree.byCategory.get(row.id) ?? ZERO;
        const low =
          row.lowStockThreshold !== null && tier.available <= row.lowStockThreshold;
        return (
          <div className="row row-gap-1 wrap">
            <Pill tone={tier.available === 0 ? 'danger' : low ? 'warning' : 'success'}>
              متاح {formatNumber(tier.available)}
            </Pill>
            <Pill tone="neutral">مباع {formatNumber(tier.sold)}</Pill>
            <span className="fs-tiny dim">{formatNumber(tier.batches)} رفعة</span>
          </div>
        );
      },
    },
    {
      key: 'state',
      header: 'الحالة',
      render: (row) => (
        <div className="row row-gap-1 wrap">
          {row.isDisabled ? (
            <Pill tone="danger">معطّلة</Pill>
          ) : row.isDisplay ? (
            <Pill tone="success">معروضة</Pill>
          ) : (
            <Pill tone="muted">مخفية</Pill>
          )}
          {row.hasSecondaryCode ? <Pill tone="neutral">كود ثانوي</Pill> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 92,
      render: (row) => (
        <div className="row row-gap-1">
          <Button
            variant="ghost"
            size="sm"
            title="تعديل الفئة"
            icon={<Pencil size={14} />}
            onClick={() => setEditing({ row })}
          />
          <Button
            variant="ghost"
            size="sm"
            title="حذف الفئة"
            icon={<Trash2 size={14} />}
            onClick={() => setRemoving(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={product.displayName}
        subtitle={`${product.province?.name ?? 'بدون محافظة'} · ${
          product.silversatRegion?.name ?? 'بدون سيرفر'
        } — فئات المنتج وأسعارها`}
        actions={
          <>
            <Button
              variant="outline"
              icon={<Server size={15} />}
              onClick={() => setEditingProduct(true)}
            >
              ربط المنتج
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => setEditing({ row: null })}
            >
              إضافة فئة
            </Button>
          </>
        }
      />

      <div className="page">
        {product.activationApi === 'silvers' && !product.silversatRegionId ? (
          <Notice tone="danger">
            هذا المنتج ما مربوط بسيرفر API — كارتاته ما راح تتفعّل. اضغط «ربط المنتج» واختر السيرفر.
          </Notice>
        ) : null}

        <div className="grid grid-kpi">
          <StatTile label="فئات" value={formatNumber(rows.length)} />
          <StatTile
            label="كارتات متاحة"
            value={formatNumber(counts.available)}
            tone={counts.available === 0 ? 'danger' : undefined}
          />
          <StatTile label="كارتات مباعة" value={formatNumber(counts.sold)} />
          <StatTile label="رفعات" value={formatNumber(counts.batches)} />
        </div>

        <Card>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                icon={<Layers size={20} />}
                title="ماكو فئات"
                hint="المنتج بدون فئة ما ينباع وما يكدر يستلم رفعة كارتات"
              />
            }
          />
        </Card>
      </div>

      {editing ? (
        <CategoryDialog
          productId={product.id}
          row={editing.row}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}

      {editingProduct ? (
        <ProductDialog
          row={product}
          provinceOptions={provinceOptions}
          regionOptions={regionOptions}
          defaultProvinceId={product.provinceId}
          onClose={() => setEditingProduct(false)}
          onSaved={() => {
            setEditingProduct(false);
            onChanged();
          }}
        />
      ) : null}

      {removing ? (
        <DeleteDialog
          title="حذف الفئة"
          message={
            <>
              راح تنحذف الفئة <span className="strong">{removing.name}</span> وأسعارها. رفعاتها
              وكارتاتها تظل بلا فئة.
            </>
          }
          onConfirm={() => repos.catalog.categories.remove(removing.id)}
          onCancel={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}

// --------------------------------------------------------------- batches ---

function BatchesLevel({
  product,
  category,
  counts,
  onOpen,
  onChanged,
}: {
  product: Product;
  category: Category;
  counts: Counts;
  onOpen: (id: Id) => void;
  onChanged: () => void;
}) {
  const repos = useRepos();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [filing, setFiling] = useState(false);

  const batches = useAsync(
    () =>
      repos.stock.batches.list({
        categoryId: category.id,
        search: debounced,
        page,
        pageSize: 20,
      }),
    [category.id, debounced, page],
  );

  const columns: Column<Batch>[] = [
    {
      key: 'file',
      header: 'الرفعة',
      render: (row) => (
        <button type="button" className="link-button col" onClick={() => onOpen(row.id)}>
          <span className="fs-body strong">{row.fileName}</span>
          <span className="fs-tiny dim">{row.notes ?? ''}</span>
        </button>
      ),
    },
    {
      key: 'counts',
      header: 'الكارتات',
      render: (row) => (
        <div className="row row-gap-2 wrap">
          <Pill tone={row.codeAvailableCount === 0 ? 'muted' : 'success'}>
            متاح {formatNumber(row.codeAvailableCount)}
          </Pill>
          <Pill tone="neutral">مباع {formatNumber(row.codeSoldCount)}</Pill>
          {row.codeDisabledCount > 0 ? (
            <Pill tone="danger">معطّل {formatNumber(row.codeDisabledCount)}</Pill>
          ) : null}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'المجموع',
      numeric: true,
      width: 90,
      render: (row) => <span className="num strong">{formatNumber(row.allCodeCount)}</span>,
    },
    {
      key: 'uploadedBy',
      header: 'رفعها',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-small">{row.uploadedByUser?.name ?? '—'}</span>
          <span className="fs-tiny dim">{formatDateAr(row.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      width: 96,
      render: (row) => (
        <Pill tone={BATCH_STATUS[row.status].tone}>{BATCH_STATUS[row.status].label}</Pill>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={`${category.name} — الرفعات`}
        subtitle={`${product.displayName} · ${product.province?.name ?? '—'} — كل رفعة ملف كارتات واصل`}
        actions={
          <Button variant="primary" icon={<Upload size={15} />} onClick={() => setFiling(true)}>
            رفع دفعة
          </Button>
        }
      />

      <div className="page">
        <div className="grid grid-kpi">
          <StatTile
            label="متاح"
            value={formatNumber(counts.available)}
            tone={counts.available === 0 ? 'danger' : undefined}
          />
          <StatTile label="مباع" value={formatNumber(counts.sold)} />
          <StatTile label="معطّل" value={formatNumber(counts.disabled)} />
          <StatTile label="سعر التطبيق" value={formatIqd(toAmount(category.unitPrice))} />
        </div>

        {counts.available === 0 ? (
          <Notice tone="danger">
            ماكو كارت متاح بهذي الفئة — أي تجديد عليها راح ينرفض. ارفع دفعة جديدة.
          </Notice>
        ) : null}

        <Card>
          <Toolbar>
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              placeholder="ابحث باسم الملف أو الملاحظة…"
            />
          </Toolbar>

          <AsyncBlock state={batches}>
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
                    icon={<Boxes size={20} />}
                    title="ماكو رفعات"
                    hint="ارفع دفعة كارتات لهذي الفئة حتى يبدأ مخزنها"
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {filing ? (
        <FileBatchDialog
          category={category}
          product={product}
          onClose={() => setFiling(false)}
          onFiled={() => {
            setFiling(false);
            setPage(1);
            batches.reload();
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}

// ----------------------------------------------------------------- codes ---

function CodesLevel({ batchId, category }: { batchId: Id; category: Category }) {
  const repos = useRepos();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState<CodeStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const codes = useAsync(
    () =>
      repos.stock.codes.list({
        batchId,
        status: status === 'all' ? undefined : status,
        search: debounced,
        page,
        pageSize: 25,
      }),
    [batchId, status, debounced, page],
  );

  const columns: Column<Code>[] = [
    {
      key: 'value',
      header: 'الكارت',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-body strong num">{row.primaryValue}</span>
          {row.secondaryValue ? <span className="fs-tiny dim num">{row.secondaryValue}</span> : null}
        </div>
      ),
    },
    {
      key: 'sold',
      header: 'البيع',
      render: (row) =>
        row.soldAt ? (
          <span className="fs-small">{formatDateTimeAr(row.soldAt)}</span>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'disabled',
      header: 'التعطيل',
      render: (row) =>
        row.disabledAt ? (
          <span className="fs-small">{formatDateTimeAr(row.disabledAt)}</span>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      width: 96,
      render: (row) => (
        <Pill tone={CODE_STATUS[row.status].tone}>{CODE_STATUS[row.status].label}</Pill>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="كارتات الرفعة"
        subtitle={`${category.name} — الكارتات اللي وصلت بهذي الرفعة`}
      />

      <div className="page">
        <Card>
          <Toolbar>
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              placeholder="رقم الكارت أو القيمة الثانية…"
            />
          </Toolbar>

          <Toolbar>
            <FilterChips<CodeStatus | 'all'>
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              items={[
                { value: 'all', label: 'الكل' },
                { value: 'available', label: CODE_STATUS.available.label },
                { value: 'sold', label: CODE_STATUS.sold.label },
                { value: 'disabled', label: CODE_STATUS.disabled.label },
              ]}
            />
          </Toolbar>

          {debounced.trim() ? (
            <div className="toolbar">
              <span className="fs-small muted">
                البحث يستخدم <code className="num">/codes/lookup</code> — يلكى الكارت بأي رفعة كان،
                مو بهذي الرفعة بس.
              </span>
            </div>
          ) : null}

          <AsyncBlock state={codes}>
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
                    icon={<Boxes size={20} />}
                    title="ماكو كارتات"
                    hint="ما لكينا كارت بهذه الفلاتر"
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

// --------------------------------------------------------------- dialogs ---

/** Create or edit a product, bindings included. */
function ProductDialog({
  row,
  provinceOptions,
  regionOptions,
  defaultProvinceId,
  onClose,
  onSaved,
}: {
  row: Product | null;
  provinceOptions: Option[];
  regionOptions: Option[];
  defaultProvinceId: Id;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const { draft, set } = useDraft<ProductInput>(
    row ? productToInput(row) : blankProduct(defaultProvinceId),
  );
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = async () => {
    const problem = validateProduct(draft);
    setInvalid(problem);
    if (problem) return;
    const ok = await run(() =>
      row ? repos.catalog.products.update(row.id, draft) : repos.catalog.products.create(draft),
    );
    if (!ok) return;
    toast(row ? 'انحفظ المنتج' : 'انضاف المنتج');
    onSaved();
  };

  return (
    <Modal
      title={row ? `تعديل ${row.displayName}` : 'إضافة منتج'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={action.pending} onClick={() => void submit()}>
            {action.pending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <Notice tone="info">
        المحافظة تحدّد مخزن هذا المنتج، والسيرفر يحدّد وين يروح التجديد والاستعلام لكارتاته.
      </Notice>
      <div className="grid grid-form mt-3">
        <ProductFields
          draft={draft}
          set={set}
          provinceOptions={provinceOptions}
          regionOptions={regionOptions}
        />
      </div>
      {invalid || action.error ? (
        <div className="field-error mt-3">{invalid ?? action.error}</div>
      ) : null}
    </Modal>
  );
}

/** Create or edit one price tier of a product. */
function CategoryDialog({
  productId,
  row,
  onClose,
  onSaved,
}: {
  productId: Id;
  row: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const { draft, set } = useDraft<CategoryInput>(
    row ? categoryToInput(row) : blankCategory(productId),
  );
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = async () => {
    const problem = validateCategory(draft);
    setInvalid(problem);
    if (problem) return;
    const ok = await run(() =>
      row ? repos.catalog.categories.update(row.id, draft) : repos.catalog.categories.create(draft),
    );
    if (!ok) return;
    toast(row ? 'انحفظت الفئة' : 'انضافت الفئة');
    onSaved();
  };

  return (
    <Modal
      title={row ? `تعديل ${row.name}` : 'إضافة فئة'}
      size="xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={action.pending} onClick={() => void submit()}>
            {action.pending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="grid grid-form">
        <CategoryFields draft={draft} set={set} />
      </div>
      {invalid || action.error ? (
        <div className="field-error mt-3">{invalid ?? action.error}</div>
      ) : null}
    </Modal>
  );
}

/**
 * Files a shipment against the category being viewed.
 *
 * The category is the level the operator is standing on, so there is nothing
 * to pick — which removes the one mistake this dialog used to allow, filing
 * Basra's cards against a Ninawa tier.
 *
 * Cards arrive as a file, so the file is the whole input: choose the supplier's
 * `.xlsx` or `.csv` and everything else is read off it. The first column is the
 * card number, the second is the extra value when the tier carries one, a
 * heading row is recognised and skipped, and the batch takes the file's own
 * name. Nothing to map and nothing to confirm.
 *
 * The codes are parsed here rather than posted as a file, because the API takes
 * them as JSON. Parsing first also puts the count on the upload button before
 * anything is sent — a stray heading or a blank line is otherwise discovered
 * afterwards, as a total that is quietly one short.
 *
 * The screen stays silent when the file is fine. It speaks only for the two
 * things that would file cards nobody can redeem: a column Excel has already
 * rounded, and a card that appears twice.
 */
function FileBatchDialog({
  category,
  product,
  onClose,
  onFiled,
}: {
  category: Category;
  product: Product;
  onClose: () => void;
  onFiled: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  /** Whether the operator has tried to submit, which is when refusals appear. */
  const [tried, setTried] = useState(false);

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const wantsSecondary = category.hasSecondaryCode;

  const take = async (file: File) => {
    setReading(true);
    setSheetError(null);
    try {
      const next = await readSpreadsheet(file);
      if (!next.rows.length) throw new SpreadsheetError('الملف فارغ — ماكو ولا سطر بيه.');

      setSheet(next);
      // The file's own name is exactly what this field is for: the shipment's
      // identity, the way the operator will look for it again.
      setFileName(file.name);
    } catch (err) {
      setSheet(null);
      setSheetError(err instanceof Error ? err.message : 'تعذّرت قراءة الملف.');
    } finally {
      setReading(false);
    }
  };

  /**
   * The sheet as codes.
   *
   * Column order is taken as read — first the card, then the extra value — and
   * a heading row is dropped when the first row is words rather than numbers.
   * Both are what every shipment file actually looks like, and the preview is
   * where a file that does not is caught.
   */
  const parsed = useMemo(() => {
    if (!sheet) return [];
    const body = looksLikeHeader(sheet.rows) ? sheet.rows.slice(1) : sheet.rows;
    return body
      .map((row) => ({
        primaryValue: (row[0] ?? '').trim(),
        secondaryValue: wantsSecondary ? (row[1] ?? '').trim() || null : null,
      }))
      .filter((code) => code.primaryValue);
  }, [sheet, wantsSecondary]);

  const missingSecondary = wantsSecondary && parsed.some((code) => !code.secondaryValue);

  /**
   * The first card that appears twice.
   *
   * A card number is unique across the system, so a repeat inside one shipment
   * is a file that was built wrong — a block pasted twice, a range copied over
   * itself. Caught here because the alternative is a refusal from the server
   * after several thousand rows have already crossed, naming one value and
   * leaving the operator to go and find it.
   */
  const duplicate = useMemo(() => {
    const seen = new Set<string>();
    for (const code of parsed) {
      if (seen.has(code.primaryValue)) return code.primaryValue;
      seen.add(code.primaryValue);
    }
    return null;
  }, [parsed]);

  /** Whether the card column is one Excel already rounded. */
  const rounded = !!sheet?.imprecise.has(0);

  /**
   * What stops the upload, as the form currently stands.
   *
   * Derived rather than stored, so it follows the inputs: a refusal recorded on
   * one submit would otherwise outlive the fix, leaving the operator reading a
   * sentence about a file they had already replaced. It is only *shown* once a
   * submit has been attempted — refusing a form nobody has filled in is noise.
   */
  const problem = !sheet
    ? 'اختر ملف بيه الكارتات'
    : !fileName.trim()
      ? 'اسم الرفعة مطلوب'
      : parsed.length === 0
        ? 'ما لكينا كارتات بأول عمود من الملف'
        : rounded
          ? 'ما نكدر نرفع عمود فقد خانات — صلّح الملف وأعد اختياره.'
          : duplicate
            ? `الكارت ${duplicate} متكرر بالملف — صلّح الملف وأعد الرفع.`
            : missingSecondary
              ? 'هذي الفئة تحتاج قيمة ثانية لكل كارت — لازم عمود ثاني بالملف'
              : null;

  const submit = async () => {
    setTried(true);
    if (problem) return;

    const ok = await run(() =>
      repos.stock.batches.createWithCodes({
        categoryId: category.id,
        fileName: fileName.trim(),
        notes: notes.trim() ? notes.trim() : null,
        codes: parsed,
      }),
    );
    if (!ok) return;
    toast(`انرفعت الدفعة — ${parsed.length} كارت`);
    onFiled();
  };

  return (
    <Modal
      title="رفع دفعة كارتات"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<Plus size={15} />}
            disabled={action.pending || reading}
            onClick={() => void submit()}
          >
            {action.pending ? 'جاري الرفع…' : `رفع ${formatNumber(parsed.length)} كارت`}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <Notice tone="info">
        الرفعة راح تنزل على <span className="strong">{category.name}</span> من{' '}
        <span className="strong">{product.displayName}</span> — {product.province?.name ?? '—'}.
      </Notice>

      <div className="mt-3">
        <SheetPicker
          busy={reading}
          sheet={sheet}
          wantsSecondary={wantsSecondary}
          onPick={(file) => void take(file)}
        />
      </div>

      {sheetError ? (
        <div className="mt-2">
          <Notice tone="danger">{sheetError}</Notice>
        </div>
      ) : null}

      {sheet ? (
        <>
          <div className="grid grid-form mt-3">
            <Field label="اسم الرفعة" hint="اسم الملف الواصل — هوية الشحنة">
              <TextInput value={fileName} onChange={setFileName} />
            </Field>
            <Field label="ملاحظات" hint="اختيارية">
              <TextInput value={notes} onChange={setNotes} />
            </Field>
          </div>

          {/*
            * Only ever a warning.
            *
            * A file that is fine says nothing: the count lives on the upload
            * button, which is where the operator is already looking, and
            * repeating it in a panel underneath was a line to read rather than
            * a thing to know. What is left here is only what stops the upload.
            */}
          {rounded || duplicate || missingSecondary ? (
            <div className="mt-3">
              <Notice tone="danger">
                {rounded ? (
                  <div>
                    عمود الكارتات انخزن بالإكسل كأرقام وفقد خانات من آخره — هذي الكارتات ما راح
                    تشتغل. افتح الملف، سوّي العمود <span className="strong">Text</span>، وأعد
                    الحفظ.
                  </div>
                ) : null}
                {duplicate ? (
                  <div>
                    الكارت <span className="num strong">{duplicate}</span> مكرر بالملف.
                  </div>
                ) : null}
                {missingSecondary ? (
                  <div>
                    هذي الفئة تحتاج قيمة ثانية لكل كارت — لازم تكون بالعمود الثاني من الملف.
                  </div>
                ) : null}
              </Notice>
            </div>
          ) : null}
        </>
      ) : null}

      {(tried && problem) || action.error ? (
        <div className="field-error mt-2">{(tried ? problem : null) ?? action.error}</div>
      ) : null}
    </Modal>
  );
}

/**
 * The drop zone for a shipment file.
 *
 * Drag-and-drop beside the picker because the file is nearly always already
 * open in a folder next to the browser, and because a drop is the one gesture
 * that cannot pick the wrong file by misreading a name in a list.
 */
function SheetPicker({
  sheet,
  busy,
  wantsSecondary,
  onPick,
}: {
  sheet: Sheet | null;
  busy: boolean;
  wantsSecondary: boolean;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={SPREADSHEET_ACCEPT}
        hidden
        onChange={(event) => {
          const picked = event.target.files?.[0];
          // Resetting lets the same file be picked again after a refusal.
          event.target.value = '';
          if (picked) onPick(picked);
        }}
      />

      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) onPick(dropped);
        }}
      >
        <Upload size={22} />
        {busy ? (
          <span className="strong">جاري قراءة الملف…</span>
        ) : sheet ? (
          <>
            <span className="strong">{sheet.fileName}</span>
            <span className="fs-tiny dim">
              {sheet.sheetName ? `ورقة «${sheet.sheetName}» — ` : ''}
              {formatNumber(sheet.rows.length)} سطر — اضغط لتبديل الملف
            </span>
          </>
        ) : (
          <>
            <span className="strong">اختر ملف إكسل أو CSV، أو اسحبه هنا</span>
            <span className="fs-tiny dim">
              {wantsSecondary
                ? 'أول عمود الكارتات، والعمود الثاني القيمة الثانية'
                : 'أول عمود بيه الكارتات — عمود واحد يكفي'}
            </span>
          </>
        )}
      </div>
    </>
  );
}

function DeleteDialog({
  title,
  message,
  onConfirm,
  onCancel,
  onDone,
}: {
  title: string;
  message: ReactNode;
  onConfirm: () => Promise<unknown>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [run, action] = useAction();
  return (
    <ConfirmDialog
      danger
      title={title}
      confirmLabel="حذف"
      pending={action.pending}
      message={
        <>
          {message}
          {action.error ? <div className="field-error mt-2">{action.error}</div> : null}
        </>
      }
      onCancel={onCancel}
      onConfirm={async () => {
        const ok = await run(onConfirm);
        if (ok) onDone();
      }}
    />
  );
}
