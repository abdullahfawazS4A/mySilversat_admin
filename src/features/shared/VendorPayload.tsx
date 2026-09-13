/**
 * Renders a vendor answer exactly as it arrived.
 *
 * The SilverSat endpoints are pass-through: the shape of the reply is the
 * vendor's, not ours, and it differs per operation. Mapping it onto labels we
 * invented would be a guess, and a wrong label over a field that means
 * something else is worse than a raw key — so the keys are shown as they came.
 */

import { KeyValue, Notice } from '@/components/ui';
import type { VendorResponse } from '@/types';

export function VendorPayload({ data }: { data: VendorResponse }) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) return <Notice tone="info">السيرفر رجّع رد فارغ.</Notice>;

  return (
    <KeyValue
      rows={entries.map(([key, value]) => [
        key,
        value === null || value === undefined ? (
          '—'
        ) : typeof value === 'object' ? (
          <code className="num">{JSON.stringify(value)}</code>
        ) : (
          String(value)
        ),
      ])}
    />
  );
}
