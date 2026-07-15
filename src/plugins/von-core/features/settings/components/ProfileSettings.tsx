import React from 'react';
import { SiteSettings } from '../../../../../types';

interface ProfileSettingsProps {
  settings: SiteSettings;
  onChange: (key: string, value: any) => void;
  readOnly?: boolean;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  settings,
  onChange,
  readOnly = false,
}) => {
  const profile = settings.adminProfile || { name: '', email: '', bio: '', avatar: '' };
  const fieldClass = `w-full p-3 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white ${
    readOnly ? 'cursor-not-allowed opacity-75' : ''
  }`;

  const handleProfileChange = (field: string, value: string) => {
    if (readOnly) return;
    onChange('adminProfile', { ...profile, [field]: value });
  };

  return (
    <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-6 animate-fade-in">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-[#2a2b36] pb-2">
        Admin Profile
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        This information may be displayed in the "About Author" widget or contact sections.
      </p>

      <div className="grid grid-cols-1 gap-6">
        <div>
          <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Display Name
          </span>
          <input
            aria-label="Display Name"
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
            type="url"
            value={profile.avatar || ''}
            disabled={readOnly}
            onChange={(e) => handleProfileChange('avatar', e.target.value)}
            className={fieldClass}
            placeholder="https://example.com/avatar.jpg"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
