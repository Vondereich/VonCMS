import React from 'react';
import { SiteSettings } from '../../../../../types';
import { Layout, Image, ExternalLink, Zap, Info, ShieldCheck, HelpCircle } from 'lucide-react';

interface AdSettingsProps {
  settings: SiteSettings;
  onChange: (key: string, value: any) => void;
}

export const AdSettings: React.FC<AdSettingsProps> = ({ settings, onChange }) => {
  return (
    <div className="bg-slate-50 dark:bg-[#16161e]/50 rounded-xl p-6 space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* GLOBAL SWITCH */}
      <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2b36] shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Master Ad Switch</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enable or disable all ad slots globally
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="adsettings-27"
            name="adsettings27"
            type="checkbox"
            checked={!!settings.ads.adsEnabled}
            onChange={(e) => onChange('adsEnabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-[#242633] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-[#333544] peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* HEADER AD */}
        <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2b36] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2a2b36] pb-3">
            <div className="flex items-center gap-2">
              <Layout className="text-blue-500" size={18} />
              <h3 className="font-bold text-slate-800 dark:text-white">Header Ad (Top Banner)</h3>
            </div>
            <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              High Visibility
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <textarea
                aria-label="High Visibility"
                id="adsettings-52"
                name="adsettings52"
                rows={6}
                value={settings.ads.headerAd}
                onChange={(e) => onChange('headerAd', e.target.value)}
                placeholder="<!-- Paste top ad code here -->"
                className="w-full p-3 font-mono text-xs rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div className="bg-slate-50 dark:bg-[#16161e]/50 p-5 rounded-xl space-y-4 border border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <HelpCircle size={14} className="text-blue-500" />
                <span>Guidance</span>
              </div>
              <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-3">
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Header ad code
                    </strong>
                    Use responsive display or leaderboard code.
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Placement
                    </strong>
                    Shows above site content when the header slot is enabled.
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Source
                    </strong>
                    Paste the provider snippet exactly as supplied.
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Boundary
                    </strong>
                    VonCMS contains the slot; your ad network controls delivery and reporting.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* IN-FEED AD */}
        <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2b36] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2a2b36] pb-3">
            <div className="flex items-center gap-2">
              <Image className="text-orange-500" size={18} />
              <h3 className="font-bold text-slate-800 dark:text-white">
                In-Feed Ad (Post Injection)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Frequency:
                </span>
                <select
                  id="adsettings-112"
                  name="adsettings112"
                  aria-label="Selection"
                  value={settings.ads.inFeedFrequency || 6}
                  onChange={(e) => onChange('inFeedFrequency', parseInt(e.target.value))}
                  className="bg-slate-50 dark:bg-[#16161e] border border-slate-200 dark:border-[#2a2b36] rounded-lg px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer"
                >
                  <option value={6}>Every 6 Posts</option>
                  <option value={8}>Every 8 Posts</option>
                  <option value={10}>Every 10 Posts</option>
                  <option value={12}>Every 12 Posts</option>
                </select>
              </div>
              <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Native Placement
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <textarea
                aria-label="Native Placement"
                id="adsettings-131"
                name="adsettings131"
                rows={6}
                value={settings.ads.inFeedAd}
                onChange={(e) => onChange('inFeedAd', e.target.value)}
                placeholder="<!-- Paste native/feed ad code here -->"
                className="w-full p-4 font-mono text-xs rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
              />
            </div>
            <div className="bg-slate-50 dark:bg-[#16161e]/50 p-5 rounded-xl space-y-4 border border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Info size={14} className="text-orange-500" />
                <span>In-feed ad code</span>
              </div>
              <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-3">
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Schedule
                    </strong>
                    Runs after the selected post interval:{' '}
                    <span className="text-orange-600 dark:text-orange-400 font-bold">
                      every {settings.ads.inFeedFrequency || 6} posts
                    </span>
                    .
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Format
                    </strong>
                    Use in-feed/native markup or a responsive display unit.
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Scope
                    </strong>
                    Applies to post lists only; single posts are handled by content slots.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* POPUP AD */}
        <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2b36] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2a2b36] pb-3">
            <div className="flex items-center gap-3">
              <ExternalLink className="text-purple-500" size={18} />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white leading-tight">
                  Popup Ad (Interstitial)
                </h3>
                <p className="text-[10px] text-slate-400 font-normal">
                  Displayed as an overlay on page load
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer scale-90">
              <input
                id="adsettings-196"
                name="adsettings196"
                type="checkbox"
                checked={settings.ads.popupEnabled}
                onChange={(e) => onChange('popupEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-[#242633] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-[#333544] peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <textarea
                id="adsettings-208"
                name="adsettings208"
                aria-label="Text Content"
                rows={4}
                value={settings.ads.popupAd}
                onChange={(e) => onChange('popupAd', e.target.value)}
                placeholder="<!-- Paste popup/interstitial script here -->"
                className="w-full p-4 font-mono text-xs rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all shadow-inner"
              />
            </div>
            <div className="bg-slate-50 dark:bg-[#16161e]/50 p-5 rounded-xl space-y-4 border border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <ShieldCheck size={14} className="text-purple-500" />
                <span>Popup ad code</span>
              </div>
              <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-3">
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Safety
                    </strong>
                    Use a delayed, consent-safe overlay script.
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Timing
                    </strong>
                    Prefer provider-side delay controls instead of redirect behavior.
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                      Scope
                    </strong>
                    Runs only when popup ads are enabled.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
