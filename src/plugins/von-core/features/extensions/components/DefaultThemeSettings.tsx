import React, { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { GripVertical, Eye, EyeOff, Trash2, Save, Plus, Type, X, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

interface DefaultThemeSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => void;
  onClose: () => void;
}

export const DefaultThemeSettings: React.FC<DefaultThemeSettingsProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  // Initialize temporary state with current settings or defaults
  // Ensure we have the deep structure for independent footer links
  const [tempSettings, setTempSettings] = useState<SiteSettings>({
    ...settings,
    theme: {
      ...settings.theme,
      default: settings.theme.default || {
        footerLinks: [],
        showTrending: true,
        enableMarquee: true,
      },
    },
  });

  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [newWidgetContent, setNewWidgetContent] = useState('');

  const handleChange = (key: string, value: any) => {
    setTempSettings((prev) => ({ ...prev, theme: { ...prev.theme, [key]: value } }));
  };

  // Helper for footer links to keep code clean
  const footerLinks = tempSettings.theme.default?.footerLinks || [];

  const updateFooterLinks = (newLinks: { label: string; url: string }[]) => {
    setTempSettings((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        default: {
          ...prev.theme.default,
          footerLinks: newLinks,
        },
      },
    }));
  };

  // Layout Logic
  const toggleWidgetVisibility = (id: string) =>
    setTempSettings({
      ...tempSettings,
      sidebarLayout: tempSettings.sidebarLayout.map((w) =>
        w.id === id ? { ...w, isVisible: !w.isVisible } : w
      ),
    });
  const deleteWidget = (id: string) => {
    if (confirm('Delete?'))
      setTempSettings({
        ...tempSettings,
        sidebarLayout: tempSettings.sidebarLayout.filter((w) => w.id !== id),
      });
  };
  const addCustomWidget = () => {
    if (!newWidgetTitle) return;
    setTempSettings({
      ...tempSettings,
      sidebarLayout: [
        ...tempSettings.sidebarLayout,
        {
          id: `custom-${Date.now()}`,
          type: 'custom',
          title: newWidgetTitle,
          content: newWidgetContent || '',
          isVisible: true,
        },
      ],
    });
    setNewWidgetTitle('');
    setNewWidgetContent('');
  };

  // Drag and Drop Logic
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newLayout = [...tempSettings.sidebarLayout];
    const draggedItem = newLayout[draggedItemIndex];
    newLayout.splice(draggedItemIndex, 1);
    newLayout.splice(index, 0, draggedItem);

    setTempSettings({ ...tempSettings, sidebarLayout: newLayout });
    setDraggedItemIndex(index);
  };

  const handleSave = () => {
    onUpdate(tempSettings);
    toast.success('Theme settings saved!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1a1b26] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center sticky top-0 bg-white dark:bg-[#1a1b26] z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Type size={24} className="text-primary-600" />
              Default Theme Settings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Customize appearance and layout.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#242633] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto flex-1">
          {/* Brand Colors */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Brand Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Accent Color - for buttons, links, badges */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Accent Color
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Buttons, links, category badges
                </p>
                <div className="flex items-center gap-3">
                  <input
                    aria-label="Accent Color"
                    id="defaultthemesettings-152"
                    name="defaultthemesettings152"
                    type="color"
                    value={tempSettings.theme.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="h-10 w-14 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-400 uppercase">
                    {tempSettings.theme.primaryColor}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleChange('primaryColor', '#0ea5ff')}
                    className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Reset
                  </button>
                </div>
              </div>
              {/* Nav Color - for header & footer */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Header & Footer
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Navigation background color
                </p>
                <div className="flex items-center gap-3">
                  <input
                    id="defaultthemesettings-179"
                    name="defaultthemesettings179"
                    aria-label="Header & Footer"
                    type="color"
                    value={tempSettings.theme?.default?.navColor || '#0f172a'}
                    onChange={(e) =>
                      setTempSettings((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          default: { ...prev.theme.default, navColor: e.target.value },
                        },
                      }))
                    }
                    className="h-10 w-14 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-400 uppercase">
                    {tempSettings.theme?.default?.navColor || '#0f172a'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTempSettings((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          default: { ...prev.theme.default, navColor: '#0f172a' },
                        },
                      }))
                    }
                    className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Font Family
                </span>
                <select
                  aria-label="Font Family"
                  id="defaultthemesettings-217"
                  name="defaultthemesettings217"
                  value={tempSettings.theme.fontFamily}
                  onChange={(e) => handleChange('fontFamily', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg bg-white dark:bg-[#1a1b26] text-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="Inter, sans-serif">Inter (Bundled)</option>
                  <option value="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
                    System Sans
                  </option>
                  <option value="Georgia, 'Times New Roman', serif">System Serif</option>
                </select>
              </div>
            </div>
          </section>

          {/* UI Preferences */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Design System
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Border Radius
                </span>
                <select
                  id="defaultthemesettings-241"
                  name="defaultthemesettings241"
                  aria-label="Border Radius"
                  value={tempSettings.theme.borderRadius}
                  onChange={(e) => handleChange('borderRadius', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-[#2a2b36] rounded-lg bg-white dark:bg-[#1a1b26] text-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="0px">Square (Sharp)</option>
                  <option value="0.25rem">Small (Subtle)</option>
                  <option value="0.5rem">Medium (Standard)</option>
                  <option value="0.75rem">Large (Playful)</option>
                  <option value="1rem">Extra Large (Rounded)</option>
                </select>
              </div>
            </div>
          </section>
          {/* Feature Toggles */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-4 border border-slate-200 dark:border-[#2a2b36] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26] transition-colors">
                <div>
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                    Trending Ticker
                  </span>
                  <span className="block text-[10px] text-slate-500">Show top bar on homepage</span>
                </div>
                <input
                  id="defaultthemesettings-268"
                  name="defaultthemesettings268"
                  type="checkbox"
                  checked={tempSettings.theme.default?.showTrending !== false}
                  onChange={(e) =>
                    setTempSettings((prev: any) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        default: { ...prev.theme.default, showTrending: e.target.checked },
                      },
                    }))
                  }
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>
              <label className="flex items-center justify-between p-4 border border-slate-200 dark:border-[#2a2b36] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1b26] transition-colors">
                <div>
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                    Marquee Animation
                  </span>
                  <span className="block text-[10px] text-slate-500">Enable smooth scrolling</span>
                </div>
                <input
                  id="defaultthemesettings-290"
                  name="defaultthemesettings290"
                  type="checkbox"
                  checked={tempSettings.theme.default?.enableMarquee !== false}
                  onChange={(e) =>
                    setTempSettings((prev: any) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        default: { ...prev.theme.default, enableMarquee: e.target.checked },
                      },
                    }))
                  }
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </label>
            </div>
          </section>

          {/* Sidebar Layout Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Sidebar Layout
            </h3>
            <div className="space-y-3 bg-slate-50 dark:bg-[#1a1b26]/50 p-4 rounded-xl border border-slate-200 dark:border-[#2a2b36]">
              {tempSettings.sidebarLayout.map((widget, index) => (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  className={`flex flex-col gap-2 bg-white dark:bg-[#16161e] border border-slate-200 dark:border-[#2a2b36] p-3 rounded-lg cursor-move hover:border-primary-400 transition-all ${draggedItemIndex === index ? 'opacity-50 scale-95' : ''}`}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                      <GripVertical size={20} />
                    </div>
                    <div className="flex-grow">
                      <div className="text-slate-800 dark:text-white">{widget.title}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-500 uppercase">{widget.type}</div>
                        {widget.type === 'trending' && (
                          <div className="flex items-center gap-1 ml-2 bg-slate-100 dark:bg-[#1a1b26] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2a2b36]">
                            <span className="text-[10px] font-bold text-slate-400">COUNT:</span>
                            <select
                              aria-label="COUNT:"
                              id="defaultthemesettings-333"
                              name="defaultthemesettings333"
                              value={widget.itemCount || 5}
                              onChange={(e) => {
                                const newLayout = tempSettings.sidebarLayout.map((w) =>
                                  w.id === widget.id
                                    ? { ...w, itemCount: parseInt(e.target.value) }
                                    : w
                                );
                                setTempSettings({ ...tempSettings, sidebarLayout: newLayout });
                              }}
                              className="bg-transparent border-none text-[10px] font-bold text-primary-600 focus:ring-0 p-0 cursor-pointer"
                            >
                              <option value={3}>3</option>
                              <option value={5}>5</option>
                              <option value={7}>7</option>
                              <option value={10}>10</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {widget.type === 'custom' && (
                        <button
                          onClick={() =>
                            setEditingWidgetId(editingWidgetId === widget.id ? null : widget.id)
                          }
                          className={`p-2 rounded transition-colors ${
                            editingWidgetId === widget.id
                              ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                              : 'hover:bg-slate-100 dark:hover:bg-[#1a1b26] text-slate-400'
                          }`}
                          title="Edit Content"
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => toggleWidgetVisibility(widget.id)}
                        className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-[#1a1b26] ${widget.isVisible ? 'text-green-600' : 'text-slate-400'}`}
                      >
                        {widget.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                      <button
                        onClick={() => deleteWidget(widget.id)}
                        className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Edit Mode Area */}
                  {editingWidgetId === widget.id && widget.type === 'custom' && (
                    <div className="pl-9 pr-2 pb-2 animate-fade-in w-full">
                      <span className="block text-xs font-medium text-slate-500 mb-1">
                        HTML Content
                      </span>
                      <textarea
                        id="defaultthemesettings-391"
                        name="defaultthemesettings391"
                        aria-label="HTML Content"
                        value={widget.content || ''}
                        onChange={(e) => {
                          const newLayout = tempSettings.sidebarLayout.map((w) =>
                            w.id === widget.id ? { ...w, content: e.target.value } : w
                          );
                          setTempSettings({ ...tempSettings, sidebarLayout: newLayout });
                        }}
                        className="w-full h-24 p-2 text-xs font-mono border border-slate-200 dark:border-[#2a2b36] rounded bg-slate-50 dark:bg-[#101018] text-slate-600 dark:text-slate-300 resize-y focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        placeholder="Enter custom HTML or text content..."
                        onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when clicking textarea
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#2a2b36]">
              <h4 className="font-bold mb-2 text-sm dark:text-white">Add Custom Widget</h4>
              <div className="space-y-2">
                <input
                  aria-label="Custom widget title"
                  id="defaultthemesettings-412"
                  name="defaultthemesettings412"
                  type="text"
                  value={newWidgetTitle}
                  onChange={(e) => setNewWidgetTitle(e.target.value)}
                  placeholder="Widget Title"
                  className="w-full p-2 border rounded dark:bg-[#16161e] dark:border-[#333544] dark:text-white text-sm"
                />
                <textarea
                  id="defaultthemesettings-419"
                  name="defaultthemesettings419"
                  aria-label="Text Content"
                  value={newWidgetContent}
                  onChange={(e) => setNewWidgetContent(e.target.value)}
                  placeholder="HTML Content"
                  className="w-full p-2 border rounded dark:bg-[#16161e] dark:border-[#333544] dark:text-white text-sm h-20"
                />
                <button
                  onClick={addCustomWidget}
                  className="px-4 py-2 bg-[#101018] dark:bg-white text-white dark:text-slate-900 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Add Widget
                </button>
              </div>
            </div>
          </section>

          {/* Footer Settings Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2b36]">
              Footer Customization
            </h3>

            <div className="bg-slate-50 dark:bg-[#16161e] rounded-lg p-5 border border-slate-100 dark:border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Footer Links
                </span>
                <button
                  onClick={() =>
                    updateFooterLinks([...footerLinks, { label: 'New Link', url: '#' }])
                  }
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus size={14} /> Add Link
                </button>
              </div>
              <div className="space-y-2">
                {footerLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      aria-label="Footer link label"
                      id="defaultthemesettings-458"
                      name="defaultthemesettings458"
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        const links = [...footerLinks];
                        links[idx] = { ...links[idx], label: e.target.value };
                        updateFooterLinks(links);
                      }}
                      placeholder="Label"
                      className="flex-1 p-2 rounded border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                    />
                    <input
                      id="defaultthemesettings-469"
                      name="defaultthemesettings469"
                      aria-label="Footer link URL"
                      type="text"
                      value={link.url}
                      onChange={(e) => {
                        const links = [...footerLinks];
                        links[idx] = { ...links[idx], url: e.target.value };
                        updateFooterLinks(links);
                      }}
                      placeholder="URL (e.g. / or https://...)"
                      className="flex-1 p-2 rounded border border-slate-300 dark:border-[#333544] bg-slate-50 dark:bg-[#16161e] dark:text-white text-sm"
                    />
                    <button
                      onClick={() => updateFooterLinks(footerLinks.filter((_, i) => i !== idx))}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {footerLinks.length === 0 && (
                  <p className="text-sm text-slate-500 italic text-center py-2">
                    No links added. Default "Home" & "About" will be shown.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-[#2a2b36] flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-[#1a1b26] z-10 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
