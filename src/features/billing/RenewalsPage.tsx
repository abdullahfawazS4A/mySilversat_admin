/**
 * Renewal ledger — the money view.
 *
 * The totals strip above the table recomputes with the filters, so "how much
 * did Nineveh bring in through agents last month" is three dropdowns rather
 * than an export into a spreadsheet.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Undo2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader, DataTable, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Notice,
  Pill,
  SearchInput,
  Select,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import type { Id, PaymentMethod, RenewalStatus } from '@/types';
import type { RenewalRow } from '@/data/repositories/types';
import { PAYMENT_METHOD, RENEWAL_STATUS } from '@/lib/labels';
import { formatDateAr, formatIqd, formatIqdCompact, formatNumber, formatPhone } from '@/lib/format';
import { downloadCsv, sumBy } from '@/lib/utils';

export function RenewalsPage() {
  const repos = useRepos();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [method, setMethod] = useState<PaymentMethod | 'all'>('all');
  const [status, setStatus] = useState<RenewalStatus | 'all'>('all');
  const [governorateId, setGovernorateId] = useState<Id | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [refunding, setRefunding] = useState<RenewalRow | null>(null);
  const [busy, setBusy] = useState(false);

  const userId = params.get('user');
  const governorates = useAsync(() => repos.catalog.governorates(), []);

  const query = useMemo(
    () => ({
      search: userId ? '' : debounced,
      method,
      status,
      governorateId: governorateId === 'all' ? undefined : governorateId,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    }),
    [debounced, method, status, governorateId, from, to, userId],
  );

  const renewals = useAsync(
    () => repos.renewals.list({ ...query, page, pageSize: 25 }),
    [query, page],
  );

  // Totals need every matching row, not just the visible page.
  const totals = useAsync(
    async () => {
      const all = await repos.renewals.list({ ...query, pageSize: 100000 });
      const rows = userId ? all.items.filter((r) => r.userId === userId) : all.items;
      const completed = rows.filter((r) => r.status === 'completed');
      return {
        count: rows.length,
        revenue: sumBy(completed, (r) => r.price),
        refunded: sumBy(rows.filter((r) => r.status === 'refunded'), (r) => r.price),
        months: sumBy(completed, (r) => r.months),
      };
    },
    [query, userId],
  );

  const runRefund = async (reason: string) => {
    if (!refunding) return;
    setBusy(true);
    try {
      await repos.renewals.refund(refunding.id, reason);
      toast('انسترجع التجديد ورجع تاريخ الانتهاء');
      setRefunding(null);
      renewals.reload();
      totals.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الاسترجاع', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const all = await repos.renewals.list({ ...query, pageSize: 100000 });
    downloadCsv('renewals.csv', [
      ['التاريخ', 'المشترك', 'الهاتف', 'رقم الجهاز', 'الأشهر', 'المبلغ', 'طريقة الدفع', 'الوكيل', 'الحالة'],
      ...all.items.map((r) => [
        formatDateAr(r.createdAt),
        r.userName,
        r.userPhone,
        r.deviceNumber,
        r.months,
        r.price,
        PAYMENT_METHOD[r.method],
        r.agentName ?? '',
        RENEWAL_STATUS[r.status].label,
      ]),
    ]);
    toast('تم تصدير الملف');
  };

  const columns: Column<RenewalRow>[] = [
    {
      key: 'createdAt',
      header: 'التاريخ',
      sortable: true,
      render: (row) => <span className="fs-13">{formatDateAr(row.createdAt)}</span>,
    },
    {
      key: 'userName',
      header: 'المشترك',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">{row.userName}</span>
          <span className="fs-11 dim num">{formatPhone(row.userPhone)}</span>
        </div>
      ),
    },
    {
      key: 'deviceNumber',
      header: 'الجهاز',
      render: (row) => <span className="fs-12 num muted">{row.deviceNumber}</span>,
    },
    {
      key: 'months',
      header: 'المدة',
      numeric: true,
      width: 74,
      render: (row) => (
        <span className="num">
          {row.months} <span className="dim">شهر</span>
        </span>
      ),
    },
    {
      key: 'price',
      header: 'المبلغ',
      numeric: true,
      sortable: true,
      render: (row) => <span className="fs-13 strong num">{formatIqd(row.price)}</span>,
    },
    {
      key: 'method',
      header: 'الدفع',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">{PAYMENT_METHOD[row.method]}</span>
          {row.agentName ? <span className="fs-11 dim truncate">{row.agentName}</span> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const meta = RENEWAL_STATUS[row.status];
        return <Pill tone={meta.tone}>{meta.label}</Pill>;
      },
    },
    {
      key: 'actions',
      header: '',
      width: 60,
      render: (row) =>
        row.status === 'completed' ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Undo2 size={14} />}
            title="استرجاع"
            onClick={() => setRefunding(row)}
          />
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="التجديدات"
        subtitle="سجل كل المعاملات المالية، مع الإجماليات حسب الفلاتر المختارة"
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
            تصدير CSV
          </Button>
        }
      />

      <div className="page">
        {userId ? (
          <Notice tone="info">
            معروضة تجديدات مشترك واحد.{' '}
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/renewals')}>
              عرض الكل
            </button>
          </Notice>
        ) : null}

        <AsyncBlock
          state={totals}
          skeleton={<div className="grid grid-kpi" />}
        >
          {(data) => (
            <div className="grid grid-kpi">
              <StatTile label="عدد المعاملات" value={formatNumber(data.count)} />
              <StatTile label="الإيراد المحصّل" value={formatIqdCompact(data.revenue)} />
              <StatTile label="المسترجع" value={formatIqdCompact(data.refunded)} tone="danger" />
              <StatTile label="إجمالي الأشهر المباعة" value={formatNumber(data.months)} />
            </div>
          )}
        </AsyncBlock>

        <Card>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="مشترك، هاتف، أو رقم جهاز…" />
            <Select
              value={method}
              onChange={(next) => {
                setMethod(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل طرق الدفع' },
                ...(['kcard', 'cash_agent', 'online', 'free_grant'] as PaymentMethod[]).map((key) => ({
                  value: key,
                  label: PAYMENT_METHOD[key],
                })),
              ]}
            />
            <Select
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل الحالات' },
                { value: 'completed' as const, label: 'مكتمل' },
                { value: 'refunded' as const, label: 'مسترجع' },
                { value: 'pending' as const, label: 'قيد التنفيذ' },
                { value: 'failed' as const, label: 'فاشل' },
              ]}
            />
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
          </Toolbar>

          <Toolbar>
            <Field label="من تاريخ">
              <TextInput type="date" value={from} onChange={setFrom} />
            </Field>
            <Field label="إلى تاريخ">
              <TextInput type="date" value={to} onChange={setTo} />
            </Field>
            {from || to ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom('');
                  setTo('');
                }}
              >
                مسح التواريخ
              </Button>
            ) : null}
          </Toolbar>

          <AsyncBlock state={renewals}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={userId ? data.items.filter((r) => r.userId === userId) : data.items}
                rowKey={(row) => row.id}
                onRowClick={(row) => navigate(`/users/${row.userId}`)}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {refunding ? (
        <RefundDialog
          row={refunding}
          pending={busy}
          onCancel={() => setRefunding(null)}
          onConfirm={(reason) => void runRefund(reason)}
        />
      ) : null}
    </>
  );
}

function RefundDialog({
  row,
  pending,
  onCancel,
  onConfirm,
}: {
  row: RenewalRow;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog
      title="استرجاع التجديد"
      danger
      pending={pending}
      confirmLabel="استرجاع"
      onCancel={onCancel}
      onConfirm={() => onConfirm(reason || 'بدون سبب مذكور')}
      message={
        <div className="col" style={{ gap: 'var(--sp-3)' }}>
          <span>
            راح يرجع تاريخ انتهاء الجهاز <span className="num strong">{row.deviceNumber}</span> إلى{' '}
            <span className="num strong">{formatDateAr(row.expiryBefore)}</span>، وينلغي كوبون السحب
            الصادر عن هذه المعاملة إن وُجد.
          </span>
          <Field label="سبب الاسترجاع">
            <TextInput value={reason} onChange={setReason} placeholder="مثلاً: دفع مكرر بالغلط" />
          </Field>
        </div>
      }
    />
  );
}
