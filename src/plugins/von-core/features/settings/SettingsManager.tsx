/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Settings,
  Link as LinkIcon,
  Megaphone,
  Zap,
  Save,
  Trash2,
  User,
  Link2,
  Image,
  ArrowLeftRight,
  ShieldCheck,
  Globe, // Added Globe
  FolderTree,
  GripVertical,
} from 'lucide-react';
import { SiteSettings } from '../../../../types';
import { sanitizeHtml } from '../../../../utils/security';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';

// Import New Sub-Modules
import { GoogleSettings } from './components/GoogleSettings';
import { GeneralSettings } from './components/GeneralSettings';

import { AdSettings } from './components/AdSettings';
import { PermalinkSettings } from './components/PermalinkSettings';
import { ProfileSettings } from './components/ProfileSettings';
import { WPMigrator } from '../tools/WPMigrator';
import { SystemTools } from '../tools/SystemTools';
import { MediaSettings } from './components/MediaSettings';
import { CategorySettings } from './components/CategorySettings';

const isSavedAiKeyExpired = (api?: SiteSettings['api']) => {
  const aiKeyExpiresAt = api?.aiKeyExpiresAt?.trim();
  const aiKeyExpiresAtTime = aiKeyExpiresAt ? Date.parse(aiKeyExpiresAt) : Number.NaN;

  return Boolean(
    api?.aiApiKey &&
    api?.expireAiKeyAfter30Days &&
    aiKeyExpiresAt &&
    (!Number.isFinite(aiKeyExpiresAtTime) || aiKeyExpiresAtTime <= Date.now())
  );
};

interface SettingsViewProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => boolean | Promise<boolean>;
  posts?: any[];
  pages?: any[];
  notify: (msg: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdate,
  notify,
  posts = [],
  pages = [],
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'general'
    | 'google'
    | 'profile'
    | 'permalinks'
    | 'ads'
    | 'categories'
    | 'menu'
    | 'api'
    | 'tools'
    | 'media'
    | 'bridge'
  >('general');
  const [tempSettings, setTempSettings] = useState<SiteSettings>(settings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expiredAiKeyNotice, setExpiredAiKeyNotice] = useState(false);
  const canManageSecrets = Boolean(tempSettings._canManageSecrets);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await vonFetch(API.settings);
      const data = await res.json();
      const savedAiKeyExpired = isSavedAiKeyExpired(data.api);

      if (savedAiKeyExpired) {
        setExpiredAiKeyNotice(true);
        const { aiKeySavedAt, aiKeyExpiresAt, ...apiWithoutExpiredKey } = data.api || {};
        setTempSettings({
          ...data,
          api: {
            ...apiWithoutExpiredKey,
            aiApiKey: '',
          },
        });
        return;
      }

      setExpiredAiKeyNotice(false);
      setTempSettings(data);
    } catch (error) {
      notify('Failed to fetch settings: ' + String(error));
    }
  };

  // Menu Builder State
  const [newMenuItem, setNewMenuItem] = useState({ label: '', url: '' });
  const [draggedMenuItemIndex, setDraggedMenuItemIndex] = useState<number | null>(null);

  useEffect(() => {
    const savedAiKeyExpired = isSavedAiKeyExpired(settings.api);

    if (savedAiKeyExpired) {
      setExpiredAiKeyNotice(true);
      const { aiKeySavedAt, aiKeyExpiresAt, ...apiWithoutExpiredKey } = settings.api || {};
      setTempSettings({
        ...settings,
        api: {
          ...apiWithoutExpiredKey,
          aiApiKey: '',
        },
      });
      return;
    }

    setExpiredAiKeyNotice(false);
    setTempSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!canManageSecrets && ['api', 'media', 'bridge', 'tools'].includes(activeTab)) {
      setActiveTab('general');
    }
  }, [activeTab, canManageSecrets]);

  const handleChange = (section: 'ads' | 'api' | null, key: string, value: any) => {
    setTempSettings((prev) => {
      if (section === 'ads' || section === 'api') {
        return { ...prev, [section]: { ...prev[section], [key]: value } };
      }
      return { ...prev, [key]: value };
    });
  };

  // Handlers for sub-components
  const handleGeneralChange = (key: string, value: any) => handleChange(null, key, value);
  const handleAdsChange = (key: string, value: any) => handleChange('ads', key, value);

  const handlePermalinkChange = (key: string, value: any) => {
    // permalinkStructure is a top-level key, not nested
    // key comes as 'permalinkStructure', value is the actual value like 'slug' or 'date'
    setTempSettings((prev) => ({ ...prev, [key]: value }));
  };
  const handleProfileChange = (key: string, value: any) => {
    // adminProfile is already an object, set it directly
    setTempSettings((prev) => ({ ...prev, [key]: value }));
  };
  const handleAiApiKeyChange = (value: string) => {
    setExpiredAiKeyNotice(false);
    handleChange('api', 'aiApiKey', value.trim());
  };

  const save = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const rawAiModel = tempSettings.api?.aiModel?.trim() || '';
      const settingsToSave: SiteSettings = {
        ...tempSettings,
        api: {
          ...tempSettings.api,
          aiProvider: 'gemini',
          aiModel: rawAiModel.startsWith('gemini-') ? rawAiModel : 'gemini-flash-latest',
        },
      };

      setTempSettings(settingsToSave);
      const saved = await onUpdate(settingsToSave);
      if (saved === false) {
        notify(
          'Failed to persist settings to server. Please ensure your configuration is correct and the server is reachable.'
        );
        return;
      }

      toast.success('Settings saved successfully!');
    } catch (err) {
      notify('Unexpected error: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Menu Logic
  const addMenuItem = () => {
    if (!newMenuItem.label || !newMenuItem.url) {
      toast.error('Please enter both a label and a URL.');
      return;
    }
    setTempSettings({
      ...tempSettings,
      navigation: [
        ...tempSettings.navigation,
        {
          id: `nav-${Date.now()}`,
          label: newMenuItem.label,
          url: newMenuItem.url,
          type: 'external',
        },
      ],
    });
    setNewMenuItem({ label: '', url: '' });
    toast.success('Link added to menu!');
  };
  const deleteMenuItem = (id: string) =>
    setTempSettings({
      ...tempSettings,
      navigation: tempSettings.navigation.filter((n) => n.id !== id),
    });
  const reorderMenuItem = (targetIndex: number) => {
    if (draggedMenuItemIndex === null || draggedMenuItemIndex === targetIndex) return;

    setTempSettings((prev) => {
      const nextNavigation = [...prev.navigation];
      const draggedItem = nextNavigation[draggedMenuItemIndex];
      if (!draggedItem) return prev;

      nextNavigation.splice(draggedMenuItemIndex, 1);
      nextNavigation.splice(targetIndex, 0, draggedItem);

      return { ...prev, navigation: nextNavigation };
    });
    setDraggedMenuItemIndex(targetIndex);
  };
  const selectedAiModel = tempSettings.api?.aiModel?.startsWith('gemini-')
    ? tempSettings.api.aiModel
    : 'gemini-flash-latest';
  const aiKeyExpiresAtTime = tempSettings.api?.aiKeyExpiresAt
    ? Date.parse(tempSettings.api.aiKeyExpiresAt)
    : Number.NaN;
  const savedAiKeyExpired = Boolean(
    tempSettings.api?.aiApiKey &&
    tempSettings.api?.expireAiKeyAfter30Days &&
    Number.isFinite(aiKeyExpiresAtTime) &&
    aiKeyExpiresAtTime <= Date.now()
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">System Settings</h2>

      {/* Tabs */}
      {/* Tabs - Pills Design */}
      <div className="flex flex-wrap gap-2 mb-8 p-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'general'
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Settings size={18} className={activeTab === 'general' ? 'fill-current' : ''} /> General
        </button>
        <button
          onClick={() => setActiveTab('google')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'google'
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe size={18} /> Google
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User size={18} className={activeTab === 'profile' ? 'fill-current' : ''} /> Profile
        </button>
        <button
          onClick={() => setActiveTab('permalinks')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'permalinks'
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 shadow-sm ring-1 ring-amber-200 dark:ring-amber-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Link2 size={18} /> Permalinks
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FolderTree size={18} /> Categories
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'menu'
              ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 shadow-sm ring-1 ring-pink-200 dark:ring-pink-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LinkIcon size={18} /> Menu
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'ads'
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 shadow-sm ring-1 ring-rose-200 dark:ring-rose-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Megaphone size={18} className={activeTab === 'ads' ? 'fill-current' : ''} /> Ads
        </button>
        {canManageSecrets && (
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
              activeTab === 'api'
                ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 shadow-sm ring-1 ring-violet-200 dark:ring-violet-800'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap size={18} className={activeTab === 'api' ? 'fill-current' : ''} /> API
          </button>
        )}
        {/* SEO is managed via Extensions/VonSEO plugin */}
        {canManageSecrets && (
          <>
            <button
              onClick={() => setActiveTab('media')}
              className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
                activeTab === 'media'
                  ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400 shadow-sm ring-1 ring-cyan-200 dark:ring-cyan-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Image size={18} /> Media
            </button>
            <button
              onClick={() => setActiveTab('bridge')}
              className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
                activeTab === 'bridge'
                  ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 shadow-sm ring-1 ring-orange-200 dark:ring-orange-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowLeftRight size={18} /> Bridge
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
                activeTab === 'tools'
                  ? 'bg-slate-100 text-slate-600 dark:bg-[#1a1b26] dark:text-slate-300 shadow-sm ring-1 ring-slate-200 dark:ring-white/10'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck size={18} /> Tools
            </button>
          </>
        )}
      </div>

      {/* Render Active Tab */}
      {activeTab === 'general' && (
        <GeneralSettings
          settings={tempSettings}
          onChange={handleGeneralChange}
          canManageSecrets={canManageSecrets}
        />
      )}
      {activeTab === 'google' && (
        <GoogleSettings
          settings={tempSettings}
          onChange={(key, value) => setTempSettings((prev) => ({ ...prev, [key]: value }))}
        />
      )}
      {activeTab === 'profile' && (
        <ProfileSettings
          settings={tempSettings}
          onChange={handleProfileChange}
          readOnly={!canManageSecrets}
        />
      )}
      {activeTab === 'permalinks' && (
        <PermalinkSettings settings={tempSettings} onChange={handlePermalinkChange} />
      )}
      {activeTab === 'ads' && <AdSettings settings={tempSettings} onChange={handleAdsChange} />}
      {activeTab === 'categories' && (
        <CategorySettings
          onCategoriesChange={(categories) => setTempSettings((prev) => ({ ...prev, categories }))}
        />
      )}
      {activeTab === 'media' && canManageSecrets && (
        <MediaSettings
          settings={tempSettings}
          onChange={(key, value) => setTempSettings((prev) => ({ ...prev, [key]: value }))}
        />
      )}
      {activeTab === 'tools' && canManageSecrets && (
        <div className="space-y-12">
          <SystemTools />
        </div>
      )}
      {activeTab === 'bridge' && canManageSecrets && (
        <div className="space-y-12">
          <WPMigrator />
        </div>
      )}

      {activeTab === 'menu' && (
        <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Existing Menu Items */}
            <div>
              <h3 className="font-bold mb-4 dark:text-white flex items-center gap-2">
                <LinkIcon size={18} className="text-primary-500" /> Active Menu Items
              </h3>
              <div className="space-y-2 min-h-[200px] border border-slate-100 dark:border-white/10 rounded-xl p-2 bg-slate-50 dark:bg-[#16161e]/50">
                {tempSettings.navigation.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-8">No menu items yet.</p>
                )}
                {tempSettings.navigation.map((item, idx) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedMenuItemIndex(idx)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      reorderMenuItem(idx);
                    }}
                    onDragEnd={() => setDraggedMenuItemIndex(null)}
                    className={`flex justify-between items-center p-3 bg-white dark:bg-[#1a1b26] rounded-lg shadow-sm border border-slate-200 dark:border-[#2a2b36] group cursor-move transition-all ${
                      draggedMenuItemIndex === idx ? 'opacity-50 scale-[0.99]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical size={16} />
                      <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-[#242633] px-1.5 py-0.5 rounded">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-white text-sm">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {item.url}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMenuItem(item.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Manual Add */}
              {/* Manual Add */}
              <div className="mt-4 p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-xl border border-slate-100 dark:border-white/10">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Add Custom Link
                </h4>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <label htmlFor="menu-item-label" className="sr-only">
                    Label
                  </label>
                  <input
                    id="menu-item-label"
                    type="text"
                    placeholder="Label (e.g., About)"
                    value={newMenuItem.label}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, label: e.target.value })}
                    className="border border-slate-300 dark:border-[#333544] p-2.5 rounded-lg flex-1 text-sm dark:bg-[#1a1b26] dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  />
                  <label htmlFor="menu-item-url" className="sr-only">
                    URL
                  </label>
                  <input
                    id="menu-item-url"
                    type="text"
                    aria-label="New Menu Item URL"
                    placeholder="URL (e.g., /about or https://...)"
                    value={newMenuItem.url}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, url: e.target.value })}
                    className="border border-slate-300 dark:border-[#333544] p-2.5 rounded-lg flex-1 text-sm dark:bg-[#1a1b26] dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={addMenuItem}
                    className="relative z-10 cursor-pointer bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                  >
                    Add Link
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Add Content */}
            <div>
              <h3 className="font-bold mb-4 dark:text-white flex items-center gap-2">
                <Zap size={18} className="text-amber-500" /> Quick Add Pages & Posts
              </h3>
              <div className="h-[400px] overflow-y-auto space-y-4 pr-2">
                {/* Pages List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-[#1a1b26] py-2 z-10">
                    Pages
                  </h4>
                  <div className="space-y-1">
                    {(pages || []).map((page) => {
                      const isLinked = tempSettings.navigation.some(
                        (n) => n.url === `page:${page.id}`
                      );
                      const pageInputId = `settings-menu-page-${page.id}`;
                      return (
                        <label
                          key={page.id}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-[#242633] rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              id={pageInputId}
                              name={pageInputId}
                              type="checkbox"
                              checked={isLinked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTempSettings({
                                    ...tempSettings,
                                    navigation: [
                                      ...tempSettings.navigation,
                                      {
                                        id: `nav-${Date.now()}`,
                                        label: page.title,
                                        url: `page:${page.id}`,
                                        type: 'internal',
                                      },
                                    ],
                                  });
                                } else {
                                  setTempSettings({
                                    ...tempSettings,
                                    navigation: tempSettings.navigation.filter(
                                      (n) => n.url !== `page:${page.id}`
                                    ),
                                  });
                                }
                              }}
                              aria-label={`Add page ${page.title} to menu`}
                              className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                            />
                            <span
                              className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.title) }}
                            />
                          </div>
                          {isLinked && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                              ADDED
                            </span>
                          )}
                        </label>
                      );
                    })}
                    {(!pages || pages.length === 0) && (
                      <p className="text-slate-400 text-xs italic">No pages found.</p>
                    )}
                  </div>
                </div>

                {/* Posts List */}
                <div className="pt-4 border-t border-slate-100 dark:border-[#2a2b36]">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-[#1a1b26] py-2 z-10">
                    Latest Articles
                  </h4>
                  <div className="space-y-1">
                    {(posts || []).map((post) => {
                      const isLinked = tempSettings.navigation.some(
                        (n) => n.url === `post:${post.id}`
                      );
                      const postInputId = `settings-menu-post-${post.id}`;
                      return (
                        <label
                          key={post.id}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-[#242633] rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              id={postInputId}
                              name={postInputId}
                              type="checkbox"
                              checked={isLinked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTempSettings({
                                    ...tempSettings,
                                    navigation: [
                                      ...tempSettings.navigation,
                                      {
                                        id: `nav-${Date.now()}`,
                                        label: post.title,
                                        url: `post:${post.id}`,
                                        type: 'internal',
                                      },
                                    ],
                                  });
                                } else {
                                  setTempSettings({
                                    ...tempSettings,
                                    navigation: tempSettings.navigation.filter(
                                      (n) => n.url !== `post:${post.id}`
                                    ),
                                  });
                                }
                              }}
                              aria-label={`Add post ${post.title} to menu`}
                              className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                            />
                            <span
                              className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.title) }}
                            />
                          </div>
                          {isLinked && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                              ADDED
                            </span>
                          )}
                        </label>
                      );
                    })}
                    {(!posts || posts.length === 0) && (
                      <p className="text-slate-400 text-xs italic">No posts found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'api' && canManageSecrets && (
        <div className="space-y-6">
          {/* Spam Protection - Honeypot & Rate Limiting */}
          <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-4">
            <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-green-500" /> Spam Protection Active
            </h3>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 p-4 rounded-xl space-y-2">
              <p className="text-sm text-green-800 dark:text-green-200">
                VonCMS uses Honeypot technology and Rate Limiting to protect against bots and spam.
                No external API keys required.
              </p>
              <ul className="text-xs text-green-700 dark:text-green-300 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                <li className="flex items-center gap-2">✓ Hidden field trap for automated bots</li>
                <li className="flex items-center gap-2">
                  ✓ Rate limiting: 5 attempts per 15 minutes
                </li>
                <li className="flex items-center gap-2">✓ CSRF protection on admin forms</li>
                <li className="flex items-center gap-2">
                  ✓ Session timeout after 1 hour inactivity
                </li>
              </ul>
            </div>
          </div>

          {/* AI Generation Settings */}
          <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-6">
            <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
              <Zap size={20} className="text-violet-500" /> AI Content Generation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="api-ai-provider"
                    className="block text-sm font-bold mb-1 dark:text-white"
                  >
                    AI Provider
                  </label>
                  <input
                    id="api-ai-provider"
                    name="apiAiProvider"
                    type="text"
                    value="Google Gemini"
                    readOnly
                    className="w-full p-2.5 border rounded-lg dark:bg-[#16161e] dark:text-white dark:border-[#2a2b36]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    AI generation currently uses Google Gemini.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="api-ai-key"
                    className="block text-sm font-bold mb-1 dark:text-white"
                  >
                    API Key
                  </label>
                  <input
                    id="api-ai-key"
                    type="password"
                    value={tempSettings.api?.aiApiKey || ''}
                    onChange={(e) => handleAiApiKeyChange(e.target.value)}
                    className="w-full p-2.5 border rounded-lg dark:bg-[#16161e] dark:text-white dark:border-[#2a2b36]"
                    placeholder="Gemini API key"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter your Google Gemini API Key from AI Studio.
                  </p>
                  {(savedAiKeyExpired || expiredAiKeyNotice) && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      Saved Gemini API key expired. Enter a fresh key to continue.
                    </p>
                  )}
                  <label className="mt-3 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input
                      id="settingsmanager-638"
                      name="settingsmanager638"
                      type="checkbox"
                      checked={Boolean(tempSettings.api?.expireAiKeyAfter30Days)}
                      onChange={(e) =>
                        handleChange('api', 'expireAiKeyAfter30Days', e.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Expire saved AI key after 30 days</span>
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="block text-sm font-bold mb-1 dark:text-white">
                    Model (Optional)
                  </span>
                  <select
                    id="settingsmanager-655"
                    name="settingsmanager655"
                    aria-label="Model (Optional)"
                    value={selectedAiModel}
                    onChange={(e) => handleChange('api', 'aiModel', e.target.value)}
                    className="w-full p-2.5 border rounded-lg dark:bg-[#16161e] dark:text-white dark:border-[#2a2b36]"
                  >
                    <option value="gemini-flash-latest">gemini-flash-latest</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/30 dark:border-[#2a2b36]/30 sticky bottom-0 bg-white/70 dark:bg-[#16161e]/70 backdrop-blur-xl py-4 -mx-4 px-4 shadow-2xl z-10">
        <button
          onClick={() => setTempSettings(settings)}
          className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-[#1a1b26]/60 rounded-lg font-medium transition-all backdrop-blur-sm border border-slate-200/50 dark:border-[#2a2b36]/50"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={isSubmitting}
          className={`px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 transition-all flex items-center gap-2 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          <Save size={18} className={isSubmitting ? 'animate-spin' : ''} />
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default SettingsView;
