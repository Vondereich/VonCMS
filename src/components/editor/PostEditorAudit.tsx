import React from 'react';
import { Clock3, History, User, X } from 'lucide-react';
import { ContentAuditLog } from '../../types';
import AdminModal from '../admin/AdminModal';

const formatAuditActor = (log: ContentAuditLog) => {
  const actorName = (log.actorUsername || '').trim() || 'System';
  const actorRole = (log.actorRole || '').trim();
  return actorRole ? `${actorName} (${actorRole})` : actorName;
};

const formatAuditTimestamp = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

interface PostEditorAuditSummaryProps {
  itemId?: string;
  logs: ContentAuditLog[];
  isLoading: boolean;
  onOpenHistory: () => void;
}

export const PostEditorAuditSummary: React.FC<PostEditorAuditSummaryProps> = ({
  itemId,
  logs,
  isLoading,
  onOpenHistory,
}) => {
  const latestLog = logs[0] || null;
  const recentLogs = logs.slice(0, 3);

  return (
    <div className="bg-slate-50/50 dark:bg-[#1a1b26]/50 p-5 rounded-xl border border-slate-200 dark:border-[#2a2b36] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <History size={16} className="text-slate-400" />
          Edit Log
        </h3>
        {!!itemId && logs.length > 0 && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View Recent History
          </button>
        )}
      </div>

      {!itemId ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Edit history will start after the first successful save.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading edit history...</p>
      ) : latestLog ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/60 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {latestLog.summary || 'Content updated'}
            </p>
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <p className="flex items-center gap-2">
                <User size={14} />
                <span>{formatAuditActor(latestLog)}</span>
              </p>
              <p className="flex items-center gap-2">
                <Clock3 size={14} />
                <span>{formatAuditTimestamp(latestLog.createdAt)}</span>
              </p>
            </div>
          </div>

          {recentLogs.length > 1 && (
            <div className="space-y-2">
              {recentLogs.slice(1).map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-slate-200 dark:border-[#2a2b36] p-3"
                >
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {log.summary || 'Content updated'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatAuditActor(log)} - {formatAuditTimestamp(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No edit history found yet for this item.
        </p>
      )}
    </div>
  );
};

interface PostEditorAuditHistoryModalProps {
  isOpen: boolean;
  isPage: boolean;
  logs: ContentAuditLog[];
  isLoading: boolean;
  onClose: () => void;
}

export const PostEditorAuditHistoryModal: React.FC<PostEditorAuditHistoryModalProps> = ({
  isOpen,
  isPage,
  logs,
  isLoading,
  onClose,
}) => {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Recent edit history"
      className="w-full max-w-3xl"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2b36] dark:bg-[#16161e] sm:max-h-[85dvh]">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2a2b36] px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Recent Edit History
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Latest 50 create, update, and delete entries for this {isPage ? 'page' : 'post'}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26]"
            aria-label="Close edit history"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400">
              Loading edit history...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400">
              No edit history found for this item.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-200 dark:border-[#2a2b36] p-4"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {log.summary || 'Content updated'}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <p className="flex items-center gap-2">
                      <User size={14} />
                      <span>{formatAuditActor(log)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 size={14} />
                      <span>{formatAuditTimestamp(log.createdAt)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminModal>
  );
};
