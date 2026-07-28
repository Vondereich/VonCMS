import React from 'react';
import { Activity, AlertCircle, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';
import notify from '../../utils/toast';
import { Page, Post } from '../../types';
import { htmlToPlainText } from '../../utils/security';
import { extractKeywords, SEOAnalysisResult } from '../../utils/seoAnalyzer';
import { getPostEditorCleanText } from './postEditorTextHelpers';

interface PostEditorSeoPanelProps {
  item: Post | Page;
  setItem: React.Dispatch<React.SetStateAction<Post | Page | null>>;
  isRestoring: boolean;
  result: SEOAnalysisResult | null;
}

const PostEditorSeoPanel: React.FC<PostEditorSeoPanelProps> = ({
  item,
  setItem,
  isRestoring,
  result,
}) => (
  <div className="bg-white dark:bg-[#1a1b26] p-5 rounded-xl border border-slate-200 dark:border-[#2a2b36] shadow-xs space-y-4">
    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
      <span className="text-blue-500">●</span> SEO Settings
    </h3>
    <div>
      <div className="flex justify-between items-center mb-1">
        <label htmlFor="post-meta-desc" className="block text-sm font-medium text-slate-500">
          Meta Description
        </label>
        <button
          onClick={() => {
            const description = item.content ? getPostEditorCleanText(item.content, 160) : '';
            if (description) {
              setItem((previous) =>
                previous ? { ...previous, metaDescription: description } : null
              );
            } else {
              notify.info('Add content first');
            }
          }}
          className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full transition-colors"
        >
          <Sparkles size={12} /> Auto Fill
        </button>
      </div>
      <textarea
        id="post-meta-desc"
        name="metaDescription"
        className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 h-24 text-sm"
        placeholder="Brief summary for search engines (max 160 chars)..."
        value={item.metaDescription || ''}
        onChange={(event) =>
          setItem((previous) =>
            previous ? { ...previous, metaDescription: event.target.value } : null
          )
        }
        maxLength={160}
      />
      <p className="text-xs text-slate-400 mt-1">
        {(item.metaDescription || '').length}/160 characters
      </p>
    </div>
    <div>
      <div className="flex justify-between items-center mb-1">
        <label htmlFor="post-keywords" className="block text-sm font-medium text-slate-500">
          Keywords
        </label>
        <button
          onClick={() => {
            if (!item.content && !item.title) return;
            const plainText = htmlToPlainText(item.content);
            const keywords = extractKeywords(plainText, item.title || '').join(', ');
            setItem((previous) => (previous ? { ...previous, keywords } : null));
          }}
          className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-bold bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full transition-colors"
        >
          <Sparkles size={12} />
          Auto-Generate
        </button>
      </div>
      <input
        id="post-keywords"
        name="keywords"
        type="text"
        placeholder="comma, separated, keywords"
        className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm"
        value={item.keywords || ''}
        onChange={(event) =>
          setItem((previous) => (previous ? { ...previous, keywords: event.target.value } : null))
        }
      />
    </div>

    {isRestoring && (
      <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-xs border border-slate-200 dark:border-[#2a2b36] overflow-hidden animate-fade-in mt-6">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2a2b36] flex items-center gap-2">
          <Activity size={16} className="text-blue-500 animate-pulse" />
          <h3 className="font-bold text-slate-800 dark:text-white text-sm">SEO Health</h3>
        </div>
        <div className="p-5 text-sm text-slate-500 dark:text-slate-400">
          Restoring SEO data from the full post content...
        </div>
      </div>
    )}

    {result && !isRestoring && (
      <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-xs border border-slate-200 dark:border-[#2a2b36] overflow-hidden animate-fade-in mt-6">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
            <Activity size={16} className="text-blue-500" />
            SEO Health
          </h3>
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
              result.score >= 80
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                : result.score >= 50
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                  : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
            }`}
          >
            <span className="text-lg">{result.score}</span>
            <span className="opacity-60 text-xs font-medium">/ 100</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              <span>Optimization</span>
              <span>{result.score}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-[#242633] rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  result.score >= 80
                    ? 'bg-green-500'
                    : result.score >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${result.score}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {Object.entries(result.checks).map(([key, check]) => (
              <div key={key} className="flex items-start gap-2.5 py-1.5">
                <div className="mt-0.5 shrink-0">
                  {check.status === 'good' ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : check.status === 'warning' ? (
                    <AlertTriangle size={14} className="text-amber-500" />
                  ) : (
                    <AlertCircle size={14} className="text-red-500" />
                  )}
                </div>
                <p
                  className={`text-xs leading-snug ${
                    check.status === 'good'
                      ? 'text-slate-600 dark:text-slate-400'
                      : check.status === 'warning'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {check.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
);

export default PostEditorSeoPanel;
