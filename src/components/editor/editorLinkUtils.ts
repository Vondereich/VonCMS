export const COMPLEX_QUERY_STRING_LINK_SMOKE_URL =
  'https://example.test/link?empty=&type=phone_number&app_absent=0';

export const normalizeEditorUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes('\\') || trimmed.startsWith('//')) return '';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '';
  return `https://${trimmed}`;
};

export type EditorLinkRelationship = 'normal' | 'sponsored' | 'nofollow' | 'ugc';

const LINK_QUALIFIERS = ['sponsored', 'nofollow', 'ugc'] as const;

export const editorLinkRelationshipFromRel = (
  rel: string | null | undefined
): EditorLinkRelationship => {
  const tokens = new Set((rel || '').toLowerCase().split(/\s+/));
  return LINK_QUALIFIERS.find((token) => tokens.has(token)) || 'normal';
};

export const normalizeEditorLinkRel = (rel: string | null | undefined, newTab: boolean): string => {
  const tokens = new Set((rel || '').toLowerCase().split(/\s+/));
  return [
    ...(newTab ? ['noopener', 'noreferrer'] : []),
    ...LINK_QUALIFIERS.filter((token) => tokens.has(token)),
  ].join(' ');
};

export const buildEditorLinkAttrs = (
  href: string,
  relationship: EditorLinkRelationship = 'normal'
) => ({
  href,
  target: '_blank',
  rel: normalizeEditorLinkRel(relationship, true),
});
