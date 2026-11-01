const serializeSettingValue = (value: unknown): string | undefined => JSON.stringify(value);
const isSettingsObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Apply only fields that changed inside a settings draft to the latest global settings.
 * Nested groups retain refreshed sibling fields; ordered lists remain atomic values.
 * This prevents an older full-form snapshot from overwriting settings owned by another screen.
 */
export const mergeSettingsDraft = <T extends object>(latest: T, baseline: T, draft: T): T => {
  const merged = { ...latest } as Record<string, unknown>;
  const baselineRecord = baseline as Record<string, unknown>;
  const draftRecord = draft as Record<string, unknown>;

  Object.keys(draftRecord).forEach((key) => {
    if (serializeSettingValue(draftRecord[key]) !== serializeSettingValue(baselineRecord[key])) {
      const latestValue = merged[key];
      const baselineValue = baselineRecord[key];
      const draftValue = draftRecord[key];
      if (
        isSettingsObject(latestValue) &&
        isSettingsObject(baselineValue) &&
        isSettingsObject(draftValue)
      ) {
        const group = mergeSettingsDraft(latestValue, baselineValue, draftValue);
        for (const field of Object.keys(baselineValue)) {
          if (!Object.hasOwn(draftValue, field)) delete group[field];
        }
        merged[key] = group;
      } else {
        merged[key] = draftValue;
      }
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
