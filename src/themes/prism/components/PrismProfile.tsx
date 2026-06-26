import React from 'react';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { User, Post, Comment } from '../../../types';
import { ArrowLeft, Terminal, Cpu, LayoutDashboard } from 'lucide-react';
import { API } from '../../../config/site.config';
import { vonFetch } from '../../../utils/api';
import { LoadMoreButton } from '../../../components/LoadMoreButton';
import { SafeImage } from '../../../components/SafeImage';
import { getResponsiveImageAttributes } from '../../../utils/siteUtils';
import { useProfileActivity } from '../../../hooks/useProfileActivity';
import { getProfileDisplayRole, isOwnUserProfile, isStaffUser } from '../../../utils/profileUtils';

interface PrismProfileProps {
  targetUser: User;
  currentUser: User | null;
  posts: Post[];
  comments: Comment[];
  onBack: () => void;
  onViewPost: (id: string) => void;
  onNavigateAdmin?: () => void;
  onUpdateUser?: (user: Partial<User>) => void;
  postsPerPage?: number;
}

const GlitchText: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <span className={`relative inline-block group ${className} `}>
    <span className="relative z-10">{text}</span>
    <span className="absolute top-0 left-0 -z-10 w-full h-full text-[var(--color-secondary)] opacity-0 group-hover:opacity-70 group-hover:translate-x-[2px] transition-all duration-100 select-none">
      {text}
    </span>
    <span className="absolute top-0 left-0 -z-10 w-full h-full text-[var(--color-primary)] opacity-0 group-hover:opacity-70 group-hover:-translate-x-[2px] transition-all duration-100 select-none">
      {text}
    </span>
  </span>
);

const PrismProfile: React.FC<PrismProfileProps> = ({
  targetUser,
  currentUser,
  posts: _posts,
  comments: _comments,
  onBack,
  onViewPost,
  onNavigateAdmin,
  onUpdateUser,
  postsPerPage = 6,
}) => {
  // --- Edit Profile State ---
  const [isEditing, setIsEditing] = React.useState(false);
  const [editDisplayName, setEditDisplayName] = React.useState(targetUser.display_name || '');
  const [editBio, setEditBio] = React.useState(targetUser.bio || '');
  const [editAvatar, setEditAvatar] = React.useState(targetUser.avatar || '');
  const [displayUser, setDisplayUser] = React.useState(targetUser);

  // Password Change State
  const [showPasswordFields, setShowPasswordFields] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');

  React.useEffect(() => {
    setDisplayUser(targetUser);
    setEditDisplayName(targetUser.display_name || '');
    setEditBio(targetUser.bio || '');
    setEditAvatar(targetUser.avatar || '');
  }, [targetUser]);

  const handleSaveProfile = async () => {
    try {
      // Validate Password Change
      if (showPasswordFields) {
        if (!currentPassword) {
          toast.error('Current password is required');
          return;
        }
        if (
          newPassword &&
          (newPassword.length < 8 ||
            !/[A-Z]/.test(newPassword) ||
            !/[0-9]/.test(newPassword) ||
            !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword))
        ) {
          toast.error('Password too weak (8+ chars, Upper, Number, Symbol)');
          return;
        }
        if (newPassword !== confirmNewPassword) {
          toast.error('Passwords do not match');
          return;
        }
      }

      const updatedUser = {
        ...displayUser,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };
      const payload: any = {
        id: currentUser?.id,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };

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
        setDisplayUser(updatedUser);
        setIsEditing(false);
        if (onUpdateUser && isOwnProfile) {
          onUpdateUser({ display_name: editDisplayName, bio: editBio, avatar: editAvatar });
        }
        toast.success('SUCCESS: User data updated');

        // Clear
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordFields(false);
      } else {
        toast.error(data.error ? `ERROR: ${data.error}` : 'SYSTEM_FAILURE: Save failed');
        setDisplayUser(targetUser);
      }
    } catch (e) {
      toast.error('CRITICAL_ERROR: Connection lost');
      setDisplayUser(targetUser);
    }
  };

  // Tabs and Load More
  const [activeTab, setActiveTab] = React.useState<'articles' | 'comments'>('articles');
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

  const avatarSrc = displayUser.avatar || '';

  const isOwnProfile = isOwnUserProfile(currentUser, targetUser);
  const canAccessAdmin = isOwnProfile && isStaffUser(currentUser);
  const displayRole = getProfileDisplayRole(currentUser, displayUser);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#0a0a1f] border border-[var(--color-primary)] rounded-2xl shadow-[0_0_50px_rgba(139,92,246,0.3)] w-full max-w-md overflow-hidden relative">
            {/* Decorative Lines */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent"></div>

            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Terminal size={18} className="text-[var(--color-primary)]" />
                EDIT_PROFILE_DATA
              </h3>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div>
                <span className="block text-xs font-mono text-[var(--color-secondary)] mb-2 uppercase tracking-wider">
                  DISPLAY_NAME / PEN_NAME
                </span>
                <input
                  aria-label="Display name / Pen name"
                  id="prismprofile-display-name"
                  name="prismprofileDisplayName"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Public author name"
                  className="w-full px-4 py-3 rounded bg-black/50 border border-white/10 text-white font-mono focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all"
                />
              </div>
              <div>
                <span className="block text-xs font-mono text-[var(--color-secondary)] mb-2 uppercase tracking-wider">
                  AVATAR_SOURCE_URL
                </span>
                <input
                  aria-label="AVATAR_SOURCE_URL"
                  id="prismprofile-191"
                  name="prismprofile191"
                  type="text"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded bg-black/50 border border-white/10 text-white font-mono focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all"
                />
              </div>
              <div>
                <span className="block text-xs font-mono text-[var(--color-secondary)] mb-2 uppercase tracking-wider">
                  USER_BIO_MESSAGE
                </span>
                <textarea
                  id="prismprofile-203"
                  name="prismprofile203"
                  aria-label="USER_BIO_MESSAGE"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={4}
                  placeholder="Input status message..."
                  className="w-full px-4 py-3 rounded bg-black/50 border border-white/10 text-white font-mono focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all resize-none"
                />
              </div>

              {/* Password Change Section - Prism Style */}
              <div className="pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="text-xs font-mono font-bold text-[var(--color-primary)] mb-4 flex items-center gap-2 hover:text-white transition-colors tracking-widest"
                >
                  [{showPasswordFields ? '-' : '+'}]{' '}
                  {showPasswordFields ? 'Cancel' : 'Change Password'}
                </button>

                {showPasswordFields && (
                  <div className="space-y-4 animate-fade-in p-4 border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 rounded-lg">
                    <div>
                      <span className="block text-xs font-mono text-red-500 mb-1 uppercase tracking-wider">
                        Current Password *
                      </span>
                      <input
                        aria-label="Current Password *"
                        id="prismprofile-229"
                        name="prismprofile229"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="REQUIRED"
                        className="w-full px-3 py-2 rounded bg-black border border-white/10 text-white font-mono focus:border-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-mono text-[var(--color-secondary)] mb-1 uppercase tracking-wider">
                        New Password
                      </span>
                      <input
                        id="prismprofile-241"
                        name="prismprofile241"
                        aria-label="New Password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="8+ chars, Upper, Number, Symbol"
                        className="w-full px-3 py-2 rounded bg-black border border-white/10 text-white font-mono focus:border-[var(--color-primary)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-mono text-[var(--color-secondary)] mb-1 uppercase tracking-wider">
                        Confirm New Password
                      </span>
                      <input
                        id="prismprofile-253"
                        name="prismprofile253"
                        aria-label="Confirm New Password"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repeat key"
                        className="w-full px-3 py-2 rounded bg-black border border-white/10 text-white font-mono focus:border-[var(--color-primary)] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-400 hover:text-white font-mono text-sm transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-6 py-2 bg-[var(--color-primary)]/20 border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-black transition-all font-mono text-sm font-bold tracking-wider"
              >
                SAVE_CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-[var(--color-primary)] transition-colors font-mono text-sm"
        >
          <ArrowLeft size={16} /> SYSTEM.RETURN()
        </button>

        <div className="flex gap-3">
          {isOwnProfile && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/20 text-white rounded hover:bg-white/10 transition-all font-mono text-xs font-bold tracking-wider"
            >
              <Terminal size={14} />
              EDIT_DATA
            </button>
          )}

          {canAccessAdmin && onNavigateAdmin && (
            <button
              onClick={onNavigateAdmin}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)]/10 border border-[var(--color-primary)] text-[var(--color-primary)] rounded hover:bg-[var(--color-primary)] hover:text-black transition-all font-mono text-xs font-bold tracking-wider"
            >
              <LayoutDashboard size={14} />
              ACCESS_ADMIN_PANEL
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: User Stats & Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#0a0a1f]/50 backdrop-blur-sm border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] mb-4 relative">
                <div className="absolute inset-0 rounded-full bg-[var(--color-primary)] blur-md opacity-40 animate-pulse"></div>
                <SafeImage
                  src={avatarSrc}
                  alt={displayUser.display_name || targetUser.username}
                  className="w-full h-full rounded-full object-cover bg-black relative z-10"
                  fallback={
                    <Gravatar
                      email={displayUser.email || displayUser.username}
                      size={200}
                      className="w-full h-full rounded-full object-cover bg-black relative z-10"
                      default="identicon"
                    />
                  }
                />
              </div>

              <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">
                <GlitchText text={displayUser.display_name || displayUser.username} />
              </h1>
              {displayUser.display_name && (
                <p className="text-xs text-slate-500 font-mono mb-2">@{displayUser.username}</p>
              )}
              <div className="flex items-center gap-2 mb-6">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${
                    displayRole === 'Admin'
                      ? 'border-red-500/50 text-red-400 bg-red-500/10'
                      : displayRole === 'Moderator'
                        ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                        : 'border-slate-500/50 text-slate-400 bg-slate-500/10'
                  }`}
                >
                  {displayRole}
                </span>
              </div>

              <div className="w-full grid grid-cols-2 gap-2 text-center">
                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                  <div className="text-xs text-slate-500 font-mono mb-1">POSTS</div>
                  <div className="text-xl font-bold text-white">{articleTotal}</div>
                </div>
                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                  <div className="text-xs text-slate-500 font-mono mb-1">COMMENTS</div>
                  <div className="text-xl font-bold text-white">{commentTotal}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact / Bio */}
          <div className="bg-[#0a0a1f]/50 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Terminal size={14} className="text-[var(--color-secondary)]" />
              USER_DATA
            </h3>
            <div className="space-y-3 text-sm text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>STATUS:</span>
                <span className="text-[var(--color-primary)]">ONLINE</span>
              </div>
              <div className="flex justify-between">
                <span>ACCESS_LEVEL:</span>
                <span>{displayRole.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>ID:</span>
                <span>{String(displayUser.id).substring(0, 8)}...</span>
              </div>
              {displayUser.bio && (
                <div className="pt-3 mt-3 border-t border-white/10">
                  <span className="block text-[var(--color-secondary)] mb-1">BIO_MESSAGE:</span>
                  <p className="text-white italic">"{displayUser.bio}"</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Activity / Posts */}
        <div className="lg:col-span-2">
          {/* Tabs Heading */}
          <div className="flex gap-8 border-b border-white/10 mb-6">
            <button
              onClick={() => setActiveTab('articles')}
              className={`pb-4 text-xl font-bold flex items-center gap-2 transition-all relative ${activeTab === 'articles' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Cpu
                className={activeTab === 'articles' ? 'text-[var(--color-primary)]' : 'opacity-50'}
                size={20}
              />
              PUBLISHED_CONTENT
              {activeTab === 'articles' && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--color-primary)] shadow-[0_0_10px_rgba(139,92,246,0.5)]"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-4 text-xl font-bold flex items-center gap-2 transition-all relative ${activeTab === 'comments' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Terminal
                className={activeTab === 'comments' ? 'text-[var(--color-primary)]' : 'opacity-50'}
                size={20}
              />
              USER_DISCUSSION
              {activeTab === 'comments' && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--color-primary)] shadow-[0_0_10px_rgba(139,92,246,0.5)]"></span>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {activeTab === 'articles' ? (
              <>
                {articlePosts.length > 0 ? (
                  articlePosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => onViewPost(post.id)}
                      className="bg-[#0a0a1f]/30 border border-white/5 rounded-xl p-5 hover:border-[var(--color-primary)]/30 hover:bg-[#0a0a1f]/60 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-2">
                            <span className="text-[var(--color-secondary)]">{post.category}</span>
                            <span>//</span>
                            <span>{post.createdAt || post.updatedAt}</span>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                            {post.title}
                          </h3>
                          <p className="text-slate-400 text-sm line-clamp-2">{post.excerpt}</p>
                        </div>
                        {post.image && (
                          <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                            <img
                              {...getResponsiveImageAttributes(post, 'card')}
                              alt={post.title}
                              loading="lazy"
                              className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                    <p className="text-slate-500 font-mono">NO_DATA_FOUND</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {commentItems.length > 0 ? (
                  commentItems.map((comment: any) => (
                    <div
                      key={comment.id}
                      className="bg-[#0a0a1f]/30 border border-white/5 rounded-xl p-5 hover:border-[var(--color-primary)]/30 transition-all"
                    >
                      <p className="text-slate-300 font-mono text-sm mb-3">"{comment.content}"</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                        <span className="text-[var(--color-secondary)]">
                          TIMESTAMP: {comment.createdAt}
                        </span>
                        <span>LIKES: {comment.likes}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                    <p className="text-slate-500 font-mono">NO_DISCUSSION_DATA</p>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Load More */}
          <LoadMoreButton
            loading={activeTab === 'articles' ? articlesLoading : commentsLoading}
            hasMore={activeTab === 'articles' ? articleHasMore : commentHasMore}
            error={activeTab === 'articles' ? articlesError : commentsError}
            onLoadMore={activeTab === 'articles' ? loadMoreArticles : loadMoreComments}
            label="LOAD_MORE_DATA"
            className="font-mono"
          />
        </div>
      </div>
    </div>
  );
};

export default PrismProfile;
