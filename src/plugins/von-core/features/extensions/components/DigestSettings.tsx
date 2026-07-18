import React, { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { Palette, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface DigestSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => boolean | Promise<boolean>;
  onClose: () => void;
}

export const DigestSettings: React.FC<DigestSettingsProps> = ({ settings, onUpdate, onClose }) => {
  const [tempSettings, setTempSettings] = useState({
    accentColor: settings.theme?.digest?.accentColor || '#00D1D1',
    showHero: settings.theme?.digest?.showHero !== false,
    gridColumns: settings.theme?.digest?.gridColumns || 4,
    showSidebar: settings.theme?.digest?.showSidebar !== false,
    showTrending: settings.theme?.digest?.showTrending !== false,
    enableMarquee: settings.theme?.digest?.enableMarquee !== false,
  });

  const handleSave = async () => {
    const saved = await onUpdate({
      ...settings,
      theme: {
        ...settings.theme,
        digest: tempSettings,
      },
    });
    if (saved === false) return;

    toast.success('Digest settings saved!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1a1b26] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center sticky top-0 bg-white dark:bg-[#1a1b26] z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palette size={24} className="text-cyan-500" />
              Digest Theme Settings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Modern magazine configuration
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#242633] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* === LAYOUT SETTINGS === */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Layout
            </h3>

            {/* Accent Color */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Accent Color
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Badges & buttons</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Accent Color"
                  id="digestsettings-108"
                  name="digestsettings108"
                  type="color"
                  value={tempSettings.accentColor}
                  onChange={(e) =>
                    setTempSettings((prev) => ({ ...prev, accentColor: e.target.value }))
                  }
                  className="h-8 w-12 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs font-mono text-slate-500 uppercase">
                  {tempSettings.accentColor}
                </span>
              </div>
            </div>

            {/* Toggles */}
            {[
              { key: 'showHero', label: 'Show Hero', desc: 'Featured article banner' },
              { key: 'showSidebar', label: 'Show Sidebar', desc: 'Widgets on single post' },
              { key: 'showTrending', label: 'Show Trending', desc: 'Top scrolling news bar' },
              {
                key: 'enableMarquee',
                label: 'Marquee Animation',
                desc: 'Enable smooth scrolling',
              },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
                <button
                  onClick={() =>
                    setTempSettings((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    tempSettings[key as keyof typeof tempSettings]
                      ? 'bg-cyan-500'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      tempSettings[key as keyof typeof tempSettings] ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            ))}

            {/* Grid Columns */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Grid Columns
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Posts per row</p>
              </div>
              <select
                id="digestsettings-168"
                name="digestsettings168"
                aria-label="Grid Columns"
                value={tempSettings.gridColumns}
                onChange={(e) =>
                  setTempSettings((prev) => ({
                    ...prev,
                    gridColumns: Number(e.target.value) as 2 | 3 | 4,
                  }))
                }
                className="px-3 py-1.5 border border-slate-200 dark:border-[#2a2b36] rounded-lg bg-white dark:bg-[#1a1b26] text-slate-900 dark:text-white text-sm"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
          </div>

          {tempSettings.showSidebar && (
            <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-900/30">
              <h3 className="text-sm font-semibold text-cyan-900 dark:text-cyan-100 uppercase tracking-wider">
                Global Sidebar Blocks
              </h3>
              <p className="text-xs text-cyan-800/80 dark:text-cyan-200/80 mt-1">
                Shared sidebar blocks are managed from Admin &gt; Widgets. This theme setting only
                controls whether Digest renders the sidebar area.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-[#2a2b36] flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-[#1a1b26] z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium shadow-lg shadow-cyan-500/30 transition-all flex items-center gap-2"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
