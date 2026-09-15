/**
 * Repository interfaces — the seam between the UI and the backend.
 *
 * The one architectural rule of this project: **the UI never talks to `fetch`
 * directly, it goes through these interfaces.** Screens take repositories from
 * React context, so a route that moves, a header that changes or a fake in a
 * test is a change here and nowhere else.
 *
 * Most resources are plain REST collections, so they share `CrudRepository`
 * rather than restating six identical method signatures each time. Anything
 * the API does beyond CRUD — sending a push, health-checking a region, scoring
 * a match — is spelled out on the specific interface, because those are the
 * operations a reader actually needs to find.
 */

import type {
  Ad,
  AdminSession,
  AdminUser,
  ApiFootballConfig,
  ApiFootballStatus,
  AppUser,
  Batch,
  Category,
  Code,
  CodeStatus,
  ContactChannel,
  ContactLink,
  Country,
  DashboardSummary,
  Device,
  Faq,
  Id,
  LeaderboardRow,
  League,
  ListQuery,
  Match,
  MatchPredictionStats,
  MatchStatus,
  NotificationTarget,
  OtpChallenge,
  Page,
  Prediction,
  Product,
  Province,
  RechargeType,
  RegionCheckResult,
  SilversatRegion,
  SyncResult,
  Team,
  Tower,
  TutorialVideo,
  VendorResponse,
} from '@/types';

// ------------------------------------------------------------- generic -----

/**
 * The six operations every REST collection here supports.
 *
 * `F` is the resource's own filter object — `/codes` takes a status, `/teams`
 * takes a league — merged into the list query so call sites pass one object.
 */
export interface CrudRepository<T, C, U = Partial<C>, F = Record<string, never>> {
  list(query?: ListQuery & F): Promise<Page<T>>;
  /** Every row, paged through internally. For pickers and dashboards. */
  all(filter?: F): Promise<T[]>;
  get(id: Id): Promise<T>;
  create(input: C): Promise<T>;
  update(id: Id, input: U): Promise<T>;
  remove(id: Id): Promise<void>;
}

// ---------------------------------------------------------------- auth -----

/**
 * Admin sign-in is two steps: password buys an OTP challenge, the SMS code
 * buys the JWT. `signIn` therefore cannot return a session, and the login
 * screen has to render both steps.
 */
export interface AuthRepository {
  /** Restores a session from local storage, or null when signed out. */
  restore(): Promise<AdminSession | null>;
  /** Step 1 — validates the password and sends an SMS code. */
  signIn(phone: string, password: string): Promise<OtpChallenge>;
  /** Step 2 — exchanges the code for a token and stores it. */
  verifyOtp(challengeToken: string, code: string): Promise<AdminSession>;
  /** Sends a fresh code for a challenge that has not expired. */
  resendOtp(challengeToken: string): Promise<void>;
  signOut(): Promise<void>;
  /** Re-reads the operator's own profile from the API. */
  me(): Promise<AdminUser>;
  updateProfile(input: { name?: string; email?: string; phone?: string }): Promise<AdminUser>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

// ----------------------------------------------------------- geography -----

export interface CountryInput {
  code: string;
  dialCode: string;
  name: string;
  currency: string;
}

export interface ProvinceInput {
  countryId: Id;
  code: string;
  name: string;
}

export interface GeoRepository {
  countries: CrudRepository<Country, CountryInput>;
  provinces: CrudRepository<Province, ProvinceInput, Partial<ProvinceInput>, { countryId?: Id }>;
}

// ---------------------------------------------------- silversat regions ----

export interface RegionInput {
  name: string;
  baseUrl: string;
  authKey: string;
  userId: string;
  password: string;
  appDeviceId?: string;
  isActive?: boolean;
}

export interface RegionsRepository
  extends CrudRepository<SilversatRegion, RegionInput> {
  /** Pings one region through the vendor's GetToken. */
  check(id: Id): Promise<RegionCheckResult>;
  /** Pings every region at once — the health board's refresh button. */
  checkAll(): Promise<RegionCheckResult[]>;
}

// ------------------------------------------------------------ catalog ------

export interface ProductInput {
  name: string;
  displayName: string;
  provinceId: Id;
  activationApi?: 'silvers' | 'other';
  silversatRegionId?: Id | null;
  image?: string;
}

export interface CategoryInput {
  productId: Id;
  name: string;
  nameKu: string;
  costPrice: number;
  unitPrice: number;
  mainPrice: number;
  subPrice: number;
  hasSecondaryCode?: boolean;
  lowStockThreshold?: number | null;
  isDisabled?: boolean;
  isDisplay?: boolean;
  sortOrder?: number;
  image?: string;
}

export interface CatalogRepository {
  products: CrudRepository<Product, ProductInput> & {
    /** Creates a product and its price tiers in one call. */
    createWithCategories(
      input: ProductInput & { categories: Omit<CategoryInput, 'productId'>[] },
    ): Promise<Product>;
  };
  categories: CrudRepository<Category, CategoryInput, Partial<CategoryInput>, { productId?: Id }>;
}

// -------------------------------------------------------------- stock ------

export interface BatchInput {
  categoryId: Id;
  fileName: string;
  status?: 'active' | 'disabled';
  notes?: string | null;
}

export interface CodeInput {
  batchId: Id;
  categoryId: Id;
  primaryValue: string;
  secondaryValue?: string | null;
  status?: CodeStatus;
}

export interface CodeFilter {
  status?: CodeStatus;
  categoryId?: Id;
  batchId?: Id;
}

export interface StockRepository {
  batches: CrudRepository<
    Batch,
    BatchInput,
    Partial<BatchInput>,
    { categoryId?: Id; status?: 'active' | 'disabled'; fileName?: string }
  > & {
    /**
     * Files a shipment: creates the batch and all of its codes in one request.
     * The API takes `uploadedBy` from the JWT, so the console never sends it.
     */
    createWithCodes(input: {
      categoryId: Id;
      fileName: string;
      status?: 'active' | 'disabled';
      notes?: string | null;
      codes: { primaryValue: string; secondaryValue?: string | null }[];
    }): Promise<Batch>;
  };
  codes: CrudRepository<Code, CodeInput, Partial<CodeInput>, CodeFilter>;
  /** Finds codes by id, primary or secondary value — the support lookup. */
  lookup(q: string): Promise<Code[]>;
}

// ---------------------------------------------------------- app users ------

export interface AppUserInput {
  name: string;
  password?: string;
  phone: string;
  provinceId: Id;
  email?: string | null;
  image?: string;
}

/**
 * What the users list can be narrowed by.
 *
 * Neither filter exists server-side, so the repository applies both over the
 * fetched rows — the same compromise `search` already makes on this route.
 */
export interface AppUserFilter {
  provinceId?: Id;
  isBlocked?: boolean;
}

/** Everything the user detail screen needs, gathered in one call. */
export interface AppUserDetail {
  user: AppUser;
  devices: Device[];
  predictions: Prediction[];
  /** Codes this user has bought — their purchase history. */
  purchases: Code[];
}

export interface AppUsersRepository
  extends CrudRepository<AppUser, AppUserInput, Partial<AppUserInput>, AppUserFilter> {
  detail(id: Id): Promise<AppUserDetail>;
  /** Blocks and invalidates the user's live sessions immediately. */
  block(id: Id): Promise<AppUser>;
  unblock(id: Id): Promise<AppUser>;
  /** App users ranked by points. Built from the user list, newest first. */
  leaderboard(query?: ListQuery & { provinceId?: Id }): Promise<Page<LeaderboardRow>>;
}

// ------------------------------------------------------------ devices ------

export interface DeviceInput {
  name: string;
  deviceNumber: string;
}

export interface DeviceFilter {
  appUserId?: Id;
  provinceId?: Id;
  name?: string;
  deviceNumber?: string;
}

/** Admin device routes go through `/devices/all`; `/devices` is app-user only. */
export type DevicesRepository = CrudRepository<Device, DeviceInput, Partial<DeviceInput>, DeviceFilter>;

// ------------------------------------------- leagues, teams and matches ----

export interface LeagueInput {
  name: string;
  countryId: Id;
  order?: number;
  isActive?: boolean;
}

/**
 * How the leagues list is narrowed.
 *
 * `countryId` is server-side. `isActive` is not — `/leagues` accepts the
 * parameter and ignores it, answering 1,237 rows either way — so the
 * repository applies it over the fetched rows.
 */
export interface LeagueFilter {
  countryId?: Id;
  isActive?: boolean;
}

/**
 * The leagues collection, plus the one decision the console owns over the feed.
 *
 * `isActive` is what decides whether a league reaches the app at all, and it
 * is set in bulk far more often than one at a time: two of the twelve hundred
 * mirrored leagues are switched on, so the operator is always turning a
 * handful on or a long tail off.
 */
export type LeaguesRepository = CrudRepository<
  League,
  LeagueInput,
  Partial<LeagueInput>,
  LeagueFilter
> & {
  setActive(id: Id, active: boolean): Promise<League>;
  bulkSetActive(ids: Id[], active: boolean): Promise<void>;
};

export interface TeamInput {
  name: string;
  leagueId: Id;
  logo?: string;
}

export interface MatchInput {
  leagueId: Id;
  homeTeamId: Id;
  awayTeamId: Id;
  matchAt: string;
  predictionClosesAt?: string | null;
  status?: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  currentMinute?: number | null;
  isOpenForPrediction?: boolean;
}

/**
 * Which stretch of the fixture list a screen is looking at.
 *
 * The feed holds every fixture it has ever mirrored, so "all" is nine
 * thousand rows that begin in the past. `upcoming` is the working view — the
 * fixtures an operator can still open for predictions.
 */
export type MatchWindow = 'upcoming' | 'past' | 'all';

/**
 * How the fixtures table is narrowed.
 *
 * `leagueId` and `status` are server-side. `isOpenForPrediction` is not, so
 * the repository applies it over the fetched rows, and `window` is not either
 * — the API has no date parameter, so the repository turns it into an offset.
 */
export interface MatchFilter {
  leagueId?: Id;
  /**
   * Restricts the list to a set of leagues rather than one or all of them.
   *
   * `/matches` takes a single `leagueId`, so this cannot be a query parameter:
   * the repository reads each league and merges the rows. That is the whole
   * reason it is a list of ids and not an `isActive` flag — the cost is one
   * read per league, so it is meant for the handful the app shows, not the
   * twelve hundred the feed mirrors. An empty list means no fixtures at all,
   * which is not the same as no filter.
   */
  leagueIds?: Id[];
  status?: MatchStatus;
  isOpenForPrediction?: boolean;
  window?: MatchWindow;
}

export interface MatchesRepository {
  leagues: LeaguesRepository;
  teams: CrudRepository<Team, TeamInput, Partial<TeamInput>, { leagueId?: Id }>;
  matches: CrudRepository<Match, MatchInput, Partial<MatchInput>, MatchFilter> & {
    /**
     * Resolves fixture ids to fixtures a table can name, filling in clubs the
     * fixture did not carry. `seeds` are fixtures the caller already holds,
     * however incomplete, so a bare embedded one is completed rather than
     * re-read. Memoised briefly; an id that cannot be read is simply absent.
     */
    byIds(ids: Id[], seeds?: (Match | undefined)[]): Promise<Map<Id, Match>>;
    /** The core operator action — put a fixture on the predict screen. */
    setOpenForPrediction(id: Id, open: boolean, closesAt?: string | null): Promise<Match>;
    /** Bulk version, for the multi-select toolbar. */
    bulkSetOpenForPrediction(ids: Id[], open: boolean): Promise<void>;
    /**
     * Corrects a score by hand. Scoring pays out on this number, so a fix has
     * to land before `scoreMatch` runs.
     */
    setScore(
      id: Id,
      homeScore: number,
      awayScore: number,
      status: Extract<MatchStatus, 'live' | 'finished'>,
      currentMinute?: number | null,
    ): Promise<Match>;
  };
}

// -------------------------------------------------------- predictions ------

export interface PredictionsRepository {
  list(query?: ListQuery & { appUserId?: Id; matchId?: Id }): Promise<Page<Prediction>>;
  remove(id: Id): Promise<void>;
  /** How one fixture's picks are distributed, for the sentiment bar. */
  stats(matchId: Id): Promise<MatchPredictionStats>;
  /** Awards points for one finished match. Only unscored picks are touched. */
  scoreMatch(matchId: Id): Promise<{ scored: number }>;
  /** Scores every finished match that still has unscored picks. */
  scorePending(): Promise<{ scored: number }>;
}

// ------------------------------------------------------ fixtures sync ------

/**
 * The API-Football mirror. Leagues, teams and fixtures enter the system only
 * through these calls — there is no manual "add fixture" anywhere.
 */
export interface SyncRepository {
  config(): Promise<ApiFootballConfig>;
  status(): Promise<ApiFootballStatus>;
  syncLeagues(): Promise<SyncResult>;
  syncTeams(): Promise<SyncResult>;
  syncFixtures(): Promise<SyncResult>;
  syncLive(): Promise<SyncResult>;
}

// ------------------------------------------------------ notifications ------

export interface NotificationInput {
  titleAr: string;
  titleKu: string;
  bodyAr: string;
  bodyKu: string;
  targetType: NotificationTarget;
  appUserId?: Id;
  provinceId?: Id;
  data?: Record<string, unknown>;
}

/** The API has no drafts — sending is what creates the record. */
export interface NotificationsRepository {
  list(query?: ListQuery): Promise<Page<import('@/types').NotificationRecord>>;
  get(id: Id): Promise<import('@/types').NotificationRecord>;
  send(input: NotificationInput): Promise<import('@/types').NotificationRecord>;
  /** How many app users a target currently covers, for the confirm step. */
  audienceSize(targetType: NotificationTarget, provinceId?: Id): Promise<number>;
}

// ----------------------------------------------------------- content -------

export interface AdInput {
  title: string;
  titleKu: string;
  image: string;
  actionType?: 'none' | 'url' | 'screen';
  actionValue?: string | null;
  order?: number;
  isActive?: boolean;
  provinceId?: Id | null;
}

export interface FaqInput {
  question: string;
  questionKu: string;
  answer: string;
  answerKu: string;
  order?: number;
  isActive?: boolean;
}

export interface VideoInput {
  title: string;
  titleKu: string;
  videoUrl: string;
  durationSeconds: number;
  subtitle?: string | null;
  subtitleKu?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface TowerInput {
  name: string;
  nameKu: string;
  latitude: number;
  longitude: number;
  provinceId: Id;
}

export interface ContactLinkInput {
  type: ContactChannel;
  label: string;
  labelKu: string;
  value: string;
  subLabel?: string | null;
  subLabelKu?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface ContentRepository {
  ads: CrudRepository<Ad, AdInput>;
  faqs: CrudRepository<Faq, FaqInput>;
  videos: CrudRepository<TutorialVideo, VideoInput>;
  towers: CrudRepository<Tower, TowerInput, Partial<TowerInput>, { provinceId?: Id }>;
  contactLinks: CrudRepository<ContactLink, ContactLinkInput>;
}

// ------------------------------------------- silversat vendor operations ---

/**
 * Direct calls into the vendor system. These are support tools: they reach
 * past our database into the box itself, so every one of them is a live
 * action with no local record.
 */
export interface SilversatRepository {
  /** Active regions, as the vendor tools' picker sees them. */
  regions(): Promise<SilversatRegion[]>;
  /** Validates a code against a region before anyone burns it. */
  checkCode(regionId: Id, code: string): Promise<VendorResponse>;
  /** Looks a subscription up by receiver number, within one region. */
  subscription(regionId: Id, deviceNumber: string): Promise<VendorResponse>;
  /** Re-authorises a receiver so it refreshes its entitlements. */
  sendSignal(regionId: Id, deviceNumber: string): Promise<VendorResponse>;
  /**
   * Renews (0) or activates (1). The region comes from the code's product, so
   * this call takes no region of its own — and the code must already be sold
   * to the app user who owns the receiver.
   */
  recharge(deviceNumber: string, code: string, type: RechargeType): Promise<VendorResponse>;
}

// --------------------------------------------------------- dashboard -------

export interface DashboardRepository {
  summary(): Promise<DashboardSummary>;
}

// ------------------------------------------------------------ the bundle ---

/** The full set, injected into React through one context. */
export interface Repositories {
  auth: AuthRepository;
  geo: GeoRepository;
  regions: RegionsRepository;
  catalog: CatalogRepository;
  stock: StockRepository;
  appUsers: AppUsersRepository;
  devices: DevicesRepository;
  matches: MatchesRepository;
  predictions: PredictionsRepository;
  sync: SyncRepository;
  notifications: NotificationsRepository;
  content: ContentRepository;
  silversat: SilversatRepository;
  dashboard: DashboardRepository;
}
