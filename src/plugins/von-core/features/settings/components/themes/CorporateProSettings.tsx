import React, { useRef, useState } from 'react';
import {
  Layers,
  Palette,
  X,
  Save,
  Type,
  FileText,
  CheckCircle,
  Mail,
  Newspaper,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { SiteSettings } from '../../../../../../types';
import AdminModal from '../../../../../../components/admin/AdminModal';
import {
  buildCorporateSettingsUpdate,
  createCorporateSettingsDraft,
  getCorporateHomeSections,
  type CorporateProConfig,
} from '../../../../../../themes/corporate-pro/config';
import LayoutPanel from '../../../../../../themes/corporate-pro/settings/LayoutPanel';
import ContentPanel from '../../../../../../themes/corporate-pro/settings/ContentPanel';
import type { ContentTab } from '../../../../../../themes/corporate-pro/settings/ContentPanel';
import { getThemeAppearance } from '../../../../../../themes/shared/themeSettings';

interface CorporateProSettingsProps {
  settings: SiteSettings;
  onUpdate: (settings: SiteSettings) => boolean | Promise<boolean>;
  onClose: () => void;
}

const TABS = [
  { id: 'layout', label: 'Layout', icon: Layers },
  { id: 'hero', label: 'Hero', icon: Type },
  { id: 'services', label: 'Services', icon: CheckCircle },
  { id: 'about', label: 'About & Stats', icon: FileText },
  { id: 'posts', label: 'Latest Posts', icon: Newspaper },
  { id: 'cta', label: 'Call to Action', icon: ArrowRight },
  { id: 'footer', label: 'Footer', icon: Mail },
] as const;

export const CorporateProSettings: React.FC<CorporateProSettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'layout' | ContentTab>('layout');
  const [baseline] = useState<CorporateProConfig>(() => ({
    ...getThemeAppearance(settings, 'corporatePro'),
    ...createCorporateSettingsDraft(settings.theme.corporatePro),
  }));
  const [tempSettings, setTempSettings] = useState(baseline);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const panelTitleId = React.useId();

  const handleClose = () => {
    if (!savingRef.current) onClose();
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const nextSettings = buildCorporateSettingsUpdate(settings, baseline, tempSettings);
    if (getCorporateHomeSections(nextSettings.theme.corporatePro).length === 0) {
      toast.error('Keep at least one homepage section visible.');
      setActiveTab('layout');
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    try {
      const saved = await onUpdate(nextSettings);
      if (saved === false) return;
      toast.success('Corporate Pro settings saved!');
      onClose();
    } catch {
      toast.error('Unable to save Corporate Pro settings. Please try again.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <AdminModal
      isOpen
      onClose={handleClose}
      ariaLabel="Corporate Pro theme settings"
      className="w-full max-w-4xl"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-admin-panel sm:max-h-[90dvh]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-admin-border sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white sm:text-2xl">
              <Palette size={24} className="text-blue-600" /> Corporate Pro Customizer
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Arrange your homepage and edit each section in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close Corporate Pro settings"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-admin-hover"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav
            aria-label="Corporate Pro sections"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 p-3 dark:border-admin-border dark:bg-admin-canvas/40 sm:w-44 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'true' : undefined}
                aria-controls={panelTitleId}
                className={`flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${activeTab === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-admin-hover'}`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
          <div
            id={panelTitleId}
            className="custom-scrollbar min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"
            aria-busy={isSaving}
          >
            <fieldset disabled={isSaving} className="min-w-0">
              {activeTab === 'layout' ? (
                <LayoutPanel value={tempSettings} onChange={setTempSettings} />
              ) : (
                <ContentPanel tab={activeTab} value={tempSettings} onChange={setTempSettings} />
              )}
            </fieldset>
          </div>
        </div>
        <div className="admin-safe-bottom flex flex-col-reverse justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 dark:border-admin-border dark:bg-admin-canvas/50 sm:flex-row sm:items-center sm:p-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="min-h-11 w-full rounded-lg px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-admin-hover sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </AdminModal>
  );
};
