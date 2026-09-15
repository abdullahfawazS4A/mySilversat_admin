/**
 * The price list: products and the categories under them.
 *
 * These two are one screen because a category is meaningless alone — it is a
 * price tier *of* a product, and the product decides the province and which
 * upstream activates its codes. Editing a price without seeing which product
 * and province it belongs to is how the wrong province gets repriced.
 *
 * Four prices ride on every category: what the code costs us, what the app
 * charges, and the two reseller tiers. They are `decimal` columns, so the API
 * sends them as strings — `toAmount` reads them at the point of render.
 *
 * The two tabs answer different questions and are not two views of one table.
 * **الباقات والأسعار** is the flat price list, for "what does the 12-month
 * card cost". **المنتجات** is the setup view, where a product's province, its
 * server and its whole set of tiers are one thing — which is why a product
 * opens into a dialog rather than a row of five columns.
 */

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Field, Pill, Select } from '@/components/ui';
import { useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import { formatIqd } from '@/lib/format';
import { ACTIVATION_API } from '@/lib/labels';
import { toAmount, type Category, type Id, type Product } from '@/types';
import type { CategoryInput, ProductInput } from '@/data/repositories/types';
import { Button, Tabs } from '@/components/ui';
import { CrudScreen } from '../shared/CrudScreen';
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
} from '../shared/productForm';
import { NewProductDialog, ProductDetailDialog } from './ProductDialogs';

export function PackagesPage() {
  const [tab, setTab] = useState<'categories' | 'products'>('categories');

  return (
    <>
      <div className="page-wash" style={{ paddingBottom: 0 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'categories', label: 'الباقات والأسعار' },
            { value: 'products', label: 'المنتجات' },
          ]}
        />
      </div>
      {tab === 'categories' ? <CategoriesTab /> : <ProductsTab />}
    </>
  );
}

// ------------------------------------------------------------ categories ---

function CategoriesTab() {
  const repos = useRepos();
  const products = useAsync(() => repos.catalog.products.all(), []);
  const productOptions = (products.data ?? []).map((row) => ({
    value: row.id,
    // The province is part of the identity: the same service exists once per
    // province, so the bare display name does not identify a product.
    label: row.province ? `${row.displayName} — ${row.province.name}` : row.displayName,
  }));

  const [productId, setProductId] = useState<Id>('');

  return (
    <CrudScreen<Category, CategoryInput, { productId?: Id }>
      title="الباقات والأسعار"
      subtitle="فئات كل منتج وأسعارها — سعر الكلفة، سعر التطبيق، وسعري الوكيل الرئيسي والفرعي"
      repo={repos.catalog.categories}
      searchable
      filter={productId ? { productId } : undefined}
      filters={
        <Select<Id>
          value={productId}
          onChange={setProductId}
          options={[{ value: '', label: 'كل المنتجات' }, ...productOptions]}
        />
      }
      createLabel="إضافة فئة"
      createTitle="إضافة فئة"
      editTitle="تعديل الفئة"
      dialogSize="xl"
      rowKey={(row) => row.id}
      labelOf={(row) => row.name}
      columns={[
        {
          key: 'name',
          header: 'الفئة',
          render: (row) => (
            <div className="col">
              <span className="strong">{row.name}</span>
              <span className="fs-small dim">{row.nameKu || '—'}</span>
            </div>
          ),
        },
        {
          key: 'product',
          header: 'المنتج',
          render: (row) => (
            <div className="col">
              <span className="fs-body">{row.product?.displayName ?? '—'}</span>
              <span className="fs-tiny dim">{row.product?.province?.name ?? ''}</span>
            </div>
          ),
        },
        {
          key: 'cost',
          header: 'الكلفة',
          numeric: true,
          render: (row) => <span className="num">{formatIqd(toAmount(row.costPrice))}</span>,
        },
        {
          key: 'unit',
          header: 'سعر التطبيق',
          numeric: true,
          render: (row) => (
            <span className="num strong">{formatIqd(toAmount(row.unitPrice))}</span>
          ),
        },
        {
          key: 'agents',
          header: 'الوكيل (رئيسي / فرعي)',
          numeric: true,
          render: (row) => (
            <span className="num">
              {formatIqd(toAmount(row.mainPrice))} / {formatIqd(toAmount(row.subPrice))}
            </span>
          ),
        },
        {
          key: 'flags',
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
          key: 'threshold',
          header: 'حد التنبيه',
          numeric: true,
          width: 96,
          render: (row) => (
            <span className="num dim">
              {row.lowStockThreshold === null ? '—' : row.lowStockThreshold}
            </span>
          ),
        },
      ]}
      blank={() => blankCategory(productId || productOptions[0]?.value || '')}
      toInput={categoryToInput}
      validate={validateCategory}
      form={(draft, set) => (
        <>
          <Field label="المنتج" className="span-2">
            <Select<Id>
              value={draft.productId}
              onChange={(next) => set('productId', next)}
              options={productOptions}
            />
          </Field>
          <CategoryFields draft={draft} set={set} />
        </>
      )}
    />
  );
}

// -------------------------------------------------------------- products ---

function ProductsTab() {
  const repos = useRepos();
  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const regions = useAsync(() => repos.regions.all(), []);
  const categories = useAsync(() => repos.catalog.categories.all(), []);

  const provinceOptions = (provinces.data ?? []).map((row) => ({ value: row.id, label: row.name }));
  const regionOptions = (regions.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  // Counted rather than joined: the tier count is what says whether a product
  // is sellable at all, and a product with none is the fault worth surfacing.
  const tierCount = new Map<Id, number>();
  for (const category of categories.data ?? []) {
    tierCount.set(category.productId, (tierCount.get(category.productId) ?? 0) + 1);
  }

  const [opened, setOpened] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);

  // A category write only changes the tier counts, so it reloads that read
  // alone. Remounting the table for it would throw away the operator's search
  // and page — which is exactly where they were before opening the product.
  const onCategoryChange = () => categories.reload();

  // A new product is a new row, and `CrudScreen` owns its own list state with
  // no reload handle, so the remount is the honest way to show it.
  const onProductCreated = () => {
    categories.reload();
    setVersion((n) => n + 1);
  };

  return (
    <>
      <CrudScreen<Product, ProductInput>
        key={version}
        title="المنتجات"
        subtitle="الخدمة المباعة بكل محافظة — وأي سيرفر سلفرسات يفعّل كارتاتها"
        repo={repos.catalog.products}
        searchable
        createLabel="إضافة منتج"
        createTitle="إضافة منتج"
        editTitle="تعديل المنتج"
        dialogSize="lg"
        headerActions={
          <Button variant="outline" icon={<Layers size={15} />} onClick={() => setCreating(true)}>
            منتج مع فئاته
          </Button>
        }
        rowKey={(row) => row.id}
        labelOf={(row) => row.displayName}
        columns={[
          {
            key: 'name',
            header: 'المنتج',
            render: (row) => (
              <div className="col">
                <span className="strong">{row.displayName}</span>
                <span className="fs-small dim">{row.name}</span>
              </div>
            ),
          },
          {
            key: 'province',
            header: 'المحافظة',
            render: (row) => row.province?.name ?? '—',
          },
          {
            key: 'tiers',
            header: 'الفئات',
            numeric: true,
            width: 110,
            render: (row) => {
              const count = tierCount.get(row.id) ?? 0;
              return count === 0 ? (
                <Pill tone="danger">ماكو فئات</Pill>
              ) : (
                <span className="num">{count}</span>
              );
            },
          },
          {
            key: 'api',
            header: 'التفعيل',
            render: (row) => (
              <Pill tone={row.activationApi === 'silvers' ? 'neutral' : 'muted'}>
                {ACTIVATION_API[row.activationApi]}
              </Pill>
            ),
          },
          {
            key: 'region',
            header: 'السيرفر',
            render: (row) =>
              row.silversatRegion ? (
                <span className="fs-body">{row.silversatRegion.name}</span>
              ) : row.activationApi === 'silvers' ? (
                <Pill tone="danger">غير مربوط</Pill>
              ) : (
                <span className="dim">—</span>
              ),
          },
          {
            key: 'open',
            header: '',
            width: 84,
            render: (row) => (
              <Button variant="ghost" size="sm" onClick={() => setOpened(row)}>
                تفاصيل
              </Button>
            ),
          },
        ]}
        blank={() => blankProduct(provinceOptions[0]?.value ?? '')}
        toInput={productToInput}
        validate={validateProduct}
        form={(draft, set) => (
          <ProductFields
            draft={draft}
            set={set}
            provinceOptions={provinceOptions}
            regionOptions={regionOptions}
          />
        )}
      />

      {opened ? (
        <ProductDetailDialog
          product={opened}
          onClose={() => setOpened(null)}
          onChanged={onCategoryChange}
        />
      ) : null}

      {creating ? (
        <NewProductDialog
          provinceOptions={provinceOptions}
          regionOptions={regionOptions}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            onProductCreated();
          }}
        />
      ) : null}
    </>
  );
}
