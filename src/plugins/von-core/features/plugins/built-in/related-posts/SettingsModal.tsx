import React, { useState } from 'react';
import { X } from 'lucide-react';
import { SiteSettings } from '../../../../../../types';
import { RelatedPostsConfig } from './types';
import toast from 'react-hot-toast';

interface RelatedPostsSettingsProps {
  settings: SiteSettings;
  onUpdate: (newSettings: SiteSettings) => void;
  onClose: () => void;
}

export const RelatedPostsSettings: React.FC<RelatedPostsSettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const currentConfig: RelatedPostsConfig = settings.pluginConfig?.['vp_related_posts'] || {
    enabled: true,
    count: 6,
    orderBy: 'relevance',
    layout: 'grid',
    showExcerpt: true,
    showImage: true,
    showDate: true,
    titleText: 'Related Posts',
  };

  const [config, setConfig] = useState<RelatedPostsConfig>(currentConfig);

  const handleSave = () => {
    onUpdate({
      ...settings,
      pluginConfig: {
        ...settings.pluginConfig,
        vp_related_posts: config,
      },
    });
    toast.success('Related Posts settings saved!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1a1b26] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-[#2a2b36]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
              Related Posts Settings
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Show related content to keep readers engaged
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Number of Posts */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Number of Posts
            </span>
            <div className="grid grid-cols-4 gap-3">
              {[3, 4, 6, 8].map((num) => (
                <button
                  key={num}
                  onClick={() => setConfig({ ...config, count: num as any })}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    config.count === num
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Layout Style
            </span>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
                { value: 'cards', label: 'Cards' },
              ].map((layout) => (
                <button
                  key={layout.value}
                  onClick={() => setConfig({ ...config, layout: layout.value as any })}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    config.layout === layout.value
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {layout.label}
                </button>
              ))}
            </div>
          </div>

          {/* Order By */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Sort Order
            </span>
            <select
              aria-label="Sort Order"
              id="settingsmodal-119"
              name="settingsmodal119"
              value={config.orderBy}
              onChange={(e) => setConfig({ ...config, orderBy: e.target.value as any })}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="relevance">Relevance (Category + Tags)</option>
              <option value="date">Most Recent</option>
              <option value="views">Most Viewed</option>
              <option value="random">Random</option>
            </select>
          </div>

          {/* Display Options */}
          <div className="space-y-3 p-4 bg-slate-50 dark:bg-[#16161e] rounded-lg">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-3">Display Options</p>

            {/* Show Image */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Show Featured Image
              </span>
              <button
                onClick={() => setConfig({ ...config, showImage: !config.showImage })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.showImage ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                    config.showImage ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            {/* Show Excerpt */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Show Excerpt</span>
              <button
                onClick={() => setConfig({ ...config, showExcerpt: !config.showExcerpt })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.showExcerpt ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                    config.showExcerpt ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            {/* Show Date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Show Date</span>
              <button
                onClick={() => setConfig({ ...config, showDate: !config.showDate })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.showDate ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                    config.showDate ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Title Text */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Section Title
            </span>
            <input
              id="settingsmodal-194"
              name="settingsmodal194"
              aria-label="Section Title"
              type="text"
              value={config.titleText}
              onChange={(e) => setConfig({ ...config, titleText: e.target.value })}
              placeholder="Related Posts"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/30"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
