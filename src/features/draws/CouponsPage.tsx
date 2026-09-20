/**
 * Draw coupons. Designed, not wired.
 *
 * The coupons themselves are real now — the server issues one per renewal and
 * they feed the prize draws this console authors — but the only route that
 * reads them is `/coupons/my`, which answers for the signed-in app user and
 * refuses an admin token. So there is nothing an operator can be shown here
 * yet: not a list, not a count, not one subscriber's coupons.
 */

import { NotLinked } from '../shared/NotLinked';

export function CouponsPage() {
  return (
    <NotLinked
      title="الكوبونات"
      purpose="الكوبونات اللي تتولّد للمشترك عند كل تجديد، وهي مادة السحب."
      missing={['GET /coupons', 'GET /coupons?appUserId=', 'GET /coupons?prizeDrawId=']}
      insteadNote="الكوبونات موجودة فعلاً بالسيرفر وتتولّد تلقائياً عند التجديد، بس المسار الوحيد اللي يقرأها هو /coupons/my وهو للمشترك نفسه ويرفض توكن الأدمن. الكارتات المباعة بشاشة المبيعات هي أقرب سجل موجود للتجديدات."
    />
  );
}
