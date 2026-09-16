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
import { SalesPage } from '@/features/billing/SalesPage';
import { StockPage } from '@/features/stock/StockPage';
import { DrawsPage } from '@/features/draws/DrawsPage';
import { CouponsPage } from '@/features/draws/CouponsPage';
import { SlidesPage } from '@/features/content/SlidesPage';
import { VideosPage } from '@/features/content/VideosPage';
import { FaqPage } from '@/features/content/FaqPage';
import { TowersPage } from '@/features/content/TowersPage';
import { ContactPage } from '@/features/content/ContactPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { ProvincesPage } from '@/features/system/ProvincesPage';
import { ApiPage } from '@/features/system/ApiPage';
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
          <Route path="sales" element={<SalesPage />} />
          <Route path="stock" element={<StockPage />} />

          <Route path="draws" element={<DrawsPage />} />
          <Route path="coupons" element={<CouponsPage />} />

          <Route path="slides" element={<SlidesPage />} />
          <Route path="videos" element={<VideosPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="towers" element={<TowersPage />} />
          <Route path="contact" element={<ContactPage />} />

          <Route path="notifications" element={<NotificationsPage />} />

          <Route path="provinces" element={<ProvincesPage />} />
          <Route path="api" element={<ApiPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Screens that were renamed when the API wiring landed. */}
          <Route path="renewals" element={<Navigate to="/sales" replace />} />
          <Route path="governorates" element={<Navigate to="/provinces" replace />} />
          <Route path="offers" element={<Navigate to="/slides" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
