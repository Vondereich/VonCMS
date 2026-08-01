const serializeSettingValue = (value: unknown): string | undefined => JSON.stringify(value);

/**
 * Apply only fields that changed inside a settings draft to the latest global settings.
 * This prevents an older full-form snapshot from overwriting settings owned by another screen.
 */
export const mergeSettingsDraft = <T extends object>(latest: T, baseline: T, draft: T): T => {
  const merged = { ...latest } as Record<string, unknown>;
  const baselineRecord = baseline as Record<string, unknown>;
  const draftRecord = draft as Record<string, unknown>;

  Object.keys(draftRecord).forEach((key) => {
    if (serializeSettingValue(draftRecord[key]) !== serializeSettingValue(baselineRecord[key])) {
      merged[key] = draftRecord[key];
    }
  });

  return merged as T;
};

/**
 * Reduce a full settings object to the changed top-level fields accepted by save_settings.php.
 * A tab can then persist its own action without replaying unrelated state loaded by that tab.
 */
export const createSettingsPatch = <T extends object>(baseline: T, next: T): Partial<T> => {
  const patch: Record<string, unknown> = {};
  const baselineRecord = baseline as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;

  Object.keys(nextRecord).forEach((key) => {
    if (serializeSettingValue(nextRecord[key]) !== serializeSettingValue(baselineRecord[key])) {
      patch[key] = nextRecord[key];
    }
  });

  return patch as Partial<T>;
};
