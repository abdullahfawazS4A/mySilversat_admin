/**
 * The subscriber list.
 *
 * This is the support desk's front door: someone calls, you find them by name
 * or phone, and you open their record. So the row is a link to the detail
 * screen and the only action offered inline is the one support actually takes
 * without reading the record first — blocking.
 *
 * Blocking is not a flag. The API invalidates the user's live tokens on the
 * same call, so a blocked user is signed out of the app immediately; the
 * confirm says so, because it is not obvious from the word.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, ShieldBan, ShieldCheck } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  FilterChips,
  Pill,
  SearchInput,
  Select,
} from '@/components/ui';
import { DataTable, PageHeader, Toolbar } from '@/components/page';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import { useToast } from '@/app/ToastContext';
import { formatDateAr, formatNumber, formatPhone } from '@/lib/format';
import type { AppUser, Id } from '@/types';
import { UserDialog } from './UserDialog';

type StatusFilter = 'all' | 'active' | 'blocked';

export function UsersPage() {
  const repos = useRepos();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [provinceId, setProvinceId] = useState<Id>('');

  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const provinceOptions = (provinces.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  const users = useAsync(
    () =>
      repos.appUsers.list({
        page,
        search: debounced,
        provinceId: provinceId || undefined,
        isBlocked: status === 'all' ? undefined : status === 'blocked',
      }),
    [page, debounced, status, provinceId],
  );

  const [blocking, setBlocking] = useState<AppUser | null>(null);
  // `{ user: null }` is the add dialog, `{ user }` the edit one — an object
  // rather than two flags, so the two can never both be open.
  const [editing, setEditing] = useState<{ user: AppUser | null } | null>(null);
  const [run, action] = useAction();

  const toggleBlock = async (user: AppUser) => {
    const ok = await run(() =>
      user.isBlocked ? repos.appUsers.unblock(user.id) : repos.appUsers.block(user.id),
    );
    if (!ok) return;
    toast(user.isBlocked ? 'انفك الحظر عن المشترك' : 'انحظر المشترك وانقطعت جلساته');
    setBlocking(null);
    users.reload();
  };

  return (
    <>
      <PageHeader
        title="المشتركون"
        subtitle="دوّر بالاسم أو الهاتف، وافتح السجل حتى تشوف أجهزته ومشترياته"
        actions={
          <Button
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => setEditing({ user: null })}
          >
            إضافة مشترك
          </Button>
        }
      />

      <Card>
        <Toolbar>
          <SearchInput
            value={search}
            placeholder="اسم أو رقم هاتف…"
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
          />
          <Select<Id>
            value={provinceId}
            onChange={(next) => {
              setProvinceId(next);
              setPage(1);
            }}
            options={[{ value: '', label: 'كل المحافظات' }, ...provinceOptions]}
          />
          <FilterChips<StatusFilter>
            value={status}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
            items={[
              { value: 'all', label: 'الكل' },
              { value: 'active', label: 'فعّالون' },
              { value: 'blocked', label: 'محظورون' },
            ]}
          />
        </Toolbar>

        <DataTable
          rows={users.data?.items ?? []}
          rowKey={(row) => row.id}
          loading={users.loading && !users.data}
          onRowClick={(row) => navigate(`/users/${row.id}`)}
          page={users.data?.page}
          pageSize={users.data?.pageSize}
          total={users.data?.total}
          onPage={setPage}
          columns={[
            {
              key: 'name',
              header: 'المشترك',
              render: (row) => (
                <div className="col">
                  <span className="strong">{row.name}</span>
                  <span className="fs-small dim num">{formatPhone(row.phone)}</span>
                </div>
              ),
            },
            {
              key: 'province',
              header: 'المحافظة',
              render: (row) => row.province?.name ?? '—',
            },
            {
              key: 'points',
              header: 'النقاط',
              numeric: true,
              width: 90,
              render: (row) => <span className="num">{formatNumber(row.points)}</span>,
            },
            {
              key: 'joined',
              header: 'تاريخ الاشتراك',
              render: (row) => <span className="fs-small">{formatDateAr(row.createdAt)}</span>,
            },
            {
              key: 'status',
              header: 'الحالة',
              width: 100,
              render: (row) =>
                row.isBlocked ? <Pill tone="danger">محظور</Pill> : <Pill tone="success">فعّال</Pill>,
            },
            {
              key: '__actions',
              header: '',
              width: 92,
              render: (row) => (
                <div className="row row-gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="تعديل البيانات"
                    icon={<Pencil size={15} />}
                    onClick={(event) => {
                      // The row itself navigates; the action must not.
                      event.stopPropagation();
                      setEditing({ user: row });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    title={row.isBlocked ? 'فك الحظر' : 'حظر'}
                    icon={row.isBlocked ? <ShieldCheck size={15} /> : <ShieldBan size={15} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      setBlocking(row);
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {blocking ? (
        <ConfirmDialog
          danger={!blocking.isBlocked}
          title={blocking.isBlocked ? 'فك الحظر' : 'حظر المشترك'}
          confirmLabel={blocking.isBlocked ? 'فك الحظر' : 'حظر'}
          pending={action.pending}
          message={
            <>
              {blocking.isBlocked ? (
                <>
                  راح يرجع <span className="strong">{blocking.name}</span> يكدر يسجّل دخول
                  بالتطبيق.
                </>
              ) : (
                <>
                  راح ينحظر <span className="strong">{blocking.name}</span> وتنقطع جلساته
                  المفتوحة بالتطبيق فوراً — مو بس يمنع الدخول الجاي.
                </>
              )}
              {action.error ? <div className="field-error mt-2">{action.error}</div> : null}
            </>
          }
          onCancel={() => setBlocking(null)}
          onConfirm={() => void toggleBlock(blocking)}
        />
      ) : null}

      {editing ? (
        <UserDialog
          user={editing.user}
          provinceOptions={provinceOptions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            const added = !editing.user;
            setEditing(null);
            // A new row belongs on the first page; an edited one stays put.
            if (added) setPage(1);
            users.reload();
            toast(added ? 'انضاف المشترك' : 'انحفظت البيانات');
          }}
        />
      ) : null}
    </>
  );
}
