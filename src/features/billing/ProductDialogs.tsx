/**
 * A product, opened up.
 *
 * A product row is five columns, but a product is three things at once: the
 * service a province sells, the **price tiers** it sells it at, and the
 * **SilverSat server** that turns one of those tiers into a live subscription.
 * Split across two tabs, the third one is invisible until something fails —
 * so this dialog puts the server, its health, and the vendor tools that run
 * against it beside the prices they activate.
 *
 * The vendor tools here differ from the ones on the devices screen in exactly
 * one way, and it is the point of them: **the server is not chosen.** It is
 * the product's own `silversatRegionId`, so checking a card of this product,
 * or looking a subscriber up "under this product", asks the server that would
 * actually serve them. A support tool that answers confidently against the
 * wrong province is worse than one that refuses.
 *
 * `NewProductDialog` exists for the same reason `/products/with-categories`
 * does: a product with no tier cannot be sold and cannot hold stock, so
 * creating one without prices is creating a row nobody can use.
 */

import { useState } from 'react';
import { Plus, PlugZap, Search, Ticket, Trash2, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  Field,
  KeyValue,
  Modal,
  Notice,
  Pill,
  Select,
  TextInput,
  useDraft,
} from '@/components/ui';
import { formatIqd } from '@/lib/format';
import { ACTIVATION_API } from '@/lib/labels';
import { toAmount, type Category, type Id, type Product } from '@/types';
import type { CategoryInput, ProductInput } from '@/data/repositories/types';
import { VendorPayload } from '../shared/VendorPayload';
import {
  CategoryFields,
  blankCategory,
  categoryToInput,
  validateCategory,
} from '../shared/categoryForm';
import {
  ProductFields,
  blankProduct,
  validateProduct,
  type Option,
} from '../shared/productForm';

// ------------------------------------------------------- product details ---

export function ProductDetailDialog({
  product,
  onClose,
  onChanged,
}: {
  product: Product;
  onClose: () => void;
  /** Called after a category write, so the list behind the dialog refreshes. */
  onChanged: () => void;
}) {
  const repos = useRepos();

  const categories = useAsync(
    () =>
      repos.catalog.categories
        .all({ productId: product.id })
        .then((rows) =>
          rows
            .filter((row) => row.productId === product.id)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        ),
    [product.id],
  );

  const [editing, setEditing] = useState<{ row: Category | null } | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);

  const region = product.silversatRegion ?? null;
  const routed = product.activationApi === 'silvers' && Boolean(product.silversatRegionId);

  const refresh = () => {
    categories.reload();
    onChanged();
  };

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
      key: 'agents',
      header: 'رئيسي / فرعي',
      numeric: true,
      render: (row) => (
        <span className="num">
          {formatIqd(toAmount(row.mainPrice))} / {formatIqd(toAmount(row.subPrice))}
        </span>
      ),
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
            title="تعديل"
            icon={<Pencil size={14} />}
            onClick={() => setEditing({ row })}
          />
          <Button
            variant="ghost"
            size="sm"
            title="حذف"
            icon={<Trash2 size={14} />}
            onClick={() => setRemoving(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={product.displayName}
        size="xl"
        onClose={onClose}
        footer={
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        }
      >
        <div className="col" style={{ gap: 'var(--sp-4)' }}>
          {!routed ? (
            <Notice tone="danger">
              {product.activationApi === 'silvers'
                ? 'هذا المنتج تفعيله عبر سلفرسات بس ما مربوط بسيرفر — كارتاته ما راح تتفعّل، والاستعلام والتجديد ما يشتغلون.'
                : 'تفعيل هذا المنتج مو عبر سلفرسات، فما بيه استعلام ولا تجديد من اللوحة.'}
            </Notice>
          ) : null}

          <Card pad>
            <CardHead
              title="سيرفر التفعيل"
              subtitle="نفس السيرفر اللي يروح إله التجديد والاستعلام لكل كارت من هذا المنتج"
              actions={region ? <RegionHealth regionId={region.id} name={region.name} /> : null}
            />
            <div className="mt-3">
              <KeyValue
                rows={[
                  ['المحافظة', product.province?.name ?? '—'],
                  ['جهة التفعيل', ACTIVATION_API[product.activationApi]],
                  ['السيرفر', region?.name ?? <span className="dim">غير مربوط</span>],
                  ['الدومين', region?.baseUrl ?? '—'],
                ]}
              />
            </div>
          </Card>

          {routed && region ? <VendorTools regionId={region.id} product={product} /> : null}

          <Card pad>
            <CardHead
              title="الفئات والأسعار"
              subtitle="كل فئة إلها سعرها — الكلفة، سعر التطبيق، وسعري الوكيل"
              actions={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setEditing({ row: null })}
                >
                  إضافة فئة
                </Button>
              }
            />
            <div className="mt-3">
              <AsyncBlock state={categories}>
                {(rows) =>
                  rows.length === 0 ? (
                    <Notice tone="warning">
                      ماكو فئات لهذا المنتج — يعني ما ينباع وما يكدر يستلم دفعة كارتات. أضف فئة
                      وحدة على الأقل.
                    </Notice>
                  ) : (
                    <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
                  )
                }
              </AsyncBlock>
            </div>
          </Card>

          <div className="row row-gap-2">
            <Link to={`/stock?province=${product.provinceId}`}>
              <Button variant="outline" icon={<Ticket size={15} />}>
                مخزن {product.province?.name ?? 'المحافظة'}
              </Button>
            </Link>
          </div>
        </div>
      </Modal>

      {editing ? (
        <CategoryDialog
          productId={product.id}
          row={editing.row}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}

      {removing ? (
        <DeleteCategoryDialog
          category={removing}
          onCancel={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}

/** The health check, inline. Session-local: nothing records a past check. */
function RegionHealth({ regionId, name }: { regionId: Id; name: string }) {
  const repos = useRepos();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const check = async () => {
    setPending(true);
    try {
      const result = await repos.regions.check(regionId);
      toast(result.ok ? `${name}: يرد` : `${name}: ما يرد`, result.ok ? 'success' : 'error');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الفحص', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      icon={<PlugZap size={14} />}
      disabled={pending}
      onClick={() => void check()}
    >
      {pending ? 'جاري…' : 'فحص السيرفر'}
    </Button>
  );
}

/**
 * Read-only vendor calls against this product's own server.
 *
 * Both are questions, not changes, so neither confirms — and neither writes
 * anything locally, which is why the answer is rendered exactly as the vendor
 * sent it rather than mapped onto labels we invented.
 */
function VendorTools({ regionId, product }: { regionId: Id; product: Product }) {
  const repos = useRepos();
  const [mode, setMode] = useState<'code' | 'device'>('code');
  const [value, setValue] = useState('');
  const [run, action] = useAction();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const submit = async () => {
    const q = value.trim();
    if (!q) return;
    setResult(null);
    await run(
      () =>
        mode === 'code'
          ? repos.silversat.checkCode(regionId, q)
          : repos.silversat.subscription(regionId, q),
      (data) => setResult(data),
    );
  };

  return (
    <Card pad>
      <CardHead
        title="استعلام من السيرفر"
        subtitle={`يروح لسيرفر ${product.silversatRegion?.name ?? ''} — ما ينتخب يدوياً، ينشتق من المنتج`}
      />

      <div className="grid grid-form mt-3">
        <Field label="نوع الاستعلام">
          <Select<'code' | 'device'>
            value={mode}
            onChange={(next) => {
              setMode(next);
              setValue('');
              setResult(null);
            }}
            options={[
              { value: 'code', label: 'فحص كارت' },
              { value: 'device', label: 'اشتراك رسيفر' },
            ]}
          />
        </Field>
        <Field label={mode === 'code' ? 'رقم الكارت' : 'رقم الرسيفر'}>
          <TextInput
            value={value}
            onChange={setValue}
            placeholder={mode === 'code' ? 'رقم الكارت' : 'رقم الجهاز'}
          />
        </Field>
      </div>

      <div className="row row-gap-2 mt-3">
        <Button
          variant="outline"
          icon={<Search size={15} />}
          disabled={action.pending || !value.trim()}
          onClick={() => void submit()}
        >
          {action.pending ? 'جاري الاستعلام…' : 'استعلام'}
        </Button>
      </div>

      {action.error ? (
        <div className="mt-3">
          <Notice tone="danger">{action.error}</Notice>
        </div>
      ) : null}

      {result ? (
        <div className="col mt-3" style={{ gap: 'var(--sp-2)' }}>
          <span className="fs-small muted">رد السيرفر</span>
          <VendorPayload data={result} />
        </div>
      ) : null}
    </Card>
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

function DeleteCategoryDialog({
  category,
  onCancel,
  onDone,
}: {
  category: Category;
  onCancel: () => void;
  onDone: () => void;
}) {
  const repos = useRepos();
  const [run, action] = useAction();

  return (
    <ConfirmDialog
      danger
      title="حذف الفئة"
      confirmLabel="حذف"
      pending={action.pending}
      message={
        <>
          راح تنحذف الفئة <span className="strong">{category.name}</span> وأسعارها. الكارتات
          المرفوعة عليها ما راح تظل إلها فئة.
          {action.error ? <div className="field-error mt-2">{action.error}</div> : null}
        </>
      }
      onCancel={onCancel}
      onConfirm={async () => {
        const ok = await run(() => repos.catalog.categories.remove(category.id));
        if (ok) onDone();
      }}
    />
  );
}

// ----------------------------------------------------- product + tiers -----

/**
 * Creates a product together with its price tiers.
 *
 * One request, because two would leave an unsellable product behind whenever
 * the second failed — and an operator who has just been told "saved" does not
 * go looking for a product with no prices.
 */
export function NewProductDialog({
  provinceOptions,
  regionOptions,
  onClose,
  onCreated,
}: {
  provinceOptions: Option[];
  regionOptions: Option[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const { draft, set } = useDraft<ProductInput>(blankProduct(provinceOptions[0]?.value ?? ''));

  // Tiers are drafted locally and sent with the product. `productId` is filled
  // in by the server, so the drafts carry an empty one and it is stripped.
  const [tiers, setTiers] = useState<CategoryInput[]>([blankCategory('')]);
  const [openTier, setOpenTier] = useState(0);

  const setTier = (index: number) => {
    return <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) => {
      setTiers((current) =>
        current.map((tier, i) => (i === index ? { ...tier, [key]: value } : tier)),
      );
    };
  };

  const submit = async () => {
    const problem =
      validateProduct(draft) ??
      (tiers.length === 0
        ? 'أضف فئة وحدة على الأقل — المنتج بدون فئة ما ينباع'
        : (tiers
            .map((tier, index) => {
              const bad = validateCategory({ ...tier, productId: 'pending' });
              return bad ? `الفئة ${index + 1}: ${bad}` : null;
            })
            .find(Boolean) ?? null));

    setInvalid(problem);
    if (problem) return;

    const ok = await run(() =>
      repos.catalog.products.createWithCategories({
        ...draft,
        categories: tiers.map(({ productId: _ignored, ...rest }) => rest),
      }),
    );
    if (!ok) return;
    toast(`انضاف المنتج و${tiers.length} فئة`);
    onCreated();
  };

  return (
    <Modal
      title="إضافة منتج وفئاته"
      size="xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={action.pending} onClick={() => void submit()}>
            {action.pending ? 'جاري الحفظ…' : `حفظ المنتج و${tiers.length} فئة`}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        <Notice tone="info">
          المنتج ينباع بمحافظة وحدة، وكارتاته تنفعّل على سيرفر واحد. الفئات هي اللي تحمل الأسعار —
          فئة لكل مدة أو باقة.
        </Notice>

        <div className="grid grid-form">
          <ProductFields
            draft={draft}
            set={set}
            provinceOptions={provinceOptions}
            regionOptions={regionOptions}
          />
        </div>

        <Card pad>
          <CardHead
            title="الفئات وأسعارها"
            subtitle="كل فئة إلها سعر خاص — الكلفة، سعر التطبيق، وسعري الوكيل"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => {
                  setTiers((current) => [...current, blankCategory('')]);
                  setOpenTier(tiers.length);
                }}
              >
                فئة ثانية
              </Button>
            }
          />

          <div className="col mt-3" style={{ gap: 'var(--sp-3)' }}>
            {tiers.map((tier, index) => (
              <Card key={index} pad>
                <div className="row between row-gap-2">
                  <button
                    type="button"
                    className="row row-gap-2"
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                    onClick={() => setOpenTier(openTier === index ? -1 : index)}
                  >
                    <span className="fs-body strong">
                      {tier.name.trim() || `فئة ${index + 1}`}
                    </span>
                    {tier.unitPrice > 0 ? (
                      <Pill tone="neutral">{formatIqd(tier.unitPrice)}</Pill>
                    ) : (
                      <Pill tone="muted">بدون سعر</Pill>
                    )}
                  </button>
                  {tiers.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="حذف الفئة"
                      icon={<Trash2 size={14} />}
                      onClick={() => {
                        setTiers((current) => current.filter((_, i) => i !== index));
                        setOpenTier(0);
                      }}
                    />
                  ) : null}
                </div>

                {openTier === index ? (
                  <div className="grid grid-form mt-3">
                    <CategoryFields draft={tier} set={setTier(index)} />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </Card>
      </div>

      {invalid || action.error ? (
        <div className="field-error mt-3">{invalid ?? action.error}</div>
      ) : null}
    </Modal>
  );
}
