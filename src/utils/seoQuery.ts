const SEO_QUERY_WHITESPACE =
  /[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+/gu;

export const normalizeSeoQueryWhitespace = (value: string): string =>
  value.replace(SEO_QUERY_WHITESPACE, ' ').trim();

export const hasNonemptySeoQueryValue = (value: string): boolean =>
  normalizeSeoQueryWhitespace(value) !== '';

export const normalizeDiscoveryQueryValue = (
  value: string | null | undefined,
  maxLength: number
): string => {
  if (!value || maxLength <= 0) return '';

  const template = document.createElement('template');
  template.innerHTML = value;
  template.content.querySelectorAll('script, style, noscript, template').forEach((element) => {
    element.remove();
  });
  const normalized = normalizeSeoQueryWhitespace(template.content.textContent || '');

  return Array.from(normalized).slice(0, maxLength).join('');
};
