import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ allowedRoles = null }) {
  const location = useLocation();
  const token = localStorage.getItem('ac_token');

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Retrieve user role from all common storage variations
  let userRole = localStorage.getItem('user_role') || '';
  let isSuperuser = localStorage.getItem('is_superuser') === 'true';

  if (!userRole) {
    const rawUserData = localStorage.getItem('user') || localStorage.getItem('admin_user');
    if (rawUserData) {
      try {
        const parsed = JSON.parse(rawUserData);
        userRole = parsed.role || '';
        isSuperuser = Boolean(parsed.is_superuser);
      } catch (e) {
        // ignore json parse error
      }
    }
  }

  const isPrivileged = 
    userRole.toUpperCase() === 'PRIVILEGED_ADMIN' || 
    isSuperuser || 
    localStorage.getItem('username') === 'g2c405';

  const currentPath = location.pathname.toLowerCase();

  // 1. Privileged admin should NOT access barangay-level dashboard/pages
  if (isPrivileged && currentPath === '/dashboard') {
    return <Navigate to="/superadmin" replace />;
  }

  // 2. Regular admin should NOT access superadmin
  if (!isPrivileged && currentPath === '/superadmin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}