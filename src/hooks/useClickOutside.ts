import { useEffect, useCallback, RefObject } from 'react';

/**
 * Hook to detect clicks outside a referenced element.
 * Commonly used for closing dropdowns/modals.
 */
export const useClickOutside = (
  ref: RefObject<HTMLElement | null>,
  callback: () => void,
  enabled: boolean = true
) => {
  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    },
    [ref, callback]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [handleClick, enabled]);
};

export default useClickOutside;
