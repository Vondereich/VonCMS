import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { API } from '../config/site.config';
import { User } from '../types';
import { vonFetch } from '../utils/api';

interface UseProfileEditorOptions {
  targetUser: User;
  currentUser: User | null;
  isOwner: boolean;
  onUpdateUser?: (user: Partial<User>) => void;
}

interface ProfileUpdatePayload {
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

  useEffect(() => {
    setDisplayUser(targetUser);
    setEditDisplayName(targetUser.display_name || '');
    setEditBio(targetUser.bio || '');
    setEditAvatar(targetUser.avatar || '');
  }, [targetUser]);

  const handleSaveProfile = async () => {
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
        !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
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

    setDisplayUser((user) => ({ ...user, ...profileUpdates }));
    setIsEditing(false);

    try {
      const response = await vonFetch(API.updateProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Failed to save profile');
        setDisplayUser(targetUser);
        return;
      }

      if (onUpdateUser && isOwner) {
        onUpdateUser(profileUpdates);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordFields(false);
      toast.success(data.message || 'Profile updated!');
    } catch {
      toast.error('Failed to save profile');
      setDisplayUser(targetUser);
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
