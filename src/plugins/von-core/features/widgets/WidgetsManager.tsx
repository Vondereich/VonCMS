import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Mail,
  PanelsTopLeft,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Type,
  UserRound,
} from 'lucide-react';
import { SiteSettings, SidebarWidget, WidgetType } from '../../../../types';

interface WidgetsManagerProps {
  settings: SiteSettings;
  onUpdateSettings: (settings: SiteSettings) => boolean | Promise<boolean> | void;
}

type WidgetTypeOption = {
  type: WidgetType;
  label: string;
  defaultTitle: string;
  description: string;
};

const SUPPORTED_WIDGET_TYPES: WidgetTypeOption[] = [
  {
    type: 'trending',
    label: 'Trending / Latest Posts',
    defaultTitle: 'Latest Stories',
    description: 'Shows a bounded list of published posts in themes that expose a sidebar.',
  },
  {
    type: 'profile',
    label: 'Profile Card',
    defaultTitle: 'About',
    description: 'Shows the existing Admin Profile from Settings as a sidebar card.',
  },
  {
    type: 'custom',
    label: 'Custom HTML / Text',
    defaultTitle: 'Custom Widget',
    description:
      'Stores custom markup or text. Public rendering still uses the existing sanitizer.',
  },
];

const DEFAULT_NEWSLETTER = {
  enabled: false,
  title: 'Subscribe to Newsletter',
  description: 'Get the latest updates delivered to your inbox.',
  buttonText: 'Subscribe',
  successMessage: 'Thank you for subscribing!',
  position: 'footer' as const,
};

const clampText = (value: unknown, maxLength: number): string =>
  String(value ?? '')
    .trim()
    .slice(0, maxLength);

const isSupportedWidgetType = (type: unknown): type is WidgetType =>
  SUPPORTED_WIDGET_TYPES.some((option) => option.type === type);

const sanitizeWidgetForSave = (widget: SidebarWidget): SidebarWidget => {
  const type = isSupportedWidgetType(widget.type) ? widget.type : 'custom';
  const fallbackTitle =
    SUPPORTED_WIDGET_TYPES.find((option) => option.type === type)?.defaultTitle || 'Custom Widget';
  const title = clampText(widget.title, 120) || fallbackTitle;
  const sanitized: SidebarWidget = {
    id: clampText(widget.id, 80) || `widget-${type}-${Date.now()}`,
    type,
    title,
    isVisible: widget.isVisible !== false,
  };

  if (type === 'trending') {
    sanitized.itemCount = Math.max(1, Math.min(20, Number(widget.itemCount) || 5));
  }

  if (type === 'custom') {
    sanitized.content = clampText(widget.content, 20000);
  }

  return sanitized;
};

const sanitizeNewsletterForSave = (newsletter: NonNullable<SiteSettings['newsletter']>) => ({
  ...DEFAULT_NEWSLETTER,
  ...newsletter,
  enabled: newsletter.enabled === true,
  title: clampText(newsletter.title, 120) || DEFAULT_NEWSLETTER.title,
  description: clampText(newsletter.description, 240) || DEFAULT_NEWSLETTER.description,
  buttonText: clampText(newsletter.buttonText, 40) || DEFAULT_NEWSLETTER.buttonText,
  successMessage: clampText(newsletter.successMessage, 160) || DEFAULT_NEWSLETTER.successMessage,
  position: ['footer', 'sidebar', 'both'].includes(String(newsletter.position))
    ? newsletter.position
    : DEFAULT_NEWSLETTER.position,
});

const WidgetsManager: React.FC<WidgetsManagerProps> = ({ settings, onUpdateSettings }) => {
  const initialWidgets = useMemo(
    () => (settings.sidebarLayout || []).map((widget) => sanitizeWidgetForSave(widget)),
    [settings.sidebarLayout]
  );
  const [widgets, setWidgets] = useState<SidebarWidget[]>(initialWidgets);
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);
  const [draggedWidgetIndex, setDraggedWidgetIndex] = useState<number | null>(null);
  const [selectedWidgetType, setSelectedWidgetType] = useState<WidgetType>('trending');
  const [isSaving, setIsSaving] = useState(false);
  const [newsletterSettings, setNewsletterSettings] = useState(() =>
    sanitizeNewsletterForSave({
      ...DEFAULT_NEWSLETTER,
      ...settings.newsletter,
    })
  );

  const addWidget = (type: WidgetType) => {
    const option =
      SUPPORTED_WIDGET_TYPES.find((widgetType) => widgetType.type === type) ||
      SUPPORTED_WIDGET_TYPES[0];
    const nextWidget: SidebarWidget = {
      id: `widget-${option.type}-${Date.now()}`,
      type: option.type,
      title: option.defaultTitle,
      isVisible: true,
      ...(option.type === 'trending' ? { itemCount: 5 } : {}),
      ...(option.type === 'custom' ? { content: '' } : {}),
    };

    setWidgets((currentWidgets) => [...currentWidgets, nextWidget]);
    setExpandedWidgetId(nextWidget.id);
  };

  const updateWidget = (id: string, patch: Partial<SidebarWidget>) => {
    setWidgets((currentWidgets) =>
      currentWidgets.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget))
    );
  };

  const removeWidget = (id: string) => {
    if (!confirm('Remove this sidebar widget?')) return;
    setWidgets((currentWidgets) => currentWidgets.filter((widget) => widget.id !== id));
  };

  const handleWidgetDragStart = (index: number) => {
    setDraggedWidgetIndex(index);
  };

  const handleWidgetDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    if (draggedWidgetIndex === null || draggedWidgetIndex === index) return;

    setWidgets((currentWidgets) => {
      const reorderedWidgets = [...currentWidgets];
      const [draggedWidget] = reorderedWidgets.splice(draggedWidgetIndex, 1);
      reorderedWidgets.splice(index, 0, draggedWidget);
      return reorderedWidgets;
    });
    setDraggedWidgetIndex(index);
  };

  const handleWidgetDragEnd = () => {
    setDraggedWidgetIndex(null);
  };

  const moveWidget = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    setWidgets((currentWidgets) => {
      const reordered = [...currentWidgets];
      const [item] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, item);
      return reordered;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const saved = await onUpdateSettings({
        ...settings,
        newsletter: sanitizeNewsletterForSave(newsletterSettings),
        sidebarLayout: widgets.map((widget) => sanitizeWidgetForSave(widget)),
      });

      if (saved === false) return;
      toast.success('Widget settings saved!');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center">
            <PanelsTopLeft size={22} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Widgets</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage shared sidebar blocks used by sidebar-capable themes: Default, Digest, and
              TechPress. Themes without a sidebar ignore these blocks.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1064px] grid-cols-1 xl:grid-cols-[minmax(0,520px)_minmax(0,520px)] gap-6 items-start">
        <section className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-5 animate-fade-in">
          <div className="space-y-4 border-b border-slate-100 dark:border-[#2a2b36] pb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Sidebar widget area
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Order, titles, visibility, and custom content are stored in the shared{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#101018] text-xs">
                  sidebarLayout
                </code>{' '}
                setting. Drag rows to reorder, expand a row to edit, or use the arrow controls.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
              <select
                id="widgets-add-type"
                name="widgetsAddType"
                aria-label="Widget type"
                value={selectedWidgetType}
                onChange={(event) => setSelectedWidgetType(event.target.value as WidgetType)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
              >
                {SUPPORTED_WIDGET_TYPES.map((option) => (
                  <option key={option.type} value={option.type}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => addWidget(selectedWidgetType)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors whitespace-nowrap"
              >
                <Plus size={16} /> Add Widget
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {widgets.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-300 dark:border-[#333544] rounded-lg text-slate-500 dark:text-slate-400">
                No sidebar blocks configured. Add a latest-posts, profile, or custom block.
              </div>
            ) : (
              widgets.map((widget, index) => {
                const option = SUPPORTED_WIDGET_TYPES.find((item) => item.type === widget.type);
                const isExpanded = expandedWidgetId === widget.id;
                return (
                  <div
                    key={widget.id}
                    draggable
                    onDragStart={() => handleWidgetDragStart(index)}
                    onDragOver={(event) => handleWidgetDragOver(event, index)}
                    onDragEnd={handleWidgetDragEnd}
                    className={`rounded-lg border bg-slate-50 dark:bg-[#16161e] border-slate-200 dark:border-[#2a2b36] transition-all ${
                      widget.isVisible === false ? 'opacity-60' : ''
                    } ${draggedWidgetIndex === index ? 'scale-[0.99] opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2 p-2.5">
                      <span
                        title="Drag handle"
                        className="cursor-move text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <GripVertical size={16} />
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedWidgetId(isExpanded ? null : widget.id)}
                        aria-expanded={isExpanded}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-white dark:hover:bg-[#1a1b26]"
                        title={isExpanded ? 'Collapse widget' : 'Edit widget'}
                      >
                        <ChevronRight
                          size={16}
                          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>
                      <div className="h-8 w-8 rounded-md bg-white dark:bg-[#1a1b26] border border-slate-200 dark:border-[#2a2b36] flex items-center justify-center text-blue-600 dark:text-blue-300">
                        {widget.type === 'trending' ? (
                          <PanelsTopLeft size={15} />
                        ) : widget.type === 'profile' ? (
                          <UserRound size={15} />
                        ) : (
                          <Type size={15} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {widget.title}
                          </h4>
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            ({widget.type})
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              widget.isVisible === false
                                ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                            }`}
                          >
                            {widget.isVisible === false ? 'Hidden' : 'Visible'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {option?.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveWidget(index, -1)}
                          disabled={index === 0}
                          className="p-1.5 rounded-md border border-slate-200 dark:border-[#2a2b36] text-slate-500 disabled:opacity-30 hover:bg-white dark:hover:bg-[#1a1b26]"
                          title="Move up"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWidget(index, 1)}
                          disabled={index === widgets.length - 1}
                          className="p-1.5 rounded-md border border-slate-200 dark:border-[#2a2b36] text-slate-500 disabled:opacity-30 hover:bg-white dark:hover:bg-[#1a1b26]"
                          title="Move down"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateWidget(widget.id, { isVisible: widget.isVisible === false })
                          }
                          className={`p-1.5 rounded-md border border-slate-200 dark:border-[#2a2b36] ${
                            widget.isVisible === false ? 'text-slate-400' : 'text-green-600'
                          } hover:bg-white dark:hover:bg-[#1a1b26]`}
                          title={widget.isVisible === false ? 'Show' : 'Hide'}
                        >
                          {widget.isVisible === false ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWidget(widget.id)}
                          className="p-1.5 rounded-md border border-slate-200 dark:border-[#2a2b36] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-[#2a2b36] p-4 space-y-4 bg-white dark:bg-[#1a1b26]">
                        <div className="space-y-2">
                          <label
                            htmlFor={`widgets-title-${widget.id}`}
                            className="text-xs font-bold uppercase tracking-wider text-slate-500"
                          >
                            Title
                          </label>
                          <input
                            id={`widgets-title-${widget.id}`}
                            name={`widgetsTitle${widget.id}`}
                            aria-label="Widget title"
                            value={widget.title}
                            onChange={(event) =>
                              updateWidget(widget.id, { title: event.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#101018] text-sm font-bold text-slate-900 dark:text-white"
                          />
                        </div>

                        {widget.type === 'trending' && (
                          <div className="space-y-2">
                            <label
                              htmlFor={`widgets-count-${widget.id}`}
                              className="text-xs font-bold uppercase tracking-wider text-slate-500"
                            >
                              Item Count
                            </label>
                            <select
                              id={`widgets-count-${widget.id}`}
                              name={`widgetsCount${widget.id}`}
                              aria-label="Trending widget item count"
                              value={widget.itemCount || 5}
                              onChange={(event) =>
                                updateWidget(widget.id, { itemCount: Number(event.target.value) })
                              }
                              className="w-full sm:w-32 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#101018] text-sm text-slate-800 dark:text-white"
                            >
                              <option value={3}>3</option>
                              <option value={5}>5</option>
                              <option value={7}>7</option>
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                            </select>
                          </div>
                        )}

                        {widget.type === 'custom' && (
                          <div className="space-y-3">
                            <textarea
                              id={`widgets-content-${widget.id}`}
                              name={`widgetsContent${widget.id}`}
                              aria-label="Custom widget content"
                              value={widget.content || ''}
                              onChange={(event) =>
                                updateWidget(widget.id, { content: event.target.value })
                              }
                              rows={5}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#101018] text-sm font-mono text-slate-700 dark:text-slate-200"
                              placeholder="Paste sanitized HTML, ad snippets, iframe embeds, badges, counters, or plain text."
                            />
                            <div className="rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-100 space-y-1">
                              <p className="font-bold">Custom widget guide</p>
                              <p>
                                Good for ad snippets, iframe embeds, external badges/counters, or
                                static HTML/text blocks.
                              </p>
                              <p>
                                Script and iframe snippets are sanitized and rendered through the
                                existing sandboxed public widget frame.
                              </p>
                              <p>
                                Internal VonCMS stats, post counts, or database-powered counters
                                should use a native widget or plugin instead.
                              </p>
                            </div>
                          </div>
                        )}
                        {widget.type === 'profile' && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Profile widget uses the existing General Settings profile data.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-[#2a2b36] pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail size={18} className="text-cyan-500" />
                Newsletter sidebar placement
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                This controls the existing newsletter widget position. Subscriber management stays
                under Newsletter.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <label
                htmlFor="widgets-newsletter-enabled"
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-[#2a2b36]"
              >
                <div>
                  <span className="block text-sm font-bold text-slate-800 dark:text-white">
                    Enable Newsletter
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Required before footer or sidebar forms render.
                  </span>
                </div>
                <input
                  id="widgets-newsletter-enabled"
                  name="widgetsNewsletterEnabled"
                  type="checkbox"
                  checked={newsletterSettings.enabled}
                  onChange={(event) =>
                    setNewsletterSettings((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 rounded text-cyan-500 focus:ring-cyan-500"
                />
              </label>

              <div className="space-y-2">
                <label
                  htmlFor="widgets-newsletter-position"
                  className="block text-sm font-bold text-slate-800 dark:text-white"
                >
                  Placement
                </label>
                <select
                  id="widgets-newsletter-position"
                  name="widgetsNewsletterPosition"
                  value={newsletterSettings.position}
                  onChange={(event) =>
                    setNewsletterSettings((current) => ({
                      ...current,
                      position: event.target.value as NonNullable<
                        SiteSettings['newsletter']
                      >['position'],
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#101018] text-sm text-slate-800 dark:text-white"
                >
                  <option value="footer">Footer only</option>
                  <option value="sidebar">Sidebar only</option>
                  <option value="both">Footer and sidebar</option>
                </select>
              </div>

              {[
                ['title', 'Title'],
                ['description', 'Description'],
                ['buttonText', 'Button Text'],
                ['successMessage', 'Success Message'],
              ].map(([key, label]) => {
                const fieldId = `widgets-newsletter-${key}`;
                return (
                  <div key={key} className="space-y-2">
                    <label
                      htmlFor={fieldId}
                      className="block text-sm font-bold text-slate-800 dark:text-white"
                    >
                      {label}
                    </label>
                    <input
                      id={fieldId}
                      name={`widgetsNewsletter${key}`}
                      aria-label={`Newsletter ${label}`}
                      value={String(
                        newsletterSettings[key as keyof typeof newsletterSettings] || ''
                      )}
                      onChange={(event) =>
                        setNewsletterSettings((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#101018] text-sm text-slate-800 dark:text-white"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10 p-4 space-y-4">
            <div className="flex gap-3">
              <ShieldCheck
                className="text-emerald-600 dark:text-emerald-400 flex-shrink-0"
                size={20}
              />
              <div>
                <h3 className="font-bold text-emerald-900 dark:text-emerald-100">
                  Security boundary
                </h3>
                <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">
                  This screen uses the existing admin settings save path. Custom block output
                  remains sanitized by the public widget renderer.
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold transition-colors"
            >
              <Save size={18} /> {isSaving ? 'Saving...' : 'Save Widgets'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetsManager;
