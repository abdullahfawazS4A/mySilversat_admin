/**
 * Repository interfaces — the seam between the UI and any backend.
 *
 * The single architectural rule of this project, inherited from the customer
 * app: **the UI never talks to data directly, it goes through these
 * interfaces.** Swapping the mock for a real HTTP API means writing new classes
 * that implement these and changing one wiring file
 * (`data/repositories/index.ts`). No screen, no component and no hook changes.
 *
 * Consequences that are deliberate:
 *  - every method is async, even the ones the mock answers instantly;
 *  - inputs are plain objects, never UI state;
 *  - list methods take a query object so paging/sorting can move server-side
 *    later without touching call sites.
 */

import type {
  Agent,
  AdminSession,
  ApiCheckResult,
  ApiConnection,
  AppSettings,
  AppUser,
  AuditEntry,
  CardStatus,
  Coupon,
  DashboardSummary,
  Device,
  Draw,
  DrawWinner,
  FaqItem,
  Governorate,
  Id,
  League,
  ListQuery,
  Match,
  MatchPredictionStats,
  MatchState,
  MatchSyncResult,
  MatchView,
  NotificationCampaign,
  Offer,
  Page,
  PointsEntry,
  PredictionView,
  Prize,
  Renewal,
  Season,
  Slide,
  StockCard,
  StockLevel,
  SubscriptionPackage,
  Team,
  Tower,
  VideoItem,
  LeaderboardRow,
} from '@/types';

// ------------------------------------------------------------------- auth ---

export interface AuthRepository {
  /** Restores a session from local storage, or null when signed out. */
  restore(): Promise<AdminSession | null>;
  /** Signs in. Throws with an Arabic message when credentials are wrong. */
  signIn(username: string, password: string): Promise<AdminSession>;
  signOut(): Promise<void>;
}

// ---------------------------------------------------------------- catalog ---

/** Read-mostly reference data every other screen joins against. */
export interface CatalogRepository {
  governorates(): Promise<Governorate[]>;
  saveGovernorate(governorate: Governorate): Promise<Governorate>;

  /**
   * Leagues and teams are mirrored from the fixtures feed, so there is no
   * save or delete here — `MatchesRepository.sync()` is the only writer.
   * The one local decision is whether a league is shown in the app at all.
   */
  leagues(): Promise<League[]>;
  setLeagueActive(id: Id, active: boolean): Promise<League>;

  teams(): Promise<Team[]>;

  packages(): Promise<SubscriptionPackage[]>;
  savePackage(pkg: Omit<SubscriptionPackage, 'id'> & { id?: Id }): Promise<SubscriptionPackage>;
  deletePackage(id: Id): Promise<void>;
}

// ------------------------------------------------------------- card stock ---

export interface StockCardListQuery extends ListQuery {
  governorateId?: Id;
  months?: number;
  status?: CardStatus | 'all';
  batchRef?: string;
}

/** A card joined with the names the stock table shows. */
export interface StockCardRow extends StockCard {
  governorateName: string;
  /** Device the card was burnt on, when it has been used. */
  deviceNumber?: string;
}

export interface StockRepository {
  /** Availability per governorate per card length, for the stock grid. */
  levels(): Promise<StockLevel[]>;
  cards(query: StockCardListQuery): Promise<Page<StockCardRow>>;

  /**
   * Files a shipment of cards into one governorate's stock. Codes already in
   * the system are reported back rather than silently duplicated.
   */
  addBatch(input: {
    governorateId: Id;
    months: number;
    codes: string[];
    batchRef: string;
  }): Promise<{ added: number; duplicates: string[] }>;

  /**
   * The card a renewal would burn next, FIFO by arrival — null when that
   * governorate has run out of that length. Read by the renew dialog so the
   * operator sees the code before committing.
   */
  nextAvailable(governorateId: Id, months: number): Promise<StockCard | null>;

  /** Takes a card out of circulation without using it (damaged, leaked). */
  voidCard(id: Id, reasonAr: string): Promise<StockCard>;
  /** Moves unused cards to another governorate's stock. */
  transfer(ids: Id[], toGovernorateId: Id): Promise<number>;
  /** Deletes a card filed by mistake. Refused once it has been used. */
  remove(id: Id): Promise<void>;
}

// -------------------------------------------------------- governorate APIs --

export interface ApiRepository {
  list(): Promise<ApiConnection[]>;
  save(
    connection: Omit<ApiConnection, 'id' | 'createdAt' | 'lastCheckAt' | 'lastCheckOk'> & {
      id?: Id;
    },
  ): Promise<ApiConnection>;
  remove(id: Id): Promise<void>;
  /**
   * Points these governorates at this connection. A governorate answers to one
   * connection at a time, so any previous link is dropped.
   */
  setGovernorates(id: Id, governorateIds: Id[]): Promise<ApiConnection>;
  /** Pings the connection and records the outcome on it. */
  test(id: Id): Promise<ApiCheckResult>;
}

// ------------------------------------------------------------------ users ---

export interface UserListQuery extends ListQuery {
  governorateId?: Id;
  status?: AppUser['status'] | 'all';
  /** Filters to users who own at least one device in this state. */
  deviceStatus?: Device['status'] | 'all';
  minPoints?: number;
}

/** Everything the user detail screen needs, in one round trip. */
export interface UserDetail {
  user: AppUser;
  devices: Device[];
  renewals: Renewal[];
  coupons: Coupon[];
  predictions: PredictionView[];
  pointsLedger: PointsEntry[];
}

export interface UsersRepository {
  list(query: UserListQuery): Promise<Page<AppUser>>;
  detail(id: Id): Promise<UserDetail>;
  save(user: AppUser): Promise<AppUser>;
  setStatus(id: Id, status: AppUser['status'], reason?: string): Promise<AppUser>;
  /** Appends a manual ledger entry and recomputes the cached total. */
  adjustPoints(id: Id, delta: number, reasonAr: string): Promise<AppUser>;
  saveNote(id: Id, notes: string): Promise<AppUser>;
}

// ---------------------------------------------------------------- devices ---

export interface DeviceListQuery extends ListQuery {
  status?: Device['status'] | 'all';
  governorateId?: Id;
  userId?: Id;
}

/** A device joined with its owner, for the global device table. */
export interface DeviceRow extends Device {
  ownerName: string;
  ownerPhone: string;
  governorateId: Id;
}

export interface DevicesRepository {
  list(query: DeviceListQuery): Promise<Page<DeviceRow>>;
  /** One device joined with its owner. Throws when the id is unknown. */
  get(id: Id): Promise<DeviceRow>;
  save(device: Device): Promise<Device>;
  create(input: Omit<Device, 'id' | 'createdAt' | 'status'>): Promise<Device>;
  remove(id: Id): Promise<void>;
  setSuspended(id: Id, suspended: boolean, reason?: string): Promise<Device>;
  /** Moves a device to another account, keeping its renewal history. */
  transfer(id: Id, toUserId: Id): Promise<Device>;
  /** Extends expiry by whole months without taking payment. */
  grantMonths(id: Id, months: number, reasonAr: string): Promise<Device>;
}

// --------------------------------------------------------------- renewals ---

export interface RenewalListQuery extends ListQuery {
  method?: Renewal['method'] | 'all';
  status?: Renewal['status'] | 'all';
  governorateId?: Id;
  agentId?: Id;
  from?: string;
  to?: string;
}

/** A renewal joined with the names the table shows. */
export interface RenewalRow extends Renewal {
  userName: string;
  userPhone: string;
  deviceNumber: string;
  governorateId: Id;
  agentName?: string;
  /** Code of the card this renewal burnt, when it consumed one. */
  cardCode?: string;
}

export interface RenewalsRepository {
  list(query: RenewalListQuery): Promise<Page<RenewalRow>>;
  /**
   * Records a renewal: burns a stock card, extends the device expiry and
   * issues a coupon.
   *
   * The card comes from the subscriber's **own governorate**, FIFO by arrival,
   * and must match the package length — an empty stock refuses the renewal
   * rather than extending a subscription nothing paid for. A free grant is the
   * one method that skips the stock entirely.
   */
  create(input: {
    deviceId: Id;
    packageId: Id;
    method: Renewal['method'];
    agentId?: Id;
    note?: string;
  }): Promise<Renewal>;
  refund(id: Id, reasonAr: string): Promise<Renewal>;
}

// -------------------------------------------------------- matches & picks ---

export interface MatchListQuery extends ListQuery {
  leagueId?: Id;
  state?: Match['state'] | 'all';
  /** 'open' = accepting picks now, 'closed' = switched off. */
  predictFilter?: 'all' | 'open' | 'closed';
  from?: string;
  to?: string;
}

export interface MatchesRepository {
  list(query: MatchListQuery): Promise<Page<MatchView>>;
  get(id: Id): Promise<MatchView>;

  /**
   * Pulls leagues, teams and fixtures from the upstream feed.
   *
   * This is the **only** way a fixture enters the console — there is no
   * create and no delete. Rows are matched on the provider's `externalId`, so
   * a second sync updates rather than duplicates, and the console's own
   * prediction fields survive untouched.
   */
  sync(): Promise<MatchSyncResult>;

  /**
   * The core operator action: choose which fixtures accept predictions.
   * `closeAt` defaults to kickoff when omitted.
   */
  setOpenForPredict(id: Id, open: boolean, closeAt?: string | null): Promise<Match>;
  /** Bulk version of setOpenForPredict, for the multi-select toolbar. */
  bulkSetOpenForPredict(ids: Id[], open: boolean): Promise<void>;
  setFeatured(id: Id, featured: boolean): Promise<Match>;

  /**
   * Corrects a score by hand when the feed is wrong or lagging. Settlement
   * pays out on this number, so the override is deliberate: the fixture is
   * flagged and later syncs stop overwriting its score.
   */
  overrideScore(
    id: Id,
    homeScore: number,
    awayScore: number,
    state: Extract<MatchState, 'live' | 'finished'>,
    minute?: string,
  ): Promise<Match>;
  /** Drops a manual correction and lets the feed own the score again. */
  clearScoreOverride(id: Id): Promise<Match>;

  /**
   * Awards points for every prediction on a finished match, using the current
   * scoring rules. Idempotent: a second call on a settled match is refused.
   */
  settle(id: Id): Promise<{ settled: number; pointsAwarded: number }>;
  /** Reverts a settlement, removing its ledger entries. */
  unsettle(id: Id): Promise<void>;

  predictions(matchId: Id, query: ListQuery): Promise<Page<PredictionView>>;
  predictionStats(matchId: Id): Promise<MatchPredictionStats>;
  /** Removes a single pick, e.g. a proven-abusive entry. */
  deletePrediction(predictionId: Id): Promise<void>;
}

// ------------------------------------------------- leaderboard and seasons --

export interface LeaderboardRepository {
  seasons(): Promise<Season[]>;
  activeSeason(): Promise<Season>;
  leaderboard(seasonId: Id, query: ListQuery & { governorateId?: Id }): Promise<Page<LeaderboardRow>>;
  /** Closes the active season, freezes its board and opens the next one. */
  closeSeason(seasonId: Id, nextNameAr: string): Promise<Season>;
  /** Zeroes every balance in the active season. Destructive; audited. */
  resetPoints(seasonId: Id, reasonAr: string): Promise<void>;
}

// ------------------------------------------------ coupons, draws & prizes ---

export interface CouponListQuery extends ListQuery {
  year?: string;
  active?: boolean | 'all';
  governorateId?: Id;
}

/** A coupon joined with its owner, for the coupon table. */
export interface CouponRow extends Coupon {
  userName: string;
  userPhone: string;
  governorateId: Id;
}

export interface DrawsRepository {
  coupons(query: CouponListQuery): Promise<Page<CouponRow>>;

  draws(): Promise<Draw[]>;
  saveDraw(draw: Omit<Draw, 'id' | 'entryCount'> & { id?: Id }): Promise<Draw>;
  deleteDraw(id: Id): Promise<void>;

  prizes(drawId: Id): Promise<Prize[]>;
  savePrize(prize: Omit<Prize, 'id'> & { id?: Id }): Promise<Prize>;
  deletePrize(id: Id): Promise<void>;

  /** How many coupons would enter this draw right now. */
  eligibleCount(drawId: Id): Promise<number>;
  /** Picks winners at random across every prize tier. Refused if already run. */
  runDraw(drawId: Id): Promise<DrawWinner[]>;
  winners(drawId: Id): Promise<(DrawWinner & { userName: string; prizeTitle: string; couponCode: string })[]>;
  /** Makes the winner list visible inside the customer app. */
  publishDraw(drawId: Id): Promise<Draw>;
  setWinnerClaimed(winnerId: Id, claimed: boolean): Promise<DrawWinner>;
}

// ---------------------------------------------------------------- content ---

/** Everything shown inside the app that marketing edits. */
export interface ContentRepository {
  offers(): Promise<Offer[]>;
  saveOffer(offer: Omit<Offer, 'id'> & { id?: Id }): Promise<Offer>;
  deleteOffer(id: Id): Promise<void>;

  slides(): Promise<Slide[]>;
  saveSlide(slide: Omit<Slide, 'id'> & { id?: Id }): Promise<Slide>;
  deleteSlide(id: Id): Promise<void>;

  towers(): Promise<Tower[]>;
  saveTower(tower: Omit<Tower, 'id'> & { id?: Id }): Promise<Tower>;
  deleteTower(id: Id): Promise<void>;

  videos(): Promise<VideoItem[]>;
  saveVideo(video: Omit<VideoItem, 'id'> & { id?: Id }): Promise<VideoItem>;
  deleteVideo(id: Id): Promise<void>;

  faq(): Promise<FaqItem[]>;
  saveFaq(item: Omit<FaqItem, 'id'> & { id?: Id }): Promise<FaqItem>;
  deleteFaq(id: Id): Promise<void>;

  /** Moves an item up or down within its own list. */
  reorder(kind: 'offer' | 'slide' | 'video' | 'faq', id: Id, direction: -1 | 1): Promise<void>;
}

// ---------------------------------------------------------- notifications ---

export interface NotificationsRepository {
  list(query: ListQuery): Promise<Page<NotificationCampaign>>;
  save(campaign: Omit<NotificationCampaign, 'id' | 'createdAt' | 'createdBy'> & { id?: Id }): Promise<NotificationCampaign>;
  remove(id: Id): Promise<void>;
  /** Resolves how many devices a given audience currently covers. */
  audienceSize(audience: NotificationCampaign['audience'], targetIds: Id[]): Promise<number>;
  send(id: Id): Promise<NotificationCampaign>;
}

// ----------------------------------------------------------------- agents ---

export interface AgentsRepository {
  list(query: ListQuery & { governorateId?: Id; active?: boolean | 'all' }): Promise<Page<Agent>>;
  save(agent: Omit<Agent, 'id' | 'createdAt' | 'renewalCount'> & { id?: Id }): Promise<Agent>;
  remove(id: Id): Promise<void>;
  /** Tops the prepaid float up or draws it down. */
  adjustBalance(id: Id, delta: number, reasonAr: string): Promise<Agent>;
}

// -------------------------------------------------- audit, settings ---------

export interface AdminRepository {
  audit(query: ListQuery & { adminId?: Id; entityType?: string }): Promise<Page<AuditEntry>>;

  settings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;

  dashboard(): Promise<DashboardSummary>;
  /** Throws away every local change and reloads the seed dataset. */
  resetMockData(): Promise<void>;
}

// ------------------------------------------------------------- the bundle ---

/** The full set, injected into React through one context. */
export interface Repositories {
  auth: AuthRepository;
  catalog: CatalogRepository;
  users: UsersRepository;
  devices: DevicesRepository;
  renewals: RenewalsRepository;
  matches: MatchesRepository;
  stock: StockRepository;
  api: ApiRepository;
  leaderboard: LeaderboardRepository;
  draws: DrawsRepository;
  content: ContentRepository;
  notifications: NotificationsRepository;
  agents: AgentsRepository;
  admin: AdminRepository;
}
