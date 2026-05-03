import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Check localStorage to see if the admin token exists
  const isAuthenticated = localStorage.getItem('isAdminLoggedIn') === 'true';

  // If they are logged in, render the protected pages (represented by <Outlet />)
  // If not, instantly redirect them to the login page
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;