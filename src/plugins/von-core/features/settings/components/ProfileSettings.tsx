import React from 'react';
import { SiteSettings } from '../../../../../types';

interface ProfileSettingsProps {
  settings: SiteSettings;
  onChange: import('../../../../../types').SettingsFieldChange<Pick<SiteSettings, 'adminProfile'>>;
  readOnly?: boolean;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  settings,
  onChange,
  readOnly = false,
}) => {
  const profile = settings.adminProfile || { name: '', email: '', bio: '', avatar: '' };
  const fieldClass = `w-full p-3 rounded-lg border border-slate-300 dark:border-admin-border-strong bg-slate-50 dark:bg-admin-canvas dark:text-white ${
    readOnly ? 'cursor-not-allowed opacity-75' : ''
  }`;

  const handleProfileChange = (field: string, value: string) => {
    if (readOnly) return;
    onChange('adminProfile', { ...profile, [field]: value });
  };

  return (
    <div className="bg-white dark:bg-admin-panel rounded-xl shadow-xs border border-slate-200 dark:border-admin-border p-6 space-y-6 animate-fade-in">
      <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-admin-border pb-2">
        Admin Profile
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          Public
        </span>
      </h3>
      <p className="text-sm text-slate-500 dark:text-gray-400">
        This information may be displayed in the "About Author" widget or contact sections.
      </p>
      <aside
        id="profilesettings-public-notice"
        aria-label="Public profile information"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      >
        Name, email, bio and avatar URL are public site data, even if no widget displays them. Use
        an email address you are willing to publish. Never enter private API keys, passwords or
        access tokens in these fields. This is the site's public profile, not your account's login
        or password settings.
      </aside>

      <div className="grid grid-cols-1 gap-6">
        <div>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Display Name
          </span>
          <input
            aria-label="Display Name"
            aria-describedby="profilesettings-public-notice"
            id="profilesettings-30"
            name="profilesettings30"
            type="text"
            value={profile.name}
            disabled={readOnly}
            onChange={(e) => handleProfileChange('name', e.target.value)}
            className={fieldClass}
            placeholder="e.g. John Doe"
          />
        </div>
        <div>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Public Email
          </span>
          <input
            id="profilesettings-42"
            name="profilesettings42"
            aria-label="Public Email"
            aria-describedby="profilesettings-public-notice"
            type="email"
            value={profile.email}
            disabled={readOnly}
            onChange={(e) => handleProfileChange('email', e.target.value)}
            className={fieldClass}
            placeholder="contact@example.com"
          />
        </div>
        <div>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Avatar URL
          </span>
          <input
            id="profilesettings-avatar-url"
            name="profilesettingsAvatarUrl"
            aria-label="Avatar URL"
            aria-describedby="profilesettings-public-notice"
            type="url"
            value={profile.avatar || ''}
            disabled={readOnly}
            onChange={(e) => handleProfileChange('avatar', e.target.value)}
            className={fieldClass}
            placeholder="https://example.com/avatar.jpg"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">
            Leave empty to use Gravatar from Public Email.
          </p>
        </div>
        <div>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Bio / About
          </span>
          <textarea
            id="profilesettings-54"
            name="profilesettings54"
            aria-label="Bio / About"
            aria-describedby="profilesettings-public-notice"
            rows={4}
            value={profile.bio}
            disabled={readOnly}
            onChange={(e) => handleProfileChange('bio', e.target.value)}
            className={fieldClass}
            placeholder="Tell us a little about yourself..."
          />
        </div>
      </div>
    </div>
  );
};
