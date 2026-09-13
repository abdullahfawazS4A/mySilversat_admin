/**
 * Card stock.
 *
 * Two views of the same thing, so they share a screen. **الدفعات** is how
 * stock arrives — a file of codes filed against one category, with the counters
 * the API keeps over it. **الكارتات** is how stock is looked up — one code at
 * a time, usually because a customer is reading a number down the phone.
 *
 * Filing a shipment goes through `/batches/with-codes`: the batch and all of
 * its codes are created in one request, so a half-imported shipment is not a
 * state that can exist. Codes are pasted rather than uploaded because that is
 * what the endpoint takes — one per line, and a second column after a comma or
 * a tab when the category carries a secondary value.
 */

import { useMemo, useState } from 'react';
import { Boxes, Plus, Upload } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  EmptyState,
  Field,
  FilterChips,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  Tabs,
  TextArea,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import { formatDateAr, formatDateTimeAr, formatNumber } from '@/lib/format';
import { BATCH_STATUS, CODE_STATUS } from '@/lib/labels';
import type { Batch, Category, Code, CodeStatus, Id } from '@/types';

export function StockPage() {
  const [tab, setTab] = useState<'batches' | 'codes'>('batches');

  return (
    <>
      <div className="page-wash" style={{ paddingBottom: 0 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'batches', label: 'الدفعات' },
            { value: 'codes', label: 'الكارتات' },
          ]}
        />
      </div>
      {tab === 'batches' ? <BatchesTab /> : <CodesTab />}
    </>
  );
}

/** Labels a category with its product, since names repeat across provinces. */
function categoryLabel(category: Category): string {
  const product = category.product;
  if (!product) return category.name;
  const province = product.province?.name;
  return `${product.displayName} — ${category.name}${province ? ` (${province})` : ''}`;
}

// ----------------------------------------------------------------- batches --

function BatchesTab() {
  const repos = useRepos();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [categoryId, setCategoryId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);
  const [filing, setFiling] = useState(false);

  const categories = useAsync(() => repos.catalog.categories.all(), []);
  const batches = useAsync(
    () =>
      repos.stock.batches.list({
        search: debounced,
        categoryId: categoryId === 'all' ? undefined : categoryId,
        page,
        pageSize: 20,
      }),
    [debounced, categoryId, page],
  );

  // Totals over the visible page — the API gives no stock-wide aggregate, and
  // inventing one from a page would be a number that quietly means something
  // else than it says.
  const rows = batches.data?.items ?? [];
  const totals = useMemo(
    () => ({
      available: rows.reduce((sum, row) => sum + row.codeAvailableCount, 0),
      sold: rows.reduce((sum, row) => sum + row.codeSoldCount, 0),
      disabled: rows.reduce((sum, row) => sum + row.codeDisabledCount, 0),
    }),
    [rows],
  );

  const columns: Column<Batch>[] = [
    {
      key: 'file',
      header: 'الدفعة',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13 strong">{row.fileName}</span>
          <span className="fs-11 dim">{row.notes ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'الفئة',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">{row.category?.name ?? '—'}</span>
          <span className="fs-11 dim">{row.category?.product?.displayName ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'counts',
      header: 'الكارتات',
      render: (row) => (
        <div className="row row-gap-2 wrap">
          <Pill tone="success">متاح {formatNumber(row.codeAvailableCount)}</Pill>
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
          <span className="fs-12">{row.uploadedByUser?.name ?? '—'}</span>
          <span className="fs-11 dim">{formatDateAr(row.createdAt)}</span>
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
        title="مخزن الكارتات"
        subtitle="دفعات الكارتات الواصلة وأعدادها — الدفعة تنربط بفئة وحدة"
        actions={
          <Button variant="primary" icon={<Upload size={15} />} onClick={() => setFiling(true)}>
            رفع دفعة
          </Button>
        }
      />

      <div className="page">
        <div className="grid grid-kpi-3">
          <StatTile label="متاح (بهذه الصفحة)" value={formatNumber(totals.available)} />
          <StatTile label="مباع (بهذه الصفحة)" value={formatNumber(totals.sold)} />
          <StatTile label="معطّل (بهذه الصفحة)" value={formatNumber(totals.disabled)} />
        </div>

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
                    title="ماكو دفعات"
                    hint="ارفع دفعة كارتات حتى يبدأ المخزن"
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {filing ? (
        <FileBatchDialog
          categories={categories.data ?? []}
          onClose={() => setFiling(false)}
          onFiled={() => {
            setFiling(false);
            setPage(1);
            batches.reload();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Files a shipment.
 *
 * The codes are parsed here rather than sent as text, so the operator sees the
 * count the server is about to receive before committing — a paste with a
 * stray blank line or a trailing header row is otherwise only discovered as a
 * wrong total afterwards.
 */
function FileBatchDialog({
  categories,
  onClose,
  onFiled,
}: {
  categories: Category[];
  onClose: () => void;
  onFiled: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [categoryId, setCategoryId] = useState<Id>(categories[0]?.id ?? '');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const [raw, setRaw] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  const category = categories.find((row) => row.id === categoryId);
  const wantsSecondary = category?.hasSecondaryCode ?? false;

  /** One code per line; a comma or tab splits the secondary value off. */
  const parsed = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [primary, secondary] = line.split(/[,\t]/).map((part) => part.trim());
          return {
            primaryValue: primary,
            secondaryValue: secondary ? secondary : null,
          };
        })
        .filter((code) => code.primaryValue),
    [raw],
  );

  const missingSecondary = wantsSecondary && parsed.some((code) => !code.secondaryValue);

  const submit = async () => {
    const problem = !categoryId
      ? 'اختر الفئة'
      : !fileName.trim()
        ? 'اسم الدفعة مطلوب'
        : parsed.length === 0
          ? 'ألصق الكارتات — سطر لكل كارت'
          : missingSecondary
            ? 'هذي الفئة تحتاج قيمة ثانية لكل كارت — افصلها بفاصلة'
            : null;
    setInvalid(problem);
    if (problem) return;

    const ok = await run(() =>
      repos.stock.batches.createWithCodes({
        categoryId,
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
            disabled={action.pending}
            onClick={() => void submit()}
          >
            {action.pending ? 'جاري الرفع…' : `رفع ${parsed.length} كارت`}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="grid grid-form">
        <Field label="الفئة">
          <Select<Id>
            value={categoryId}
            onChange={setCategoryId}
            options={categories.map((row) => ({ value: row.id, label: categoryLabel(row) }))}
          />
        </Field>
        <Field label="اسم الدفعة" hint="اسم الملف الواصل — هوية الشحنة">
          <TextInput value={fileName} onChange={setFileName} placeholder="ninawa-12m-2026-01.csv" />
        </Field>
        <Field label="ملاحظات" className="span-2" hint="اختيارية">
          <TextInput value={notes} onChange={setNotes} />
        </Field>

        <Field
          label="الكارتات"
          className="span-2"
          hint={
            wantsSecondary
              ? 'سطر لكل كارت: القيمة الأساسية ثم فاصلة ثم القيمة الثانية'
              : 'سطر لكل كارت'
          }
        >
          <TextArea
            rows={8}
            value={raw}
            onChange={setRaw}
            placeholder={wantsSecondary ? '1234567890,4321\n1234567891,4322' : '1234567890\n1234567891'}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Notice tone={missingSecondary ? 'danger' : 'info'}>
          انقرأ <span className="strong num">{parsed.length}</span> كارت.
          {wantsSecondary
            ? ' هذي الفئة تحمل قيمة ثانية لكل كارت.'
            : ' هذي الفئة ما تحتاج قيمة ثانية.'}
        </Notice>
      </div>

      {invalid || action.error ? (
        <div className="field-error mt-2">{invalid ?? action.error}</div>
      ) : null}
    </Modal>
  );
}

// ------------------------------------------------------------------- codes --

function CodesTab() {
  const repos = useRepos();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState<CodeStatus | 'all'>('all');
  const [categoryId, setCategoryId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const categories = useAsync(() => repos.catalog.categories.all(), []);
  const codes = useAsync(
    () =>
      repos.stock.codes.list({
        search: debounced,
        status: status === 'all' ? undefined : status,
        categoryId: categoryId === 'all' ? undefined : categoryId,
        page,
        pageSize: 25,
      }),
    [debounced, status, categoryId, page],
  );

  const columns: Column<Code>[] = [
    {
      key: 'value',
      header: 'الكارت',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13 strong num">{row.primaryValue}</span>
          {row.secondaryValue ? (
            <span className="fs-11 dim num">{row.secondaryValue}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'الفئة',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">{row.category?.name ?? '—'}</span>
          <span className="fs-11 dim">{row.category?.product?.displayName ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'batch',
      header: 'الدفعة',
      render: (row) => <span className="fs-12">{row.batch?.fileName ?? '—'}</span>,
    },
    {
      key: 'sold',
      header: 'البيع',
      render: (row) =>
        row.soldAt ? (
          <span className="fs-12">{formatDateTimeAr(row.soldAt)}</span>
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
        title="الكارتات"
        subtitle="دوّر على كارت برقمه — البحث يلكاه بأي حالة كان"
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
              <span className="fs-12 muted">
                البحث يستخدم <code className="num">/codes/lookup</code> ويتجاهل فلاتر الحالة والفئة.
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
