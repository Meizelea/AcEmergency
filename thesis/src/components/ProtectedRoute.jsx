import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  // 🛡️ Guardrail: Check for the token presence instantly
  const token = localStorage.getItem('ac_token');

  // If no token exists, force redirect immediately to login screen
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If authorized, render the requested child page view container
  return <Outlet />;
}