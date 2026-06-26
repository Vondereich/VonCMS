import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { API } from '../../../../../config/site.config';
import { vonFetch } from '../../../../../utils/api';

interface CategorySummary {
  name: string;
  postCount: number;
}

interface CategorySettingsProps {
  onCategoriesChange?: (categories: string[]) => void;
}

export const CategorySettings: React.FC<CategorySettingsProps> = ({ onCategoriesChange }) => {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [renameTarget, setRenameTarget] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [loadingAction, setLoadingAction] = useState<'load' | 'add' | 'rename' | 'delete' | ''>(
    'load'
  );

  const refreshCategories = async (preserveSelection?: string) => {
    setLoadingAction((prev) => (prev === '' ? 'load' : prev));
    try {
      const res = await vonFetch(API.manageCategories);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to load categories');
      }

      const list = Array.isArray(data.categories) ? data.categories : [];
      setCategories(list);
      const nextNames = list.map((item: CategorySummary) => item.name);
      onCategoriesChange?.(nextNames);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('voncms:categories-updated', {
            detail: nextNames,
          })
        );
      }

      const nextSelection =
        preserveSelection && list.some((item: CategorySummary) => item.name === preserveSelection)
          ? preserveSelection
          : list[0]?.name || '';

      setSelectedCategory(nextSelection);
      setRenameTarget(nextSelection);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load categories');
    } finally {
      setLoadingAction('');
    }
  };

  useEffect(() => {
    refreshCategories();
  }, []);

  useEffect(() => {
    setRenameTarget(selectedCategory);
  }, [selectedCategory]);

  const selectedSummary = useMemo(
    () => categories.find((category) => category.name === selectedCategory) || null,
    [categories, selectedCategory]
  );

  const runAction = async (
    action: 'add' | 'rename' | 'delete',
    payload: Record<string, string>
  ) => {
    setLoadingAction(action);
    try {
      const res = await vonFetch(API.manageCategories, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || data.error || 'Category action failed');
      }

      toast.success(data.message || 'Categories updated.');
      const preserveSelection =
        action === 'delete'
          ? payload['replacement_category'] || 'Uncategorized'
          : payload['new_category'] || payload['category'] || selectedCategory;
      await refreshCategories(preserveSelection);
      if (action === 'add') {
        setNewCategory('');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Category action failed');
    } finally {
      setLoadingAction('');
    }
  };

  const normalizedRename = renameTarget.trim().replace(/\s+/g, ' ');
  const normalizedNewCategory = newCategory.trim().replace(/\s+/g, ' ');
  const renameDisabled =
    !selectedCategory ||
    normalizedRename === '' ||
    normalizedRename.toLowerCase() === selectedCategory.toLowerCase();

  return (
    <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <FolderTree size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold dark:text-white">Categories</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage reusable categories and clean up typo labels across existing posts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-6">
        <div className="border border-slate-200 dark:border-[#2a2b36] rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-[#16161e]/50 border-b border-slate-200 dark:border-[#2a2b36]">
            <h4 className="font-semibold text-slate-800 dark:text-white">Existing Categories</h4>
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((category) => (
              <button
                type="button"
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selectedCategory === category.name
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-[#101018]/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800 dark:text-white">
                    {category.name}
                  </span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-[#242633] dark:text-slate-300 px-2 py-1 rounded-full">
                    {category.postCount} post{category.postCount === 1 ? '' : 's'}
                  </span>
                </div>
              </button>
            ))}
            {categories.length === 0 && (
              <p className="px-4 py-8 text-sm text-slate-400 italic">No categories found.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-slate-200 dark:border-[#2a2b36] rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-slate-800 dark:text-white">Add Category</h4>
            <input
              aria-label="New category name"
              id="categorysettings-162"
              name="categorysettings162"
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category name"
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => runAction('add', { category: normalizedNewCategory })}
              disabled={loadingAction !== '' || normalizedNewCategory === ''}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus size={16} />
              Add Category
            </button>
          </div>

          <div className="border border-slate-200 dark:border-[#2a2b36] rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-slate-800 dark:text-white">
              Rename Selected Category
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This updates all matching posts, not just the saved category list.
            </p>
            <input
              id="categorysettings-187"
              name="categorysettings187"
              aria-label="Renamed category name"
              type="text"
              value={renameTarget}
              onChange={(e) => setRenameTarget(e.target.value)}
              placeholder="New category name"
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() =>
                runAction('rename', {
                  old_category: selectedCategory,
                  new_category: normalizedRename,
                })
              }
              disabled={loadingAction !== '' || renameDisabled}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Pencil size={16} />
              Rename Across Posts
            </button>
          </div>

          <div className="border border-rose-200 dark:border-rose-900/40 rounded-xl p-4 space-y-3 bg-rose-50/60 dark:bg-rose-950/20">
            <h4 className="font-semibold text-rose-700 dark:text-rose-300">
              Delete Selected Category
            </h4>
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Posts using this category will be moved to <strong>Uncategorized</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!selectedCategory) return;
                if (
                  !confirm(`Delete "${selectedCategory}" and move affected posts to Uncategorized?`)
                ) {
                  return;
                }
                runAction('delete', {
                  category: selectedCategory,
                  replacement_category: 'Uncategorized',
                });
              }}
              disabled={
                loadingAction !== '' ||
                !selectedCategory ||
                selectedCategory.toLowerCase() === 'uncategorized'
              }
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 size={16} />
              Delete Category
            </button>
            {selectedSummary && (
              <p className="text-xs text-rose-500 dark:text-rose-400">
                Selected: <strong>{selectedSummary.name}</strong> ({selectedSummary.postCount} post
                {selectedSummary.postCount === 1 ? '' : 's'})
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
