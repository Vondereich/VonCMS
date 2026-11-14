import React, { useId, useState } from 'react';
import { Brain, ChevronDown, FileText, Sparkles } from 'lucide-react';
import type { AiAssistantMode, AiAssistantResult } from '../../hooks/useAiWriting';

interface AiWritingPanelProps {
  title: string;
  hasContent: boolean;
  activeModel: string;
  credentialSource?: 'auto' | 'personal' | 'shared';
  mode: AiAssistantMode;
  writePrompt: string;
  pendingResult: AiAssistantResult | null;
  isGenerating: boolean;
  isChecking: boolean;
  isSaving: boolean;
  onModeChange: (mode: AiAssistantMode) => void;
  onWritePromptChange: (value: string) => void;
  onGenerate: () => void;
  onCheck: () => void;
  onApplyAppend: () => void;
  onApplyReplace: () => void;
  onDiscard: () => void;
}

const formatResultTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatModelName = (model: string) =>
  model
    .split('-')
    .map((part) => (part === 'gemini' ? 'Gemini' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');

const AiWritingPanel: React.FC<AiWritingPanelProps> = ({
  title,
  hasContent,
  activeModel,
  credentialSource = 'auto',
  mode,
  writePrompt,
  pendingResult,
  isGenerating,
  isChecking,
  isSaving,
  onModeChange,
  onWritePromptChange,
  onGenerate,
  onCheck,
  onApplyAppend,
  onApplyReplace,
  onDiscard,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  const isWriteMode = mode === 'write';
  const isBusy = isGenerating || isChecking;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-admin-border dark:bg-admin-panel">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:focus-visible:outline-gray-400"
        >
          <Sparkles size={18} className="text-cyan-500" />
          <span className="min-w-0 flex-1">AI Assistant</span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`shrink-0 text-slate-500 transition-transform dark:text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      <div id={contentId} hidden={!isExpanded}>
        <div className="flex items-start justify-between gap-3">
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            Keep drafting and review outside the writing canvas.
          </p>
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {formatModelName(activeModel)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-gray-400">
              {credentialSource === 'shared'
                ? 'Last request: shared key'
                : credentialSource === 'personal'
                  ? 'Last request: personal key'
                  : 'Personal key first, otherwise shared'}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-admin-canvas">
          <button
            type="button"
            onClick={() => onModeChange('write')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isWriteMode
                ? 'bg-white text-slate-900 shadow-xs dark:bg-admin-panel dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-slate-200'
            }`}
          >
            Write Draft
          </button>
          <button
            type="button"
            onClick={() => onModeChange('check')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              !isWriteMode
                ? 'bg-white text-slate-900 shadow-xs dark:bg-admin-panel dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-slate-200'
            }`}
          >
            Review Copy
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {isWriteMode ? (
            <div>
              <label
                htmlFor="ai-writing-prompt"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-gray-400"
              >
                Prompt or Topic
              </label>
              <textarea
                id="ai-writing-prompt"
                name="aiWritingPrompt"
                aria-label="AI writing prompt"
                value={writePrompt}
                onChange={(e) => onWritePromptChange(e.target.value)}
                placeholder={
                  title
                    ? `Leave blank to use the current title: ${title}`
                    : 'Describe what you want AI to write...'
                }
                className="h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-hidden transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-admin-border dark:bg-admin-canvas dark:text-slate-100 dark:focus:border-gray-400 dark:focus:ring-gray-400/20"
              />
              <p className="mt-2 text-xs text-slate-400 dark:text-gray-400">
                {title
                  ? 'If this stays empty, the current title becomes the generation topic.'
                  : 'Add a title or prompt before generating a draft.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-admin-border dark:bg-admin-canvas/70">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Brain size={16} className="text-rose-500" />
                Article Review Target
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-gray-400">
                {hasContent
                  ? 'AI Check reviews the current article body and returns a revised version for manual apply.'
                  : 'Add some article content first. AI Check only runs against the current article body.'}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={isWriteMode ? onGenerate : onCheck}
            disabled={isBusy || isSaving || (!isWriteMode && !hasContent)}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
              isWriteMode
                ? 'bg-cyan-600 hover:bg-cyan-700 dark:bg-admin-hover dark:hover:bg-admin-hover-strong'
                : 'bg-rose-600 hover:bg-rose-700'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isWriteMode ? <Sparkles size={16} /> : <Brain size={16} />}
            <span>
              {isWriteMode
                ? isGenerating
                  ? 'Generating Draft...'
                  : 'Generate Draft'
                : isChecking
                  ? 'Reviewing Copy...'
                  : 'Run Grammar and Style Check'}
            </span>
          </button>
        </div>

        {pendingResult ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-admin-border dark:bg-admin-canvas/60">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-admin-border">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                  {pendingResult.mode === 'write' ? 'Draft Result' : 'Reviewed Copy'}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {pendingResult.mode === 'write'
                    ? 'Ready to insert into the article'
                    : 'Ready to replace the current article body'}
                </div>
              </div>
              <span className="text-xs text-slate-400 dark:text-gray-400">
                {formatResultTime(pendingResult.generatedAt)}
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-gray-400">
                <FileText size={14} />
                Plain-text preview
              </div>
              <p className="whitespace-pre-wrap">
                {pendingResult.plainText || 'HTML draft ready to apply.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-3 dark:border-admin-border">
              {pendingResult.mode === 'write' && (
                <button
                  type="button"
                  onClick={onApplyAppend}
                  disabled={isSaving}
                  className="rounded-lg bg-admin-inset px-3 py-2 text-sm font-semibold text-white transition hover:bg-admin-hover disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Append to Article
                </button>
              )}
              <button
                type="button"
                onClick={onApplyReplace}
                disabled={isSaving}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50 dark:bg-admin-hover dark:hover:bg-admin-hover-strong"
              >
                {pendingResult.mode === 'write' ? 'Replace Article' : 'Apply Reviewed Copy'}
              </button>
              <button
                type="button"
                onClick={onDiscard}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-admin-border-strong dark:text-slate-300 dark:hover:bg-admin-hover"
              >
                Discard
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400 dark:border-admin-border dark:text-gray-400">
            Generated drafts stay here until you explicitly append, replace, or discard them.
          </div>
        )}
      </div>
    </section>
  );
};

export default React.memo(AiWritingPanel);
