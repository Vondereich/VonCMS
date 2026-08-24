import React, { useState } from 'react';
import { X } from 'lucide-react';
import { SiteSettings } from '../../../../../../types';
import { AISummaryConfig } from './types';
import toast from 'react-hot-toast';
import AdminModal from '../../../../../../components/admin/AdminModal';

interface AISummarySettingsProps {
  settings: SiteSettings;
  onUpdate: (newSettings: SiteSettings) => boolean | Promise<boolean>;
  onClose: () => void;
}

export const AISummarySettings: React.FC<AISummarySettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const currentConfig: AISummaryConfig = settings.pluginConfig?.['vp_ai_summary'] || {
    enabled: true,
    maxBullets: 5,
    extractMethod: 'hybrid',
    showLabel: true,
    labelText: 'AI Summary',
    position: 'top',
  };

  const [config, setConfig] = useState<AISummaryConfig>(currentConfig);
  const positionOptions: Array<{ value: AISummaryConfig['position']; label: string }> = [
    { value: 'top', label: 'Above Content (Top)' },
    { value: 'bottom', label: 'Below Content (Bottom)' },
  ];
  const bulletOptions: AISummaryConfig['maxBullets'][] = [3, 5, 7];

  const handleSave = async () => {
    const saved = await onUpdate({
      ...settings,
      pluginConfig: {
        ...settings.pluginConfig,
        vp_ai_summary: config,
      },
    });
    if (saved === false) return;

    toast.success('AI Summary settings saved!');
    onClose();
  };

  return (
    <AdminModal
      isOpen
      onClose={onClose}
      ariaLabel="AI Summary settings"
      className="w-full max-w-2xl"
    >
      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2b36] dark:bg-[#1a1b26]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-linear-to-r from-blue-50 to-indigo-50 p-4 dark:border-[#2a2b36] dark:from-blue-900/20 dark:to-indigo-900/20 sm:p-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white sm:text-2xl">
              AI Summary Settings
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Auto-extract key points from articles
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-600 dark:hover:bg-[#242633] dark:hover:text-slate-200"
            aria-label="Close AI Summary settings"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(100dvh-12rem)] space-y-6 overflow-y-auto p-4 sm:max-h-[60dvh] sm:p-6">
          {/* Extract Method */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Extraction Method
            </span>
            <select
              aria-label="Extraction Method"
              id="settingsmodal-69"
              name="settingsmodal69"
              value={config.extractMethod}
              onChange={(e) =>
                setConfig({
                  ...config,
                  extractMethod: e.target.value as AISummaryConfig['extractMethod'],
                })
              }
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="hybrid">Smart (Hybrid) - Recommended</option>
              <option value="headings">Headings Only (H2-H4)</option>
              <option value="sentences">Ranked Sentences</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {config.extractMethod === 'hybrid'
                ? 'Hybrid blends descriptive headings with ranked article sentences.'
                : config.extractMethod === 'headings'
                  ? 'Uses article H2-H4 headings in document order.'
                  : 'Ranks distinct article sentences, then restores their document order.'}
            </p>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Position
            </span>
            <div className="grid grid-cols-2 gap-3">
              {positionOptions.map((pos) => (
                <button
                  key={pos.value}
                  onClick={() => setConfig({ ...config, position: pos.value })}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    config.position === pos.value
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Bullets */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Maximum Points
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {bulletOptions.map((num) => (
                <button
                  key={num}
                  onClick={() => setConfig({ ...config, maxBullets: num })}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    config.maxBullets === num
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {num} points
                </button>
              ))}
            </div>
          </div>

          {/* Show Label */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#16161e] rounded-lg">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">Show Label</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Display section title above summary
              </p>
            </div>
            <button
              onClick={() => setConfig({ ...config, showLabel: !config.showLabel })}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                config.showLabel ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                  config.showLabel ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* Label Text */}
          {config.showLabel && (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Label Text
              </span>
              <input
                id="settingsmodal-158"
                name="settingsmodal158"
                aria-label="Label Text"
                type="text"
                value={config.labelText}
                onChange={(e) => setConfig({ ...config, labelText: e.target.value })}
                placeholder="AI Summary"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="admin-safe-bottom flex flex-col-reverse justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 dark:border-[#2a2b36] dark:bg-[#16161e]/50 sm:flex-row sm:p-6">
          <button
            onClick={onClose}
            className="min-h-11 w-full px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-lg font-medium transition-colors sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="min-h-11 w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 sm:w-auto"
          >
            Save Changes
          </button>
        </div>
      </div>
    </AdminModal>
  );
};
