import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Login from '../plugins/von-core/features/auth/Login';
import { BASE_PATH } from '../config/site.config';
import type { SiteSettings, User } from '../types';

interface AuthModalProps {
  settings: SiteSettings;
  onLogin: (user: User) => void;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
const SUCCESS_TOAST_ID = 'public-login-success';

const AuthModal: React.FC<AuthModalProps> = ({ settings, onLogin, onClose }) => {
  const location = useLocation();
  const path = location.pathname.startsWith(BASE_PATH)
    ? '/' + location.pathname.slice(BASE_PATH.length)
    : location.pathname;
  const isPublicLogin = !/^\/admin(?:\/|$)/i.test(path);
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const initialRoute = useRef({ key: location.key, public: isPublicLogin });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initialRoute.current.public && initialRoute.current.key !== location.key) {
      if (completedRef.current) toast.dismiss(SUCCESS_TOAST_ID);
      onClose();
    }
  }, [location.key, onClose]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onClose, 180);
    return () => window.clearTimeout(timer);
  }, [leaving, onClose]);

  useEffect(() => {
    if (!isPublicLogin) return;
    const dialog = panelRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('input:not([tabindex="-1"]):not([type="hidden"])')
        ?.focus({ preventScroll: true });
    }, 0);

    const keydown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel || !['Escape', 'Tab'].includes(event.key)) return;
      if (panel.inert) {
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      const controls = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (control) => control.tabIndex >= 0 && control.getClientRects().length > 0
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      // StrictMode rehearses effects while the dialog still exists. Hand focus
      // back only when the modal is actually removed.
      if (dialog?.isConnected) return;
      if (
        previousFocus?.isConnected &&
        previousFocus !== document.body &&
        previousFocus !== document.documentElement &&
        previousFocus.getClientRects().length > 0 &&
        !previousFocus.matches(':disabled') &&
        !previousFocus.closest('[inert]')
      ) {
        previousFocus.focus({ preventScroll: true });
      } else {
        // Signing in replaces the guest trigger. Continue from the public content
        // rather than leaving keyboard focus on a removed form control.
        const target =
          document.querySelector<HTMLElement>('main') ||
          document.querySelector<HTMLElement>('h1') ||
          document.querySelector<HTMLElement>('header a[href]');
        if (target) {
          const hadTabIndex = target.hasAttribute('tabindex');
          const suppressContentFrame = target.matches('main, h1');
          const previousOutline = target.style.getPropertyValue('outline');
          const previousOutlinePriority = target.style.getPropertyPriority('outline');
          if (!hadTabIndex) target.setAttribute('tabindex', '-1');
          // Focus a non-interactive content landmark without framing the hero.
          // Interactive controls keep their normal keyboard-focus indicators.
          if (suppressContentFrame) target.style.setProperty('outline', 'none');
          if (!hadTabIndex || suppressContentFrame) {
            target.addEventListener(
              'blur',
              () => {
                if (!hadTabIndex && target.getAttribute('tabindex') === '-1') {
                  target.removeAttribute('tabindex');
                }
                if (
                  suppressContentFrame &&
                  target.style.getPropertyValue('outline') === 'none' &&
                  target.style.getPropertyPriority('outline') === ''
                ) {
                  if (previousOutline) {
                    target.style.setProperty('outline', previousOutline, previousOutlinePriority);
                  } else {
                    target.style.removeProperty('outline');
                  }
                }
              },
              { once: true }
            );
          }
          target.focus({ preventScroll: true });
        }
      }
    };
  }, [isPublicLogin, onClose]);

  const handleLogin = (user: User) => {
    // Authentication takes effect immediately; only the visual dismissal is timed.
    onLogin(user);
    if (!mountedRef.current || completedRef.current) return;
    completedRef.current = true;
    if (!isPublicLogin) {
      onClose();
      return;
    }

    const dark = document.documentElement.classList.contains('dark');
    const background = dark ? '#202020' : '#fdfdfd';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    toast.success('Signed in successfully', {
      id: SUCCESS_TOAST_ID,
      position: 'top-right',
      duration: 2000,
      style: {
        background,
        color: dark ? '#f2f2f2' : '#1c1c1c',
        border: `1px solid ${dark ? '#383838' : '#e2e2df'}`,
        ...(reducedMotion ? { animation: 'none', transition: 'none' } : {}),
      },
      icon: (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: dark ? '#2c3d25' : '#edf3e9',
            color: dark ? '#a2d18f' : '#3d6b34',
          }}
        >
          <Check size={16} />
        </span>
      ),
    });
    if (reducedMotion) {
      onClose();
    } else {
      setLeaving(true);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 ${isPublicLogin ? `transition-opacity duration-180 motion-reduce:transition-none ${leaving ? 'pointer-events-none opacity-0' : 'animate-fade-in motion-reduce:animate-none'}` : 'animate-fade-in'}`}
      data-auth-modal-phase={leaving ? 'leaving' : 'open'}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account access"
        tabIndex={-1}
        inert={leaving}
        className="relative w-full max-w-lg has-data-[auth-view=register]:max-w-160"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={leaving}
          aria-label="Close sign in"
          className="absolute -top-12 right-0 text-white transition-colors hover:text-slate-300"
        >
          <X size={24} />
        </button>
        <Login settings={settings} onLogin={handleLogin} isModal={true} />
      </div>
    </div>
  );
};

export default AuthModal;
