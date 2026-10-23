import { decodeEntities } from '../../utils/textUtils';
import { truncateSchemaText } from '../../utils/articleSchema';
import { htmlToPlainText } from '../../utils/security';

export const getPostEditorCleanText = (html: string, limit?: number) => {
  if (!html) return '';

  let text = htmlToPlainText(html, {
    preserveLiteralComparisons: true,
    preserveBlockSpacing: true,
  });

  if (text.match(/&[#a-zA-Z0-9]+;/)) {
    text = decodeEntities(text);
  }

  text = text.replace(/\s+/g, ' ').trim();

  return limit ? truncateSchemaText(text, limit) : text;
};

// Editor button suggestions only; stored text and public snippet truncation stay unchanged.
export const getPostEditorAutofillText = (html: string, limit: number): string => {
  if (!Number.isFinite(limit) || limit < 1) return '';
  const text = getPostEditorCleanText(html);
  const finish = (value: string) => {
    const sentence = value.trim().replace(/[.\u2026]+(?=["'\u201d\u2019\u00bb)\]}]*$)/u, '.');
    return /[.!?\u3002\uff01\uff1f]["'\u201d\u2019\u00bb)\]}]*$/u.test(sentence)
      ? sentence
      : `${sentence}.`;
  };

  let suggestion = '';
  // ASCII stops need whitespace/end (not decimals/URLs); CJK stops need no space.
  for (const match of text.matchAll(
    /[\u3002\uff01\uff1f]+["'\u201d\u2019\u00bb)\]}]*|[.!?\u2026]+["'\u201d\u2019\u00bb)\]}]*(?=\s|$)/gu
  )) {
    const prefix = text.slice(0, match.index + match[0].length);
    const token = prefix.match(/\S+$/u)?.[0] || '';
    if (/^(?:https?:\/\/|www\.)/iu.test(token)) continue;
    if (
      /(?:^|\s)(?:dr|mr|mrs|ms|prof|sr|jr|st|vs|etc|sdn|bhd|en|pn|tn|a\.m|p\.m)\.$/iu.test(prefix)
    )
      continue;
    if (/^(?:[a-z]\.){2,}$/iu.test(token)) continue;
    const candidate = finish(prefix);
    if (candidate.length > limit) break;
    suggestion = candidate;
  }
  if (suggestion) return suggestion;

  // Reserve the final stop within the textarea budget; never split an oversized token.
  let prefix = '';
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    const next = prefix ? `${prefix} ${word}` : word;
    const candidate = finish(next);
    if (candidate.length > limit) break;
    prefix = next;
    suggestion = candidate;
  }
  return suggestion;
};
