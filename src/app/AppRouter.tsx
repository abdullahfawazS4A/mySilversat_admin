/**
 * The route table.
 *
 * Every authenticated screen is a child of `AdminShell`, which owns the auth
 * gate — a route never checks the session itself. `/login` sits outside the
 * shell because it is the only screen an unauthenticated visitor may see.
 *
 * The permission a route needs is declared once in `layout/navigation.ts`;
 * `Guarded` reads it from there, so hiding a screen from a role is a one-line
 * change in the navigation map rather than an edit here.
 */

import { type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AdminShell } from '@/layout/AdminShell';
import { NAV_ITEMS } from '@/layout/navigation';
import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/page';

import { LoginPage } from '@/features/LoginPage';
import { DashboardPage } from '@/features/DashboardPage';
import { MatchesPage } from '@/features/matches/MatchesPage';
import { LeaguesPage } from '@/features/matches/LeaguesPage';
import { PredictionsPage } from '@/features/predictions/PredictionsPage';
import { LeaderboardPage } from '@/features/predictions/LeaderboardPage';
import { UsersPage } from '@/features/users/UsersPage';
import { UserDetailPage } from '@/features/users/UserDetailPage';
import { DevicesPage } from '@/features/devices/DevicesPage';
import { RenewalsPage } from '@/features/billing/RenewalsPage';
import { PackagesPage } from '@/features/billing/PackagesPage';
import { AgentsPage } from '@/features/billing/AgentsPage';
import { DrawsPage } from '@/features/draws/DrawsPage';
import { CouponsPage } from '@/features/draws/CouponsPage';
import { OffersPage } from '@/features/content/OffersPage';
import { SlidesPage } from '@/features/content/SlidesPage';
import { VideosPage } from '@/features/content/VideosPage';
import { FaqPage } from '@/features/content/FaqPage';
import { TowersPage } from '@/features/content/TowersPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { GovernoratesPage } from '@/features/system/GovernoratesPage';
import { AdminsPage } from '@/features/system/AdminsPage';
import { AuditPage } from '@/features/system/AuditPage';
import { SettingsPage } from '@/features/system/SettingsPage';

/**
 * Renders a screen only when the signed-in role holds the permission its nav
 * entry declares. A role that reaches a forbidden URL by typing it gets an
 * explanation, not a blank page.
 */
function Guarded({ path, children }: { path: string; children: ReactNode }) {
  const { can } = useAuth();
  const item = NAV_ITEMS.find((entry) => entry.path === path);
  if (item && !can(item.permission)) {
    return (
      <>
        <PageHeader title="غير مسموح" />
        <div className="page">
          <EmptyState
            title="ما عندك صلاحية على هذه الشاشة"
            hint="راجع مالك النظام إذا تحتاج الوصول لها."
          />
        </div>
      </>
    );
  }
  return <>{children}</>;
}

export function AppRouter() {
  // The v7 flags are opt-ins, not experiments — turning them on now keeps the
  // console quiet and the eventual upgrade uneventful.
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AdminShell />}>
          <Route index element={<Guarded path="/"><DashboardPage /></Guarded>} />

          <Route path="matches" element={<Guarded path="/matches"><MatchesPage /></Guarded>} />
          <Route path="leagues" element={<Guarded path="/leagues"><LeaguesPage /></Guarded>} />
          <Route path="predictions" element={<Guarded path="/predictions"><PredictionsPage /></Guarded>} />
          <Route path="leaderboard" element={<Guarded path="/leaderboard"><LeaderboardPage /></Guarded>} />

          <Route path="users" element={<Guarded path="/users"><UsersPage /></Guarded>} />
          <Route path="users/:userId" element={<Guarded path="/users"><UserDetailPage /></Guarded>} />
          <Route path="devices" element={<Guarded path="/devices"><DevicesPage /></Guarded>} />
          <Route path="renewals" element={<Guarded path="/renewals"><RenewalsPage /></Guarded>} />
          <Route path="packages" element={<Guarded path="/packages"><PackagesPage /></Guarded>} />
          <Route path="agents" element={<Guarded path="/agents"><AgentsPage /></Guarded>} />

          <Route path="draws" element={<Guarded path="/draws"><DrawsPage /></Guarded>} />
          <Route path="coupons" element={<Guarded path="/coupons"><CouponsPage /></Guarded>} />

          <Route path="offers" element={<Guarded path="/offers"><OffersPage /></Guarded>} />
          <Route path="slides" element={<Guarded path="/slides"><SlidesPage /></Guarded>} />
          <Route path="videos" element={<Guarded path="/videos"><VideosPage /></Guarded>} />
          <Route path="faq" element={<Guarded path="/faq"><FaqPage /></Guarded>} />
          <Route path="towers" element={<Guarded path="/towers"><TowersPage /></Guarded>} />

          <Route path="notifications" element={<Guarded path="/notifications"><NotificationsPage /></Guarded>} />

          <Route path="governorates" element={<Guarded path="/governorates"><GovernoratesPage /></Guarded>} />
          <Route path="admins" element={<Guarded path="/admins"><AdminsPage /></Guarded>} />
          <Route path="audit" element={<Guarded path="/audit"><AuditPage /></Guarded>} />
          <Route path="settings" element={<Guarded path="/settings"><SettingsPage /></Guarded>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
