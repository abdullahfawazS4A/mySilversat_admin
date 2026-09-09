/**
 * The application frame: sidebar, topbar and the outlet every screen renders
 * into. Also the auth gate — an unauthenticated visitor never reaches a screen.
 */

import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, RefreshCw, Satellite, User } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useRepos } from '@/app/RepositoryContext';
import { useToast } from '@/app/ToastContext';
import { NAV_GROUPS, titleForPath } from './navigation';
import { Button, ConfirmDialog, Skeleton } from '@/components/ui';
import { cx } from '@/lib/utils';

export function AdminShell() {
  const { status, session, signOut } = useAuth();
  const location = useLocation();
  const repos = useRepos();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  const runReset = async () => {
    setResetting(true);
    try {
      await repos.admin.resetMockData();
      toast('رجعت البيانات التجريبية للحالة الأصلية');
      // A full reload is the honest way to drop every cached screen state.
      window.location.reload();
    } catch {
      toast('تعذّرت إعادة التعيين', 'error');
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

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
          <h1 className="grow truncate">{titleForPath(location.pathname)}</h1>

          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={15} />}
            title="إعادة تحميل البيانات التجريبية"
            onClick={() => setConfirmReset(true)}
          />

          <div className="row row-gap-2">
            <span className="chip-icon" style={{ width: 32, height: 32 }}>
              <User size={16} />
            </span>
            <div className="col" style={{ lineHeight: 1.3 }}>
              <span className="fs-12 strong">{session.admin.fullName}</span>
              <span className="fs-11 dim">{session.admin.username}</span>
            </div>
          </div>
        </header>

        <Outlet />
      </div>

      {confirmReset ? (
        <ConfirmDialog
          title="إعادة تحميل البيانات التجريبية"
          message="كل التعديلات اللي سويتها بهذه الجلسة راح تنمسح وترجع البيانات لحالتها الأصلية. تريد تكمل؟"
          confirmLabel="إعادة التعيين"
          danger
          pending={resetting}
          onConfirm={() => void runReset()}
          onCancel={() => setConfirmReset(false)}
        />
      ) : null}
    </div>
  );
}
