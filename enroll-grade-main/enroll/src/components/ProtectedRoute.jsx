// ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';

export const ProtectedRoute = ({ allowRoles = [] }) => {
  const userId = localStorage.getItem('user_id');
  const role = localStorage.getItem('role');

  console.log('Current session user ID:', userId);
  if (userId != null) localStorage.setItem('app_user_id', userId); // sync key [web:179]

  if (!userId) return <Navigate to="/" replace />; // gate [web:224]
  if (allowRoles.length && !allowRoles.includes(role))
    return <Navigate to="/" replace />; // authz [web:224]
  return <Outlet />;
};
