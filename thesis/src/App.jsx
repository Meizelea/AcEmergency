import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';


import ProtectedRoute from './components/ProtectedRoute';

import AdminLogin from './pages/adminLogin';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import MockDataPage from './pages/MockDataPage';
import UsersPage from './pages/UsersPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HeatmapPage from './pages/HeatmapPage'; 
import EmergencyUnitsPage from './pages/emergencyUnits';

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
          <Route path="/mock-entry" element={<MockDataPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/heatmap" element={<HeatmapPage />} />
          <Route path="/emergency-units" element={<EmergencyUnitsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}