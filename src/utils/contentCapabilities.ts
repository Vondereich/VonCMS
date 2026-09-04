import type { PostStatus, UserRole } from '../types';

type RoleInput = UserRole | string | null | undefined;

export const normalizeContentRole = (role: RoleInput) =>
  String(role || '')
    .trim()
    .toLowerCase();

export const isPostReviewer = (role: RoleInput) =>
  ['root', 'admin', 'moderator'].includes(normalizeContentRole(role));

export const isPostWriter = (role: RoleInput) => normalizeContentRole(role) === 'writer';

export const canWriterEditPostStatus = (status: PostStatus) => status === 'draft';

export const canDeletePostForRole = (role: RoleInput, status: PostStatus) =>
  isPostReviewer(role) || (isPostWriter(role) && status === 'draft');

export const getPostStatusLabel = (status: PostStatus) => {
  switch (status) {
    case 'pending_review':
      return 'Pending Review';
    case 'published':
      return 'Published';
    case 'scheduled':
      return 'Scheduled';
    case 'archived':
      return 'Archived';
    default:
      return 'Draft';
  }
};

export const getPostStatusClassName = (status: PostStatus) => {
  switch (status) {
    case 'published':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'pending_review':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300';
    case 'scheduled':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'archived':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300';
    default:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  }
};
