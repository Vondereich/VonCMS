import { User } from '../types';

export const isOwnUserProfile = (currentUser?: User | null, targetUser?: Partial<User> | null) => {
  if (!currentUser || !targetUser) return false;

  const currentId = String(currentUser.id || '');
  const targetId = String(targetUser.id || '');
  if (currentId && targetId && currentId === targetId) return true;

  const currentUsername = String(currentUser.username || '')
    .trim()
    .toLowerCase();
  const targetUsername = String(targetUser.username || '')
    .trim()
    .toLowerCase();
  return Boolean(currentUsername && targetUsername && currentUsername === targetUsername);
};

export const isStaffUser = (user?: Partial<User> | null) =>
  ['admin', 'root', 'moderator', 'writer'].includes(String(user?.role || '').toLowerCase());

export const getProfileDisplayRole = (
  currentUser?: User | null,
  targetUser?: Partial<User> | null,
  fallback = 'Member'
) => {
  if (isOwnUserProfile(currentUser, targetUser) && currentUser?.role) {
    return currentUser.role;
  }

  return targetUser?.role || fallback;
};
