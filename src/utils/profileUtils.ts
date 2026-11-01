import { User } from '../types';

/** Only adopt editable profile fields, including an explicitly cleared server avatar. */
export const getSavedProfileUpdates = (
  saved: unknown,
  fallback: { display_name: string; bio: string; avatar: string }
) => {
  const record =
    saved && typeof saved === 'object' && !Array.isArray(saved)
      ? (saved as Record<string, unknown>)
      : {};
  const text = (key: keyof typeof fallback) =>
    typeof record[key] === 'string'
      ? (record[key] as string)
      : record[key] === null
        ? ''
        : fallback[key];
  return { display_name: text('display_name'), bio: text('bio'), avatar: text('avatar') };
};

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

export const getUserDisplayRole = (user?: Partial<User> | null, fallback = 'Member') =>
  String(user?.id || '') === '1' ? 'Super Admin' : user?.role || fallback;

export const getProfileDisplayRole = (
  currentUser?: User | null,
  targetUser?: Partial<User> | null,
  fallback = 'Member'
) => {
  if (isOwnUserProfile(currentUser, targetUser) && currentUser?.role) {
    return getUserDisplayRole(currentUser, fallback);
  }

  return getUserDisplayRole(targetUser, fallback);
};
