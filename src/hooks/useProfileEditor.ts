import { hasPasswordSpecialCharacter } from '../utils/security';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { API } from '../config/site.config';
import { User } from '../types';
import { vonFetch } from '../utils/api';
import { getSavedProfileUpdates } from '../utils/profileUtils';

interface UseProfileEditorOptions {
  targetUser: User;
  currentUser: User | null;
  isOwner: boolean;
  onUpdateUser?: (user: Partial<User>) => void;
}

export interface ProfileUpdatePayload {
  id?: string;
  display_name: string;
  bio: string;
  avatar: string;
  current_password?: string;
  new_password?: string;
}

export function useProfileEditor({
  targetUser,
  currentUser,
  isOwner,
  onUpdateUser,
}: UseProfileEditorOptions) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(targetUser.display_name || '');
  const [editBio, setEditBio] = useState(targetUser.bio || '');
  const [editAvatar, setEditAvatar] = useState(targetUser.avatar || '');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [displayUser, setDisplayUser] = useState(targetUser);
  const activeProfileId = useRef(targetUser.id);
  const profileSavePending = useRef(false);
  activeProfileId.current = targetUser.id;

  useEffect(() => {
    setDisplayUser(targetUser);
    setEditDisplayName(targetUser.display_name || '');
    setEditBio(targetUser.bio || '');
    setEditAvatar(targetUser.avatar || '');
  }, [targetUser]);

  const handleSaveProfile = async () => {
    if (profileSavePending.current) return;
    if (showPasswordFields && newPassword) {
      if (!currentPassword) {
        toast.error('Current password is required to change password');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        toast.error('New passwords do not match');
        return;
      }
      if (
        newPassword.length < 8 ||
        !/[A-Z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword) ||
        !hasPasswordSpecialCharacter(newPassword)
      ) {
        toast.error('Password too weak (8+ chars, Upper, Number, Symbol)');
        return;
      }
    }

    const profileUpdates = {
      display_name: editDisplayName,
      bio: editBio,
      avatar: editAvatar,
    };
    const payload: ProfileUpdatePayload = {
      id: currentUser?.id,
      ...profileUpdates,
    };

    if (showPasswordFields && newPassword) {
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    profileSavePending.current = true;
    setDisplayUser((user) => ({ ...user, ...profileUpdates }));
    setIsEditing(false);

    try {
      const response = await vonFetch(API.updateProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (activeProfileId.current !== targetUser.id) return;

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Failed to save profile');
        setDisplayUser(targetUser);
        return;
      }

      const savedUpdates = getSavedProfileUpdates(data.user, profileUpdates);
      setDisplayUser((user) => ({ ...user, ...savedUpdates }));
      setEditDisplayName((current) =>
        current === editDisplayName ? savedUpdates.display_name : current
      );
      setEditBio((current) => (current === editBio ? savedUpdates.bio : current));
      setEditAvatar((current) => (current === editAvatar ? savedUpdates.avatar : current));
      if (onUpdateUser && isOwner && currentUser) {
        onUpdateUser({ ...savedUpdates, id: currentUser.id });
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordFields(false);
      toast.success(data.message || 'Profile updated!');
    } catch {
      if (activeProfileId.current !== targetUser.id) return;
      toast.error('Failed to save profile');
      setDisplayUser(targetUser);
    } finally {
      profileSavePending.current = false;
    }
  };

  return {
    isEditing,
    setIsEditing,
    editDisplayName,
    setEditDisplayName,
    editBio,
    setEditBio,
    editAvatar,
    setEditAvatar,
    showPasswordFields,
    setShowPasswordFields,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    displayUser,
    handleSaveProfile,
  };
}
