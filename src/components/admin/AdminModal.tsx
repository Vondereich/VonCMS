import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  children,
  ariaLabel = 'Admin dialog',
  ariaLabelledBy,
  className = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeOnEscapeRef.current = closeOnEscape;
  }, [closeOnEscape]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable || dialogRef.current)?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      const modalLayers = document.querySelectorAll('.admin-modal-layer');
      const isTopModal =
        modalLayers.length > 0 &&
        modalLayers[modalLayers.length - 1] === dialogRef.current?.parentElement;
      if (!isTopModal) return;

      if (event.key === 'Escape') {
        if (!closeOnEscapeRef.current) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;
  const isDark =
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    Boolean(document.querySelector('.admin-shell.dark'));

  return createPortal(
    <div
      className={`admin-modal-layer modal-enter ${isDark ? 'dark' : ''}`}
      onPointerDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className={`min-w-0 outline-hidden ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default AdminModal;
