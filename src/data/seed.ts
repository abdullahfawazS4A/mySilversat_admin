/**
 * Deterministic seed dataset.
 *
 * This is the console equivalent of the app assets/mock/seed.json, but
 * generated rather than hand-written: the console needs hundreds of users,
 * devices, renewals and predictions before its tables, filters and charts mean
 * anything, and maintaining that by hand is not practical.
 *
 * Generation is seeded (see seededRandom) so every reload produces the exact
 * same dataset. That matters for demos: a screenshot taken today still matches
 * the app tomorrow.
 *
 * The base data — governorates, leagues, teams, packages, prize tiers — is
 * literal and mirrors what the customer app already ships.
 */

import type {
  Agent,
  AdminUser,
  ApiConnection,
  AppSettings,
  AppUser,
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
import { addDays, addMonths, sampleDistinct, seededRandom } from '@/lib/utils';

/** One shared RNG so the whole dataset is reproducible from a single seed. */
const rng = seededRandom(20260907);

const NOW = new Date();
/** Midnight today, the anchor every generated date is expressed relative to. */
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).toISOString();

function at(dayOffset: number, hour = 12, minute = 0): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function int(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// ------------------------------------------------------------ governorates --

export const GOVERNORATES: Governorate[] = [
  { id: 'gov_bgd', nameAr: 'بغداد', nameCkb: 'بەغدا', active: true, subscriberCount: 0 },
  { id: 'gov_nnw', nameAr: 'نينوى', nameCkb: 'نەینەوا', active: true, subscriberCount: 0 },
  { id: 'gov_bsr', nameAr: 'البصرة', nameCkb: 'بەسرە', active: true, subscriberCount: 0 },
  { id: 'gov_erb', nameAr: 'أربيل', nameCkb: 'هەولێر', active: true, subscriberCount: 0 },
  { id: 'gov_slm', nameAr: 'السليمانية', nameCkb: 'سلێمانی', active: true, subscriberCount: 0 },
  { id: 'gov_dhk', nameAr: 'دهوك', nameCkb: 'دهۆک', active: true, subscriberCount: 0 },
  { id: 'gov_krk', nameAr: 'كركوك', nameCkb: 'کەرکووک', active: true, subscriberCount: 0 },
  { id: 'gov_njf', nameAr: 'النجف', nameCkb: 'نەجەف', active: true, subscriberCount: 0 },
  { id: 'gov_krb', nameAr: 'كربلاء', nameCkb: 'کەربەلا', active: true, subscriberCount: 0 },
  { id: 'gov_bbl', nameAr: 'بابل', nameCkb: 'بابل', active: true, subscriberCount: 0 },
  { id: 'gov_anb', nameAr: 'الأنبار', nameCkb: 'ئەنبار', active: true, subscriberCount: 0 },
  { id: 'gov_dyl', nameAr: 'ديالى', nameCkb: 'دیالە', active: true, subscriberCount: 0 },
  { id: 'gov_wst', nameAr: 'واسط', nameCkb: 'واسیت', active: true, subscriberCount: 0 },
  { id: 'gov_dqr', nameAr: 'ذي قار', nameCkb: 'زیقار', active: true, subscriberCount: 0 },
  { id: 'gov_msn', nameAr: 'ميسان', nameCkb: 'مەیسان', active: true, subscriberCount: 0 },
  { id: 'gov_qds', nameAr: 'القادسية', nameCkb: 'قادسیە', active: true, subscriberCount: 0 },
  { id: 'gov_mth', nameAr: 'المثنى', nameCkb: 'موسەننا', active: false, subscriberCount: 0 },
  { id: 'gov_slh', nameAr: 'صلاح الدين', nameCkb: 'سەلاحەدین', active: true, subscriberCount: 0 },
];

/** Areas per governorate, used to give users a plausible address line. */
const AREAS: Record<string, string[]> = {
  gov_bgd: ['الكرادة', 'المنصور', 'الأعظمية', 'الدورة', 'زيونة', 'الشعلة'],
  gov_nnw: ['الموصل الجديدة', 'الزهور', 'حي النور', 'تلعفر', 'الحمدانية'],
  gov_bsr: ['العشار', 'الجمهورية', 'أبو الخصيب', 'الزبير'],
  gov_erb: ['عنكاوا', 'شورش', 'برايتي', 'مامۆستایان'],
  gov_slm: ['سرچنار', 'بختياري', 'كاني اسكان'],
  gov_dhk: ['نوهدرا', 'زاخو', 'سميل'],
  gov_krk: ['الواسطي', 'رحيم آوا', 'شورجة'],
  gov_njf: ['الحنانة', 'حي السلام', 'الكوفة'],
  gov_krb: ['حي الحسين', 'الحر', 'باب بغداد'],
  gov_bbl: ['الحلة', 'المحاويل', 'الهاشمية'],
  gov_anb: ['الرمادي', 'الفلوجة', 'هيت'],
  gov_dyl: ['بعقوبة', 'المقدادية', 'الخالص'],
  gov_wst: ['الكوت', 'الحي', 'النعمانية'],
  gov_dqr: ['الناصرية', 'الشطرة', 'سوق الشيوخ'],
  gov_msn: ['العمارة', 'المجر الكبير'],
  gov_qds: ['الديوانية', 'عفك'],
  gov_mth: ['السماوة', 'الرميثة'],
  gov_slh: ['تكريت', 'سامراء', 'بيجي'],
};

// ------------------------------------------------------------ admin access --

/** The console has a single account — no roles, no permission set. */
export const ADMIN_USERS: AdminUser[] = [
  {
    id: 'adm_1',
    fullName: 'عبدالله فواز',
    username: 'admin',
    phone: '07700000001',
    active: true,
    createdAt: at(-420, 9),
    lastLoginAt: at(0, 8, 12),
  },
];

// ------------------------------------------------------- leagues and teams --

/**
 * Leagues as the feed returns them. `externalId` is the provider's own id —
 * a sync joins on it, so these have to look like provider ids, not ours.
 */
export const LEAGUES: League[] = [
  { id: 'lg_iraqi', externalId: 'SD-101', key: 'iraqi', nameAr: 'دوري نجوم العراق', country: 'العراق', active: true, sortOrder: 0 },
  { id: 'lg_spanish', externalId: 'SD-140', key: 'spanish', nameAr: 'الدوري الإسباني', country: 'إسبانيا', active: true, sortOrder: 1 },
  { id: 'lg_english', externalId: 'SD-039', key: 'english', nameAr: 'الدوري الإنكليزي', country: 'إنكلترا', active: true, sortOrder: 2 },
  { id: 'lg_italian', externalId: 'SD-135', key: 'italian', nameAr: 'الدوري الإيطالي', country: 'إيطاليا', active: true, sortOrder: 3 },
  { id: 'lg_german', externalId: 'SD-078', key: 'german', nameAr: 'الدوري الألماني', country: 'ألمانيا', active: true, sortOrder: 4 },
  { id: 'lg_french', externalId: 'SD-061', key: 'french', nameAr: 'الدوري الفرنسي', country: 'فرنسا', active: true, sortOrder: 5 },
  { id: 'lg_saudi', externalId: 'SD-307', key: 'saudi', nameAr: 'الدوري السعودي', country: 'السعودية', active: true, sortOrder: 6 },
  { id: 'lg_ucl', externalId: 'SD-002', key: 'ucl', nameAr: 'دوري أبطال أوروبا', country: 'أوروبا', active: false, sortOrder: 7 },
];

/** [id, name, short name, league, crest seed] */
const TEAM_ROWS: [string, string, string, string, number][] = [
  ['tm_zawraa', 'الزوراء', 'الزوراء', 'lg_iraqi', 1],
  ['tm_quwa', 'القوة الجوية', 'الجوية', 'lg_iraqi', 0],
  ['tm_shorta', 'الشرطة', 'الشرطة', 'lg_iraqi', 4],
  ['tm_erbil', 'أربيل', 'أربيل', 'lg_iraqi', 3],
  ['tm_naft', 'النفط', 'النفط', 'lg_iraqi', 5],
  ['tm_karbala', 'كربلاء', 'كربلاء', 'lg_iraqi', 6],
  ['tm_real', 'ريال مدريد', 'ريال', 'lg_spanish', 7],
  ['tm_atletico', 'أتلتيكو', 'أتلتيكو', 'lg_spanish', 2],
  ['tm_barca', 'برشلونة', 'برشلونة', 'lg_spanish', 4],
  ['tm_sevilla', 'إشبيلية', 'إشبيلية', 'lg_spanish', 1],
  ['tm_liverpool', 'ليفربول', 'ليفربول', 'lg_english', 2],
  ['tm_mancity', 'مان سيتي', 'السيتي', 'lg_english', 0],
  ['tm_arsenal', 'أرسنال', 'أرسنال', 'lg_english', 3],
  ['tm_chelsea', 'تشيلسي', 'تشيلسي', 'lg_english', 5],
  ['tm_manutd', 'مان يونايتد', 'اليونايتد', 'lg_english', 6],
  ['tm_juve', 'يوفنتوس', 'يوفي', 'lg_italian', 7],
  ['tm_inter', 'إنتر ميلان', 'إنتر', 'lg_italian', 0],
  ['tm_milan', 'ميلان', 'ميلان', 'lg_italian', 2],
  ['tm_napoli', 'نابولي', 'نابولي', 'lg_italian', 4],
  ['tm_bayern', 'بايرن ميونخ', 'بايرن', 'lg_german', 2],
  ['tm_dortmund', 'دورتموند', 'دورتموند', 'lg_german', 3],
  ['tm_leverkusen', 'ليفركوزن', 'ليفركوزن', 'lg_german', 1],
  ['tm_psg', 'باريس سان جيرمان', 'سان جيرمان', 'lg_french', 0],
  ['tm_marseille', 'مارسيليا', 'مارسيليا', 'lg_french', 7],
  ['tm_lyon', 'ليون', 'ليون', 'lg_french', 5],
  ['tm_ittihad', 'الاتحاد', 'الاتحاد', 'lg_saudi', 3],
  ['tm_hilal', 'الهلال', 'الهلال', 'lg_saudi', 0],
  ['tm_nassr', 'النصر', 'النصر', 'lg_saudi', 6],
  ['tm_ahli', 'الأهلي', 'الأهلي', 'lg_saudi', 4],
];

export const TEAMS: Team[] = TEAM_ROWS.map(([id, nameAr, shortNameAr, leagueId, crestSeed], index) => ({
  id,
  // The provider numbers its teams; ours are derived so the seed stays stable.
  externalId: `SD-T${(index + 1).toString().padStart(4, '0')}`,
  nameAr,
  shortNameAr,
  leagueId,
  crestSeed,
}));

// ---------------------------------------------------------------- packages --

export const PACKAGES: SubscriptionPackage[] = [
  { id: 'pk3', months: 3, price: 15000, save: 0, bonus: false, featured: false, active: true, sortOrder: 0 },
  { id: 'pk6', months: 6, price: 28000, save: 2000, bonus: false, featured: false, active: true, sortOrder: 1 },
  { id: 'pk12', months: 12, price: 52000, save: 8000, bonus: true, featured: true, active: true, sortOrder: 2 },
  { id: 'pk1', months: 1, price: 6000, save: 0, bonus: false, featured: false, active: false, sortOrder: 3 },
];

// -------------------------------------------------------------- app users ---

const FIRST_NAMES = [
  'محمد', 'أحمد', 'علي', 'حسين', 'حيدر', 'مصطفى', 'كرار', 'سجاد', 'يوسف', 'عمر',
  'زينب', 'فاطمة', 'نور', 'رقية', 'مريم', 'هدى', 'سارة', 'آية', 'دعاء', 'رنا',
  'كاروان', 'ديار', 'هێمن', 'شاهۆ', 'ئاسۆ', 'بەیان', 'سنور', 'ژیان',
];

const LAST_NAMES = [
  'الجبوري', 'العبيدي', 'الدليمي', 'الزبيدي', 'الطائي', 'الربيعي', 'الساعدي',
  'الخفاجي', 'الحسناوي', 'العزاوي', 'الشمري', 'الكعبي', 'البياتي', 'الحيالي',
  'بارزاني', 'زيباري', 'أحمد', 'كريم', 'حسن', 'عباس', 'صالح', 'رشيد',
];

const USER_COUNT = 140;

/** Weighted governorate picker — Baghdad and Nineveh carry most subscribers. */
const GOV_WEIGHTS: [string, number][] = [
  ['gov_bgd', 24], ['gov_nnw', 16], ['gov_bsr', 11], ['gov_erb', 10],
  ['gov_slm', 7], ['gov_dhk', 5], ['gov_krk', 5], ['gov_njf', 4],
  ['gov_krb', 4], ['gov_bbl', 3], ['gov_anb', 3], ['gov_dyl', 2],
  ['gov_wst', 2], ['gov_dqr', 2], ['gov_msn', 1], ['gov_qds', 1],
  ['gov_slh', 1],
];
const GOV_POOL: string[] = GOV_WEIGHTS.flatMap(([id, weight]) => Array(weight).fill(id));

export const APP_USERS: AppUser[] = Array.from({ length: USER_COUNT }, (_, i) => {
  const governorateId = pick(GOV_POOL);
  const joinedAt = at(-int(5, 900), int(9, 21), int(0, 59));
  const status: AppUser['status'] = rng() < 0.04 ? 'blocked' : rng() < 0.03 ? 'pending' : 'active';
  return {
    id: `usr_${(i + 1).toString().padStart(4, '0')}`,
    fullName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    phone: `07${pick(['70', '71', '80', '81', '50', '51'])}${int(1000000, 9999999)}`,
    governorateId,
    area: pick(AREAS[governorateId] ?? ['المركز']),
    status,
    blockReason: status === 'blocked' ? pick(['مشاركة بيانات الدخول', 'استخدام تجاري بدون ترخيص', 'شكوى احتيال']) : undefined,
    locale: ['gov_erb', 'gov_slm', 'gov_dhk'].includes(governorateId) && rng() < 0.6 ? 'ckb' : 'ar',
    joinedAt,
    lastSeenAt: rng() < 0.88 ? at(-int(0, 40), int(8, 23), int(0, 59)) : null,
    points: 0,
    rank: null,
    totalRenewals: 0,
    totalSpend: 0,
    notes: '',
  } satisfies AppUser;
});

// ---------------------------------------------------------------- devices ---

const DEVICE_LABELS: [Device['iconKey'], string][] = [
  ['home', 'جهاز البيت'],
  ['shop', 'جهاز المحل'],
  ['family', 'جهاز الأهل'],
];

const DEVICE_MODELS = ['Silversat 4', 'Silversat 3 HD', 'Silversat Mini', 'Silversat 4 Pro'];

function deviceNumber(index: number): string {
  const a = (1000 + ((index * 977) % 9000)).toString();
  const b = (1000 + ((index * 613) % 9000)).toString();
  const c = (100 + ((index * 331) % 900)).toString();
  return `SLV-${a} ${b} ${c}`;
}

export const DEVICES: Device[] = [];

APP_USERS.forEach((user, userIndex) => {
  const count = rng() < 0.5 ? 1 : rng() < 0.85 ? 2 : 3;
  for (let d = 0; d < count; d += 1) {
    const [iconKey, name] = DEVICE_LABELS[d];
    const months = pick([3, 6, 12]);
    // Spread expiry across a window centred a little in the future, so the
    // dataset always contains active, expiring-soon and expired devices.
    const expiryOffset = int(-120, 300);
    const expiryAt = at(expiryOffset, 12);
    const periodStartAt = addMonths(expiryAt, -months);
    const suspended = rng() < 0.03;
    const daysLeft = expiryOffset;
    const status: Device['status'] = suspended
      ? 'suspended'
      : daysLeft < 0
        ? 'expired'
        : daysLeft <= 7
          ? 'expiring'
          : 'active';
    DEVICES.push({
      id: `dev_${DEVICES.length + 1}`,
      userId: user.id,
      name,
      iconKey,
      number: deviceNumber(userIndex * 3 + d),
      model: pick(DEVICE_MODELS),
      status,
      expiryAt,
      periodStartAt,
      createdAt: user.joinedAt,
      suspendReason: suspended ? pick(['بلاغ إساءة استخدام', 'تجميد بطلب المشترك']) : undefined,
    });
  }
});

// --------------------------------------------------- agents and renewals ----

export const AGENTS: Agent[] = [
  { id: 'agt_1', fullName: 'وكيل الموصل — أبو زيد', phone: '07701110001', governorateId: 'gov_nnw', area: 'الزهور', active: true, commissionRate: 0.12, balance: 1_250_000, renewalCount: 0, createdAt: at(-500, 10) },
  { id: 'agt_2', fullName: 'وكيل بغداد — مركز الكرادة', phone: '07701110002', governorateId: 'gov_bgd', area: 'الكرادة', active: true, commissionRate: 0.1, balance: 3_400_000, renewalCount: 0, createdAt: at(-620, 10) },
  { id: 'agt_3', fullName: 'وكيل البصرة — العشار', phone: '07701110003', governorateId: 'gov_bsr', area: 'العشار', active: true, commissionRate: 0.12, balance: 890_000, renewalCount: 0, createdAt: at(-410, 10) },
  { id: 'agt_4', fullName: 'وكيل أربيل — عنكاوا', phone: '07501110004', governorateId: 'gov_erb', area: 'عنكاوا', active: true, commissionRate: 0.1, balance: 1_760_000, renewalCount: 0, createdAt: at(-380, 10) },
  { id: 'agt_5', fullName: 'وكيل النجف — الحنانة', phone: '07801110005', governorateId: 'gov_njf', area: 'الحنانة', active: false, commissionRate: 0.12, balance: 0, renewalCount: 0, createdAt: at(-300, 10) },
];

const METHODS: Renewal['method'][] = ['kcard', 'cash_agent', 'online', 'kcard', 'cash_agent', 'kcard'];

export const RENEWALS: Renewal[] = [];
export const COUPONS: Coupon[] = [];

// ------------------------------------------------------------- card stock ---

/**
 * Card codes carry their governorate and length in plain sight — SLV-BGD-12-
 * 00042 — because a support call starts with the customer reading the code
 * out, and the operator should know which stock it belongs to before looking
 * anything up.
 */
function cardCode(governorateId: string, months: number, serial: number): string {
  const region = governorateId.replace('gov_', '').toUpperCase();
  return `SLV-${region}-${months.toString().padStart(2, '0')}-${serial.toString().padStart(5, '0')}`;
}

export const STOCK_CARDS: StockCard[] = [];

DEVICES.forEach((device) => {
  // Every device has between one and four renewals in its history, walking the
  // expiry backwards from its current value.
  const historyCount = int(1, 4);
  let expiryCursor = device.expiryAt;
  for (let h = 0; h < historyCount; h += 1) {
    const pkg = pick(PACKAGES.filter((p) => p.active));
    const before = addMonths(expiryCursor, -pkg.months);
    const method = pick(METHODS);
    const createdAt = addDays(before, -int(0, 3));
    const status: Renewal['status'] = rng() < 0.02 ? 'refunded' : 'completed';
    const renewalId = `rnw_${RENEWALS.length + 1}`;
    const agent = method === 'cash_agent' ? pick(AGENTS) : undefined;

    let couponId: string | undefined;
    if (pkg.months >= 3 && status === 'completed') {
      const year = new Date(createdAt).getFullYear().toString();
      const couponId2 = `cpn_${COUPONS.length + 1}`;
      COUPONS.push({
        id: couponId2,
        code: `SLV-${year.slice(2)}${(new Date(createdAt).getMonth() + 1).toString().padStart(2, '0')}-${(COUPONS.length + 1).toString().padStart(5, '0')}`,
        userId: device.userId,
        deviceId: device.id,
        renewalId,
        year,
        active: year === String(NOW.getFullYear()),
        issuedAt: createdAt,
        resultTextAr: year === String(NOW.getFullYear()) ? undefined : `سحب ${year} — ما ربح`,
      });
      couponId = couponId2;
    }

    // Every historical renewal burnt a card out of its governorate's stock, so
    // the used side of the stock is generated here rather than invented later.
    const owner = APP_USERS.find((u) => u.id === device.userId);
    const cardId = `crd_u${STOCK_CARDS.length + 1}`;
    if (owner) {
      STOCK_CARDS.push({
        id: cardId,
        code: cardCode(owner.governorateId, pkg.months, STOCK_CARDS.length + 1),
        governorateId: owner.governorateId,
        months: pkg.months,
        status: status === 'refunded' ? 'void' : 'used',
        batchRef: `B-${new Date(createdAt).getFullYear()}-${(new Date(createdAt).getMonth() + 1).toString().padStart(2, '0')}`,
        addedAt: addDays(createdAt, -int(3, 40)),
        usedAt: createdAt,
        usedByRenewalId: renewalId,
        usedByDeviceId: device.id,
        voidReasonAr: status === 'refunded' ? 'تجديد مسترجع' : undefined,
      });
    }

    RENEWALS.push({
      id: renewalId,
      userId: device.userId,
      deviceId: device.id,
      packageId: pkg.id,
      months: pkg.months,
      price: pkg.price,
      method,
      agentId: agent?.id,
      status,
      couponId,
      cardId: owner ? cardId : undefined,
      createdAt,
      expiryBefore: before,
      expiryAfter: expiryCursor,
    });
    expiryCursor = before;
  }
});

// Fill the denormalised totals now that renewals exist.
{
  const byUser = new Map<string, { count: number; spend: number }>();
  for (const renewal of RENEWALS) {
    if (renewal.status !== 'completed') continue;
    const bucket = byUser.get(renewal.userId) ?? { count: 0, spend: 0 };
    bucket.count += 1;
    bucket.spend += renewal.price;
    byUser.set(renewal.userId, bucket);
  }
  for (const user of APP_USERS) {
    const bucket = byUser.get(user.id);
    user.totalRenewals = bucket?.count ?? 0;
    user.totalSpend = bucket?.spend ?? 0;
  }
  const byAgent = new Map<string, number>();
  for (const renewal of RENEWALS) {
    if (!renewal.agentId) continue;
    byAgent.set(renewal.agentId, (byAgent.get(renewal.agentId) ?? 0) + 1);
  }
  for (const agent of AGENTS) agent.renewalCount = byAgent.get(agent.id) ?? 0;

  const byGov = new Map<string, number>();
  for (const user of APP_USERS) {
    byGov.set(user.governorateId, (byGov.get(user.governorateId) ?? 0) + 1);
  }
  for (const gov of GOVERNORATES) gov.subscriberCount = byGov.get(gov.id) ?? 0;
}

// Stock still on the shelf, sized against how busy each governorate is. A
// couple of lengths are deliberately left thin or empty so the low-stock
// warning and the "refuse the renewal" path are both reachable in a demo.
{
  const SELLABLE_MONTHS = [3, 6, 12];
  let serial = STOCK_CARDS.length;

  for (const gov of GOVERNORATES) {
    const busy = Math.max(1, gov.subscriberCount);
    for (const months of SELLABLE_MONTHS) {
      // Baghdad holds hundreds; a governorate with three subscribers holds a
      // handful. Twelve-month cards are the slow movers everywhere.
      const base = Math.round(busy * (months === 12 ? 1.2 : months === 6 ? 2.1 : 3.4));
      let count = int(Math.max(0, Math.round(base * 0.6)), Math.round(base * 1.4));
      if (gov.id === 'gov_dyl' && months === 12) count = 4; // low-stock warning
      if (gov.id === 'gov_msn' && months === 6) count = 0; // sold out
      if (!gov.active) count = 0;

      for (let i = 0; i < count; i += 1) {
        serial += 1;
        const addedAt = at(-int(1, 120), int(8, 16), 0);
        STOCK_CARDS.push({
          id: `crd_a${serial}`,
          code: cardCode(gov.id, months, serial),
          governorateId: gov.id,
          months,
          status: 'available',
          batchRef: `B-${new Date(addedAt).getFullYear()}-${(new Date(addedAt).getMonth() + 1).toString().padStart(2, '0')}`,
          addedAt,
          usedAt: null,
        });
      }
    }
  }

  // Oldest first: the renewal path burns FIFO, and the table shows the same
  // order, so what the operator sees at the top is what goes next.
  STOCK_CARDS.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

// -------------------------------------------------------- governorate APIs --

/**
 * Every governorate runs the same stack behind its own domain, so a connection
 * is four fields and a list of governorates it answers for. Three of these are
 * shared regional servers; Baghdad has its own.
 */
export const API_CONNECTIONS: ApiConnection[] = [
  {
    id: 'api_bgd',
    nameAr: 'سيرفر بغداد',
    baseUrl: 'https://bgd.silversat.iq',
    authKey: 'ak_bgd_7f31c2ea9d40',
    username: 'silver_bgd',
    password: 'Bgd@2026',
    active: true,
    governorateIds: ['gov_bgd'],
    createdAt: at(-380, 10),
    lastCheckAt: at(0, 8, 5),
    lastCheckOk: true,
    lastCheckMessageAr: 'الاتصال ناجح — 142ms',
  },
  {
    id: 'api_north',
    nameAr: 'سيرفر الشمال',
    baseUrl: 'https://north.silversat.iq',
    authKey: 'ak_nrt_2b98d5f16c77',
    username: 'silver_north',
    password: 'Nrt@2026',
    active: true,
    governorateIds: ['gov_nnw', 'gov_erb', 'gov_slm', 'gov_dhk', 'gov_krk'],
    createdAt: at(-370, 11),
    lastCheckAt: at(0, 8, 6),
    lastCheckOk: true,
    lastCheckMessageAr: 'الاتصال ناجح — 218ms',
  },
  {
    id: 'api_south',
    nameAr: 'سيرفر الجنوب',
    baseUrl: 'https://south.silversat.iq',
    authKey: 'ak_sth_5c40a1be2f83',
    username: 'silver_south',
    password: 'Sth@2026',
    active: true,
    governorateIds: ['gov_bsr', 'gov_njf', 'gov_krb', 'gov_dqr', 'gov_msn', 'gov_qds', 'gov_mth'],
    createdAt: at(-365, 9),
    lastCheckAt: at(-2, 14),
    lastCheckOk: false,
    lastCheckMessageAr: 'انتهت مهلة الاتصال — تأكد من الدومين',
  },
  {
    id: 'api_mid',
    nameAr: 'سيرفر الفرات الأوسط',
    baseUrl: 'https://mid.silversat.iq',
    authKey: 'ak_mid_8e12f4c790ab',
    username: 'silver_mid',
    password: 'Mid@2026',
    active: true,
    governorateIds: ['gov_bbl', 'gov_anb', 'gov_dyl', 'gov_wst', 'gov_slh'],
    createdAt: at(-360, 13),
    lastCheckAt: null,
    lastCheckOk: null,
  },
];

// ---------------------------------------------------------------- matches ---

/** [league, home, away, day offset, hour, state] */
const MATCH_ROWS: [string, string, string, number, number, Match['state']][] = [
  ['lg_german', 'tm_bayern', 'tm_dortmund', -1, 21, 'finished'],
  ['lg_french', 'tm_psg', 'tm_marseille', -1, 22, 'finished'],
  ['lg_english', 'tm_arsenal', 'tm_chelsea', -2, 20, 'finished'],
  ['lg_iraqi', 'tm_naft', 'tm_karbala', -2, 19, 'finished'],
  ['lg_spanish', 'tm_barca', 'tm_sevilla', -3, 22, 'finished'],
  ['lg_italian', 'tm_milan', 'tm_napoli', -3, 21, 'finished'],
  ['lg_iraqi', 'tm_zawraa', 'tm_quwa', 0, 19, 'live'],
  ['lg_saudi', 'tm_ittihad', 'tm_hilal', 0, 21, 'scheduled'],
  ['lg_spanish', 'tm_real', 'tm_atletico', 0, 22, 'scheduled'],
  ['lg_english', 'tm_liverpool', 'tm_mancity', 1, 21, 'scheduled'],
  ['lg_italian', 'tm_juve', 'tm_inter', 1, 22, 'scheduled'],
  ['lg_iraqi', 'tm_erbil', 'tm_shorta', 2, 20, 'scheduled'],
  ['lg_german', 'tm_leverkusen', 'tm_bayern', 2, 21, 'scheduled'],
  ['lg_french', 'tm_lyon', 'tm_psg', 3, 22, 'scheduled'],
  ['lg_english', 'tm_manutd', 'tm_arsenal', 3, 20, 'scheduled'],
  ['lg_saudi', 'tm_nassr', 'tm_ahli', 4, 21, 'scheduled'],
  ['lg_spanish', 'tm_sevilla', 'tm_real', 4, 22, 'scheduled'],
  ['lg_iraqi', 'tm_quwa', 'tm_naft', 5, 19, 'scheduled'],
  ['lg_italian', 'tm_inter', 'tm_milan', 5, 21, 'scheduled'],
  ['lg_german', 'tm_dortmund', 'tm_leverkusen', 6, 20, 'postponed'],
];

/** Fixtures the operator has switched on for predictions. */
const OPEN_FOR_PREDICT = new Set(['mch_8', 'mch_9', 'mch_10', 'mch_11', 'mch_12']);

export const MATCHES: Match[] = MATCH_ROWS.map(([leagueId, homeTeamId, awayTeamId, day, hour, state], i) => {
  const id = `mch_${i + 1}`;
  const kickoffAt = at(day, hour, 0);
  const finished = state === 'finished';
  const live = state === 'live';
  return {
    id,
    externalId: `SD-F${(1740000 + i * 37).toString()}`,
    syncedAt: at(0, 7, 30),
    leagueId,
    homeTeamId,
    awayTeamId,
    kickoffAt,
    state,
    homeScore: finished || live ? int(0, 3) : null,
    awayScore: finished || live ? int(0, 2) : null,
    liveMinute: live ? `${int(20, 85)}'` : undefined,
    // Finished fixtures were open too — that is where settled points come from.
    openForPredict: OPEN_FOR_PREDICT.has(id) || finished,
    predictionCloseAt: OPEN_FOR_PREDICT.has(id) || finished ? kickoffAt : null,
    featured: id === 'mch_9' || id === 'mch_7',
    settledAt: finished ? addDays(kickoffAt, 0) : null,
    predictionCount: 0,
    note: state === 'postponed' ? 'مؤجلة بسبب الأحوال الجوية' : undefined,
  } satisfies Match;
});

// ------------------------------------------------------------ predictions ---

export const PREDICTIONS: Prediction[] = [];

export const SEASONS: Season[] = [
  {
    id: 'ssn_prev',
    nameAr: `موسم ${new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1).toLocaleDateString('en', { month: 'long' })}`,
    startsAt: new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1).toISOString(),
    endsAt: new Date(NOW.getFullYear(), NOW.getMonth(), 0, 23, 59).toISOString(),
    active: false,
    closedAt: new Date(NOW.getFullYear(), NOW.getMonth(), 1, 0, 5).toISOString(),
  },
  {
    id: 'ssn_current',
    nameAr: 'الموسم الحالي',
    startsAt: new Date(NOW.getFullYear(), NOW.getMonth(), 1).toISOString(),
    endsAt: new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0, 23, 59).toISOString(),
    active: true,
    closedAt: null,
  },
];

export const POINTS_ENTRIES: PointsEntry[] = [];

/** Users who actually play the prediction game — roughly two thirds. */
const PREDICTORS = APP_USERS.filter(() => rng() < 0.66);

MATCHES.forEach((match) => {
  if (!match.openForPredict) return;
  const participants = sampleDistinct(PREDICTORS, int(25, Math.min(90, PREDICTORS.length)), rng);
  for (const user of participants) {
    const homePick = int(0, 4);
    const awayPick = int(0, 3);
    const createdAt = addDays(match.kickoffAt, -int(1, 3));
    const prediction: Prediction = {
      id: `prd_${PREDICTIONS.length + 1}`,
      matchId: match.id,
      userId: user.id,
      homePick,
      awayPick,
      createdAt,
      updatedAt: rng() < 0.15 ? addDays(createdAt, 1) : null,
      outcome: 'pending',
      pointsAwarded: null,
    };

    // Settle immediately for finished fixtures so the ledger has real history.
    if (match.state === 'finished' && match.homeScore !== null && match.awayScore !== null) {
      const exact = homePick === match.homeScore && awayPick === match.awayScore;
      const sign = (a: number, b: number) => Math.sign(a - b);
      const sameResult = sign(homePick, awayPick) === sign(match.homeScore, match.awayScore);
      const sameDiff = homePick - awayPick === match.homeScore - match.awayScore;
      prediction.outcome = exact ? 'exact' : sameDiff && sameResult ? 'goaldiff' : sameResult ? 'result' : 'wrong';
      const points = exact ? 15 : sameDiff && sameResult ? 8 : sameResult ? 5 : 0;
      prediction.pointsAwarded = points + 1; // +1 participation
      POINTS_ENTRIES.push({
        id: `pts_${POINTS_ENTRIES.length + 1}`,
        userId: user.id,
        seasonId: 'ssn_current',
        delta: prediction.pointsAwarded,
        kind: 'prediction',
        reasonAr: exact ? 'نتيجة بالضبط' : sameResult ? 'نتيجة صحيحة' : 'مشاركة',
        refId: match.id,
        createdAt: addDays(match.kickoffAt, 0),
      });
    }

    PREDICTIONS.push(prediction);
    match.predictionCount += 1;
  }
});

// A handful of manual adjustments so the ledger shows admin activity too.
for (const user of sampleDistinct(APP_USERS, 8, rng)) {
  const bonus = rng() < 0.6;
  POINTS_ENTRIES.push({
    id: `pts_${POINTS_ENTRIES.length + 1}`,
    userId: user.id,
    seasonId: 'ssn_current',
    delta: bonus ? int(10, 50) : -int(5, 25),
    kind: bonus ? 'bonus' : 'penalty',
    reasonAr: bonus ? 'مكافأة حملة ترويجية' : 'تصحيح إداري بعد شكوى',
    adminId: 'adm_2',
    createdAt: at(-int(1, 20), int(9, 18)),
  });
}

// Roll the ledger up into each user cached points total and rank.
{
  const totals = new Map<string, number>();
  for (const entry of POINTS_ENTRIES) {
    if (entry.seasonId !== 'ssn_current') continue;
    totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.delta);
  }
  for (const user of APP_USERS) user.points = Math.max(0, totals.get(user.id) ?? 0);
  const ranked = [...APP_USERS].filter((u) => u.points > 0).sort((a, b) => b.points - a.points);
  ranked.forEach((user, index) => {
    user.rank = index + 1;
  });
}

// ------------------------------------------------------- draws and prizes ---

export const DRAWS: Draw[] = [
  {
    id: 'drw_2025',
    nameAr: 'سحب سلفرسات السنوي 2025',
    year: '2025',
    state: 'published',
    opensAt: new Date(NOW.getFullYear() - 1, 0, 1).toISOString(),
    closesAt: new Date(NOW.getFullYear() - 1, 11, 31, 23, 59).toISOString(),
    drawnAt: new Date(NOW.getFullYear(), 0, 5, 12).toISOString(),
    publishedAt: new Date(NOW.getFullYear(), 0, 6, 12).toISOString(),
    governorateIds: [],
    entryCount: COUPONS.filter((c) => c.year === String(NOW.getFullYear() - 1)).length,
  },
  {
    id: 'drw_2026',
    nameAr: `سحب سلفرسات السنوي ${NOW.getFullYear()}`,
    year: String(NOW.getFullYear()),
    state: 'open',
    opensAt: new Date(NOW.getFullYear(), 0, 1).toISOString(),
    closesAt: new Date(NOW.getFullYear(), 11, 31, 23, 59).toISOString(),
    drawnAt: null,
    publishedAt: null,
    governorateIds: [],
    entryCount: COUPONS.filter((c) => c.year === String(NOW.getFullYear())).length,
  },
];

/** [icon, title, subtitle, rank, gradient, winners] */
const PRIZE_ROWS: [Prize['iconKey'], string, string, Prize['rank'], Prize['gradientIndex'], number][] = [
  ['tv', 'شاشة سمارت 65 بوصة', 'الجائزة الكبرى · فائز واحد', 1, 0, 1],
  ['receiver', 'جهاز Silversat 4 جديد', 'فائزَين', 2, 2, 2],
  ['subscription', 'اشتراك سنة كاملة مجاني', '3 فائزين', 3, 3, 3],
  ['subscription', 'اشتراك 6 أشهر مجاني', '5 فائزين', undefined, 4, 5],
  ['subscription', 'اشتراك 3 أشهر مجاني', '10 فائزين', undefined, 5, 10],
  ['merch', 'هدايا سلفرسات', '20 فائز', undefined, 1, 20],
];

export const PRIZES: Prize[] = DRAWS.flatMap((draw) =>
  PRIZE_ROWS.map(([iconKey, titleAr, subtitleAr, rank, gradientIndex, winnersCount], i) => ({
    id: `prz_${draw.id}_${i + 1}`,
    drawId: draw.id,
    iconKey,
    titleAr,
    subtitleAr,
    rank,
    gradientIndex,
    winnersCount,
    sortOrder: i,
  })),
);

export const DRAW_WINNERS: DrawWinner[] = [];
{
  const draw = DRAWS[0];
  const eligible = COUPONS.filter((c) => c.year === draw.year);
  const tiers = PRIZES.filter((p) => p.drawId === draw.id).slice(0, 3);
  for (const prize of tiers) {
    for (const coupon of sampleDistinct(eligible, prize.winnersCount, rng)) {
      const user = APP_USERS.find((u) => u.id === coupon.userId);
      const gov = GOVERNORATES.find((g) => g.id === user?.governorateId);
      DRAW_WINNERS.push({
        id: `wnr_${DRAW_WINNERS.length + 1}`,
        drawId: draw.id,
        prizeId: prize.id,
        couponId: coupon.id,
        userId: coupon.userId,
        maskedName: `${(user?.fullName ?? '؟').slice(0, 1)}*** ${(user?.fullName ?? '').split(' ')[1] ?? ''} — ${gov?.nameAr ?? ''}`,
        drawnAt: draw.drawnAt ?? at(-200),
        claimed: rng() < 0.7,
        claimedAt: rng() < 0.7 ? at(-int(150, 200)) : null,
      });
      coupon.resultTextAr = `${prize.titleAr} · فائز`;
      coupon.drawId = draw.id;
    }
  }
}

// ------------------------------------------------------------ app content ---

export const OFFERS: Offer[] = [
  { id: 'ofr_1', badgeAr: 'عرض تموز', titleAr: 'جدد سنة كاملة واحصل على شهر مجاني!', artText: '+1', artSubAr: 'شهر مجاني', gradientIndex: 0, tall: true, governorateScoped: false, governorateIds: [], startsAt: at(-20), endsAt: at(40), active: true, sortOrder: 0 },
  { id: 'ofr_2', badgeAr: 'توقع واربح', titleAr: 'المركز الأول هذا الشهر يربح جهاز Silversat 4', iconKey: 'trophy', gradientIndex: 2, tall: false, governorateScoped: false, governorateIds: [], startsAt: at(-10), endsAt: at(25), active: true, sortOrder: 1 },
  { id: 'ofr_3', badgeAr: 'جديد', titleAr: 'قنوات إضافية انضافت على الباقة الكاملة', iconKey: 'satellite', gradientIndex: 3, tall: false, governorateScoped: false, governorateIds: [], startsAt: at(-35), endsAt: at(90), active: true, sortOrder: 2 },
  { id: 'ofr_4', badgeAr: 'اشترك أكثر وحصل أيام أكثر', titleAr: 'احصل على أيام إضافية مع الاشتراكات طويلة الأمد', artText: '6+6', gradientIndex: 4, tall: true, governorateScoped: false, governorateIds: [], startsAt: at(-5), endsAt: at(60), active: true, sortOrder: 3 },
  { id: 'ofr_5', badgeAr: 'نينوى فقط', titleAr: 'خصم 10% لمشتركي نينوى عند أول تجديد من التطبيق', artText: '10%', artSubAr: 'خصم', gradientIndex: 1, tall: true, governorateScoped: true, governorateIds: ['gov_nnw'], startsAt: at(-8), endsAt: at(22), active: true, sortOrder: 4 },
  { id: 'ofr_6', badgeAr: 'نهاية الأسبوع', titleAr: 'عرض نهاية الأسبوع — خصومات في منطقتك', iconKey: 'gift', gradientIndex: 5, tall: false, governorateScoped: true, governorateIds: ['gov_bgd', 'gov_bsr'], startsAt: at(-2), endsAt: at(5), active: true, sortOrder: 5 },
  { id: 'ofr_7', badgeAr: 'منتهي', titleAr: 'عرض العيد — شهر مجاني لكل تجديد', artText: '+1', artSubAr: 'شهر', gradientIndex: 2, tall: false, governorateScoped: false, governorateIds: [], startsAt: at(-120), endsAt: at(-90), active: false, sortOrder: 6 },
];

export const SLIDES: Slide[] = [
  { id: 'sld_1', tagAr: 'عرض خاص', titleAr: 'جدد سنة واحصل على شهر مجاني', subtitleAr: 'العرض ساري لغاية 31 تموز — لكل المحافظات', gradientIndex: 0, routeTarget: 'offers', startsAt: at(-20), endsAt: at(40), active: true, sortOrder: 0 },
  { id: 'sld_2', tagAr: 'توقع واربح', titleAr: 'جوائز هذا الشهر وصلت', subtitleAr: 'توقع نتائج المباريات المفتوحة واجمع نقاط', gradientIndex: 2, routeTarget: 'predict', startsAt: at(-10), endsAt: at(25), active: true, sortOrder: 1 },
  { id: 'sld_3', tagAr: 'جديد', titleAr: 'قنوات إضافية على باقة سلفرسات', subtitleAr: 'حدّث جهازك واستمتع بالقنوات الجديدة', gradientIndex: 5, routeTarget: 'none', startsAt: at(-35), endsAt: at(90), active: true, sortOrder: 2 },
  { id: 'sld_4', tagAr: 'السحب السنوي', titleAr: 'كوبونك يدخل السحب تلقائياً', subtitleAr: 'كل تجديد 3 أشهر فما فوق يمنحك كوبون', gradientIndex: 3, routeTarget: 'draws', startsAt: at(-60), endsAt: at(120), active: false, sortOrder: 3 },
];

export const TOWERS: Tower[] = [
  { id: 'twr_1', nameAr: 'برج الموصل الرئيسي', governorateId: 'gov_nnw', latitude: 36.335, longitude: 43.118, strong: true, active: true, frequency: '11135', polarization: 'H', symbolRate: '27500' },
  { id: 'twr_2', nameAr: 'برج الحمدانية', governorateId: 'gov_nnw', latitude: 36.271, longitude: 43.377, strong: false, active: true, frequency: '11135', polarization: 'H', symbolRate: '27500' },
  { id: 'twr_3', nameAr: 'برج تلعفر', governorateId: 'gov_nnw', latitude: 36.377, longitude: 42.449, strong: false, active: true, frequency: '11095', polarization: 'V', symbolRate: '27500' },
  { id: 'twr_4', nameAr: 'برج بغداد المركزي', governorateId: 'gov_bgd', latitude: 33.315, longitude: 44.366, strong: true, active: true, frequency: '11135', polarization: 'H', symbolRate: '27500' },
  { id: 'twr_5', nameAr: 'برج البصرة', governorateId: 'gov_bsr', latitude: 30.508, longitude: 47.783, strong: true, active: true, frequency: '11095', polarization: 'V', symbolRate: '27500' },
  { id: 'twr_6', nameAr: 'برج أربيل', governorateId: 'gov_erb', latitude: 36.191, longitude: 44.009, strong: true, active: true, frequency: '11135', polarization: 'H', symbolRate: '27500' },
  { id: 'twr_7', nameAr: 'برج السليمانية', governorateId: 'gov_slm', latitude: 35.561, longitude: 45.437, strong: false, active: false, frequency: '11095', polarization: 'V', symbolRate: '27500' },
];

export const VIDEOS: VideoItem[] = [
  { id: 'vid_1', titleAr: 'كيف تجدد اشتراكك من التطبيق', titleCkb: 'چۆن بەشداریت نوێ بکەیتەوە', descriptionAr: 'شرح خطوة بخطوة لعملية التجديد بالكي كارد.', duration: '3:24', url: 'https://videos.silversat.iq/renew.mp4', gradientIndex: 0, active: true, sortOrder: 0 },
  { id: 'vid_2', titleAr: 'ضبط الصحن على البرج الأقرب', titleCkb: 'ڕێکخستنی تاباق', descriptionAr: 'استخدام البوصلة داخل التطبيق لتوجيه الصحن.', duration: '2:10', url: 'https://videos.silversat.iq/dish.mp4', gradientIndex: 2, active: true, sortOrder: 1 },
  { id: 'vid_3', titleAr: 'شرح مسابقة توقع واربح', titleCkb: 'پێشبینی و بردنەوە', descriptionAr: 'كيف تحسب النقاط ومتى يقفل التوقع.', duration: '4:05', url: 'https://videos.silversat.iq/predict.mp4', gradientIndex: 3, active: true, sortOrder: 2 },
  { id: 'vid_4', titleAr: 'حل مشكلة انقطاع الإشارة', titleCkb: 'چارەسەری پچڕانی سیگنال', descriptionAr: 'أكثر أسباب ضعف الإشارة وطريقة معالجتها.', duration: '1:48', url: 'https://videos.silversat.iq/signal.mp4', gradientIndex: 1, active: true, sortOrder: 3 },
];

export const FAQ_ITEMS: FaqItem[] = [
  { id: 'faq_1', questionAr: 'كيف أجدد اشتراكي؟', answerAr: 'من شاشة التجديد اختر الجهاز ثم الباقة، وادفع بالكي كارد أو عن طريق الوكيل.', questionCkb: 'چۆن بەشدارییەکەم نوێ بکەمەوە؟', answerCkb: 'لە شاشەی نوێکردنەوە ئامێر و پاکێج هەڵبژێرە.', categoryAr: 'الاشتراك', active: true, sortOrder: 0 },
  { id: 'faq_2', questionAr: 'كم جهاز أقدر أضيف على حسابي؟', answerAr: 'تقدر تضيف حتى 3 أجهزة على نفس الحساب.', questionCkb: 'چەند ئامێر دەتوانم زیاد بکەم؟', answerCkb: 'دەتوانیت تا ٣ ئامێر زیاد بکەیت.', categoryAr: 'الأجهزة', active: true, sortOrder: 1 },
  { id: 'faq_3', questionAr: 'متى يقفل التوقع على المباراة؟', answerAr: 'التوقع يقفل عند صافرة البداية، أو بالوقت الذي يحدده الفريق قبل المباراة.', questionCkb: 'کەی پێشبینی دادەخرێت؟', answerCkb: 'لە کاتی دەستپێکردنی یاری.', categoryAr: 'توقع واربح', active: true, sortOrder: 2 },
  { id: 'faq_4', questionAr: 'كيف أحصل على كوبون السحب؟', answerAr: 'كل تجديد 3 أشهر فما فوق يمنحك كوبون تلقائياً يدخل السحب السنوي.', questionCkb: 'چۆن کوپۆنی تیرەکێشان وەردەگرم؟', answerCkb: 'هەر نوێکردنەوەیەکی ٣ مانگ بەرەوژوور.', categoryAr: 'السحوبات', active: true, sortOrder: 3 },
  { id: 'faq_5', questionAr: 'الترتيب يصفّر متى؟', answerAr: 'ترتيب المتوقعين يصفّر ببداية كل شهر ميلادي.', questionCkb: 'کەی ڕیزبەندی سفر دەکرێتەوە؟', answerCkb: 'لە سەرەتای هەر مانگێک.', categoryAr: 'توقع واربح', active: true, sortOrder: 4 },
  { id: 'faq_6', questionAr: 'ما هي مواصفات ضبط الصحن؟', answerAr: 'التردد 11135، الاستقطاب أفقي H، معدل الترميز 27500.', questionCkb: 'تایبەتمەندییەکانی تاباق چییە؟', answerCkb: 'فریکوێنسی ١١١٣٥، H، ٢٧٥٠٠.', categoryAr: 'الأجهزة', active: true, sortOrder: 5 },
];

export const CAMPAIGNS: NotificationCampaign[] = [
  { id: 'cmp_1', titleAr: 'اشتراكك قرب ينتهي', bodyAr: 'باقي أقل من 7 أيام على انتهاء اشتراكك — جدد الآن من التطبيق.', audience: 'expiring_soon', targetIds: [], routeTarget: 'renew', state: 'sent', scheduledAt: null, sentAt: at(-3, 10), audienceSize: 412, deliveredCount: 388, openedCount: 191, createdBy: 'adm_3', createdAt: at(-3, 9) },
  { id: 'cmp_2', titleAr: 'مباريات اليوم مفتوحة للتوقع', bodyAr: 'ريال مدريد ضد أتلتيكو — توقع النتيجة قبل صافرة البداية.', audience: 'predictors', targetIds: [], routeTarget: 'predict', state: 'sent', sentAt: at(0, 14), scheduledAt: null, audienceSize: 1860, deliveredCount: 1802, openedCount: 964, createdBy: 'adm_2', createdAt: at(0, 13) },
  { id: 'cmp_3', titleAr: 'خصم نينوى 10%', bodyAr: 'خصم خاص لمشتركي نينوى عند التجديد من التطبيق.', audience: 'governorate', targetIds: ['gov_nnw'], routeTarget: 'offers', state: 'scheduled', scheduledAt: at(2, 11), sentAt: null, audienceSize: 0, deliveredCount: 0, openedCount: 0, createdBy: 'adm_3', createdAt: at(-1, 16) },
  { id: 'cmp_4', titleAr: 'نتائج السحب السنوي', bodyAr: 'أسماء الفائزين بسحب 2025 منشورة الآن داخل التطبيق.', audience: 'all', targetIds: [], routeTarget: 'draws', state: 'draft', scheduledAt: null, sentAt: null, audienceSize: 0, deliveredCount: 0, openedCount: 0, createdBy: 'adm_1', createdAt: at(-6, 12) },
];

// ------------------------------------------------------------- audit log ----

export const AUDIT_ENTRIES: AuditEntry[] = [
  { id: 'aud_1', adminId: 'adm_2', adminName: 'مصطفى الجبوري', action: 'update', entityType: 'match', entityId: 'mch_9', summaryAr: 'فتح التوقع على مباراة ريال مدريد ضد أتلتيكو', at: at(-1, 11, 20) },
  { id: 'aud_2', adminId: 'adm_2', adminName: 'مصطفى الجبوري', action: 'run', entityType: 'match', entityId: 'mch_1', summaryAr: 'احتساب نقاط مباراة بايرن ميونخ ضد دورتموند', at: at(-1, 23, 10) },
  { id: 'aud_3', adminId: 'adm_3', adminName: 'نور الهدى كريم', action: 'create', entityType: 'offer', entityId: 'ofr_5', summaryAr: 'إضافة عرض خصم نينوى 10%', at: at(-8, 10, 5) },
  { id: 'aud_4', adminId: 'adm_4', adminName: 'حسن الطائي', action: 'update', entityType: 'device', entityId: 'dev_12', summaryAr: 'إعادة تفعيل جهاز بعد شكوى مشترك', at: at(-2, 14, 44) },
  { id: 'aud_5', adminId: 'adm_1', adminName: 'عبدالله فواز', action: 'login', entityType: 'admin', entityId: 'adm_1', summaryAr: 'تسجيل دخول إلى لوحة التحكم', at: at(0, 8, 12) },
  { id: 'aud_6', adminId: 'adm_2', adminName: 'مصطفى الجبوري', action: 'update', entityType: 'points', entityId: 'usr_0021', summaryAr: 'إضافة 25 نقطة يدوياً — مكافأة حملة ترويجية', at: at(-4, 12, 30) },
  { id: 'aud_7', adminId: 'adm_3', adminName: 'نور الهدى كريم', action: 'send', entityType: 'campaign', entityId: 'cmp_1', summaryAr: 'إرسال إشعار تذكير بانتهاء الاشتراك', at: at(-3, 10, 2) },
];

// ---------------------------------------------------------------- settings --

export const SETTINGS: AppSettings = {
  scoring: {
    exactScore: 15,
    goalDifference: 8,
    correctResult: 5,
    wrong: 0,
    participation: 1,
    lockMinutesBeforeKickoff: 0,
    allowEditBeforeLock: true,
  },
  matchFeed: {
    providerName: 'SportsData Feed',
    baseUrl: 'https://api.sportsdata.io/v3/soccer',
    apiKey: 'sd_live_9f2c41ab7e05',
    syncIntervalMinutes: 15,
    lastSyncAt: at(0, 7, 30),
    lastSyncOk: true,
    lastSyncMessageAr: 'آخر مزامنة نجحت — 24 مباراة',
  },
  monthlyLeaderboardReset: true,
  maintenanceMode: false,
  maintenanceMessageAr: 'التطبيق تحت الصيانة، راح نرجع خلال وقت قصير.',
  supportPhone: '07700000000',
  supportWhatsapp: '9647700000000',
  expiryWarningDays: 7,
  couponMinMonths: 3,
  lowStockThreshold: 20,
  mockLatencyMs: [220, 520],
};
