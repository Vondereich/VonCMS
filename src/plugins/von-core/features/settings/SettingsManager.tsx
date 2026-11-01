/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
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
  RotateCw,
  Globe, // Added Globe
  FolderTree,
  GripVertical,
} from 'lucide-react';
import { SiteSettings } from '../../../../types';
import { decodeEntities } from '../../../../utils/textUtils';
import { formatDateTime } from '../../../../utils/dateFormat';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import { createSettingsPatch, mergeSettingsDraft } from '../../../../utils/settingsDraft';

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

const defaultAiModel = 'gemini-3.6-flash';
const currentAiModels = [
  { value: defaultAiModel, label: 'Gemini 3.6 Flash (Default)' },
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { value: 'gemini-flash-latest', label: 'Gemini Flash Latest (Automatic)' },
];
// Preserve a saved legacy configuration without offering it for new selections.
const legacyAiModels = [
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];
const supportedAiModels = [...currentAiModels.map(({ value }) => value), ...legacyAiModels];

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
  onRotateEncryptionKey?: (revision: string) => boolean | Promise<boolean>;
  posts?: import('../../../../types').Post[];
  pages?: import('../../../../types').Page[];
  notify: (msg: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdate,
  onRotateEncryptionKey,
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
  const draftBaselineRef = useRef<SiteSettings>(settings);
  const settingsSnapshotRef = useRef(settings);
  const settingsReadVersionRef = useRef(0);
  const savePendingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRotatingKey, setIsRotatingKey] = useState(false);
  const [expiredAiKeyNotice, setExpiredAiKeyNotice] = useState(false);
  const canManageSecrets = Boolean(tempSettings._canManageSecrets);
  const hasUnsavedSettings =
    Object.keys(createSettingsPatch(draftBaselineRef.current, tempSettings)).length > 0;

  const reconcileSettingsDraft = (incoming: SiteSettings) => {
    // Capture the old baseline outside the updater so React can replay it safely.
    const baseline = draftBaselineRef.current;
    draftBaselineRef.current = incoming;
    setTempSettings((draft) => mergeSettingsDraft(incoming, baseline, draft));
    setExpiredAiKeyNotice(isSavedAiKeyExpired(incoming.api));
  };

  const rotateEncryptionKey = async () => {
    if (
      !canManageSecrets ||
      isSubmitting ||
      hasUnsavedSettings ||
      !onRotateEncryptionKey ||
      !tempSettings.api?.aiKeyCanRotate ||
      !tempSettings.api.aiKeyRevision
    )
      return;
    if (
      !window.confirm(
        'Replace the private encryption key and re-encrypt the saved Gemini key? Your Gemini API key and its expiry will not change. Back up the private key file again after rotation.'
      )
    )
      return;
    setIsSubmitting(true);
    setIsRotatingKey(true);
    try {
      if (await onRotateEncryptionKey(tempSettings.api.aiKeyRevision)) {
        toast.success('Encryption key rotated. Saved Gemini key remains unchanged.');
      }
    } finally {
      setIsSubmitting(false);
      setIsRotatingKey(false);
    }
  };

  const loadInitialSettings = React.useEffectEvent(() => fetchSettings());
  useEffect(() => {
    loadInitialSettings();
    return () => {
      settingsReadVersionRef.current += 1;
    };
  }, []);

  const fetchSettings = async () => {
    const readVersion = settingsReadVersionRef.current;
    try {
      const res = await vonFetch(API.settings);
      const data = await res.json();
      if (readVersion !== settingsReadVersionRef.current) return;
      if (res.ok === false || data?._settingsScope !== 'admin') {
        throw new Error('A complete admin settings response is required.');
      }
      reconcileSettingsDraft(data);
    } catch (error) {
      if (readVersion === settingsReadVersionRef.current) {
        notify('Failed to fetch settings: ' + String(error));
      }
    }
  };

  // Menu Builder State
  const [newMenuItem, setNewMenuItem] = useState({ label: '', url: '' });
  const [draggedMenuItemIndex, setDraggedMenuItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (settingsSnapshotRef.current !== settings) {
      settingsSnapshotRef.current = settings;
      settingsReadVersionRef.current += 1;
    }
    // The parent may publish an optimistic value and then roll it back. Neither
    // is a saved draft baseline until the pending write has actually succeeded.
    if (!savePendingRef.current) reconcileSettingsDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!canManageSecrets && ['api', 'media', 'bridge', 'tools'].includes(activeTab)) {
      setActiveTab('general');
    }
  }, [activeTab, canManageSecrets]);

  const handleChange = (section: 'ads' | 'api' | null, key: string, value: unknown) => {
    setTempSettings((prev) => {
      if (section === 'ads' || section === 'api') {
        return { ...prev, [section]: { ...prev[section], [key]: value } };
      }
      return { ...prev, [key]: value };
    });
  };

  // Handlers for sub-components
  const handleGeneralChange: import('../../../../types').SettingsFieldChange<SiteSettings> = (
    key,
    value
  ) => handleChange(null, key, value);
  const handleAdsChange: import('../../../../types').SettingsFieldChange<SiteSettings['ads']> = (
    key,
    value
  ) => handleChange('ads', key, value);

  const handlePermalinkChange: import('../../../../types').SettingsFieldChange<
    Pick<SiteSettings, 'permalinkStructure'>
  > = (key, value) => {
    // permalinkStructure is a top-level key, not nested
    // key comes as 'permalinkStructure', value is the actual value like 'slug' or 'date'
    setTempSettings((prev) => ({ ...prev, [key]: value }));
  };
  const handleProfileChange: import('../../../../types').SettingsFieldChange<
    Pick<SiteSettings, 'adminProfile'>
  > = (key, value) => {
    // adminProfile is already an object, set it directly
    setTempSettings((prev) => ({ ...prev, [key]: value }));
  };
  const handleAiApiKeyChange = (value: string) => {
    setExpiredAiKeyNotice(false);
    handleChange('api', 'aiApiKey', value.trim());
    handleChange('api', 'replaceAiKey', true);
  };

  const save = async () => {
    if (isSubmitting || savePendingRef.current) return;
    savePendingRef.current = true;
    settingsReadVersionRef.current += 1;
    setIsSubmitting(true);
    const submittedDraft = tempSettings;
    const settingsAtSubmit = settingsSnapshotRef.current;
    let savedSuccessfully = false;
    try {
      const mergedDraft = mergeSettingsDraft(settings, draftBaselineRef.current, tempSettings);
      const rawAiModel = tempSettings.api?.aiModel?.trim() || '';
      const settingsToSave: SiteSettings = canManageSecrets
        ? {
            ...mergedDraft,
            api: {
              ...tempSettings.api,
              aiProvider: 'gemini',
              aiModel: supportedAiModels.includes(rawAiModel) ? rawAiModel : defaultAiModel,
              ...(tempSettings.api?.aiKeyStorage === 'legacy' ? { encryptStoredAiKey: true } : {}),
            },
          }
        : {
            ...mergedDraft,
            // Keep the owner-only API group equal to the latest canonical state. This lets the
            // top-level patch omit it when an appointed admin saves delegated settings.
            api: settings.api,
          };

      const saved = await onUpdate(settingsToSave);
      if (saved === false) {
        notify(
          'Failed to persist settings to server. Please ensure your configuration is correct and the server is reachable.'
        );
        return;
      }

      const canonical =
        settingsSnapshotRef.current === settingsAtSubmit
          ? settingsToSave
          : settingsSnapshotRef.current;
      draftBaselineRef.current = canonical;
      setTempSettings((draft) => mergeSettingsDraft(canonical, submittedDraft, draft));
      setExpiredAiKeyNotice(isSavedAiKeyExpired(canonical.api));
      savedSuccessfully = true;
      toast.success('Settings saved successfully!');
    } catch (err) {
      notify('Unexpected error: ' + String(err));
    } finally {
      savePendingRef.current = false;
      if (!savedSuccessfully) reconcileSettingsDraft(settingsSnapshotRef.current);
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
  const selectedAiModel = supportedAiModels.includes(tempSettings.api?.aiModel || '')
    ? tempSettings.api!.aiModel!
    : defaultAiModel;
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
    <fieldset
      disabled={isRotatingKey}
      aria-label="System settings"
      className="min-w-0 max-w-5xl mx-auto space-y-6 animate-fade-in border-0 p-0"
    >
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">System Settings</h2>

      {/* Tabs */}
      <div className="mb-6 sm:hidden">
        <label
          htmlFor="settings-section"
          className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200"
        >
          Settings section
        </label>
        <select
          id="settings-section"
          value={activeTab}
          onChange={(event) => setActiveTab(event.target.value as typeof activeTab)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-xs outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-admin-border dark:bg-admin-panel dark:text-white"
        >
          <option value="general">General</option>
          <option value="google">Google</option>
          <option value="profile">Profile</option>
          <option value="permalinks">Permalinks</option>
          <option value="categories">Categories</option>
          <option value="menu">Menu</option>
          <option value="ads">Ads</option>
          {canManageSecrets && <option value="api">API</option>}
          {canManageSecrets && <option value="media">Media</option>}
          {canManageSecrets && <option value="bridge">Bridge</option>}
          {canManageSecrets && <option value="tools">Tools</option>}
        </select>
      </div>

      {/* Tabs - Pills Design */}
      <div className="settings-tab-strip mb-6 hidden gap-2 py-1 sm:flex sm:flex-wrap sm:p-1 lg:mb-8">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'general'
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-xs ring-1 ring-blue-200 dark:ring-blue-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Settings size={18} className={activeTab === 'general' ? 'fill-current' : ''} /> General
        </button>
        <button
          onClick={() => setActiveTab('google')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'google'
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-xs ring-1 ring-blue-200 dark:ring-blue-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe size={18} /> Google
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-200 dark:ring-emerald-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User size={18} className={activeTab === 'profile' ? 'fill-current' : ''} /> Profile
        </button>
        <button
          onClick={() => setActiveTab('permalinks')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'permalinks'
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 shadow-xs ring-1 ring-amber-200 dark:ring-amber-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Link2 size={18} /> Permalinks
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-200 dark:ring-emerald-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FolderTree size={18} /> Categories
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'menu'
              ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 shadow-xs ring-1 ring-pink-200 dark:ring-pink-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LinkIcon size={18} /> Menu
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
            activeTab === 'ads'
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 shadow-xs ring-1 ring-rose-200 dark:ring-rose-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Megaphone size={18} className={activeTab === 'ads' ? 'fill-current' : ''} /> Ads
        </button>
        {canManageSecrets && (
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
              activeTab === 'api'
                ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 shadow-xs ring-1 ring-violet-200 dark:ring-violet-800'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
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
                  ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400 shadow-xs ring-1 ring-cyan-200 dark:ring-cyan-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Image size={18} /> Media
            </button>
            <button
              onClick={() => setActiveTab('bridge')}
              className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
                activeTab === 'bridge'
                  ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 shadow-xs ring-1 ring-orange-200 dark:ring-orange-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowLeftRight size={18} /> Bridge
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 ${
                activeTab === 'tools'
                  ? 'bg-slate-100 text-slate-600 dark:bg-admin-panel dark:text-slate-300 shadow-xs ring-1 ring-slate-200 dark:ring-white/10'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-admin-panel hover:text-slate-900 dark:hover:text-white'
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
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-admin-border dark:bg-admin-panel sm:p-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Existing Menu Items */}
            <div>
              <h3 className="font-bold mb-4 dark:text-white flex items-center gap-2">
                <LinkIcon size={18} className="text-primary-500" /> Active Menu Items
              </h3>
              <div className="space-y-2 min-h-[200px] border border-slate-100 dark:border-white/10 rounded-xl p-2 bg-slate-50 dark:bg-admin-canvas/50">
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
                    className={`flex justify-between items-center p-3 bg-white dark:bg-admin-panel rounded-lg shadow-xs border border-slate-200 dark:border-admin-border group cursor-move transition-all ${
                      draggedMenuItemIndex === idx ? 'opacity-50 scale-[0.99]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical size={16} />
                      <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-admin-hover px-1.5 py-0.5 rounded-sm">
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
              <div className="mt-4 p-4 bg-slate-50 dark:bg-admin-canvas/50 rounded-xl border border-slate-100 dark:border-white/10">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Add Custom Link
                </h4>
                <div className="flex flex-col items-stretch gap-3 xl:flex-row xl:items-center">
                  <label htmlFor="menu-item-label" className="sr-only">
                    Label
                  </label>
                  <input
                    id="menu-item-label"
                    type="text"
                    placeholder="Label (e.g., About)"
                    value={newMenuItem.label}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, label: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-sm outline-hidden transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-admin-border-strong dark:bg-admin-panel dark:text-white"
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
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-sm outline-hidden transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-admin-border-strong dark:bg-admin-panel dark:text-white"
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
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-admin-panel py-2 z-10">
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
                          className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-admin-hover rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
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
                              className="w-4 h-4 text-primary-600 rounded-sm border-slate-300 focus:ring-primary-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                              {decodeEntities(page.title)}
                            </span>
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
                <div className="pt-4 border-t border-slate-100 dark:border-admin-border">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-admin-panel py-2 z-10">
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
                          className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-admin-hover rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
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
                              className="w-4 h-4 text-primary-600 rounded-sm border-slate-300 focus:ring-primary-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                              {decodeEntities(post.title)}
                            </span>
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
          <div className="bg-white dark:bg-admin-panel rounded-xl shadow-xs border border-slate-200 dark:border-admin-border p-6 space-y-4">
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
          <div className="bg-white dark:bg-admin-panel rounded-xl shadow-xs border border-slate-200 dark:border-admin-border p-6 space-y-6">
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
                    className="w-full p-2.5 border rounded-lg dark:bg-admin-canvas dark:text-white dark:border-admin-border"
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
                    className="w-full p-2.5 border rounded-lg dark:bg-admin-canvas dark:text-white dark:border-admin-border"
                    placeholder="Gemini API key"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter your Google Gemini API Key from AI Studio. Saved keys are masked; clear
                    this field to remove the saved key, or replace it to start a new local expiry
                    period.
                  </p>
                  {tempSettings.api?.aiKeyStorage === 'encrypted' && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <p
                        role="status"
                        className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200"
                      >
                        <ShieldCheck size={16} aria-hidden="true" /> Saved key encrypted
                      </p>
                      <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                        The private encryption key stays on the server. No file deletion or API key
                        re-entry is needed to rotate it.
                      </p>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        Last rotated:{' '}
                        {tempSettings.api.aiKeyRotatedAt
                          ? formatDateTime(
                              tempSettings.api.aiKeyRotatedAt,
                              tempSettings.timeZone,
                              tempSettings.dateFormat
                            )
                          : 'Not rotated yet'}
                      </p>
                      <button
                        type="button"
                        onClick={rotateEncryptionKey}
                        disabled={
                          isSubmitting ||
                          hasUnsavedSettings ||
                          !tempSettings.api.aiKeyCanRotate ||
                          !onRotateEncryptionKey
                        }
                        className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                      >
                        <RotateCw size={14} aria-hidden="true" /> Rotate Encryption Key
                      </button>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        {hasUnsavedSettings
                          ? 'Save or discard your unsaved settings before rotating.'
                          : !tempSettings.api.aiKeyCanRotate
                            ? 'Rotation is unavailable for this private-file location. Check server permissions or restore the matching key backup.'
                            : 'Primary Admin only. Rotation does not change the Gemini API key or its expiry. Back up the private key file separately after rotation.'}
                      </p>
                    </div>
                  )}
                  {tempSettings.api?.aiKeyStorage === 'legacy' && (
                    <p role="status" className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      Existing key uses legacy storage. Save Settings once to encrypt it without
                      changing its existing expiry.
                    </p>
                  )}
                  {tempSettings.api?.aiKeyStorage === 'unavailable' && (
                    <p role="alert" className="text-xs text-red-700 dark:text-red-300 mt-2">
                      Saved key cannot be decrypted. Restore the matching private encryption key
                      backup. Unchanged saves keep the stored credential; it is not erased.
                    </p>
                  )}
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
                      className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
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
                    className="w-full p-2.5 border rounded-lg dark:bg-admin-canvas dark:text-white dark:border-admin-border"
                  >
                    {legacyAiModels.includes(selectedAiModel) && (
                      <option value={selectedAiModel} disabled>
                        {selectedAiModel} (Saved legacy model)
                      </option>
                    )}
                    {currentAiModels.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    Older models are no longer offered for new selections. An existing saved model
                    remains unchanged until you select another. Availability and pricing depend on
                    your Google account.
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    AI writing and editing opt out of optional Gemini request storage. Google's
                    applicable service and safety-retention terms still apply.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="admin-safe-bottom sticky bottom-0 z-10 -mx-3 flex justify-end gap-2 border-t border-slate-200/30 bg-white/90 px-3 pt-3 shadow-2xl backdrop-blur-xl dark:border-admin-border/30 dark:bg-admin-canvas/90 sm:-mx-4 sm:gap-3 sm:px-4 sm:pt-4">
        <button
          onClick={() => {
            settingsReadVersionRef.current += 1;
            setTempSettings(draftBaselineRef.current);
          }}
          disabled={isSubmitting}
          className="min-h-11 flex-1 rounded-lg border border-slate-200/50 px-4 py-2.5 font-medium text-slate-600 backdrop-blur-xs transition-all hover:bg-white/60 dark:border-admin-border/50 dark:text-slate-400 dark:hover:bg-admin-panel/60 sm:flex-none sm:px-5"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={isSubmitting}
          className={`flex min-h-11 flex-[1.4] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/40 sm:flex-none sm:px-8 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          <Save size={18} className={isSubmitting ? 'animate-spin' : ''} />
          {isRotatingKey ? 'Rotating...' : isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </fieldset>
  );
};

export default SettingsView;
