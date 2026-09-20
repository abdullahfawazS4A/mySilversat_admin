/**
 * Formatting helpers.
 *
 * The one rule carried over from the customer app: never use Intl date/number
 * formatting under the `ar` locale, because it emits Arabic-Indic digits
 * (١٢٣) while the whole design system is built on tabular Latin digits. Every
 * number here is grouped by hand and every month name comes from a table.
 */

import type { IsoDate } from '@/types';

/** Arabic (Levantine/Iraqi) month names, index 0 = January. */
export const ARABIC_MONTHS = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
] as const;

/** Arabic weekday names, index 0 = Sunday (JS getDay order). */
export const ARABIC_WEEKDAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

/** Groups thousands with commas. Latin digits only, no Intl. */
export function formatNumber(value: number): string {
  const negative = value < 0;
  const [whole, fraction] = Math.abs(value).toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const out = fraction ? `${grouped}.${fraction}` : grouped;
  return negative ? `-${out}` : out;
}

/** Prices are Iraqi dinars, whole numbers, suffixed with the currency mark. */
export function formatIqd(value: number): string {
  return `${formatNumber(Math.round(value))} د.ع`;
}

/** Compact money for KPI tiles: 1,250,000 -> 1.25 مليون. */
export function formatIqdCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, '')} مليون د.ع`;
  }
  if (Math.abs(value) >= 1000) {
    return `${formatNumber(Math.round(value / 1000))} ألف د.ع`;
  }
  return formatIqd(value);
}

/** "14 آب 2026" — the exact shape the customer app renders. */
export function formatDateAr(iso: IsoDate | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Same as formatDateAr but without the year, for in-season dates. */
export function formatDayMonthAr(iso: IsoDate | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`;
}

/** 12-hour clock with an Arabic period word: "10:00 م". */
export function formatTimeAr(iso: IsoDate | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const h24 = d.getHours();
  const period = h24 >= 12 ? 'م' : 'ص';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

/** "14 آب 2026 · 10:00 م" */
export function formatDateTimeAr(iso: IsoDate | null | undefined): string {
  if (!iso) return '—';
  return `${formatDateAr(iso)} · ${formatTimeAr(iso)}`;
}

/**
 * An instant as a `datetime-local` field wants it: `2026-12-31T21:00`.
 *
 * The field has no time zone, so it must be handed the operator's own clock —
 * building the string out of UTC parts instead would show a Baghdad evening as
 * an afternoon and, worse, save back the hour it displayed.
 */
export function toLocalInput(iso: IsoDate | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Exactly what a `datetime-local` field emits, and nothing else. */
const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * What that field gives back, as the UTC instant the API stores.
 *
 * A zone-less string is parsed as local time, which is the half of the round
 * trip that matches `toLocalInput`.
 *
 * The shape is checked before parsing rather than leaning on `Invalid Date`,
 * because `Date` is far more willing than it looks: `new Date('2026-12-')`
 * does not fail, it answers with the end of November. Anything that is not a
 * whole instant comes back null instead of a plausible wrong date.
 */
export function fromLocalInput(value: string): IsoDate | null {
  const trimmed = value.trim();
  if (!LOCAL_INPUT.test(trimmed)) return null;

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Whole days from now until `iso`. Negative when the date has passed. */
export function daysUntil(iso: IsoDate): number {
  const target = new Date(iso).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

/** "قبل 3 أيام" / "بعد 5 ساعات" — coarse relative phrasing for activity feeds. */
export function relativeAr(iso: IsoDate | null | undefined): string {
  if (!iso) return '—';
  const diffMs = new Date(iso).getTime() - Date.now();
  const future = diffMs > 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  let body: string;
  if (mins < 1) return 'الآن';
  if (mins < 60) body = mins === 1 ? 'دقيقة' : mins === 2 ? 'دقيقتين' : `${mins} دقيقة`;
  else if (hours < 24) body = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : `${hours} ساعات`;
  else if (days < 30) body = days === 1 ? 'يوم' : days === 2 ? 'يومين' : `${days} أيام`;
  else {
    const months = Math.round(days / 30);
    body = months === 1 ? 'شهر' : months === 2 ? 'شهرين' : `${months} أشهر`;
  }
  return future ? `بعد ${body}` : `قبل ${body}`;
}

/** Countdown phrasing used by the predict screen: "6 ساعات" / "3 أيام". */
export function countdownAr(iso: IsoDate | null): string {
  if (!iso) return '—';
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'مغلق';
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(diffMs / 60_000))} دقيقة`;
  if (hours < 24) return hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : `${hours} ساعات`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'يوم' : days === 2 ? 'يومين' : `${days} أيام`;
}

/**
 * Arabic month counts: "شهر" / "شهرين" / "3 أشهر" / "12 شهر".
 *
 * Arabic does not pluralise the way a template literal assumes. Writing
 * `${n} أشهر` produces "1 أشهر" and "12 أشهر", both wrong: one takes the
 * singular, two takes the dual, 3–10 take the broken plural, and 11 and up go
 * back to the singular. Every screen that prints a subscription length reads
 * this so the console does not have to be wrong in nine places.
 */
export function monthsAr(count: number): string {
  if (count === 1) return 'شهر';
  if (count === 2) return 'شهرين';
  if (count >= 3 && count <= 10) return `${count} أشهر`;
  return `${count} شهر`;
}

/** 0.62 -> "62%". */
export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** "07701234567" -> "0770 123 4567" for readability in tables. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 11) return phone;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

/**
 * Public-facing name masking, matching how winners appear in the app:
 * "محمد أحمد" -> "م*** أحمد".
 */
export function maskName(fullName: string, governorateName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const rest = parts.slice(1).join(' ');
  const masked = `${first.slice(0, 1)}***`;
  return rest ? `${masked} ${rest} — ${governorateName}` : `${masked} — ${governorateName}`;
}

/** Percent change between two periods, or null when the base is zero. */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}
