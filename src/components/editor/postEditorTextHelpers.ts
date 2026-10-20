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
