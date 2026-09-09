/**
 * The route table.
 *
 * Every authenticated screen is a child of `AdminShell`, which owns the auth
 * gate — a route never checks the session itself. `/login` sits outside the
 * shell because it is the only screen an unauthenticated visitor may see.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminShell } from '@/layout/AdminShell';

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
import { AuditPage } from '@/features/system/AuditPage';
import { SettingsPage } from '@/features/system/SettingsPage';

export function AppRouter() {
  // The v7 flags are opt-ins, not experiments — turning them on now keeps the
  // console quiet and the eventual upgrade uneventful.
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AdminShell />}>
          <Route index element={<DashboardPage />} />

          <Route path="matches" element={<MatchesPage />} />
          <Route path="leagues" element={<LeaguesPage />} />
          <Route path="predictions" element={<PredictionsPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />

          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="renewals" element={<RenewalsPage />} />
          <Route path="packages" element={<PackagesPage />} />
          <Route path="agents" element={<AgentsPage />} />

          <Route path="draws" element={<DrawsPage />} />
          <Route path="coupons" element={<CouponsPage />} />

          <Route path="offers" element={<OffersPage />} />
          <Route path="slides" element={<SlidesPage />} />
          <Route path="videos" element={<VideosPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="towers" element={<TowersPage />} />

          <Route path="notifications" element={<NotificationsPage />} />

          <Route path="governorates" element={<GovernoratesPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
