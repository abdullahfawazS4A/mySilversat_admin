/**
 * Mock card stock.
 *
 * Stock is held **per governorate** because that is how it physically works:
 * cards are shipped to a governorate and only that governorate's subscribers
 * can be renewed from them. Nothing here pools stock nationally, and no method
 * lets a renewal reach across governorates — that constraint is the whole
 * point of the feature, so it lives in the data layer rather than in a screen.
 *
 * Cards are consumed FIFO by arrival date. Renewals call `takeCard` (see
 * `renewals.ts`), which is exported from here so the burn and the transaction
 * stay in one file each: the rule for *which* card goes next belongs to stock.
 */

import type { Id, Page, StockCard, StockLevel } from '@/types';
import type { StockCardListQuery, StockCardRow, StockRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { matchesSearch, newId } from '@/lib/utils';
import { paginate, requireById } from './helpers';

function toRow(card: StockCard): StockCardRow {
  const governorate = mockDb.tables.governorates.find((g) => g.id === card.governorateId);
  const device = card.usedByDeviceId
    ? mockDb.tables.devices.find((d) => d.id === card.usedByDeviceId)
    : undefined;
  return {
    ...card,
    governorateName: governorate?.nameAr ?? '—',
    deviceNumber: device?.number,
  };
}

/**
 * Hands the next card to a renewal, oldest first, and marks it burnt.
 *
 * Throws in Arabic when that governorate has run out of that length — the
 * renewal must fail rather than extend a subscription no card paid for.
 * Called inside the renewal transaction, so it does not await latency of its
 * own.
 */
export function takeCard(
  governorateId: Id,
  months: number,
  renewalId: Id,
  deviceId: Id,
): StockCard {
  const card = nextAvailableCard(governorateId, months);
  if (!card) {
    const name = mockDb.tables.governorates.find((g) => g.id === governorateId)?.nameAr ?? 'المحافظة';
    throw new Error(`ما بقى كارت ${months} أشهر في مخزن ${name} — عبّي المخزن قبل التجديد`);
  }
  card.status = 'used';
  card.usedAt = new Date().toISOString();
  card.usedByRenewalId = renewalId;
  card.usedByDeviceId = deviceId;
  return card;
}

/** FIFO lookup shared by `takeCard` and the repository's preview method. */
function nextAvailableCard(governorateId: Id, months: number): StockCard | undefined {
  return mockDb.tables.stockCards
    .filter((c) => c.governorateId === governorateId && c.months === months && c.status === 'available')
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt))[0];
}

export class MockStockRepository implements StockRepository {
  levels(): Promise<StockLevel[]> {
    return mockDb.read(() => {
      const buckets = new Map<string, StockLevel>();
      // Lengths worth a column: the ones currently on sale, plus any length
      // still sitting in stock from a package that has since been retired.
      // A discontinued package must not add an all-zero column forever.
      const lengths = [
        ...new Set([
          ...mockDb.tables.packages.filter((p) => p.active).map((p) => p.months),
          ...mockDb.tables.stockCards.map((c) => c.months),
        ]),
      ].sort((a, b) => a - b);
      // Seed a row for every governorate/length pair, including the empty ones
      // — a sold-out length has to show as a zero, not vanish from the grid.
      for (const governorate of mockDb.tables.governorates) {
        for (const months of lengths) {
          buckets.set(`${governorate.id}|${months}`, {
            governorateId: governorate.id,
            months,
            available: 0,
            used: 0,
            voided: 0,
          });
        }
      }

      for (const card of mockDb.tables.stockCards) {
        const key = `${card.governorateId}|${card.months}`;
        const bucket = buckets.get(key);
        if (!bucket) continue;
        if (card.status === 'available') bucket.available += 1;
        else if (card.status === 'used') bucket.used += 1;
        else bucket.voided += 1;
      }

      return [...buckets.values()];
    });
  }

  async cards(query: StockCardListQuery): Promise<Page<StockCardRow>> {
    await mockDb.latency();
    let rows = mockDb.tables.stockCards.map(toRow);

    if (query.governorateId) rows = rows.filter((c) => c.governorateId === query.governorateId);
    if (typeof query.months === 'number') rows = rows.filter((c) => c.months === query.months);
    if (query.status && query.status !== 'all') rows = rows.filter((c) => c.status === query.status);
    if (query.batchRef) rows = rows.filter((c) => c.batchRef === query.batchRef);
    if (query.search?.trim()) {
      const needle = query.search.trim();
      rows = rows.filter(
        (c) => matchesSearch(c.code, needle) || matchesSearch(c.batchRef, needle),
      );
    }

    // Available cards first and oldest first inside that, so the top of the
    // table is literally the next card out the door.
    rows.sort((a, b) => {
      if (a.status !== b.status) {
        const rank = { available: 0, used: 1, void: 2 } as const;
        return rank[a.status] - rank[b.status];
      }
      return a.addedAt.localeCompare(b.addedAt);
    });

    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<StockCardRow>;
  }

  async addBatch(input: {
    governorateId: Id;
    months: number;
    codes: string[];
    batchRef: string;
  }): Promise<{ added: number; duplicates: string[] }> {
    await mockDb.latency();
    requireById(mockDb.tables.governorates, input.governorateId, 'المحافظة');
    if (input.months <= 0) throw new Error('مدة الكارت لازم تكون أكبر من صفر');

    const clean = input.codes.map((code) => code.trim()).filter(Boolean);
    if (clean.length === 0) throw new Error('ما بيها أكواد — الصق أكواد الكارتات أو ولّدها');

    // A code is the card's identity, so a collision is a filing error worth
    // reporting rather than a duplicate worth creating.
    const existing = new Set(mockDb.tables.stockCards.map((c) => c.code.toUpperCase()));
    const duplicates: string[] = [];
    const seen = new Set<string>();
    const addedAt = new Date().toISOString();
    let added = 0;

    for (const code of clean) {
      const key = code.toUpperCase();
      if (existing.has(key) || seen.has(key)) {
        duplicates.push(code);
        continue;
      }
      seen.add(key);
      mockDb.tables.stockCards.push({
        id: newId('crd'),
        code,
        governorateId: input.governorateId,
        months: input.months,
        status: 'available',
        batchRef: input.batchRef.trim() || 'B-يدوي',
        addedAt,
        usedAt: null,
      });
      added += 1;
    }

    if (added === 0) throw new Error('كل الأكواد موجودة مسبقاً — ما انضاف ولا كارت');

    const governorate = mockDb.tables.governorates.find((g) => g.id === input.governorateId);
    mockDb.audit(
      'create',
      'stock',
      input.batchRef,
      `إضافة ${added} كارت ${input.months} أشهر لمخزن ${governorate?.nameAr ?? ''}`,
    );
    return { added, duplicates };
  }

  nextAvailable(governorateId: Id, months: number): Promise<StockCard | null> {
    return mockDb.read(() => nextAvailableCard(governorateId, months) ?? null);
  }

  async voidCard(id: Id, reasonAr: string): Promise<StockCard> {
    await mockDb.latency();
    const card = requireById(mockDb.tables.stockCards, id, 'الكارت');
    if (card.status === 'used') throw new Error('هذا الكارت مستهلك — ما ينلغى');
    card.status = 'void';
    card.voidReasonAr = reasonAr;
    mockDb.audit('update', 'stock', card.id, `إلغاء كارت ${card.code} — ${reasonAr}`);
    return card;
  }

  async transfer(ids: Id[], toGovernorateId: Id): Promise<number> {
    await mockDb.latency();
    const target = requireById(mockDb.tables.governorates, toGovernorateId, 'المحافظة');

    let moved = 0;
    for (const id of ids) {
      const card = mockDb.tables.stockCards.find((c) => c.id === id);
      // Only unused stock can move; a burnt card belongs to the subscription
      // it paid for, wherever that is.
      if (!card || card.status !== 'available') continue;
      if (card.governorateId === toGovernorateId) continue;
      card.governorateId = toGovernorateId;
      moved += 1;
    }

    if (moved === 0) throw new Error('ما انتقل ولا كارت — اختر كارتات متاحة في محافظة ثانية');
    mockDb.audit('update', 'stock', toGovernorateId, `نقل ${moved} كارت إلى مخزن ${target.nameAr}`);
    return moved;
  }

  async remove(id: Id): Promise<void> {
    await mockDb.latency();
    const card = requireById(mockDb.tables.stockCards, id, 'الكارت');
    if (card.status === 'used') throw new Error('ما ينحذف كارت مستهلك — سجله جزء من التجديد');
    const index = mockDb.tables.stockCards.findIndex((c) => c.id === id);
    mockDb.tables.stockCards.splice(index, 1);
    mockDb.audit('delete', 'stock', id, `حذف كارت ${card.code}`);
  }
}
