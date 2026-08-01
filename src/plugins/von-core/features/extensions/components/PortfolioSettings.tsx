import { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminModal from '../../../../../components/admin/AdminModal';

interface PortfolioSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => boolean | Promise<boolean>;
  onClose: () => void;
}

// Portfolio config type
interface PortfolioConfig {
  heroStyle: 'fullscreen' | 'split' | 'minimal';
  heroWelcomeText: string;
  heroButtonText: string;
  projectsTitle: string;
  projectsSubtitle: string;
  projectColumns: 2 | 3 | 4;
  animationStyle: 'fade' | 'slide' | 'none';
  accentColor: string;
  // Social Links
  githubUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  dribbbleUrl: string;
  instagramUrl: string;
  websiteUrl: string;
}

const defaultConfig: PortfolioConfig = {
  heroStyle: 'fullscreen',
  heroWelcomeText: 'Welcome to my portfolio',
  heroButtonText: 'View My Work',
  projectsTitle: 'Featured Projects',
  projectsSubtitle: 'A showcase of my best work across design, development, and creative projects',
  projectColumns: 3,
  animationStyle: 'fade',
  accentColor: '#8B5CF6',
  // Social Links - empty by default
  githubUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
  dribbbleUrl: '',
  instagramUrl: '',
  websiteUrl: '',
};

export const PortfolioSettings: React.FC<PortfolioSettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const initialConfig: PortfolioConfig = {
    ...defaultConfig,
    ...(settings.theme?.portfolio || {}),
  };

  const [tempConfig, setTempConfig] = useState<PortfolioConfig>(initialConfig);

  const handleSave = async () => {
    const saved = await onUpdate({
      ...settings,
      theme: {
        ...settings.theme,
        portfolio: tempConfig,
      },
    });
    if (saved === false) return;

    toast.success('Portfolio settings saved!');
    onClose();
  };

  return (
    <AdminModal
      isOpen
      onClose={onClose}
      ariaLabel="Portfolio theme settings"
      className="w-full max-w-2xl"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-[#16161e] sm:max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-linear-to-r from-purple-500 to-pink-500 p-4 dark:border-white/10 sm:p-6">
          <div>
            <h2 className="text-xl font-bold text-white">Portfolio Settings</h2>
            <p className="text-sm text-white/80">Customize your portfolio showcase</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close Portfolio theme settings"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Hero Style */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Hero Style
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['fullscreen', 'split', 'minimal'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setTempConfig({ ...tempConfig, heroStyle: style })}
                  className={`p-4 rounded-lg border-2 transition-all text-center capitalize ${
                    tempConfig.heroStyle === style
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                      : 'border-slate-200 dark:border-[#2a2b36] hover:border-purple-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">
                    {style === 'fullscreen' ? '🖥️' : style === 'split' ? '📐' : '📋'}
                  </span>
                  <span className="text-sm font-medium">{style}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Accent Color
            </span>
            <div className="flex gap-3">
              <input
                aria-label="Accent Color"
                id="portfoliosettings-120"
                name="portfoliosettings120"
                type="color"
                value={tempConfig.accentColor}
                onChange={(e) => setTempConfig({ ...tempConfig, accentColor: e.target.value })}
                className="h-10 w-20 rounded-sm cursor-pointer border-0"
              />
              <input
                id="portfoliosettings-126"
                name="portfoliosettings126"
                aria-label="Accent Color"
                type="text"
                value={tempConfig.accentColor}
                onChange={(e) => setTempConfig({ ...tempConfig, accentColor: e.target.value })}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
              />
            </div>
          </div>

          {/* Text Fields Section */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-[#2a2b36]">
            <h4 className="font-bold text-sm text-slate-800 dark:text-white">Hero Section Text</h4>

            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Welcome Badge Text
              </span>
              <input
                aria-label="Welcome Badge Text"
                id="portfoliosettings-143"
                name="portfoliosettings143"
                type="text"
                value={tempConfig.heroWelcomeText}
                onChange={(e) => setTempConfig({ ...tempConfig, heroWelcomeText: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                placeholder="Welcome to my portfolio"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Button Text
              </span>
              <input
                id="portfoliosettings-156"
                name="portfoliosettings156"
                aria-label="Button Text"
                type="text"
                value={tempConfig.heroButtonText}
                onChange={(e) => setTempConfig({ ...tempConfig, heroButtonText: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                placeholder="View My Work"
              />
            </div>
          </div>

          {/* Projects Section Text */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-[#2a2b36]">
            <h4 className="font-bold text-sm text-slate-800 dark:text-white">Projects Section</h4>

            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Section Title
              </span>
              <input
                aria-label="Section Title"
                id="portfoliosettings-174"
                name="portfoliosettings174"
                type="text"
                value={tempConfig.projectsTitle}
                onChange={(e) => setTempConfig({ ...tempConfig, projectsTitle: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Section Subtitle
              </span>
              <textarea
                id="portfoliosettings-186"
                name="portfoliosettings186"
                aria-label="Section Subtitle"
                value={tempConfig.projectsSubtitle}
                onChange={(e) => setTempConfig({ ...tempConfig, projectsSubtitle: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white resize-none"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Grid Columns
              </span>
              <div className="flex gap-3">
                {([2, 3, 4] as const).map((cols) => (
                  <button
                    key={cols}
                    onClick={() => setTempConfig({ ...tempConfig, projectColumns: cols })}
                    className={`flex-1 py-3 rounded-lg border-2 font-bold transition-all ${
                      tempConfig.projectColumns === cols
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                        : 'border-slate-200 dark:border-[#2a2b36] text-slate-600 dark:text-slate-400 hover:border-purple-300'
                    }`}
                  >
                    {cols} Cols
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Social Links Section */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-[#2a2b36]">
            <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
              🔗 Social Links
              <span className="text-xs font-normal text-slate-400">(leave empty to hide)</span>
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  GitHub
                </span>
                <input
                  aria-label="GitHub"
                  id="portfoliosettings-228"
                  name="portfoliosettings228"
                  type="url"
                  value={tempConfig.githubUrl}
                  onChange={(e) => setTempConfig({ ...tempConfig, githubUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                  placeholder="https://github.com/username"
                />
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  LinkedIn
                </span>
                <input
                  id="portfoliosettings-241"
                  name="portfoliosettings241"
                  aria-label="LinkedIn"
                  type="url"
                  value={tempConfig.linkedinUrl}
                  onChange={(e) => setTempConfig({ ...tempConfig, linkedinUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Twitter / X
                </span>
                <input
                  aria-label="Twitter / X"
                  id="portfoliosettings-254"
                  name="portfoliosettings254"
                  type="url"
                  value={tempConfig.twitterUrl}
                  onChange={(e) => setTempConfig({ ...tempConfig, twitterUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                  placeholder="https://twitter.com/username"
                />
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Dribbble
                </span>
                <input
                  id="portfoliosettings-267"
                  name="portfoliosettings267"
                  aria-label="Dribbble"
                  type="url"
                  value={tempConfig.dribbbleUrl}
                  onChange={(e) => setTempConfig({ ...tempConfig, dribbbleUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                  placeholder="https://dribbble.com/username"
                />
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Instagram
                </span>
                <input
                  aria-label="Instagram"
                  id="portfoliosettings-280"
                  name="portfoliosettings280"
                  type="url"
                  value={tempConfig.instagramUrl}
                  onChange={(e) => setTempConfig({ ...tempConfig, instagramUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                  placeholder="https://instagram.com/username"
                />
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Personal Website
                </span>
                <input
                  id="portfoliosettings-293"
                  name="portfoliosettings293"
                  aria-label="Personal Website"
                  type="url"
                  value={tempConfig.websiteUrl}
                  onChange={(e) => setTempConfig({ ...tempConfig, websiteUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white"
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>

          {/* Animation Style */}
          <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-[#2a2b36]">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Animation Style
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['fade', 'slide', 'none'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setTempConfig({ ...tempConfig, animationStyle: style })}
                  className={`p-3 rounded-lg border-2 transition-all text-center capitalize ${
                    tempConfig.animationStyle === style
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                      : 'border-slate-200 dark:border-[#2a2b36] hover:border-purple-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {style === 'fade' ? '✨' : style === 'slide' ? '📤' : '⏸️'} {style}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="admin-safe-bottom flex flex-col-reverse justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#16161e] sm:flex-row sm:p-6">
          <button
            onClick={onClose}
            className="min-h-11 w-full px-5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-lg font-medium transition-colors sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-purple-600 to-pink-500 px-8 py-2 font-medium text-white shadow-lg shadow-purple-500/30 transition-opacity hover:opacity-90 sm:w-auto"
          >
            <Save size={18} /> Save Changes
          </button>
        </div>
      </div>
    </AdminModal>
  );
};
