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
 */

import { useState } from 'react';
import { Field, Pill, Select, Switch, TextInput } from '@/components/ui';
import { useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import { formatIqd } from '@/lib/format';
import { ACTIVATION_API } from '@/lib/labels';
import { toAmount, type ActivationApi, type Category, type Id, type Product } from '@/types';
import type { CategoryInput, ProductInput } from '@/data/repositories/types';
import { Tabs } from '@/components/ui';
import { CrudScreen } from '../shared/CrudScreen';

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
              <span className="fs-12 dim">{row.nameKu || '—'}</span>
            </div>
          ),
        },
        {
          key: 'product',
          header: 'المنتج',
          render: (row) => (
            <div className="col">
              <span className="fs-13">{row.product?.displayName ?? '—'}</span>
              <span className="fs-11 dim">{row.product?.province?.name ?? ''}</span>
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
      blank={() => ({
        productId: productId || productOptions[0]?.value || '',
        name: '',
        nameKu: '',
        costPrice: 0,
        unitPrice: 0,
        mainPrice: 0,
        subPrice: 0,
        hasSecondaryCode: false,
        lowStockThreshold: null,
        isDisabled: false,
        isDisplay: true,
        sortOrder: 0,
      })}
      toInput={(row) => ({
        productId: row.productId,
        name: row.name,
        nameKu: row.nameKu,
        costPrice: toAmount(row.costPrice),
        unitPrice: toAmount(row.unitPrice),
        mainPrice: toAmount(row.mainPrice),
        subPrice: toAmount(row.subPrice),
        hasSecondaryCode: row.hasSecondaryCode,
        lowStockThreshold: row.lowStockThreshold,
        isDisabled: row.isDisabled,
        isDisplay: row.isDisplay,
        sortOrder: row.sortOrder,
      })}
      validate={(draft) =>
        !draft.productId
          ? 'اختر المنتج'
          : !draft.name.trim()
            ? 'اسم الفئة مطلوب'
            : draft.unitPrice <= 0
              ? 'سعر التطبيق لازم يكون أكبر من صفر'
              : null
      }
      form={(draft, set) => (
        <>
          <Field label="المنتج" className="span-2">
            <Select<Id>
              value={draft.productId}
              onChange={(next) => set('productId', next)}
              options={productOptions}
            />
          </Field>

          <Field label="اسم الفئة بالعربي">
            <TextInput
              value={draft.name}
              onChange={(next) => set('name', next)}
              placeholder="اشتراك 12 شهر"
            />
          </Field>
          <Field label="اسم الفئة بالكردي">
            <TextInput value={draft.nameKu} onChange={(next) => set('nameKu', next)} />
          </Field>

          <Field label="سعر الكلفة" hint="شكد يكلّفنا الكارت">
            <TextInput
              type="number"
              min={0}
              value={draft.costPrice}
              onChange={(next) => set('costPrice', Number(next) || 0)}
            />
          </Field>
          <Field label="سعر التطبيق" hint="السعر اللي يشوفه المشترك">
            <TextInput
              type="number"
              min={0}
              value={draft.unitPrice}
              onChange={(next) => set('unitPrice', Number(next) || 0)}
            />
          </Field>
          <Field label="سعر الوكيل الرئيسي">
            <TextInput
              type="number"
              min={0}
              value={draft.mainPrice}
              onChange={(next) => set('mainPrice', Number(next) || 0)}
            />
          </Field>
          <Field label="سعر الوكيل الفرعي">
            <TextInput
              type="number"
              min={0}
              value={draft.subPrice}
              onChange={(next) => set('subPrice', Number(next) || 0)}
            />
          </Field>

          <Field label="حد التنبيه للمخزون" hint="خلّيها فارغة حتى تطفي التنبيه">
            <TextInput
              type="number"
              min={0}
              value={draft.lowStockThreshold ?? ''}
              onChange={(next) => set('lowStockThreshold', next === '' ? null : Number(next) || 0)}
            />
          </Field>
          <Field label="الترتيب">
            <TextInput
              type="number"
              value={draft.sortOrder ?? 0}
              onChange={(next) => set('sortOrder', Number(next) || 0)}
            />
          </Field>

          <Field label="كود ثانوي" hint="فعّلها إذا الكارت يجي بقيمتين">
            <Switch
              checked={draft.hasSecondaryCode ?? false}
              onChange={(next) => set('hasSecondaryCode', next)}
              label="الكارت يحمل قيمة ثانية"
            />
          </Field>
          <Field label="العرض بالتطبيق">
            <Switch
              checked={draft.isDisplay ?? true}
              onChange={(next) => set('isDisplay', next)}
              label="تنعرض بالتطبيق"
            />
          </Field>
          <Field label="التعطيل" hint="الفئة المعطّلة ما تنباع أبداً">
            <Switch
              checked={draft.isDisabled ?? false}
              onChange={(next) => set('isDisabled', next)}
              label="معطّلة"
            />
          </Field>
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

  const provinceOptions = (provinces.data ?? []).map((row) => ({ value: row.id, label: row.name }));
  const regionOptions = (regions.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  return (
    <CrudScreen<Product, ProductInput>
      title="المنتجات"
      subtitle="الخدمة المباعة بكل محافظة — وأي سيرفر سلفرسات يفعّل كارتاتها"
      repo={repos.catalog.products}
      searchable
      createLabel="إضافة منتج"
      createTitle="إضافة منتج"
      editTitle="تعديل المنتج"
      dialogSize="lg"
      rowKey={(row) => row.id}
      labelOf={(row) => row.displayName}
      columns={[
        {
          key: 'name',
          header: 'المنتج',
          render: (row) => (
            <div className="col">
              <span className="strong">{row.displayName}</span>
              <span className="fs-12 dim">{row.name}</span>
            </div>
          ),
        },
        {
          key: 'province',
          header: 'المحافظة',
          render: (row) => row.province?.name ?? '—',
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
              <span className="fs-13">{row.silversatRegion.name}</span>
            ) : (
              <span className="dim">—</span>
            ),
        },
      ]}
      blank={() => ({
        name: '',
        displayName: '',
        provinceId: provinceOptions[0]?.value ?? '',
        activationApi: 'silvers',
        silversatRegionId: null,
      })}
      toInput={(row) => ({
        name: row.name,
        displayName: row.displayName,
        provinceId: row.provinceId,
        activationApi: row.activationApi,
        silversatRegionId: row.silversatRegionId,
        image: row.imageUrl ?? undefined,
      })}
      validate={(draft) =>
        !draft.displayName.trim()
          ? 'الاسم المعروض مطلوب'
          : !draft.provinceId
            ? 'اختر المحافظة'
            : draft.activationApi === 'silvers' && !draft.silversatRegionId
              ? 'منتج التفعيل عبر سلفرسات لازم يرتبط بسيرفر'
              : null
      }
      form={(draft, set) => (
        <>
          <Field label="الاسم المعروض" hint="اللي يشوفه المشترك بالتطبيق">
            <TextInput
              value={draft.displayName}
              onChange={(next) => set('displayName', next)}
              placeholder="سلفرسات نينوى"
            />
          </Field>
          <Field label="الاسم الداخلي" hint="للتمييز باللوحة">
            <TextInput value={draft.name} onChange={(next) => set('name', next)} />
          </Field>

          <Field label="المحافظة">
            <Select<Id>
              value={draft.provinceId}
              onChange={(next) => set('provinceId', next)}
              options={provinceOptions}
            />
          </Field>
          <Field label="جهة التفعيل">
            <Select<ActivationApi>
              value={draft.activationApi ?? 'silvers'}
              onChange={(next) => {
                set('activationApi', next);
                // A non-silvers product has nothing to point a region at.
                if (next === 'other') set('silversatRegionId', null);
              }}
              options={(Object.keys(ACTIVATION_API) as ActivationApi[]).map((value) => ({
                value,
                label: ACTIVATION_API[value],
              }))}
            />
          </Field>

          <Field
            label="سيرفر سلفرسات"
            hint="السيرفر اللي راح ينشحن عليه كارت هذا المنتج"
            className="span-2"
          >
            <Select<Id>
              value={draft.silversatRegionId ?? ''}
              onChange={(next) => set('silversatRegionId', next || null)}
              options={[{ value: '', label: 'بدون سيرفر' }, ...regionOptions]}
              disabled={(draft.activationApi ?? 'silvers') !== 'silvers'}
            />
          </Field>

          <Field label="رابط الصورة" className="span-2">
            <TextInput
              type="url"
              value={draft.image ?? ''}
              onChange={(next) => set('image', next)}
              placeholder="https://…"
            />
          </Field>
        </>
      )}
    />
  );
}
