import React, { useState } from 'react';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { User, Post, Comment } from '../../types';
import {
  FileText,
  MessageCircle,
  ThumbsUp,
  LayoutDashboard,
  Edit2,
  Save,
  Terminal,
} from 'lucide-react';
import { API } from '../../config/site.config';
import { vonFetch } from '../../utils/api';
import { LoadMoreButton } from '../../components/LoadMoreButton';
import { SafeImage } from '../../components/SafeImage';
import { getResponsiveImageAttributes } from '../../utils/siteUtils';
import { useProfileActivity } from '../../hooks/useProfileActivity';
import { getProfileDisplayRole, isOwnUserProfile, isStaffUser } from '../../utils/profileUtils';

interface ProfileProps {
  targetUser: User;
  currentUser: User | null;
  posts: Post[];
  comments: Comment[];
  onBack: () => void;
  onViewPost: (id: string) => void;
  onNavigateAdmin?: () => void;
  onUpdateUser?: (user: Partial<User>) => void;
  colors: any; // Theme colors passed from parent
  postsPerPage?: number;
}

// Utility: Tech Avatar
const TechAvatar: React.FC<{
  url?: string;
  name: string;
  email?: string;
  size?: string;
  borderColor?: string;
}> = ({ url, name, email, size = 'w-32 h-32', borderColor }) => {
  return (
    <div className={`${size} relative group`}>
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
      <div
        className="relative w-full h-full rounded-xl overflow-hidden border-2 bg-neutral-900"
        style={{ borderColor: borderColor || '#262626' }}
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
      {/* Tech Corners */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white opacity-50"></div>
    </div>
  );
};

const TechPressProfile: React.FC<ProfileProps> = ({
  targetUser,
  currentUser,
  posts: _posts,
  comments: _comments,
  onViewPost,
  onNavigateAdmin,
  onUpdateUser,
  colors,
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

  React.useEffect(() => {
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

  const isOwner = isOwnUserProfile(currentUser, targetUser);
  const canAccessAdmin = isOwner && isStaffUser(currentUser);
  const displayRole = getProfileDisplayRole(currentUser, displayUser);

  const handleSaveProfile = async () => {
    try {
      // Validate Password Change if attempted
      if (showPasswordFields && newPassword) {
        if (!currentPassword) {
          toast.error('Current password is required to change password');
          return;
        }
        if (newPassword !== confirmNewPassword) {
          toast.error('New passwords do not match');
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
      }

      const updatedUser = {
        ...displayUser,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };
      setDisplayUser(updatedUser);
      setIsEditing(false);

      if (onUpdateUser && isOwner) {
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
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const response = await vonFetch(API.updateProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message || 'Profile updated!');
        // Clear sensitive fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordFields(false);
      } else {
        toast.error(data.error || 'Failed to save profile');
        setDisplayUser(targetUser);
      }
    } catch (e) {
      toast.error('Failed to save profile');
      setDisplayUser(targetUser);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in font-sans">
      {/* Edit Modal - Tech Style */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-sm shadow-2xl relative overflow-hidden">
            {/* Decorative header line */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

            <div className="p-6">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Terminal size={24} className="text-neutral-500" />
                EDIT_PROFILE_CONFIG
              </h3>

              <div className="space-y-6">
                <div>
                  <span className="block text-xs font-mono text-neutral-400 mb-2 uppercase tracking-widest">
                    Display name / Pen name
                  </span>
                  <input
                    aria-label="Display name / Pen name"
                    id="profile-display-name"
                    name="profileDisplayName"
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 text-white px-4 py-3 rounded-sm focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 outline-none font-mono text-sm"
                    placeholder="Public author name"
                  />
                </div>
                <div>
                  <span className="block text-xs font-mono text-neutral-400 mb-2 uppercase tracking-widest">
                    Avatar Source URL
                  </span>
                  <div className="relative">
                    <input
                      aria-label="Avatar Source URL"
                      id="profile-226"
                      name="profile226"
                      type="text"
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white px-4 py-3 rounded-sm focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 outline-none font-mono text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-mono text-neutral-400 mb-2 uppercase tracking-widest">
                    Bio / Status Message
                  </span>
                  <textarea
                    id="profile-239"
                    name="profile239"
                    aria-label="Bio / Status Message"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={4}
                    className="w-full bg-neutral-950 border border-neutral-700 text-white px-4 py-3 rounded-sm focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 outline-none font-mono text-sm resize-none"
                    placeholder="System status..."
                  />
                </div>

                {/* Password Change Section - Tech Style */}
                <div className="pt-4 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowPasswordFields(!showPasswordFields)}
                    className="text-xs font-mono font-bold text-neutral-400 flex items-center gap-2 hover:text-neutral-200 uppercase tracking-widest"
                  >
                    {showPasswordFields ? '[-] Cancel' : '[+] Change Password'}
                  </button>

                  {showPasswordFields && (
                    <div className="mt-4 space-y-4 animate-fade-in p-4 bg-neutral-950/50 border border-neutral-800 rounded-sm">
                      <div>
                        <span className="block text-[10px] font-mono text-red-400 mb-1 uppercase tracking-widest">
                          Current Password *
                        </span>
                        <input
                          aria-label="Current Password *"
                          id="profile-264"
                          name="profile264"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded-sm focus:border-red-500 outline-none font-mono text-sm"
                          placeholder="******"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono text-green-400 mb-1 uppercase tracking-widest">
                          New Password
                        </span>
                        <input
                          id="profile-276"
                          name="profile276"
                          aria-label="New Password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="8+ chars, Upper, Number, Symbol"
                          className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded-sm focus:border-green-500 outline-none font-mono text-sm"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono text-green-400 mb-1 uppercase tracking-widest">
                          Confirm New Password
                        </span>
                        <input
                          id="profile-288"
                          name="profile288"
                          aria-label="Confirm New Password"
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded-sm focus:border-green-500 outline-none font-mono text-sm"
                          placeholder="Repeat new key"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-950/50 border-t border-neutral-800 flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 text-neutral-400 hover:text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors rounded-sm"
              >
                [ Cancel ]
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-6 py-2 bg-neutral-100 hover:bg-white text-black font-bold text-xs uppercase tracking-wider transition-all rounded-sm shadow-lg shadow-neutral-900/20 flex items-center gap-2"
              >
                <Save size={14} /> Save Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="relative mb-8">
        {/* Background Pattern */}
        <div className="absolute inset-0 h-64 bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl">
          {/* Grid Lines */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent"></div>
        </div>

        <div className="relative pt-20 px-8">
          <div className="flex flex-col md:flex-row items-end gap-8">
            {/* Avatar Block */}
            <div className="relative">
              <TechAvatar
                url={displayUser.avatar}
                name={displayUser.display_name || displayUser.username}
                email={displayUser.email}
                size="w-40 h-40"
                borderColor={colors.primary}
              />
              {isOwner && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute -bottom-2 -right-2 p-2 bg-neutral-800 border border-neutral-600 text-white rounded-lg hover:bg-neutral-700 hover:border-neutral-500 transition-all shadow-lg group z-20"
                >
                  <Edit2 size={16} className="group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-950 dark:text-white md:text-white font-sans tracking-tight">
                      {displayUser.display_name || displayUser.username}
                    </h1>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold border ${displayRole === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700/60 md:bg-purple-500/10 md:text-purple-400 md:border-purple-500/50' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 md:bg-neutral-500/10 md:text-neutral-400 md:border-neutral-500/50'}`}
                    >
                      {displayRole}
                    </span>
                  </div>
                  {displayUser.display_name && (
                    <p className="text-sm text-slate-500 dark:text-neutral-500 md:text-neutral-500 mb-3">
                      @{displayUser.username}
                    </p>
                  )}
                  <p className="text-slate-600 dark:text-neutral-400 md:text-neutral-400 max-w-xl text-sm md:text-base font-light border-l-2 border-slate-300 dark:border-neutral-700 md:border-neutral-700 pl-4 py-1 italic">
                    {displayUser.bio || 'No status message set.'}
                  </p>
                </div>

                <div className="flex gap-3">
                  {canAccessAdmin && onNavigateAdmin && (
                    <button
                      onClick={onNavigateAdmin}
                      className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      <LayoutDashboard size={14} /> Dashboard
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-4 rounded-xl flex items-center justify-between group hover:border-neutral-500/50 transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 uppercase tracking-wider font-bold mb-1">
              Articles
            </p>
            <p className="text-2xl font-black text-slate-800 dark:text-white">{articleTotal}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-neutral-500/10 flex items-center justify-center text-neutral-500 group-hover:scale-110 transition-transform">
            <FileText size={20} />
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-4 rounded-xl flex items-center justify-between group hover:border-purple-500/50 transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 uppercase tracking-wider font-bold mb-1">
              Comments
            </p>
            <p className="text-2xl font-black text-slate-800 dark:text-white">{commentTotal}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
            <MessageCircle size={20} />
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="mb-8 border-b border-slate-200 dark:border-neutral-800 flex gap-8">
        <button
          onClick={() => setActiveTab('articles')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'articles' ? 'text-slate-900 dark:text-neutral-100' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
        >
          Articles
          {activeTab === 'articles' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 shadow-[0_0_10px_rgba(15,23,42,0.25)] dark:bg-neutral-100 dark:shadow-[0_0_10px_rgba(255,255,255,0.3)]"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'comments' ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
        >
          Discussion
          {activeTab === 'comments' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600 dark:bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
          )}
        </button>
      </div>

      {/* Content Grid */}
      <div className="min-h-[360px]">
        {activeTab === 'articles' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[360px]">
              {articlesLoading && articlePosts.length === 0 ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`article-skeleton-${index}`}
                    className="animate-pulse bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden"
                  >
                    <div className="h-48 bg-slate-100 dark:bg-neutral-800" />
                    <div className="p-5 space-y-4">
                      <div className="h-5 rounded bg-slate-200 dark:bg-neutral-800" />
                      <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-neutral-800" />
                      <div className="border-t border-slate-100 pt-3 dark:border-neutral-800">
                        <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-neutral-800" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {articlePosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => onViewPost(post.id)}
                      className="group bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:border-neutral-500/30 transition-all duration-300 flex flex-col h-full"
                    >
                      <div className="h-48 overflow-hidden relative bg-slate-100 dark:bg-neutral-800">
                        {post.image && (
                          <img
                            {...getResponsiveImageAttributes(post, 'card')}
                            alt={post.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                        )}
                        <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                          {post.category}
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-neutral-300 transition-colors">
                          {post.title}
                        </h3>
                        <div className="mt-auto flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400 border-t border-slate-100 dark:border-neutral-800 pt-3">
                          <span>{post.readTime || '5 min read'}</span>
                          <span>{post.createdAt || post.updatedAt}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {articleTotal === 0 && !articlesLoading && (
                    <div className="col-span-3 py-16 text-center border-2 border-dashed border-slate-200 dark:border-neutral-800 rounded-2xl bg-slate-50 dark:bg-neutral-900/50">
                      <FileText
                        size={48}
                        className="text-slate-300 dark:text-neutral-700 mx-auto mb-4"
                      />
                      <p className="text-slate-500 dark:text-neutral-400 font-medium">
                        No articles found in the database.
                      </p>
                    </div>
                  )}
                </>
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
            <div className="space-y-4 min-h-[360px]">
              {commentsLoading && commentItems.length === 0 ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`comment-skeleton-${index}`}
                    className="animate-pulse bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-6 rounded-xl"
                  >
                    <div className="h-5 rounded bg-slate-200 dark:bg-neutral-800 mb-4" />
                    <div className="h-5 w-4/5 rounded bg-slate-200 dark:bg-neutral-800 mb-5" />
                    <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-neutral-800" />
                  </div>
                ))
              ) : (
                <>
                  {commentItems.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-6 rounded-xl relative group hover:border-purple-500/30 transition-all"
                    >
                      <div className="absolute left-0 top-6 w-1 h-8 bg-purple-500 rounded-r opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <p className="text-slate-700 dark:text-neutral-300 italic mb-4 text-lg">
                        "{comment.content}"
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                        <MessageCircle size={14} />
                        <span>Commented on {comment.createdAt}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                        <span className="text-purple-500 flex items-center gap-1">
                          <ThumbsUp size={12} /> {comment.likes} Likes
                        </span>
                      </div>
                    </div>
                  ))}
                  {commentTotal === 0 && !commentsLoading && (
                    <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-neutral-800 rounded-2xl bg-slate-50 dark:bg-neutral-900/50">
                      <MessageCircle
                        size={48}
                        className="text-slate-300 dark:text-neutral-700 mx-auto mb-4"
                      />
                      <p className="text-slate-500 dark:text-neutral-400 font-medium">
                        No discussion activity recorded.
                      </p>
                    </div>
                  )}
                </>
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

export default TechPressProfile;
