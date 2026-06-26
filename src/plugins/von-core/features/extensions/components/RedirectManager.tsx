import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { API } from '../../../../../config/site.config';
import { vonFetch } from '../../../../../utils/api';
import {
  ArrowRight,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  Search,
  BarChart3,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

interface Redirect {
  id: number;
  source_url: string;
  target_url: string;
  redirect_type: number;
  hit_count: number;
  created_at: string;
}

interface RedirectManagerProps {
  onClose: () => void;
}

interface RedirectLoopIssue {
  type: 'self_loop' | 'cycle';
  message: string;
  paths: string[];
  ruleIds: number[];
}

interface RedirectLoopSummary {
  totalRules: number;
  localRules: number;
  issueCount: number;
  selfLoopCount: number;
  cycleCount: number;
}

export const RedirectManager: React.FC<RedirectManagerProps> = ({ onClose }) => {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Redirect | null>(null);
  const [isScanningLoops, setIsScanningLoops] = useState(false);
  const [loopSummary, setLoopSummary] = useState<RedirectLoopSummary | null>(null);
  const [loopIssues, setLoopIssues] = useState<RedirectLoopIssue[]>([]);

  // Form state
  const [sourceUrl, setSourceUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [redirectType, setRedirectType] = useState(301);

  const fetchRedirects = async () => {
    setLoading(true);
    try {
      const res = await vonFetch(`${API.listRedirects}?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setRedirects(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch redirects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedirects();
  }, [search]);

  const handleSave = async () => {
    if (!sourceUrl.trim() || !targetUrl.trim()) {
      toast.error('Please fill in both URLs');
      return;
    }

    try {
      const res = await vonFetch(API.saveRedirect, {
        method: 'POST',
        body: JSON.stringify({
          id: editing?.id || null,
          source_url: sourceUrl,
          target_url: targetUrl,
          redirect_type: redirectType,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(editing ? 'Redirect updated!' : 'Redirect created!');
        setShowModal(false);
        resetForm();
        fetchRedirects();
      } else {
        toast.error(data.message || 'Failed to save redirect');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this redirect?')) return;

    try {
      const res = await vonFetch(API.deleteRedirect, {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Redirect deleted');
        fetchRedirects();
      } else {
        toast.error(data.message || 'Failed to delete');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleEdit = (redirect: Redirect) => {
    setEditing(redirect);
    setSourceUrl(redirect.source_url);
    setTargetUrl(redirect.target_url);
    setRedirectType(redirect.redirect_type);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditing(null);
    setSourceUrl('');
    setTargetUrl('');
    setRedirectType(301);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleScanLoops = async () => {
    setIsScanningLoops(true);
    try {
      const res = await vonFetch(API.scanRedirectLoops);
      const data = await res.json();

      if (data.success) {
        const summary = (data.summary || null) as RedirectLoopSummary | null;
        const issues = (data.issues || []) as RedirectLoopIssue[];
        setLoopSummary(summary);
        setLoopIssues(issues);

        if ((summary?.issueCount || 0) > 0) {
          toast.error(`Scanner found ${summary?.issueCount || 0} redirect loop issue(s).`);
        } else {
          toast.success('No redirect loops found.');
        }
      } else {
        toast.error(data.message || 'Failed to scan redirect loops');
      }
    } catch (err) {
      toast.error('Network error while scanning redirects');
    } finally {
      setIsScanningLoops(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#16161e] w-full max-w-5xl shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-slate-900">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRight className="text-emerald-600" size={28} />
              Redirect Manager
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage 301 redirects to prevent broken links
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-[#2a2b36] flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={18} className="text-slate-400" />
            <input
              aria-label="Search redirects..."
              id="search-redirects"
              name="searchRedirects"
              type="text"
              placeholder="Search redirects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg dark:bg-[#1a1b26] dark:text-white text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchRedirects}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1b26] rounded-lg"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={handleScanLoops}
              disabled={isScanningLoops}
              className="px-4 py-2 border border-amber-200 text-amber-700 bg-amber-50 rounded-lg font-medium hover:bg-amber-100 transition-colors flex items-center gap-2 disabled:opacity-60 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
              <ShieldAlert size={18} />
              {isScanningLoops ? 'Scanning...' : 'Scan Loops'}
            </button>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Add Redirect
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loopSummary && (
            <div
              className={`mb-4 rounded-xl border p-4 ${
                loopSummary.issueCount > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">
                    {loopSummary.issueCount > 0
                      ? 'Redirect loop scanner found issues'
                      : 'Redirect loop scanner found no issues'}
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    {loopSummary.totalRules} total rule(s), {loopSummary.localRules} local rule(s),{' '}
                    {loopSummary.selfLoopCount} self-loop(s), {loopSummary.cycleCount} cycle(s)
                  </div>
                </div>
              </div>

              {loopIssues.length > 0 && (
                <div className="mt-3 space-y-2">
                  {loopIssues.slice(0, 5).map((issue, index) => (
                    <div
                      key={`${issue.type}-${issue.ruleIds.join('-')}-${index}`}
                      className="rounded-lg bg-white/70 p-3 text-xs dark:bg-[#16161e]/40"
                    >
                      <div className="font-semibold">{issue.message}</div>
                      <div className="mt-1 font-mono break-all">
                        {issue.paths.join(' -> ')}
                        {issue.type === 'cycle' ? ' -> ' + issue.paths[0] : ''}
                      </div>
                      <div className="mt-1 opacity-70">Rule IDs: {issue.ruleIds.join(', ')}</div>
                    </div>
                  ))}
                  {loopIssues.length > 5 && (
                    <div className="text-xs opacity-70">
                      Showing first 5 of {loopIssues.length} issue(s).
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : redirects.length === 0 ? (
            <div className="text-center py-12">
              <ArrowRight size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No redirects found</p>
              <p className="text-sm text-slate-400 mt-1">
                Create your first redirect to prevent 404 errors
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#2a2b36]">
                  <th className="pb-3 font-medium">From</th>
                  <th className="pb-3 font-medium">To</th>
                  <th className="pb-3 font-medium text-center">Type</th>
                  <th className="pb-3 font-medium text-center">Hits</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {redirects.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#1a1b26]/50"
                  >
                    <td className="py-3 font-mono text-xs text-red-600 dark:text-red-400">
                      {r.source_url}
                    </td>
                    <td className="py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ArrowRight size={12} />
                      {r.target_url}
                    </td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                        {r.redirect_type}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-slate-500">
                        <BarChart3 size={12} />
                        {r.hit_count}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#16161e] text-xs text-slate-500 flex justify-between">
          <span>{redirects.length} redirect(s)</span>
          <span>Total hits: {redirects.reduce((sum, r) => sum + r.hit_count, 0)}</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1a1b26] w-full max-w-lg rounded-xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editing ? 'Edit Redirect' : 'Add Redirect'}
            </h3>

            <div className="space-y-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Source URL (From)
                </span>
                <input
                  id="redirectmanager-375"
                  name="redirectmanager375"
                  aria-label="Source URL (From)"
                  type="text"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="/old-page"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-[#333544] rounded-lg dark:bg-[#242633] dark:text-white"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target URL (To)
                </span>
                <input
                  aria-label="Target URL (To)"
                  id="redirectmanager-388"
                  name="redirectmanager388"
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="/new-page or https://external.com"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-[#333544] rounded-lg dark:bg-[#242633] dark:text-white"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Redirect Type
                </span>
                <select
                  id="redirectmanager-401"
                  name="redirectmanager401"
                  aria-label="Redirect Type"
                  value={redirectType}
                  onChange={(e) => setRedirectType(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-[#333544] rounded-lg dark:bg-[#242633] dark:text-white"
                >
                  <option value={301}>301 - Permanent</option>
                  <option value={302}>302 - Temporary</option>
                  <option value={307}>307 - Temporary (Preserve Method)</option>
                  <option value={308}>308 - Permanent (Preserve Method)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#242633] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-2"
              >
                <Save size={18} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
