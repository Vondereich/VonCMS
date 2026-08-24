export type SocialImageKind = 'featured' | 'profile' | 'large' | 'square' | 'logo' | 'default';

export interface SocialImageCandidate {
  url?: string | null;
  kind: SocialImageKind;
}

export interface ResolvedSocialImage {
  url: string;
  kind: SocialImageKind | null;
  card: 'summary' | 'summary_large_image';
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

const decodeHtmlEntityLayer = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity, token: string) => {
    const normalizedToken = token.toLowerCase();
    if (normalizedToken.startsWith('#x')) {
      const codePoint = Number.parseInt(normalizedToken.slice(2), 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    if (normalizedToken.startsWith('#')) {
      const codePoint = Number.parseInt(normalizedToken.slice(1), 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return HTML_ENTITIES[normalizedToken] ?? entity;
  });

export const normalizePublicMediaUrl = (value: unknown, maxLength = 2048): string => {
  if (typeof value !== 'string') return '';

  let url = value.trim();
  const legacyContentValue = url.match(
    /^\s*<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*>\s*$/i
  )?.[1];
  if (legacyContentValue) url = legacyContentValue;
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = decodeHtmlEntityLayer(url);
    if (decoded === url) break;
    url = decoded;
  }
  url = url.trim();

  try {
    decodeURIComponent(url);
  } catch {
    return '';
  }

  if (
    !url ||
    url.length > Math.max(1, maxLength) ||
    /[\u0000-\u0020\u007f<>"'`\\]/u.test(url) ||
    url.startsWith('//')
  ) {
    return '';
  }

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return '';
      if (parsed.username || parsed.password) return '';
      return url;
    } catch {
      return '';
    }
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '';

  const path = url.split('?', 1)[0];
  if (!path) return '';
  try {
    const decodedPath = decodeURIComponent(path);
    if (/[\u0000-\u0020\u007f\\]/u.test(decodedPath)) return '';
    if (decodedPath.split('/').some((segment) => segment === '.' || segment === '..')) return '';
  } catch {
    return '';
  }

  return url;
};

export const toAbsolutePublicMediaUrl = (value: unknown, domainUrl: string): string => {
  const normalizedUrl = normalizePublicMediaUrl(value);
  if (!normalizedUrl) return '';
  if (/^https?:\/\//i.test(normalizedUrl)) return normalizedUrl;

  try {
    const base = new URL(domainUrl);
    const canonicalPath = base.pathname.replace(/\/$/, '');
    const relativeCanonicalPath = canonicalPath.replace(/^\/+/, '');
    if (
      canonicalPath &&
      (normalizedUrl === canonicalPath ||
        normalizedUrl.startsWith(`${canonicalPath}/`) ||
        normalizedUrl === relativeCanonicalPath ||
        normalizedUrl.startsWith(`${relativeCanonicalPath}/`))
    ) {
      return `${base.origin}/${normalizedUrl.replace(/^\/+/, '')}`;
    }
    return `${domainUrl.replace(/\/+$/, '')}/${normalizedUrl.replace(/^\/+/, '')}`;
  } catch {
    return '';
  }
};

export const resolveSocialImage = (
  candidates: SocialImageCandidate[],
  domainUrl: string
): ResolvedSocialImage => {
  for (const candidate of candidates) {
    const url = toAbsolutePublicMediaUrl(candidate.url, domainUrl);
    if (!url) continue;

    return {
      url,
      kind: candidate.kind,
      card: ['featured', 'large', 'default'].includes(candidate.kind)
        ? 'summary_large_image'
        : 'summary',
    };
  }

  return { url: '', kind: null, card: 'summary' };
};
