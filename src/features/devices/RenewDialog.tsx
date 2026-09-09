/**
 * Record a renewal.
 *
 * The dialog shows two things before the operator commits, because both are
 * questions asked on the phone and both are expensive to get wrong:
 *
 *  - the resulting expiry date ("when does it expire now?");
 *  - **which card is about to be burnt** out of this subscriber's governorate,
 *    and whether one exists at all. A renewal with no card behind it is
 *    refused by the repository, so finding that out at the moment of saving —
 *    with the customer waiting — is exactly what this preview prevents.
 */

import { useMemo, useState } from 'react';
import { CalendarCheck, CreditCard } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { Button, Field, Modal, Notice, Select, TextArea } from '@/components/ui';
import type { Id, PaymentMethod } from '@/types';
import { PAYMENT_METHOD } from '@/lib/labels';
import { addMonths } from '@/lib/utils';
import { daysUntil, formatDateAr, formatIqd, monthsAr } from '@/lib/format';

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

  const governorateId = target.data?.governorateId ?? '';
  const governorates = useAsync(() => repos.catalog.governorates(), []);
  const governorateName =
    (governorates.data ?? []).find((g) => g.id === governorateId)?.nameAr ?? '';

  // A free grant does not touch stock, so there is nothing to look up for it.
  const needsCard = method !== 'free_grant';
  const nextCard = useAsync(
    () =>
      needsCard && governorateId && chosen
        ? repos.stock.nextAvailable(governorateId, chosen.months)
        : Promise.resolve(null),
    [needsCard, governorateId, chosen?.months],
  );
  const cardMissing = needsCard && Boolean(chosen) && !nextCard.loading && nextCard.data === null;

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
            disabled={action.pending || cardMissing}
            title={cardMissing ? 'ما بيه كارت بهذه المدة في مخزن المحافظة' : undefined}
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
                label: `${monthsAr(pkg.months)} — ${formatIqd(pkg.price)}${pkg.bonus ? ' + شهر مجاني' : ''}`,
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

        {chosen && needsCard ? (
          cardMissing ? (
            <Notice tone="danger" icon={<CreditCard size={16} />}>
              ما بقى كارت <span className="strong">{monthsAr(chosen.months)}</span> في مخزن{' '}
              <span className="strong">{governorateName}</span>. عبّي المخزن أو اختر باقة بمدة ثانية —
              التجديد ما ينسجّل بدون كارت.
            </Notice>
          ) : nextCard.data ? (
            <Notice tone="info" icon={<CreditCard size={16} />}>
              راح ينسحب الكارت <span className="num strong">{nextCard.data.code}</span> من مخزن{' '}
              <span className="strong">{governorateName}</span> — أقدم كارت{' '}
              <span className="strong">{monthsAr(chosen.months)}</span> بالمخزن.
            </Notice>
          ) : null
        ) : null}

        {chosen && !needsCard ? (
          <Notice tone="warning" icon={<CreditCard size={16} />}>
            المنحة المجانية ما تسحب كارت من المخزن — الاشتراك يتمدد بدون مقابل.
          </Notice>
        ) : null}

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
