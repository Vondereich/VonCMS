import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { SiteSettings } from '../../../../../types';
import { BASE_PATH } from '../../../../../config/site.config';
import { getBasePathPrefix } from '../../../../../utils/siteUtils';
import {
  X,
  Save,
  Globe,
  FileText,
  Search,
  Settings as SettingsIcon,
  CheckCircle,
  RefreshCcw,
  AlertCircle,
  ArrowRight,
  Zap,
  Key,
  Send,
} from 'lucide-react';
import { RedirectManager } from './RedirectManager';
import { vonFetch } from '../../../../../utils/api';

interface VonSEOSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => Promise<void> | void;
  onClose: () => void;
}

export const VonSEOSettings: React.FC<VonSEOSettingsProps> = ({ settings, onUpdate, onClose }) => {
  // Fallback default (in case API fails)
  const FALLBACK_ROBOTS = `# VonCMS Robots Policy v1.25.3

# Social Preview Crawlers
User-agent: facebookexternalhit
User-agent: Facebot
User-agent: meta-externalagent
User-agent: meta-webindexer
User-agent: meta-externalads
User-agent: meta-externalfetcher
User-agent: Twitterbot
User-agent: Pinterest
User-agent: WhatsApp
User-agent: LinkedInBot
User-agent: TelegramBot
User-agent: Slackbot
Allow: ${BASE_PATH}
Disallow: ${BASE_PATH}admin/
Disallow: ${BASE_PATH}api/
Disallow: ${BASE_PATH}install/
Disallow: ${BASE_PATH}von_config.php
Disallow: ${BASE_PATH}data/
Disallow: ${BASE_PATH}logs/

# AI Search / User-Directed Assistants
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
Allow: ${BASE_PATH}
Disallow: ${BASE_PATH}admin/
Disallow: ${BASE_PATH}api/
Disallow: ${BASE_PATH}install/
Disallow: ${BASE_PATH}von_config.php
Disallow: ${BASE_PATH}data/
Disallow: ${BASE_PATH}logs/

# General Crawlers
User-agent: *
# Content-Signal is a vendor extension; standard crawlers may ignore it.
Content-Signal: search=yes,ai-train=no
Allow: ${BASE_PATH}
Disallow: ${BASE_PATH}admin/
Disallow: ${BASE_PATH}api/
Disallow: ${BASE_PATH}install/
Disallow: ${BASE_PATH}von_config.php
Disallow: ${BASE_PATH}data/
Disallow: ${BASE_PATH}logs/

# AI Training / Bulk Dataset Crawlers
User-agent: GPTBot
User-agent: Google-Extended
User-agent: ClaudeBot
User-agent: CCBot
User-agent: Applebot-Extended
User-agent: Bytespider
Disallow: /`;

  // Fetch default robots.txt from API (single source of truth)
  const [defaultRobots, setDefaultRobots] = useState(FALLBACK_ROBOTS);

  const normalizeRobotsRules = (robots: string, trim = true) => {
    const normalized = robots
      .replace(/^\s*Sitemap\s*:\s*.*$/gim, '')
      .replace(/^\s*Crawl-delay\s*:\s*\d+\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n');
    return trim ? normalized.trim() : normalized;
  };

  const isLegacyVonCmsRobotsPolicy = (robots: string) =>
    !robots.includes('VonCMS Robots Policy v1.25.3') &&
    robots.includes('# Social Media Crawlers') &&
    robots.includes('User-agent: OAI-SearchBot') &&
    robots.includes('Content-Signal: search=yes,ai-train=no') &&
    robots.includes('User-agent: GPTBot') &&
    robots.includes('von_config.php');

  React.useEffect(() => {
    const fetchDefaultRobots = async () => {
      try {
        const response = await vonFetch(`${BASE_PATH}robots.php?default=json`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.robots) {
            setDefaultRobots(normalizeRobotsRules(data.robots));
          }
        }
      } catch (e) {
        // Keep fallback default
      }
    };
    fetchDefaultRobots();
  }, []);

  const initialSEO = {
    siteTitle: settings.seo?.siteTitle || settings.siteName,
    sitemapEnabled: settings.seo?.sitemapEnabled ?? true,
    robotsTxt: normalizeRobotsRules(
      settings.seo?.robotsTxt && !isLegacyVonCmsRobotsPolicy(settings.seo.robotsTxt)
        ? settings.seo.robotsTxt
        : defaultRobots
    ),
  };

  const basePathPrefix = getBasePathPrefix();
  const publicHost = (settings.siteUrl || settings.domainUrl || '').replace(/\/$/, '');
  const hostAlreadyIncludesBasePath =
    !!publicHost &&
    !!basePathPrefix &&
    (publicHost === basePathPrefix || publicHost.endsWith(basePathPrefix));
  const publicBaseUrl = publicHost
    ? `${publicHost}${hostAlreadyIncludesBasePath ? '' : basePathPrefix}`
    : basePathPrefix || '';
  const buildPublicAssetUrl = (path: string) =>
    `${(publicBaseUrl || '').replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  const [tempSEO, setTempSEO] = useState(initialSEO);
  const [activeTab, setActiveTab] = useState<
    'general' | 'social' | 'advanced' | 'redirects' | 'indexnow'
  >('general');
  const [showRedirectManager, setShowRedirectManager] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // IndexNow state
  const [indexNowStatus, setIndexNowStatus] = useState<any>(null);
  const [indexNowLoading, setIndexNowLoading] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);

  const fetchIndexNowStatus = async () => {
    try {
      const response = await vonFetch(`${BASE_PATH}api/system/indexnow_status.php`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) setIndexNowStatus(data);
      }
    } catch (e) {}
  };

  React.useEffect(() => {
    if (activeTab === 'indexnow') fetchIndexNowStatus();
  }, [activeTab]);

  const handleGenerateKey = async () => {
    setIndexNowLoading(true);
    try {
      const response = await vonFetch(`${BASE_PATH}api/system/indexnow_setup.php`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('IndexNow API key generated!');
        onUpdate({ ...settings, indexnowKey: data.key });
        fetchIndexNowStatus();
      }
    } catch (e) {
      toast.error('Failed to generate key');
    } finally {
      setIndexNowLoading(false);
    }
  };

  const handleManualPing = async () => {
    setPingLoading(true);
    try {
      const response = await vonFetch(`${BASE_PATH}api/system/indexnow_ping.php`, {
        method: 'POST',
        body: JSON.stringify({ url: '' }),
      });
      const data = await response.json();
      if (data.success) toast.success('Homepage submitted!');
      else toast.error(data.error || 'Ping failed');
    } catch (e) {
      toast.error('Ping failed');
    } finally {
      setPingLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextSeo = { ...(settings.seo || {}), ...tempSEO };
      delete nextSeo.defaultMetaDescription;
      delete nextSeo.canonicalHost;
      delete nextSeo.defaultKeywords;
      nextSeo.robotsTxt = normalizeRobotsRules(nextSeo.robotsTxt || defaultRobots);

      await onUpdate({
        ...settings,
        seo: nextSeo,
      });
      toast.success('SEO settings saved!');
      onClose();
    } catch (error) {
      toast.error('Failed to save SEO settings');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-[#16161e] w-full max-w-5xl shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-900">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Search className="text-blue-600" size={28} />
              VonSEO Settings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Advanced SEO & Social Media Optimization
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101018]">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'general' ? 'bg-white dark:bg-[#16161e] text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
          >
            <Globe size={18} />
            General SEO
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'social' ? 'bg-white dark:bg-[#16161e] text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
          >
            <FileText size={18} />
            Social Media
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'advanced' ? 'bg-white dark:bg-[#16161e] text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
          >
            <SettingsIcon size={18} />
            Advanced
          </button>
          <button
            onClick={() => setActiveTab('redirects')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'redirects' ? 'bg-white dark:bg-[#16161e] text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
          >
            <ArrowRight size={18} />
            Redirects
          </button>
          <button
            onClick={() => setActiveTab('indexnow')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'indexnow' ? 'bg-white dark:bg-[#16161e] text-violet-600 border-b-2 border-violet-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
          >
            <Zap size={18} />
            IndexNow
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Site Title */}
              <div className="space-y-2">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Site Title
                </span>
                <input
                  aria-label="Site Title"
                  id="vonseosettings-262"
                  name="vonseosettings262"
                  type="text"
                  value={tempSEO.siteTitle}
                  onChange={(e) => setTempSEO({ ...tempSEO, siteTitle: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Your Site Name"
                />
                <p className="text-xs text-slate-500">Appears in browser tabs and search results</p>
              </div>

              {/* Meta Description */}
              <div className="space-y-2">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Default Meta Description (from General Settings)
                </span>
                <textarea
                  id="vonseosettings-277"
                  name="vonseosettings277"
                  aria-label="Default Meta Description"
                  rows={4}
                  value={settings.siteDescription || ''}
                  readOnly
                  className="w-full px-4 py-3 border border-slate-200 dark:border-[#2a2b36] rounded-lg bg-slate-50 dark:bg-[#16161e]/40 dark:text-slate-200 resize-none cursor-not-allowed outline-none transition-all"
                  placeholder="Set this in Settings > General"
                />
                <p className="text-xs text-slate-500">
                  {(settings.siteDescription || '').length}/160 characters. Edit this in Settings
                  &gt; General so search and social defaults stay in one place.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-1">
                      Auto-Generated Social Tags
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-400">
                      VonSEO automatically generates Open Graph and Twitter Card tags for all your
                      posts and pages. These settings control the default fallback values.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 dark:border-[#2a2b36] rounded-lg">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">Open Graph</h4>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>✓ og:title</li>
                    <li>✓ og:description</li>
                    <li>✓ og:image</li>
                    <li>✓ og:url</li>
                    <li>✓ og:type</li>
                  </ul>
                </div>
                <div className="p-4 border border-slate-200 dark:border-[#2a2b36] rounded-lg">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">Twitter Cards</h4>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>✓ twitter:card</li>
                    <li>✓ twitter:title</li>
                    <li>✓ twitter:description</li>
                    <li>✓ twitter:image</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Canonical URL source */}
              <div className="space-y-2">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Canonical Domain URL
                </span>
                <input
                  id="vonseosettings-359"
                  name="vonseosettings359"
                  aria-label="Canonical Domain URL"
                  type="url"
                  value={settings.domainUrl || settings.siteUrl || ''}
                  readOnly
                  className="w-full px-4 py-3 border border-slate-200 dark:border-[#2a2b36] rounded-lg bg-slate-50 dark:bg-[#16161e]/40 dark:text-slate-200 cursor-not-allowed outline-none transition-all"
                  placeholder="Set the Domain URL in Settings > General"
                />
                <p className="text-xs text-slate-500">
                  Canonical URLs use the Domain URL from General Settings so SSR, React, sitemap,
                  RSS, llms.txt, and IndexNow stay aligned.
                </p>
              </div>

              {/* Sitemap */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-[#2a2b36] rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26] transition-colors">
                  <input
                    id="vonseosettings-374"
                    name="vonseosettings374"
                    type="checkbox"
                    checked={tempSEO.sitemapEnabled}
                    onChange={(e) => setTempSEO({ ...tempSEO, sitemapEnabled: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Enable XML Sitemap
                    </span>
                    <p className="text-xs text-slate-500">
                      Automatically generate sitemap.xml for search engines
                    </p>
                  </div>
                </label>
                {tempSEO.sitemapEnabled && (
                  <div className="px-4 flex gap-4">
                    <a
                      href={buildPublicAssetUrl('/sitemap.xml')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      View Sitemap ↗
                    </a>
                    <a
                      href={buildPublicAssetUrl('/llms.txt')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-600 hover:text-violet-700 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      View llms.txt ↗
                    </a>
                    <a
                      href={buildPublicAssetUrl('/rss.xml')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      View RSS Feed ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Robots.txt */}
              <div className="space-y-2">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Robots.txt Rules
                </span>
                <textarea
                  id="vonseosettings-424"
                  name="vonseosettings424"
                  aria-label="Robots.txt Rules"
                  rows={6}
                  value={tempSEO.robotsTxt}
                  onChange={(e) =>
                    setTempSEO({
                      ...tempSEO,
                      robotsTxt: normalizeRobotsRules(e.target.value, false),
                    })
                  }
                  className="w-full px-4 py-3 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="User-agent: *&#10;Disallow:"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">
                    Control how search engines crawl your site
                  </p>
                  {tempSEO.robotsTxt !== defaultRobots && (
                    <button
                      type="button"
                      onClick={() => {
                        setTempSEO({ ...tempSEO, robotsTxt: defaultRobots });
                        toast.success('Robots.txt reset to recommended rules!');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors"
                    >
                      <RefreshCcw size={12} />
                      Reset to Recommended
                    </button>
                  )}
                </div>
                {basePathPrefix && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={14} />
                    <p className="text-xs text-amber-800 dark:text-amber-400">
                      This is a subfolder install. Search crawlers only recognize the host-root
                      /robots.txt, so configure the parent domain to serve this policy or reference
                      {` ${basePathPrefix}/sitemap.xml`}.
                    </p>
                  </div>
                )}
                {tempSEO.robotsTxt.trim() === 'User-agent: *\nDisallow:' && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 mt-2 flex items-start gap-2">
                    <AlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={14} />
                    <p className="text-xs text-amber-800 dark:text-amber-400">
                      Legacy robots.txt detected. Reset to the recommended crawl policy to keep
                      crawler groups and protected paths aligned.
                    </p>
                  </div>
                )}
              </div>

              {/* Schema.org Info */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-bold text-green-900 dark:text-green-300 mb-2">
                      Schema.org Structured Data
                    </h3>
                    <p className="text-sm text-green-800 dark:text-green-400 mb-3">
                      VonSEO automatically generates JSON-LD structured data:
                    </p>
                    <ul className="text-sm text-green-800 dark:text-green-400 space-y-1">
                      <li>✓ Organization Schema</li>
                      <li>✓ WebSite Schema</li>
                      <li>✓ Article Schema (for articles)</li>
                      <li>✓ Person Schema (for profiles)</li>
                      <li>✓ Breadcrumb Navigation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'redirects' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ArrowRight className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                      301 Redirect Manager
                    </h3>
                    <p className="text-sm text-emerald-800 dark:text-emerald-400">
                      Manage URL redirects to prevent 404 errors when content is moved or renamed.
                      Redirects are processed server-side before the page loads.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowRedirectManager(true)}
                className="w-full p-4 border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <ArrowRight size={20} />
                Open Redirect Manager
              </button>
            </div>
          )}

          {activeTab === 'indexnow' && (
            <div className="space-y-6">
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
                      <Zap className="text-violet-600 dark:text-violet-400" size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Instant Indexing</h4>
                      <p className="text-sm text-slate-500">Bing, Yandex & 1000+ search engines</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="vonseosettings-525"
                      name="vonseosettings525"
                      type="checkbox"
                      checked={!!settings.indexnowEnabled}
                      onChange={(e) => onUpdate({ ...settings, indexnowEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-[#242633] peer-checked:after:translate-x-full peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>

                {settings.indexnowEnabled && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white dark:bg-[#1a1b26] rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                        <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                          API Key Status
                        </span>
                        <div className="flex items-center gap-2">
                          {indexNowStatus?.key_configured ? (
                            <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              {indexNowStatus.key_preview}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400 italic">Not configured</span>
                          )}
                        </div>
                      </div>
                      <div className="p-4 bg-white dark:bg-[#1a1b26] rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                        <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                          Verification File
                        </span>
                        <div className="flex items-center gap-2">
                          {indexNowStatus?.key_file_exists ? (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle size={12} /> Active
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle size={12} /> Missing
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleGenerateKey}
                        disabled={indexNowLoading}
                        className="flex-1 py-3 bg-violet-600 text-white rounded-lg font-bold hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Key size={18} />
                        {indexNowLoading ? 'Generating...' : 'Setup IndexNow Key'}
                      </button>
                      {indexNowStatus?.status === 'ready' && (
                        <button
                          onClick={handleManualPing}
                          disabled={pingLoading}
                          className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Send size={18} />
                          {pingLoading ? 'Pinging...' : 'Instant Ping Home'}
                        </button>
                      )}
                    </div>

                    <div className="bg-slate-100 dark:bg-[#1a1b26] rounded-lg p-4 text-xs text-slate-500 dark:text-slate-400">
                      <strong>How it works:</strong> When you publish or update a post, VonCMS sends
                      a "ping" to IndexNow. Engines like Bing will prioritize crawling your site
                      instantly.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3 bg-slate-50 dark:bg-[#16161e]">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-8 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isSaving ? (
              'Saving...'
            ) : (
              <>
                <Save size={18} />
                Save SEO Settings
              </>
            )}
          </button>
        </div>
      </div>

      {showRedirectManager && <RedirectManager onClose={() => setShowRedirectManager(false)} />}
    </div>
  );
};
