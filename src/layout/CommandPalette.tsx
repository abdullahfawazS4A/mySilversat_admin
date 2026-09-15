/**
 * Command palette — Ctrl/⌘ + K.
 *
 * The console has twenty-four screens across seven groups. Reaching a rarely
 * used one (the audit log, the tower list) means scanning a sidebar that is
 * mostly things you did not want. This is the shortcut: type two letters of
 * what you want and press Enter.
 *
 * It reads `NAV_ITEMS` rather than its own list, so a screen added to the
 * navigation map is searchable here the same day — that is the whole reason
 * `NavItem.hint` exists. The hint is searched too, so "كارت" finds the stock
 * screen even though its label says "مخزن الكارتات".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { NAV_GROUPS, type NavItem } from './navigation';
import { matchesSearch } from '@/lib/utils';

interface Hit extends NavItem {
  group: string;
}

const ALL_HITS: Hit[] = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title })),
);

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    const needle = query.trim();
    if (!needle) return ALL_HITS;
    return ALL_HITS.filter(
      (hit) => matchesSearch(hit.label, needle) || matchesSearch(hit.hint, needle),
    );
  }, [query]);

  // Every open starts clean, and the cursor never points past a shortened list.
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    navigate(hit.path);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (hits.length ? (c + 1) % hits.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (hits.length ? (c - 1 + hits.length) % hits.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[cursor]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop palette-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="بحث في الشاشات">
        <div className="palette-search">
          <Search size={16} />
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            placeholder="روح لأي شاشة… (مثال: مخزن، تجديد، سجل)"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div className="palette-list" ref={listRef}>
          {hits.length === 0 ? (
            <div className="palette-empty">ما بيه شاشة بهذا الاسم</div>
          ) : (
            hits.map((hit, index) => {
              const Icon = hit.icon;
              return (
                <button
                  key={hit.path}
                  type="button"
                  data-active={index === cursor}
                  className={`palette-row${index === cursor ? ' active' : ''}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(hit)}
                >
                  <span className="chip-icon" style={{ width: 30, height: 30 }}>
                    <Icon size={15} />
                  </span>
                  <span className="col grow" style={{ minWidth: 0, lineHeight: 1.35 }}>
                    <span className="fs-body strong truncate">{hit.label}</span>
                    <span className="fs-tiny dim truncate">{hit.hint}</span>
                  </span>
                  <span className="fs-tiny muted">{hit.group}</span>
                  {index === cursor ? <CornerDownLeft size={13} className="dim" /> : null}
                </button>
              );
            })
          )}
        </div>

        <div className="palette-foot">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> تنقّل
          </span>
          <span>
            <kbd className="kbd">Enter</kbd> افتح
          </span>
          <span>
            <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">K</kbd> في أي وقت
          </span>
        </div>
      </div>
    </div>
  );
}
