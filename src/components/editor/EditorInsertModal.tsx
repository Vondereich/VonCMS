import { CheckCircle, Code, Image, Link, Table, Video, X } from 'lucide-react';
import AdminModal from '../admin/AdminModal';
import type { EditorLinkRelationship } from './editorLinkUtils';
import { TABLE_MAX_DIMENSION, TABLE_MIN_DIMENSION } from './editorTableUtils';

interface EditorInsertModalProps {
  activeModal: 'link' | 'image' | 'video' | 'code' | 'table' | 'mediaLibrary' | null;
  modalInput: string;
  modalInput2: string;
  modalError: string;
  linkRelationship: EditorLinkRelationship;
  modalCanSubmit: boolean;
  selectedLinkIsActive: boolean;
  onInputChange: (value: string) => void;
  onSecondInputChange: (value: string) => void;
  onRelationshipChange: (value: EditorLinkRelationship) => void;
  onConfirm: () => void;
  onRemoveLink: () => void;
  onClose: () => void;
}

export const EditorInsertModal = ({
  activeModal,
  modalInput,
  modalInput2,
  modalError,
  linkRelationship,
  modalCanSubmit,
  selectedLinkIsActive,
  onInputChange,
  onSecondInputChange,
  onRelationshipChange,
  onConfirm,
  onRemoveLink,
  onClose,
}: EditorInsertModalProps) => (
  <AdminModal
    isOpen={Boolean(activeModal && activeModal !== 'mediaLibrary')}
    onClose={onClose}
    ariaLabel={`Insert ${activeModal || 'content'}`}
    className="w-full max-w-md"
  >
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-admin-border dark:bg-admin-panel">
      <div className="p-4 border-b border-slate-100 dark:border-admin-border flex justify-between items-center bg-slate-50 dark:bg-admin-canvas/50">
        <h3 className="font-bold text-slate-800 dark:text-white capitalize flex items-center gap-2">
          {activeModal === 'link' && <Link size={18} className="text-blue-500" />}
          {activeModal === 'image' && <Image size={18} className="text-green-500" />}
          {activeModal === 'video' && <Video size={18} className="text-red-500" />}
          {activeModal === 'code' && <Code size={18} className="text-amber-500" />}
          {activeModal === 'table' && <Table size={18} className="text-indigo-500" />}
          Insert {activeModal}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-admin-hover dark:hover:text-slate-300"
          aria-label="Close insert dialog"
          title="Close insert dialog"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {activeModal === 'table' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rows
                </span>
                <input
                  aria-label="Rows"
                  id="editor-1288"
                  name="editor1288"
                  type="number"
                  min={TABLE_MIN_DIMENSION}
                  max={TABLE_MAX_DIMENSION}
                  required
                  value={modalInput}
                  onChange={(e) => onInputChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-admin-border-strong rounded-lg bg-slate-50 dark:bg-admin-canvas dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Columns
                </span>
                <input
                  id="editor-1300"
                  name="editor1300"
                  aria-label="Columns"
                  type="number"
                  min={TABLE_MIN_DIMENSION}
                  max={TABLE_MAX_DIMENSION}
                  required
                  value={modalInput2}
                  onChange={(e) => onSecondInputChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-admin-border-strong rounded-lg bg-slate-50 dark:bg-admin-canvas dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Use {TABLE_MIN_DIMENSION} to {TABLE_MAX_DIMENSION} rows and columns.
            </p>
          </div>
        ) : activeModal === 'code' ? (
          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Code Content
            </span>
            <textarea
              aria-label="Code Content"
              id="editor-1314"
              name="editor1314"
              autoFocus
              rows={6}
              required
              maxLength={100000}
              value={modalInput}
              onChange={(e) => onInputChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-admin-border-strong rounded-lg bg-slate-50 dark:bg-admin-canvas dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden font-mono text-sm"
              placeholder="Paste your code here..."
            />
          </div>
        ) : (
          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {activeModal === 'link'
                ? 'URL'
                : activeModal === 'image'
                  ? 'Image URL'
                  : 'Video URL or Embed Code'}
            </span>
            <input
              id="editor-1332"
              name="editor1332"
              aria-label={
                activeModal === 'link'
                  ? 'Link URL'
                  : activeModal === 'image'
                    ? 'Image URL'
                    : 'Video URL or embed code'
              }
              autoFocus
              type="text"
              required
              maxLength={activeModal === 'video' ? 12000 : 2048}
              value={modalInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
              className="w-full px-3 py-2 border border-slate-300 dark:border-admin-border-strong rounded-lg bg-slate-50 dark:bg-admin-canvas dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              placeholder={
                activeModal === 'video' ? 'https://youtube.com/...' : 'https://example.com'
              }
            />
            {activeModal === 'link' && (
              <div className="mt-3">
                <label
                  htmlFor="editor-link-relationship"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Link relationship
                </label>
                <select
                  id="editor-link-relationship"
                  value={linkRelationship}
                  onChange={(event) =>
                    onRelationshipChange(event.target.value as EditorLinkRelationship)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-admin-border-strong dark:bg-admin-canvas dark:text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="sponsored">Sponsored - paid or compensated link</option>
                  <option value="nofollow">Nofollow</option>
                  <option value="ugc">UGC - user-generated content</option>
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Applies to this link only. It does not change article indexing.
                </p>
              </div>
            )}
            {activeModal === 'video' && (
              <p className="text-xs text-slate-500 mt-1">
                Supports YouTube, TikTok, Instagram, Facebook or supported iframe embeds.
              </p>
            )}
          </div>
        )}
        {modalError && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {modalError}
          </p>
        )}
      </div>

      {/* Modal Footer with Quick Release Button */}
      <div className="admin-safe-bottom flex flex-col-reverse justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 dark:border-admin-border dark:bg-admin-canvas/50 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 w-full px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-admin-hover rounded-lg transition-colors sm:w-auto"
        >
          Cancel
        </button>
        {selectedLinkIsActive && (
          <button
            type="button"
            onClick={onRemoveLink}
            className="min-h-11 w-full rounded-lg px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 sm:w-auto"
          >
            Remove link
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={!modalCanSubmit}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <CheckCircle size={16} />
          {activeModal === 'link'
            ? selectedLinkIsActive
              ? 'Update Link'
              : 'Insert Link'
            : activeModal === 'image' || activeModal === 'video'
              ? 'Insert Object'
              : activeModal === 'code'
                ? 'Insert Code'
                : 'Generate Table'}
        </button>
      </div>
    </div>
  </AdminModal>
);
