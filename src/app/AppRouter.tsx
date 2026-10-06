/**
 * The route table.
 *
 * Every authenticated screen is a child of `AdminShell`, which owns the auth
 * gate — a route never checks the session itself. `/login` sits outside the
 * shell because it is the only screen an unauthenticated visitor may see.
 */

import { lazy, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminShell } from '@/layout/AdminShell';

import { LoginPage } from '@/features/LoginPage';
import { DashboardPage } from '@/features/DashboardPage';

/**
 * A screen loaded on first visit rather than with the console.
 *
 * Login and the dashboard stay in the main bundle because one of them is what
 * every visit opens on. The rest are split out, so opening the console no
 * longer parses the code of twenty screens nobody has asked for yet. The
 * `Suspense` that covers the wait lives around the shell's `Outlet`, so the
 * sidebar and topbar stay put while a screen arrives.
 */
function page<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

const MatchesPage = page(() => import('@/features/matches/MatchesPage'), 'MatchesPage');
const LeaguesPage = page(() => import('@/features/matches/LeaguesPage'), 'LeaguesPage');
const PredictionsPage = page(() => import('@/features/predictions/PredictionsPage'), 'PredictionsPage');
const LeaderboardPage = page(() => import('@/features/predictions/LeaderboardPage'), 'LeaderboardPage');
const UsersPage = page(() => import('@/features/users/UsersPage'), 'UsersPage');
const UserDetailPage = page(() => import('@/features/users/UserDetailPage'), 'UserDetailPage');
const DevicesPage = page(() => import('@/features/devices/DevicesPage'), 'DevicesPage');
const SalesPage = page(() => import('@/features/billing/SalesPage'), 'SalesPage');
const StockPage = page(() => import('@/features/stock/StockPage'), 'StockPage');
const DrawsPage = page(() => import('@/features/draws/DrawsPage'), 'DrawsPage');
const CouponsPage = page(() => import('@/features/draws/CouponsPage'), 'CouponsPage');
const SlidesPage = page(() => import('@/features/content/SlidesPage'), 'SlidesPage');
const VideosPage = page(() => import('@/features/content/VideosPage'), 'VideosPage');
const FaqPage = page(() => import('@/features/content/FaqPage'), 'FaqPage');
const TowersPage = page(() => import('@/features/content/TowersPage'), 'TowersPage');
const ContactPage = page(() => import('@/features/content/ContactPage'), 'ContactPage');
const NotificationsPage = page(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage');
const ProvincesPage = page(() => import('@/features/system/ProvincesPage'), 'ProvincesPage');
const ApiPage = page(() => import('@/features/system/ApiPage'), 'ApiPage');
const AppVersionPage = page(() => import('@/features/system/AppVersionPage'), 'AppVersionPage');
const SettingsPage = page(() => import('@/features/system/SettingsPage'), 'SettingsPage');

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
          <Route path="app-version" element={<AppVersionPage />} />
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
