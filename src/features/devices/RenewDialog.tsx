/**
 * Record a renewal.
 *
 * The dialog shows the resulting expiry date before the operator commits,
 * because "when does it expire now?" is the first thing the customer on the
 * phone asks, and a wrong package choice is expensive to unwind.
 */

import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { Button, Field, Modal, Notice, Select, TextArea } from '@/components/ui';
import type { Id, PaymentMethod } from '@/types';
import { PAYMENT_METHOD } from '@/lib/labels';
import { addMonths } from '@/lib/utils';
import { daysUntil, formatDateAr, formatIqd } from '@/lib/format';

export function RenewDialog({
  deviceId,
  onClose,
  onSaved,
}: {
  deviceId: Id;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const packages = useAsync(() => repos.catalog.packages(), []);
  const agents = useAsync(() => repos.agents.list({ active: true, pageSize: 200 }), []);
  const target = useAsync(() => repos.devices.get(deviceId), [deviceId]);

  const [packageId, setPackageId] = useState<Id>('');
  const [method, setMethod] = useState<PaymentMethod>('kcard');
  const [agentId, setAgentId] = useState<Id>('');
  const [note, setNote] = useState('');

  const activePackages = (packages.data ?? []).filter((pkg) => pkg.active);
  const chosen = activePackages.find((pkg) => pkg.id === packageId);

  // Preview: an expired device restarts today, an active one is extended.
  const preview = useMemo(() => {
    if (!chosen || !target.data) return null;
    const base =
      daysUntil(target.data.expiryAt) < 0 ? new Date().toISOString() : target.data.expiryAt;
    const months = chosen.months + (chosen.bonus ? 1 : 0);
    return { months, expiry: addMonths(base, months) };
  }, [chosen, target.data]);

  const save = async () => {
    if (!packageId) {
      toast('اختر الباقة', 'error');
      return;
    }
    const ok = await run(() =>
      repos.renewals.create({
        deviceId,
        packageId,
        method,
        agentId: method === 'cash_agent' ? agentId : undefined,
        note: note.trim() || undefined,
      }),
    );
    if (ok) {
      toast('انسجل التجديد وانمدد الاشتراك');
      onSaved();
    }
  };

  return (
    <Modal
      title="تسجيل تجديد"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<CalendarCheck size={15} />}
            onClick={() => void save()}
            disabled={action.pending}
          >
            {action.pending ? 'جاري التسجيل…' : 'تسجيل التجديد'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        {target.data ? (
          <div className="card card-pad col" style={{ gap: 4, background: 'var(--bg-app)' }}>
            <span className="fs-13 strong">{target.data.ownerName}</span>
            <span className="fs-12 dim num">
              {target.data.number} · {target.data.name}
            </span>
            <span className="fs-12 muted">
              ينتهي حالياً في <span className="num">{formatDateAr(target.data.expiryAt)}</span>
            </span>
          </div>
        ) : null}

        <Field label="الباقة">
          <Select
            value={packageId}
            onChange={setPackageId}
            options={[
              { value: '', label: 'اختر الباقة' },
              ...activePackages.map((pkg) => ({
                value: pkg.id,
                label: `${pkg.months} أشهر — ${formatIqd(pkg.price)}${pkg.bonus ? ' + شهر مجاني' : ''}`,
              })),
            ]}
          />
        </Field>

        <Field label="طريقة الدفع">
          <Select
            value={method}
            onChange={setMethod}
            options={(['kcard', 'cash_agent', 'online', 'free_grant'] as PaymentMethod[]).map((key) => ({
              value: key,
              label: PAYMENT_METHOD[key],
            }))}
          />
        </Field>

        {method === 'cash_agent' ? (
          <Field label="الوكيل" hint="ينخصم من رصيد الوكيل بعد خصم عمولته">
            <Select
              value={agentId}
              onChange={setAgentId}
              options={[
                { value: '', label: 'اختر الوكيل' },
                ...(agents.data?.items ?? []).map((agent) => ({
                  value: agent.id,
                  label: `${agent.fullName} — رصيد ${formatIqd(agent.balance)}`,
                })),
              ]}
            />
          </Field>
        ) : null}

        <Field label="ملاحظة" hint="اختيارية">
          <TextArea value={note} onChange={setNote} rows={2} />
        </Field>

        {preview ? (
          <Notice tone="success">
            بعد التجديد راح ينتهي الاشتراك في{' '}
            <span className="num strong">{formatDateAr(preview.expiry)}</span>
            {chosen?.bonus ? ' (شاملة الشهر المجاني)' : ''}.
            {chosen && chosen.months >= 3 ? ' وراح ينصدر كوبون سحب تلقائياً.' : ''}
          </Notice>
        ) : null}
      </div>
    </Modal>
  );
}
