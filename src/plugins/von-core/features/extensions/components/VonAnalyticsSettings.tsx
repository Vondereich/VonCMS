import React, { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { X, Save, BarChart3, Globe, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminModal from '../../../../../components/admin/AdminModal';

interface VonAnalyticsSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => boolean | Promise<boolean>;
  onClose: () => void;
}

export const VonAnalyticsSettings: React.FC<VonAnalyticsSettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const initialAnalytics = settings.analytics || {
    cookieConsent: false,
  };

  const [tempAnalytics, setTempAnalytics] = useState(initialAnalytics);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await onUpdate({
        ...settings,
        analytics: {
          ...settings.analytics,
          cookieConsent: tempAnalytics.cookieConsent,
        },
      });
      if (saved === false) {
        setIsSaving(false);
        return;
      }

      toast.success('Analytics settings saved!');
      onClose();
    } catch (error) {
      toast.error('Failed to save settings');
      setIsSaving(false);
    }
  };

  return (
    <AdminModal
      isOpen
      onClose={onClose}
      ariaLabel="Analytics and privacy settings"
      className="w-full max-w-4xl"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-[#16161e] sm:max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-linear-to-r from-blue-50 to-purple-50 p-4 dark:border-white/10 dark:from-slate-900 dark:to-slate-900 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white sm:text-2xl">
              <BarChart3 className="text-blue-600" size={28} />
              Native Analytics & Privacy
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              CMS traffic insights and visitor privacy control
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-600 dark:hover:bg-[#242633] dark:hover:text-slate-300"
            aria-label="Close analytics settings"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Native Analytics Info */}
          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold mb-1 text-blue-900 dark:text-blue-300">
                  Native Tracking Active
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  VonCMS is currently recording visitors, top pages, and unique hits directly to
                  your local database.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="text-center px-4 py-2 bg-white dark:bg-[#1a1b26] rounded-lg border border-blue-100 dark:border-blue-700">
                    <span className="block text-xs text-slate-500 uppercase font-bold">
                      Data Retention
                    </span>
                    <span className="text-sm font-bold text-blue-600">30 Days</span>
                  </div>
                  <div className="text-center px-4 py-2 bg-white dark:bg-[#1a1b26] rounded-lg border border-blue-100 dark:border-blue-700">
                    <span className="block text-xs text-slate-500 uppercase font-bold">
                      Privacy
                    </span>
                    <span className="text-sm font-bold text-blue-600">IP Hashing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Options */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe size={18} />
              Privacy & Compliance
            </h3>

            {/* Cookie Consent */}
            <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-[#2a2b36] rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26] transition-colors">
              <input
                id="vonanalyticssettings-105"
                name="vonanalyticssettings105"
                type="checkbox"
                checked={tempAnalytics.cookieConsent}
                onChange={(e) =>
                  setTempAnalytics({ ...tempAnalytics, cookieConsent: e.target.checked })
                }
                className="w-5 h-5 text-blue-600 rounded-sm focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  Require Cookie Consent Banner
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Native visitor analytics and built-in Google Analytics wait for consent. Aggregate
                  post and page view counters continue without identifying visitor details. This
                  does not by itself guarantee legal compliance.
                </p>
              </div>
            </label>
          </div>

          {/* GA Direction Box */}
          <div className="bg-slate-100 dark:bg-[#1a1b26] border border-slate-200 dark:border-[#2a2b36] rounded-lg p-4">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertCircle size={16} className="text-slate-500" />
              Looking for Google Analytics?
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              GA4 tracking IDs and advanced external analytics settings have been moved to the{' '}
              <strong>System Settings &gt; Google</strong> tab for better consolidation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="admin-safe-bottom flex flex-col-reverse justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#16161e] sm:flex-row sm:p-6">
          <button
            onClick={onClose}
            className="min-h-11 w-full px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-lg font-medium transition-colors sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 py-2.5 font-medium text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-700 sm:w-auto ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </AdminModal>
  );
};
