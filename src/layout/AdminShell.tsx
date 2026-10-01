/**
 * The application frame: sidebar, topbar and the outlet every screen renders
 * into. Also the auth gate — an unauthenticated visitor never reaches a screen.
 */

import { Suspense, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft, LogOut, Menu, Satellite, Search } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { NAV_GROUPS, groupForPath, titleForPath } from './navigation';
import { CommandPalette } from './CommandPalette';
import { Button, Pill, Skeleton, TableSkeleton } from '@/components/ui';
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
        <div className="card login-card col row-gap-3">
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


  const pageTitle = titleForPath(location.pathname);
  // The dashboard's group ("عام") says nothing the title doesn't, so the
  // breadcrumb only appears on screens that live inside a real section.
  const crumbGroup = location.pathname === '/' ? null : groupForPath(location.pathname);

  return (
    <div className={cx('shell', collapsed && 'collapsed')}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          {/* The wordmark needs the full sidebar; a collapsed one keeps the square mark. */}
          <span className="brand-mark brand-mark-collapsed">
            <Satellite size={18} />
          </span>
          <div className="brand-text">
            <img className="brand-logo brand-logo-sidebar" src="/brand/logo.png" alt="MY SILVERSAT" />
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="nav-group">
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  title={item.label}
                  className={({ isActive }) => cx('nav-link', isActive && 'active')}
                >
                  <item.icon size={18} strokeWidth={1.9} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="nav-link" title="تسجيل الخروج" onClick={() => void signOut()}>
            <LogOut size={18} strokeWidth={1.9} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Button
            variant="ghost"
            size="sm"
            icon={<Menu size={18} />}
            title="طي القائمة"
            onClick={() => setCollapsed((c) => !c)}
          />
          <div className="topbar-crumb">
            {crumbGroup && crumbGroup !== pageTitle ? (
              <>
                <span className="crumb-group">{crumbGroup}</span>
                <ChevronLeft size={14} />
              </>
            ) : null}
            <h1 className="truncate">{pageTitle}</h1>
          </div>

          <span className="topbar-spacer" />

          {/*
            The palette trigger sits in the header rather than only on the
            keyboard: an operator who never learns the shortcut still gets the
            fast path, and the visible shortcut teaches it.
          */}
          <button type="button" className="palette-trigger" onClick={() => setPaletteOpen(true)}>
            <Search size={15} />
            <span className="grow truncate">روح لأي شاشة…</span>
            <span className="kbd-combo" dir="ltr">
              <kbd className="kbd">Ctrl</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </button>

          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">
              {session.admin.name.trim().charAt(0) || '؟'}
            </span>
            <div className="topbar-user-text">
              <span className="fs-small strong truncate">{session.admin.name}</span>
              <span className="fs-micro dim num">{session.admin.phone}</span>
            </div>
            <Pill tone={ADMIN_ROLE[session.admin.role].tone}>
              {ADMIN_ROLE[session.admin.role].label}
            </Pill>
          </div>
        </header>

        {/* Screens are loaded on first visit (see AppRouter); the frame stays up meanwhile. */}
        <Suspense
          fallback={
            <div className="page">
              <TableSkeleton />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

    </div>
  );
}
