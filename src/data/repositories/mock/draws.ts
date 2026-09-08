/**
 * Mock coupons, draws, prize tiers and winners.
 *
 * A draw is run once and then frozen: runDraw() refuses to run twice, because
 * re-rolling a prize draw after winners exist is the kind of action that
 * destroys trust in the promotion. Correcting a bad draw means creating a new
 * one, which leaves both in the audit log.
 */

import type { Coupon, Draw, DrawWinner, Id, Page, Prize } from '@/types';
import type { CouponListQuery, CouponRow, DrawsRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { matchesSearch, newId, sampleDistinct } from '@/lib/utils';
import { maskName } from '@/lib/format';
import { paginate, removeById, requireById, upsert } from './helpers';

function toCouponRow(coupon: Coupon): CouponRow {
  const user = mockDb.tables.users.find((u) => u.id === coupon.userId);
  return {
    ...coupon,
    userName: user?.fullName ?? '—',
    userPhone: user?.phone ?? '—',
    governorateId: user?.governorateId ?? '',
  };
}

/** Coupons that may enter a given draw right now. */
function eligibleCoupons(draw: Draw): Coupon[] {
  const alreadyWon = new Set(mockDb.tables.drawWinners.map((w) => w.couponId));
  return mockDb.tables.coupons.filter((coupon) => {
    if (coupon.year !== draw.year) return false;
    if (!coupon.active) return false;
    if (alreadyWon.has(coupon.id)) return false;
    if (coupon.issuedAt < draw.opensAt || coupon.issuedAt > draw.closesAt) return false;
    if (draw.governorateIds.length > 0) {
      const user = mockDb.tables.users.find((u) => u.id === coupon.userId);
      if (!user || !draw.governorateIds.includes(user.governorateId)) return false;
    }
    return true;
  });
}

export class MockDrawsRepository implements DrawsRepository {
  async coupons(query: CouponListQuery): Promise<Page<CouponRow>> {
    await mockDb.latency();
    let rows = mockDb.tables.coupons.map(toCouponRow);

    if (query.year) rows = rows.filter((c) => c.year === query.year);
    if (typeof query.active === 'boolean') rows = rows.filter((c) => c.active === query.active);
    if (query.governorateId) rows = rows.filter((c) => c.governorateId === query.governorateId);
    if (query.search?.trim()) {
      const needle = query.search.trim();
      rows = rows.filter(
        (c) =>
          matchesSearch(c.code, needle) ||
          matchesSearch(c.userName, needle) ||
          c.userPhone.includes(needle.replace(/\s/g, '')),
      );
    }

    rows.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<CouponRow>;
  }

  draws(): Promise<Draw[]> {
    return mockDb.read(() =>
      [...mockDb.tables.draws]
        .map((draw) => ({ ...draw, entryCount: eligibleCoupons(draw).length }))
        .sort((a, b) => b.year.localeCompare(a.year)),
    );
  }

  async saveDraw(draw: Omit<Draw, 'id' | 'entryCount'> & { id?: Id }): Promise<Draw> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.draws, draw, 'drw', {
      nameAr: draw.nameAr,
      year: draw.year,
      state: draw.state,
      opensAt: draw.opensAt,
      closesAt: draw.closesAt,
      drawnAt: null,
      publishedAt: null,
      governorateIds: draw.governorateIds,
      entryCount: 0,
    });
    mockDb.audit(draw.id ? 'update' : 'create', 'draw', saved.id, `سحب ${saved.nameAr}`);
    return saved;
  }

  async deleteDraw(id: Id): Promise<void> {
    await mockDb.latency();
    const draw = requireById(mockDb.tables.draws, id, 'السحب');
    if (draw.state === 'drawn' || draw.state === 'published') {
      throw new Error('لا يمكن حذف سحب تم إجراؤه');
    }
    mockDb.tables.prizes = mockDb.tables.prizes.filter((p) => p.drawId !== id);
    removeById(mockDb.tables.draws, id);
    mockDb.audit('delete', 'draw', id, `حذف سحب ${draw.nameAr}`);
  }

  prizes(drawId: Id): Promise<Prize[]> {
    return mockDb.read(() =>
      mockDb.tables.prizes.filter((p) => p.drawId === drawId).sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  async savePrize(prize: Omit<Prize, 'id'> & { id?: Id }): Promise<Prize> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.prizes, prize, 'prz', {
      drawId: prize.drawId,
      iconKey: prize.iconKey,
      titleAr: prize.titleAr,
      subtitleAr: prize.subtitleAr,
      rank: prize.rank,
      gradientIndex: prize.gradientIndex,
      winnersCount: prize.winnersCount,
      sortOrder: mockDb.tables.prizes.filter((p) => p.drawId === prize.drawId).length,
    });
    mockDb.audit(prize.id ? 'update' : 'create', 'prize', saved.id, `جائزة ${saved.titleAr}`);
    return saved;
  }

  async deletePrize(id: Id): Promise<void> {
    await mockDb.latency();
    if (mockDb.tables.drawWinners.some((w) => w.prizeId === id)) {
      throw new Error('لا يمكن حذف جائزة عليها فائزون');
    }
    removeById(mockDb.tables.prizes, id);
    mockDb.audit('delete', 'prize', id, 'حذف جائزة');
  }

  async eligibleCount(drawId: Id): Promise<number> {
    await mockDb.latency();
    return eligibleCoupons(requireById(mockDb.tables.draws, drawId, 'السحب')).length;
  }

  async runDraw(drawId: Id): Promise<DrawWinner[]> {
    await mockDb.latency();
    const draw = requireById(mockDb.tables.draws, drawId, 'السحب');
    if (draw.state === 'drawn' || draw.state === 'published') {
      throw new Error('هذا السحب أُجري مسبقاً — أنشئ سحباً جديداً بدل إعادته');
    }

    const tiers = mockDb.tables.prizes
      .filter((p) => p.drawId === drawId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (tiers.length === 0) throw new Error('أضف جوائز للسحب قبل إجرائه');

    let pool = eligibleCoupons(draw);
    const needed = tiers.reduce((sum, tier) => sum + tier.winnersCount, 0);
    if (pool.length < needed) {
      throw new Error(`الكوبونات المؤهلة (${pool.length}) أقل من عدد الجوائز (${needed})`);
    }

    const rng = () => Math.random();
    const created: DrawWinner[] = [];
    const now = new Date().toISOString();

    for (const tier of tiers) {
      const picked = sampleDistinct(pool, tier.winnersCount, rng);
      const pickedIds = new Set(picked.map((c) => c.id));
      pool = pool.filter((c) => !pickedIds.has(c.id));

      for (const coupon of picked) {
        const user = mockDb.tables.users.find((u) => u.id === coupon.userId);
        const gov = mockDb.tables.governorates.find((g) => g.id === user?.governorateId);
        const winner: DrawWinner = {
          id: newId('wnr'),
          drawId,
          prizeId: tier.id,
          couponId: coupon.id,
          userId: coupon.userId,
          maskedName: maskName(user?.fullName ?? '؟؟', gov?.nameAr ?? ''),
          drawnAt: now,
          claimed: false,
          claimedAt: null,
        };
        mockDb.tables.drawWinners.push(winner);
        created.push(winner);
        coupon.active = false;
        coupon.drawId = drawId;
        coupon.resultTextAr = `${tier.titleAr} · فائز`;
      }
    }

    // Every coupon that entered and lost gets its result line, so the app can
    // tell a customer their coupon was included rather than leaving it blank.
    for (const coupon of eligibleCoupons(draw)) {
      coupon.active = false;
      coupon.drawId = drawId;
      coupon.resultTextAr = `سحب ${draw.year} — ما ربح`;
    }

    draw.state = 'drawn';
    draw.drawnAt = now;
    draw.entryCount = created.length + pool.length;
    mockDb.audit('run', 'draw', drawId, `إجراء ${draw.nameAr} — ${created.length} فائز`);
    return created;
  }

  async winners(
    drawId: Id,
  ): Promise<(DrawWinner & { userName: string; prizeTitle: string; couponCode: string })[]> {
    await mockDb.latency();
    return mockDb.tables.drawWinners
      .filter((w) => w.drawId === drawId)
      .map((winner) => ({
        ...winner,
        userName: mockDb.tables.users.find((u) => u.id === winner.userId)?.fullName ?? '—',
        prizeTitle: mockDb.tables.prizes.find((p) => p.id === winner.prizeId)?.titleAr ?? '—',
        couponCode: mockDb.tables.coupons.find((c) => c.id === winner.couponId)?.code ?? '—',
      }));
  }

  async publishDraw(drawId: Id): Promise<Draw> {
    await mockDb.latency();
    const draw = requireById(mockDb.tables.draws, drawId, 'السحب');
    if (draw.state !== 'drawn') throw new Error('أجرِ السحب قبل نشر النتائج');
    draw.state = 'published';
    draw.publishedAt = new Date().toISOString();
    mockDb.audit('update', 'draw', drawId, `نشر نتائج ${draw.nameAr} داخل التطبيق`);
    return draw;
  }

  async setWinnerClaimed(winnerId: Id, claimed: boolean): Promise<DrawWinner> {
    await mockDb.latency();
    const winner = requireById(mockDb.tables.drawWinners, winnerId, 'الفائز');
    winner.claimed = claimed;
    winner.claimedAt = claimed ? new Date().toISOString() : null;
    mockDb.audit('update', 'winner', winnerId, `${claimed ? 'تسليم' : 'إلغاء تسليم'} جائزة`);
    return winner;
  }
}
