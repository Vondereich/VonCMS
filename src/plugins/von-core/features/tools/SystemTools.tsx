import React, { useState } from 'react';
import { Shield, Hammer, CheckCircle, AlertCircle, Loader2, Activity, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';

export const SystemTools: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const runTool = async (apiPath: string, label: string) => {
    if (loading) return;
    setLoading(label);
    setResults(null);
    try {
      const res = await vonFetch(apiPath, {
        method: 'POST',
      });
      const data = await res.json();
      setResults(data);
      if (data.success || !data.error) {
        toast.success(`${label} completed successfully!`);
      } else {
        toast.error(data.error || `${label} failed.`);
      }
    } catch (err) {
      toast.error(`System error while running ${label}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
              <Shield size={24} />
            </div>
            <h3 className="text-lg font-bold dark:text-white mb-2">Check System Integrity</h3>
            <p className="text-slate-500 text-sm mb-4">
              Runs a read-only health check for the VonCMS managed `.htaccess` block and Uploads
              Shield. No files are modified by this tool.
            </p>
          </div>
          <button
            onClick={() => runTool(API.fixIntegrity, 'Integrity Check')}
            disabled={!!loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading === 'Integrity Check' ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Shield size={18} />
            )}
            Run Integrity Check
          </button>
        </div>

        <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
              <Hammer size={24} />
            </div>
            <h3 className="text-lg font-bold dark:text-white mb-2">Repair .htaccess</h3>
            <p className="text-slate-500 text-sm mb-4">
              Rebuilds the VonCMS-managed `.htaccess` block and repairs the Uploads Shield when
              needed. Use this only when routing or protection files are broken.
            </p>
          </div>
          <button
            onClick={() => runTool(API.repairHtaccess, 'Repair .htaccess')}
            disabled={!!loading}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading === 'Repair .htaccess' ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Hammer size={18} />
            )}
            Repair .htaccess
          </button>
        </div>

        <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
              <Activity size={24} />
            </div>
            <h3 className="text-lg font-bold dark:text-white mb-2">Repair Database Schema</h3>
            <p className="text-slate-500 text-sm mb-4">
              Creates missing VonCMS tables, columns, and indexes after upgrades or incomplete
              installs. This is a schema repair tool, not a low-level MySQL corruption recovery
              tool.
            </p>
          </div>
          <button
            onClick={() => runTool(API.repairDb, 'Repair Database')}
            disabled={!!loading}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading === 'Repair Database' ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Activity size={18} />
            )}
            Start Schema Repair
          </button>
        </div>

        <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold dark:text-white mb-2">Clear Public Cache</h3>
            <p className="text-slate-500 text-sm mb-4">
              Clears cached guest JSON for public posts and settings. Admin, drafts, previews, and
              write routes are never cached by this tool.
            </p>
          </div>
          <button
            onClick={() => runTool(API.clearPublicCache, 'Clear Public Cache')}
            disabled={!!loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading === 'Clear Public Cache' ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Trash2 size={18} />
            )}
            Clear Public Cache
          </button>
        </div>
      </div>

      {results && (
        <div className="bg-[#101018] rounded-xl border border-white/10 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-slate-400 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
              <Activity size={16} /> Tool Execution Logs
            </h4>
            {results.error ? (
              <span className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle size={14} /> Failed
              </span>
            ) : (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <CheckCircle size={14} /> Success
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-sm">
            {Object.entries(results).map(([key, value]: [string, any]) => (
              <div key={key} className="border-b border-white/10 pb-2 last:border-0">
                <span className="text-blue-400 mr-2">[{key.toUpperCase()}]</span>
                <span className="text-slate-300">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
