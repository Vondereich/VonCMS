import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import config from './login_modal.json';

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
  themeColor?: string;
  children?: React.ReactNode;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ open, onClose, themeColor, children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const cfg = config as any;
  const modalBg = cfg.modalStyle?.bg || '#fff';
  const modalRadius = cfg.modalStyle?.radius || '10px';
  const modalPadding = cfg.modalStyle?.padding || '20px';
  const modalWidth = cfg.modalStyle?.width || '380px';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // focus modal for accessibility
    setTimeout(() => ref.current?.focus?.(), 10);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: cfg.background || 'rgba(0,0,0,0.6)',
        backdropFilter: `blur(${cfg.backdropBlur || '6px'})`,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="shadow-2xl"
        style={{
          background: modalBg,
          borderRadius: modalRadius,
          padding: modalPadding,
          width: modalWidth,
          border: '1px solid rgba(15,23,42,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {cfg.showBadge && (
              <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-sm">
                {cfg.badgeText || 'Premium'}
              </span>
            )}
            <h2 className="mt-3 text-xl font-semibold text-slate-900">{cfg.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
          </div>

          {cfg.showClose && (
            <button
              onClick={onClose}
              className="ml-4 -mr-2 p-2 rounded-md bg-white/90 hover:bg-white dark:bg-slate-800 shadow-sm"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="mt-6">
          {/* If caller provides children (Login form), render it here; otherwise render default CTAs */}
          {children ? (
            children
          ) : (
            <div className="flex gap-3">
              <button
                className="flex-1 text-white py-2 rounded-sm font-semibold"
                style={{ background: themeColor || cfg.themeColor || '#0ea5ff' }}
              >
                {cfg.buttonLogin}
              </button>
              <button className="flex-1 border border-slate-200 text-slate-800 py-2 rounded-sm">
                {cfg.buttonRegister}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
