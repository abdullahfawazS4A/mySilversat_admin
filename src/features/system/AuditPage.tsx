/**
 * The audit trail. Designed, not wired — the API keeps no change log.
 */

import { NotLinked } from '../shared/NotLinked';

export function AuditPage() {
  return (
    <NotLinked
      title="سجل العمليات"
      purpose="من غيّر شنو ومتى — تتبّع كل إجراء إداري على اللوحة."
      missing={['GET /audit-logs', 'GET /audit-logs?adminId=']}
      insteadNote="بعض السجلات محفوظة ضمنياً: الدفعة تحمل اسم اللي رفعها، والإشعار يحمل اسم اللي أرسله."
    />
  );
}
