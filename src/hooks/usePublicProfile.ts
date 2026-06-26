import { useState, useEffect, useMemo, useRef } from 'react';
import { User } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

interface AdminProfile {
  name?: string;
  email?: string;
  bio?: string;
}

const publicProfileCache = new Map<string, User>();

export const updatePublicProfileCache = (username: string | undefined, updates: Partial<User>) => {
  const key = String(username || '').trim();
  if (!key) return;

  const existing = publicProfileCache.get(key);
  publicProfileCache.set(key, {
    ...(existing || {
      id: updates.id ? String(updates.id) : `public:${key}`,
      username: key,
      email: '',
      role: 'Member',
      bio: '',
      avatar: '',
    }),
    ...updates,
    username: updates.username || existing?.username || key,
    email: existing?.email || '',
    role: existing?.role || 'Member',
  } as User);
};

/**
 * Hook to resolve and fetch public user profiles.
 * Centralizes profile resolution logic used across all themes.
 *
 * Resolution priority:
 * 1. Find in allUsers array
 * 2. Fetch from public API if not found
 * 3. Fall back to adminProfile settings
 * 4. Return null for unresolved profiles so the route can 404
 */
export const usePublicProfile = (
  selectedProfile: string | undefined | null,
  allUsers: User[],
  adminProfile?: AdminProfile
) => {
  const [fetchedProfile, setFetchedProfile] = useState<User | null>(() =>
    selectedProfile ? publicProfileCache.get(selectedProfile) || null : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [settledProfile, setSettledProfile] = useState<string | null>(() =>
    selectedProfile && publicProfileCache.has(selectedProfile) ? selectedProfile : null
  );
  const requestIdRef = useRef(0);

  // Fetch from public API if not found in allUsers
  useEffect(() => {
    if (!selectedProfile) {
      requestIdRef.current += 1;
      setFetchedProfile(null);
      setSettledProfile(null);
      setIsLoading(false);
      return;
    }

    const existsInUsers = allUsers.find((u) => u.username === selectedProfile);
    if (existsInUsers) {
      requestIdRef.current += 1;
      setFetchedProfile(null);
      setSettledProfile(selectedProfile);
      setIsLoading(false);
      return;
    }

    const cachedProfile = publicProfileCache.get(selectedProfile);
    if (cachedProfile) {
      requestIdRef.current += 1;
      setFetchedProfile(cachedProfile);
      setSettledProfile(selectedProfile);
      setIsLoading(false);
      return;
    }

    if (adminProfile && (selectedProfile === 'Admin' || selectedProfile === adminProfile.name)) {
      requestIdRef.current += 1;
      setFetchedProfile(null);
      setSettledProfile(selectedProfile);
      setIsLoading(false);
      return;
    }

    // Not found in allUsers - fetch from public API
    const requestId = ++requestIdRef.current;
    const abortController = new AbortController();
    setIsLoading(true);
    setFetchedProfile(null);
    setSettledProfile(null);

    vonFetch(`${API.getPublicProfile}?username=${encodeURIComponent(selectedProfile)}`, {
      signal: abortController.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        if (data?.success && data.user && data.user.username === selectedProfile) {
          const nextProfile = {
            id: data.user.id ? String(data.user.id) : `public:${data.user.username}`,
            username: data.user.username,
            display_name: data.user.display_name || '',
            email: '', // Not exposed in public API
            role: 'Member',
            bio: data.user.bio || '',
            avatar: data.user.avatar || '',
          } as User;
          publicProfileCache.set(selectedProfile, nextProfile);
          setFetchedProfile(nextProfile);
        } else {
          setFetchedProfile(null);
        }
        setSettledProfile(selectedProfile);
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        setFetchedProfile(null);
        setSettledProfile(selectedProfile);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      requestIdRef.current += 1;
      abortController.abort();
    };
  }, [selectedProfile, allUsers, adminProfile]);

  // Resolve target profile with priority
  const targetProfile = useMemo(() => {
    if (!selectedProfile) return null;

    // 1. Check allUsers
    const fromUsers = allUsers.find((u) => u.username === selectedProfile);
    if (fromUsers) return fromUsers;

    // 2. Check fetched profile
    if (fetchedProfile?.username === selectedProfile) return fetchedProfile;

    // 3. Check admin profile settings
    if (adminProfile && (selectedProfile === 'Admin' || selectedProfile === adminProfile.name)) {
      return {
        id: 'admin',
        username: adminProfile.name || 'Admin',
        display_name: adminProfile.name || 'Admin',
        email: adminProfile.email || '',
        role: 'Admin',
        bio: adminProfile.bio || '',
      } as User;
    }

    // 4. Invalid profile should stay unresolved so the route can become a real 404.
    return null;
  }, [selectedProfile, allUsers, fetchedProfile, adminProfile]);

  const isPendingProfileFetch = useMemo(() => {
    if (!selectedProfile || targetProfile) return false;
    return settledProfile !== selectedProfile;
  }, [selectedProfile, targetProfile, settledProfile]);

  return {
    targetProfile,
    fetchedProfile,
    isLoading: isLoading || isPendingProfileFetch,
  };
};

export default usePublicProfile;
