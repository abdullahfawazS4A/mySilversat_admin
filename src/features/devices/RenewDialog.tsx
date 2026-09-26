/**
 * Recharging a receiver.
 *
 * This is the one action in the console that spends something real: it burns a
 * code against a box in the vendor's system. Three rules the API enforces are
 * worth stating here, because each one produces a confusing error otherwise:
 *
 *  - the code must already be **sold to the app user who owns this receiver**,
 *    so a code straight out of stock will be refused;
 *  - the region is resolved by the API from the code's own product, so there
 *    is nothing to pick — a code from another server simply will not work.
 *    The console shows the owner's server anyway, because "this code is not
 *    for this box" is the most common refusal here and it reads as a bug
 *    until the two servers are named side by side;
 *  - `0` renews an existing subscription and `1` activates a new device. They
 *    are different operations upstream, so the choice is explicit rather than
 *    guessed from whether we think the box is active.
 *
 * Nothing is recorded on our side, so the vendor's answer is shown verbatim
 * and the dialog stays open on it — that reply is the only receipt.
 */

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { Button, Field, Modal, Notice, Select, TextInput } from '@/components/ui';
import type { Device, RechargeType, SilversatRegion, VendorResponse } from '@/types';
import { VendorPayload } from '../shared/VendorPayload';

const TYPE_LABEL: Record<string, string> = {
  '0': 'تجديد اشتراك موجود',
  '1': 'تفعيل جهاز جديد',
};

export function RenewDialog({
  device,
  region,
  onClose,
}: {
  device: Device;
  /** The server the owner is on. Shown, never sent. */
  region: SilversatRegion | null;
  onClose: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [code, setCode] = useState('');
  const [type, setType] = useState<'0' | '1'>('0');
  const [result, setResult] = useState<VendorResponse | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim()) {
      setInvalid('رقم الكارت مطلوب');
      return;
    }
    setInvalid(null);
    const ok = await run(
      () => repos.silversat.recharge(device.deviceNumber, code, Number(type) as RechargeType),
      (data) => setResult(data),
    );
    if (ok) toast('انرسل الشحن للسيرفر — راجع رد السيرفر');
  };

  return (
    <Modal
      title={`شحن الجهاز ${device.deviceNumber}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<Zap size={15} />}
            disabled={action.pending}
            onClick={() => void submit()}
          >
            {action.pending ? 'جاري التنفيذ…' : 'تنفيذ الشحن'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إغلاق
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        <Notice tone="warning">
          الكارت لازم يكون مباع مسبقاً لنفس المشترك صاحب هذا الجهاز، والسيرفر ينتخب تلقائياً من
          منتج الكارت. الإجراء مباشر وما ننحفظ عدنا سجل إله.
        </Notice>

        <Notice tone={region ? 'info' : 'danger'}>
          {region ? (
            <>
              المشترك على سيرفر <span className="strong">{region.name}</span> — فلازم الكارت
              يكون من منتج على نفس السيرفر، وإلا السيرفر يرفضه.
            </>
          ) : (
            <>ما ينعرف سيرفر المشترك، فتأكد إن الكارت من منتج على سيرفره قبل الشحن.</>
          )}
        </Notice>

        <div className="grid grid-form">
          <Field label="الجهاز">
            <TextInput value={device.deviceNumber} onChange={() => undefined} disabled />
          </Field>
          <Field label="نوع العملية">
            <Select<'0' | '1'>
              value={type}
              onChange={setType}
              options={[
                { value: '0', label: TYPE_LABEL['0'] },
                { value: '1', label: TYPE_LABEL['1'] },
              ]}
            />
          </Field>
          <Field label="رقم الكارت" className="span-2">
            <TextInput
              value={code}
              onChange={setCode}
              placeholder="اكتب أو الصق رقم الكارت"
            />
          </Field>
        </div>

        {invalid || action.error ? (
          <Notice tone="danger">{invalid ?? action.error}</Notice>
        ) : null}

        {result ? (
          <div className="col" style={{ gap: 'var(--sp-2)' }}>
            <span className="fs-small muted">رد السيرفر</span>
            <VendorPayload data={result} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
