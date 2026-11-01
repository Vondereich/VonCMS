/**
 * VonCMS Auth Hook
 * Handles authentication, session management, and user state
 */
import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { API, BASE_PATH } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { setCsrfToken } from '../utils/security';
import toast from 'react-hot-toast';
import { updatePublicProfileCache } from './usePublicProfile';

// Session timeout: 30 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Update user partial data
  const handleUpdateUser = useCallback((updates: Partial<User>) => {
    setUser((current) => {
      if (!current || (updates.id && String(updates.id) !== String(current.id))) return current;
      return { ...current, ...updates };
    });
  }, []);

  useEffect(() => {
    if (user) updatePublicProfileCache(user.username, user);
  }, [user]);

  // Check existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const res = await vonFetch(API.checkAuth);
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            if (data.csrf_token) {
              setCsrfToken(data.csrf_token);
            }
            setUser(data.user);
          }
        }
      } catch (e) {
        console.warn('Failed to check session:', e);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkExistingSession();
  }, []);

  // Logout handler is stable; the inactivity timer can depend on it without restarting.
  const handleLogout = useCallback(async () => {
    try {
      await vonFetch(API.logout, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('Logout API call failed:', e);
    }

    setUser(null);
    window.location.href = BASE_PATH;
  }, []);

  // Session timeout management
  useEffect(() => {
    if (!user) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        toast.error('Session expired due to inactivity.', { duration: 4000 });
        handleLogout();
      }, SESSION_TIMEOUT);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user, handleLogout]);

  // Login handler
  const handleLogin = useCallback((u: User) => {
    setUser(u);
  }, []);

  return {
    user,
    setUser,
    isAuthLoading,
    handleLogin,
    handleLogout,
    handleUpdateUser,
  };
}
