import React, { useState } from 'react';
import { SiteSettings } from '../../../../../types';
import { Trash2, Save, Zap, Palette, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';

interface PrismSettingsProps {
  settings: SiteSettings;
  onUpdate: (s: SiteSettings) => void;
  onClose: () => void;
}

export const PrismSettings: React.FC<PrismSettingsProps> = ({ settings, onUpdate, onClose }) => {
  // Initialize with defaults if undefined
  const initialConfig = settings.theme.prism || {
    neonEffects: true,
    colorScheme: 'cyan',
    fontSize: 'md',
  };

  const [tempConfig, setTempConfig] = useState(initialConfig);

  const handleSave = () => {
    onUpdate({
      ...settings,
      theme: {
        ...settings.theme,
        prism: tempConfig,
      },
    });
    toast.success('Prism config updated!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
      <div className="bg-[#101018] border border-[var(--color-primary)] w-full max-w-lg rounded-none shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative">
        {/* Cyberpunk Header */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>

        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/50">
          <h2 className="text-xl font-bold text-white font-mono tracking-widest uppercase flex items-center gap-2">
            <Zap className="text-cyan-400" size={20} /> PRISM_CONFIG
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <Trash2 size={20} className="rotate-45" />
          </button>
        </div>

        <div className="p-8 space-y-8 font-mono">
          {/* Visual Effects */}
          <div className="space-y-4">
            <label className="flex items-center justify-between text-slate-300 font-bold border-b border-white/10 pb-2">
              <span>NEON_EFFECTS</span>
              <input
                id="prismsettings-54"
                name="prismsettings54"
                type="checkbox"
                checked={tempConfig.neonEffects}
                onChange={(e) => setTempConfig({ ...tempConfig, neonEffects: e.target.checked })}
                className="accent-cyan-500 w-5 h-5 cursor-pointer"
              />
            </label>
            <p className="text-xs text-slate-500">
              Enable/Disable global glowing effects and animations.
            </p>
          </div>

          {/* Color Scheme */}
          <div className="space-y-4">
            <h3 className="text-slate-300 font-bold border-b border-white/10 pb-2 flex items-center gap-2">
              <Palette size={16} /> COLOR_MATRIX
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'cyan', label: 'CYBER_CYAN', color: 'bg-cyan-500' },
                { id: 'purple', label: 'SYNTH_PURPLE', color: 'bg-purple-500' },
                { id: 'green', label: 'MATRIX_GREEN', color: 'bg-green-500' },
              ].map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => setTempConfig({ ...tempConfig, colorScheme: scheme.id as any })}
                  className={`p-4 border text-center transition-all relative overflow-hidden group ${
                    tempConfig.colorScheme === scheme.id
                      ? 'border-white bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                      : 'border-white/10 hover:border-white/50 text-slate-500'
                  }`}
                >
                  <div
                    className={`w-3 h-3 ${scheme.color} rounded-full mx-auto mb-2 shadow-[0_0_10px_currentColor]`}
                  ></div>
                  <span className="text-[10px] font-bold block">{scheme.label}</span>
                  {tempConfig.colorScheme === scheme.id && (
                    <div className="absolute inset-0 border-2 border-white pointer-events-none animate-pulse"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* UI Scaling */}
          <div className="space-y-4">
            <h3 className="text-slate-300 font-bold border-b border-white/10 pb-2 flex items-center gap-2">
              <Monitor size={16} /> UI_DENSITY
            </h3>
            <div className="flex bg-black/50 p-1 border border-white/10">
              {['sm', 'md', 'lg'].map((size) => (
                <button
                  key={size}
                  onClick={() => setTempConfig({ ...tempConfig, fontSize: size as any })}
                  className={`flex-1 py-1 text-xs font-bold transition-all ${
                    tempConfig.fontSize === size
                      ? 'bg-white text-black'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/80 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-white/20 text-slate-400 hover:text-white hover:border-white transition-all font-mono text-xs tracking-wider"
          >
            ABORT
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-2 bg-cyan-600 text-black font-bold hover:bg-cyan-400 shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-all font-mono text-xs tracking-wider flex items-center gap-2 group"
          >
            <Save size={14} className="group-hover:animate-bounce" /> EXECUTE_SAVE
          </button>
        </div>
      </div>
    </div>
  );
};
