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
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs animate-fade-in dark:border-[#2a2b36] dark:bg-[#1a1b26] sm:p-6">
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
            className={`flex cursor-pointer items-start rounded-lg border p-3 transition-all sm:p-4 ${current === opt.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-[#2a2b36] hover:bg-slate-50 dark:hover:bg-[#242633]/50'}`}
          >
            <input
              type="radio"
              name="permalink"
              value={opt.id}
              checked={current === opt.id}
              onChange={() => onChange('permalinkStructure', opt.id)}
              className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <div className="ml-3 min-w-0 grow sm:ml-4">
              <div className="flex flex-wrap items-center gap-2">
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
              <code className="mt-1 block break-all whitespace-normal rounded-sm bg-slate-100 px-2 py-1 font-mono text-xs text-blue-600 dark:bg-[#16161e] dark:text-blue-400">
                {opt.example}
              </code>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};
