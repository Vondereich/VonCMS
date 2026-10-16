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
  areSettingsReady?: boolean;
  settingsLoadFailed?: boolean;
  onRetrySettings?: () => void;
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
  areSettingsReady = true,
  settingsLoadFailed = false,
  onRetrySettings,
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

  if (!areSettingsReady) {
    if (!settingsLoadFailed) return <PrivateEntryLoader label="Loading admin settings" />;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-admin-inset">
        <div className="max-w-md space-y-4 text-center" role="alert">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Admin settings could not be loaded
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your saved configuration has not changed. Retry before making settings changes.
          </p>
          {onRetrySettings ? (
            <button
              type="button"
              onClick={onRetrySettings}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
