import React from 'react';
import { Navigate } from 'react-router-dom';
import { User, UserRole } from '../types';

interface ProtectedRouteProps {
  user: User | null;
  isAuthLoading?: boolean;
  allowedRoles?: UserRole[];
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * ProtectedRoute - Guards admin routes by checking:
 * 1. If auth check is still loading (show loading spinner)
 * 2. If user is logged in
 * 3. If user has an allowed role
 *
 * Redirects to login if not authenticated, or home if unauthorized.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  user,
  isAuthLoading = false,
  allowedRoles = ['Admin', 'Moderator', 'Writer'],
  children,
  redirectTo = '/login',
}) => {
  // Wait for auth check to complete before making decision
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Check if user is logged in
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check if user has required role
  const normalizedAllowedRoles = allowedRoles.map((role) => role.toLowerCase());
  const normalizedUserRole = String(user.role || '').toLowerCase();
  const effectiveRole = normalizedUserRole === 'root' ? 'admin' : normalizedUserRole;

  if (!normalizedAllowedRoles.includes(effectiveRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
