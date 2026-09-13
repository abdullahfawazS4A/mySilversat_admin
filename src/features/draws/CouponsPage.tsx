/**
 * Draw coupons. Designed, not wired — they hang off the draws model.
 */

import { NotLinked } from '../shared/NotLinked';

export function CouponsPage() {
  return (
    <NotLinked
      title="الكوبونات"
      purpose="الكوبونات اللي تتولّد للمشترك عند كل تجديد، وهي مادة السحب."
      missing={['GET /coupons', 'GET /coupons?appUserId=', 'POST /coupons/issue']}
      insteadNote="الكارتات المباعة تنعرض بشاشة المبيعات، وهي أقرب سجل موجود فعلاً للتجديدات."
    />
  );
}
