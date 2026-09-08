/**
 * Domain model for the Silversat admin console.
 *
 * These types are the contract between the UI and the data layer. They mirror
 * the customer app models (Mysilversat/lib/data/models) but are strictly
 * richer: the app only reads what it renders, while the console has to edit
 * ownership, scheduling, moderation and audit fields the app never sees.
 *
 * Nothing here is UI-specific. When a real backend arrives these become the
 * response DTOs and only data/repositories/mock gets rewritten.
 */

/** Every id in the system is an opaque string. */
export type Id = string;

/** ISO-8601 timestamp, always stored in UTC. */
export type IsoDate = string;

// ---------------------------------------------------------------- shared ----

/**
 * Index into the app promoArt gradient inventory. The customer app draws art
 * surfaces from a fixed list of gradients rather than free-form colors, so the
 * console picks an index instead of a color.
 */
export type GradientIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** Keys the app maps to Iconsax glyphs. Adding one here needs an app change. */
export type IconKey =
  | 'home'
  | 'shop'
  | 'family'
  | 'tv'
  | 'receiver'
  | 'subscription'
  | 'merch'
  | 'trophy'
  | 'satellite'
  | 'gift';

/** Locales the app ships. Both are RTL. */
export type Locale = 'ar' | 'ckb';

/** Generic paginated envelope used by every list endpoint. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Shared list query. Repositories apply what they support and ignore the rest. */
export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ----------------------------------------------------------- governorates ---

/** An Iraqi governorate. Drives offer targeting, tower coverage and reporting. */
export interface Governorate {
  id: Id;
  nameAr: string;
  nameCkb: string;
  /** Whether the service is sold here at all. Disabling hides it everywhere. */
  active: boolean;
  /** Denormalised counter the dashboard reads without scanning users. */
  subscriberCount: number;
}

// ------------------------------------------------------------ admin users ---

/**
 * What an admin is allowed to do. Checked in the UI to hide controls; a real
 * backend must re-check server-side — the console never treats this as
 * security on its own.
 */
export type Permission =
  | 'dashboard.view'
  | 'users.view'
  | 'users.edit'
  | 'users.block'
  | 'devices.view'
  | 'devices.edit'
  | 'renewals.view'
  | 'renewals.create'
  | 'packages.edit'
  | 'matches.view'
  | 'matches.edit'
  | 'predictions.view'
  | 'predictions.settle'
  | 'points.adjust'
  | 'draws.view'
  | 'draws.run'
  | 'content.edit'
  | 'notifications.send'
  | 'agents.edit'
  | 'settings.edit'
  | 'admins.edit'
  | 'audit.view';

export type AdminRoleKey = 'owner' | 'operations' | 'content' | 'support' | 'viewer';

export interface AdminRole {
  key: AdminRoleKey;
  nameAr: string;
  descriptionAr: string;
  permissions: Permission[];
}

export interface AdminUser {
  id: Id;
  fullName: string;
  username: string;
  phone: string;
  role: AdminRoleKey;
  active: boolean;
  createdAt: IsoDate;
  lastLoginAt: IsoDate | null;
  /** Governorates this admin is scoped to. Empty means nationwide. */
  governorateIds: Id[];
}

/** The signed-in admin plus the resolved permission set for fast checks. */
export interface AdminSession {
  admin: AdminUser;
  permissions: Permission[];
}

// ------------------------------------------------------------- app users ----

export type AppUserStatus = 'active' | 'blocked' | 'pending';

/** A customer of the TV service — the person who uses the mobile app. */
export interface AppUser {
  id: Id;
  fullName: string;
  /** Login identity in the app. Iraqi mobile format, e.g. 0770 000 0000. */
  phone: string;
  governorateId: Id;
  /** Free-text area inside the governorate. */
  area: string;
  status: AppUserStatus;
  /** Set when status is blocked so support can explain the block. */
  blockReason?: string;
  locale: Locale;
  joinedAt: IsoDate;
  lastSeenAt: IsoDate | null;
  /** Running total for the active season. Derived from the points ledger. */
  points: number;
  /** Cached leaderboard position for the active season; null when unranked. */
  rank: number | null;
  /** Lifetime totals, denormalised for the user detail header. */
  totalRenewals: number;
  totalSpend: number;
  notes: string;
}

// --------------------------------------------------------------- devices ----

export type DeviceStatus = 'active' | 'expiring' | 'expired' | 'suspended';

/** A physical receiver bound to a customer. `number` is printed on the box. */
export interface Device {
  id: Id;
  userId: Id;
  /** Customer-chosen label. */
  name: string;
  iconKey: Extract<IconKey, 'home' | 'shop' | 'family'>;
  /** Serial as shown in the app: SLV-0000 0000 000. */
  number: string;
  /** Hardware model, used by support when diagnosing. */
  model: string;
  status: DeviceStatus;
  /** End of the paid period. */
  expiryAt: IsoDate;
  /** Start of the current paid period; the progress bar spans start -> expiry. */
  periodStartAt: IsoDate;
  createdAt: IsoDate;
  /** Set when status is suspended. */
  suspendReason?: string;
}

// ----------------------------------------------------- packages & renewals --

/** A sellable subscription length. Prices are IQD, whole dinars. */
export interface SubscriptionPackage {
  id: Id;
  months: number;
  price: number;
  /** Discount versus buying the 3-month package repeatedly. 0 when none. */
  save: number;
  /** Grants the bonus free month advertised in the offers screen. */
  bonus: boolean;
  /** The one package highlighted in the renew screen. Only one may be true. */
  featured: boolean;
  active: boolean;
  sortOrder: number;
}

export type PaymentMethod = 'kcard' | 'cash_agent' | 'online' | 'free_grant';

export type RenewalStatus = 'completed' | 'pending' | 'refunded' | 'failed';

/** One renewal transaction. This is what extends a device expiry. */
export interface Renewal {
  id: Id;
  userId: Id;
  deviceId: Id;
  packageId: Id;
  months: number;
  price: number;
  method: PaymentMethod;
  /** Set when method is cash_agent. */
  agentId?: Id;
  status: RenewalStatus;
  /** The draw coupon this renewal generated, when the package qualifies. */
  couponId?: Id;
  createdAt: IsoDate;
  /** Expiry before and after, so support can audit a disputed renewal. */
  expiryBefore: IsoDate;
  expiryAfter: IsoDate;
  note?: string;
}

// ------------------------------------------------- leagues, teams, matches --

export interface League {
  id: Id;
  /** Stable key the app uses for grouping, e.g. iraqi, spanish. */
  key: string;
  nameAr: string;
  country: string;
  active: boolean;
  sortOrder: number;
}

export interface Team {
  id: Id;
  nameAr: string;
  shortNameAr: string;
  leagueId: Id;
  /**
   * Index into the app teamCrest gradient list. The app draws a letter crest
   * rather than uploading logos, so a team identity is its seed.
   */
  crestSeed: number;
}

export type MatchState = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

/**
 * A fixture. The console owns the whole lifecycle: create -> open for
 * predictions -> lock -> live score -> finish -> settle points.
 */
export interface Match {
  id: Id;
  leagueId: Id;
  homeTeamId: Id;
  awayTeamId: Id;
  kickoffAt: IsoDate;
  state: MatchState;
  homeScore: number | null;
  awayScore: number | null;
  /** Display clock while live. Cleared when the match finishes. */
  liveMinute?: string;
  /**
   * The switch the operator flips to put this fixture on the predict screen.
   * Only fixtures with this true and a future predictionCloseAt accept picks.
   */
  openForPredict: boolean;
  /** Picks are refused after this instant. Defaults to kickoff. */
  predictionCloseAt: IsoDate | null;
  /** Pins the fixture to the home screen preview card. */
  featured: boolean;
  /** Set once points have been awarded; prevents double settlement. */
  settledAt: IsoDate | null;
  /** Denormalised counter so the list does not have to scan predictions. */
  predictionCount: number;
  note?: string;
}

/** A match joined with its league and both teams, for display. */
export interface MatchView extends Match {
  league: League;
  homeTeam: Team;
  awayTeam: Team;
}

// ----------------------------------------------------------- predictions ----

export type PredictionOutcome = 'pending' | 'exact' | 'result' | 'goaldiff' | 'wrong';

/** One user score guess on one fixture. Unique per (userId, matchId). */
export interface Prediction {
  id: Id;
  matchId: Id;
  userId: Id;
  homePick: number;
  awayPick: number;
  createdAt: IsoDate;
  /** Last edit before lock; null when never changed. */
  updatedAt: IsoDate | null;
  outcome: PredictionOutcome;
  /** Null until the match is settled. */
  pointsAwarded: number | null;
}

/** Prediction joined with the user display fields, for tables. */
export interface PredictionView extends Prediction {
  userName: string;
  userPhone: string;
  governorateId: Id;
}

/**
 * How points are earned. Editable in settings because the client tunes it
 * between seasons.
 */
export interface ScoringRules {
  /** Both numbers right. */
  exactScore: number;
  /** Right winner (or draw) and right goal difference, wrong scoreline. */
  goalDifference: number;
  /** Right winner (or draw) only. */
  correctResult: number;
  /** Wrong. Usually 0; negative is allowed. */
  wrong: number;
  /** Awarded for submitting at all, win or lose. */
  participation: number;
  /** Minutes before kickoff when picks lock, when no explicit close time set. */
  lockMinutesBeforeKickoff: number;
  /** Whether a user may edit a pick before lock. */
  allowEditBeforeLock: boolean;
}

/** Aggregate view of how a fixture predictions are distributed. */
export interface MatchPredictionStats {
  matchId: Id;
  total: number;
  /** Share of picks by outcome, for the pre-match sentiment bar. */
  homeWin: number;
  draw: number;
  awayWin: number;
  /** The most-picked scorelines, highest first. */
  topScorelines: { home: number; away: number; count: number }[];
}

// ------------------------------------------------------ points & seasons ----

export type PointsEntryKind =
  | 'prediction'
  | 'manual'
  | 'bonus'
  | 'penalty'
  | 'season_reset'
  | 'redeem';

/**
 * Append-only ledger. A user points total is the sum of their entries for the
 * active season; nothing mutates a balance directly, so every change is
 * explainable to a customer who disputes it.
 */
export interface PointsEntry {
  id: Id;
  userId: Id;
  seasonId: Id;
  delta: number;
  kind: PointsEntryKind;
  reasonAr: string;
  /** Match id for prediction, draw id for redeem, etc. */
  refId?: Id;
  /** Set when an admin made the change by hand. */
  adminId?: Id;
  createdAt: IsoDate;
}

/**
 * A competition period. The app tells users the ranking resets at the start of
 * each month, so a season is normally one calendar month and closing it zeroes
 * the board.
 */
export interface Season {
  id: Id;
  nameAr: string;
  startsAt: IsoDate;
  endsAt: IsoDate;
  /** Exactly one season is active at a time. */
  active: boolean;
  /** Set when the season was closed and its leaderboard frozen. */
  closedAt: IsoDate | null;
}

export interface LeaderboardRow {
  rank: number;
  userId: Id;
  name: string;
  governorateId: Id;
  points: number;
  /** Correct-prediction rate over the season, 0..1. */
  accuracy: number;
  predictionCount: number;
}

// --------------------------------------------------- coupons, draws, prizes -

/** A draw entry generated by a qualifying renewal. */
export interface Coupon {
  id: Id;
  code: string;
  userId: Id;
  deviceId: Id;
  renewalId: Id;
  /** Draw season the coupon belongs to, e.g. 2026. */
  year: string;
  /** False once the draw it belongs to has been run. */
  active: boolean;
  issuedAt: IsoDate;
  /** Set after the draw: either the prize won or the did-not-win line. */
  resultTextAr?: string;
  drawId?: Id;
}

/** A prize tier inside a draw. */
export interface Prize {
  id: Id;
  drawId: Id;
  iconKey: IconKey;
  titleAr: string;
  subtitleAr: string;
  /** 1/2/3 render a medal accent; undefined tiers render plain. */
  rank?: 1 | 2 | 3;
  gradientIndex: GradientIndex;
  /** How many coupons this tier draws. */
  winnersCount: number;
  sortOrder: number;
}

export type DrawState = 'draft' | 'open' | 'drawn' | 'published';

/** A prize draw run over the eligible coupons of a period. */
export interface Draw {
  id: Id;
  nameAr: string;
  year: string;
  state: DrawState;
  opensAt: IsoDate;
  closesAt: IsoDate;
  drawnAt: IsoDate | null;
  publishedAt: IsoDate | null;
  /** Only coupons issued in these governorates enter. Empty means nationwide. */
  governorateIds: Id[];
  /** Denormalised count of eligible coupons at the time of drawing. */
  entryCount: number;
}

export interface DrawWinner {
  id: Id;
  drawId: Id;
  prizeId: Id;
  couponId: Id;
  userId: Id;
  /** Privacy-masked name the app shows publicly. */
  maskedName: string;
  drawnAt: IsoDate;
  /** Whether the operator has handed the prize over. */
  claimed: boolean;
  claimedAt: IsoDate | null;
}

// ------------------------------------------------------------- app content --

/** A card on the offers screen. */
export interface Offer {
  id: Id;
  badgeAr: string;
  titleAr: string;
  /** Big text drawn on the art tile, e.g. +1 or 10%. */
  artText?: string;
  artSubAr?: string;
  iconKey?: IconKey;
  gradientIndex: GradientIndex;
  /** Renders as a double-height tile in the offers grid. */
  tall: boolean;
  /** When true the offer only shows to users in governorateIds. */
  governorateScoped: boolean;
  governorateIds: Id[];
  startsAt: IsoDate;
  endsAt: IsoDate;
  active: boolean;
  sortOrder: number;
}

export type SlideTarget =
  | 'offers'
  | 'predict'
  | 'renew'
  | 'draws'
  | 'matches'
  | 'tower'
  | 'none';

/** A slide in the home screen ad carousel. */
export interface Slide {
  id: Id;
  tagAr: string;
  titleAr: string;
  subtitleAr: string;
  gradientIndex: GradientIndex;
  /** Which screen tapping the slide opens. */
  routeTarget: SlideTarget;
  startsAt: IsoDate;
  endsAt: IsoDate;
  active: boolean;
  sortOrder: number;
}

/** A transmitter the app compass points at. */
export interface Tower {
  id: Id;
  nameAr: string;
  governorateId: Id;
  latitude: number;
  longitude: number;
  /** True for the primary tower of its area — the app marks it as strong. */
  strong: boolean;
  active: boolean;
  /** Dish alignment values support reads out to customers. */
  frequency: string;
  polarization: 'H' | 'V';
  symbolRate: string;
}

export interface VideoItem {
  id: Id;
  titleAr: string;
  titleCkb: string;
  descriptionAr: string;
  /** Display length, mm:ss. */
  duration: string;
  url: string;
  gradientIndex: GradientIndex;
  active: boolean;
  sortOrder: number;
}

export interface FaqItem {
  id: Id;
  questionAr: string;
  answerAr: string;
  questionCkb: string;
  answerCkb: string;
  categoryAr: string;
  active: boolean;
  sortOrder: number;
}

// --------------------------------------------------------- notifications ----

export type NotificationAudience =
  | 'all'
  | 'governorate'
  | 'expiring_soon'
  | 'expired'
  | 'predictors'
  | 'single_user';

export type CampaignState = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

/** A push campaign. Delivery counters are filled in by the backend. */
export interface NotificationCampaign {
  id: Id;
  titleAr: string;
  bodyAr: string;
  audience: NotificationAudience;
  /** Governorate ids or a single user id, depending on audience. */
  targetIds: Id[];
  /** Deep link opened on tap. */
  routeTarget: SlideTarget;
  state: CampaignState;
  scheduledAt: IsoDate | null;
  sentAt: IsoDate | null;
  audienceSize: number;
  deliveredCount: number;
  openedCount: number;
  createdBy: Id;
  createdAt: IsoDate;
}

// ---------------------------------------------------------------- agents ----

/** A reseller who takes cash renewals in the field. */
export interface Agent {
  id: Id;
  fullName: string;
  phone: string;
  governorateId: Id;
  area: string;
  active: boolean;
  /** Share of each renewal the agent keeps, 0..1. */
  commissionRate: number;
  /** Prepaid float, IQD. Cash renewals draw it down. */
  balance: number;
  renewalCount: number;
  createdAt: IsoDate;
}

// ------------------------------------------------------------- audit log ----

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'run' | 'send';

/** Who changed what. Written by the repository layer on every mutation. */
export interface AuditEntry {
  id: Id;
  adminId: Id;
  adminName: string;
  action: AuditAction;
  entityType: string;
  entityId: Id;
  /** Human-readable Arabic summary shown in the log table. */
  summaryAr: string;
  at: IsoDate;
}

// ---------------------------------------------------------------- settings --

/** Global switches. Everything here is read by the app at startup. */
export interface AppSettings {
  scoring: ScoringRules;
  /** Close the season and zero the leaderboard on the 1st of each month. */
  monthlyLeaderboardReset: boolean;
  /** Blocks the app with a maintenance notice. */
  maintenanceMode: boolean;
  maintenanceMessageAr: string;
  supportPhone: string;
  supportWhatsapp: string;
  /** Days before expiry when a device starts showing the warning color. */
  expiryWarningDays: number;
  /** Minimum months a renewal must buy to generate a draw coupon. */
  couponMinMonths: number;
  /** Simulated network latency of the mock layer, in milliseconds. */
  mockLatencyMs: [number, number];
}

// -------------------------------------------------------------- dashboard ---

/** Everything the dashboard shows, assembled in one call. */
export interface DashboardSummary {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  newUsersThisMonth: number;
  totalDevices: number;
  activeDevices: number;
  expiringDevices: number;
  expiredDevices: number;
  renewalsThisMonth: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  openPredictionMatches: number;
  liveMatches: number;
  predictionsThisWeek: number;
  couponsIssued: number;
  pendingDraws: number;
  /** Revenue per month for the trend chart, oldest first. */
  revenueTrend: { label: string; value: number }[];
  /** Renewal count per month, aligned with revenueTrend. */
  renewalTrend: { label: string; value: number }[];
  /** Subscriber split by governorate, largest first. */
  usersByGovernorate: { governorateId: Id; label: string; value: number }[];
  /** Renewal split by package. */
  renewalsByPackage: { label: string; value: number }[];
  /** Renewal split by payment method. */
  renewalsByMethod: { label: string; value: number }[];
}
