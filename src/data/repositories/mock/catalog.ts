/** Mock reference data: governorates, leagues, teams and packages. */

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

  async saveLeague(league: Omit<League, 'id'> & { id?: Id }): Promise<League> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.leagues, league, 'lg', {
      key: league.key,
      nameAr: league.nameAr,
      country: league.country,
      active: true,
      sortOrder: mockDb.tables.leagues.length,
    });
    mockDb.audit(league.id ? 'update' : 'create', 'league', saved.id, `دوري ${saved.nameAr}`);
    return saved;
  }

  async deleteLeague(id: Id): Promise<void> {
    await mockDb.latency();
    if (mockDb.tables.matches.some((m) => m.leagueId === id)) {
      throw new Error('لا يمكن حذف دوري عليه مباريات — عطّله بدل الحذف');
    }
    removeById(mockDb.tables.leagues, id);
    mockDb.audit('delete', 'league', id, 'حذف دوري');
  }

  teams(): Promise<Team[]> {
    return mockDb.read(() => [...mockDb.tables.teams]);
  }

  async saveTeam(team: Omit<Team, 'id'> & { id?: Id }): Promise<Team> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.teams, team, 'tm', {
      nameAr: team.nameAr,
      shortNameAr: team.shortNameAr,
      leagueId: team.leagueId,
      crestSeed: team.crestSeed,
    });
    mockDb.audit(team.id ? 'update' : 'create', 'team', saved.id, `فريق ${saved.nameAr}`);
    return saved;
  }

  async deleteTeam(id: Id): Promise<void> {
    await mockDb.latency();
    if (mockDb.tables.matches.some((m) => m.homeTeamId === id || m.awayTeamId === id)) {
      throw new Error('لا يمكن حذف فريق عليه مباريات مسجلة');
    }
    removeById(mockDb.tables.teams, id);
    mockDb.audit('delete', 'team', id, 'حذف فريق');
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
