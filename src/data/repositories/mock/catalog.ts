/**
 * Mock reference data: governorates, leagues, teams and packages.
 *
 * Leagues and teams are read-only here. They belong to the fixtures feed, and
 * `MockMatchesRepository.sync()` is the only thing that writes them — the sole
 * exception being a league's `active` flag, which is a local product decision.
 */

import type { Governorate, Id, League, SubscriptionPackage, Team } from '@/types';
import type { CatalogRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { removeById, requireById, upsert } from './helpers';

export class MockCatalogRepository implements CatalogRepository {
  governorates(): Promise<Governorate[]> {
    return mockDb.read(() => [...mockDb.tables.governorates].sort((a, b) => b.subscriberCount - a.subscriberCount));
  }

  async saveGovernorate(governorate: Governorate): Promise<Governorate> {
    await mockDb.latency();
    const row = requireById(mockDb.tables.governorates, governorate.id, 'المحافظة');
    Object.assign(row, governorate);
    mockDb.audit('update', 'governorate', row.id, `تعديل محافظة ${row.nameAr}`);
    return row;
  }

  leagues(): Promise<League[]> {
    return mockDb.read(() => [...mockDb.tables.leagues].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  /**
   * The one thing about a league that is ours rather than the feed's: whether
   * the app shows it. The feed keeps sending a switched-off league's fixtures
   * and this console keeps mirroring them — they just do not reach customers.
   */
  async setLeagueActive(id: Id, active: boolean): Promise<League> {
    await mockDb.latency();
    const league = requireById(mockDb.tables.leagues, id, 'الدوري');
    league.active = active;
    mockDb.audit('update', 'league', id, `${active ? 'تفعيل' : 'تعطيل'} دوري ${league.nameAr}`);
    return league;
  }

  teams(): Promise<Team[]> {
    return mockDb.read(() => [...mockDb.tables.teams]);
  }

  packages(): Promise<SubscriptionPackage[]> {
    return mockDb.read(() => [...mockDb.tables.packages].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async savePackage(pkg: Omit<SubscriptionPackage, 'id'> & { id?: Id }): Promise<SubscriptionPackage> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.packages, pkg, 'pk', {
      months: pkg.months,
      price: pkg.price,
      save: pkg.save,
      bonus: pkg.bonus,
      featured: pkg.featured,
      active: pkg.active,
      sortOrder: mockDb.tables.packages.length,
    });
    // Only one package may be featured — the renew screen highlights exactly one.
    if (saved.featured) {
      for (const other of mockDb.tables.packages) {
        if (other.id !== saved.id) other.featured = false;
      }
    }
    mockDb.audit(pkg.id ? 'update' : 'create', 'package', saved.id, `باقة ${saved.months} أشهر`);
    return saved;
  }

  async deletePackage(id: Id): Promise<void> {
    await mockDb.latency();
    if (mockDb.tables.renewals.some((r) => r.packageId === id)) {
      throw new Error('لا يمكن حذف باقة مستخدمة في تجديدات — عطّلها بدل الحذف');
    }
    removeById(mockDb.tables.packages, id);
    mockDb.audit('delete', 'package', id, 'حذف باقة');
  }
}
