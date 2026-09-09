/**
 * Enum -> Arabic label and status tone.
 *
 * Every screen that renders a status reads it from here, so a state has one
 * wording and one color across the whole console. The tone mapping also
 * encodes the app's semantic rule: success = confirmed, warning = expiring,
 * danger = expired/failed, live = live only, gold = award only.
 */

import type {
  AppUserStatus,
  CampaignState,
  DeviceStatus,
  DrawState,
  MatchState,
  NotificationAudience,
  PaymentMethod,
  PointsEntryKind,
  PredictionOutcome,
  RenewalStatus,
  SlideTarget,
} from '@/types';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'live' | 'gold' | 'muted';

export const USER_STATUS: Record<AppUserStatus, { label: string; tone: Tone }> = {
  active: { label: 'فعّال', tone: 'success' },
  blocked: { label: 'محظور', tone: 'danger' },
  pending: { label: 'قيد التفعيل', tone: 'warning' },
};

export const DEVICE_STATUS: Record<DeviceStatus, { label: string; tone: Tone }> = {
  active: { label: 'فعّال', tone: 'success' },
  expiring: { label: 'قرب ينتهي', tone: 'warning' },
  expired: { label: 'منتهي', tone: 'danger' },
  suspended: { label: 'معلّق', tone: 'muted' },
};

export const MATCH_STATE: Record<MatchState, { label: string; tone: Tone }> = {
  scheduled: { label: 'مجدولة', tone: 'neutral' },
  live: { label: 'مباشر', tone: 'live' },
  finished: { label: 'منتهية', tone: 'muted' },
  postponed: { label: 'مؤجلة', tone: 'warning' },
  cancelled: { label: 'ملغاة', tone: 'danger' },
};

export const PREDICTION_OUTCOME: Record<PredictionOutcome, { label: string; tone: Tone }> = {
  pending: { label: 'بانتظار النتيجة', tone: 'neutral' },
  exact: { label: 'نتيجة بالضبط', tone: 'success' },
  goaldiff: { label: 'فرق أهداف صحيح', tone: 'success' },
  result: { label: 'نتيجة صحيحة', tone: 'success' },
  wrong: { label: 'توقع خاطئ', tone: 'danger' },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  kcard: 'كي كارد',
  cash_agent: 'نقدي (وكيل)',
  online: 'دفع إلكتروني',
  free_grant: 'منحة مجانية',
};

export const RENEWAL_STATUS: Record<RenewalStatus, { label: string; tone: Tone }> = {
  completed: { label: 'مكتمل', tone: 'success' },
  pending: { label: 'قيد التنفيذ', tone: 'warning' },
  refunded: { label: 'مسترجع', tone: 'muted' },
  failed: { label: 'فاشل', tone: 'danger' },
};

export const DRAW_STATE: Record<DrawState, { label: string; tone: Tone }> = {
  draft: { label: 'مسودة', tone: 'muted' },
  open: { label: 'مفتوح', tone: 'success' },
  drawn: { label: 'تم السحب', tone: 'warning' },
  published: { label: 'منشور', tone: 'neutral' },
};

export const CAMPAIGN_STATE: Record<CampaignState, { label: string; tone: Tone }> = {
  draft: { label: 'مسودة', tone: 'muted' },
  scheduled: { label: 'مجدول', tone: 'warning' },
  sending: { label: 'جاري الإرسال', tone: 'neutral' },
  sent: { label: 'مُرسل', tone: 'success' },
  failed: { label: 'فشل', tone: 'danger' },
};

export const AUDIENCE: Record<NotificationAudience, string> = {
  all: 'كل المشتركين',
  governorate: 'محافظات محددة',
  expiring_soon: 'اشتراكاتهم قرب تنتهي',
  expired: 'اشتراكاتهم منتهية',
  predictors: 'المشاركون بالتوقعات',
  single_user: 'مشترك واحد',
};

export const SLIDE_TARGET: Record<SlideTarget, string> = {
  none: 'بدون فتح شاشة',
  offers: 'شاشة العروض',
  predict: 'شاشة توقع واربح',
  renew: 'شاشة التجديد',
  draws: 'شاشة السحوبات',
  matches: 'شاشة المباريات',
  tower: 'شاشة الأبراج',
};

export const POINTS_KIND: Record<PointsEntryKind, { label: string; tone: Tone }> = {
  prediction: { label: 'توقع', tone: 'neutral' },
  manual: { label: 'تعديل يدوي', tone: 'warning' },
  bonus: { label: 'مكافأة', tone: 'success' },
  penalty: { label: 'خصم', tone: 'danger' },
  season_reset: { label: 'تصفير موسم', tone: 'muted' },
  redeem: { label: 'استبدال', tone: 'gold' },
};

export const AUDIT_ACTION: Record<string, { label: string; tone: Tone }> = {
  create: { label: 'إضافة', tone: 'success' },
  update: { label: 'تعديل', tone: 'neutral' },
  delete: { label: 'حذف', tone: 'danger' },
  login: { label: 'دخول', tone: 'muted' },
  run: { label: 'تنفيذ', tone: 'warning' },
  send: { label: 'إرسال', tone: 'neutral' },
};

/** Icon keys the app understands, with their Arabic names for pickers. */
export const ICON_KEYS: { value: string; label: string }[] = [
  { value: 'home', label: 'بيت' },
  { value: 'shop', label: 'محل' },
  { value: 'family', label: 'أهل' },
  { value: 'tv', label: 'شاشة' },
  { value: 'receiver', label: 'رسيفر' },
  { value: 'subscription', label: 'اشتراك' },
  { value: 'merch', label: 'هدايا' },
  { value: 'trophy', label: 'كأس' },
  { value: 'satellite', label: 'قمر صناعي' },
  { value: 'gift', label: 'هدية' },
];

/** The six art gradients the app can draw. Shown as swatches in pickers. */
export const GRADIENT_SWATCHES: string[] = [
  'linear-gradient(140deg,#5B97D5,#2E6BA8)',
  'linear-gradient(140deg,#E5943A,#C97F3D)',
  'linear-gradient(140deg,#2FA97C,#1E7D5C)',
  'linear-gradient(140deg,#8A55C8,#6337A0)',
  'linear-gradient(140deg,#4FA3C0,#2E7391)',
  'linear-gradient(140deg,#D9A441,#A97D25)',
];
