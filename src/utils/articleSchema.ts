export const ARTICLE_SCHEMA_TYPES = ['Article', 'NewsArticle', 'BlogPosting'] as const;
export type ArticleSchemaType = (typeof ARTICLE_SCHEMA_TYPES)[number];

export const normalizeArticleSchemaType = (value: unknown): ArticleSchemaType =>
  typeof value === 'string' && ARTICLE_SCHEMA_TYPES.includes(value as ArticleSchemaType)
    ? (value as ArticleSchemaType)
    : 'Article';

export const normalizeSchemaLanguage = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  const primaryLanguage = value.split(',', 1)[0]?.trim();
  if (!primaryLanguage || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(primaryLanguage)) {
    return '';
  }

  return primaryLanguage
    .split('-')
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      if (/^[A-Za-z]{4}$/.test(part)) {
        return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
      }
      if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
      return part.toLowerCase();
    })
    .join('-');
};

export const truncateSchemaText = (
  value: unknown,
  maxLength: number,
  suffix: string = '...'
): string => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text || maxLength <= 0) return '';
  const characters = Array.from(text);
  if (characters.length <= maxLength) return text;

  const safeSuffixCharacters = Array.from(suffix).slice(0, maxLength);
  const safeSuffix = safeSuffixCharacters.join('');
  const contentLimit = Math.max(0, maxLength - safeSuffixCharacters.length);
  if (contentLimit === 0) return safeSuffix;

  let truncatedCharacters = characters.slice(0, contentLimit);
  const nextCharacter = characters[contentLimit] || '';
  if (nextCharacter && !/\s/.test(nextCharacter)) {
    let lastSpace = -1;
    for (
      let characterIndex = truncatedCharacters.length - 1;
      characterIndex >= 0;
      characterIndex -= 1
    ) {
      if (/\s/.test(truncatedCharacters[characterIndex])) {
        lastSpace = characterIndex;
        break;
      }
    }
    if (lastSpace > 0) {
      truncatedCharacters = truncatedCharacters.slice(0, lastSpace);
    }
  }

  const truncated = truncatedCharacters.join('').trimEnd();
  return `${truncated}${safeSuffix}`;
};
