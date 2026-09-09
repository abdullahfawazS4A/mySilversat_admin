/**
 * The console's component vocabulary.
 *
 * Screens compose from these; they do not style raw elements. The rules are
 * the same ones the Flutter app enforces: one card, one primary button, one
 * icon-chip treatment, and semantic colors reserved for state.
 */

import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, Inbox, Search, X } from 'lucide-react';
import { cx } from '@/lib/utils';

// ------------------------------------------------------------------ card ---

export function Card({
  children,
  className,
  pad,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Adds the standard inner padding. Omit for tables that bleed to the edge. */
  pad?: boolean;
  /** Layout only — gap, min-width, grid placement. Never colors or borders. */
  style?: CSSProperties;
}) {
  return (
    <div className={cx('card', pad && 'card-pad', className)} style={style}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div className="col">
        <h3>{title}</h3>
        {subtitle ? <span className="fs-12 muted">{subtitle}</span> : null}
      </div>
      {actions ? <div className="row row-gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- button ---

type ButtonVariant = 'primary' | 'subtle' | 'ghost' | 'outline' | 'danger';

export function Button({
  children,
  onClick,
  variant = 'subtle',
  type = 'button',
  disabled,
  size,
  icon,
  title,
  className,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: 'sm';
  icon?: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', !children && 'btn-icon', className)}
    >
      {icon}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ pill ---

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'live' | 'gold' | 'muted';

export function Pill({
  children,
  tone = 'neutral',
  dot,
}: {
  children: ReactNode;
  tone?: PillTone;
  dot?: boolean;
}) {
  return (
    <span className={cx('pill', `pill-${tone}`)}>
      {dot ? <span className="pill-dot" /> : null}
      {children}
    </span>
  );
}

// ------------------------------------------------------------- icon chip ---

export function IconChip({
  children,
  tone,
  large,
}: {
  children: ReactNode;
  /** State tones only. Category identity is carried by the glyph, not color. */
  tone?: 'success' | 'warning' | 'danger' | 'gold';
  large?: boolean;
}) {
  return (
    <span className={cx('chip-icon', large && 'chip-icon-lg', tone && `chip-${tone}`)}>
      {children}
    </span>
  );
}

// ----------------------------------------------------------------- fields --

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('field', className)}>
      {label ? <label className="field-label">{label}</label> : null}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  min,
  max,
  step,
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'password' | 'datetime-local' | 'date' | 'tel' | 'url';
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      className="input"
      type={type}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="textarea"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      className="select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className="switch" title={title}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track">
        <span className="switch-thumb" />
      </span>
      {label ? <span className="switch-label">{label}</span> : null}
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'بحث…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-wrap grow">
      <input
        className="input input-search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <Search size={15} />
    </div>
  );
}

// ------------------------------------------------------------------ tabs ---

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={item.value === value}
          className={cx('tab', item.value === value && 'active')}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function FilterChips<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="chips">
      {items.map((item) => (
        <button
          key={item.value}
          className={cx('chip', item.value === value && 'active')}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {typeof item.count === 'number' ? <span className="dim num">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------- states & notices --

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon ?? <Inbox size={22} />}</span>
      <div className="col center">
        <span className="strong" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        {hint ? <span className="fs-12 mt-1">{hint}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function Notice({
  children,
  tone = 'info',
  icon,
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}) {
  return (
    <div className={cx('notice', `notice-${tone}`)}>
      {icon}
      <div className="grow">{children}</div>
    </div>
  );
}

export function Skeleton({ w, h = 14, className }: { w?: number | string; h?: number; className?: string }) {
  return <div className={cx('skeleton', className)} style={{ width: w ?? '100%', height: h }} />;
}

/** Placeholder rows sized like the table they stand in for. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="row row-gap-4" style={{ padding: '9px 0' }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} w={c === 0 ? '22%' : `${Math.max(10, 60 / cols)}%`} h={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Renders one of loading / error / empty / content, like the app's `.when()`. */
/**
 * Whether a settled value is "nothing yet" — an empty array, or a paged
 * envelope with no items. Used only to decide between a skeleton and a stale
 * render during a refetch, so a wrong guess costs a skeleton, never data.
 */
function isEmptyPage(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (data && typeof data === 'object' && 'items' in data) {
    const items = (data as { items: unknown }).items;
    return Array.isArray(items) && items.length === 0;
  }
  return false;
}

export function AsyncBlock<T>({
  state,
  children,
  skeleton,
  emptyWhen,
  empty,
}: {
  state: { data: T | undefined; loading: boolean; error: string | null; reload: () => void };
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  emptyWhen?: (data: T) => boolean;
  empty?: ReactNode;
}) {
  // Show the skeleton on any load that has nothing settled yet, and on a
  // refetch whose previous answer was empty. Without the second case a screen
  // whose first query resolved to an empty page — a filter that had not been
  // resolved yet, say — flashed "no data" over a query that was still running.
  const emptyNow = state.data !== undefined && (emptyWhen?.(state.data) ?? isEmptyPage(state.data));
  if (state.loading && (state.data === undefined || emptyNow)) {
    return <>{skeleton ?? <TableSkeleton />}</>;
  }
  if (state.error) {
    return (
      <div className="empty">
        <span className="empty-icon chip-danger">
          <X size={22} />
        </span>
        <span className="strong" style={{ color: 'var(--danger)' }}>
          {state.error}
        </span>
        <Button variant="outline" size="sm" onClick={state.reload}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }
  if (state.data === undefined) return null;
  if (emptyWhen?.(state.data)) return <>{empty ?? <EmptyState title="لا توجد بيانات" />}</>;
  return <>{children(state.data)}</>;
}

// ----------------------------------------------------------------- modal ---

export function Modal({
  title,
  onClose,
  children,
  footer,
  size,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'lg' | 'xl';
}) {
  // Escape closes; the body scroll is locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', size && `modal-${size}`)} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} icon={<X size={17} />} title="إغلاق" />
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/** A yes/no gate for destructive actions. Never used for reversible ones. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'تأكيد',
  danger,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending}>
            {pending ? 'جاري التنفيذ…' : confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="fs-13" style={{ lineHeight: 1.7 }}>
        {message}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ pagination ---

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // Show a sliding window of at most five page buttons around the current one.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const windowed = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);

  return (
    <div className="pagination">
      <span>
        <span className="num">{from}</span>–<span className="num">{to}</span> من{' '}
        <span className="num strong">{total}</span>
      </span>
      <div className="page-btns">
        <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} title="السابق">
          <ChevronRight size={14} />
        </button>
        {windowed.map((p) => (
          <button key={p} className={cx('page-btn', p === page && 'active')} onClick={() => onPage(p)}>
            <span className="num">{p}</span>
          </button>
        ))}
        <button className="page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} title="التالي">
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- team crests ---

/**
 * The eight crest gradients the app draws letter crests with. Kept as literal
 * pairs here because they are art, not palette tokens — the same exception the
 * Flutter app makes for `teamCrest`.
 */
const CREST_GRADIENTS: [string, string][] = [
  ['#6D8FB8', '#3F6390'],
  ['#C9A227', '#9C7A15'],
  ['#C0392B', '#8E2B20'],
  ['#2E7D6B', '#1E5A4C'],
  ['#4A5568', '#2D3748'],
  ['#7B5AA6', '#553C7B'],
  ['#B85C38', '#8A4228'],
  ['#2F5FA8', '#1F4278'],
];

export function TeamCrest({ name, seed, size = 30 }: { name: string; seed: number; size?: number }) {
  const [from, to] = CREST_GRADIENTS[seed % CREST_GRADIENTS.length];
  return (
    <span
      className="crest"
      title={name}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(140deg, ${from}, ${to})`,
      }}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

// -------------------------------------------------------------- key/value --

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([key, value], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ----------------------------------------------------- controlled helpers --

/**
 * Local form state helper. Screens edit a draft copy and only call the
 * repository on save, so a cancelled dialog never touches the store.
 */
export function useDraft<T extends object>(initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const set = <K extends keyof T>(key: K, value: T[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return { draft, set, setDraft };
}

/** Generates a stable id for label/input pairs. */
export function useFieldId(prefix: string): string {
  const id = useId();
  return `${prefix}-${id}`;
}
