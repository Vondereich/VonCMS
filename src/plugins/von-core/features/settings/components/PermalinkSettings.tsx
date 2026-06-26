import React from 'react';
import { SiteSettings } from '../../../../../types';

interface PermalinkSettingsProps {
  settings: SiteSettings;
  onChange: (key: string, value: any) => void;
}

export const PermalinkSettings: React.FC<PermalinkSettingsProps> = ({ settings, onChange }) => {
  const current = settings.permalinkStructure || 'slug';

  const baseUrl = (settings.siteUrl || 'https://yoursite.com').replace(/\/$/, '');

  const options = [
    {
      id: 'plain',
      label: 'Plain',
      example: `${baseUrl}/post/123`,
      seo: false,
      description: 'Simple ID-based URL',
    },
    {
      id: 'slug',
      label: 'Post Name',
      example: `${baseUrl}/sample-post`,
      seo: true,
      description: 'Clean, readable URL — Best for SEO',
    },
    {
      id: 'date',
      label: 'Date & Name',
      example: `${baseUrl}/2023/12/sample-post`,
      seo: true,
      description: 'Includes publish date in URL',
    },
    {
      id: 'category',
      label: 'Category & Name',
      example: `${baseUrl}/technology/sample-post`,
      seo: true,
      description: 'Includes category in URL — Great for organized sites',
    },
  ];

  return (
    <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-6 animate-fade-in">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-[#2a2b36] pb-2">
        Permalink Settings
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Choose how your content URLs look. This is important for SEO.
      </p>

      <div className="space-y-4">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${current === opt.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-[#2a2b36] hover:bg-slate-50 dark:hover:bg-[#242633]/50'}`}
          >
            <input
              type="radio"
              name="permalink"
              value={opt.id}
              checked={current === opt.id}
              onChange={() => onChange('permalinkStructure', opt.id)}
              className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <div className="ml-4 flex-grow">
              <div className="flex items-center gap-2">
                <span className="block text-sm font-medium text-slate-900 dark:text-white">
                  {opt.label}
                </span>
                {opt.seo && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                    SEO Friendly
                  </span>
                )}
              </div>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                {opt.description}
              </span>
              <code className="block text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono bg-slate-100 dark:bg-[#16161e] px-2 py-1 rounded">
                {opt.example}
              </code>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};
