import React, { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface TechPressSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => void;
  onClose: () => void;
}

export const TechPressSettings: React.FC<TechPressSettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const initialConfig = settings.theme.techpress || {
    primaryColor: '#0066cc',
    enableBreaking: true,
    enableDarkMode: true,
    breakingNewsCount: 3,
    footerLinks: [],
  };

  const [tempConfig, setTempConfig] = useState(initialConfig);
  const [tempFooterLinks, setTempFooterLinks] = useState(initialConfig.footerLinks || []);

  const handleSave = () => {
    onUpdate({
      ...settings,
      theme: {
        ...settings.theme,
        techpress: {
          ...tempConfig,
          footerLinks: tempFooterLinks,
        },
      },
    });
    toast.success('TechPress settings saved!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-[#16161e] w-full max-w-2xl shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-[#16161e]">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">TechPress Settings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Customize your technology news theme
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-6">
            {/* Primary Color */}
            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Primary Color
              </span>
              <div className="flex gap-3">
                <input
                  aria-label="Primary Color"
                  id="techpresssettings-118"
                  name="techpresssettings118"
                  type="color"
                  value={tempConfig.primaryColor}
                  onChange={(e) => setTempConfig({ ...tempConfig, primaryColor: e.target.value })}
                  className="h-10 w-20 rounded cursor-pointer border-0"
                />
                <input
                  id="techpresssettings-124"
                  name="techpresssettings124"
                  aria-label="Primary Color"
                  type="text"
                  value={tempConfig.primaryColor}
                  onChange={(e) => setTempConfig({ ...tempConfig, primaryColor: e.target.value })}
                  className="flex-1 px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-[#2a2b36] rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26]">
                <input
                  id="techpresssettings-136"
                  name="techpresssettings136"
                  type="checkbox"
                  checked={tempConfig.enableBreaking}
                  onChange={(e) =>
                    setTempConfig({ ...tempConfig, enableBreaking: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Enable Latest Ticker
                </span>
              </label>
              <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-[#2a2b36] rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26]">
                <input
                  id="techpresssettings-149"
                  name="techpresssettings149"
                  type="checkbox"
                  checked={tempConfig.enableMarquee ?? true}
                  onChange={(e) =>
                    setTempConfig({ ...tempConfig, enableMarquee: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Enable Marquee Animation
                  </span>
                  <span className="text-[10px] text-slate-500">Smooth scrolling effect</span>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-[#2a2b36] rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26]">
                <input
                  id="techpresssettings-165"
                  name="techpresssettings165"
                  type="checkbox"
                  checked={tempConfig.enableDarkMode}
                  onChange={(e) =>
                    setTempConfig({ ...tempConfig, enableDarkMode: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Show Dark Mode Toggle
                </span>
              </label>
            </div>

            {/* Latest Ticker Count */}
            {tempConfig.enableBreaking && (
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Latest Ticker Items Count
                </span>
                <div className="flex items-center gap-4">
                  <input
                    aria-label="Latest Ticker Items Count"
                    id="techpresssettings-186"
                    name="techpresssettings186"
                    type="range"
                    min="1"
                    max="10"
                    value={tempConfig.breakingNewsCount || 3}
                    onChange={(e) =>
                      setTempConfig({
                        ...tempConfig,
                        breakingNewsCount: parseInt(e.target.value),
                      })
                    }
                    className="flex-1 h-2 bg-slate-200 dark:bg-[#242633] rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <input
                    id="techpresssettings-199"
                    name="techpresssettings199"
                    aria-label="Latest ticker count"
                    type="number"
                    min="1"
                    max="10"
                    value={tempConfig.breakingNewsCount || 3}
                    onChange={(e) =>
                      setTempConfig({
                        ...tempConfig,
                        breakingNewsCount: parseInt(e.target.value) || 3,
                      })
                    }
                    className="w-20 px-3 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white text-center font-bold"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Number of latest published articles to show in the latest ticker (1-10)
                </p>
              </div>
            )}

            {/* Footer Links (Global) */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">Footer Links</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500 uppercase">Link List</span>
                  <button
                    onClick={() => {
                      setTempFooterLinks([...tempFooterLinks, { label: 'New Link', url: '#' }]);
                    }}
                    className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Link
                  </button>
                </div>

                {tempFooterLinks.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">
                    No links added. Default "Home" link will be used.
                  </p>
                ) : (
                  tempFooterLinks.map((link, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        aria-label="Footer link label"
                        id={`techpresssettings-footer-link-label-${idx}`}
                        name={`techpresssettingsFooterLinkLabel${idx}`}
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const newLinks = [...tempFooterLinks];
                          newLinks[idx] = { ...newLinks[idx], label: e.target.value };
                          setTempFooterLinks(newLinks);
                        }}
                        className="flex-1 px-3 py-2 border border-slate-200 dark:border-[#2a2b36] rounded text-sm dark:bg-[#1a1b26] dark:text-white"
                        placeholder="Label"
                      />
                      <input
                        id={`techpresssettings-footer-link-url-${idx}`}
                        name={`techpresssettingsFooterLinkUrl${idx}`}
                        aria-label="Footer link URL"
                        type="text"
                        value={link.url}
                        onChange={(e) => {
                          const newLinks = [...tempFooterLinks];
                          newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                          setTempFooterLinks(newLinks);
                        }}
                        className="flex-1 px-3 py-2 border border-slate-200 dark:border-[#2a2b36] rounded text-sm dark:bg-[#1a1b26] dark:text-white"
                        placeholder="URL"
                      />
                      <button
                        onClick={() => {
                          const newLinks = tempFooterLinks.filter((_, i) => i !== idx);
                          setTempFooterLinks(newLinks);
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
              <h4 className="font-bold text-sm text-blue-900 dark:text-blue-100">
                Global Sidebar Blocks
              </h4>
              <p className="text-xs text-blue-800/80 dark:text-blue-200/80 mt-1">
                Shared sidebar content now lives under Admin &gt; Widgets. TechPress settings keep
                theme-specific colors, ticker, and footer controls only.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3 bg-slate-50 dark:bg-[#16161e]">
          <button
            onClick={onClose}
            className="px-5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 flex items-center gap-2"
          >
            <Save size={18} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
