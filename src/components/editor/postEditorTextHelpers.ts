export const getPostEditorCleanText = (html: string, limit?: number) => {
  if (!html) return '';

  const rawHtml = html.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|div|h\d|li|tr|ul|ol)>/gi, ' ');
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  let text = doc.body.textContent || '';

  if (text.match(/&[#a-zA-Z0-9]+;/)) {
    const decodedDoc = new DOMParser().parseFromString(text, 'text/html');
    text = decodedDoc.body.textContent || text;
  }

  text = text.replace(/\s+/g, ' ').trim();

  const characters = Array.from(text);
  if (limit && characters.length > limit) {
    const suffix = '...';
    const suffixCharacters = Array.from(suffix).slice(0, limit);
    const contentLimit = Math.max(0, limit - suffixCharacters.length);
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

    return truncatedCharacters.join('').trimEnd() + suffixCharacters.join('');
  }

  return text;
};
