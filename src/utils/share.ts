export const getCleanShareUrl = (url?: string, currentHref?: string): string => {
  const browserHref = currentHref || (typeof window !== 'undefined' ? window.location.href : '');
  const candidate = url?.trim() || browserHref;
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate, browserHref || undefined);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return '';
  }
};

export const copyShareUrl = async (url: string): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // Fall back to the selection-based copy method below.
  }

  if (typeof document === 'undefined') return false;
  const input = document.createElement('textarea');
  input.value = url;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();

  try {
    return document.execCommand('copy');
  } finally {
    input.remove();
  }
};
