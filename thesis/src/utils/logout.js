const API_BASE = import.meta.env.VITE_API_URL || 'https://api.aksyon.online';

/**
 * Shared logout for every admin page.
 * Calls the backend logout endpoint (so the token is invalidated server-side),
 * then clears local credentials and redirects to /login.
 * Logout always completes, even if the server is unreachable.
 */
export async function performLogout(navigate) {
  const token = (localStorage.getItem('ac_token') || '')
    .replace(/^(Token|Bearer)\s+/i, '')
    .trim();

  if (token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    try {
      await fetch(`${API_BASE}/api/users/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        signal: controller.signal,
      });
    } catch (err) {
      // Never block logout if the server is unreachable
      console.warn('Logout request failed:', err);
    } finally {
      clearTimeout(timer);
    }
  }

  ['ac_token', 'ac_user', 'user_role', 'is_superuser', 'username'].forEach((key) =>
    localStorage.removeItem(key)
  );
  sessionStorage.clear();

  navigate('/login', { replace: true });
}