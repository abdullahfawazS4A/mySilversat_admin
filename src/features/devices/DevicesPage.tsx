/**
 * Every receiver in the fleet.
 *
 * The row actions are the four things support actually does to a box: renew
 * it, grant it free time to settle a complaint, suspend it, or move it to
 * another account when a customer sells their receiver.
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  CalendarPlus,
  Download,
  Gift,
  PauseCircle,
  PlayCircle,
  Tv,
} from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { useAuth } from '@/app/AuthContext';
import { PageHeader, DataTable, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  Field,
  FilterChips,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  TextInput,
} from '@/components/ui';
import type { DeviceStatus, Id } from '@/types';
import type { DeviceRow } from '@/data/repositories/types';
import { DEVICE_STATUS } from '@/lib/labels';
import { daysUntil, formatDateAr, formatPhone } from '@/lib/format';
import { downloadCsv } from '@/lib/utils';
import { RenewDialog } from './RenewDialog';

export function DevicesPage() {
  const repos = useRepos();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can('devices.edit');
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState<DeviceStatus | 'all'>('all');
  const [governorateId, setGovernorateId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const [renewing, setRenewing] = useState<DeviceRow | null>(null);
  const [granting, setGranting] = useState<DeviceRow | null>(null);
  const [transferring, setTransferring] = useState<DeviceRow | null>(null);
  const [suspending, setSuspending] = useState<DeviceRow | null>(null);
  const [busy, setBusy] = useState(false);

  const userId = params.get('user') ?? undefined;
  const governorates = useAsync(() => repos.catalog.governorates(), []);
  const devices = useAsync(
    () =>
      repos.devices.list({
        search: debounced,
        status,
        userId,
        governorateId: governorateId === 'all' ? undefined : governorateId,
        page,
        pageSize: 25,
      }),
    [debounced, status, governorateId, userId, page],
  );

  const toggleSuspend = async (device: DeviceRow, reason?: string) => {
    setBusy(true);
    try {
      await repos.devices.setSuspended(device.id, device.status !== 'suspended', reason);
      toast(device.status === 'suspended' ? 'انفعّل الجهاز' : 'انعلّق الجهاز');
      setSuspending(null);
      devices.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر التغيير', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const all = await repos.devices.list({ search: debounced, status, pageSize: 100000 });
    downloadCsv('devices.csv', [
      ['رقم الجهاز', 'الاسم', 'المالك', 'الهاتف', 'الموديل', 'الحالة', 'تاريخ الانتهاء', 'الأيام المتبقية'],
      ...all.items.map((d) => [
        d.number,
        d.name,
        d.ownerName,
        d.ownerPhone,
        d.model,
        DEVICE_STATUS[d.status].label,
        formatDateAr(d.expiryAt),
        daysUntil(d.expiryAt),
      ]),
    ]);
    toast('تم تصدير الملف');
  };

  const columns: Column<DeviceRow>[] = [
    {
      key: 'number',
      header: 'الجهاز',
      sortable: true,
      render: (device) => (
        <div className="row row-gap-3">
          <span className="chip-icon" style={{ width: 30, height: 30 }}>
            <Tv size={15} />
          </span>
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-13 strong num">{device.number}</span>
            <span className="fs-11 dim">
              {device.name} · {device.model}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'ownerName',
      header: 'المالك',
      sortable: true,
      render: (device) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">{device.ownerName}</span>
          <span className="fs-11 dim num">{formatPhone(device.ownerPhone)}</span>
        </div>
      ),
    },
    {
      key: 'governorate',
      header: 'المحافظة',
      render: (device) => (
        <span className="fs-12 muted">
          {governorates.data?.find((g) => g.id === device.governorateId)?.nameAr ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (device) => {
        const meta = DEVICE_STATUS[device.status];
        return <Pill tone={meta.tone}>{meta.label}</Pill>;
      },
    },
    {
      key: 'expiryAt',
      header: 'ينتهي في',
      sortable: true,
      render: (device) => {
        const left = daysUntil(device.expiryAt);
        return (
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-13">{formatDateAr(device.expiryAt)}</span>
            <span
              className="fs-11 num"
              style={{ color: left < 0 ? 'var(--danger)' : left <= 7 ? 'var(--warning)' : 'var(--text-tertiary)' }}
            >
              {left >= 0 ? `باقي ${left} يوم` : `منتهي من ${Math.abs(left)} يوم`}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: 160,
      render: (device) =>
        canEdit ? (
          <div className="row row-gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={<CalendarPlus size={14} />}
              title="تسجيل تجديد"
              onClick={() => setRenewing(device)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Gift size={14} />}
              title="منح أشهر مجانية"
              onClick={() => setGranting(device)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeftRight size={14} />}
              title="نقل لمشترك آخر"
              onClick={() => setTransferring(device)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={device.status === 'suspended' ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
              title={device.status === 'suspended' ? 'إعادة تفعيل' : 'تعليق'}
              onClick={() =>
                device.status === 'suspended' ? void toggleSuspend(device) : setSuspending(device)
              }
            />
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="الأجهزة"
        subtitle="كل أجهزة الاستقبال، حالتها ومواعيد انتهاء اشتراكاتها"
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
            تصدير CSV
          </Button>
        }
      />

      <div className="page">
        {userId ? (
          <Notice tone="info">
            معروضة أجهزة مشترك واحد فقط.{' '}
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/devices')}>
              عرض كل الأجهزة
            </button>
          </Notice>
        ) : null}

        <Card>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="رقم الجهاز، الاسم، أو المالك…" />
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
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              items={[
                { value: 'all', label: 'الكل' },
                { value: 'active', label: 'فعّال' },
                { value: 'expiring', label: 'قرب ينتهي' },
                { value: 'expired', label: 'منتهي' },
                { value: 'suspended', label: 'معلّق' },
              ]}
            />
          </Toolbar>

          <AsyncBlock state={devices}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(device) => device.id}
                onRowClick={(device) => navigate(`/users/${device.userId}`)}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {renewing ? (
        <RenewDialog
          deviceId={renewing.id}
          onClose={() => setRenewing(null)}
          onSaved={() => {
            setRenewing(null);
            devices.reload();
          }}
        />
      ) : null}

      {granting ? (
        <GrantDialog
          device={granting}
          onClose={() => setGranting(null)}
          onSaved={() => {
            setGranting(null);
            devices.reload();
          }}
        />
      ) : null}

      {transferring ? (
        <TransferDialog
          device={transferring}
          onClose={() => setTransferring(null)}
          onSaved={() => {
            setTransferring(null);
            devices.reload();
          }}
        />
      ) : null}

      {suspending ? (
        <SuspendDialog
          device={suspending}
          pending={busy}
          onCancel={() => setSuspending(null)}
          onConfirm={(reason) => void toggleSuspend(suspending, reason)}
        />
      ) : null}
    </>
  );
}

/** Free months — a goodwill gesture, recorded as a zero-value renewal. */
function GrantDialog({
  device,
  onClose,
  onSaved,
}: {
  device: DeviceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [months, setMonths] = useState('1');
  const [reason, setReason] = useState('');

  const save = async () => {
    if (!reason.trim()) {
      toast('اكتب سبب المنح — ينسجل في سجل العمليات', 'error');
      return;
    }
    const ok = await run(() => repos.devices.grantMonths(device.id, Number(months), reason.trim()));
    if (ok) {
      toast('انمنحت الأشهر المجانية');
      onSaved();
    }
  };

  return (
    <Modal
      title="منح أشهر مجانية"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void save()} disabled={action.pending}>
            منح
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
        <span className="fs-13 muted">
          الجهاز <span className="num strong">{device.number}</span> — {device.ownerName}
        </span>
        <Field label="عدد الأشهر">
          <TextInput type="number" min={1} max={12} value={months} onChange={setMonths} />
        </Field>
        <Field label="السبب" hint="ينسجل كتجديد بقيمة صفر ويظهر في سجل الجهاز">
          <TextInput value={reason} onChange={setReason} placeholder="مثلاً: تعويض عن انقطاع خدمة" />
        </Field>
      </div>
    </Modal>
  );
}

/** Move a receiver to another account, keeping its payment history. */
function TransferDialog({
  device,
  onClose,
  onSaved,
}: {
  device: DeviceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [targetId, setTargetId] = useState<Id>('');

  const candidates = useAsync(
    () => repos.users.list({ search: debounced, pageSize: 12 }),
    [debounced],
  );

  const save = async () => {
    if (!targetId) {
      toast('اختر المشترك الجديد', 'error');
      return;
    }
    const ok = await run(() => repos.devices.transfer(device.id, targetId));
    if (ok) {
      toast('انتقل الجهاز للمشترك الجديد');
      onSaved();
    }
  };

  return (
    <Modal
      title="نقل الجهاز لمشترك آخر"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void save()} disabled={action.pending || !targetId}>
            نقل الجهاز
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <Notice tone="warning">
          سجل التجديدات والكوبونات ينتقل مع الجهاز، لأنه مرتبط بالرسيفر مو بالحساب.
        </Notice>

        <div className="col" style={{ gap: 4 }}>
          <span className="fs-12 muted">المالك الحالي</span>
          <span className="fs-13 strong">{device.ownerName}</span>
        </div>

        <Field label="ابحث عن المشترك الجديد">
          <SearchInput value={search} onChange={setSearch} placeholder="اسم أو رقم هاتف…" />
        </Field>

        <div className="col" style={{ gap: 4, maxHeight: 240, overflowY: 'auto' }}>
          {(candidates.data?.items ?? [])
            .filter((user) => user.id !== device.userId)
            .map((user) => (
              <button
                key={user.id}
                className={`chip${targetId === user.id ? ' active' : ''}`}
                style={{ height: 'auto', padding: '9px 12px', justifyContent: 'flex-start' }}
                onClick={() => setTargetId(user.id)}
              >
                <span className="strong">{user.fullName}</span>
                <span className="dim num">{formatPhone(user.phone)}</span>
              </button>
            ))}
        </div>
      </div>
    </Modal>
  );
}

function SuspendDialog({
  device,
  pending,
  onCancel,
  onConfirm,
}: {
  device: DeviceRow;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog
      title="تعليق الجهاز"
      danger
      pending={pending}
      confirmLabel="تعليق"
      onCancel={onCancel}
      onConfirm={() => onConfirm(reason || 'بدون سبب مذكور')}
      message={
        <div className="col" style={{ gap: 'var(--sp-3)' }}>
          <span>
            الجهاز <span className="num strong">{device.number}</span> راح يتوقف عن الاستقبال لحد ما
            ترفع التعليق. تاريخ الانتهاء ما يتأثر.
          </span>
          <Field label="سبب التعليق">
            <TextInput value={reason} onChange={setReason} placeholder="مثلاً: بلاغ إساءة استخدام" />
          </Field>
        </div>
      }
    />
  );
}
