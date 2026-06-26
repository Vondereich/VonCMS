export const COMPLEX_QUERY_STRING_LINK_SMOKE_URL =
  'https://example.test/link?empty=&type=phone_number&app_absent=0';

export const normalizeEditorUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '';
  return `https://${trimmed}`;
};

export const buildEditorLinkAttrs = (href: string) => ({
  href,
  target: '_blank',
  rel: 'noopener noreferrer',
});
