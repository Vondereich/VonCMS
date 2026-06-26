/**
 * VonCMS - useServerSearch Hook
 * Server-side search for 100K+ posts scalability
 */
import { useState, useCallback } from 'react';
import { Post } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

interface UseServerSearchResult {
  searchResults: Post[] | null;
  isSearching: boolean;
  searchError: string | null;
  performSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
  hasSearched: boolean;
  totalResults: number;
}

export const useServerSearch = (): UseServerSearchResult => {
  const [searchResults, setSearchResults] = useState<Post[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  const performSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchError('Search term must be at least 2 characters');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const res = await vonFetch(
        `${API.getPosts}?search=${encodeURIComponent(query.trim())}&limit=50`
      );

      if (!res.ok) {
        throw new Error('Search failed');
      }

      const data = await res.json();

      // Handle envelope format
      if (data.posts && Array.isArray(data.posts)) {
        setSearchResults(data.posts);
        setTotalResults(data.meta?.total || data.posts.length);
      } else if (Array.isArray(data)) {
        setSearchResults(data);
        setTotalResults(data.length);
      } else {
        setSearchResults([]);
        setTotalResults(0);
      }
    } catch (err) {
      console.error('Server search error:', err);
      setSearchError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchError(null);
    setHasSearched(false);
    setTotalResults(0);
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    performSearch,
    clearSearch,
    hasSearched,
    totalResults,
  };
};

export default useServerSearch;
