import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import PWAInstaller from '@/components/pwa-installer';

// Vistas
import GalleryPage from '@/pages/gallery';
import DashboardPage from '@/pages/dashboard';
import AlbumsPage from '@/pages/albums';
import VaultPage from '@/pages/vault';
import WorldPage from '@/pages/world';
import TimelinePage from '@/pages/timeline';
import HistoryPage from '@/pages/history';
import EditorPage from '@/pages/editor';
import SearchPage from '@/pages/search';
import SharedPage from '@/pages/shared';
import NotificationsPage from '@/pages/notifications';
import AchievementsPage from '@/pages/achievements';
import AdminPage from '@/pages/admin';
import SettingsPage from '@/pages/settings';
import BridgePage from '@/pages/bridge';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import SharedViewPage from '@/pages/shared-view';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/gallery" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/albums" element={<AlbumsPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/world" element={<WorldPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/shared" element={<SharedPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/bridge" element={<BridgePage />} />
        <Route path="/p/:id" element={<SharedViewPage />} />
        <Route path="*" element={<Navigate to="/gallery" replace />} />
      </Routes>
      <Toaster />
      <PWAInstaller />
    </BrowserRouter>
  );
}
