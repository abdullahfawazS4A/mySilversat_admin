/**
 * In-memory mock database.
 *
 * This is the console counterpart of the app MockDb: it loads the seed once,
 * keeps it in memory for the lifetime of the tab, and injects a simulated
 * network latency into every call so loading skeletons are always exercised.
 *
 * Two differences from the app version, both because this is a write-heavy
 * console rather than a read-only client:
 *
 *  1. Mutations really mutate the in-memory tables, so a change made on one
 *     screen is visible on every other screen immediately.
 *  2. Every mutation appends to the audit table, exactly as a real backend
 *     would, so the audit screen is not a fake.
 */

import type {
  Agent,
  ApiConnection,
  AdminUser,
  AppSettings,
  AppUser,
  AuditAction,
  AuditEntry,
  Coupon,
  Device,
  Draw,
  DrawWinner,
  FaqItem,
  Governorate,
  League,
  Match,
  NotificationCampaign,
  Offer,
  PointsEntry,
  Prediction,
  Prize,
  Renewal,
  Season,
  Slide,
  StockCard,
  SubscriptionPackage,
  Team,
  Tower,
  VideoItem,
} from '@/types';
import * as seed from './seed';
import { newId } from '@/lib/utils';

/** Every mutable table the console can read or write. */
export interface MockTables {
  governorates: Governorate[];
  admins: AdminUser[];
  users: AppUser[];
  devices: Device[];
  packages: SubscriptionPackage[];
  renewals: Renewal[];
  agents: Agent[];
  stockCards: StockCard[];
  apiConnections: ApiConnection[];
  leagues: League[];
  teams: Team[];
  matches: Match[];
  predictions: Prediction[];
  seasons: Season[];
  pointsEntries: PointsEntry[];
  coupons: Coupon[];
  draws: Draw[];
  prizes: Prize[];
  drawWinners: DrawWinner[];
  offers: Offer[];
  slides: Slide[];
  towers: Tower[];
  videos: VideoItem[];
  faq: FaqItem[];
  campaigns: NotificationCampaign[];
  audit: AuditEntry[];
  settings: AppSettings;
}

/** Builds a fresh copy of the seed. Called once, and again on a hard reset. */
function buildTables(): MockTables {
  return {
    governorates: [...seed.GOVERNORATES],
    admins: [...seed.ADMIN_USERS],
    users: [...seed.APP_USERS],
    devices: [...seed.DEVICES],
    packages: [...seed.PACKAGES],
    renewals: [...seed.RENEWALS],
    agents: [...seed.AGENTS],
    stockCards: [...seed.STOCK_CARDS],
    apiConnections: [...seed.API_CONNECTIONS],
    leagues: [...seed.LEAGUES],
    teams: [...seed.TEAMS],
    matches: [...seed.MATCHES],
    predictions: [...seed.PREDICTIONS],
    seasons: [...seed.SEASONS],
    pointsEntries: [...seed.POINTS_ENTRIES],
    coupons: [...seed.COUPONS],
    draws: [...seed.DRAWS],
    prizes: [...seed.PRIZES],
    drawWinners: [...seed.DRAW_WINNERS],
    offers: [...seed.OFFERS],
    slides: [...seed.SLIDES],
    towers: [...seed.TOWERS],
    videos: [...seed.VIDEOS],
    faq: [...seed.FAQ_ITEMS],
    campaigns: [...seed.CAMPAIGNS],
    audit: [...seed.AUDIT_ENTRIES],
    settings: { ...seed.SETTINGS },
  };
}

class MockDb {
  /** The single in-memory instance every repository reads from. */
  tables: MockTables = buildTables();

  /** Who is signed in. Set by the auth repository; used to stamp audit rows. */
  currentAdmin: AdminUser | null = null;

  /**
   * Simulated round-trip. Range comes from settings so it can be tuned (or
   * zeroed) live from the settings screen when demoing.
   */
  latency(): Promise<void> {
    const [min, max] = this.tables.settings.mockLatencyMs;
    const ms = min + Math.random() * Math.max(0, max - min);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Awaits the simulated latency then returns the value. */
  async read<T>(value: T | (() => T)): Promise<T> {
    await this.latency();
    return typeof value === 'function' ? (value as () => T)() : value;
  }

  /** Appends an audit row. Called by every mutating repository method. */
  audit(action: AuditAction, entityType: string, entityId: string, summaryAr: string): void {
    const admin = this.currentAdmin;
    this.tables.audit.unshift({
      id: newId('aud'),
      adminId: admin?.id ?? 'system',
      adminName: admin?.fullName ?? 'النظام',
      action,
      entityType,
      entityId,
      summaryAr,
      at: new Date().toISOString(),
    });
  }

  /** Throws away every local change and reloads the seed. */
  reset(): void {
    this.tables = buildTables();
  }
}

/** The one instance. Repositories close over this rather than taking it. */
export const mockDb = new MockDb();
