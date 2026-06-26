import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { User, UserRole } from '../../../../types';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import {
  Plus,
  Trash2,
  Pencil,
  X,
  AlertTriangle,
  Shield,
  User as UserIcon,
  Search,
  Loader2,
} from 'lucide-react';
import SmartPagination from '../../../../components/SmartPagination';

interface UserManagerProps {
  users: User[];
  onAddUser: (u: User) => Promise<boolean | void> | boolean | void;
  onDeleteUser: (id: string) => Promise<boolean | void> | boolean | void;
  onUpdateUser?: (u: User) => Promise<boolean | void> | boolean | void;
  currentUser: User | null;
}

interface FetchMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const itemsPerPage = 20;

const UserManager: React.FC<UserManagerProps> = ({
  users: _users,
  onAddUser,
  onDeleteUser,
  onUpdateUser,
  currentUser,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    display_name: '',
    email: '',
    role: 'Writer' as UserRole,
    password: '',
    avatar: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Password validation function
  const validatePassword = (password: string): string | null => {
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(password)
    ) {
      return 'Password must be at least 8 characters with uppercase, number, and special character';
    }
    return null;
  };

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    display_name: '',
    email: '',
    role: 'Writer' as UserRole,
    password: '',
    avatar: '',
  });
  const [editPasswordError, setEditPasswordError] = useState<string | null>(null);

  // Delete Confirm State
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageUsers, setPageUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<FetchMeta>({
    page: 1,
    limit: itemsPerPage,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const currentUserRole = String(currentUser?.role || '').toLowerCase();
  const currentUserId = String(currentUser?.id || '');
  const isPrimaryAdminActor = currentUserId === '1' || currentUserRole === 'root';
  const isProtectedAdminUser = (user: User | null) =>
    String(user?.id || '') === '1' || String(user?.role || '').toLowerCase() === 'root';
  const getEditRestrictionMessage = (user: User) =>
    !isPrimaryAdminActor && isProtectedAdminUser(user) ? 'Only admin 1 can edit this account' : '';
  const isDeleteBlocked = (user: User) =>
    currentUserId === String(user.id) || (!isPrimaryAdminActor && isProtectedAdminUser(user));
  const getDeleteRestrictionMessage = (user: User) =>
    currentUserId === String(user.id)
      ? 'You cannot delete yourself'
      : 'Only admin 1 can delete this account';

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsersPage = useCallback(async (page: number, filters?: { search?: string }) => {
    setLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(itemsPerPage),
    });
    if (filters?.search) params.set('search', filters.search);

    try {
      const res = await vonFetch(`${API.getUsers}?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await res.json();
      const resolvedPage = Number(data?.meta?.page || page);
      setPageUsers(Array.isArray(data?.users) ? data.users : []);
      setMeta({
        page: resolvedPage,
        limit: Number(data?.meta?.limit || itemsPerPage),
        total: Number(data?.meta?.total || 0),
        totalPages: Math.max(1, Number(data?.meta?.totalPages || 1)),
        hasMore: Boolean(data?.meta?.hasMore),
      });
      setCurrentPage(resolvedPage);
    } catch (error) {
      console.warn('Failed to fetch users:', error);
      setPageUsers([]);
      setMeta({
        page: 1,
        limit: itemsPerPage,
        total: 0,
        totalPages: 1,
        hasMore: false,
      });
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsersPage(1, { search: searchQuery || undefined });
  }, [fetchUsersPage, searchQuery]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > meta.totalPages) {
      return;
    }

    void fetchUsersPage(page, { search: searchQuery || undefined });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password
    const pwdError = validatePassword(newUser.password);
    if (pwdError) {
      setPasswordError(pwdError);
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const success = await onAddUser({
        id: Date.now().toString(),
        ...newUser,
      });

      if (success !== false) {
        setIsFormOpen(false);
        setNewUser({
          username: '',
          display_name: '',
          email: '',
          role: 'Writer',
          password: '',
          avatar: '',
        });
        setPasswordError(null);
        await fetchUsersPage(1, { search: searchQuery || undefined });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (user: User) => {
    const restrictionMessage = getEditRestrictionMessage(user);
    if (restrictionMessage) {
      toast.error(restrictionMessage);
      return;
    }

    setEditingUser(user);
    setEditForm({
      username: user.username,
      display_name: user.display_name || '',
      email: user.email,
      role: user.role,
      password: '',
      avatar: user.avatar || '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password if provided
    if (editForm.password) {
      const pwdError = validatePassword(editForm.password);
      if (pwdError) {
        setEditPasswordError(pwdError);
        return;
      }
    }

    if (editingUser && onUpdateUser) {
      const updateData: User = {
        ...editingUser,
        username: editForm.username,
        display_name: editForm.display_name,
        email: editForm.email,
        role: editForm.role,
        avatar: editForm.avatar,
      };
      if (editForm.password) {
        updateData.password = editForm.password;
      }
      const success = await onUpdateUser(updateData);
      if (success === false) {
        return;
      }
      await fetchUsersPage(currentPage, { search: searchQuery || undefined });
    }
    setEditingUser(null);
    setEditPasswordError(null);
  };

  const handleApproveEmail = async (user: User) => {
    if (!onUpdateUser || !isPrimaryAdminActor || !user.has_pending_verification) {
      return;
    }

    const success = await onUpdateUser({
      ...user,
      approve_email: true,
    });
    if (success === false) {
      return;
    }
    await fetchUsersPage(currentPage, { search: searchQuery || undefined });
  };

  const confirmDelete = async () => {
    if (deleteConfirmUser) {
      if (isDeleteBlocked(deleteConfirmUser)) {
        toast.error(getDeleteRestrictionMessage(deleteConfirmUser));
        setDeleteConfirmUser(null);
        return;
      }
      const success = await onDeleteUser(deleteConfirmUser.id);
      if (success !== false) {
        await fetchUsersPage(currentPage, { search: searchQuery || undefined });
      }
      setDeleteConfirmUser(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">User Management</h2>
          <p className="text-slate-500 text-sm">
            Add moderators or writers to help manage the site ({meta.total} total).
          </p>
          {searchQuery && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Filters:</span>
              <button
                onClick={clearSearch}
                className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
              >
                <Search size={12} />
                <span>Search: "{searchQuery}"</span>
                <span className="font-bold">×</span>
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          <Plus size={18} />
          <span>Add User</span>
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Add User"
            id="usermanager-310"
            name="usermanager310"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search users..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-[#2a2b36] dark:bg-[#1a1b26] dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-200 dark:bg-[#242633] dark:text-slate-300 dark:hover:bg-slate-600"
        >
          Search
        </button>
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </form>

      {/* Add New User Form */}
      {isFormOpen && (
        <div className="bg-slate-50 dark:bg-[#16161e] border border-slate-200 dark:border-white/10 p-6 rounded-xl animate-fade-in">
          <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Register New User</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              id="username"
              name="username"
              aria-label="Username"
              required
              type="text"
              placeholder="Username"
              className="p-2.5 rounded-lg border border-slate-300 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] dark:text-white"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
            <input
              aria-label="Display name / Pen name"
              id="display-name-pen-name"
              name="displayNamePenName"
              type="text"
              placeholder="Display name / Pen name"
              className="p-2.5 rounded-lg border border-slate-300 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] dark:text-white"
              value={newUser.display_name}
              onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
            />
            <input
              aria-label="Email"
              id="email"
              name="email"
              required
              type="email"
              placeholder="Email"
              className="p-2.5 rounded-lg border border-slate-300 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] dark:text-white"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <input
              id="password-8-chars-a-z-0-9"
              name="password8CharsAZ09"
              aria-label="Password (8+ chars, A-Z, 0-9, !@#)"
              required
              type="password"
              placeholder="Password (8+ chars, A-Z, 0-9, !@#)"
              className={`p-2.5 rounded-lg border ${passwordError ? 'border-red-500' : 'border-slate-300 dark:border-[#2a2b36]'} bg-white dark:bg-[#1a1b26] dark:text-white`}
              value={newUser.password}
              onChange={(e) => {
                setNewUser({ ...newUser, password: e.target.value });
                setPasswordError(validatePassword(e.target.value));
              }}
            />
            {passwordError && <p className="text-red-500 text-xs md:col-span-2">{passwordError}</p>}
            <input
              aria-label="Avatar URL (Optional)"
              id="avatar-url-optional"
              name="avatarUrlOptional"
              type="text"
              placeholder="Avatar URL (Optional)"
              className="p-2.5 rounded-lg border border-slate-300 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] dark:text-white"
              value={newUser.avatar}
              onChange={(e) => setNewUser({ ...newUser, avatar: e.target.value })}
            />
            <select
              id="usermanager-375"
              name="usermanager375"
              aria-label="Selection"
              className="p-2.5 rounded-lg border border-slate-300 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] dark:text-white"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
            >
              <option value="Member">Member</option>
              <option value="Writer">Writer</option>
              <option value="Moderator">Moderator</option>
              {isPrimaryAdminActor && <option value="Admin">Admin</option>}
            </select>
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#242633] rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {isSubmitting ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Modal - Portal to body to bypass stacking context */}
      {editingUser &&
        createPortal(
          <div
            className={
              document.documentElement.classList.contains('dark') ||
              document.body.classList.contains('dark') ||
              document.querySelector('.dark')
                ? 'dark'
                : ''
            }
          >
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in">
              <div className="bg-white dark:bg-[#1a1b26] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#2a2b36]">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit User</h3>
                  <button
                    onClick={() => setEditingUser(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-[#242633] overflow-hidden border-4 border-white dark:border-[#333544] shadow-lg">
                      {editForm.avatar ? (
                        <img
                          src={editForm.avatar}
                          alt={editForm.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Gravatar
                          email={editForm.email || editForm.username}
                          size={100}
                          className="w-full h-full object-cover"
                          default="identicon"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Username
                    </span>
                    <input
                      aria-label="Username"
                      id="usermanager-455"
                      name="usermanager455"
                      type="text"
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-white dark:bg-[#242633] dark:text-white"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Display name / Pen name
                    </span>
                    <input
                      aria-label="Display name / Pen name"
                      id="edit-display-name-pen-name"
                      name="editDisplayNamePenName"
                      type="text"
                      placeholder="Optional public byline"
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-white dark:bg-[#242633] dark:text-white"
                      value={editForm.display_name}
                      onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email
                    </span>
                    <input
                      id="usermanager-466"
                      name="usermanager466"
                      aria-label="Email"
                      type="email"
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-white dark:bg-[#242633] dark:text-white"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Role
                    </span>
                    <select
                      aria-label="Role"
                      className={`w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-white dark:bg-[#242633] dark:text-white ${
                        currentUser?.id == editingUser?.id || isProtectedAdminUser(editingUser)
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                      value={editForm.role}
                      onChange={(e) =>
                        setEditForm({ ...editForm, role: e.target.value as UserRole })
                      }
                      disabled={
                        currentUser?.id == editingUser?.id || isProtectedAdminUser(editingUser)
                      }
                      title={
                        currentUser?.id == editingUser?.id
                          ? 'You cannot change your own role'
                          : isProtectedAdminUser(editingUser)
                            ? 'Super Admin role cannot be changed'
                            : ''
                      }
                    >
                      <option value="Member">Member</option>
                      <option value="Writer">Writer</option>
                      <option value="Moderator">Moderator</option>
                      {(isPrimaryAdminActor || editForm.role === 'Admin') && (
                        <option value="Admin">Admin</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      New Password{' '}
                      <span className="text-slate-400">(leave blank to keep current)</span>
                    </span>
                    <input
                      id="8-chars-a-z-0-9"
                      name="8CharsAZ09"
                      aria-label="8+ chars, A-Z, 0-9, !@#"
                      type="password"
                      placeholder="8+ chars, A-Z, 0-9, !@#"
                      className={`w-full p-2.5 rounded-lg border ${editPasswordError ? 'border-red-500' : 'border-slate-300 dark:border-[#333544]'} bg-white dark:bg-[#242633] dark:text-white`}
                      value={editForm.password}
                      onChange={(e) => {
                        setEditForm({ ...editForm, password: e.target.value });
                        if (e.target.value) setEditPasswordError(validatePassword(e.target.value));
                        else setEditPasswordError(null);
                      }}
                    />
                    {editPasswordError && (
                      <p className="text-red-500 text-xs mt-1">{editPasswordError}</p>
                    )}
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Avatar URL
                    </span>
                    <input
                      id="https"
                      name="https"
                      aria-label="https://..."
                      type="text"
                      placeholder="https://..."
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-white dark:bg-[#242633] dark:text-white"
                      value={editForm.avatar}
                      onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-[#2a2b36]">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirm Modal - Portal to body */}
      {deleteConfirmUser &&
        createPortal(
          <div
            className={
              document.documentElement.classList.contains('dark') ||
              document.body.classList.contains('dark') ||
              document.querySelector('.dark')
                ? 'dark'
                : ''
            }
          >
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in">
              <div className="bg-white dark:bg-[#1a1b26] rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-red-500" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                  Delete User?
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Are you sure you want to delete{' '}
                  <strong className="text-slate-800 dark:text-white">
                    {deleteConfirmUser.username}
                  </strong>
                  ? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setDeleteConfirmUser(null)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Users Table */}
      <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-primary-600" />
            <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading...</span>
          </div>
        ) : pageUsers.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-[#16161e]/50 text-xs uppercase text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Profile</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {pageUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1b26]/50">
                  <td className="px-6 py-4 w-16">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-[#242633] overflow-hidden border border-slate-300 dark:border-[#333544]">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Gravatar
                          email={user.email || user.username}
                          size={100}
                          className="w-full h-full object-cover"
                          default="identicon"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {user.display_name || user.username}
                    </div>
                    {user.display_name && (
                      <div className="text-xs text-slate-400">@{user.username}</div>
                    )}
                    <div className="text-xs text-slate-500">{user.email}</div>
                    {user.has_pending_verification && (
                      <div className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        Email pending
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold
                                        ${
                                          user.role === 'Admin'
                                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                            : user.role === 'Moderator'
                                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                              : user.role === 'Member'
                                                ? 'bg-slate-100 text-slate-700 dark:bg-[#16161e]/30 dark:text-slate-400'
                                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isPrimaryAdminActor && user.has_pending_verification && (
                        <button
                          onClick={() => handleApproveEmail(user)}
                          className="px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg"
                          title="Approve Email"
                        >
                          Approve Email
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(user)}
                        className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
                          getEditRestrictionMessage(user)
                            ? 'text-slate-400 bg-slate-100 dark:bg-[#242633] dark:text-slate-500 cursor-not-allowed'
                            : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                        }`}
                        title={getEditRestrictionMessage(user) || 'Edit User'}
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      {isDeleteBlocked(user) ? (
                        <button
                          onClick={() => toast.error(getDeleteRestrictionMessage(user))}
                          className="px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-1 bg-slate-100 text-slate-400 dark:bg-[#242633] dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-[#333544]"
                          title={getDeleteRestrictionMessage(user)}
                        >
                          {currentUserId === String(user.id) ? (
                            <UserIcon size={12} />
                          ) : (
                            <Shield size={12} />
                          )}
                          {currentUserId === String(user.id) ? 'Yourself' : 'Protected'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmUser(user)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg flex items-center gap-1"
                          title="Delete User"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-[#242633]">
              <UserIcon size={32} className="text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
              No users found
            </h3>
            <p className="text-slate-500">
              {searchQuery ? 'No users matched this search.' : 'No users are available to display.'}
            </p>
          </div>
        )}
      </div>

      {/* Smart Pagination Controls */}
      <SmartPagination
        currentPage={currentPage}
        totalPages={meta.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        totalItems={meta.total}
      />
    </div>
  );
};

export default UserManager;
