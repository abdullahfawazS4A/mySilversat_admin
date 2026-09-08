/**
 * Resellers who take cash renewals in the field.
 *
 * The float balance is the operational number: a cash renewal draws it down by
 * the price minus the agent commission, so an agent at zero can no longer sell
 * and needs a top-up.
 */

import { useState } from 'react';
import { Pencil, Plus, Store, Trash2, Wallet } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader, DataTable, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  Switch,
  TextInput,
} from '@/components/ui';
import type { Agent, Id } from '@/types';
import { formatIqd, formatPercent, formatPhone } from '@/lib/format';

export function AgentsPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [governorateId, setGovernorateId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Agent | 'new' | null>(null);
  const [topping, setTopping] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);
  const [busy, setBusy] = useState(false);

  const governorates = useAsync(() => repos.catalog.governorates(), []);
  const agents = useAsync(
    () =>
      repos.agents.list({
        search: debounced,
        governorateId: governorateId === 'all' ? undefined : governorateId,
        page,
        pageSize: 25,
      }),
    [debounced, governorateId, page],
  );

  const runDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await repos.agents.remove(deleting.id);
      toast('انحذف الوكيل');
      setDeleting(null);
      agents.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الحذف', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Agent>[] = [
    {
      key: 'fullName',
      header: 'الوكيل',
      render: (agent) => (
        <div className="row row-gap-3">
          <span className="chip-icon" style={{ width: 30, height: 30 }}>
            <Store size={15} />
          </span>
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-13 strong">{agent.fullName}</span>
            <span className="fs-11 dim num">{formatPhone(agent.phone)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'governorate',
      header: 'المنطقة',
      render: (agent) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">
            {governorates.data?.find((g) => g.id === agent.governorateId)?.nameAr ?? '—'}
          </span>
          <span className="fs-11 dim">{agent.area}</span>
        </div>
      ),
    },
    {
      key: 'balance',
      header: 'الرصيد',
      numeric: true,
      sortable: true,
      render: (agent) => (
        <span
          className="fs-13 strong num"
          style={{ color: agent.balance <= 0 ? 'var(--danger)' : undefined }}
        >
          {formatIqd(agent.balance)}
        </span>
      ),
    },
    {
      key: 'commissionRate',
      header: 'العمولة',
      numeric: true,
      width: 84,
      render: (agent) => <span className="num">{formatPercent(agent.commissionRate)}</span>,
    },
    {
      key: 'renewalCount',
      header: 'التجديدات',
      numeric: true,
      sortable: true,
      width: 94,
      render: (agent) => <span className="num">{agent.renewalCount}</span>,
    },
    {
      key: 'active',
      header: 'الحالة',
      render: (agent) => (
        <Pill tone={agent.active ? 'success' : 'muted'}>{agent.active ? 'فعّال' : 'موقوف'}</Pill>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 110,
      render: (agent) => (
        <div className="row row-gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Wallet size={14} />}
            title="تعديل الرصيد"
            onClick={() => setTopping(agent)}
          />
          <Button variant="ghost" size="sm" icon={<Pencil size={14} />} title="تعديل" onClick={() => setEditing(agent)} />
          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} title="حذف" onClick={() => setDeleting(agent)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الوكلاء"
        subtitle="وكلاء البيع الميداني — أرصدتهم وعمولاتهم وعدد تجديداتهم"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            إضافة وكيل
          </Button>
        }
      />

      <div className="page">
        <Card>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="اسم الوكيل أو هاتفه…" />
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

          <AsyncBlock state={agents}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(agent) => agent.id}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {editing ? (
        <AgentDialog
          agent={editing === 'new' ? null : editing}
          governorates={(governorates.data ?? []).map((g) => ({ value: g.id, label: g.nameAr }))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            agents.reload();
          }}
        />
      ) : null}

      {topping ? (
        <BalanceDialog
          agent={topping}
          onClose={() => setTopping(null)}
          onSaved={() => {
            setTopping(null);
            agents.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف الوكيل"
          message={`راح ينحذف ${deleting.fullName}. إذا عنده تجديدات مسجلة راح يُرفض الحذف — عطّله بدلها.`}
          confirmLabel="حذف"
          danger
          pending={busy}
          onConfirm={() => void runDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function AgentDialog({
  agent,
  governorates,
  onClose,
  onSaved,
}: {
  agent: Agent | null;
  governorates: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [fullName, setFullName] = useState(agent?.fullName ?? '');
  const [phone, setPhone] = useState(agent?.phone ?? '');
  const [governorateId, setGovernorateId] = useState(agent?.governorateId ?? governorates[0]?.value ?? '');
  const [area, setArea] = useState(agent?.area ?? '');
  const [commission, setCommission] = useState(String((agent?.commissionRate ?? 0.1) * 100));
  const [balance, setBalance] = useState(String(agent?.balance ?? 0));
  const [active, setActive] = useState(agent?.active ?? true);

  const submit = async () => {
    if (!fullName.trim() || !phone.trim()) {
      toast('الاسم ورقم الهاتف مطلوبين', 'error');
      return;
    }
    const ok = await run(() =>
      repos.agents.save({
        id: agent?.id,
        fullName: fullName.trim(),
        phone: phone.trim(),
        governorateId,
        area: area.trim(),
        active,
        commissionRate: Number(commission) / 100,
        balance: Number(balance),
      }),
    );
    if (ok) {
      toast(agent ? 'انحفظ الوكيل' : 'انضاف الوكيل');
      onSaved();
    }
  };

  return (
    <Modal
      title={agent ? 'تعديل الوكيل' : 'إضافة وكيل'}
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

        <Field label="اسم الوكيل">
          <TextInput value={fullName} onChange={setFullName} />
        </Field>
        <Field label="رقم الهاتف">
          <TextInput type="tel" value={phone} onChange={setPhone} />
        </Field>

        <div className="grid grid-form">
          <Field label="المحافظة">
            <select className="select" value={governorateId} onChange={(e) => setGovernorateId(e.target.value)}>
              {governorates.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المنطقة">
            <TextInput value={area} onChange={setArea} />
          </Field>
        </div>

        <div className="grid grid-form">
          <Field label="نسبة العمولة %">
            <TextInput type="number" min={0} max={50} value={commission} onChange={setCommission} />
          </Field>
          <Field label="الرصيد الابتدائي (د.ع)">
            <TextInput type="number" value={balance} onChange={setBalance} />
          </Field>
        </div>

        <Switch checked={active} onChange={setActive} label="وكيل فعّال ويقدر يسجل تجديدات" />
      </div>
    </Modal>
  );
}

function BalanceDialog({
  agent,
  onClose,
  onSaved,
}: {
  agent: Agent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [amount, setAmount] = useState('100000');
  const [sign, setSign] = useState<1 | -1>(1);
  const [reason, setReason] = useState('');

  const submit = async () => {
    const delta = sign * Number(amount || 0);
    if (!delta) {
      toast('أدخل مبلغ أكبر من صفر', 'error');
      return;
    }
    const ok = await run(() => repos.agents.adjustBalance(agent.id, delta, reason || 'بدون سبب مذكور'));
    if (ok) {
      toast('انعدّل الرصيد');
      onSaved();
    }
  };

  return (
    <Modal
      title={`رصيد ${agent.fullName}`}
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

        <div className="row between fs-13">
          <span className="muted">الرصيد الحالي</span>
          <span className="strong num">{formatIqd(agent.balance)}</span>
        </div>

        <div className="row row-gap-2">
          <Button variant={sign === 1 ? 'primary' : 'outline'} onClick={() => setSign(1)}>
            شحن رصيد
          </Button>
          <Button variant={sign === -1 ? 'danger' : 'outline'} onClick={() => setSign(-1)}>
            خصم
          </Button>
        </div>

        <Field label="المبلغ (د.ع)">
          <TextInput type="number" min={0} step={5000} value={amount} onChange={setAmount} />
        </Field>
        <Field label="السبب">
          <TextInput value={reason} onChange={setReason} placeholder="مثلاً: تسديد نقدي في المكتب" />
        </Field>

        <Notice tone="info">
          الرصيد الجديد:{' '}
          <span className="num strong">{formatIqd(agent.balance + sign * Number(amount || 0))}</span>
        </Notice>
      </div>
    </Modal>
  );
}
