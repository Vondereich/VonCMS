import React, { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { Trash2, Save, Plus, Type, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface DefaultThemeSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => void;
  onClose: () => void;
}

export const DefaultThemeSettings: React.FC<DefaultThemeSettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  // Initialize temporary state with current settings or defaults
  // Ensure we have the deep structure for independent footer links
  const [tempSettings, setTempSettings] = useState<SiteSettings>({
    ...settings,
    theme: {
      ...settings.theme,
      default: settings.theme.default || {
        footerLinks: [],
        showTrending: true,
        enableMarquee: true,
      },
    },
  });

  const handleChange = (key: string, value: any) => {
    setTempSettings((prev) => ({ ...prev, theme: { ...prev.theme, [key]: value } }));
  };

  // Helper for footer links to keep code clean
  const footerLinks = tempSettings.theme.default?.footerLinks || [];

  const updateFooterLinks = (newLinks: { label: string; url: string }[]) => {
    setTempSettings((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        default: {
          ...prev.theme.default,
          footerLinks: newLinks,
        },
      },
    }));
  };

  const handleSave = () => {
    onUpdate(tempSettings);
    toast.success('Theme settings saved!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1a1b26] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center sticky top-0 bg-white dark:bg-[#1a1b26] z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Type size={24} className="text-primary-600" />
              Default Theme Settings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Customize appearance and layout.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#242633] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto flex-1">
          {/* Brand Colors */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Brand Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Accent Color - for buttons, links, badges */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Accent Color
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Buttons, links, category badges
                </p>
                <div className="flex items-center gap-3">
                  <input
                    aria-label="Accent Color"
                    id="defaultthemesettings-152"
                    name="defaultthemesettings152"
                    type="color"
                    value={tempSettings.theme.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="h-10 w-14 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-400 uppercase">
                    {tempSettings.theme.primaryColor}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleChange('primaryColor', '#0ea5ff')}
                    className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Reset
                  </button>
                </div>
              </div>
              {/* Nav Color - for header & footer */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Header & Footer
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Navigation background color
                </p>
                <div className="flex items-center gap-3">
                  <input
                    id="defaultthemesettings-179"
                    name="defaultthemesettings179"
                    aria-label="Header & Footer"
                    type="color"
                    value={tempSettings.theme?.default?.navColor || '#0f172a'}
                    onChange={(e) =>
                      setTempSettings((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          default: { ...prev.theme.default, navColor: e.target.value },
                        },
                      }))
                    }
                    className="h-10 w-14 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-400 uppercase">
                    {tempSettings.theme?.default?.navColor || '#0f172a'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTempSettings((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          default: { ...prev.theme.default, navColor: '#0f172a' },
                        },
                      }))
                    }
                    className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Font Family
                </span>
                <select
                  aria-label="Font Family"
                  id="defaultthemesettings-217"
                  name="defaultthemesettings217"
                  value={tempSettings.theme.fontFamily}
                  onChange={(e) => handleChange('fontFamily', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg bg-white dark:bg-[#1a1b26] text-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="Inter, sans-serif">Inter (Bundled)</option>
                  <option value="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
                    System Sans
                  </option>
                  <option value="Georgia, 'Times New Roman', serif">System Serif</option>
                </select>
              </div>
            </div>
          </section>

          {/* UI Preferences */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Design System
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Border Radius
                </span>
                <select
                  id="defaultthemesettings-241"
                  name="defaultthemesettings241"
                  aria-label="Border Radius"
                  value={tempSettings.theme.borderRadius}
                  onChange={(e) => handleChange('borderRadius', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg bg-white dark:bg-[#1a1b26] text-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="0px">Square (Sharp)</option>
                  <option value="0.25rem">Small (Subtle)</option>
                  <option value="0.5rem">Medium (Standard)</option>
                  <option value="0.75rem">Large (Playful)</option>
                  <option value="1rem">Extra Large (Rounded)</option>
                </select>
              </div>
            </div>
          </section>
          {/* Feature Toggles */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-4 border border-slate-200 dark:border-[#2a2b36] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26] transition-colors">
                <div>
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                    Trending Ticker
                  </span>
                  <span className="block text-[10px] text-slate-500">Show top bar on homepage</span>
                </div>
                <input
                  id="defaultthemesettings-268"
                  name="defaultthemesettings268"
                  type="checkbox"
                  checked={tempSettings.theme.default?.showTrending !== false}
                  onChange={(e) =>
                    setTempSettings((prev: any) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        default: { ...prev.theme.default, showTrending: e.target.checked },
                      },
                    }))
                  }
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>
              <label className="flex items-center justify-between p-4 border border-slate-200 dark:border-[#2a2b36] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26] transition-colors">
                <div>
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                    Marquee Animation
                  </span>
                  <span className="block text-[10px] text-slate-500">Enable smooth scrolling</span>
                </div>
                <input
                  id="defaultthemesettings-290"
                  name="defaultthemesettings290"
                  type="checkbox"
                  checked={tempSettings.theme.default?.enableMarquee !== false}
                  onChange={(e) =>
                    setTempSettings((prev: any) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        default: { ...prev.theme.default, enableMarquee: e.target.checked },
                      },
                    }))
                  }
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>
            </div>
          </section>

          {/* Footer Settings Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Footer Customization
            </h3>

            <div className="bg-slate-50 dark:bg-[#16161e] rounded-lg p-5 border border-slate-100 dark:border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Footer Links
                </span>
                <button
                  onClick={() =>
                    updateFooterLinks([...footerLinks, { label: 'New Link', url: '#' }])
                  }
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus size={14} /> Add Link
                </button>
              </div>
              <div className="space-y-2">
                {footerLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      aria-label="Footer link label"
                      id="defaultthemesettings-458"
                      name="defaultthemesettings458"
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        const links = [...footerLinks];
                        links[idx] = { ...links[idx], label: e.target.value };
                        updateFooterLinks(links);
                      }}
                      placeholder="Label"
                      className="flex-1 p-2 rounded border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                    />
                    <input
                      id="defaultthemesettings-469"
                      name="defaultthemesettings469"
                      aria-label="Footer link URL"
                      type="text"
                      value={link.url}
                      onChange={(e) => {
                        const links = [...footerLinks];
                        links[idx] = { ...links[idx], url: e.target.value };
                        updateFooterLinks(links);
                      }}
                      placeholder="URL (e.g. / or https://...)"
                      className="flex-1 p-2 rounded border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                    />
                    <button
                      onClick={() => updateFooterLinks(footerLinks.filter((_, i) => i !== idx))}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {footerLinks.length === 0 && (
                  <p className="text-sm text-slate-500 italic text-center py-2">
                    No links added. Default "Home" & "About" will be shown.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-[#2a2b36] flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-[#1a1b26] z-10 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
