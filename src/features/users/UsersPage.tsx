/**
 * Subscriber directory.
 *
 * The search box deliberately matches receiver serials as well as names and
 * phones: support calls almost always start with "the number on my box is
 * SLV-…", and making the agent look that up on a different screen first is
 * the wrong shape.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, UserX, Users as UsersIcon } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader, DataTable, Toolbar, type Column } from '@/components/page';
import { AsyncBlock, Button, Card, FilterChips, Pill, SearchInput, Select } from '@/components/ui';
import type { AppUser, AppUserStatus, DeviceStatus, Id } from '@/types';
import { USER_STATUS } from '@/lib/labels';
import { formatDateAr, formatIqd, formatNumber, formatPhone, relativeAr } from '@/lib/format';
import { downloadCsv } from '@/lib/utils';

export function UsersPage() {
  const repos = useRepos();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState<AppUserStatus | 'all'>('all');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | 'all'>('all');
  const [governorateId, setGovernorateId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const governorates = useAsync(() => repos.catalog.governorates(), []);
  const users = useAsync(
    () =>
      repos.users.list({
        search: debounced,
        status,
        deviceStatus,
        governorateId: governorateId === 'all' ? undefined : governorateId,
        page,
        pageSize: 25,
      }),
    [debounced, status, deviceStatus, governorateId, page],
  );

  const governorateName = (id: Id) =>
    governorates.data?.find((g) => g.id === id)?.nameAr ?? '—';

  const exportCsv = async () => {
    const all = await repos.users.list({ search: debounced, status, deviceStatus, pageSize: 100000 });
    downloadCsv('subscribers.csv', [
      ['الاسم', 'الهاتف', 'المحافظة', 'المنطقة', 'الحالة', 'النقاط', 'عدد التجديدات', 'إجمالي الصرف', 'تاريخ الانضمام'],
      ...all.items.map((user) => [
        user.fullName,
        user.phone,
        governorateName(user.governorateId),
        user.area,
        USER_STATUS[user.status].label,
        user.points,
        user.totalRenewals,
        user.totalSpend,
        formatDateAr(user.joinedAt),
      ]),
    ]);
    toast('تم تصدير الملف');
  };

  const columns: Column<AppUser>[] = [
    {
      key: 'fullName',
      header: 'المشترك',
      sortable: true,
      render: (user) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13 strong">{user.fullName}</span>
          <span className="fs-11 dim num">{formatPhone(user.phone)}</span>
        </div>
      ),
    },
    {
      key: 'governorate',
      header: 'الموقع',
      render: (user) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">{governorateName(user.governorateId)}</span>
          <span className="fs-11 dim">{user.area}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (user) => {
        const meta = USER_STATUS[user.status];
        return <Pill tone={meta.tone}>{meta.label}</Pill>;
      },
    },
    {
      key: 'points',
      header: 'النقاط',
      numeric: true,
      sortable: true,
      width: 92,
      render: (user) => (
        <div className="col" style={{ lineHeight: 1.3 }}>
          <span className="strong num">{formatNumber(user.points)}</span>
          {user.rank ? <span className="fs-11 dim num">#{user.rank}</span> : null}
        </div>
      ),
    },
    {
      key: 'totalRenewals',
      header: 'التجديدات',
      numeric: true,
      sortable: true,
      width: 92,
      render: (user) => <span className="num">{user.totalRenewals}</span>,
    },
    {
      key: 'totalSpend',
      header: 'إجمالي الصرف',
      numeric: true,
      sortable: true,
      render: (user) => <span className="num">{formatIqd(user.totalSpend)}</span>,
    },
    {
      key: 'lastSeenAt',
      header: 'آخر ظهور',
      render: (user) => <span className="fs-12 dim">{relativeAr(user.lastSeenAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="المشتركون"
        subtitle="ابحث بالاسم أو رقم الهاتف أو رقم الجهاز المطبوع على الرسيفر"
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
            تصدير CSV
          </Button>
        }
      />

      <div className="page">
        <Card>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="اسم، هاتف، أو SLV-…" />
            <Select
              value={governorateId}
              onChange={(next) => {
                setGovernorateId(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل المحافظات' },
                ...(governorates.data ?? []).map((g) => ({
                  value: g.id,
                  label: `${g.nameAr} (${g.subscriberCount})`,
                })),
              ]}
            />
            <Select
              value={deviceStatus}
              onChange={(next) => {
                setDeviceStatus(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل حالات الأجهزة' },
                { value: 'active' as const, label: 'عنده جهاز فعّال' },
                { value: 'expiring' as const, label: 'عنده جهاز قرب ينتهي' },
                { value: 'expired' as const, label: 'عنده جهاز منتهي' },
                { value: 'suspended' as const, label: 'عنده جهاز معلّق' },
              ]}
            />
          </Toolbar>

          <Toolbar>
            <FilterChips
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              items={[
                { value: 'all', label: 'الكل' },
                { value: 'active', label: 'فعّال' },
                { value: 'pending', label: 'قيد التفعيل' },
                { value: 'blocked', label: 'محظور' },
              ]}
            />
            <span className="grow" />
            {users.data ? (
              <span className="fs-12 dim">
                <span className="num">{formatNumber(users.data.total)}</span> مشترك
              </span>
            ) : null}
          </Toolbar>

          <AsyncBlock state={users}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(user) => user.id}
                onRowClick={(user) => navigate(`/users/${user.id}`)}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  <div className="empty">
                    <span className="empty-icon">
                      {status === 'blocked' ? <UserX size={22} /> : <UsersIcon size={22} />}
                    </span>
                    <span className="strong">ما لكينا مشترك بهذه الفلاتر</span>
                  </div>
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>
    </>
  );
}
