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
import { Plus, ShieldBan, ShieldCheck } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  FilterChips,
  Modal,
  Pill,
  SearchInput,
  Select,
  TextInput,
  useDraft,
} from '@/components/ui';
import { DataTable, PageHeader, Toolbar } from '@/components/page';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import { useToast } from '@/app/ToastContext';
import { formatDateAr, formatNumber, formatPhone } from '@/lib/format';
import type { AppUser, Id } from '@/types';
import type { AppUserInput } from '@/data/repositories/types';

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
  const [creating, setCreating] = useState(false);
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
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
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
                  <span className="fs-12 dim num">{formatPhone(row.phone)}</span>
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
              render: (row) => <span className="fs-12">{formatDateAr(row.createdAt)}</span>,
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
              width: 52,
              render: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  title={row.isBlocked ? 'فك الحظر' : 'حظر'}
                  icon={row.isBlocked ? <ShieldCheck size={15} /> : <ShieldBan size={15} />}
                  onClick={(event) => {
                    // The row itself navigates; the action must not.
                    event.stopPropagation();
                    setBlocking(row);
                  }}
                />
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

      {creating ? (
        <CreateUserDialog
          provinceOptions={provinceOptions}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setPage(1);
            users.reload();
            toast('انضاف المشترك');
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Creating a subscriber by hand.
 *
 * Normally the app registers them; this is for the case where support sets an
 * account up on the phone. The password is optional because the API lets a
 * user claim the account later through the app's own OTP flow.
 */
function CreateUserDialog({
  provinceOptions,
  onClose,
  onCreated,
}: {
  provinceOptions: { value: Id; label: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const repos = useRepos();
  const { draft, set } = useDraft<AppUserInput>({
    name: '',
    phone: '',
    provinceId: provinceOptions[0]?.value ?? '',
    email: '',
    password: '',
  });
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = async () => {
    const problem = !draft.name.trim()
      ? 'اسم المشترك مطلوب'
      : !draft.phone.trim()
        ? 'رقم الهاتف مطلوب'
        : !draft.provinceId
          ? 'اختر المحافظة'
          : null;
    setInvalid(problem);
    if (problem) return;

    const ok = await run(() =>
      repos.appUsers.create({
        ...draft,
        email: draft.email?.trim() ? draft.email : null,
        password: draft.password?.trim() ? draft.password : undefined,
      }),
    );
    if (ok) onCreated();
  };

  return (
    <Modal
      title="إضافة مشترك"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={submit} disabled={action.pending}>
            {action.pending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="grid grid-form">
        <Field label="الاسم">
          <TextInput value={draft.name} onChange={(next) => set('name', next)} />
        </Field>
        <Field label="رقم الهاتف">
          <TextInput
            type="tel"
            value={draft.phone}
            onChange={(next) => set('phone', next)}
            placeholder="07XXXXXXXXX"
          />
        </Field>
        <Field label="المحافظة">
          <Select<Id>
            value={draft.provinceId}
            onChange={(next) => set('provinceId', next)}
            options={provinceOptions}
          />
        </Field>
        <Field label="البريد الإلكتروني" hint="اختياري">
          <TextInput value={draft.email ?? ''} onChange={(next) => set('email', next)} />
        </Field>
        <Field label="كلمة المرور" hint="اختيارية — يكدر يفعّل حسابه من التطبيق">
          <TextInput
            type="password"
            value={draft.password ?? ''}
            onChange={(next) => set('password', next)}
          />
        </Field>
      </div>
      {invalid || action.error ? (
        <div className="field-error mt-3">{invalid ?? action.error}</div>
      ) : null}
    </Modal>
  );
}
