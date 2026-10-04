import React from 'react';
import { Navigate } from 'react-router';
import { User, UserRole } from '../types';
import PrivateEntryLoader from './PrivateEntryLoader';

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
    return <PrivateEntryLoader label="Verifying session" />;
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
