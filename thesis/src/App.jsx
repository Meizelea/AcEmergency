import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import MockDataPage from './pages/MockDataPage';
import UsersPage from './pages/UsersPage';
import AnalyticsPage from './pages/analyticsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/mock-entry" element={<MockDataPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/analytics" element={<AnalyticsPage/>}/>
      </Routes>
    </BrowserRouter>
  );
}