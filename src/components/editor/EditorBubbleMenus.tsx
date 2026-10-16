import { AlignCenter, AlignLeft, AlignRight, CheckCircle, Sparkles, X } from 'lucide-react';
import type { ImageSize, MediaAlignment } from './editorExtensions';
import type { VideoAspectMode } from './editorVideoContracts';
import type { TableCommand } from './editorTableUtils';
import { ToolButton } from './EditorToolbarPrimitives';

interface BubblePositionProps {
  bubblePosition: { top: number; left: number };
  onClose: () => void;
}

interface EditorImageBubbleProps extends BubblePositionProps {
  selectedImageAlignment: MediaAlignment | null;
  selectedImageSize: ImageSize | null;
  bubbleAlt: string;
  bubbleCredit: string;
  alignImage: (alignment: MediaAlignment) => void;
  resizeImage: (size: ImageSize) => void;
  setBubbleAlt: (value: string) => void;
  setBubbleCredit: (value: string) => void;
  updateImageAlt: () => void;
  updateImageCredit: () => void;
  setAsFeaturedIndex: () => void;
  removeSelectedImage: () => void;
}

interface EditorVideoBubbleProps extends BubblePositionProps {
  selectedVideoAlignment: MediaAlignment | null;
  selectedVideoAspect: VideoAspectMode;
  alignImage: (alignment: MediaAlignment) => void;
  applyVideoAspectMode: (mode: VideoAspectMode) => void;
  removeSelectedVideo: () => void;
}

interface EditorTableBubbleProps extends BubblePositionProps {
  runTableCommand: (command: TableCommand) => void;
}

export const EditorImageBubble = ({
  bubblePosition,
  selectedImageAlignment,
  selectedImageSize,
  bubbleAlt,
  bubbleCredit,
  alignImage,
  resizeImage,
  setBubbleAlt,
  setBubbleCredit,
  updateImageAlt,
  updateImageCredit,
  setAsFeaturedIndex,
  removeSelectedImage,
  onClose,
}: EditorImageBubbleProps) => (
  <div
    className="absolute z-70 bg-white dark:bg-admin-panel shadow-xl border border-slate-200 dark:border-admin-border rounded-lg p-2 flex flex-col gap-2 w-72 animate-fade-in"
    style={{ top: bubblePosition.top, left: Math.max(10, bubblePosition.left) }}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs font-bold text-slate-500 uppercase">Image Tools</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-white/10"
        aria-label="Close image tools"
        title="Close image tools"
      >
        <X size={14} />
      </button>
    </div>

    <div className="flex items-center gap-1 bg-slate-100 dark:bg-admin-canvas rounded-sm p-1">
      <ToolButton
        icon={<AlignLeft size={14} />}
        onClick={() => alignImage('left')}
        title="Align Left"
        active={selectedImageAlignment === 'left'}
      />
      <ToolButton
        icon={<AlignCenter size={14} />}
        onClick={() => alignImage('center')}
        title="Align Center"
        active={selectedImageAlignment === 'center'}
      />
      <ToolButton
        icon={<AlignRight size={14} />}
        onClick={() => alignImage('right')}
        title="Align Right"
        active={selectedImageAlignment === 'right'}
      />
    </div>

    <div className="flex items-center gap-1 bg-slate-100 dark:bg-admin-canvas rounded-sm p-1">
      <span className="text-[10px] text-slate-500 font-semibold px-1">SIZE</span>
      {(['25', '50', '75', '100'] as const).map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => resizeImage(size)}
          className={`px-2 py-1 text-[11px] font-bold rounded transition-all ${
            selectedImageSize === size
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-admin-panel'
          }`}
          title={`Resize to ${size}%`}
        >
          {size === '25' ? 'S' : size === '50' ? 'M' : size === '75' ? 'L' : 'Full'}
        </button>
      ))}
    </div>

    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-slate-500 font-semibold">ALT TEXT (SEO)</span>
      <div className="flex gap-1">
        <input
          aria-label="ALT TEXT (SEO)"
          id="editor-1513"
          name="editor1513"
          value={bubbleAlt}
          onChange={(e) => setBubbleAlt(e.target.value)}
          className="grow text-xs p-1.5 border border-slate-300 dark:border-admin-border-strong rounded-sm bg-slate-50 dark:bg-admin-canvas dark:text-white"
          placeholder="Describe image..."
        />
        <button
          type="button"
          onClick={updateImageAlt}
          className="bg-blue-600 text-white p-1.5 rounded-sm hover:bg-blue-700"
          title="Save Alt Text"
        >
          <CheckCircle size={14} />
        </button>
      </div>
    </div>

    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-slate-500 font-semibold">CREDIT / ATTRIBUTION</span>
      <div className="flex gap-1">
        <input
          id="editor-1532"
          name="editor1532"
          aria-label="CREDIT / ATTRIBUTION"
          value={bubbleCredit}
          onChange={(e) => setBubbleCredit(e.target.value)}
          className="grow text-xs p-1.5 border border-slate-300 dark:border-admin-border-strong rounded-sm bg-slate-50 dark:bg-admin-canvas dark:text-white"
          placeholder="e.g. Bernama, Reuters, AP, AFP..."
        />
        <button
          type="button"
          onClick={updateImageCredit}
          className="bg-cyan-600 text-white p-1.5 rounded-sm hover:bg-cyan-700"
          title="Save Credit"
        >
          <CheckCircle size={14} />
        </button>
      </div>
    </div>

    <button
      type="button"
      onClick={setAsFeaturedIndex}
      className="text-xs p-1.5 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-sm hover:bg-amber-100 flex items-center justify-center gap-1 font-medium mt-1"
    >
      <Sparkles size={14} /> Set as Featured Image
    </button>
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={removeSelectedImage}
      className="flex min-h-10 items-center justify-center rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/35"
    >
      Remove image
    </button>
  </div>
);

export const EditorVideoBubble = ({
  bubblePosition,
  selectedVideoAlignment,
  selectedVideoAspect,
  alignImage,
  applyVideoAspectMode,
  removeSelectedVideo,
  onClose,
}: EditorVideoBubbleProps) => (
  <div
    className="absolute z-70 bg-white dark:bg-admin-panel shadow-xl border border-slate-200 dark:border-admin-border rounded-lg p-2 flex flex-col gap-2 w-72 animate-fade-in"
    style={{ top: bubblePosition.top, left: Math.max(10, bubblePosition.left) }}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs font-bold text-slate-500 uppercase">Video Tools</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-white/10"
        aria-label="Close video tools"
        title="Close video tools"
      >
        <X size={14} />
      </button>
    </div>

    <div className="flex items-center gap-1 bg-slate-100 dark:bg-admin-canvas rounded-sm p-1">
      <ToolButton
        icon={<AlignLeft size={14} />}
        onClick={() => alignImage('left')}
        title="Align Left"
        active={selectedVideoAlignment === 'left'}
      />
      <ToolButton
        icon={<AlignCenter size={14} />}
        onClick={() => alignImage('center')}
        title="Align Center"
        active={selectedVideoAlignment === 'center'}
      />
      <ToolButton
        icon={<AlignRight size={14} />}
        onClick={() => alignImage('right')}
        title="Align Right"
        active={selectedVideoAlignment === 'right'}
      />
    </div>

    <div className="flex items-center gap-1 bg-slate-100 dark:bg-admin-canvas rounded-sm p-1">
      <span className="text-[10px] text-slate-500 font-semibold px-1">ASPECT</span>
      {(
        [
          ['auto', 'Auto'],
          ['portrait', '9:16'],
          ['landscape', '16:9'],
        ] as const
      ).map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          onClick={() => applyVideoAspectMode(mode)}
          className={`px-2 py-1 text-[11px] font-bold rounded transition-all ${
            selectedVideoAspect === mode
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-admin-panel'
          }`}
          title={`Set video aspect to ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={removeSelectedVideo}
      className="flex min-h-10 items-center justify-center rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/35"
    >
      Remove video
    </button>
  </div>
);

export const EditorTableBubble = ({
  bubblePosition,
  runTableCommand,
  onClose,
}: EditorTableBubbleProps) => (
  <div
    className="absolute z-70 flex w-72 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-xl animate-fade-in dark:border-admin-border dark:bg-admin-panel"
    style={{ top: bubblePosition.top, left: bubblePosition.left }}
  >
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold uppercase text-slate-500">Table Tools</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-white/10"
        aria-label="Close table tools"
        title="Close table tools"
      >
        <X size={14} />
      </button>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      {(
        [
          ['addRowBefore', 'Add row above'],
          ['addRowAfter', 'Add row below'],
          ['deleteRow', 'Delete row'],
          ['addColumnBefore', 'Add column left'],
          ['addColumnAfter', 'Add column right'],
          ['deleteColumn', 'Delete column'],
        ] as const
      ).map(([command, label]) => (
        <button
          key={command}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runTableCommand(command)}
          className="min-h-10 rounded-lg bg-slate-100 px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-admin-canvas dark:text-slate-200 dark:hover:bg-white/10"
        >
          {label}
        </button>
      ))}
    </div>
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => runTableCommand('deleteTable')}
      className="min-h-10 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/35"
    >
      Delete table
    </button>
  </div>
);
