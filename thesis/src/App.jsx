import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import DashboardPage from './pages/dashboardPage';
import ReportsPage from './pages/ReportsPage';
import MockDataPage from './pages/MockDataPage'; // <-- Import the new page

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/mock-entry" element={<MockDataPage />} /> {/* <-- Add this route */}
      </Routes>
    </BrowserRouter>
  );
}