import React, { useState } from 'react';
import { SiteSettings } from '../../../../../../types';
import { Palette, X, Save, Type, FileText, CheckCircle, Mail, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import { SafeImage } from '../../../../../../components/SafeImage';

interface CorporateProSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => void;
  onClose: () => void;
}

export const CorporateProSettings: React.FC<CorporateProSettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'hero' | 'services' | 'about' | 'cta' | 'footer'>(
    'hero'
  );

  const [tempSettings, setTempSettings] = useState({
    heroTitle: settings.theme?.corporatePro?.heroTitle || '',
    heroText: settings.theme?.corporatePro?.heroText || '',
    heroImage: settings.theme?.corporatePro?.heroImage || '',
    aboutImage: settings.theme?.corporatePro?.aboutImage || '',
    showServices: settings.theme?.corporatePro?.showServices !== false,
    showPosts: settings.theme?.corporatePro?.showPosts !== false,
    // Services
    servicesTitle: settings.theme?.corporatePro?.servicesTitle || 'Our Premium Services',
    servicesSubtitle:
      settings.theme?.corporatePro?.servicesSubtitle ||
      'Comprehensive layouts and features designed for your success.',
    service1Title: settings.theme?.corporatePro?.service1Title || 'Strategic Planning',
    service1Desc:
      settings.theme?.corporatePro?.service1Desc ||
      'Expert guidance to define your business roadmap and achieve long-term goals.',
    service1Icon: settings.theme?.corporatePro?.service1Icon || 'Target',
    service1Link: settings.theme?.corporatePro?.service1Link || '#',
    service2Title: settings.theme?.corporatePro?.service2Title || 'Digital Transformation',
    service2Desc:
      settings.theme?.corporatePro?.service2Desc ||
      'Modernize your operations with cutting-edge technology solutions.',
    service2Icon: settings.theme?.corporatePro?.service2Icon || 'Cpu',
    service2Link: settings.theme?.corporatePro?.service2Link || '#',
    service3Title: settings.theme?.corporatePro?.service3Title || 'Market Analysis',
    service3Desc:
      settings.theme?.corporatePro?.service3Desc ||
      'In-depth insights into market trends to keep you ahead of the competition.',
    service3Icon: settings.theme?.corporatePro?.service3Icon || 'BarChart',
    service3Link: settings.theme?.corporatePro?.service3Link || '#',
    // About & Stats
    aboutTitle:
      settings.theme?.corporatePro?.aboutTitle || 'Leading the Way in Corporate Excellence',
    aboutSubtitle:
      settings.theme?.corporatePro?.aboutSubtitle ||
      'With over a decade of experience, we help businesses navigate the complex landscape of modern commerce.',
    aboutStat1Number: settings.theme?.corporatePro?.aboutStat1Number || '500+',
    aboutStat1Label: settings.theme?.corporatePro?.aboutStat1Label || 'Clients Served',
    aboutStat2Number: settings.theme?.corporatePro?.aboutStat2Number || '98%',
    aboutStat2Label: settings.theme?.corporatePro?.aboutStat2Label || 'Satisfaction Rate',
    // CTA
    ctaTitle: settings.theme?.corporatePro?.ctaTitle || 'Ready to Transform Your Business?',
    ctaSubtitle:
      settings.theme?.corporatePro?.ctaSubtitle ||
      'Join hundreds of successful companies that trust us with their corporate strategy.',
    ctaButtonText: settings.theme?.corporatePro?.ctaButtonText || 'Start Your Project Today',
    ctaButtonLink: settings.theme?.corporatePro?.ctaButtonLink || '#',
    // Hero Buttons
    heroPrimaryLink: settings.theme?.corporatePro?.heroPrimaryLink || '#',
    heroSecondaryLink: settings.theme?.corporatePro?.heroSecondaryLink || '#',
    newsLink: settings.theme?.corporatePro?.newsLink || '#',
    // Footer
    footerAbout:
      settings.theme?.corporatePro?.footerAbout ||
      'Defining standards in corporate web solutions. Built for performance and reliability.',
    contactEmail: settings.theme?.corporatePro?.contactEmail || 'info@corporatepro.com',
    contactPhone: settings.theme?.corporatePro?.contactPhone || '+1 (555) 123-4567',
    contactAddress: settings.theme?.corporatePro?.contactAddress || 'Business District, City',
  });

  const handleSave = () => {
    onUpdate({
      ...settings,
      theme: {
        ...settings.theme,
        corporatePro: tempSettings,
      },
    });
    toast.success('Corporate Pro settings saved!');
    onClose();
  };

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: typeof activeTab;
    label: string;
    icon: any;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center justify-center w-full gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
        activeTab === id
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#242633]'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1a1b26] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center bg-white dark:bg-[#1a1b26] z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palette size={24} className="text-blue-600" />
              Corporate Pro Customizer
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Fully customize every section of your business theme
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#242633] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-[#2a2b36] grid grid-cols-5 gap-2 bg-slate-50/50 dark:bg-[#16161e]/20">
          <TabButton id="hero" label="Hero" icon={Type} />
          <TabButton id="services" label="Services" icon={CheckCircle} />
          <TabButton id="about" label="About & Stats" icon={FileText} />
          <TabButton id="cta" label="Call to Action" icon={Palette} />
          <TabButton id="footer" label="Footer & Contact" icon={Mail} />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {/* === HERO SECTION === */}
          {activeTab === 'hero' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Type size={16} /> Manage the main landing section of your homepage.
                </p>
              </div>
              <div className="grid gap-6">
                <InputField
                  label="Hero Headline"
                  value={tempSettings.heroTitle}
                  onChange={(v) => setTempSettings({ ...tempSettings, heroTitle: v })}
                  placeholder="Elevate Your Business to Next Level"
                />
                <TextAreaField
                  label="Hero Sub-headline"
                  value={tempSettings.heroText}
                  onChange={(v) => setTempSettings({ ...tempSettings, heroText: v })}
                  placeholder="We provide cutting-edge solutions..."
                />
                <ImagePickerField
                  label="Hero Background Image"
                  value={tempSettings.heroImage}
                  onChange={(v) => setTempSettings({ ...tempSettings, heroImage: v })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Primary Button Link (Get Quote)"
                    value={tempSettings.heroPrimaryLink}
                    onChange={(v) => setTempSettings({ ...tempSettings, heroPrimaryLink: v })}
                    placeholder="#"
                  />
                  <InputField
                    label="Secondary Button Link (Learn More)"
                    value={tempSettings.heroSecondaryLink}
                    onChange={(v) => setTempSettings({ ...tempSettings, heroSecondaryLink: v })}
                    placeholder="#"
                  />
                </div>

                {/* Section Visibility Toggles */}
                <div className="bg-slate-50 dark:bg-[#16161e]/40 p-5 rounded-xl border border-slate-100 dark:border-[#2a2b36] mt-4">
                  <h4 className="font-bold text-sm text-slate-400 uppercase tracking-widest mb-4">
                    Section Visibility
                  </h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        id="corporateprosettings-196"
                        name="corporateprosettings196"
                        type="checkbox"
                        checked={tempSettings.showServices}
                        onChange={(e) =>
                          setTempSettings({ ...tempSettings, showServices: e.target.checked })
                        }
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Show Services Section
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        id="corporateprosettings-209"
                        name="corporateprosettings209"
                        type="checkbox"
                        checked={tempSettings.showPosts}
                        onChange={(e) =>
                          setTempSettings({ ...tempSettings, showPosts: e.target.checked })
                        }
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Show Latest Posts / Blog Section
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === SERVICES SECTION === */}
          {activeTab === 'services' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Section Title"
                  value={tempSettings.servicesTitle}
                  onChange={(v) => setTempSettings({ ...tempSettings, servicesTitle: v })}
                />
                <InputField
                  label="Section Subtitle"
                  value={tempSettings.servicesSubtitle}
                  onChange={(v) => setTempSettings({ ...tempSettings, servicesSubtitle: v })}
                />
              </div>
              <hr className="border-slate-100 dark:border-[#2a2b36] my-4" />
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-slate-50 dark:bg-[#16161e]/40 p-5 rounded-xl border border-slate-100 dark:border-[#2a2b36] space-y-4"
                >
                  <h4 className="font-bold text-sm text-slate-400 uppercase tracking-widest">
                    Service Item {i}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Title"
                      value={(tempSettings as any)[`service${i}Title`]}
                      onChange={(v) =>
                        setTempSettings({ ...tempSettings, [`service${i}Title`]: v })
                      }
                    />
                    <InputField
                      label="Icon (Lucide name)"
                      value={(tempSettings as any)[`service${i}Icon`]}
                      onChange={(v) => setTempSettings({ ...tempSettings, [`service${i}Icon`]: v })}
                    />
                  </div>
                  <InputField
                    label="Link URL"
                    value={(tempSettings as any)[`service${i}Link`]}
                    onChange={(v) => setTempSettings({ ...tempSettings, [`service${i}Link`]: v })}
                    placeholder="#"
                  />
                  <TextAreaField
                    label="Description"
                    value={(tempSettings as any)[`service${i}Desc`]}
                    onChange={(v) => setTempSettings({ ...tempSettings, [`service${i}Desc`]: v })}
                    rows={2}
                  />
                </div>
              ))}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                <InputField
                  label="News Section 'View All' Link"
                  value={tempSettings.newsLink}
                  onChange={(v) => setTempSettings({ ...tempSettings, newsLink: v })}
                  placeholder="/blog"
                />
              </div>
            </div>
          )}

          {/* === ABOUT SECTION === */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-fade-in">
              <InputField
                label="About Headline"
                value={tempSettings.aboutTitle}
                onChange={(v) => setTempSettings({ ...tempSettings, aboutTitle: v })}
              />
              <TextAreaField
                label="About Description"
                value={tempSettings.aboutSubtitle}
                onChange={(v) => setTempSettings({ ...tempSettings, aboutSubtitle: v })}
              />
              <ImagePickerField
                label="Showcase Image"
                value={tempSettings.aboutImage}
                onChange={(v) => setTempSettings({ ...tempSettings, aboutImage: v })}
              />
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="bg-slate-50 dark:bg-[#16161e]/40 p-4 rounded-xl border border-slate-100 dark:border-[#2a2b36] space-y-3">
                  <h4 className="font-bold text-xs text-blue-600 uppercase tracking-widest">
                    Statistic 1
                  </h4>
                  <InputField
                    label="Number"
                    value={tempSettings.aboutStat1Number}
                    onChange={(v) => setTempSettings({ ...tempSettings, aboutStat1Number: v })}
                  />
                  <InputField
                    label="Label"
                    value={tempSettings.aboutStat1Label}
                    onChange={(v) => setTempSettings({ ...tempSettings, aboutStat1Label: v })}
                  />
                </div>
                <div className="bg-slate-50 dark:bg-[#16161e]/40 p-4 rounded-xl border border-slate-100 dark:border-[#2a2b36] space-y-3">
                  <h4 className="font-bold text-xs text-blue-600 uppercase tracking-widest">
                    Statistic 2
                  </h4>
                  <InputField
                    label="Number"
                    value={tempSettings.aboutStat2Number}
                    onChange={(v) => setTempSettings({ ...tempSettings, aboutStat2Number: v })}
                  />
                  <InputField
                    label="Label"
                    value={tempSettings.aboutStat2Label}
                    onChange={(v) => setTempSettings({ ...tempSettings, aboutStat2Label: v })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* === CTA SECTION === */}
          {activeTab === 'cta' && (
            <div className="space-y-6 animate-fade-in">
              <InputField
                label="CTA Title"
                value={tempSettings.ctaTitle}
                onChange={(v) => setTempSettings({ ...tempSettings, ctaTitle: v })}
              />
              <TextAreaField
                label="CTA Subtitle"
                value={tempSettings.ctaSubtitle}
                onChange={(v) => setTempSettings({ ...tempSettings, ctaSubtitle: v })}
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Button Text"
                  value={tempSettings.ctaButtonText}
                  onChange={(v) => setTempSettings({ ...tempSettings, ctaButtonText: v })}
                />
                <InputField
                  label="Button Link URL"
                  value={tempSettings.ctaButtonLink}
                  onChange={(v) => setTempSettings({ ...tempSettings, ctaButtonLink: v })}
                  placeholder="#"
                />
              </div>
            </div>
          )}

          {/* === FOOTER SECTION === */}
          {activeTab === 'footer' && (
            <div className="space-y-6 animate-fade-in">
              <TextAreaField
                label="Footer About Text"
                value={tempSettings.footerAbout}
                onChange={(v) => setTempSettings({ ...tempSettings, footerAbout: v })}
                rows={3}
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Contact Email"
                  value={tempSettings.contactEmail}
                  onChange={(v) => setTempSettings({ ...tempSettings, contactEmail: v })}
                />
                <InputField
                  label="Contact Phone"
                  value={tempSettings.contactPhone}
                  onChange={(v) => setTempSettings({ ...tempSettings, contactPhone: v })}
                />
              </div>
              <InputField
                label="Office Address"
                value={tempSettings.contactAddress}
                onChange={(v) => setTempSettings({ ...tempSettings, contactAddress: v })}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-[#2a2b36] flex justify-end items-center gap-3 bg-slate-50 dark:bg-[#16161e]/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#242633] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Helper Components ---

const InputField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <div>
    <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
      {label}
    </span>
    <input
      aria-label={label}
      id="corporateprosettings-440"
      name="corporateprosettings440"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
    />
  </div>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) => (
  <div>
    <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
      {label}
    </span>
    <textarea
      id="corporateprosettings-467"
      name="corporateprosettings467"
      aria-label="Text Content"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
    />
  </div>
);

const ImagePickerField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div>
    <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
      {label}
    </span>
    <div className="flex gap-2">
      <input
        id="corporateprosettings-491"
        name="corporateprosettings491"
        aria-label={`${label} URL`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
      <div className="w-12 h-12 rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-slate-100 dark:bg-[#1a1b26] overflow-hidden flex-shrink-0">
        <SafeImage
          src={value}
          className="w-full h-full object-cover"
          alt="Preview"
          fallback={
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Image size={24} />
            </div>
          }
        />
      </div>
    </div>
  </div>
);
