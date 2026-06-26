/**
 * VonCMS - useSinglePage Hook
 * Fetches a page by id or slug when the public preload list has not resolved it yet.
 */
import { useEffect, useRef, useState } from 'react';
import { Page } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

interface UseSinglePageResult {
  fullPage: Page | null;
  isLoading: boolean;
}

export const useSinglePage = (
  pageId: string | null,
  pageSlug: string | null,
  enabled: boolean
): UseSinglePageResult => {
  const requestedPageKey = enabled
    ? pageId
      ? `id:${pageId}`
      : pageSlug
        ? `slug:${pageSlug}`
        : ''
    : '';

  const [fullPage, setFullPage] = useState<Page | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && Boolean(pageId || pageSlug));
  const [settledRequestKey, setSettledRequestKey] = useState('');
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fullPageMatchesRequest = Boolean(
    fullPage && ((pageId && fullPage.id === pageId) || (pageSlug && fullPage.slug === pageSlug))
  );
  const hasSettledCurrentRequest = settledRequestKey === requestedPageKey;
  const isPendingCurrentRequest = Boolean(
    requestedPageKey && !fullPageMatchesRequest && !hasSettledCurrentRequest
  );

  useEffect(() => {
    if (!enabled || (!pageId && !pageSlug)) {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setFullPage(null);
      setIsLoading(false);
      setSettledRequestKey('');
      return;
    }

    if (fullPageMatchesRequest) {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setSettledRequestKey(requestedPageKey);
      return;
    }

    const fetchFullPage = async () => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsLoading(true);

      try {
        const queryKey = pageId ? 'id' : 'slug';
        const queryValue = pageId || pageSlug || '';
        const res = await vonFetch(
          `${API.getPages}?${queryKey}=${encodeURIComponent(queryValue)}&limit=1`,
          { signal: abortController.signal }
        );
        const data = await res.json();
        if (requestId !== requestIdRef.current) return;

        const rawPage = Array.isArray(data) ? data[0] : data?.pages?.[0];
        if (res.ok && data?.success && rawPage) {
          setFullPage({
            id: String(rawPage.id || ''),
            title: rawPage.title || '',
            slug: rawPage.slug || '',
            content: rawPage.content || '',
            excerpt: rawPage.excerpt || '',
            status: rawPage.status || 'published',
            author: rawPage.author || '',
            author_id: rawPage.author_id ?? null,
            createdAt: rawPage.createdAt || rawPage.created_at || '',
            created_at: rawPage.created_at,
            updatedAt: rawPage.updatedAt || rawPage.updated_at || '',
            updated_at: rawPage.updated_at,
            metaDescription: rawPage.metaDescription || rawPage.meta_description || '',
            keywords: rawPage.keywords || '',
          } as Page);
        } else {
          setFullPage(null);
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        console.error('Failed to fetch page content:', err);
        setFullPage(null);
      } finally {
        if (requestId === requestIdRef.current) {
          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
          setSettledRequestKey(requestedPageKey);
          setIsLoading(false);
        }
      }
    };

    fetchFullPage();

    return () => {
      if (abortControllerRef.current) {
        requestIdRef.current += 1;
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [pageId, pageSlug, enabled, requestedPageKey]);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setFullPage(null);
      setSettledRequestKey('');
    }
  }, [enabled]);

  return { fullPage, isLoading: isLoading || isPendingCurrentRequest };
};

export default useSinglePage;
