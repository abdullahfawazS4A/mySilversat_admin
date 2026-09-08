/**
 * Console accounts.
 *
 * A role here is a bundle of permissions, not a title: picking one in the
 * dialog shows exactly which screens it unlocks, because "العمليات" means
 * nothing to the person handing out access. The permission list is rendered
 * from the same role table the auth layer resolves sessions against, so the
 * preview cannot drift from what the account will actually be able to do.
 *
 * The repository refuses to delete the last owner or your own account; those
 * errors surface here rather than being pre-empted, so the rule lives in one
 * place.
 */

import { useState } from 'react';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAuth } from '@/app/AuthContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Notice,
  Pill,
  Select,
  Switch,
  TextInput,
} from '@/components/ui';
import { ADMIN_ROLES } from '@/data/seed';
import { NAV_ITEMS } from '@/layout/navigation';
import type { AdminRoleKey, AdminUser, Governorate, Id } from '@/types';
import { ADMIN_ROLE } from '@/lib/labels';
import { formatDateAr, formatPhone, relativeAr } from '@/lib/format';

export function AdminsPage() {
  const repos = useRepos();
  const { session } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [run, action] = useAction();

  const admins = useAsync(() => repos.admin.admins(), []);
  const governorates = useAsync(() => repos.catalog.governorates(), []);

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => repos.admin.removeAdmin(deleting.id));
    if (ok) {
      toast('انحذف المستخدم');
      setDeleting(null);
      admins.reload();
    }
  };

  const toggleActive = async (admin: AdminUser, active: boolean) => {
    const ok = await run(() =>
      repos.admin.saveAdmin({
        id: admin.id,
        fullName: admin.fullName,
        username: admin.username,
        phone: admin.phone,
        role: admin.role,
        governorateIds: admin.governorateIds,
        active,
      }),
    );
    if (ok) admins.reload();
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'fullName',
      header: 'المستخدم',
      render: (row) => (
        <div className="row row-gap-2" style={{ minWidth: 0 }}>
          <span className="chip-icon" style={{ width: 30, height: 30 }}>
            <ShieldCheck size={15} />
          </span>
          <div className="col" style={{ lineHeight: 1.35, minWidth: 0 }}>
            <span className="fs-13 strong truncate">
              {row.fullName}
              {row.id === session?.admin.id ? <span className="fs-11 dim"> — أنت</span> : null}
            </span>
            <span className="fs-11 dim num">{row.username}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'الدور',
      width: 130,
      render: (row) => <Pill tone={row.role === 'owner' ? 'gold' : 'neutral'}>{ADMIN_ROLE[row.role]}</Pill>,
    },
    {
      key: 'scope',
      header: 'النطاق',
      render: (row) => (
        <span className="fs-12 muted truncate">
          {row.governorateIds.length === 0
            ? 'كل المحافظات'
            : row.governorateIds
                .map((id) => governorates.data?.find((g) => g.id === id)?.nameAr ?? '—')
                .join('، ')}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'الهاتف',
      numeric: true,
      render: (row) => <span className="fs-12 num">{formatPhone(row.phone)}</span>,
    },
    {
      key: 'lastLoginAt',
      header: 'آخر دخول',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-12">{row.lastLoginAt ? relativeAr(row.lastLoginAt) : 'ما دخل بعد'}</span>
          <span className="fs-11 dim">أُنشئ {formatDateAr(row.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'active',
      header: 'الحالة',
      width: 92,
      render: (row) => (
        <Switch
          checked={row.active}
          disabled={row.id === session?.admin.id}
          onChange={(next) => void toggleActive(row, next)}
          title={row.id === session?.admin.id ? 'ما تكدر تعطّل حسابك' : undefined}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 92,
      render: (row) => (
        <div className="row row-gap-1 end">
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil size={13} />}
            title="تعديل"
            onClick={() => setEditing(row)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={13} />}
            title="حذف"
            disabled={row.id === session?.admin.id}
            onClick={() => setDeleting(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="المستخدمون الإداريون"
        subtitle="حسابات لوحة التحكم وصلاحياتها"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            إضافة مستخدم
          </Button>
        }
      />

      <div className="page col" style={{ gap: 'var(--sp-4)' }}>
        <Notice tone="info" icon={<KeyRound size={16} />}>
          الصلاحيات هنا تخفي الشاشات داخل اللوحة فقط. لمن يجي الباك-إند الحقيقي لازم يتحقق منها هو
          بعد — إخفاء زر مو حماية.
        </Notice>

        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <div className="card">
          <AsyncBlock state={admins}>
            {(rows) => (
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                empty={<EmptyState title="ما بيها مستخدمين" icon={<ShieldCheck size={22} />} />}
              />
            )}
          </AsyncBlock>
        </div>
      </div>

      {editing ? (
        <AdminDialog
          admin={editing === 'new' ? null : editing}
          governorates={governorates.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            admins.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف المستخدم الإداري"
          message={
            <>
              راح ينحذف حساب <span className="strong">{deleting.fullName}</span> وما يكدر يدخل
              اللوحة بعدها. سجل عملياته يبقى محفوظ.
            </>
          }
          confirmLabel="حذف"
          danger
          pending={action.pending}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function AdminDialog({
  admin,
  governorates,
  onClose,
  onSaved,
}: {
  admin: AdminUser | null;
  governorates: Governorate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [fullName, setFullName] = useState(admin?.fullName ?? '');
  const [username, setUsername] = useState(admin?.username ?? '');
  const [phone, setPhone] = useState(admin?.phone ?? '');
  const [role, setRole] = useState<AdminRoleKey>(admin?.role ?? 'support');
  const [governorateIds, setGovernorateIds] = useState<Id[]>(admin?.governorateIds ?? []);
  const [active, setActive] = useState(admin?.active ?? true);

  const selectedRole = ADMIN_ROLES.find((r) => r.key === role);
  // What this role actually opens, said in screen names rather than permission keys.
  const reachableScreens = NAV_ITEMS.filter((item) =>
    selectedRole?.permissions.includes(item.permission),
  );

  const toggleGovernorate = (id: Id) =>
    setGovernorateIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const submit = async () => {
    if (!fullName.trim() || !username.trim()) {
      toast('الاسم واسم المستخدم مطلوبين', 'error');
      return;
    }
    if (!/^\d{11}$/.test(phone.replace(/\s/g, ''))) {
      toast('رقم الهاتف لازم يكون 11 رقم', 'error');
      return;
    }
    const ok = await run(() =>
      repos.admin.saveAdmin({
        id: admin?.id,
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.replace(/\s/g, ''),
        role,
        governorateIds,
        active,
      }),
    );
    if (ok) {
      toast(admin ? 'انحفظ المستخدم' : 'انضاف المستخدم');
      onSaved();
    }
  };

  return (
    <Modal
      size="lg"
      title={admin ? 'تعديل المستخدم' : 'إضافة مستخدم إداري'}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void submit()} disabled={action.pending}>
            حفظ
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <div className="grid grid-form">
          <Field label="الاسم الكامل">
            <TextInput value={fullName} onChange={setFullName} />
          </Field>
          <Field label="اسم المستخدم" hint="اللي يدخل بيه للوحة">
            <TextInput value={username} onChange={setUsername} placeholder="ops.ali" />
          </Field>
        </div>

        <div className="grid grid-form">
          <Field label="رقم الهاتف">
            <TextInput type="tel" value={phone} onChange={setPhone} placeholder="07700000000" />
          </Field>
          <Field label="الدور">
            <Select
              value={role}
              onChange={setRole}
              options={ADMIN_ROLES.map((r) => ({ value: r.key, label: r.nameAr }))}
            />
          </Field>
        </div>

        {selectedRole ? (
          <div className="card card-pad col" style={{ gap: 'var(--sp-3)' }}>
            <span className="fs-12 muted" style={{ lineHeight: 1.7 }}>
              {selectedRole.descriptionAr}
            </span>
            <div className="chips">
              {reachableScreens.map((item) => (
                <span key={item.path} className="chip">
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <Field
          label="نطاق المحافظات"
          hint="تركه فاضي يعني وصول لكل المحافظات"
        >
          <div className="chips">
            {governorates.map((governorate) => (
              <button
                key={governorate.id}
                type="button"
                className={`chip${governorateIds.includes(governorate.id) ? ' active' : ''}`}
                onClick={() => toggleGovernorate(governorate.id)}
              >
                {governorate.nameAr}
              </button>
            ))}
          </div>
        </Field>

        <Switch checked={active} onChange={setActive} label="الحساب فعّال" />
      </div>
    </Modal>
  );
}
