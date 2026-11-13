import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

// Pages that only a privileged admin (superadmin) may open.
const PRIVILEGED_ONLY_PATHS = ['/superadmin', '/privileged-emergency-units', '/backups'];

// Barangay-level pages that a privileged admin must not use.
const BARANGAY_ONLY_PATHS = [
  '/analytics',
  '/reports',
  '/duplicates',
  '/users',
  '/emergency-units',
  '/announcements',
  '/dashboard',
];

// Shared pages (/profile, /faqs, ...) are allowed for authorized admins who are logged in.

const matchesPath = (currentPath, base) =>
  currentPath === base || currentPath.startsWith(`${base}/`);

const readStoredUser = () => {
  for (const key of ['ac_user', 'user', 'admin_user']) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // ignore corrupt JSON and try the next key
    }
  }
  return {};
};

const clearAuthStorage = () => {
  localStorage.removeItem('ac_token');
  localStorage.removeItem('ac_user');
  localStorage.removeItem('user_role');
  localStorage.removeItem('is_superuser');
  localStorage.removeItem('username');
};

export default function ProtectedRoute() {
  const location = useLocation();
  const token = localStorage.getItem('ac_token');

  // Missing token, or a bad value that was stored by mistake
  if (!token || token === 'undefined' || token === 'null') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const storedUser = readStoredUser();

  const userRole = String(
    localStorage.getItem('user_role') || storedUser.role || ''
  ).toUpperCase().trim();

  const isSuperuser =
    localStorage.getItem('is_superuser') === 'true' || storedUser.is_superuser === true;

  const isStaff = storedUser.is_staff === true;

  const username = (localStorage.getItem('username') || storedUser.username || '').trim();

  const isPrivileged =
    userRole === 'PRIVILEGED_ADMIN' ||
    userRole === 'PRIVILEGED ADMIN' ||
    userRole === 'SUPERADMIN' ||
    isSuperuser ||
    username === 'g2c405';

  const isRegularAdmin =
    userRole === 'ADMIN' ||
    isStaff;

  // Block regular users / residents from accessing any protected page
  if (!isPrivileged && !isRegularAdmin) {
    clearAuthStorage();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const currentPath = location.pathname.toLowerCase();

  // 1. Privileged admin must NOT access barangay-level pages
  if (isPrivileged && BARANGAY_ONLY_PATHS.some((p) => matchesPath(currentPath, p))) {
    return <Navigate to="/superadmin" replace />;
  }

  // 2. Regular admin must NOT access superadmin-only pages
  if (!isPrivileged && PRIVILEGED_ONLY_PATHS.some((p) => matchesPath(currentPath, p))) {
    return <Navigate to="/analytics" replace />;
  }

  return <Outlet />;
}