import React, { useState } from 'react';
import toast from 'react-hot-toast';

import { SiteSettings } from '../../../../../types';
import { API } from '../../../../../config/site.config';
import { getAuthHeader } from '../../../../../config/auth.config';
import { vonFetch } from '../../../../../utils/api';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

interface GeneralSettingsProps {
  settings: SiteSettings;
  onChange: (key: string, value: any) => void;
  canManageSecrets?: boolean;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  onChange,
  canManageSecrets = false,
}) => {
  const [uploading, setUploading] = useState<
    'logo' | 'favicon' | 'ogImage' | 'ogImageSquare' | null
  >(null);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'favicon' | 'ogImage' | 'ogImageSquare'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(type);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', 'system');

    try {
      const endpoint = API.uploadFile;

      const res = await vonFetch(endpoint, {
        method: 'POST',
        headers: {
          ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
        },
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Upload failed with status: ${res.status}`);
      }

      if (data && data.success && data.url) {
        let key = 'logoUrl';
        if (type === 'favicon') key = 'faviconUrl';
        if (type === 'ogImage') key = 'ogImageUrl';
        if (type === 'ogImageSquare') key = 'ogImageSquareUrl';

        onChange(key, data.url);
        toast.success('Image uploaded successfully');
      } else {
        throw new Error(data?.error || 'Unknown upload error');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      // Show the actual error message from server if available
      toast.error(error.message || 'Failed to upload file. Check console.');
    } finally {
      setUploading(null);
      // Reset input
      e.target.value = '';
    }
  };

  // Local state for buffered input to allow smooth typing (e.g. clearing box, typed '0')
  const [postsPerPageLocal, setPostsPerPageLocal] = useState<string>(
    settings.postsPerPage.toString()
  );

  // Sync local state when settings change externally
  React.useEffect(() => {
    setPostsPerPageLocal(settings.postsPerPage.toString());
  }, [settings.postsPerPage]);

  const handlePostsPerPageBlur = () => {
    let val = parseInt(postsPerPageLocal);

    if (isNaN(val) || val < 6) {
      val = 6;
      toast.error('Minimum posts per page is 6');
    } else if (val > 50) {
      val = 50;
      toast.error('Maximum posts per page is 50');
    }

    // Update both local and parent to sanitized value
    setPostsPerPageLocal(val.toString());
    onChange('postsPerPage', val);
  };

  return (
    <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-6 animate-fade-in">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-[#2a2b36] pb-2">
        Site Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Website Name
          </span>
          <input
            aria-label="Website Name"
            id="generalsettings-107"
            name="generalsettings107"
            type="text"
            value={settings.siteName}
            onChange={(e) => onChange('siteName', e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-lg font-medium"
            placeholder="E.g. My Awesome Blog"
          />
          <p className="text-xs text-slate-500 mt-1">
            This name will appear in the header and browser tab.
          </p>
        </div>
        <div className="md:col-span-2">
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Site Description (SEO)
          </span>
          <textarea
            id="generalsettings-122"
            name="generalsettings122"
            aria-label="Site Description (SEO)"
            rows={3}
            value={settings.siteDescription}
            onChange={(e) => onChange('siteDescription', e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white"
            placeholder="E.g. Portal sharing knowledge about technology..."
          />
        </div>
        <div className="md:col-span-2">
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Site Tagline
          </span>
          <input
            aria-label="Site Tagline"
            id="generalsettings-134"
            name="generalsettings134"
            type="text"
            value={settings.siteTagline || ''}
            onChange={(e) => onChange('siteTagline', e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-lg"
            placeholder="E.g. Think. Create. Share."
          />
          <p className="text-xs text-slate-500 mt-1">Short tagline shown on the homepage.</p>
        </div>
        <div className="md:col-span-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            Site Language (ISO Code)
            <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-extrabold ml-1">
              AI Ready
            </span>
          </span>
          <input
            id="generalsettings-150"
            name="generalsettings150"
            aria-label="Site Language (ISO Code) AI Ready"
            type="text"
            value={settings.site_language || ''}
            onChange={(e) => onChange('site_language', e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-lg font-mono placeholder:font-sans"
            placeholder="e.g. ms, en, ar, hi"
          />
          <p className="text-xs text-slate-500 mt-1">
            Enter the 2-letter ISO 639-1 language code (e.g. <strong>ms</strong>,{' '}
            <strong>en</strong>) or multiple separated by comma (e.g. <strong>ms, en</strong>). This
            helps AI crawler agents automatically index your content in the correct language.
          </p>
        </div>
        {/* Logo Upload */}
        <div>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Site Logo
          </span>
          <div className="flex items-center gap-4">
            {settings.logoUrl ? (
              <div className="relative w-20 h-20 bg-slate-100 dark:bg-[#16161e] rounded-lg border border-slate-200 dark:border-[#2a2b36] flex items-center justify-center overflow-hidden">
                <img
                  src={settings.logoUrl}
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={() => onChange('logoUrl', '')}
                  className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 bg-slate-100 dark:bg-[#16161e] rounded-lg border border-dashed border-slate-300 dark:border-[#333544] flex items-center justify-center text-slate-400">
                <ImageIcon size={24} />
              </div>
            )}
            <div className="flex-1">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                {uploading === 'logo' ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Upload size={18} />
                )}
                <span>{uploading === 'logo' ? 'Uploading...' : 'Upload Logo'}</span>
                <input
                  id="generalsettings-196"
                  name="generalsettings196"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'logo')}
                  disabled={uploading === 'logo'}
                />
              </label>
              <p className="text-xs text-slate-500 mt-2">
                Recommended: PNG or SVG, max 2MB.
                <br />
                <span className="text-[10px] opacity-80">
                  Best size: <strong>200x50px</strong> (Landscape) or <strong>64x64px</strong>{' '}
                  (Square).
                </span>
              </p>

              {/* Logo Options */}
              {/* Logo Options - NOW ALWAYS VISIBLE (UX Fix) */}
              <div
                className={`mt-3 flex items-start gap-2 ${!settings.logoUrl ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  id="useLogoAsTitle"
                  checked={settings.useLogoAsTitle || false}
                  onChange={(e) => onChange('useLogoAsTitle', e.target.checked)}
                  disabled={!settings.logoUrl}
                  className="mt-0.5 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer disabled:cursor-not-allowed"
                />
                <div>
                  <label
                    htmlFor="useLogoAsTitle"
                    className={`text-xs font-bold text-slate-700 dark:text-slate-300 ${settings.logoUrl ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    Replace Text Title with Logo
                  </label>
                  {!settings.logoUrl && (
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                      Upload a logo first to enable this option.
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`mt-3 flex items-start gap-2 ${!settings.logoUrl ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  id="invertLogoInDarkMode"
                  checked={settings.invertLogoInDarkMode || false}
                  onChange={(e) => onChange('invertLogoInDarkMode', e.target.checked)}
                  disabled={!settings.logoUrl}
                  className="mt-0.5 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer disabled:cursor-not-allowed"
                />
                <div>
                  <label
                    htmlFor="invertLogoInDarkMode"
                    className={`text-xs font-bold text-slate-700 dark:text-slate-300 ${settings.logoUrl ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    Invert logo in dark mode
                  </label>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    Best for black or monochrome PNG logos. Leave off for full-color logos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Favicon Upload */}
        <div>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Site Favicon
          </span>
          <div className="flex items-center gap-4">
            {settings.faviconUrl ? (
              <div className="relative w-12 h-12 bg-slate-100 dark:bg-[#16161e] rounded-lg border border-slate-200 dark:border-[#2a2b36] flex items-center justify-center overflow-hidden">
                <img
                  src={settings.faviconUrl}
                  alt="Favicon"
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={() => onChange('faviconUrl', '')}
                  className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg hover:bg-red-600 text-xs w-5 h-5 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-12 h-12 bg-slate-100 dark:bg-[#16161e] rounded-lg border border-dashed border-slate-300 dark:border-[#333544] flex items-center justify-center text-slate-400">
                <ImageIcon size={16} />
              </div>
            )}
            <div className="flex-1">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-[#242633] hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg transition-colors">
                {uploading === 'favicon' ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Upload size={18} />
                )}
                <span>{uploading === 'favicon' ? 'Uploading...' : 'Upload Favicon'}</span>
                <input
                  id="generalsettings-276"
                  name="generalsettings276"
                  type="file"
                  className="hidden"
                  accept="image/x-icon,image/png,image/svg+xml"
                  onChange={(e) => handleFileUpload(e, 'favicon')}
                  disabled={uploading === 'favicon'}
                />
              </label>
              <p className="text-xs text-slate-500 mt-2">
                Recommended: 48x48 or larger PNG (min 48px for Google Search). ICO also supported.
              </p>
            </div>
          </div>
        </div>
        {/* Social Share Images (Large & Square) */}
        <div className="md:col-span-2">
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Social Share Images
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LARGE IMAGE (Facebook / LinkedIn) */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Large (Facebook / LinkedIn)
              </p>
              <div className="flex items-center gap-4">
                {settings.ogImageUrl ? (
                  <div className="relative w-24 h-12 bg-slate-100 dark:bg-[#16161e] rounded-lg border border-slate-200 dark:border-[#2a2b36] flex items-center justify-center overflow-hidden group">
                    <img
                      src={settings.ogImageUrl}
                      alt="Social Share Large"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => onChange('ogImageUrl', '')}
                      className="absolute top-0 right-0 bg-red-500 text-white p-0.5 w-5 h-5 flex items-center justify-center rounded-bl-lg hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-12 bg-slate-100 dark:bg-[#16161e] rounded-lg border border-dashed border-slate-300 dark:border-[#333544] flex items-center justify-center text-slate-400">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div className="flex-1">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-[#242633] hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg transition-colors text-xs font-medium">
                    {uploading === 'ogImage' ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Upload size={14} />
                    )}
                    <span>{uploading === 'ogImage' ? 'Uploading...' : 'Upload Large'}</span>
                    <input
                      id="generalsettings-329"
                      name="generalsettings329"
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg"
                      onChange={(e) => handleFileUpload(e, 'ogImage')}
                      disabled={uploading === 'ogImage'}
                    />
                  </label>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Rec: <strong>1200x630</strong> (JPG/PNG).
                  </p>
                </div>
              </div>
            </div>

            {/* SQUARE IMAGE (WhatsApp / Twitter) */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Square (WhatsApp / Twitter)
              </p>
              <div className="flex items-center gap-4">
                {settings.ogImageSquareUrl ? (
                  <div className="relative w-12 h-12 bg-slate-100 dark:bg-[#16161e] rounded-lg border border-slate-200 dark:border-[#2a2b36] flex items-center justify-center overflow-hidden group">
                    <img
                      src={settings.ogImageSquareUrl}
                      alt="Social Share Square"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => onChange('ogImageSquareUrl', '')}
                      className="absolute top-0 right-0 bg-red-500 text-white p-0.5 w-5 h-5 flex items-center justify-center rounded-bl-lg hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-slate-100 dark:bg-[#16161e] rounded-lg border border-dashed border-slate-300 dark:border-[#333544] flex items-center justify-center text-slate-400">
                    <ImageIcon size={16} />
                  </div>
                )}
                <div className="flex-1">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-[#242633] hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg transition-colors text-xs font-medium">
                    {uploading === 'ogImageSquare' ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Upload size={14} />
                    )}
                    <span>{uploading === 'ogImageSquare' ? 'Uploading...' : 'Upload Square'}</span>
                    <input
                      id="generalsettings-377"
                      name="generalsettings377"
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg"
                      onChange={(e) => handleFileUpload(e, 'ogImageSquare')}
                      disabled={uploading === 'ogImageSquare'}
                    />
                  </label>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Rec: <strong>500x500</strong> (&lt;300KB).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* New Fields: Domain & Timezone */}
        <div className="md:col-span-2">
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Domain URL
          </span>
          <input
            aria-label="Domain URL"
            id="generalsettings-398"
            name="generalsettings398"
            type="url"
            value={settings.domainUrl || ''}
            onChange={(e) => onChange('domainUrl', e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white"
            placeholder="https://example.com"
          />
          <p className="text-xs text-slate-500 mt-1">
            The full URL of your site (e.g., https://mysite.com).
          </p>
        </div>
        <div>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Time Zone
          </span>
          <select
            id="generalsettings-413"
            name="generalsettings413"
            aria-label="Time Zone"
            value={settings.timeZone || 'UTC'}
            onChange={(e) => onChange('timeZone', e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white"
          >
            <option value="UTC">UTC (GMT+0)</option>
            <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
            <option value="Africa/Johannesburg">Africa/Johannesburg (GMT+2)</option>
            <option value="Africa/Lagos">Africa/Lagos (GMT+1)</option>
            <option value="Africa/Nairobi">Africa/Nairobi (GMT+3)</option>
            <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
            <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
            <option value="Asia/Jerusalem">Asia/Jerusalem (GMT+2/3)</option>
            <option value="Europe/London">Europe/London (GMT+0/1)</option>
            <option value="Europe/Paris">Europe/Paris (GMT+1/2)</option>
            <option value="Europe/Istanbul">Europe/Istanbul (GMT+3)</option>
            <option value="Asia/Karachi">Asia/Karachi (GMT+5)</option>
            <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
            <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
            <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
            <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (GMT+8)</option>
            <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
            <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
            <option value="Asia/Seoul">Asia/Seoul (GMT+9)</option>
            <option value="Australia/Sydney">Australia/Sydney (GMT+10/11)</option>
            <option value="Pacific/Auckland">Pacific/Auckland (GMT+12/13)</option>
            <option value="America/New_York">America/New_York (GMT-5/-4)</option>
            <option value="America/Chicago">America/Chicago (GMT-6/-5)</option>
            <option value="America/Denver">America/Denver (GMT-7/-6)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (GMT-8/-7)</option>
            <option value="America/Anchorage">America/Anchorage (GMT-9/-8)</option>
            <option value="America/Sao_Paulo">America/Sao_Paulo (GMT-3/-2)</option>
            <option value="Pacific/Honolulu">Pacific/Honolulu (GMT-10)</option>
          </select>
        </div>
        {/* SMTP Email Configuration */}
        <div className="md:col-span-2 border-t border-slate-200 dark:border-[#2a2b36] pt-6 mt-2">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email / SMTP Configuration
          </h4>
          {!canManageSecrets ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
              SMTP credentials are protected and can only be viewed or changed by the primary
              administrator.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Host
                </span>
                <input
                  aria-label="SMTP Host"
                  id="generalsettings-467"
                  name="generalsettings467"
                  type="text"
                  value={(settings as any).smtpHost || ''}
                  onChange={(e) => onChange('smtpHost', e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Port
                </span>
                <input
                  id="generalsettings-479"
                  name="generalsettings479"
                  aria-label="SMTP Port"
                  type="number"
                  value={(settings as any).smtpPort || 587}
                  onChange={(e) => onChange('smtpPort', parseInt(e.target.value) || 587)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                  placeholder="587"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Username / Email
                </span>
                <input
                  aria-label="SMTP Username / Email"
                  id="generalsettings-491"
                  name="generalsettings491"
                  type="email"
                  value={(settings as any).smtpUser || ''}
                  onChange={(e) => onChange('smtpUser', e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Password
                </span>
                <input
                  id="generalsettings-503"
                  name="generalsettings503"
                  aria-label="SMTP Password"
                  type="password"
                  value={(settings as any).smtpPass || ''}
                  onChange={(e) => onChange('smtpPass', e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Encryption
                </span>
                <select
                  aria-label="Encryption"
                  id="generalsettings-515"
                  name="generalsettings515"
                  value={(settings as any).smtpEncryption || 'tls'}
                  onChange={(e) => onChange('smtpEncryption', e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                >
                  <option value="tls">TLS (Recommended)</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  From Name
                </span>
                <input
                  id="generalsettings-529"
                  name="generalsettings529"
                  aria-label="From Name"
                  type="text"
                  value={(settings as any).smtpFromName || ''}
                  onChange={(e) => onChange('smtpFromName', e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                  placeholder="My Website"
                />
              </div>
            </div>
          )}
          {canManageSecrets && (
            <p className="text-xs text-slate-500 mt-3">
              Configure SMTP for email verification and notifications. For Gmail, use App Password
              instead of regular password.
            </p>
          )}
        </div>
        <div>
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Posts Per Page
          </span>
          <input
            aria-label="Posts Per Page"
            id="generalsettings-547"
            name="generalsettings547"
            type="number"
            min="6"
            max="50"
            value={postsPerPageLocal}
            onChange={(e) => setPostsPerPageLocal(e.target.value)}
            onBlur={handlePostsPerPageBlur}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white"
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            id="generalsettings-558"
            name="generalsettings558"
            aria-label="Maintenance mode"
            type="checkbox"
            checked={settings.maintenanceMode}
            onChange={(e) => onChange('maintenanceMode', e.target.checked)}
            className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Maintenance Mode
          </span>
        </div>{' '}
        <div className="flex items-center gap-3">
          <input
            aria-label="Maintenance Mode"
            id="generalsettings-569"
            name="generalsettings569"
            type="checkbox"
            checked={settings.discussionEnabled ?? true}
            onChange={(e) => onChange('discussionEnabled', e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Allow Public Discussion on Posts
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="generalsettings-580"
            name="generalsettings580"
            aria-label="Allow Public Discussion on Posts"
            type="checkbox"
            checked={settings.registrationEnabled ?? true}
            onChange={(e) => onChange('registrationEnabled', e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Membership: Anyone can register
          </span>
        </div>
        {/* Spam Keywords */}
        <div className="md:col-span-2">
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Spam Keywords (Auto-Moderation)
          </span>
          <textarea
            aria-label="Spam Keywords (Auto-Moderation)"
            id="generalsettings-595"
            name="generalsettings595"
            rows={3}
            value={
              (settings as any).spamKeywords ||
              'viagra, cialis, casino, lottery, prize winner, click here, buy now, free money, make money fast, earn extra cash, work from home, crypto investment, bitcoin profit, forex trading, adult content, xxx, nigerian prince, wire transfer, western union'
            }
            onChange={(e) => onChange('spamKeywords', e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white font-mono text-sm"
            placeholder="viagra, casino, buy now, ..."
          />
          <p className="text-xs text-slate-500 mt-1">
            Comma-separated keywords. Comments containing these will be held for review.
          </p>
        </div>
        {/* Share Buttons - Native react-share (no third-party script needed) */}
        <div>
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Share Buttons Placement
          </span>
          <select
            id="generalsettings-614"
            name="generalsettings614"
            aria-label="Share Buttons Placement"
            value={settings.sharePlacement || 'bottom'}
            onChange={(e) => onChange('sharePlacement', e.target.value)}
            className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white"
          >
            <option value="none">Disabled</option>
            <option value="top">Top of post</option>
            <option value="bottom">Bottom of post</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">Choose where share buttons appear on posts.</p>
        </div>
      </div>
    </div>
  );
};
