/**
 * Reading a spreadsheet the operator was sent.
 *
 * Card shipments arrive as files, not as text to paste: a supplier sends an
 * `.xlsx` with the numbers down a column, and retyping or copying out of Excel
 * is where a shipment quietly loses its last row. So the file itself is read
 * here and turned into rows of plain strings; everything above this — which
 * column is the card, whether the first row is a heading — is the screen's
 * decision, because only the operator can see which it is.
 *
 * There is no dependency behind this. An `.xlsx` is a ZIP of XML, and the two
 * things needed to open one are already in the browser: `DecompressionStream`
 * inflates the entries and `DOMParser` reads them. That is a few hundred lines
 * against a library that would be an order of magnitude larger, would have to
 * be kept current, and would still only be asked for the one thing this does.
 *
 * What it deliberately does not do:
 *
 *  - **`.xls`** — the pre-2007 binary format, which shares nothing with this
 *    one. It is refused by name rather than half-read into nonsense.
 *  - **Formatting.** A cell's value is taken raw. A date formatted to look
 *    like one is a serial number underneath, and a card number is not a date,
 *    so the raw value is the honest reading.
 *  - **Precision Excel already lost.** A 16-digit card typed into a General
 *    cell is stored as a float and its last digits are gone before the file is
 *    saved. That cannot be recovered here, only reported — see `imprecise`.
 */

/** One sheet, read. */
export interface Sheet {
  /** The file it came from, which is also the batch's identity. */
  fileName: string;
  /** The worksheet's own name, when the format carries one. */
  sheetName: string | null;
  /** Rows of trimmed cell text. Short rows are padded to `columns`. */
  rows: string[][];
  /** Width of the widest row. */
  columns: number;
  /**
   * Columns holding a number big enough to have lost digits.
   *
   * Reported rather than fixed: the digits are already gone from the file, and
   * the only repair is upstream — format the column as Text and send it again.
   * A screen that silently accepted these would file cards that can never be
   * redeemed, and nothing afterwards would ever look wrong.
   *
   * Kept per column because a sheet often carries a long number that is not a
   * card — an invoice line, a reference — and refusing the whole file over a
   * column nobody is filing would be its own kind of wrong. Columns, not rows,
   * because a column index survives the empty rows this drops.
   */
  imprecise: Set<number>;
}

/** Extensions this can open, for a file input's `accept`. */
export const SPREADSHEET_ACCEPT = '.xlsx,.csv,.tsv,.txt';

/** A refusal worded for the operator rather than the log. */
export class SpreadsheetError extends Error {}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export async function readSpreadsheet(file: File): Promise<Sheet> {
  const extension = extensionOf(file.name);

  if (extension === 'xls') {
    throw new SpreadsheetError(
      'صيغة .xls القديمة ما تنقرأ — افتح الملف بالإكسل واحفظه بصيغة .xlsx أو CSV.',
    );
  }

  if (extension === 'xlsx') return readXlsx(file);
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') return readDelimited(file);

  throw new SpreadsheetError('نوع الملف غير مدعوم — استعمل .xlsx أو .csv.');
}

// ------------------------------------------------------------ delimited ----

/**
 * Which character separates the cells.
 *
 * Counted over the first few lines rather than assumed from the extension: a
 * file named `.csv` exported from an Arabic Windows is very often
 * semicolon-separated, because the list separator follows the regional
 * settings. Guessing wrong turns a two-column file into one column whose cells
 * all contain a semicolon.
 */
function sniffDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = [',', ';', '\t'].map((char) => ({
    char,
    count: sample.split(char).length - 1,
  }));
  const best = counts.sort((a, b) => b.count - a.count)[0];
  return best.count > 0 ? best.char : ',';
}

/**
 * A delimited file, quotes honoured.
 *
 * Written out rather than split on the delimiter because a quoted cell may
 * contain the delimiter, a newline, or a doubled quote standing for one — all
 * three appear in real exports, and all three break a `split()`.
 */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  // A BOM at the head of the file is not part of the first cell.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];

    if (quoted) {
      if (char !== '"') {
        cell += char;
        continue;
      }
      // A doubled quote inside a quoted cell is one literal quote.
      if (body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"' && cell === '') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (char === '\r') continue;
    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

async function readDelimited(file: File): Promise<Sheet> {
  const text = await file.text();
  const rows = parseDelimited(text, sniffDelimiter(text));
  // Nothing in a text file has been through a float, so every value is exact.
  return square({ fileName: file.name, sheetName: null, rows, imprecise: new Set<number>() });
}

// ----------------------------------------------------------------- xlsx ----

/**
 * The entries of a ZIP, by name.
 *
 * Read from the central directory at the end of the file rather than by
 * walking local headers from the front: a local header may say the size is
 * unknown and defer it to a descriptor after the data, which cannot be found
 * without already knowing where the data ends. The central directory always
 * carries the real sizes.
 */
async function unzip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const eocd = findEocd(view, bytes.length);
  if (eocd === -1) throw new SpreadsheetError('الملف مو ملف إكسل صالح.');

  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);

  const entries = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

    // The local header repeats the name and extra fields at its own lengths,
    // which are not always the central directory's — the data starts after it.
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(start, start + compressedSize);

    // Only the two methods Excel writes: stored, and deflate.
    if (method === 0) entries.set(name, raw);
    else if (method === 8) entries.set(name, await inflateRaw(raw));

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/**
 * The end-of-central-directory record.
 *
 * Searched backwards because it sits last, and its own length is variable —
 * a trailing comment of up to 64KB may follow it, so its position can only be
 * found by looking for the signature.
 */
function findEocd(view: DataView, length: number): number {
  const floor = Math.max(0, length - 0xffff - 22);
  for (let i = length - 22; i >= floor; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new SpreadsheetError('المتصفح ما يدعم فتح ملفات إكسل — استعمل CSV أو حدّث المتصفح.');
  }
  // Copied into a buffer of its own: `data` is a view onto the whole file, and
  // a Blob built from a view keeps the entire archive alive behind it.
  const copy = new Uint8Array(data.length);
  copy.set(data);

  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseXml(entry: Uint8Array | undefined): Document | null {
  if (!entry) return null;
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(entry), 'application/xml');
  return doc.getElementsByTagName('parsererror').length ? null : doc;
}

/**
 * Which worksheet to read, and what it is called.
 *
 * The first sheet in the workbook's own order, which is the one Excel opens on
 * and therefore the one the operator was looking at. Its part name comes from
 * the relationship id rather than being assumed to be `sheet1.xml` — the
 * numbering follows creation order, not tab order, so a workbook whose first
 * tab was added second names it `sheet2.xml`.
 */
function firstSheet(entries: Map<string, Uint8Array>): { path: string; name: string | null } {
  const fallback = { path: 'xl/worksheets/sheet1.xml', name: null };

  const workbook = parseXml(entries.get('xl/workbook.xml'));
  if (!workbook) return fallback;

  const sheet = workbook.getElementsByTagName('sheet')[0];
  if (!sheet) return fallback;

  const name = sheet.getAttribute('name');
  const relId = sheet.getAttribute('r:id') ?? sheet.getAttribute('id');

  const rels = parseXml(entries.get('xl/_rels/workbook.xml.rels'));
  if (rels && relId) {
    for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
      if (rel.getAttribute('Id') !== relId) continue;
      const target = (rel.getAttribute('Target') ?? '').replace(/^\/?xl\//, '').replace(/^\//, '');
      if (target) return { path: `xl/${target}`, name };
    }
  }
  return { path: fallback.path, name };
}

/**
 * The shared string table.
 *
 * Text cells do not hold their own text — they hold an index into this table,
 * which is how a spreadsheet of repeated words stays small. A string may be
 * split across several runs when parts of it are styled differently, so the
 * runs are joined back together.
 */
function sharedStrings(entries: Map<string, Uint8Array>): string[] {
  const doc = parseXml(entries.get('xl/sharedStrings.xml'));
  if (!doc) return [];

  return Array.from(doc.getElementsByTagName('si')).map((si) =>
    Array.from(si.getElementsByTagName('t'))
      // A phonetic guide is a separate <t> that is not part of the value.
      .filter((t) => t.parentElement?.tagName !== 'rPh')
      .map((t) => t.textContent ?? '')
      .join(''),
  );
}

/** `C` → 2. The column letters in a cell reference, as a zero-based index. */
function columnOf(reference: string): number {
  let index = 0;
  for (const char of reference) {
    const code = char.toUpperCase().charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return Math.max(0, index - 1);
}

/**
 * Whether a stored number has already lost digits.
 *
 * Excel keeps numbers as doubles, which hold 15 significant digits. A longer
 * card number typed into an unformatted cell is rounded on the way in and
 * written back out in exponential form, so a value that reaches us with an `e`
 * in it, or with more than 15 digits, is one the file itself no longer has.
 */
function isImprecise(raw: string): boolean {
  if (/e/i.test(raw)) return true;
  return raw.replace(/[^0-9]/g, '').length > 15;
}

async function readXlsx(file: File): Promise<Sheet> {
  const entries = await unzip(await file.arrayBuffer());
  const { path, name } = firstSheet(entries);

  const doc = parseXml(entries.get(path));
  if (!doc) throw new SpreadsheetError('ما كدرنا نقرأ أوراق الملف — تأكد إنه ملف إكسل صالح.');

  const strings = sharedStrings(entries);
  const rows: string[][] = [];
  const imprecise = new Set<number>();

  for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
    const row: string[] = [];

    for (const cell of Array.from(rowEl.getElementsByTagName('c'))) {
      const type = cell.getAttribute('t');
      const reference = cell.getAttribute('r') ?? '';
      // The reference is what places a cell, not its order: a row skips the
      // elements for cells that were never filled, so B and D in a row of four
      // arrive as two elements and must not collapse into the first two.
      const at = reference ? columnOf(reference) : row.length;

      let text = '';
      if (type === 'inlineStr') {
        text = Array.from(cell.getElementsByTagName('t'))
          .map((t) => t.textContent ?? '')
          .join('');
      } else {
        const value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
        if (type === 's') {
          text = strings[Number(value)] ?? '';
        } else {
          text = value;
          // `str` is a formula's text result; anything else untyped is numeric.
          if (value && type !== 'str' && isImprecise(value)) imprecise.add(at);
        }
      }

      while (row.length < at) row.push('');
      row[at] = text.trim();
    }

    rows.push(row);
  }

  return square({ fileName: file.name, sheetName: name, rows, imprecise });
}

// ---------------------------------------------------------------- shared ---

/**
 * Squares the rows off and drops the empty ones.
 *
 * Both formats produce ragged rows — a short row in a sheet simply ends, and a
 * trailing delimiter in a CSV adds a cell nobody typed. Padding to one width
 * means a column index is the same column on every row, which is the whole
 * basis of letting the operator choose one. Fully empty rows go, because a
 * sheet almost always has some below the data and they are not cards.
 */
function square(input: Omit<Sheet, 'columns'>): Sheet {
  const rows = input.rows.filter((row) => row.some((cell) => cell !== ''));
  const columns = rows.reduce((widest, row) => Math.max(widest, row.length), 0);

  return {
    ...input,
    columns,
    rows: rows.map((row) => {
      const padded = row.slice(0, columns);
      while (padded.length < columns) padded.push('');
      return padded.map((cell) => cell ?? '');
    }),
  };
}

/**
 * Whether the first row names the columns rather than holding data.
 *
 * Guessed, never assumed — the operator can overrule it — and the guess is
 * deliberately biased towards "no". Dropping a heading that was kept costs one
 * obviously-wrong row the operator sees in the preview; keeping a card that was
 * dropped costs a card that was paid for and never filed, and nothing later
 * ever looks wrong.
 *
 * So the test is the narrowest one that still recognises a real heading: every
 * filled cell in the row is free of digits, and at least one of them contains
 * letters. Headings are words — `Code`, `PIN`, `الكود` — and card numbers are
 * not, whether they are all digits or a mix like `SV-10023`.
 */
export function looksLikeHeader(rows: string[][]): boolean {
  const first = rows[0];
  if (!first || rows.length < 2) return false;

  const filled = first.filter((cell) => cell !== '');
  if (!filled.length) return false;

  const anyDigit = filled.some((cell) => /[0-9٠-٩]/.test(cell));
  const anyLetter = filled.some((cell) => /[A-Za-z؀-ۿ]/.test(cell));
  return !anyDigit && anyLetter;
}
