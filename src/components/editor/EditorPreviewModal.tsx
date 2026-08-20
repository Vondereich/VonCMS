import { Eye, X } from 'lucide-react';
import ContentRenderer from '../ContentRenderer';
import AdminModal from '../admin/AdminModal';

interface EditorPreviewModalProps {
  isOpen: boolean;
  html: string;
  onClose: () => void;
}

export const EditorPreviewModal = ({ isOpen, html, onClose }: EditorPreviewModalProps) => (
  <AdminModal
    isOpen={isOpen}
    onClose={onClose}
    ariaLabel="Preview content"
    className="w-full max-w-4xl"
  >
    <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2b36] dark:bg-[#1a1b26] sm:max-h-[90dvh]">
      <div className="p-4 border-b border-slate-100 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <Eye size={18} className="text-blue-500" />
          Preview Content
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-[#242633]"
          aria-label="Close content preview"
          title="Close content preview"
        >
          <X size={18} />
        </button>
      </div>
      <div className="grow overflow-y-auto p-4 sm:p-6">
        <ContentRenderer className="prose prose-lg dark:prose-invert max-w-none" html={html} />
      </div>
    </div>
  </AdminModal>
);
