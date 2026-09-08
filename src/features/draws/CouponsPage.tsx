/**
 * Draw coupons.
 *
 * Coupons are issued automatically by qualifying renewals — there is no
 * "create coupon" action on purpose, because a hand-made coupon would be an
 * entry into a prize draw with no payment behind it.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Ticket } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader, DataTable, Toolbar, type Column } from '@/components/page';
import { AsyncBlock, Button, Card, FilterChips, Notice, Pill, SearchInput, Select } from '@/components/ui';
import { StatTile } from '@/components/charts';
import type { Id } from '@/types';
import type { CouponRow } from '@/data/repositories/types';
import { formatDateAr, formatNumber, formatPhone } from '@/lib/format';
import { downloadCsv } from '@/lib/utils';

export function CouponsPage() {
  const repos = useRepos();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [active, setActive] = useState<'all' | 'yes' | 'no'>('all');
  const [year, setYear] = useState<string>('');
  const [governorateId, setGovernorateId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const governorates = useAsync(() => repos.catalog.governorates(), []);
  const draws = useAsync(() => repos.draws.draws(), []);

  const coupons = useAsync(
    () =>
      repos.draws.coupons({
        search: debounced,
        year: year || undefined,
        active: active === 'all' ? 'all' : active === 'yes',
        governorateId: governorateId === 'all' ? undefined : governorateId,
        page,
        pageSize: 25,
      }),
    [debounced, year, active, governorateId, page],
  );

  const stats = useAsync(async () => {
    const all = await repos.draws.coupons({ pageSize: 100000 });
    return {
      total: all.items.length,
      active: all.items.filter((c) => c.active).length,
      winners: all.items.filter((c) => c.resultTextAr?.includes('فائز')).length,
    };
  }, []);

  const exportCsv = async () => {
    const all = await repos.draws.coupons({
      search: debounced,
      year: year || undefined,
      pageSize: 100000,
    });
    downloadCsv('coupons.csv', [
      ['الكوبون', 'المشترك', 'الهاتف', 'السنة', 'تاريخ الإصدار', 'الحالة', 'النتيجة'],
      ...all.items.map((c) => [
        c.code,
        c.userName,
        c.userPhone,
        c.year,
        formatDateAr(c.issuedAt),
        c.active ? 'ساري' : 'منتهي',
        c.resultTextAr ?? '',
      ]),
    ]);
    toast('تم تصدير الملف');
  };

  const columns: Column<CouponRow>[] = [
    {
      key: 'code',
      header: 'رقم الكوبون',
      render: (row) => (
        <span className="row row-gap-2">
          <span className="chip-icon chip-gold" style={{ width: 28, height: 28 }}>
            <Ticket size={14} />
          </span>
          <span className="fs-13 strong num">{row.code}</span>
        </span>
      ),
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
      key: 'governorate',
      header: 'المحافظة',
      render: (row) => (
        <span className="fs-12 muted">
          {governorates.data?.find((g) => g.id === row.governorateId)?.nameAr ?? '—'}
        </span>
      ),
    },
    { key: 'year', header: 'السنة', numeric: true, width: 74, render: (row) => <span className="num">{row.year}</span> },
    {
      key: 'issuedAt',
      header: 'تاريخ الإصدار',
      sortable: true,
      render: (row) => <span className="fs-13">{formatDateAr(row.issuedAt)}</span>,
    },
    {
      key: 'result',
      header: 'النتيجة',
      render: (row) =>
        row.resultTextAr ? (
          <span
            className="fs-12"
            style={{ color: row.resultTextAr.includes('فائز') ? 'var(--gold)' : 'var(--text-secondary)' }}
          >
            {row.resultTextAr}
          </span>
        ) : (
          <span className="fs-12 dim">بانتظار السحب</span>
        ),
    },
    {
      key: 'active',
      header: 'الحالة',
      render: (row) => <Pill tone={row.active ? 'success' : 'muted'}>{row.active ? 'ساري' : 'منتهي'}</Pill>,
    },
  ];

  return (
    <>
      <PageHeader
        title="الكوبونات"
        subtitle="كل كوبون صادر تلقائياً عن تجديد مؤهل — وهي المدخلات التي يجري عليها السحب"
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
            تصدير CSV
          </Button>
        }
      />

      <div className="page">
        <AsyncBlock state={stats} skeleton={<div className="grid grid-kpi" />}>
          {(data) => (
            <div className="grid grid-kpi">
              <StatTile label="إجمالي الكوبونات" value={formatNumber(data.total)} icon={<Ticket size={15} />} />
              <StatTile label="سارية (تدخل السحب)" value={formatNumber(data.active)} tone="success" />
              <StatTile label="كوبونات رابحة" value={formatNumber(data.winners)} tone="gold" />
            </div>
          )}
        </AsyncBlock>

        <Notice tone="info">
          الكوبون ينصدر تلقائياً مع أي تجديد مدته تساوي أو تزيد على الحد المحدد بالإعدادات. ما توجد
          إضافة يدوية للكوبونات — حتى يبقى كل مدخل للسحب وراه دفعة حقيقية.
        </Notice>

        <Card>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="رقم كوبون، اسم، أو هاتف…" />
            <Select
              value={year}
              onChange={(next) => {
                setYear(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'كل السنوات' },
                ...[...new Set((draws.data ?? []).map((d) => d.year))].map((y) => ({
                  value: y,
                  label: y,
                })),
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
            <FilterChips
              value={active}
              onChange={(next) => {
                setActive(next);
                setPage(1);
              }}
              items={[
                { value: 'all', label: 'الكل' },
                { value: 'yes', label: 'سارية' },
                { value: 'no', label: 'منتهية' },
              ]}
            />
          </Toolbar>

          <AsyncBlock state={coupons}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
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
    </>
  );
}
