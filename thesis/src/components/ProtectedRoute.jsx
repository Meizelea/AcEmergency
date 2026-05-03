import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Checks for the exact 'ac_user' key set by your login API
  const isAuthenticated = localStorage.getItem('ac_user') !== null;

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;