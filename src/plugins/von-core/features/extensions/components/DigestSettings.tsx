import React, { useState } from 'react';
import { SiteSettings, SidebarWidget } from '../../../../../types';
import { Palette, X, Save, Plus, Trash2, Eye, EyeOff, GripVertical, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

interface DigestSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => void;
  onClose: () => void;
}

export const DigestSettings: React.FC<DigestSettingsProps> = ({ settings, onUpdate, onClose }) => {
  const [tempSettings, setTempSettings] = useState({
    accentColor: settings.theme?.digest?.accentColor || '#00D1D1',
    showCategoryPills: settings.theme?.digest?.showCategoryPills !== false,
    showHero: settings.theme?.digest?.showHero !== false,
    gridColumns: settings.theme?.digest?.gridColumns || 4,
    showSidebar: settings.theme?.digest?.showSidebar !== false,
    showTrending: settings.theme?.digest?.showTrending !== false,
    enableMarquee: settings.theme?.digest?.enableMarquee !== false,
  });

  // Widget management state
  const [widgets, setWidgets] = useState<SidebarWidget[]>(settings.sidebarLayout || []);
  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [newWidgetContent, setNewWidgetContent] = useState('');
  const [showAddWidget, setShowAddWidget] = useState(false);

  // Drag & Drop + Edit State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  const handleSave = () => {
    onUpdate({
      ...settings,
      theme: {
        ...settings.theme,
        digest: tempSettings,
      },
      sidebarLayout: widgets,
    });
    toast.success('Digest settings saved!');
    onClose();
  };

  const addWidget = () => {
    if (!newWidgetTitle.trim()) return;
    const newWidget: SidebarWidget = {
      id: `widget-${Date.now()}`,
      type: 'custom',
      title: newWidgetTitle,
      content: newWidgetContent,
      isVisible: true,
    };
    setWidgets([...widgets, newWidget]);
    setNewWidgetTitle('');
    setNewWidgetContent('');
    setShowAddWidget(false);
  };

  const deleteWidget = (id: string) => {
    setWidgets(widgets.filter((w) => w.id !== id));
  };

  const toggleWidgetVisibility = (id: string) => {
    setWidgets(widgets.map((w) => (w.id === id ? { ...w, isVisible: !w.isVisible } : w)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1a1b26] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center sticky top-0 bg-white dark:bg-[#1a1b26] z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palette size={24} className="text-cyan-500" />
              Digest Theme Settings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Modern magazine configuration
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#242633] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* === LAYOUT SETTINGS === */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Layout
            </h3>

            {/* Accent Color */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Accent Color
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Badges & buttons</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Accent Color"
                  id="digestsettings-108"
                  name="digestsettings108"
                  type="color"
                  value={tempSettings.accentColor}
                  onChange={(e) =>
                    setTempSettings((prev) => ({ ...prev, accentColor: e.target.value }))
                  }
                  className="h-8 w-12 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs font-mono text-slate-500 uppercase">
                  {tempSettings.accentColor}
                </span>
              </div>
            </div>

            {/* Toggles */}
            {[
              { key: 'showHero', label: 'Show Hero', desc: 'Featured article banner' },
              { key: 'showSidebar', label: 'Show Sidebar', desc: 'Widgets on single post' },
              { key: 'showCategoryPills', label: 'Category Pills', desc: 'Filter buttons' },
              { key: 'showTrending', label: 'Show Trending', desc: 'Top scrolling news bar' },
              {
                key: 'enableMarquee',
                label: 'Marquee Animation',
                desc: 'Enable smooth scrolling',
              },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
                <button
                  onClick={() =>
                    setTempSettings((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    tempSettings[key as keyof typeof tempSettings]
                      ? 'bg-cyan-500'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      tempSettings[key as keyof typeof tempSettings] ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            ))}

            {/* Grid Columns */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Grid Columns
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Posts per row</p>
              </div>
              <select
                id="digestsettings-168"
                name="digestsettings168"
                aria-label="Grid Columns"
                value={tempSettings.gridColumns}
                onChange={(e) =>
                  setTempSettings((prev) => ({
                    ...prev,
                    gridColumns: Number(e.target.value) as 2 | 3 | 4,
                  }))
                }
                className="px-3 py-1.5 border border-slate-200 dark:border-[#2a2b36] rounded-lg bg-white dark:bg-[#1a1b26] text-slate-900 dark:text-white text-sm"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
          </div>

          {/* === SIDEBAR WIDGETS === */}
          {tempSettings.showSidebar && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-[#2a2b36]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                  Sidebar Widgets
                </h3>
                <button
                  onClick={() => setShowAddWidget(!showAddWidget)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600"
                >
                  <Plus size={14} /> Add Widget
                </button>
              </div>

              {/* Add Widget Form */}
              {showAddWidget && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#16161e] space-y-3">
                  <input
                    aria-label="Widget Title (e.g. AdSense, Sponsor)"
                    id="widget-title-e-g-adsense-sponsor"
                    name="widgetTitleEGAdsenseSponsor"
                    type="text"
                    placeholder="Widget Title (e.g. AdSense, Sponsor)"
                    value={newWidgetTitle}
                    onChange={(e) => setNewWidgetTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] text-slate-900 dark:text-white text-sm"
                  />
                  <textarea
                    id="html-content-paste-adsense-code-here"
                    name="htmlContentPasteAdsenseCodeHere"
                    aria-label="HTML Content (paste AdSense code here)"
                    placeholder="HTML Content (paste AdSense code here)"
                    value={newWidgetContent}
                    onChange={(e) => setNewWidgetContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#1a1b26] text-slate-900 dark:text-white text-sm font-mono"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddWidget(false)}
                      className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addWidget}
                      className="px-4 py-1.5 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Widget List */}
              <div className="space-y-2">
                {widgets.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                    No widgets. Click "Add Widget" to add AdSense or custom HTML.
                  </p>
                ) : (
                  widgets.map((widget, index) => (
                    <div
                      key={widget.id}
                      draggable
                      onDragStart={() => setDraggedItemIndex(index)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedItemIndex === null || draggedItemIndex === index) return;
                        const newWidgets = [...widgets];
                        const draggedItem = newWidgets[draggedItemIndex];
                        newWidgets.splice(draggedItemIndex, 1);
                        newWidgets.splice(index, 0, draggedItem);
                        setWidgets(newWidgets);
                        setDraggedItemIndex(index);
                      }}
                      className={`flex flex-col gap-2 p-3 rounded-lg border transition-all ${
                        widget.isVisible
                          ? 'bg-white dark:bg-[#1a1b26] border-slate-200 dark:border-[#2a2b36]'
                          : 'bg-slate-100 dark:bg-[#16161e] border-slate-200 dark:border-white/10 opacity-60'
                      } ${draggedItemIndex === index ? 'opacity-50 scale-95' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="cursor-move text-slate-400 hover:text-slate-600 active:cursor-grabbing">
                          <GripVertical size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                            {widget.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {widget.type}
                          </p>
                          {widget.type === 'trending' && (
                            <div className="flex items-center gap-1 mt-1 bg-slate-50 dark:bg-[#16161e] px-2 py-0.5 rounded border border-slate-200 dark:border-[#2a2b36] w-fit">
                              <span className="text-[10px] font-bold text-slate-400">COUNT:</span>
                              <select
                                aria-label="COUNT:"
                                id="digestsettings-276"
                                name="digestsettings276"
                                value={widget.itemCount || 5}
                                onChange={(e) => {
                                  setWidgets(
                                    widgets.map((w) =>
                                      w.id === widget.id
                                        ? { ...w, itemCount: parseInt(e.target.value) }
                                        : w
                                    )
                                  );
                                }}
                                className="bg-transparent border-none text-[10px] font-bold text-cyan-500 focus:ring-0 p-0 cursor-pointer"
                              >
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                                <option value={7}>7</option>
                                <option value={10}>10</option>
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {widget.type === 'custom' && (
                            <button
                              onClick={() =>
                                setEditingWidgetId(editingWidgetId === widget.id ? null : widget.id)
                              }
                              className={`p-1.5 rounded transition-colors ${
                                editingWidgetId === widget.id
                                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'hover:bg-slate-100 dark:hover:bg-[#242633] text-slate-500'
                              }`}
                              title="Edit Content"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => toggleWidgetVisibility(widget.id)}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-[#242633] text-slate-500"
                            title={widget.isVisible ? 'Hide' : 'Show'}
                          >
                            {widget.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                          </button>
                          <button
                            onClick={() => deleteWidget(widget.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Edit Mode for Custom Widgets */}
                      {editingWidgetId === widget.id && widget.type === 'custom' && (
                        <div className="mt-2 pl-8 animate-fade-in">
                          <span className="block text-xs font-medium text-slate-500 mb-1">
                            HTML Content
                          </span>
                          <textarea
                            id="digestsettings-336"
                            name="digestsettings336"
                            aria-label="HTML Content"
                            value={widget.content || ''}
                            onChange={(e) => {
                              setWidgets(
                                widgets.map((w) =>
                                  w.id === widget.id ? { ...w, content: e.target.value } : w
                                )
                              );
                            }}
                            className="w-full h-24 px-3 py-2 text-xs font-mono border border-slate-200 dark:border-[#2a2b36] rounded bg-slate-50 dark:bg-[#16161e] text-slate-600 dark:text-slate-300 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholder="Custom HTML..."
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-[#2a2b36] flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-[#1a1b26] z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium shadow-lg shadow-cyan-500/30 transition-all flex items-center gap-2"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
