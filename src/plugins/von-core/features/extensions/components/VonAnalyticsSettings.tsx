import React, { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { X, Save, BarChart3, Globe, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface VonAnalyticsSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => Promise<void> | void;
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
      await onUpdate({
        ...settings,
        analytics: {
          ...settings.analytics,
          cookieConsent: tempAnalytics.cookieConsent,
        },
      });
      toast.success('Analytics settings saved!');
      onClose();
    } catch (error) {
      toast.error('Failed to save settings');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-[#16161e] w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-900">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="text-blue-600" size={28} />
              Native Analytics & Privacy
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              CMS traffic insights and visitor privacy control
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Native Analytics Info */}
          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold mb-1 text-blue-900 dark:text-blue-300">
                  Native Tracking Active
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  VonCMS is currently recording visitors, top pages, and unique hits directly to
                  your local database.
                </p>
                <div className="mt-3 flex gap-4">
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
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  Require Cookie Consent Banner
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Only track after user accepts cookies (GDPR/EU Compliant). This applies to both
                  Native Analytics and external scripts like Google Analytics.
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
    </div>
  );
};
