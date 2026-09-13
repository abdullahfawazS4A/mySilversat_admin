/**
 * The application frame: sidebar, topbar and the outlet every screen renders
 * into. Also the auth gate — an unauthenticated visitor never reaches a screen.
 */

import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Satellite, Search, User } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { NAV_GROUPS, titleForPath } from './navigation';
import { CommandPalette } from './CommandPalette';
import { Button, Pill, Skeleton } from '@/components/ui';
import { ADMIN_ROLE } from '@/lib/labels';
import { cx } from '@/lib/utils';

export function AdminShell() {
  const { status, session, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl/⌘+K from anywhere, including from inside a text field — the shortcut
  // is worth nothing if it only works when focus happens to be on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mirrors the app's router gate: unknown waits, unauthenticated redirects.
  if (status === 'unknown') {
    return (
      <div className="login-page">
        <div className="card login-card col" style={{ gap: 12 }}>
          <Skeleton h={18} w="55%" />
          <Skeleton h={12} />
          <Skeleton h={12} w="75%" />
        </div>
      </div>
    );
  }
  if (status === 'unauthenticated' || !session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }


  return (
    <div className={cx('shell', collapsed && 'collapsed')}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Satellite size={18} />
          </span>
          <div className="col brand-text">
            <span className="brand-name">سلفرسات</span>
            <span className="brand-sub">لوحة التحكم</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  title={item.label}
                  className={({ isActive }) => cx('nav-link', isActive && 'active')}
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button className="nav-link" onClick={() => void signOut()} style={{ width: '100%' }}>
            <LogOut size={17} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Button
            variant="ghost"
            size="sm"
            icon={<Menu size={17} />}
            title="طي القائمة"
            onClick={() => setCollapsed((c) => !c)}
          />
          <h1 className="truncate">{titleForPath(location.pathname)}</h1>

          {/*
            The palette trigger sits in the header rather than only on the
            keyboard: an operator who never learns the shortcut still gets the
            fast path, and the visible shortcut teaches it.
          */}
          <button className="palette-trigger grow" onClick={() => setPaletteOpen(true)}>
            <Search size={14} />
            <span className="grow truncate">روح لأي شاشة…</span>
            <kbd className="kbd">Ctrl</kbd>
            <kbd className="kbd">K</kbd>
          </button>


          <div className="row row-gap-2">
            <span className="chip-icon" style={{ width: 32, height: 32 }}>
              <User size={16} />
            </span>
            <div className="col" style={{ lineHeight: 1.3 }}>
              <span className="fs-12 strong">{session.admin.name}</span>
              <span className="fs-11 dim num">{session.admin.phone}</span>
            </div>
            <Pill tone={ADMIN_ROLE[session.admin.role].tone}>
              {ADMIN_ROLE[session.admin.role].label}
            </Pill>
          </div>
        </header>

        <Outlet />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

    </div>
  );
}
