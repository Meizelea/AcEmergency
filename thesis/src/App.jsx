import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute'; // Check exact casing of filename

import AdminLogin from './pages/adminLogin';
import DashboardPage from './pages/dashboardPage';
import ReportsPage from './pages/reportsPage';
import UsersPage from './pages/usersPage';
import AnalyticsPage from './pages/analyticsPage';
import EmergencyUnitsPage from './pages/emergencyUnits';
import AnnouncementPage from './pages/announcementPage';
import SuperAdminPage from './superadmin/superadmin';
import PrivilegedEmergencyUnitsPage from './superadmin/privilegedEmergencyUnits';
import AdminProfilePage from './pages/adminProfilePage.jsx';
import DuplicatesPage from './pages/duplicatesPage.jsx';
import BackupsPage from './superadmin/backups.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AdminLogin />} />

        {/* Protected Command Center Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/emergency-units" element={<EmergencyUnitsPage />} />
          <Route path="/superadmin" element={<SuperAdminPage />} />
          <Route path="/privileged-emergency-units" element={<PrivilegedEmergencyUnitsPage />} />
          <Route path="/backups" element={<BackupsPage />} />
          <Route path="/announcements" element={<AnnouncementPage />} />
          <Route path="/duplicates" element={<DuplicatesPage />} />
          <Route path="/profile" element={<AdminProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}