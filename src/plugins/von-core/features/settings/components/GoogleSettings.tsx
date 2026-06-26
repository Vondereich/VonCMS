import React from 'react';
import { SiteSettings } from '../../../../../types';
import { BarChart3, DollarSign, Search, CheckCircle, HelpCircle } from 'lucide-react';

interface GoogleSettingsProps {
  settings: SiteSettings;
  onChange: (key: string, value: any) => void;
}

export const GoogleSettings: React.FC<GoogleSettingsProps> = ({ settings, onChange }) => {
  // Helpers to update nested state safely
  const updateSeo = (key: string, value: any) => {
    onChange('seo', { ...settings.seo, [key]: value });
  };

  const updateAds = (key: string, value: any) => {
    onChange('ads', { ...settings.ads, [key]: value });
  };

  const updateAnalytics = (key: string, value: any) => {
    // Analytics might be undefined initially
    const currentAnalytics = settings.analytics || { enableTracking: true };
    onChange('analytics', { ...currentAnalytics, [key]: value });
  };

  const googleVerification = settings.seo?.googleSearchConsole || '';
  const analyticsId = settings.analytics?.googleAnalyticsId || '';
  const adsenseId = settings.ads?.adsenseVerification || '';

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-[#2a2b36] pb-6">
        <div className="w-16 h-16 bg-white dark:bg-[#1a1b26] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2a2b36] flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Google Services Integration
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Manage your Search Console, Analytics, and AdSense connections in one place.
          </p>
        </div>
      </div>

      {/* 1. Google Search Console & SEO */}
      <section className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <Search size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Search Console (SEO)</h3>
              <p className="text-xs text-slate-500">Verify your site ownership with Google.</p>
            </div>
          </div>
          {googleVerification ? (
            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded-full">
              <CheckCircle size={12} /> VERIFIED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 dark:bg-[#242633] px-2 py-1 rounded-full">
              NOT CONNECTED
            </span>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div>
            <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Google Site Verification Code
            </span>
            <div className="relative">
              <input
                aria-label="Google Site Verification Code"
                id="googlesettings-92"
                name="googlesettings92"
                type="text"
                value={googleVerification}
                onChange={(e) => updateSeo('googleSearchConsole', e.target.value)}
                placeholder="e.g. google-site-verification=..."
                className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#16161e] dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <HelpCircle size={12} />
              <span>
                Paste the full meta tag content or just the code code from{' '}
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google Search Console
                </a>
                .
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* 2. Google Analytics 4 */}
      <section className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center bg-orange-50/50 dark:bg-orange-900/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Google Analytics 4</h3>
              <p className="text-xs text-slate-500">Track visitor traffic and behavior.</p>
            </div>
          </div>
          {analyticsId ? (
            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded-full">
              <CheckCircle size={12} /> ACTIVE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 dark:bg-[#242633] px-2 py-1 rounded-full">
              NOT CONNECTED
            </span>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div>
            <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Measurement ID (G-Tag)
            </span>
            <div className="relative">
              <input
                id="googlesettings-148"
                name="googlesettings148"
                aria-label="Measurement ID (G-Tag)"
                type="text"
                value={analyticsId}
                onChange={(e) => updateAnalytics('googleAnalyticsId', e.target.value)}
                placeholder="e.g. G-12345678"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#16161e] dark:text-white font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <BarChart3 className="absolute left-3 top-3.5 text-slate-400" size={16} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="googlesettings-161"
                name="googlesettings161"
                type="checkbox"
                checked={settings.analytics?.enableTracking ?? true}
                onChange={(e) => updateAnalytics('enableTracking', e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Enable Tracking</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="googlesettings-171"
                name="googlesettings171"
                type="checkbox"
                checked={settings.analytics?.anonymizeIP ?? true}
                onChange={(e) => updateAnalytics('anonymizeIP', e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Anonymize IP (GDPR)
              </span>
            </label>
          </div>
        </div>
      </section>

      {/* 3. Google AdSense */}
      <section className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center bg-green-50/50 dark:bg-green-900/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Google AdSense</h3>
              <p className="text-xs text-slate-500">Monetize your content with ads.</p>
            </div>
          </div>
          {adsenseId ? (
            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded-full">
              <CheckCircle size={12} /> CONNECTED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 dark:bg-[#242633] px-2 py-1 rounded-full">
              NOT CONNECTED
            </span>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div>
            <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Overview Settings
            </span>
            <div className="bg-slate-50 dark:bg-[#16161e]/50 p-4 rounded-lg text-sm text-slate-600 dark:text-slate-400 mb-4 border border-slate-100 dark:border-white/10">
              <p>
                To configure ad block placements (Header, Sidebar, etc.), please visit the{' '}
                <strong>Ads</strong> tab.
              </p>
            </div>

            <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Publisher ID / Verification Code
            </span>
            <div className="relative">
              <input
                id="googlesettings-223"
                name="googlesettings223"
                aria-label="Publisher ID / Verification Code"
                type="text"
                value={adsenseId}
                onChange={(e) => updateAds('adsenseVerification', e.target.value)}
                placeholder="e.g. pub-1234567890123456"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#16161e] dark:text-white font-mono text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
              <DollarSign className="absolute left-3 top-3.5 text-slate-400" size={16} />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              This code is automatically added to the <code>&lt;head&gt;</code> of every page for
              auto-ads and verification.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
