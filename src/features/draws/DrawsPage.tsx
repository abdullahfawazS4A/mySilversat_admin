/**
 * Prize draws. Designed, not wired — no draw endpoints exist.
 */

import { NotLinked } from '../shared/NotLinked';

export function DrawsPage() {
  return (
    <NotLinked
      title="السحوبات والجوائز"
      purpose="تعريف جوائز كل سحب، إجراء السحب على الكوبونات المستحقة ونشر الفائزين بالتطبيق."
      missing={['GET/POST /draws', 'POST /draws/:id/run', 'GET /draws/:id/winners']}
      insteadNote="لحد ما ينربط، المسابقة الشغالة فعلياً بالتطبيق هي توقع المباريات والنقاط."
    />
  );
}
