import { Navigate, Outlet } from 'react-router-dom';

export const ProtectedRoute = ({ allowRoles = [] }) => {
  const userId = localStorage.getItem('user_id');
  const role = localStorage.getItem('role');

  console.log('Current session user ID:', userId);

  if (!userId) {
    return <Navigate to="/" replace />;
  }

  if (allowRoles.length > 0 && !allowRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
