import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeDiscoveryQueryValue } from '../utils/seoQuery';

const PUBLIC_SEARCH_MAX_LENGTH = 120;
const PUBLIC_SEARCH_URL_DELAY_MS = 300;

interface PublicSearchUrlStateOptions {
  searchParams: URLSearchParams;
  navigationKey: string;
  navigationState?: unknown;
  writeSearchParams: (
    searchParams: URLSearchParams,
    options: { replace: true; state?: unknown }
  ) => void;
}

export const usePublicSearchUrlState = ({
  searchParams,
  navigationKey,
  navigationState,
  writeSearchParams,
}: PublicSearchUrlStateOptions) => {
  const urlQuery = normalizeDiscoveryQueryValue(
    searchParams.get('search'),
    PUBLIC_SEARCH_MAX_LENGTH
  );
  const [query, setQuery] = useState(urlQuery);
  const queryRef = useRef(query);
  const timeoutRef = useRef<number | null>(null);
  const latestSearchParamsRef = useRef(searchParams);
  const navigationStateRef = useRef(navigationState);

  queryRef.current = query;
  latestSearchParamsRef.current = searchParams;
  navigationStateRef.current = navigationState;

  const clearPendingUpdate = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const replaceUrlQuery = useCallback(
    (nextQuery: string) => {
      const nextSearchParams = new URLSearchParams(latestSearchParamsRef.current);
      Array.from(nextSearchParams.keys()).forEach((key) => {
        if (
          key === 'search' ||
          key.startsWith('search[') ||
          key === 'page' ||
          key.startsWith('page[')
        ) {
          nextSearchParams.delete(key);
        }
      });

      if (nextQuery !== '') nextSearchParams.set('search', nextQuery);
      writeSearchParams(nextSearchParams, {
        replace: true,
        state: navigationStateRef.current,
      });
    },
    [writeSearchParams]
  );

  useEffect(() => {
    clearPendingUpdate();
    const currentNormalizedQuery = normalizeDiscoveryQueryValue(
      queryRef.current,
      PUBLIC_SEARCH_MAX_LENGTH
    );

    // A debounced URL write intentionally stores the normalized search value.
    // Keep the user's raw spacing in the controlled input when both values still
    // describe the same search, while genuine URL navigation remains authoritative.
    if (currentNormalizedQuery !== urlQuery || currentNormalizedQuery === '') {
      setQuery(urlQuery);
    }
  }, [clearPendingUpdate, navigationKey, urlQuery]);

  useEffect(() => clearPendingUpdate, [clearPendingUpdate]);

  const updateQuery = useCallback(
    (value: string) => {
      const boundedValue = value.slice(0, PUBLIC_SEARCH_MAX_LENGTH);
      const normalizedValue = normalizeDiscoveryQueryValue(boundedValue, PUBLIC_SEARCH_MAX_LENGTH);

      setQuery(boundedValue);
      clearPendingUpdate();

      if (normalizedValue === '') {
        replaceUrlQuery('');
        return;
      }

      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        replaceUrlQuery(normalizedValue);
      }, PUBLIC_SEARCH_URL_DELAY_MS);
    },
    [clearPendingUpdate, replaceUrlQuery]
  );

  return { query, updateQuery };
};
