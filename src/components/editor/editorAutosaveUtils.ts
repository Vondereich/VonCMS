export const canAutoSaveEditorDraft = (status: string | undefined, title: string | undefined) =>
  (status || 'draft') === 'draft' && Boolean(title?.trim());
