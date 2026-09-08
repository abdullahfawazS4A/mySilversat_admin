/** Small shared helpers with no domain knowledge. */

/** Joins class names, dropping falsy entries. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Monotonic-ish id generator for mock records created in the browser. */
let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/** Deterministic pseudo-random generator so seeded data is stable per reload. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100_000) / 100_000;
  };
}

/** Picks `count` distinct items from `pool` using the supplied RNG. */
export function sampleDistinct<T>(pool: T[], count: number, rng: () => number): T[] {
  const copy = [...pool];
  const picked: T[] = [];
  while (picked.length < count && copy.length > 0) {
    const index = Math.floor(rng() * copy.length);
    picked.push(copy.splice(index, 1)[0]);
  }
  return picked;
}

/** Groups a list by a key selector. */
export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Sums a numeric projection over a list. */
export function sumBy<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

/** Clamps a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Shifts a date by whole months, preserving the day where possible. */
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Roll back when the target month is shorter (31 Jan + 1 month).
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString();
}

/** Shifts a date by whole days. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Start of the month containing `iso`. */
export function startOfMonth(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

/** True when both dates fall in the same calendar month. */
export function sameMonth(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

/** Case-insensitive substring match that also ignores Arabic diacritics. */
export function matchesSearch(haystack: string, needle: string): boolean {
  if (!needle.trim()) return true;
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[ً-ْ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  return normalize(haystack).includes(normalize(needle));
}

/** Downloads a client-side CSV. Used by every table export button. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const escape = (cell: string | number) => {
    const text = String(cell ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const body = rows.map((row) => row.map(escape).join(',')).join('\n');
  // BOM so Excel opens the Arabic columns as UTF-8 rather than mojibake.
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
