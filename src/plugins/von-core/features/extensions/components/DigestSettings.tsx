import React, { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { Palette, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminModal from '../../../../../components/admin/AdminModal';

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
    <AdminModal
      isOpen
      onClose={onClose}
      ariaLabel="Digest theme settings"
      className="w-full max-w-2xl"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a1b26] sm:max-h-[90dvh]">
        {/* Header */}
        <div className="z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white p-4 dark:border-[#2a2b36] dark:bg-[#1a1b26] sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white sm:text-2xl">
              <Palette size={24} className="text-cyan-500" />
              Digest Theme Settings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Modern magazine configuration
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#242633] dark:hover:text-white"
            aria-label="Close Digest theme settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
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
                  className="h-8 w-12 rounded-sm cursor-pointer border-0 p-0"
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
        <div className="admin-safe-bottom z-10 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 bg-white p-4 dark:border-[#2a2b36] dark:bg-[#1a1b26] sm:flex-row sm:p-6">
          <button
            onClick={onClose}
            className="min-h-11 w-full px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] font-medium transition-colors sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 font-medium text-white shadow-lg shadow-cyan-500/30 transition-all hover:bg-cyan-600 sm:w-auto"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </AdminModal>
  );
};
