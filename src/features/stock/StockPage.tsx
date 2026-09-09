/**
 * Card stock.
 *
 * Stock is held per governorate, and that is the whole point: a renewal in
 * Basra burns a Basra card, so an operator's real question is never "how many
 * cards do we have" but "can I renew this customer *right now*". The grid
 * answers that directly — one row per governorate, one column per card length,
 * each cell the number of renewals still possible there.
 *
 * A cell at or under the low-stock threshold is called out, and a zero is
 * called out harder, because that is a governorate where renewals are already
 * failing at the counter.
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Boxes,
  PackagePlus,
  Trash2,
  Warehouse,
} from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader, DataTable, Toolbar, BulkBar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  TextArea,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import type { CardStatus, Governorate, Id } from '@/types';
import type { StockCardRow } from '@/data/repositories/types';
import { CARD_STATUS } from '@/lib/labels';
import { formatDateAr, formatNumber, monthsAr, relativeAr } from '@/lib/format';
import { cx } from '@/lib/utils';

export function StockPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [governorateId, setGovernorateId] = useState<Id | 'all'>('all');
  const [months, setMonths] = useState<string>('all');
  const [status, setStatus] = useState<CardStatus | 'all'>('available');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [adding, setAdding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [voiding, setVoiding] = useState<StockCardRow | null>(null);
  const [deleting, setDeleting] = useState<StockCardRow | null>(null);
  const [run, action] = useAction();

  const governorates = useAsync(() => repos.catalog.governorates(), []);
  const settings = useAsync(() => repos.admin.settings(), []);
  const levels = useAsync(() => repos.stock.levels(), []);
  const cards = useAsync(
    () =>
      repos.stock.cards({
        search: debounced,
        governorateId: governorateId === 'all' ? undefined : governorateId,
        months: months === 'all' ? undefined : Number(months),
        status,
        page,
        pageSize: 25,
      }),
    [debounced, governorateId, months, status, page],
  );

  const refresh = () => {
    levels.reload();
    cards.reload();
    setSelected(new Set());
  };

  const threshold = settings.data?.lowStockThreshold ?? 20;
  const lengths = useMemo(
    () => [...new Set((levels.data ?? []).map((l) => l.months))].sort((a, b) => a - b),
    [levels.data],
  );

  const governorateById = useMemo(() => {
    const map = new Map<Id, Governorate>();
    for (const governorate of governorates.data ?? []) map.set(governorate.id, governorate);
    return map;
  }, [governorates.data]);

  // Availability keyed by governorate + length, so the grid is a lookup rather
  // than a scan per cell.
  const availableBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const level of levels.data ?? []) {
      map.set(`${level.governorateId}|${level.months}`, level.available);
    }
    return map;
  }, [levels.data]);

  const totalAvailable = (levels.data ?? []).reduce((sum, l) => sum + l.available, 0);
  const totalUsed = (levels.data ?? []).reduce((sum, l) => sum + l.used, 0);
  // A governorate is "at risk" when any length it is supposed to sell is thin.
  const atRisk = (levels.data ?? []).filter(
    (l) => governorateById.get(l.governorateId)?.active && l.available <= threshold,
  );
  const soldOut = atRisk.filter((l) => l.available === 0);

  const runVoid = async (reasonAr: string) => {
    if (!voiding) return;
    const ok = await run(() => repos.stock.voidCard(voiding.id, reasonAr));
    if (ok) {
      toast(`انلغى الكارت ${voiding.code}`);
      setVoiding(null);
      refresh();
    }
  };

  const runDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => repos.stock.remove(deleting.id));
    if (ok) {
      toast('انحذف الكارت');
      setDeleting(null);
      refresh();
    }
  };

  const columns = useMemo<Column<StockCardRow>[]>(
    () => [
      {
        key: 'code',
        header: 'الكود',
        render: (card) => (
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-13 strong num">{card.code}</span>
            <span className="fs-11 dim">دفعة {card.batchRef}</span>
          </div>
        ),
      },
      {
        key: 'governorateName',
        header: 'المحافظة',
        sortable: true,
        render: (card) => <span className="fs-13">{card.governorateName}</span>,
      },
      {
        key: 'months',
        header: 'المدة',
        numeric: true,
        sortable: true,
        width: 96,
        render: (card) => (
          <span className="fs-13">
            {monthsAr(card.months)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'الحالة',
        width: 150,
        render: (card) => {
          const meta = CARD_STATUS[card.status];
          return (
            <div className="col" style={{ gap: 3 }}>
              <Pill tone={meta.tone}>{meta.label}</Pill>
              {card.voidReasonAr ? (
                <span className="fs-11 dim truncate" title={card.voidReasonAr}>
                  {card.voidReasonAr}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'addedAt',
        header: 'دخل المخزن',
        sortable: true,
        width: 140,
        render: (card) => (
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-12 num">{formatDateAr(card.addedAt)}</span>
            <span className="fs-11 dim">{relativeAr(card.addedAt)}</span>
          </div>
        ),
      },
      {
        key: 'usedAt',
        header: 'انسحب على',
        width: 160,
        render: (card) =>
          card.usedAt ? (
            <div className="col" style={{ lineHeight: 1.35 }}>
              <span className="fs-12 num">{card.deviceNumber ?? '—'}</span>
              <span className="fs-11 dim">{formatDateAr(card.usedAt)}</span>
            </div>
          ) : (
            <span className="dim">—</span>
          ),
      },
      {
        key: 'actions',
        header: '',
        width: 96,
        render: (card) =>
          card.status === 'used' ? (
            <span className="dim">—</span>
          ) : (
            <div className="row row-gap-1">
              {card.status === 'available' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Ban size={14} />}
                  title="إلغاء الكارت"
                  onClick={() => setVoiding(card)}
                />
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={14} />}
                title="حذف"
                onClick={() => setDeleting(card)}
              />
            </div>
          ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="مخزن الكارتات"
        subtitle="كل محافظة إلها مخزنها — والتجديد يسحب كارت من مخزن محافظة المشترك"
        actions={
          <Button variant="primary" icon={<PackagePlus size={16} />} onClick={() => setAdding(true)}>
            إضافة دفعة كارتات
          </Button>
        }
      />

      <div className="page col" style={{ gap: 'var(--sp-4)' }}>
        <div className="grid grid-kpi">
          <StatTile
            label="كارتات متاحة"
            value={formatNumber(totalAvailable)}
            hint="جاهزة للتجديد الآن"
            icon={<Boxes size={15} />}
          />
          <StatTile
            label="كارتات مستهلكة"
            value={formatNumber(totalUsed)}
            hint="انسحبت على تجديدات"
            icon={<Warehouse size={15} />}
          />
          <StatTile
            label="مخزون منخفض"
            value={formatNumber(atRisk.length)}
            hint={`${threshold} كارت أو أقل`}
            tone={atRisk.length > 0 ? 'warning' : undefined}
            icon={<AlertTriangle size={15} />}
          />
          <StatTile
            label="خلص المخزون"
            value={formatNumber(soldOut.length)}
            hint="التجديد بيها يفشل"
            tone={soldOut.length > 0 ? 'danger' : undefined}
            icon={<Ban size={15} />}
          />
        </div>

        {soldOut.length > 0 ? (
          <Notice tone="danger" icon={<AlertTriangle size={16} />}>
            خلصت كارتات{' '}
            <span className="strong">
              {soldOut
                .slice(0, 4)
                .map((l) => `${governorateById.get(l.governorateId)?.nameAr} (${monthsAr(l.months)})`)
                .join('، ')}
            </span>
            {soldOut.length > 4 ? ` و${soldOut.length - 4} غيرها` : ''} — أي تجديد بهذه المدة راح
            ينرفض لحد ما تعبّي المخزن.
          </Notice>
        ) : null}

        <Card>
          <CardHead
            title="المخزون حسب المحافظة"
            subtitle="الرقم = كم تجديد بعده ممكن بهذه المدة"
          />
          <AsyncBlock state={levels}>
            {() => (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المحافظة</th>
                      {lengths.map((months) => (
                        <th key={months} style={{ width: 110 }}>
                          {monthsAr(months)}
                        </th>
                      ))}
                      <th style={{ width: 110 }}>المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(governorates.data ?? []).map((governorate) => {
                      const rowTotal = lengths.reduce(
                        (sum, m) => sum + (availableBy.get(`${governorate.id}|${m}`) ?? 0),
                        0,
                      );
                      return (
                        <tr key={governorate.id}>
                          <td>
                            <div className="row row-gap-2">
                              <span className="fs-13">{governorate.nameAr}</span>
                              {!governorate.active ? <Pill tone="muted">معطّلة</Pill> : null}
                            </div>
                          </td>
                          {lengths.map((months) => {
                            const available = availableBy.get(`${governorate.id}|${months}`) ?? 0;
                            const low = governorate.active && available <= threshold;
                            const out = governorate.active && available === 0;
                            return (
                              <td key={months} className="table-num">
                                <span
                                  title={
                                    out
                                      ? 'خلص — التجديد بهذه المدة ينرفض'
                                      : low
                                        ? 'مخزون منخفض'
                                        : undefined
                                  }
                                >
                                  <Pill tone={out ? 'danger' : low ? 'warning' : 'neutral'}>
                                    <span className="num">{formatNumber(available)}</span>
                                  </Pill>
                                </span>
                              </td>
                            );
                          })}
                          <td className={cx('table-num', 'strong')}>
                            <span className="num">{formatNumber(rowTotal)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AsyncBlock>
        </Card>

        <Card>
          <CardHead title="الكارتات" subtitle="المتاح أولاً، والأقدم قبل الأحدث — هذا ترتيب السحب" />

          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="ابحث بكود الكارت أو الدفعة…" />

            <Select
              value={governorateId}
              onChange={(next) => {
                setGovernorateId(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل المحافظات' },
                ...(governorates.data ?? []).map((g) => ({ value: g.id, label: g.nameAr })),
              ]}
            />

            <Select
              value={months}
              onChange={(next) => {
                setMonths(next);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'كل المدد' },
                ...lengths.map((m) => ({ value: String(m), label: monthsAr(m) })),
              ]}
            />

            <Select
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              options={[
                { value: 'available' as const, label: 'متاح' },
                { value: 'used' as const, label: 'مستهلك' },
                { value: 'void' as const, label: 'ملغى' },
                { value: 'all' as const, label: 'كل الحالات' },
              ]}
            />
          </Toolbar>

          {action.error ? (
            <div className="card-pad">
              <Notice tone="danger">{action.error}</Notice>
            </div>
          ) : null}

          {selected.size > 0 ? (
            <BulkBar count={selected.size}>
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRightLeft size={14} />}
                onClick={() => setTransferring(true)}
              >
                نقل لمحافظة ثانية
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                إلغاء التحديد
              </Button>
            </BulkBar>
          ) : null}

          <AsyncBlock state={cards}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(card) => card.id}
                selectedIds={selected}
                onToggleSelect={(id) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onToggleSelectAll={(ids) =>
                  setSelected((current) =>
                    ids.every((id) => current.has(id)) ? new Set() : new Set(ids),
                  )
                }
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  <EmptyState
                    title="ما بيها كارتات بهذه الفلاتر"
                    hint="أضف دفعة كارتات للمحافظة، أو غيّر الفلاتر."
                    icon={<Boxes size={22} />}
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<PackagePlus size={14} />}
                        onClick={() => setAdding(true)}
                      >
                        إضافة دفعة
                      </Button>
                    }
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {adding ? (
        <AddBatchDialog
          governorates={governorates.data ?? []}
          lengths={lengths}
          defaultGovernorateId={governorateId === 'all' ? null : governorateId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      ) : null}

      {transferring ? (
        <TransferDialog
          count={selected.size}
          ids={[...selected]}
          governorates={governorates.data ?? []}
          onClose={() => setTransferring(false)}
          onSaved={() => {
            setTransferring(false);
            refresh();
          }}
        />
      ) : null}

      {voiding ? (
        <VoidDialog
          card={voiding}
          pending={action.pending}
          onConfirm={(reason) => void runVoid(reason)}
          onCancel={() => setVoiding(null)}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف الكارت"
          message={
            <>
              راح ينحذف الكارت <span className="num strong">{deleting.code}</span> نهائياً من مخزن{' '}
              {deleting.governorateName}. استخدم الحذف بس إذا انسجّل بالغلط — غير هيك ألغِه حتى يظل
              بالسجل.
            </>
          }
          confirmLabel="حذف"
          danger
          pending={action.pending}
          onConfirm={() => void runDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

// --------------------------------------------------------------- dialogs ---

/**
 * Files a shipment.
 *
 * Two ways in, because both happen: codes arrive as a list to paste, or as a
 * printed range the operator would otherwise type out one by one.
 */
function AddBatchDialog({
  governorates,
  lengths,
  defaultGovernorateId,
  onClose,
  onSaved,
}: {
  governorates: Governorate[];
  lengths: number[];
  defaultGovernorateId: Id | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [governorateId, setGovernorateId] = useState<Id>(
    defaultGovernorateId ?? governorates[0]?.id ?? '',
  );
  const [months, setMonths] = useState<string>(String(lengths[0] ?? 3));
  const [batchRef, setBatchRef] = useState(
    `B-${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`,
  );
  const [mode, setMode] = useState<'paste' | 'range'>('paste');
  const [pasted, setPasted] = useState('');
  const [prefix, setPrefix] = useState('SLV');
  const [from, setFrom] = useState('1');
  const [count, setCount] = useState('50');

  const governorate = governorates.find((g) => g.id === governorateId);

  // Both modes converge on one list of codes, so the repository only ever
  // sees codes and never has to know how they were produced.
  const codes = useMemo(() => {
    if (mode === 'paste') {
      return pasted
        .split(/[\s,;\n]+/)
        .map((code) => code.trim())
        .filter(Boolean);
    }
    const start = Number(from);
    const howMany = Number(count);
    if (!Number.isFinite(start) || !Number.isFinite(howMany) || howMany <= 0) return [];
    const region = governorateId.replace('gov_', '').toUpperCase();
    return Array.from({ length: Math.min(howMany, 2000) }, (_, i) =>
      `${prefix}-${region}-${months.padStart(2, '0')}-${(start + i).toString().padStart(5, '0')}`,
    );
  }, [mode, pasted, prefix, from, count, governorateId, months]);

  const submit = async () => {
    if (!governorateId) {
      toast('اختر المحافظة', 'error');
      return;
    }
    const ok = await run(
      () =>
        repos.stock.addBatch({
          governorateId,
          months: Number(months),
          codes,
          batchRef,
        }),
      (result) => {
        toast(
          result.duplicates.length > 0
            ? `انضاف ${result.added} كارت — و${result.duplicates.length} كود موجود مسبقاً انتجاهل`
            : `انضاف ${result.added} كارت لمخزن ${governorate?.nameAr ?? ''}`,
        );
      },
    );
    if (ok) onSaved();
  };

  return (
    <Modal
      title="إضافة دفعة كارتات"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<PackagePlus size={15} />}
            disabled={action.pending || codes.length === 0}
            onClick={() => void submit()}
          >
            {action.pending ? 'جاري الإضافة…' : `إضافة ${codes.length} كارت`}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <div className="grid grid-2">
          <Field label="المحافظة" hint="الكارتات تنسحب على مشتركي هذه المحافظة فقط">
            <Select
              value={governorateId}
              onChange={setGovernorateId}
              options={governorates.map((g) => ({
                value: g.id,
                label: g.active ? g.nameAr : `${g.nameAr} (معطّلة)`,
              }))}
            />
          </Field>

          <Field label="مدة الكارت" hint="لازم تطابق مدة الباقة وقت التجديد">
            <Select
              value={months}
              onChange={setMonths}
              options={lengths.map((m) => ({ value: String(m), label: monthsAr(m) }))}
            />
          </Field>
        </div>

        <Field label="رقم الدفعة" hint="حتى تكدر تتبع شحنة كاملة إذا طلعت خربانة">
          <TextInput value={batchRef} onChange={setBatchRef} />
        </Field>

        <div className="row row-gap-2">
          <Button
            variant={mode === 'paste' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMode('paste')}
          >
            لصق أكواد
          </Button>
          <Button
            variant={mode === 'range' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMode('range')}
          >
            توليد تسلسل
          </Button>
        </div>

        {mode === 'paste' ? (
          <Field
            label="أكواد الكارتات"
            hint="كل كود بسطر، أو مفصولة بفاصلة — الأكواد المكررة تنتجاهل"
          >
            <TextArea
              value={pasted}
              onChange={setPasted}
              rows={7}
              placeholder={'SLV-BGD-12-00001\nSLV-BGD-12-00002'}
            />
          </Field>
        ) : (
          <div className="grid grid-3">
            <Field label="البادئة">
              <TextInput value={prefix} onChange={setPrefix} />
            </Field>
            <Field label="يبدأ من">
              <TextInput type="number" min={1} value={from} onChange={setFrom} />
            </Field>
            <Field label="العدد" hint="حد أقصى 2000">
              <TextInput type="number" min={1} max={2000} value={count} onChange={setCount} />
            </Field>
          </div>
        )}

        {codes.length > 0 ? (
          <Notice tone="success">
            راح ينضاف <span className="num strong">{formatNumber(codes.length)}</span> كارت{' '}
            <span className="strong">{monthsAr(Number(months))}</span> لمخزن{' '}
            <span className="strong">{governorate?.nameAr}</span> — يعني{' '}
            <span className="num strong">{formatNumber(codes.length)}</span> تجديد إضافي ممكن هناك.
            <div className="fs-11 dim num" style={{ marginTop: 4 }}>
              أول كود: {codes[0]} · آخر كود: {codes[codes.length - 1]}
            </div>
          </Notice>
        ) : null}
      </div>
    </Modal>
  );
}

/** Moves unused stock between governorates when one runs dry. */
function TransferDialog({
  count,
  ids,
  governorates,
  onClose,
  onSaved,
}: {
  count: number;
  ids: Id[];
  governorates: Governorate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [target, setTarget] = useState<Id>('');

  const submit = async () => {
    if (!target) {
      toast('اختر المحافظة', 'error');
      return;
    }
    const ok = await run(
      () => repos.stock.transfer(ids, target),
      (moved) => toast(`انتقل ${moved} كارت`),
    );
    if (ok) onSaved();
  };

  return (
    <Modal
      title="نقل كارتات لمحافظة ثانية"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<ArrowRightLeft size={15} />}
            disabled={action.pending}
            onClick={() => void submit()}
          >
            نقل
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <Notice tone="info">
          الكارتات المستهلكة ما تنتقل — بس المتاحة. المحدد الآن{' '}
          <span className="num strong">{count}</span> كارت.
        </Notice>

        <Field label="المحافظة الجديدة">
          <Select
            value={target}
            onChange={setTarget}
            options={[
              { value: '', label: 'اختر المحافظة' },
              ...governorates.map((g) => ({
                value: g.id,
                label: g.active ? g.nameAr : `${g.nameAr} (معطّلة)`,
              })),
            ]}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Takes a card out of circulation, with the reason kept on the row. */
function VoidDialog({
  card,
  pending,
  onConfirm,
  onCancel,
}: {
  card: StockCardRow;
  pending: boolean;
  onConfirm: (reasonAr: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal
      title="إلغاء كارت"
      onClose={onCancel}
      footer={
        <>
          <Button
            variant="danger"
            icon={<Ban size={15} />}
            disabled={pending || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            إلغاء الكارت
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            تراجع
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        <Notice tone="warning">
          الكارت <span className="num strong">{card.code}</span> راح يطلع من المخزون المتاح وما ينسحب
          على أي تجديد. يظل بالسجل مع السبب.
        </Notice>
        <Field label="السبب" hint="مثال: كارت تالف، أو انسرب كوده">
          <TextInput value={reason} onChange={setReason} placeholder="اكتب السبب…" />
        </Field>
      </div>
    </Modal>
  );
}
