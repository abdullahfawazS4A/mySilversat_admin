/**
 * Domain model for the Silversat admin console.
 *
 * These types mirror what `api.silversat.ahmed-muthana.com` actually returns —
 * field for field, name for name. That is deliberate: an admin console that
 * renames the backend's concepts has to translate in both directions forever,
 * and every translation is a place for the two models to drift apart.
 *
 * Two shapes of the API leak through on purpose:
 *
 *  - **Money arrives as a string.** The columns are SQL `decimal`, so the
 *    driver hands back `"4000"` rather than `4000`. `toAmount()` converts at
 *    the edge of a render instead of the type lying about it.
 *  - **Relations arrive expanded and flat at once.** A category carries both
 *    `product` and `productId`. The expanded object is optional because list
 *    routes include it and nested payloads sometimes do not.
 */

/** Every id in the system is a UUID string. */
export type Id = string;

/** ISO-8601 timestamp, always UTC. */
export type IsoDate = string;

/** IQD amount as the API sends it — a decimal in a string. */
export type Amount = string;

/** Reads an API decimal as a number. Returns 0 for null/empty/garbage. */
export function toAmount(value: Amount | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Columns every table carries. */
export interface Entity {
  id: Id;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  /** Soft-delete marker. Rows the API returns normally have this null. */
  deletedAt?: IsoDate | null;
}

/** The app ships Arabic and Kurdish; every authored string comes in both. */
export type Locale = 'ar' | 'ku';

/** One page of a list route. */
export interface Page<T> {
  items: T[];
  total: number;
  /** One-based page index, the way the pager renders it. */
  page: number;
  pageSize: number;
}

/** What the UI asks a list route for. Repositories map it to limit/offset. */
export interface ListQuery {
  /** One-based. */
  page?: number;
  pageSize?: number;
  /**
   * Free-text filter. Only `/devices/all` and `/codes/lookup` support this
   * server-side; everywhere else the repository filters the fetched rows.
   */
  search?: string;
}

// ------------------------------------------------------ geography ----------

export interface Country extends Entity {
  /** ISO-ish short code, e.g. `iq`. */
  code: string;
  /** Dial-code key the app uses for the phone picker. */
  dialCode: string;
  name: string;
  currency: string;
}

/** A province (محافظة). Products, users, towers and ads all hang off one. */
export interface Province extends Entity {
  countryId: Id;
  country?: Country;
  code: string;
  name: string;
}

// ------------------------------------------------ silversat regions --------

/**
 * One upstream SilverSat server.
 *
 * Every region runs the same vendor software behind a different domain, so
 * only the credentials change. A product points at the region that will
 * actually activate its codes.
 *
 * `authKey`, `userId` and `password` come back only on the admin list; the
 * agent-facing list returns id/name/isActive alone, which is why they are
 * optional here.
 */
export interface SilversatRegion extends Entity {
  name: string;
  baseUrl?: string;
  authKey?: string;
  userId?: string;
  password?: string;
  appDeviceId?: string;
  isActive: boolean;
}

/** Outcome of a vendor `GetToken` health check. */
export interface RegionCheckResult {
  id: Id;
  name: string;
  ok: boolean;
  message?: string;
  latencyMs?: number;
}

// -------------------------------------------------- products & catalog -----

/** Which upstream actually activates a code bought under this product. */
export type ActivationApi = 'silvers' | 'other';

/**
 * A sellable service in one province, e.g. "Fiber 50 Mbps" in Ninawa.
 *
 * The province is what makes stock provincial: a code belongs to a category,
 * a category to a product, and a product to exactly one province.
 */
export interface Product extends Entity {
  name: string;
  displayName: string;
  imageUrl: string | null;
  activationApi: ActivationApi;
  silversatRegionId: Id | null;
  silversatRegion?: SilversatRegion | null;
  provinceId: Id;
  province?: Province;
}

/** A purchasable variant of a product — the row that carries prices. */
export interface Category extends Entity {
  productId: Id;
  product?: Product;
  name: string;
  nameKu: string;
  /** What the code costs us. */
  costPrice: Amount;
  /** List price in the app. */
  unitPrice: Amount;
  /** Price for the main tier of resellers. */
  mainPrice: Amount;
  /** Price for the sub tier of resellers. */
  subPrice: Amount;
  /** True when a code also carries a second value (e.g. a PIN). */
  hasSecondaryCode: boolean;
  /** Available codes at or below this raise a low-stock warning. Null = off. */
  lowStockThreshold: number | null;
  isDisabled: boolean;
  /** Whether the app lists it at all. */
  isDisplay: boolean;
  sortOrder: number;
  imageUrl: string | null;
}

// ------------------------------------------------------- code stock --------

export type BatchStatus = 'active' | 'disabled';

/**
 * One import of codes into a category.
 *
 * The counters are computed by the API over the batch's codes, so the stock
 * screen reads them instead of scanning `/codes`.
 */
export interface Batch extends Entity {
  categoryId: Id;
  category?: Category;
  /** Name of the file the codes arrived in — the shipment's identity. */
  fileName: string;
  status: BatchStatus;
  uploadedBy: Id | null;
  uploadedByUser?: AdminUser | null;
  notes: string | null;
  allCodeCount: number;
  codeAvailableCount: number;
  codeSoldCount: number;
  codeDisabledCount: number;
}

export type CodeStatus = 'available' | 'sold' | 'disabled';

/** One prepaid code. Selling it is what a renewal actually is. */
export interface Code extends Entity {
  batchId: Id;
  batch?: Batch;
  categoryId: Id;
  category?: Category;
  /** The code printed on the card. Unique across the system. */
  primaryValue: string;
  /** Second value, when the category declares `hasSecondaryCode`. */
  secondaryValue: string | null;
  status: CodeStatus;
  disabledAt: IsoDate | null;
  soldToAppUserId: Id | null;
  soldAt: IsoDate | null;
}

// ------------------------------------------------------- admin users -------

/** Roles the API issues in the JWT. */
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';

/** A console operator. */
export interface AdminUser extends Entity {
  email: string | null;
  phone: string;
  name: string;
  role: AdminRole;
  tokenInvalidatedAt?: IsoDate | null;
}

/** The signed-in operator plus the token the client sends. */
export interface AdminSession {
  admin: AdminUser;
  token: string;
}

/** What `/auth/login` returns — a challenge, not a session. */
export interface OtpChallenge {
  requiresOtp: boolean;
  challengeToken: string;
  /** `077****1696`, safe to print on the OTP step. */
  maskedPhone: string;
  expiresInSeconds: number;
}

// --------------------------------------------------------- app users -------

/** A customer of the service — the person who uses the mobile app. */
export interface AppUser extends Entity {
  name: string;
  email: string | null;
  imageUrl: string | null;
  phone: string;
  provinceId: Id;
  province?: Province;
  /** Running prediction score. The leaderboard is a sort of this column. */
  points: number;
  isBlocked: boolean;
  /** Set when a block invalidated the user's live JWTs. */
  tokenInvalidatedAt: IsoDate | null;
  fcmToken: string | null;
}

// ----------------------------------------------------------- devices -------

/** A receiver bound to a customer. `deviceNumber` is printed on the box. */
export interface Device extends Entity {
  appUserId: Id;
  appUser?: AppUser;
  /** Customer-chosen label. */
  name: string;
  deviceNumber: string;
}

// -------------------------------------------- leagues, teams, matches ------

/**
 * Leagues, teams and fixtures are **mirrored from API-Football**, never
 * authored here. Each carries the provider's `externalId`, so a sync updates
 * the matching row rather than duplicating it.
 *
 * What the console owns on top of the feed is the prediction decision —
 * `isOpenForPrediction` and `predictionClosesAt` — and a manual score fix.
 */
export interface League extends Entity {
  externalId: number | null;
  name: string;
  countryId: Id;
  country?: Country;
  order: number;
  /** Inactive leagues are hidden from the app entirely. */
  isActive: boolean;
}

export interface Team extends Entity {
  externalId: number | null;
  name: string;
  logoUrl: string | null;
  leagueId: Id;
  league?: League;
}

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface Match extends Entity {
  externalId: number | null;
  leagueId: Id;
  league?: League;
  homeTeamId: Id;
  homeTeam?: Team;
  awayTeamId: Id;
  awayTeam?: Team;
  matchAt: IsoDate;
  /** Picks are refused after this instant. Defaults to kickoff. */
  predictionClosesAt: IsoDate | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  /** Display clock while live. */
  currentMinute: number | null;
  /** The switch that puts this fixture on the app's predict screen. */
  isOpenForPrediction: boolean;
}

// -------------------------------------------------------- predictions ------

/** One user's score guess on one fixture. Unique per (appUserId, matchId). */
export interface Prediction extends Entity {
  appUserId: Id;
  appUser?: AppUser;
  matchId: Id;
  match?: Match;
  predictedHomeScore: number;
  predictedAwayScore: number;
  /** Null until the match is scored. Exact = 25, right outcome = 10. */
  pointsEarned: number | null;
}

/** Points the API awards. Fixed server-side; shown so the rules are visible. */
export const SCORING = { exact: 25, sameOutcome: 10 } as const;

/** How a settled prediction turned out, derived from `pointsEarned`. */
export type PredictionOutcome = 'pending' | 'exact' | 'outcome' | 'wrong';

export function outcomeOf(prediction: Prediction): PredictionOutcome {
  if (prediction.pointsEarned === null) return 'pending';
  if (prediction.pointsEarned >= SCORING.exact) return 'exact';
  if (prediction.pointsEarned > 0) return 'outcome';
  return 'wrong';
}

/** Aggregate of how one fixture's picks are distributed. */
export interface MatchPredictionStats {
  matchId: Id;
  total: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  /** Most-picked scorelines, highest first. */
  topScorelines: { home: number; away: number; count: number }[];
}

/** A leaderboard row, built by ranking app users on `points`. */
export interface LeaderboardRow {
  rank: number;
  user: AppUser;
  points: number;
  predictionCount: number;
  /** Share of scored picks that earned anything, 0..1. */
  accuracy: number;
}

// ------------------------------------------------------ notifications ------

export type NotificationTarget = 'user' | 'all' | 'province';

/** A push that was sent. The API has no drafts — sending is the creation. */
export interface NotificationRecord extends Entity {
  titleAr: string;
  titleKu: string;
  bodyAr: string;
  bodyKu: string;
  /** `admin` for a console send, otherwise a system trigger. */
  source: string;
  targetType: NotificationTarget;
  targetUserId: Id | null;
  targetUser?: AppUser | null;
  targetProvinceId: Id | null;
  targetProvince?: Province | null;
  /** Deep-link payload, e.g. `{ matchId }`. */
  dataJson: Record<string, unknown> | null;
  createdBy: Id | null;
  createdByUser?: AdminUser | null;
  successCount: number;
  failureCount: number;
}

// ----------------------------------------------------------- content -------

/** What tapping an ad does inside the app. */
export type AdAction = 'none' | 'url' | 'screen';

/** A banner in the app. Global when `provinceId` is null. */
export interface Ad extends Entity {
  title: string;
  titleKu: string;
  actionType: AdAction;
  actionValue: string | null;
  order: number;
  isActive: boolean;
  provinceId: Id | null;
  province?: Province | null;
  imageUrl: string;
}

export interface Faq extends Entity {
  question: string;
  questionKu: string;
  answer: string;
  answerKu: string;
  order: number;
  isActive: boolean;
}

export interface TutorialVideo extends Entity {
  title: string;
  titleKu: string;
  subtitle: string | null;
  subtitleKu: string | null;
  videoUrl: string;
  durationSeconds: number;
  order: number;
  isActive: boolean;
}

/** A transmitter the app's compass points at. */
export interface Tower extends Entity {
  name: string;
  nameKu: string;
  latitude: number;
  longitude: number;
  provinceId: Id;
  province?: Province;
}

/** Channels the app can open from the contact screen. */
export type ContactChannel = 'phone' | 'whatsapp' | 'facebook' | 'instagram' | 'telegram';

/** A support channel shown in the app. `type` picks the icon and the handler. */
export interface ContactLink extends Entity {
  type: ContactChannel;
  label: string;
  labelKu: string;
  subLabel: string | null;
  subLabelKu: string | null;
  /** Phone number, URL or handle, depending on `type`. */
  value: string;
  order: number;
  isActive: boolean;
}

// ------------------------------------------------- API-Football sync -------

/** The fixtures feed configuration. Secrets are never returned. */
export interface ApiFootballConfig {
  enabled: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  season: number;
  /** Leagues synced when the quota is too tight to sync them all. */
  leagueIds: number[];
  fixtureDaysBack: number;
  fixtureDaysAhead: number;
  quotaReserve: number;
  syncAllIfQuotaAllows: boolean;
  maxRequestsPerMinute: number;
}

/** Account and quota state, plus what the next sync would cover. */
export interface ApiFootballStatus {
  account?: Record<string, unknown>;
  requests?: { current?: number; limit_day?: number };
  willSyncAllLeagues?: boolean;
  [key: string]: unknown;
}

/** What one sync call reported back. Shapes vary per route, so this is loose. */
export interface SyncResult {
  created?: number;
  updated?: number;
  skipped?: number;
  total?: number;
  [key: string]: unknown;
}

// ------------------------------------------------ silversat operations -----

/** `0` renews an existing subscription, `1` activates a new device. */
export type RechargeType = 0 | 1;

/** Vendor answers are pass-through — the shape is the vendor's, not ours. */
export type VendorResponse = Record<string, unknown>;

// --------------------------------------------------------- dashboard -------

/** Everything the dashboard shows, assembled from several list routes. */
export interface DashboardSummary {
  totalUsers: number;
  blockedUsers: number;
  newUsersThisMonth: number;
  totalDevices: number;
  totalProducts: number;
  totalCategories: number;
  codesAvailable: number;
  codesSold: number;
  codesDisabled: number;
  /** Value of sold codes at list price, IQD. */
  revenueAllTime: number;
  revenueThisMonth: number;
  soldThisMonth: number;
  liveMatches: number;
  openForPrediction: number;
  totalPredictions: number;
  pendingScoring: number;
  notificationsSent: number;
  activeRegions: number;
  totalRegions: number;
  /** Sold codes per month for the trend chart, oldest first. */
  salesTrend: { label: string; value: number }[];
  revenueTrend: { label: string; value: number }[];
  /** Subscriber split by province, largest first. */
  usersByProvince: { label: string; value: number }[];
  /** Sold-code split by category. */
  salesByCategory: { label: string; value: number }[];
  /** Available stock per category, lowest first — the restock queue. */
  stockByCategory: { label: string; value: number; threshold: number | null }[];
}
