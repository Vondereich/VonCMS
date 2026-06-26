import React, { useState, useEffect } from 'react';
import {
  Mail,
  Settings,
  Users,
  Download,
  Trash2,
  Search,
  ToggleLeft,
  ToggleRight,
  Save,
  RefreshCw,
} from 'lucide-react';
import SmartPagination from '../../../../components/SmartPagination';
import { toast } from 'react-hot-toast';
import { SiteSettings, NewsletterSettings, NewsletterSubscriber } from '../../../../types';
import { BASE_PATH } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';

interface NewsletterManagerProps {
  settings: SiteSettings;
  onUpdateSettings: (settings: SiteSettings) => void;
}

const defaultNewsletterSettings: NewsletterSettings = {
  enabled: false,
  title: 'Subscribe to Newsletter',
  description: 'Get the latest updates delivered to your inbox.',
  buttonText: 'Subscribe',
  successMessage: 'Thank you for subscribing!',
  position: 'footer',
};

const NEWSLETTER_SUBSCRIBERS_PER_PAGE = 20;

const NewsletterManager: React.FC<NewsletterManagerProps> = ({ settings, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'subscribers'>('settings');
  const [newsletterSettings, setNewsletterSettings] = useState<NewsletterSettings>({
    ...defaultNewsletterSettings,
    ...settings.newsletter,
  });
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, unsubscribed: 0 });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);

  // Load subscribers
  const loadSubscribers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(NEWSLETTER_SUBSCRIBERS_PER_PAGE),
        search: searchQuery,
        status: statusFilter,
      });
      const res = await vonFetch(`${BASE_PATH}api/newsletter_list.php?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSubscribers(data.subscribers || []);
        setStats(data.stats || { total: 0, active: 0, unsubscribed: 0 });
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Failed to load subscribers:', error);
      toast.error('Failed to load subscribers data');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'subscribers') {
      loadSubscribers();
    }
  }, [activeTab, page, statusFilter]);

  // Reset page when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery, activeTab]);

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        newsletter: newsletterSettings,
      };
      onUpdateSettings(updatedSettings);
      toast.success('Newsletter settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  // Delete subscriber
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this subscriber?')) return;

    try {
      const res = await vonFetch(`${BASE_PATH}api/newsletter_list.php`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        loadSubscribers();
        toast.success('Subscriber deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete subscriber');
      }
    } catch (error) {
      toast.error('Failed to delete subscriber');
    }
  };

  // Export CSV
  const handleExport = async () => {
    toast.loading('Preparing CSV export...', { id: 'newsletter-export' });
    try {
      const res = await vonFetch(`${BASE_PATH}api/newsletter_export.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusFilter }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `newsletter_subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export ready!', { id: 'newsletter-export' });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to export subscribers', { id: 'newsletter-export' });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <Mail className="text-cyan-500" size={32} />
            Newsletter
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage newsletter subscriptions and settings
          </p>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-4">
          <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
            <div className="text-2xl font-bold">{stats.active}</div>
            <div className="text-xs opacity-80">Active</div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1a1b26] text-slate-700 dark:text-slate-300">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs opacity-80">Total</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-[#2a2b36]">
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Settings size={18} /> Settings
        </button>
        <button
          onClick={() => setActiveTab('subscribers')}
          className={`pb-3 px-4 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'subscribers' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={18} /> Subscribers
        </button>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-[#1a1b26] rounded-2xl border border-slate-200 dark:border-[#2a2b36] p-6 space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-800 dark:text-white">Enable Newsletter</span>
              <p className="text-sm text-slate-500">Show subscription widget on public pages</p>
            </div>
            <button
              onClick={() =>
                setNewsletterSettings({
                  ...newsletterSettings,
                  enabled: !newsletterSettings.enabled,
                })
              }
              className={`p-2 rounded-full transition-colors ${newsletterSettings.enabled ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-[#242633] text-slate-500'}`}
            >
              {newsletterSettings.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            </button>
          </div>

          <hr className="border-slate-200 dark:border-[#2a2b36]" />

          {/* Title */}
          <div>
            <span className="block font-medium text-slate-800 dark:text-white mb-2">
              Widget Title
            </span>
            <input
              aria-label="Widget Title"
              id="newslettermanager-222"
              name="newslettermanager222"
              type="text"
              value={newsletterSettings.title}
              onChange={(e) =>
                setNewsletterSettings({ ...newsletterSettings, title: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Description */}
          <div>
            <span className="block font-medium text-slate-800 dark:text-white mb-2">
              Description
            </span>
            <textarea
              id="newslettermanager-237"
              name="newslettermanager237"
              aria-label="Description"
              value={newsletterSettings.description}
              onChange={(e) =>
                setNewsletterSettings({ ...newsletterSettings, description: e.target.value })
              }
              rows={2}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Button Text & Success Message */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block font-medium text-slate-800 dark:text-white mb-2">
                Button Text
              </span>
              <input
                aria-label="Button Text"
                id="newslettermanager-253"
                name="newslettermanager253"
                type="text"
                value={newsletterSettings.buttonText}
                onChange={(e) =>
                  setNewsletterSettings({ ...newsletterSettings, buttonText: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <span className="block font-medium text-slate-800 dark:text-white mb-2">
                Success Message
              </span>
              <input
                id="newslettermanager-266"
                name="newslettermanager266"
                aria-label="Success Message"
                type="text"
                value={newsletterSettings.successMessage}
                onChange={(e) =>
                  setNewsletterSettings({ ...newsletterSettings, successMessage: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Position */}
          <div>
            <span className="block font-medium text-slate-800 dark:text-white mb-2">
              Widget Position
            </span>
            <select
              aria-label="Widget Position"
              id="newslettermanager-282"
              name="newslettermanager282"
              value={newsletterSettings.position}
              onChange={(e) =>
                setNewsletterSettings({
                  ...newsletterSettings,
                  position: e.target.value as 'footer' | 'sidebar' | 'both',
                })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-800 dark:text-white focus:ring-2 focus:ring-cyan-500"
            >
              <option value="footer">Footer Only</option>
              <option value="sidebar">Sidebar Only</option>
              <option value="both">Both Footer & Sidebar</option>
            </select>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Subscribers Tab */}
      {activeTab === 'subscribers' && (
        <div className="bg-white dark:bg-[#1a1b26] rounded-2xl border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-[#2a2b36] flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="search-email"
                  name="searchEmail"
                  aria-label="Search email..."
                  type="text"
                  placeholder="Search email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadSubscribers()}
                  className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-sm w-64"
                />
              </div>
              <select
                id="newslettermanager-332"
                name="newslettermanager332"
                aria-label="Selection"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'active' | 'unsubscribed')
                }
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadSubscribers}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#242633] flex items-center gap-2"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/30"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-[#16161e]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Subscribed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Source
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No subscribers yet
                    </td>
                  </tr>
                ) : (
                  subscribers.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1b26]/50">
                      <td className="px-6 py-4 text-slate-800 dark:text-white font-medium">
                        {sub.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${sub.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-200 text-slate-600 dark:bg-[#242633] dark:text-slate-400'}`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {new Date(sub.subscribed_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm capitalize">{sub.source}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Smart Pagination Controls */}
          <div className="p-4 border-t border-slate-200 dark:border-[#2a2b36]">
            <SmartPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(newPage) => setPage(newPage)}
              itemsPerPage={NEWSLETTER_SUBSCRIBERS_PER_PAGE}
              totalItems={stats.total}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsletterManager;
