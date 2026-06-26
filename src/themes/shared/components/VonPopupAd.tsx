import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import AdBlock from './AdBlock';

interface VonPopupAdProps {
  show: boolean;
  onClose: () => void;
  content: string;
}

export const VonPopupAd: React.FC<VonPopupAdProps> = ({ show, onClose, content }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      return undefined;
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!isVisible && !show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />

      {/* 
        MODERN POPUP AD CONTAINER 
        Security Note: Ad content is sanitized via the AdBlock component (using DOMPurify in sanitizeHtml).
        We delegate sanitization to AdBlock to ensure consistent security across all ad slots.
      */}
      <div
        className={`relative w-full max-w-[95vw] md:max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl transform transition-all duration-300 ${
          show ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all z-[60] group border border-slate-100 dark:border-slate-700"
          aria-label="Close Ad"
        >
          <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        <div className="overflow-visible rounded-xl bg-slate-50 dark:bg-slate-900/50">
          <AdBlock content={content} slotId="popup" />
        </div>
      </div>
    </div>
  );
};

export default VonPopupAd;
