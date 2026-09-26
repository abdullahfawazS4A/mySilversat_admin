/**
 * Countries and provinces.
 *
 * Two tabs over one screen because they are one decision: a province cannot
 * exist without a country, and the operator who adds Ninawa has usually just
 * added Iraq. Splitting them into two routes would mean navigating between
 * them to finish one task.
 *
 * A province is not a lookup row here, it is the unit the business runs in.
 * It is served by one or more SilverSat servers, and everything else reaches
 * it through them — a product is sold in a province because its server is in
 * it, and a subscriber belongs to a province because their server does. None
 * of that is visible from a province's own four columns, so the table carries
 * it, and the detail dialog is where "how is Ninawa set up" gets answered in
 * one place instead of three screens.
 *
 * The rule this screen polices: **every server names a province, and every
 * province has a server.** A province with no server has nothing to sell and
 * no one can register in it; a server with no province takes its products,
 * its stock and its subscribers out of every province view in the console.
 * The API enforces neither.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, PlugZap, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import { useToast } from '@/app/ToastContext';
import { formatIqd, formatIqdCompact, formatNumber } from '@/lib/format';
import type {
  Category,
  Country,
  Id,
  Product,
  Province,
  ProvinceOverview,
  SilversatRegion,
} from '@/types';
import { provinceOfProduct, toAmount } from '@/types';
import type { CountryInput, ProvinceInput } from '@/data/repositories/types';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  Field,
  Modal,
  Notice,
  Pill,
  Select,
  Tabs,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import { DataTable, type Column } from '@/components/page';
import { CrudScreen } from '../shared/CrudScreen';

export function ProvincesPage() {
  const [tab, setTab] = useState<'provinces' | 'countries'>('provinces');

  return (
    <>
      <div className="page-wash" style={{ paddingBottom: 0 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'provinces', label: 'المحافظات' },
            { value: 'countries', label: 'الدول' },
          ]}
        />
      </div>
      {tab === 'provinces' ? <ProvincesTab /> : <CountriesTab />}
    </>
  );
}

// ------------------------------------------------------------- provinces ---

function ProvincesTab() {
  const repos = useRepos();
  const countries = useAsync(() => repos.geo.countries.all(), []);
  const options = (countries.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  // One read for the whole table. It is five list routes deep, so it is loaded
  // once beside the paged list rather than per row.
  const overview = useAsync(() => repos.geo.overview(), []);
  const byProvince = useMemo(
    () => new Map((overview.data ?? []).map((row) => [row.province.id, row])),
    [overview.data],
  );

  // Servers that name no province: everything on them is invisible from here.
  const regions = useAsync(() => repos.regions.all(), []);
  const homeless = (regions.data ?? []).filter((row) => !row.provinceId);

  const [opened, setOpened] = useState<Province | null>(null);
  const unserved = (overview.data ?? []).filter((row) => row.regions.length === 0);

  return (
    <>
      <CrudScreen<Province, ProvinceInput>
        title="المحافظات"
        subtitle="وحدة التقسيم اللي ينبني عليها كل شي — السيرفر، المنتجات، المخزن والمشتركون"
        repo={repos.geo.provinces}
        searchable
        createLabel="إضافة محافظة"
        createTitle="إضافة محافظة"
        editTitle="تعديل المحافظة"
        rowKey={(row) => row.id}
        labelOf={(row) => row.name}
        columns={[
          {
            key: 'name',
            header: 'المحافظة',
            render: (row) => (
              <div className="col" style={{ lineHeight: 1.35 }}>
                <span className="strong">{row.name}</span>
                <span className="fs-tiny dim">
                  {row.code} · {row.country?.name ?? '—'}
                </span>
              </div>
            ),
          },
          {
            key: 'server',
            header: 'سيرفر سلفرسات',
            render: (row) => <BindingCell overview={byProvince.get(row.id)} />,
          },
          {
            key: 'catalog',
            header: 'المنتجات والفئات',
            render: (row) => {
              const data = byProvince.get(row.id);
              if (!data) return <span className="dim">—</span>;
              return (
                <span className="fs-small">
                  <span className="num strong">{formatNumber(data.productCount)}</span> منتج ·{' '}
                  <span className="num">{formatNumber(data.categoryCount)}</span> فئة
                </span>
              );
            },
          },
          {
            key: 'stock',
            header: 'المخزن',
            render: (row) => {
              const data = byProvince.get(row.id);
              if (!data) return <span className="dim">—</span>;
              return (
                <div className="row row-gap-1 wrap">
                  <Pill tone={data.codesAvailable === 0 ? 'danger' : 'success'}>
                    متاح {formatNumber(data.codesAvailable)}
                  </Pill>
                  {data.lowStockCategories > 0 ? (
                    <Pill tone="warning">{data.lowStockCategories} فئة قربت تخلص</Pill>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'users',
            header: 'المشتركون',
            numeric: true,
            width: 100,
            render: (row) => {
              const data = byProvince.get(row.id);
              return <span className="num">{data ? formatNumber(data.userCount) : '—'}</span>;
            },
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
        blank={() => ({ countryId: options[0]?.value ?? '', code: '', name: '' })}
        toInput={(row) => ({ countryId: row.countryId, code: row.code, name: row.name })}
        validate={(draft) =>
          !draft.name.trim() ? 'اسم المحافظة مطلوب' : !draft.countryId ? 'اختر الدولة' : null
        }
        form={(draft, set) => (
          <>
            <Field label="اسم المحافظة">
              <TextInput
                value={draft.name}
                onChange={(next) => set('name', next)}
                placeholder="نينوى"
              />
            </Field>
            <Field label="الرمز" hint="اختصار قصير يميّز المحافظة">
              <TextInput value={draft.code} onChange={(next) => set('code', next)} placeholder="Ne" />
            </Field>
            <Field label="الدولة">
              <Select<Id>
                value={draft.countryId}
                onChange={(next) => set('countryId', next)}
                options={options}
              />
            </Field>
          </>
        )}
      >
        {homeless.length > 0 ? (
          <Notice tone="danger">
            <span className="strong num">{homeless.length}</span> سيرفر ما مربوط بأي محافظة:{' '}
            {homeless.map((row) => row.name).join('، ')}. منتجات هذي السيرفرات ومخزنها ومشتركيها
            ما يطلعون تحت أي محافظة. صلّحها من <Link to="/api">سيرفرات سلفرسات</Link> ← تعديل
            السيرفر ← المحافظة.
          </Notice>
        ) : null}
        {unserved.length > 0 ? (
          <Notice tone="warning">
            <span className="strong num">{unserved.length}</span> محافظة ماكو سيرفر مربوط بيها —
            ما ينباع بيها شي، ومستخدمي التطبيق ما يكدرون ينسجّلون عليها.
          </Notice>
        ) : null}
      </CrudScreen>

      {opened ? (
        <ProvinceDetailDialog
          province={opened}
          overview={byProvince.get(opened.id)}
          onClose={() => setOpened(null)}
        />
      ) : null}
    </>
  );
}

/** The province's servers as one cell, or the fault instead. */
function BindingCell({ overview }: { overview: ProvinceOverview | undefined }) {
  if (!overview) return <span className="dim">—</span>;
  if (overview.regions.length === 0) return <Pill tone="danger">ماكو سيرفر</Pill>;
  return (
    <div className="row row-gap-2 wrap">
      {overview.regions.map((region) => (
        <span key={region.id} className="row row-gap-1">
          <span className="fs-body">{region.name}</span>
          {region.isActive ? null : <Pill tone="muted">متوقف</Pill>}
        </span>
      ))}
    </div>
  );
}

/**
 * Everything one province owns, in one dialog.
 *
 * The categories are listed under their product rather than flat, because the
 * price an operator is looking for is always "how much is the 12-month card in
 * Ninawa" — a product and a tier together, never a tier alone.
 */
function ProvinceDetailDialog({
  province,
  overview,
  onClose,
}: {
  province: Province;
  overview: ProvinceOverview | undefined;
  onClose: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();

  const catalog = useAsync(async () => {
    const [products, categories] = await Promise.all([
      repos.catalog.products.all(),
      repos.catalog.categories.all(),
    ]);
    const mine = products.filter((product) => provinceOfProduct(product) === province.id);
    const ids = new Set(mine.map((product) => product.id));
    return {
      products: mine,
      categories: categories
        .filter((category) => ids.has(category.productId))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }, [province.id]);

  const servers = overview?.regions ?? [];
  const [checking, setChecking] = useState<Id | null>(null);

  const check = async (region: SilversatRegion) => {
    setChecking(region.id);
    try {
      const result = await repos.regions.check(region.id);
      toast(
        result.ok ? `${region.name}: يرد` : `${region.name}: ما يرد`,
        result.ok ? 'success' : 'error',
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الفحص', 'error');
    } finally {
      setChecking(null);
    }
  };

  return (
    <Modal
      title={`محافظة ${province.name}`}
      size="xl"
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          إغلاق
        </Button>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {servers.length === 0 ? (
          <Notice tone="danger">
            ماكو سيرفر سلفرسات مربوط بهذي المحافظة — فما ينباع بيها شي، ومستخدمي التطبيق ما يكدرون
            ينسجّلون عليها. اربط سيرفر من سيرفرات سلفرسات ← تعديل السيرفر ← المحافظة.
          </Notice>
        ) : null}

        <div className="grid grid-kpi">
          <StatTile label="كارتات متاحة" value={formatNumber(overview?.codesAvailable ?? 0)} />
          <StatTile label="كارتات مباعة" value={formatNumber(overview?.codesSold ?? 0)} />
          <StatTile label="قيمة المخزن" value={formatIqdCompact(overview?.stockValue ?? 0)} />
          <StatTile label="المشتركون" value={formatNumber(overview?.userCount ?? 0)} />
        </div>

        <Card pad>
          <CardHead
            title={servers.length > 1 ? 'سيرفرات سلفرسات' : 'سيرفر سلفرسات'}
            subtitle="منتجات ومشتركين هذي المحافظة على هذي السيرفرات — والاستعلام والتجديد يروحون إلها"
            actions={servers.length === 0 ? <Pill tone="danger">غير مربوط</Pill> : undefined}
          />
          <div className="col mt-3" style={{ gap: 'var(--sp-3)' }}>
            {servers.map((region) => (
              <div key={region.id} className="row row-gap-2">
                <span className="fs-body strong">{region.name}</span>
                {region.isActive ? null : <Pill tone="muted">متوقف</Pill>}
                <span className="fs-small dim">{region.baseUrl ?? ''}</span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<PlugZap size={14} />}
                  disabled={checking !== null}
                  onClick={() => void check(region)}
                >
                  {checking === region.id ? 'جاري…' : 'فحص'}
                </Button>
              </div>
            ))}
            {overview && overview.unroutedProducts > 0 ? (
              <span className="fs-small">
                <Pill tone="warning">{overview.unroutedProducts} منتج</Pill> تفعيله مو عبر سلفرسات.
              </span>
            ) : null}
          </div>
        </Card>

        <Card pad>
          <CardHead
            title="المنتجات والفئات"
            subtitle="كل منتج وفئاته — والسعر يتغيّر من فئة لفئة"
            actions={
              <Link to="/stock">
                <Button variant="ghost" size="sm">
                  فتح المخزن
                </Button>
              </Link>
            }
          />
          <div className="mt-3">
            <AsyncBlock state={catalog}>
              {(data) =>
                data.products.length === 0 ? (
                  <Notice tone="info">ماكو منتجات بهذي المحافظة بعد.</Notice>
                ) : (
                  <div className="col" style={{ gap: 'var(--sp-4)' }}>
                    {data.products.map((product) => (
                      <ProductPrices
                        key={product.id}
                        product={product}
                        categories={data.categories.filter((row) => row.productId === product.id)}
                      />
                    ))}
                  </div>
                )
              }
            </AsyncBlock>
          </div>
        </Card>

        <div className="row row-gap-2">
          <Link to={`/stock?province=${province.id}`}>
            <Button variant="outline" icon={<Boxes size={15} />}>
              مخزن {province.name}
            </Button>
          </Link>
          <Link to="/api">
            <Button variant="ghost" icon={<Server size={15} />}>
              سيرفرات سلفرسات
            </Button>
          </Link>
        </div>
      </div>
    </Modal>
  );
}

/** One product's price tiers. Four prices per tier, as the API stores them. */
function ProductPrices({ product, categories }: { product: Product; categories: Category[] }) {
  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'الفئة',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-body strong">{row.name}</span>
          <span className="fs-tiny dim">{row.nameKu || '—'}</span>
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'الكلفة',
      numeric: true,
      render: (row) => <span className="num dim">{formatIqd(toAmount(row.costPrice))}</span>,
    },
    {
      key: 'unit',
      header: 'سعر التطبيق',
      numeric: true,
      render: (row) => <span className="num strong">{formatIqd(toAmount(row.unitPrice))}</span>,
    },
    {
      key: 'state',
      header: 'الحالة',
      width: 96,
      render: (row) =>
        row.isDisabled ? (
          <Pill tone="danger">معطّلة</Pill>
        ) : row.isDisplay ? (
          <Pill tone="success">معروضة</Pill>
        ) : (
          <Pill tone="muted">مخفية</Pill>
        ),
    },
  ];

  return (
    <div className="col" style={{ gap: 'var(--sp-2)' }}>
      <div className="row row-gap-2">
        <span className="fs-body strong">{product.displayName}</span>
        {product.silversatRegion ? (
          <Pill tone="neutral">{product.silversatRegion.name}</Pill>
        ) : (
          <Pill tone="danger">
            <AlertTriangle size={12} /> بدون سيرفر
          </Pill>
        )}
      </div>
      {categories.length === 0 ? (
        <span className="fs-small dim">ماكو فئات — هذا المنتج ما ينباع.</span>
      ) : (
        <DataTable columns={columns} rows={categories} rowKey={(row) => row.id} />
      )}
    </div>
  );
}

// -------------------------------------------------------------- countries --

function CountriesTab() {
  const repos = useRepos();

  return (
    <CrudScreen<Country, CountryInput>
      title="الدول"
      subtitle="الدول اللي تنتمي إلها المحافظات والدوريات"
      repo={repos.geo.countries}
      searchable
      createLabel="إضافة دولة"
      createTitle="إضافة دولة"
      editTitle="تعديل الدولة"
      rowKey={(row) => row.id}
      labelOf={(row) => row.name}
      columns={[
        { key: 'name', header: 'الدولة', render: (row) => <span className="strong">{row.name}</span> },
        { key: 'code', header: 'الرمز', render: (row) => <span className="num">{row.code}</span> },
        {
          key: 'dial',
          header: 'مفتاح الاتصال',
          render: (row) => <span className="num">{row.dialCode}</span>,
        },
        {
          key: 'currency',
          header: 'العملة',
          render: (row) => <Pill tone="muted">{row.currency}</Pill>,
        },
      ]}
      blank={() => ({ code: '', dialCode: '', name: '', currency: 'IQD' })}
      toInput={(row) => ({
        code: row.code,
        dialCode: row.dialCode,
        name: row.name,
        currency: row.currency,
      })}
      validate={(draft) => (!draft.name.trim() ? 'اسم الدولة مطلوب' : null)}
      form={(draft, set) => (
        <>
          <Field label="اسم الدولة">
            <TextInput
              value={draft.name}
              onChange={(next) => set('name', next)}
              placeholder="العراق"
            />
          </Field>
          <Field label="الرمز">
            <TextInput value={draft.code} onChange={(next) => set('code', next)} placeholder="iq" />
          </Field>
          <Field label="مفتاح الاتصال">
            <TextInput
              value={draft.dialCode}
              onChange={(next) => set('dialCode', next)}
              placeholder="+964"
            />
          </Field>
          <Field label="العملة">
            <TextInput
              value={draft.currency}
              onChange={(next) => set('currency', next)}
              placeholder="IQD"
            />
          </Field>
        </>
      )}
    />
  );
}
