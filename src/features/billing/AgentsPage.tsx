/**
 * Resellers. Designed, not wired — the API has no agent model at all.
 */

import { NotLinked } from '../shared/NotLinked';

export function AgentsPage() {
  return (
    <NotLinked
      title="الوكلاء"
      purpose="إدارة وكلاء البيع — أرصدتهم، أسعارهم الخاصة وعمولاتهم على كل كارت يبيعونه."
      missing={['GET/POST /agents', 'GET /agents/:id/ledger', 'POST /agents/:id/credit']}
      insteadNote="أسعار الوكلاء (سعر الرئيسي وسعر الفرعي) موجودة على كل فئة بشاشة الباقات والأسعار."
    />
  );
}
