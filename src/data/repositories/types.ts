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
  IsoDate,
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
  PrizeDraw,
  Product,
  Province,
  ProvinceOverview,
  RechargeType,
  RegionCheckResult,
  ResetChallenge,
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
  /**
   * Step 1 of a reset — sends a code over WhatsApp, not SMS.
   *
   * Answers the same way for a number that has no account, so a caller cannot
   * use it to find out which numbers are admins. The screen has to word its
   * confirmation accordingly.
   */
  forgotPassword(phone: string): Promise<ResetChallenge>;
  /** Step 2 — trades the code for a new password. Does not sign anyone in. */
  resetPassword(challengeToken: string, code: string, newPassword: string): Promise<void>;
  /** Sends a fresh reset code. A separate route from the login one. */
  resendResetOtp(challengeToken: string): Promise<void>;
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
  /**
   * Every province with its server, its catalogue and its stock counted.
   *
   * Composed from five list routes, so it is one deliberate read rather than
   * something to call per row. The province screen loads it once.
   */
  overview(): Promise<ProvinceOverview[]>;
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
  /**
   * The province the API ties this server to.
   *
   * Explicitly `null` rather than absent when it is tied to none, because an
   * edit that drops the key leaves the old binding standing — clearing one has
   * to be a value the request actually carries.
   */
  provinceId?: Id | null;
}

export interface RegionsRepository
  extends CrudRepository<SilversatRegion, RegionInput> {
  /** Pings one region through the vendor's GetToken. */
  check(id: Id): Promise<RegionCheckResult>;
  /** Pings every region at once — the health board's refresh button. */
  checkAll(): Promise<RegionCheckResult[]>;
}

// ------------------------------------------------------------ catalog ------

/**
 * A product names its server and nothing else. The province is the server's,
 * and the API refuses a `provinceId` here outright.
 */
export interface ProductInput {
  name: string;
  displayName: string;
  silversatRegionId: Id;
  activationApi?: 'silvers' | 'other';
  image?: string;
}

export interface CategoryInput {
  productId: Id;
  name: string;
  nameKu: string;
  costPrice: number;
  unitPrice: number;
  lowStockThreshold?: number | null;
  isDisplay?: boolean;
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

/**
 * How a codes list is narrowed. All three are server-side.
 *
 * There is no province here on purpose: a code has no province column — it
 * belongs to a category, the category to a product, and only the product names
 * one. The stock screen walks that chain as navigation rather than flattening
 * it into a filter that would have to read the whole table to answer.
 */
export interface CodeFilter {
  status?: CodeStatus;
  categoryId?: Id;
  batchId?: Id;
}

/** How a batches list is narrowed. All server-side. */
export interface BatchFilter {
  categoryId?: Id;
  status?: 'active' | 'disabled';
  fileName?: string;
}

export interface StockRepository {
  batches: CrudRepository<Batch, BatchInput, Partial<BatchInput>, BatchFilter> & {
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
  /** The server the subscriber is on. Their province follows from it. */
  silversatRegionId: Id;
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
  /** Arabic display name. `null` clears the override and shows `name` again. */
  nameAr?: string | null;
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
  /** Arabic display name. `null` clears the override and shows `name` again. */
  nameAr?: string | null;
  leagueId: Id;
  /**
   * The crest itself, not a link to it.
   *
   * `/teams` takes the file on the same request that saves the club — the
   * route is multipart and its `logo` is a binary part, the same shape `/ads`
   * uses for a banner. The console used to send a URL string here, which the
   * server had nowhere to put.
   *
   * Null means "no crest on this request", which on an edit leaves the one
   * already stored alone. Unlike a banner, a club may genuinely have none: the
   * provider ships most crests, and a hand-added club can go without.
   */
  logo: File | null;
  /**
   * The crest already stored, for the form to show while editing.
   *
   * Display only, and never sent. It rides in the draft rather than being read
   * off the row because the form and the validator are only ever handed the
   * draft.
   */
  logoUrl: string;
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
     * Corrects a score by hand.
     *
     * Only the scoreline the app shows. The server has already paid points out
     * on the number this replaces, and it never revisits a scored pick.
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
  /**
   * Scores every finished match that still has unscored picks.
   *
   * A catch-up, not the routine: the server scores a fixture by itself when it
   * finishes. This is what clears the backlog the dashboard counts when that
   * did not happen.
   */
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
  /**
   * The picture itself, not a link to it.
   *
   * `/ads` takes the file on the same request that saves the banner and has no
   * field for an image URL at all — a JSON create is refused outright with
   * "Ad image is required" — so the file travels with the rest of the form.
   * Null on an edit means "keep the picture that is already there".
   */
  image: File | null;
  /**
   * The picture already stored, for the form to show while editing.
   *
   * Display only, and never sent: the API has no field to send it to. It rides
   * in the draft rather than being read off the row because the form and the
   * validator are only ever handed the draft.
   */
  imageUrl: string;
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

export interface PrizeDrawInput {
  titleAr: string;
  titleKu: string;
  bodyAr: string;
  bodyKu: string;
  /** ISO-8601, UTC. The app counts down to it. */
  drawAt: IsoDate;
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
  /**
   * Prize draws.
   *
   * Here rather than in a bundle of their own because that is all the API
   * gives them: bilingual text, a date and a switch, authored the same way a
   * banner or an FAQ is. Running a draw and naming a winner have no routes.
   */
  prizeDraws: CrudRepository<PrizeDraw, PrizeDrawInput>;
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
