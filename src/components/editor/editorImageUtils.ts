export interface EditorImageInput {
  url: string;
  alt?: string;
  id?: string | number | null;
}

const escapeImageAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export const buildEditorImageHtml = (image: EditorImageInput) => {
  const alt = escapeImageAttribute(image.alt || '');
  const dataId =
    image.id !== undefined && image.id !== null && image.id !== ''
      ? ` data-id="${escapeImageAttribute(String(image.id))}"`
      : '';
  return `<img src="${escapeImageAttribute(image.url)}" alt="${alt}"${dataId} class="rounded-lg shadow-xs" style="max-width: 100%; height: auto;" />`;
};
