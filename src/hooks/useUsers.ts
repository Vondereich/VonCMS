/**
 * VonCMS Users Hook
 * Handles user management operations
 */
import { useState, useCallback } from 'react';
import { User } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { getAuthHeader } from '../config/auth.config';
import toast from 'react-hot-toast';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);

  // Load users from API
  const loadUsers = useCallback(async () => {
    try {
      const res = await vonFetch(`${API.getUsers}?limit=100`);
      if (res.ok) {
        const data = await res.json();
        const userList = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
        setUsers(userList);
      }
    } catch (e) {
      console.warn('Failed to load users', e);
    }
  }, []);

  // Add new user
  const handleAddUser = useCallback(async (newUser: User): Promise<boolean> => {
    // Optimistic Update
    setUsers((prev) => [...prev, newUser]);

    let saved = false;
    try {
      const res = await vonFetch(API.saveUser, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.id) {
          // Update the temporary ID with real ID from server
          setUsers((prev) => prev.map((u) => (u.id === newUser.id ? { ...u, id: data.id } : u)));
        }
        saved = true;
      } else {
        console.error('Failed to save user:', data.message || data.error || res.statusText);
      }
    } catch (e) {
      console.error('Failed to save user', e);
    }

    if (!saved) {
      toast.error('Failed to save user to server.');
      // Rollback optimistic add
      setUsers((prev) => prev.filter((u) => u.id !== newUser.id));
      return false;
    }
    toast.success('User created successfully.');
    return true;
  }, []);

  // Delete user
  const handleDeleteUser = useCallback(
    async (userId: string) => {
      // Find user first for potential rollback
      const userToDelete = users.find((u) => u.id === userId);
      if (!userToDelete) return;

      // Optimistic Delete
      setUsers((prev) => prev.filter((u) => u.id !== userId));

      const del = async (url: string) => {
        return vonFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
          },
          body: JSON.stringify({ id: userId }),
        });
      };

      let deleted = false;
      try {
        const res = await del(API.deleteUser);
        if (res.ok) {
          deleted = true;
        } else {
          const data = await res.json().catch(() => ({}));
          console.error('Failed to delete user:', data.message || data.error || res.statusText);
        }
      } catch (e) {
        console.error('Failed to delete user', e);
      }

      if (!deleted) {
        toast.error('Failed to delete user on server.');
        // FUNCTIONAL ROLLBACK: Re-add the user to the Correct state (preserves other concurrent changes)
        setUsers((prev) => [...prev, userToDelete]);
        return false;
      }
      toast.success('User deleted successfully.');
      return true;
    },
    [users]
  );

  // Update user in list
  const handleUpdateUserInList = useCallback(
    async (updatedUser: User) => {
      const previousUser = users.find((u) => u.id === updatedUser.id);
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

      try {
        const res = await vonFetch(API.saveUser, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        });
        const data = await res.json();
        if (!data.success) {
          if (previousUser) {
            setUsers((prev) => prev.map((u) => (u.id === previousUser.id ? previousUser : u)));
          }
          console.error('Failed to update user:', data.message);
          toast.error(data.message || data.error || 'Failed to update user.');
          return false;
        }
        toast.success(data.message || 'User updated successfully.');
        return true;
      } catch (e) {
        if (previousUser) {
          setUsers((prev) => prev.map((u) => (u.id === previousUser.id ? previousUser : u)));
        }
        console.error('Failed to update user:', e);
        toast.error('Failed to update user.');
        return false;
      }
    },
    [users]
  );

  return {
    users,
    setUsers,
    loadUsers,
    handleAddUser,
    handleDeleteUser,
    handleUpdateUserInList,
  };
}
