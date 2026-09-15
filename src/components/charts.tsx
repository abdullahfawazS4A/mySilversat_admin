/**
 * Charts.
 *
 * Hand-drawn SVG rather than a charting library: the console needs five chart
 * shapes, all simple, and a library would pull in its own color and typography
 * opinions that fight the design system.
 *
 * Color rules that apply here and are NOT negotiable:
 *
 *  - The categorical series colors below are their own namespace. They are
 *    deliberately NOT the semantic tokens (success/warning/danger), because in
 *    this design system a semantic color means a *state* — reusing green for
 *    "series 3" would make green stop meaning "healthy".
 *  - Categorical hues are assigned in fixed order and never cycled. A sixth
 *    category folds into "أخرى" rather than inventing a hue.
 *  - Magnitude-by-identity (the governorate ranking) is one hue, not a rainbow:
 *    identity is carried by the row label, so color would be redundant ink.
 *  - The palette was validated with the dataviz validator: lightness band,
 *    chroma floor, colorblind separation and normal-vision separation all pass.
 *    The amber slot sits below 3:1 against the surface, which is why every
 *    chart that uses it also carries a direct value label and a legend.
 */

import { useState, type ReactNode } from 'react';
import { formatNumber } from '@/lib/format';

/** The fixed categorical order. Never reorder; never cycle past the end. */
export const SERIES_COLORS = ['#2E6BA8', '#E0A63A', '#0E9B77', '#8A55C8', '#D64B33'] as const;

const AXIS = 'var(--text-tertiary)';
const GRID = 'var(--divider)';
const INK = 'var(--brand-primary)';

export interface Point {
  label: string;
  value: number;
}

// ------------------------------------------------------------ stat tiles ---

/**
 * A headline number. This is the "not a chart" answer: one value, read at a
 * glance, with an optional comparison to the previous period.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
  delta,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'gold';
  /** Fractional change vs. the previous period; null hides the comparison. */
  delta?: number | null;
}) {
  return (
    <div className="card card-pad col" style={{ gap: 10, minWidth: 0 }}>
      <div className="row between row-gap-3">
        <span className="fs-small muted truncate">{label}</span>
        {icon ? (
          <span className={`chip-icon${tone ? ` chip-${tone}` : ''}`} style={{ width: 30, height: 30 }}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="fs-hero strong num" style={{ lineHeight: 1.25 }}>
        {value}
      </div>
      <div className="row row-gap-2">
        {typeof delta === 'number' ? (
          <span
            className="fs-small strong num"
            style={{ color: delta >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span className="fs-small dim truncate">{hint}</span> : null}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- trend chart ---

/**
 * Change over time, one series at a time.
 *
 * Deliberately single-series: revenue (dinars) and renewal count live on
 * different scales, and a second y-axis is the single worst chart mistake, so
 * the caller toggles between them instead.
 */
export function TrendChart({
  points,
  format = (v) => formatNumber(v),
  height = 200,
}: {
  points: Point[];
  format?: (value: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const w = 720;
  const h = height;
  const padX = 44;
  const padTop = 16;
  const padBottom = 26;
  const plotW = w - padX * 2;
  const plotH = h - padTop - padBottom;

  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) => padX + (plotW * i) / Math.max(1, points.length - 1);
  const y = (v: number) => padTop + plotH - (plotH * v) / max;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${padTop + plotH} L${x(0)},${padTop + plotH} Z`;

  // Four gridlines is enough to read a level without turning into a ledger.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ v: max * t, y: y(max * t) }));

  return (
    <div style={{ direction: 'ltr', position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INK} stopOpacity="0.22" />
            <stop offset="100%" stopColor={INK} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((tick, i) => (
          <g key={i}>
            <line x1={padX} x2={w - padX} y1={tick.y} y2={tick.y} stroke={GRID} strokeWidth="1" />
            <text x={padX - 8} y={tick.y + 4} fill={AXIS} fontSize="11" textAnchor="end">
              {formatNumber(Math.round(tick.v))}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#trendFill)" />
        <path d={line} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((point, i) => (
          <g key={i}>
            <text x={x(i)} y={h - 8} fill={AXIS} fontSize="11" textAnchor="middle">
              {point.label.slice(0, 6)}
            </text>
            {/* A wide invisible target so hovering never demands precision. */}
            <rect
              x={x(i) - plotW / points.length / 2}
              y={padTop}
              width={plotW / points.length}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {hover === i ? (
              <>
                <line x1={x(i)} x2={x(i)} y1={padTop} y2={padTop + plotH} stroke={INK} strokeWidth="1" strokeDasharray="3 3" />
                {/* 2px surface ring so the marker reads over the area fill. */}
                <circle cx={x(i)} cy={y(point.value)} r="5" fill={INK} stroke="var(--bg-surface)" strokeWidth="2" />
              </>
            ) : null}
          </g>
        ))}
      </svg>

      {hover !== null ? (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: 4,
            left: `${(hover / Math.max(1, points.length - 1)) * 100}%`,
            transform: 'translateX(-50%)',
            padding: '7px 11px',
            pointerEvents: 'none',
            direction: 'rtl',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-raised)',
          }}
        >
          <div className="fs-tiny muted">{points[hover].label}</div>
          <div className="fs-body strong num">{format(points[hover].value)}</div>
        </div>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------- bar list ---

/**
 * Magnitude ranked by identity — one hue, because the row label already
 * carries identity and a rainbow here would be pure decoration.
 */
export function BarList({
  points,
  max: maxOverride,
  format = (v) => formatNumber(v),
  limit,
}: {
  points: Point[];
  max?: number;
  format?: (value: number) => string;
  limit?: number;
}) {
  const shown = limit ? points.slice(0, limit) : points;
  const max = maxOverride ?? Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="col" style={{ gap: 10 }}>
      {shown.map((point) => (
        <div key={point.label} className="col" style={{ gap: 5 }}>
          <div className="row between fs-small">
            <span className="truncate">{point.label}</span>
            <span className="strong num">{format(point.value)}</span>
          </div>
          <div className="meter">
            <div
              className="meter-fill"
              style={{
                width: `${(point.value / max) * 100}%`,
                background: INK,
                borderRadius: 'var(--r-pill)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- split bar ---

/**
 * Part-to-whole across a handful of categories.
 *
 * A single 100% bar rather than a donut: angles are harder to compare than
 * lengths, and the legend can carry the exact values. Segments are separated
 * by a 2px surface gap so adjacent fills never blend into one block.
 */
export function SplitBar({
  points,
  format = (v) => formatNumber(v),
}: {
  points: Point[];
  format?: (value: number) => string;
}) {
  const total = points.reduce((sum, p) => sum + p.value, 0) || 1;
  // Past five categories, everything else folds into one "أخرى" slot rather
  // than generating a sixth hue.
  const head = points.slice(0, SERIES_COLORS.length - 1);
  const tail = points.slice(SERIES_COLORS.length - 1);
  const series = tail.length
    ? [...head, { label: 'أخرى', value: tail.reduce((s, p) => s + p.value, 0) }]
    : head.concat(points.slice(head.length, SERIES_COLORS.length));

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ height: 12, gap: 2 }}>
        {series.map((point, i) => (
          <div
            key={point.label}
            title={`${point.label}: ${format(point.value)}`}
            style={{
              width: `${(point.value / total) * 100}%`,
              height: '100%',
              background: SERIES_COLORS[i],
              borderRadius: 4,
              minWidth: 3,
            }}
          />
        ))}
      </div>
      <div className="chart-legend">
        {series.map((point, i) => (
          <span key={point.label} className="row row-gap-2">
            <span className="legend-swatch" style={{ background: SERIES_COLORS[i] }} />
            <span>{point.label}</span>
            <span className="strong num" style={{ color: 'var(--text-primary)' }}>
              {format(point.value)}
            </span>
            <span className="dim num">{Math.round((point.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------- sentiment meter ---

/**
 * The three-way prediction split on a fixture. Home/draw/away is an ordered
 * polarity, so it reads as one bar with the draw as the neutral middle.
 */
export function SentimentMeter({
  homeLabel,
  awayLabel,
  homeWin,
  draw,
  awayWin,
}: {
  homeLabel: string;
  awayLabel: string;
  homeWin: number;
  draw: number;
  awayWin: number;
}) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row between fs-small">
        <span className="truncate">{homeLabel}</span>
        <span className="dim">تعادل</span>
        <span className="truncate">{awayLabel}</span>
      </div>
      <div className="row" style={{ height: 10, gap: 2 }}>
        <div style={{ width: pct(homeWin), background: SERIES_COLORS[0], borderRadius: 4, minWidth: 2 }} />
        <div style={{ width: pct(draw), background: 'var(--text-tertiary)', borderRadius: 4, minWidth: 2 }} />
        <div style={{ width: pct(awayWin), background: SERIES_COLORS[3], borderRadius: 4, minWidth: 2 }} />
      </div>
      <div className="row between fs-small strong num">
        <span>{pct(homeWin)}</span>
        <span className="dim">{pct(draw)}</span>
        <span>{pct(awayWin)}</span>
      </div>
    </div>
  );
}

// --------------------------------------------------------- progress meter --

/**
 * Subscription health. This one DOES use semantic color, because here the
 * color is reporting a state (healthy vs. expiring), not identifying a series.
 */
export function HealthMeter({ ratio, warning }: { ratio: number; warning?: boolean }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className="meter" style={{ height: 6 }}>
      <div
        className="meter-fill"
        style={{
          width: `${clamped * 100}%`,
          background: warning
            ? 'linear-gradient(90deg, var(--warning), var(--warning-light))'
            : 'linear-gradient(90deg, var(--success), var(--success-light))',
          borderRadius: 'var(--r-pill)',
        }}
      />
    </div>
  );
}
