import { useCallback, useEffect, useMemo, useState } from 'react';

const DEFAULT_SEARCH_DELAY_MS = 300;
const DEFAULT_SEARCH_MAX_LENGTH = 120;

export const normalizeDebouncedSearchQuery = (
  value: string,
  maxLength = DEFAULT_SEARCH_MAX_LENGTH
): string => value.trim().slice(0, Math.max(1, maxLength));

export const useDebouncedSearchQuery = (
  input: string,
  delayMs = DEFAULT_SEARCH_DELAY_MS,
  maxLength = DEFAULT_SEARCH_MAX_LENGTH
) => {
  const normalizedInput = useMemo(
    () => normalizeDebouncedSearchQuery(input, maxLength),
    [input, maxLength]
  );
  const [query, setQuery] = useState(normalizedInput);

  useEffect(() => {
    if (normalizedInput === '') {
      setQuery('');
      return;
    }

    const timeout = window.setTimeout(() => setQuery(normalizedInput), Math.max(0, delayMs));
    return () => window.clearTimeout(timeout);
  }, [delayMs, normalizedInput]);

  const commit = useCallback(() => {
    setQuery(normalizedInput);
    return normalizedInput;
  }, [normalizedInput]);

  return { query, commit };
};
