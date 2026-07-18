import React, { useState, useEffect } from 'react';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { User, Post, Comment } from '../../../../types';
import {
  ArrowLeft,
  MapPin,
  FileText,
  MessageCircle,
  ThumbsUp,
  LayoutDashboard,
} from 'lucide-react';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import { sanitizeHtml } from '../../../../utils/security';
import { LoadMoreButton } from '../../../../components/LoadMoreButton';
import { useProfileActivity } from '../../../../hooks/useProfileActivity';
import { getResponsiveImageAttributes } from '../../../../utils/siteUtils';
import { SafeImage } from '../../../../components/SafeImage';
import {
  getProfileDisplayRole,
  isOwnUserProfile,
  isStaffUser,
} from '../../../../utils/profileUtils';

interface ProfileProps {
  targetUser: User;
  currentUser: User | null;
  posts: Post[]; // Kept for backward compat or other uses, but we'll fetch our own for the list
  comments: Comment[];
  onBack: () => void;
  onViewPost: (id: string) => void;
  onNavigateAdmin?: () => void;
  onUpdateUser?: (user: Partial<User>) => void;
  postsPerPage?: number;
}

// Utility for Avatar (Reused logic for consistency)
const ProfileAvatar: React.FC<{ url?: string; name: string; email?: string; size?: string }> = ({
  url,
  name,
  email,
  size = 'w-32 h-32',
}) => {
  return (
    <div
      className={`${size} rounded-full overflow-hidden border-4 border-white dark:border-neutral-900 bg-neutral-100 flex-shrink-0 shadow-lg`}
    >
      <SafeImage
        src={url}
        alt={name}
        className="w-full h-full object-cover"
        fallback={
          <Gravatar
            email={email || name}
            size={200}
            className="w-full h-full object-cover"
            default="identicon"
          />
        }
      />
    </div>
  );
};

const UserProfile: React.FC<ProfileProps> = ({
  targetUser,
  currentUser,
  posts: _posts, // Legacy global posts (unused, renamed to silence warning)
  comments: _comments,
  onBack,
  onViewPost,
  onNavigateAdmin,
  onUpdateUser,
  postsPerPage = 6,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(targetUser.display_name || '');
  const [editBio, setEditBio] = useState(targetUser.bio || '');
  const [editAvatar, setEditAvatar] = useState(targetUser.avatar || '');

  // Password Change State
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Optimistic update state
  const [displayUser, setDisplayUser] = useState(targetUser);

  useEffect(() => {
    setDisplayUser(targetUser);
    setEditDisplayName(targetUser.display_name || '');
    setEditBio(targetUser.bio || '');
    setEditAvatar(targetUser.avatar || '');
  }, [targetUser]);

  const [activeTab, setActiveTab] = useState<'articles' | 'comments'>('articles');

  const {
    articlePosts,
    articleTotal,
    articleHasMore,
    articlesLoading,
    articlesError,
    commentItems,
    commentTotal,
    commentHasMore,
    commentsLoading,
    commentsError,
    loadMoreArticles,
    loadMoreComments,
  } = useProfileActivity(targetUser, postsPerPage);

  const isOwnProfile = isOwnUserProfile(currentUser, targetUser);
  const canAccessAdmin = isOwnProfile && isStaffUser(currentUser);
  const displayRole = getProfileDisplayRole(currentUser, displayUser);

  const roleColor =
    displayRole === 'Admin'
      ? 'bg-purple-100 text-purple-600 border-purple-200'
      : displayRole === 'Moderator'
        ? 'bg-blue-100 text-blue-600 border-blue-200'
        : displayRole === 'Writer'
          ? 'bg-amber-100 text-amber-600 border-amber-200'
          : 'bg-neutral-100 text-neutral-600 border-neutral-200';

  const handleSaveProfile = async () => {
    try {
      // Optimistic update
      const updatedUser = {
        ...displayUser,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };
      setDisplayUser(updatedUser);
      setIsEditing(false);

      // Global Update
      if (onUpdateUser && isOwnProfile) {
        onUpdateUser({ display_name: editDisplayName, bio: editBio, avatar: editAvatar });
      }

      // Build payload - only add password if actually changing it
      const payload: any = {
        id: currentUser?.id,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };

      // Only include password fields if user actually entered a new password
      if (showPasswordFields && newPassword) {
        if (!currentPassword) {
          toast.error('Current password is required');
          return;
        }
        if (newPassword !== confirmNewPassword) {
          toast.error('Passwords do not match');
          return;
        }
        // Strong Password Check
        if (
          newPassword.length < 8 ||
          !/[A-Z]/.test(newPassword) ||
          !/[0-9]/.test(newPassword) ||
          !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
        ) {
          toast.error('Password too weak (8+ chars, Upper, Number, Symbol)');
          return;
        }
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const response = await vonFetch(API.updateProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json(); // Clean Parse

      if (response.ok && data.success) {
        toast.success(data.message || 'Profile updated!');
        // Clear sensitive fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordFields(false);
      } else {
        toast.error(data.error || 'Failed to save profile');
        // Revert optimistic update only on error
        setDisplayUser(targetUser);
      }
    } catch (e) {
      toast.error('Failed to save profile');
      setDisplayUser(targetUser);
    }
  };

  return (
    <div className="animate-fade-in w-full max-w-5xl mx-auto pb-20">
      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-100 dark:border-neutral-800">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Edit Profile</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Display name / Pen name
                </span>
                <input
                  aria-label="Display name / Pen name"
                  id="userprofile-display-name"
                  name="userprofileDisplayName"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Public author name"
                  className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Avatar URL
                </span>
                <input
                  aria-label="Avatar URL"
                  id="userprofile-216"
                  name="userprofile216"
                  type="text"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <p className="text-xs text-neutral-400 mt-1">
                  Leave empty for auto-generated avatar.
                </p>
              </div>
              <div>
                <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Bio / Message
                </span>
                <textarea
                  id="userprofile-231"
                  name="userprofile231"
                  aria-label="Bio / Message"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={4}
                  placeholder="Tell us about yourself..."
                  className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                />
              </div>

              {/* Password Change Section */}
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="text-sm font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {showPasswordFields ? '− Cancel Password Change' : '+ Change Password'}
                </button>

                {showPasswordFields && (
                  <div className="mt-4 space-y-4 animate-fade-in p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                    <div>
                      <span className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Current Password (Required)
                      </span>
                      <input
                        aria-label="Current Password (Required)"
                        id="userprofile-256"
                        name="userprofile256"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        New Password
                      </span>
                      <input
                        id="userprofile-267"
                        name="userprofile267"
                        aria-label="New Password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="8+ chars, Upper, Number, Symbol"
                        className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Confirm New Password
                      </span>
                      <input
                        id="userprofile-279"
                        name="userprofile279"
                        aria-label="Confirm New Password"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 flex justify-end gap-3 cancel-save-actions">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mb-6 px-4 lg:px-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors group font-medium"
        >
          <div className="p-2 rounded-full bg-white dark:bg-neutral-800 shadow-sm group-hover:bg-neutral-100 transition-colors">
            <ArrowLeft size={18} />
          </div>
          Back to Feed
        </button>

        <div className="flex gap-3">
          {isOwnProfile && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-full text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
            >
              Edit Profile
            </button>
          )}

          {canAccessAdmin && onNavigateAdmin && (
            <button
              onClick={onNavigateAdmin}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-sm font-medium hover:shadow-lg transition-all"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden shadow-xl shadow-neutral-200/50 dark:shadow-none border border-neutral-100 dark:border-neutral-800 mb-8 mx-4 lg:mx-0">
        {/* Cover Photo (Gradient for now) */}
        <div className="h-48 md:h-64 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
        </div>

        <div className="px-6 md:px-10 pb-8 relative">
          <div className="flex flex-col md:flex-row items-center md:items-end -mt-12 md:-mt-16 gap-3 md:gap-8">
            {/* Avatar */}
            <div className="relative z-10">
              <ProfileAvatar
                url={displayUser.avatar}
                name={displayUser.display_name || displayUser.username}
                email={displayUser.email}
                size="w-32 h-32 md:w-40 md:h-40"
              />
              {isOwnProfile && (
                <span
                  className="absolute bottom-2 right-2 bg-green-500 border-4 border-white dark:border-neutral-900 w-6 h-6 rounded-full shadow-sm"
                  title="It's You!"
                ></span>
              )}
            </div>

            {/* Info Block */}
            <div className="flex-grow min-w-0 text-center md:text-left mb-4 md:mb-10 w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white md:text-white md:drop-shadow-sm tracking-tight [overflow-wrap:anywhere]">
                    {displayUser.display_name || displayUser.username}
                  </h1>
                  {displayUser.display_name && (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 [overflow-wrap:anywhere]">
                      @{displayUser.username}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${roleColor}`}
                    >
                      {displayRole}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                      <MapPin size={14} /> Earth
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 mt-4 border-t border-neutral-100 dark:border-neutral-800">
            <div className="md:col-span-1 text-center md:text-left">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
                About
              </h4>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed text-sm">
                {displayUser.bio || 'No bio yet.'}
              </p>
            </div>
            <div className="md:col-span-2 flex justify-center md:justify-end gap-6 md:gap-8 items-center">
              <div className="text-center">
                {/* Use meta.total if available, else standard length */}
                <span className="block text-xl md:text-2xl font-bold text-neutral-900 dark:text-white">
                  {articleTotal}
                </span>
                <span className="text-[10px] md:text-xs text-neutral-500 uppercase tracking-wide font-semibold">
                  Articles
                </span>
              </div>
              <div className="w-px h-10 bg-neutral-200 dark:bg-neutral-800"></div>
              <div className="text-center">
                <span className="block text-xl md:text-2xl font-bold text-neutral-900 dark:text-white">
                  {commentTotal}
                </span>
                <span className="text-[10px] md:text-xs text-neutral-500 uppercase tracking-wide font-semibold">
                  Comments
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="flex items-center gap-6 mb-6 px-4 lg:px-0 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('articles')}
          className={`pb-4 text-sm font-bold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'articles' ? 'text-primary-600 border-primary-600' : 'text-neutral-400 border-transparent hover:text-neutral-600'}`}
        >
          <span className="flex items-center gap-2">
            {/* Show Total if meta available */}
            <FileText size={16} /> Articles ({articleTotal})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`pb-4 text-sm font-bold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'comments' ? 'text-primary-600 border-primary-600' : 'text-neutral-400 border-transparent hover:text-neutral-600'}`}
        >
          <span className="flex items-center gap-2">
            <MessageCircle size={16} /> Comments ({commentTotal})
          </span>
        </button>
      </div>

      {/* Content Grid */}
      <div className="px-4 lg:px-0 min-h-[360px]">
        {activeTab === 'articles' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in min-h-[360px]">
              {articlesLoading && articlePosts.length === 0 ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`profile-article-skeleton-${index}`}
                    className="animate-pulse bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex gap-4"
                  >
                    <div className="w-24 h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex-shrink-0" />
                    <div className="flex-1 space-y-3 py-2">
                      <div className="h-3 w-1/4 rounded bg-neutral-200 dark:bg-neutral-800" />
                      <div className="h-4 rounded bg-neutral-200 dark:bg-neutral-800" />
                      <div className="h-4 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
                      <div className="h-3 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
                    </div>
                  </div>
                ))
              ) : articlePosts.length > 0 ? (
                articlePosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => onViewPost(post.id)}
                    className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800 transition-all group flex gap-4"
                  >
                    <div className="w-24 h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800 overflow-hidden flex-shrink-0">
                      {post.image && (
                        <img
                          {...getResponsiveImageAttributes(post, 'card')}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          alt={post.title}
                        />
                      )}
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] uppercase font-bold text-primary-600 mb-1">
                        {post.category}
                      </span>
                      <h3
                        className="font-bold text-neutral-900 dark:text-white leading-tight mb-2 group-hover:text-primary-600 transition-colors line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.title) }}
                      />
                      <p className="text-xs text-neutral-400">
                        {post.readTime || '5 min read'} • {post.updatedAt}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 py-12 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <div className="inline-block p-4 bg-neutral-50 dark:bg-neutral-800 rounded-full mb-3 text-neutral-300">
                    <FileText size={32} />
                  </div>
                  <p className="text-neutral-500">No articles published yet.</p>
                </div>
              )}
            </div>
            {/* Load More for Articles */}
            <LoadMoreButton
              loading={articlesLoading}
              hasMore={articleHasMore}
              error={articlesError}
              onLoadMore={loadMoreArticles}
              label="Load More Articles"
            />
          </>
        ) : (
          <>
            <div className="space-y-4 animate-fade-in min-h-[360px]">
              {commentsLoading && commentItems.length === 0 ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`profile-comment-skeleton-${index}`}
                    className="animate-pulse bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 h-5 w-5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                      <div className="flex-1 space-y-3">
                        <div className="h-4 rounded bg-neutral-200 dark:bg-neutral-800" />
                        <div className="h-4 w-4/5 rounded bg-neutral-200 dark:bg-neutral-800" />
                        <div className="h-3 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
                      </div>
                    </div>
                  </div>
                ))
              ) : commentItems.length > 0 ? (
                commentItems.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <MessageCircle size={20} className="text-neutral-300" />
                      </div>
                      <div>
                        <p className="text-neutral-600 dark:text-neutral-300 italic mb-3">
                          "{comment.content}"
                        </p>
                        <div className="flex items-center gap-4 text-xs text-neutral-400">
                          <span className="font-semibold text-neutral-500 dark:text-neutral-400">
                            Commented on a post
                          </span>
                          <span>•</span>
                          <span>{comment.createdAt}</span>
                          <span className="flex items-center gap-1 ml-2">
                            <ThumbsUp size={12} /> {comment.likes}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <p className="text-neutral-500">No activity yet.</p>
                </div>
              )}
            </div>
            {/* Load More for Comments */}
            <LoadMoreButton
              loading={commentsLoading}
              hasMore={commentHasMore}
              error={commentsError}
              onLoadMore={loadMoreComments}
              label="Load More Comments"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
