/**
 * Arabic labels for every enum the API returns.
 *
 * The backend speaks English enums (`available`, `finished`, `SUPER_ADMIN`);
 * the console speaks Arabic. Keeping the whole mapping in one file means a
 * status is worded identically in a table, a filter and a dialog — and a
 * wording change is one edit rather than a grep.
 *
 * Each entry carries the pill tone as well, because a status and its colour
 * are one decision, not two.
 */

import type {
  AdAction,
  AdminRole,
  BatchStatus,
  CodeStatus,
  ContactChannel,
  MatchStatus,
  NotificationTarget,
  PredictionOutcome,
} from '@/types';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'live' | 'gold' | 'muted';

export const CODE_STATUS: Record<CodeStatus, { label: string; tone: Tone }> = {
  available: { label: 'متاح', tone: 'success' },
  sold: { label: 'مباع', tone: 'neutral' },
  disabled: { label: 'معطّل', tone: 'danger' },
};

export const BATCH_STATUS: Record<BatchStatus, { label: string; tone: Tone }> = {
  active: { label: 'فعّالة', tone: 'success' },
  disabled: { label: 'معطّلة', tone: 'muted' },
};

/**
 * How a league is named in a picker.
 *
 * The feed mirrors 1,237 leagues and 291 of them share a name with another —
 * "Premier League" alone is 34 separate competitions, England and Bangladesh
 * and Mauritania among them, and there are 52 different "Super Cup"s. A list
 * of bare names is therefore not a list the operator can choose from at all,
 * so the country comes along with the name wherever one is offered.
 */
export function leagueLabel(league: { name: string; country?: { name: string } | null }): string {
  const country = league.country?.name;
  return country ? `${league.name} — ${country}` : league.name;
}

export const MATCH_STATUS: Record<MatchStatus, { label: string; tone: Tone }> = {
  scheduled: { label: 'مجدولة', tone: 'neutral' },
  live: { label: 'مباشر', tone: 'live' },
  finished: { label: 'منتهية', tone: 'muted' },
};

export const PREDICTION_OUTCOME: Record<PredictionOutcome, { label: string; tone: Tone }> = {
  pending: { label: 'بانتظار الاحتساب', tone: 'neutral' },
  exact: { label: 'نتيجة مطابقة', tone: 'gold' },
  outcome: { label: 'نفس النتيجة', tone: 'success' },
  wrong: { label: 'خطأ', tone: 'muted' },
};

export const ADMIN_ROLE: Record<AdminRole, { label: string; tone: Tone }> = {
  SUPER_ADMIN: { label: 'مدير عام', tone: 'gold' },
  ADMIN: { label: 'مدير', tone: 'neutral' },
  AGENT: { label: 'وكيل', tone: 'muted' },
};

export const NOTIFICATION_TARGET: Record<NotificationTarget, string> = {
  all: 'كل المشتركين',
  province: 'محافظة محددة',
  user: 'مشترك واحد',
};

export const AD_ACTION: Record<AdAction, string> = {
  none: 'بدون إجراء',
  url: 'فتح رابط',
  screen: 'فتح شاشة بالتطبيق',
};

export const CONTACT_CHANNEL: Record<ContactChannel, string> = {
  phone: 'هاتف',
  whatsapp: 'واتساب',
  facebook: 'فيسبوك',
  instagram: 'إنستغرام',
  telegram: 'تيليغرام',
};

export const ACTIVATION_API: Record<'silvers' | 'other', string> = {
  silvers: 'سلفرسات',
  other: 'مزوّد آخر',
};

/** Why the scoring numbers cannot be edited from the console. */
export const SCORING_NOTE = 'تتغيّر من كود السيرفر، مو من اللوحة.';

/** Kurdish is the app's second language; the console labels its fields so. */
export const LOCALE_SUFFIX = { ar: 'بالعربي', ku: 'بالكردي' } as const;
