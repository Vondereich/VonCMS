import React, { useState } from 'react';
import {
  Package,
  Palette,
  Check,
  X,
  Download,
  Trash2,
  Power,
  Search,
  Settings,
} from 'lucide-react';
import SmartPagination from '../../../../components/SmartPagination';
import toast from 'react-hot-toast';
import { SeoConfig, SiteSettings } from '../../../../types';
import { useTheme } from '../../providers/VonProviders';
import { DefaultThemeSettings } from './components/DefaultThemeSettings';
import { PrismSettings } from './components/PrismSettings';
import { TechPressSettings } from './components/TechPressSettings';
import { PortfolioSettings } from './components/PortfolioSettings';
import { DigestSettings } from './components/DigestSettings';
import { CorporateProSettings } from '../settings/components/themes/CorporateProSettings';
import { VonSEOSettings } from './components/VonSEOSettings';
import { VonAnalyticsSettings } from './components/VonAnalyticsSettings';

import { AISummarySettings } from '../plugins/built-in/ai-summary/SettingsModal';
import { RelatedPostsSettings } from '../plugins/built-in/related-posts/SettingsModal';

// Colorful gradient palette for extension cards
const CARD_GRADIENTS = [
  { from: '#8B5CF6', to: '#EC4899', accent: '#A855F7' }, // Purple → Pink
  { from: '#14B8A6', to: '#06B6D4', accent: '#2DD4BF' }, // Teal → Cyan
  { from: '#F97316', to: '#FBBF24', accent: '#FB923C' }, // Orange → Amber
  { from: '#3B82F6', to: '#8B5CF6', accent: '#6366F1' }, // Blue → Purple
  { from: '#10B981', to: '#34D399', accent: '#22C55E' }, // Emerald → Green
  { from: '#F43F5E', to: '#FB7185', accent: '#E11D48' }, // Rose → Pink
  { from: '#6366F1', to: '#A78BFA', accent: '#818CF8' }, // Indigo → Violet
  { from: '#EF4444', to: '#F97316', accent: '#F87171' }, // Red → Orange
];

// Hash-based color assignment for consistent colors per item
const getGradientByHash = (id: string) => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
};

interface ExtensionItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  type: 'plugin' | 'theme';
  status: 'active' | 'inactive' | 'not_installed';
  image?: string;
}

interface ExtensionsManagerProps {
  settings: SiteSettings;
  onUpdateSettings: (
    newSettings: SiteSettings,
    options?: { optimistic?: boolean }
  ) => boolean | Promise<boolean>;
}

import { AVAILABLE_PLUGINS } from '../plugins/registry';

// Convert Registry Plugins to ExtensionItems
const SYSTEM_PLUGINS: ExtensionItem[] = AVAILABLE_PLUGINS.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  version: p.version,
  author: p.author,
  type: 'plugin',
  status: 'inactive', // Default to inactive, will be overridden by settings
}));

const ExtensionsManager: React.FC<ExtensionsManagerProps> = ({ settings, onUpdateSettings }) => {
  const { activeTheme, setTheme, availableThemes } = useTheme();
  const [activeTab, setActiveTab] = useState<'plugins' | 'themes'>('themes');
  const [pluginItems, setPluginItems] = useState<ExtensionItem[]>(SYSTEM_PLUGINS);
  const [searchQuery, setSearchQuery] = useState('');
  const [configuringPluginId, setConfiguringPluginId] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<Record<string, any>>({});

  // Load plugin status from settings on mount
  React.useEffect(() => {
    const activePluginIds = Array.isArray(settings.activePlugins) ? settings.activePlugins : [];
    setPluginItems((prev) =>
      prev.map((plugin) => {
        const savedPluginStatus = settings.pluginConfig?.['pluginStatus']?.[plugin.id];
        return {
          ...plugin,
          status:
            savedPluginStatus || (activePluginIds.includes(plugin.id) ? 'active' : plugin.status),
        };
      })
    );
  }, [settings.activePlugins, settings.pluginConfig]);

  // Reset page when switching tabs
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Map themes to ExtensionItems
  const themeItems: ExtensionItem[] = availableThemes.map((theme) => ({
    id: theme.id,
    name: theme.name,
    description: theme.description,
    version: theme.version,
    author: theme.author,
    type: 'theme',
    status: theme.id === activeTheme.id ? 'active' : 'inactive',
    image: `https://placehold.co/600x400/${theme.extendedConfig.colors.primary.replace('#', '')}/ffffff?text=${encodeURIComponent(theme.name)}`,
  }));

  const allItems = activeTab === 'themes' ? themeItems : pluginItems;

  const persistSettings = async (nextSettings: SiteSettings): Promise<boolean> => {
    try {
      return (await onUpdateSettings(nextSettings, { optimistic: false })) !== false;
    } catch {
      return false;
    }
  };

  const handleActivateTheme = async (themeId: string) => {
    const saved = await persistSettings({
      ...settings,
      activeThemeId: themeId,
    });
    if (!saved) return;

    setTheme(themeId);
    toast.success('Theme activated successfully!');
  };

  const handleToggleStatus = async (id: string) => {
    const item = allItems.find((i) => i.id === id);
    if (!item) return;

    if (item.type === 'theme') {
      if (item.status !== 'active') {
        handleActivateTheme(id);
      }
    } else {
      // Plugin logic - update state and save to settings
      const newStatus = item.status === 'active' ? 'inactive' : 'active';

      // Save plugin status to settings AND update activePlugins array
      const currentPluginStatus = settings.pluginConfig?.['pluginStatus'] || {};

      // Update activePlugins array
      let newActivePlugins = [
        ...(Array.isArray(settings.activePlugins) ? settings.activePlugins : []),
      ];
      if (newStatus === 'active') {
        if (!newActivePlugins.includes(id)) newActivePlugins.push(id);
      } else {
        newActivePlugins = newActivePlugins.filter((pId) => pId !== id);
      }

      const saved = await persistSettings({
        ...settings,
        activePlugins: newActivePlugins,
        pluginConfig: {
          ...settings.pluginConfig,
          pluginStatus: {
            ...currentPluginStatus,
            [id]: newStatus,
          },
        },
      });
      if (!saved) return;

      setPluginItems((prev) =>
        prev.map((i) => {
          if (i.id === id) {
            return { ...i, status: newStatus };
          }
          return i;
        })
      );

      toast.success(`Plugin ${newStatus === 'active' ? 'activated' : 'deactivated'}!`);
    }
  };

  const handleInstall = async (id: string) => {
    const confirm = window.confirm('Install this extension?');
    if (confirm) {
      const currentPluginStatus = settings.pluginConfig?.['pluginStatus'] || {};
      const newPluginStatus = { ...currentPluginStatus };
      newPluginStatus[id] = 'inactive';

      const saved = await persistSettings({
        ...settings,
        pluginConfig: {
          ...settings.pluginConfig,
          pluginStatus: newPluginStatus,
        },
      });
      if (!saved) return;

      setPluginItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'inactive' } : item))
      );
      toast.success('Plugin installed!');
    }
  };

  const handleUninstall = async (id: string) => {
    const confirm = window.confirm('Are you sure you want to uninstall this? Data may be lost.');
    if (confirm) {
      const currentPluginStatus = settings.pluginConfig?.['pluginStatus'] || {};
      const newPluginStatus = { ...currentPluginStatus };
      let newActivePlugins = [
        ...(Array.isArray(settings.activePlugins) ? settings.activePlugins : []),
      ];
      newActivePlugins = newActivePlugins.filter((pId) => pId !== id);
      newPluginStatus[id] = 'not_installed';

      const saved = await persistSettings({
        ...settings,
        activePlugins: newActivePlugins,
        pluginConfig: {
          ...settings.pluginConfig,
          pluginStatus: newPluginStatus,
        },
      });
      if (!saved) return;

      setPluginItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'not_installed' } : item))
      );
      toast.success('Plugin uninstalled!');
    }
  };

  const handleOpenSettings = (id: string) => {
    // All themes have custom modals
    if (
      id === 'theme-default' ||
      id === 'theme-prism' ||
      id === 'theme-techpress' ||
      id === 'theme-portfolio' ||
      id === 'theme-digest' ||
      id === 'theme-corporate-pro'
    ) {
      setConfiguringPluginId(id);
      return;
    }

    if (id === 'vp_von_seo') {
      const seoConfig = settings.seo || {
        siteTitle: settings.siteName,
        sitemapEnabled: true,
      };
      setTempConfig({ ...seoConfig });
    } else if (id === 'vp_promo_bar') {
      const currentConfig = settings.pluginConfig?.[id] || {};
      setTempConfig({
        text:
          currentConfig.text ||
          '🚀 SPECIAL OFFER: Upgrade your experience today - Limited Time Offer!',
        linkUrl: currentConfig.linkUrl || '#',
        linkText: currentConfig.linkText || 'Click Here',
        backgroundColor: currentConfig.backgroundColor || '#db2777',
        dismissHours: currentConfig.dismissHours || 24,
        startsAt: currentConfig.startsAt || '',
        endsAt: currentConfig.endsAt || '',
        targetBlank: currentConfig.targetBlank ?? true,
      });
    } else if (id === 'vp_gift_widget') {
      const currentConfig = settings.pluginConfig?.[id] || {};
      setTempConfig({
        targetUrl: currentConfig.targetUrl || '#',
        tooltipText: currentConfig.tooltipText || 'Claim Gift',
        iconLabel: currentConfig.iconLabel || '',
        buttonColor: currentConfig.buttonColor || '#ef4444',
        position: currentConfig.position || 'bottom-left',
        targetBlank: currentConfig.targetBlank ?? true,
      });
    } else {
      const currentConfig = settings.pluginConfig?.[id] || {};
      setTempConfig(currentConfig);
    }
    setConfiguringPluginId(id);
  };

  const handleSaveSettings = async () => {
    if (!configuringPluginId) return;

    if (configuringPluginId === 'vp_von_seo') {
      const saved = await persistSettings({
        ...settings,
        seo: tempConfig as SeoConfig,
      });
      if (!saved) return;
    } else {
      const saved = await persistSettings({
        ...settings,
        pluginConfig: {
          ...settings.pluginConfig,
          [configuringPluginId]: tempConfig,
        },
      });
      if (!saved) return;
    }

    toast.success('Settings saved successfully!');
    setConfiguringPluginId(null);
  };

  const filteredItems = allItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Default Theme Settings Modal */}
      {configuringPluginId === 'theme-default' && (
        <DefaultThemeSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* Prism Settings Modal */}
      {configuringPluginId === 'theme-prism' && (
        <PrismSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* TechPress Settings Modal */}
      {configuringPluginId === 'theme-techpress' && (
        <TechPressSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* Portfolio Settings Modal */}
      {configuringPluginId === 'theme-portfolio' && (
        <PortfolioSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* Digest Settings Modal */}
      {configuringPluginId === 'theme-digest' && (
        <DigestSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* Corporate Pro Settings Modal */}
      {configuringPluginId === 'theme-corporate-pro' && (
        <CorporateProSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* VonSEO Settings Modal */}
      {configuringPluginId === 'vp_von_seo' && (
        <VonSEOSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* VonAnalytics Settings Modal */}
      {configuringPluginId === 'vp_analytics' && (
        <VonAnalyticsSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* AI Summary Settings Modal */}
      {configuringPluginId === 'vp_ai_summary' && (
        <AISummarySettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* Related Posts Settings Modal */}
      {configuringPluginId === 'vp_related_posts' && (
        <RelatedPostsSettings
          settings={settings}
          onUpdate={persistSettings}
          onClose={() => setConfiguringPluginId(null)}
        />
      )}

      {/* Generic Settings Modal */}
      {configuringPluginId &&
        configuringPluginId !== 'theme-default' &&
        configuringPluginId !== 'theme-prism' &&
        configuringPluginId !== 'theme-techpress' &&
        configuringPluginId !== 'theme-portfolio' &&
        configuringPluginId !== 'theme-digest' &&
        configuringPluginId !== 'theme-corporate-pro' &&
        configuringPluginId !== 'vp_von_seo' &&
        configuringPluginId !== 'vp_analytics' &&
        configuringPluginId !== 'vp_ai_summary' &&
        configuringPluginId !== 'vp_related_posts' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-[#2a2b36]">
              <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                  Configure {allItems.find((i) => i.id === configuringPluginId)?.name}
                </h3>
                <button
                  onClick={() => setConfiguringPluginId(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {Object.keys(tempConfig).length > 0 ? (
                  Object.entries(tempConfig).map(([key, value]) => {
                    const isColorField = key.toLowerCase().includes('color');
                    const fieldValue = String(value ?? '');
                    const pickerValue = /^#[0-9a-f]{6}$/i.test(fieldValue) ? fieldValue : '#db2777';

                    return (
                      <div key={key} className="space-y-2">
                        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        {isColorField ? (
                          <div className="flex items-center gap-3">
                            <input
                              aria-label={`${key} picker`}
                              id="extensionsmanager-407"
                              name="extensionsmanager407"
                              type="color"
                              value={pickerValue}
                              onChange={(e) =>
                                setTempConfig({ ...tempConfig, [key]: e.target.value })
                              }
                              className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-1 dark:border-[#2a2b36]"
                            />
                            <input
                              aria-label={`${key} color value`}
                              id="extensionsmanager-416"
                              name="extensionsmanager416"
                              type="text"
                              value={fieldValue}
                              onChange={(e) =>
                                setTempConfig({ ...tempConfig, [key]: e.target.value })
                              }
                              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 font-mono uppercase text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#2a2b36] dark:bg-[#16161e] dark:text-white"
                            />
                            <div
                              className="h-11 w-20 shrink-0 rounded-lg border border-slate-200 shadow-inner dark:border-[#2a2b36]"
                              style={{ backgroundColor: pickerValue }}
                              aria-label={`${key} preview`}
                            />
                          </div>
                        ) : (
                          <input
                            aria-label={`${key} value`}
                            id="extensionsmanager-431"
                            name="extensionsmanager431"
                            type="text"
                            value={fieldValue}
                            onChange={(e) =>
                              setTempConfig({ ...tempConfig, [key]: e.target.value })
                            }
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Settings size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No configuration options available for this plugin.</p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50 flex justify-end gap-3">
                <button
                  onClick={() => setConfiguringPluginId(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Extensions Manager</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Manage your site's look and functionality.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            id="extensionsmanager-480"
            name="extensionsmanager480"
            aria-label={`Search ${activeTab}`}
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-200 dark:bg-[#1a1b26] rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('themes')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'themes' ? 'bg-white dark:bg-[#242633] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <Palette size={18} /> Themes
        </button>
        <button
          onClick={() => setActiveTab('plugins')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'plugins' ? 'bg-white dark:bg-[#242633] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <Package size={18} /> Plugins
        </button>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedItems.map((item) => (
          <div
            key={item.id}
            className="group bg-white dark:bg-[#1a1b26] rounded-xl border border-slate-200 dark:border-[#2a2b36] overflow-hidden hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 flex flex-col h-full"
          >
            {/* Card Image (Themes only) or Icon Header (Plugins) */}
            {item.type === 'theme'
              ? (() => {
                  const gradient = getGradientByHash(item.id);
                  return (
                    <div
                      className="h-48 relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
                      }}
                    >
                      {/* Decorative circles */}
                      <div
                        className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20"
                        style={{ background: gradient.accent }}
                      />
                      <div
                        className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full opacity-15"
                        style={{ background: '#ffffff' }}
                      />
                      {/* Theme name overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-2xl font-bold tracking-wide drop-shadow-lg px-4 text-center">
                          {item.name}
                        </span>
                      </div>
                      {item.status === 'active' && (
                        <div className="absolute top-3 right-3 bg-white/90 text-green-600 text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1 backdrop-blur-sm">
                          <Check size={12} /> Active
                        </div>
                      )}
                    </div>
                  );
                })()
              : (() => {
                  const gradient = getGradientByHash(item.id);
                  return (
                    <div
                      className="h-24 border-b border-slate-100 dark:border-[#2a2b36] flex items-center justify-center relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${gradient.from}15 0%, ${gradient.to}15 100%)`,
                      }}
                    >
                      {/* Subtle decorative element */}
                      <div
                        className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-20"
                        style={{
                          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
                        }}
                      />
                      <div
                        className="w-12 h-12 rounded-xl shadow-sm flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
                          color: 'white',
                        }}
                      >
                        <Package size={24} />
                      </div>
                      {item.status === 'active' && (
                        <div
                          className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"
                          style={{
                            background: `${gradient.accent}15`,
                            color: gradient.accent,
                            border: `1px solid ${gradient.accent}30`,
                          }}
                        >
                          <Check size={10} /> Active
                        </div>
                      )}
                    </div>
                  );
                })()}

            {/* Content */}
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">
                  {item.name}
                </h3>
                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-[#242633] px-2 py-1 rounded">
                  v{item.version}
                </span>
              </div>

              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 flex-1 leading-relaxed">
                {item.description}
              </p>

              <div className="text-xs text-slate-400 mb-6 flex items-center gap-1">
                <span>By</span>{' '}
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {item.author}
                </span>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-[#2a2b36] flex items-center justify-between gap-3">
                {item.status === 'not_installed' ? (
                  <button
                    onClick={() => handleInstall(item.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#101018] dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    <Download size={16} /> Install
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleToggleStatus(item.id)}
                      disabled={item.status === 'active' && item.type === 'theme'}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors ${
                        item.status === 'active'
                          ? 'bg-green-50 text-green-600 cursor-default dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-[#242633] dark:text-slate-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400'
                      }`}
                    >
                      {item.status === 'active' ? (
                        <>
                          <Check size={16} /> Active
                        </>
                      ) : (
                        <>
                          <Power size={16} /> Activate
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleUninstall(item.id)}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Uninstall"
                    >
                      <Trash2 size={18} />
                    </button>

                    <button
                      onClick={() => handleOpenSettings(item.id)}
                      className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Settings"
                    >
                      <Settings size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Smart Pagination Controls */}
      <SmartPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        totalItems={filteredItems.length}
      />
    </div>
  );
};

export default ExtensionsManager;
