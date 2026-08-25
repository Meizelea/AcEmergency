import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute'; // Check exact casing of filename

import AdminLogin from './pages/adminLogin';
import DashboardPage from './pages/dashboardPage';
import ReportsPage from './pages/reportsPage';
import UsersPage from './pages/usersPage';
import AnalyticsPage from './pages/analyticsPage';
import EmergencyUnitsPage from './pages/emergencyUnits';
import SuperAdminPage from './superadmin/superadmin';

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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}