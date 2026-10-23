import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Post, Page, SiteSettings, User } from '../../../../types';
import {
  getPermalink,
  getPostPublishTimestamp,
  normalizeSchemaDateTime,
} from '../../../../utils/siteUtils';
import { API, BASE_PATH } from '../../../../config/site.config';
import { htmlToPlainText } from '../../../../utils/security';
import { hasNonemptySeoQueryValue } from '../../../../utils/seoQuery';
import { PUBLIC_LISTING_MAX_PAGE } from '../../../../hooks/usePublicPostsQuery';
import {
  normalizeArticleSchemaType,
  normalizeSchemaLanguage,
  truncateSchemaText,
} from '../../../../utils/articleSchema';
import {
  resolveSocialImage,
  toAbsolutePublicMediaUrl,
  type SocialImageCandidate,
} from '../../../../utils/socialMetadata';

const ensureMeta = (nameOrProp: string, attr: 'name' | 'property', content: string) => {
  let el = document.head.querySelector(`meta[${attr}="${nameOrProp}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nameOrProp);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setLinkCanonical = (href: string) => {
  // Canonicals must remain absolute HTTP(S) URLs, including when restored from DOM attributes.
  if (!/^https?:\/\//i.test(href)) return;
  let canonicalHref: string;
  try {
    const parsed = new URL(href);
    if (parsed.username || parsed.password) return;
    canonicalHref = parsed.href;
  } catch {
    return;
  }
  // Check the serialized value that is written, not the original DOM attribute text.
  if (!canonicalHref.startsWith('https://') && !canonicalHref.startsWith('http://')) return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', canonicalHref);
  return canonicalHref;
};

const normalizeConfiguredCanonicalBase = (
  value: unknown,
  mode: 'base' | 'document' = 'base'
): string => {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (
    !candidate ||
    /[\u0000-\u0020\\]/.test(candidate) ||
    /(?:^|\/)(?:\.{1,2}|%2e(?:%2e)?)(?:\/|$)/i.test(candidate)
  ) {
    return '';
  }

  try {
    const parsed = new URL(candidate);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      (mode === 'base' && parsed.search) ||
      parsed.hash ||
      !/^[a-z0-9.:-]+$/i.test(parsed.hostname.replace(/^\[|\]$/g, ''))
    ) {
      return '';
    }

    // A document canonical retains pagination/category queries and directory slashes.
    if (mode === 'document') return `${parsed.origin}${parsed.pathname}${parsed.search}`;

    const path = parsed.pathname === '/' ? '' : `/${parsed.pathname.replace(/^\/+|\/+$/g, '')}`;
    return `${parsed.origin}${path}`;
  } catch {
    return '';
  }
};

const localBrowserCanonicalBase = (basePrefix: string): string => {
  const host = window.location.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const ipv4 = host.split('.').map((part) => Number(part));
  const isPrivateIpv4 =
    ipv4.length === 4 &&
    ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (ipv4[0] === 10 ||
      ipv4[0] === 127 ||
      (ipv4[0] === 169 && ipv4[1] === 254) ||
      (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
      (ipv4[0] === 192 && ipv4[1] === 168));
  const isLocalHost =
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    isPrivateIpv4 ||
    /\.(?:local|test|localhost)$/i.test(host) ||
    /^(?:fc|fd)[0-9a-f]{2}:/i.test(host) ||
    /^fe[89ab][0-9a-f]:/i.test(host);

  return isLocalHost ? `${window.location.origin}${basePrefix}` : '';
};

const clearUrlBearingSeo = () => {
  document.head.querySelector('link[rel="canonical"]')?.remove();
  ensureMeta('og:url', 'property', '');
  ensureMeta('og:image', 'property', '');
  ensureMeta('og:image:alt', 'property', '');
  ensureMeta('og:image:width', 'property', '');
  ensureMeta('og:image:height', 'property', '');
  ensureMeta('twitter:image', 'name', '');
  ensureMeta('twitter:image:alt', 'name', '');
  document.head.querySelector('script[type="application/ld+json"].vp-seo')?.remove();
};

const setJsonLd = (obj: any, schemaUrl: string) => {
  let el = document.head.querySelector('script[type="application/ld+json"].vp-seo');
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.classList.add('vp-seo');
    document.head.appendChild(el);
  }

  if (el.getAttribute('data-voncms-schema-source') === 'ssr') {
    try {
      // Compare document identity using the same URL serialization as the canonical.
      const ssrHref = new URL(el.getAttribute('data-voncms-schema-url') || '').href;
      if (ssrHref === schemaUrl) return;
    } catch {
      // Invalid SSR identity must not prevent replacement with the current graph.
    }
  }

  el.textContent = JSON.stringify(obj);
  el.removeAttribute('data-voncms-schema-source');
  el.removeAttribute('data-voncms-schema-url');
};

const normalizeSeoDescriptionCandidate = (value?: string | null): string => {
  const rawValue = value?.trim() || '';
  if (!rawValue) return '';

  const contentAttribute = rawValue.match(
    /^\s*<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*>\s*$/i
  )?.[1];
  return htmlToPlainText(contentAttribute || rawValue, {
    preserveLiteralComparisons: true,
    preserveBlockSpacing: true,
  });
};

const pickHydratedSeoDescription = (...values: Array<string | null | undefined>): string => {
  for (const value of values) {
    const normalized = normalizeSeoDescriptionCandidate(value);
    if (normalized) return normalized;
  }

  return '';
};

interface VonSEOProps {
  settings: SiteSettings;
  currentView: 'home' | 'single-post' | 'page' | 'profile' | 'category';
  selectedPost?: Post | null;
  selectedPage?: Page | null;
  selectedProfile?: User | null;
  selectedCategory?: string | null;
  categoryPostCount?: number | null;
}

type SsrSeoSnapshot = {
  route: string;
  canonical: string;
  robots: string;
  title: string;
  schema: any;
};
const ssrSeoSnapshots = new WeakMap<Document, SsrSeoSnapshot | null>();
const getSsrSeoSnapshot = (): SsrSeoSnapshot | null => {
  if (ssrSeoSnapshots.has(document)) return ssrSeoSnapshots.get(document) || null;
  const robots = document.head.querySelector('meta[name="robots"]');
  const script = document.head.querySelector(
    'script[type="application/ld+json"].vp-seo[data-voncms-schema-source="ssr"]'
  );
  const rawCanonical =
    robots?.getAttribute('data-voncms-ssr-canonical') ||
    script?.getAttribute('data-voncms-schema-url') ||
    '';
  const canonical = normalizeConfiguredCanonicalBase(rawCanonical, 'document');
  let snapshot: SsrSeoSnapshot | null = null;
  if (canonical) {
    try {
      const url = new URL(canonical, window.location.origin);
      snapshot = {
        route: robots?.getAttribute('data-voncms-ssr-route') || `${url.pathname}${url.search}`,
        canonical,
        robots:
          robots?.getAttribute('data-voncms-ssr-robots') || robots?.getAttribute('content') || '',
        title: robots?.getAttribute('data-voncms-ssr-title') || document.title,
        schema: script?.textContent ? JSON.parse(script.textContent) : null,
      };
    } catch {
      // Malformed or absent SSR data is not an authority for another route.
    }
  }
  ssrSeoSnapshots.set(document, snapshot);
  return snapshot;
};

const VonSEO: React.FC<VonSEOProps> = ({
  settings,
  currentView,
  selectedPost,
  selectedPage,
  selectedProfile,
  selectedCategory,
  categoryPostCount,
}) => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const rawPublicPage = queryParams.get('page')?.trim() || '';
  const publicPage = /^\d+$/.test(rawPublicPage)
    ? Math.max(1, Math.min(PUBLIC_LISTING_MAX_PAGE, Number(rawPublicPage)))
    : 1;
  const hasPublicSearchQuery = Array.from(queryParams.entries()).some(
    ([key, value]) =>
      (key === 'search' || key.startsWith('search[')) && hasNonemptySeoQueryValue(value)
  );
  const countKey = `${currentView}:${selectedCategory || ''}:${location.pathname}${location.search}`;
  const [fetchedListingCount, setFetchedListingCount] = useState<{
    key: string;
    total: number;
  } | null>(null);

  useEffect(() => {
    const author =
      currentView === 'single-post'
        ? selectedPost?.author
        : currentView === 'page'
          ? selectedPage?.author
          : '';
    ensureMeta('author', 'name', author || '');
    return () => ensureMeta('author', 'name', '');
  }, [currentView, selectedPost?.author, selectedPage?.author]);

  useEffect(() => {
    const needsCategoryCount =
      currentView === 'category' && selectedCategory && typeof categoryPostCount !== 'number';
    const needsHomeCount = currentView === 'home' && publicPage > 1;
    if (hasPublicSearchQuery || (!needsCategoryCount && !needsHomeCount)) {
      return;
    }

    const abortController = new AbortController();
    const params = new URLSearchParams({
      countOnly: 'true',
      public: 'true',
    });
    if (currentView === 'category' && selectedCategory) params.set('category', selectedCategory);

    fetch(`${API.getPosts}?${params.toString()}`, {
      signal: abortController.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (abortController.signal.aborted) return;
        const total = Number(data?.meta?.total);
        if (Number.isFinite(total) && total >= 0) setFetchedListingCount({ key: countKey, total });
      })
      .catch((error) => {
        if (!abortController.signal.aborted && (error as Error)?.name !== 'AbortError') {
          setFetchedListingCount((current) => (current?.key === countKey ? null : current));
        }
      });

    return () => abortController.abort();
  }, [
    currentView,
    selectedCategory,
    categoryPostCount,
    countKey,
    publicPage,
    hasPublicSearchQuery,
  ]);

  useEffect(() => {
    const siteTitle = settings.siteName;
    const ssrSnapshot = getSsrSeoSnapshot();
    const basePrefix =
      BASE_PATH === '/' || !BASE_PATH ? '' : `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}`;
    const requestRoute = `${basePrefix}${location.pathname}${location.search}`;
    const matchesSsrRoute = ssrSnapshot?.route === requestRoute;
    const listingCount =
      currentView === 'category' && typeof categoryPostCount === 'number'
        ? categoryPostCount
        : fetchedListingCount?.key === countKey
          ? fetchedListingCount.total
          : null;
    const isPaginatedDiscovery =
      publicPage > 1 &&
      !hasPublicSearchQuery &&
      (currentView === 'home' || currentView === 'category');
    const listingLimit = Math.max(6, Math.min(50, Number(settings.postsPerPage) || 6));
    const isPaginatedOverflow =
      isPaginatedDiscovery &&
      (listingCount !== null
        ? (publicPage - 1) * listingLimit >= listingCount
        : matchesSsrRoute
          ? ssrSnapshot.robots.trim().toLowerCase().startsWith('noindex')
          : true);
    const existingSsrSchema = document.head.querySelector(
      'script[type="application/ld+json"].vp-seo[data-voncms-schema-source="ssr"]'
    );

    // --- 1. Construct Metadata ---
    let title = siteTitle;
    const siteDescription = normalizeSeoDescriptionCandidate(settings.siteDescription);
    let description = siteDescription;
    let routeSocialImage: SocialImageCandidate | null = null;
    let type = 'website';
    let hydratedRobots =
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

    const configuredBase = normalizeConfiguredCanonicalBase(settings.domainUrl);
    const canonicalBase = configuredBase || localBrowserCanonicalBase(basePrefix);
    const canonicalUrl = (path = '') =>
      canonicalBase ? `${canonicalBase}${path ? `/${path.replace(/^\/+/, '')}` : '/'}` : '';
    let canonical = canonicalUrl();

    if (currentView === 'single-post' && selectedPost) {
      title = `${selectedPost.title} | ${siteTitle}`;
      description =
        pickHydratedSeoDescription(
          selectedPost.metaDescription,
          selectedPost.excerpt,
          selectedPost.content
        ) || description;
      routeSocialImage = { url: selectedPost.image, kind: 'featured' };
      type = 'article';
      canonical = canonicalUrl(getPermalink(selectedPost, settings, false, true));
    } else if (currentView === 'page' && selectedPage) {
      title = `${selectedPage.title} | ${siteTitle}`;
      description =
        pickHydratedSeoDescription(
          selectedPage.metaDescription,
          selectedPage.excerpt,
          selectedPage.content
        ) || description;
      type = 'website';
      canonical = canonicalUrl(selectedPage.slug);
    } else if (currentView === 'profile' && selectedProfile) {
      const profileDisplayName = selectedProfile.display_name || selectedProfile.username;
      title = `${profileDisplayName} | ${siteTitle}`;
      description =
        normalizeSeoDescriptionCandidate(selectedProfile.bio) ||
        `Profile of ${profileDisplayName} on ${settings.siteName}`;
      routeSocialImage = { url: selectedProfile.avatar, kind: 'profile' };
      type = 'profile';
      canonical = canonicalUrl(`profile/${encodeURIComponent(selectedProfile.username)}`);
    } else if (currentView === 'category' && selectedCategory) {
      const categoryHasPosts =
        listingCount !== null
          ? listingCount > 0
          : matchesSsrRoute && !ssrSnapshot.robots.trim().toLowerCase().startsWith('noindex');
      title = `${selectedCategory} - ${siteTitle}`;
      const categoryDescriptionContext = siteDescription || settings.siteName;
      description = `${selectedCategory} - ${categoryDescriptionContext}`;
      canonical = `${canonicalBase}/?category=${encodeURIComponent(selectedCategory)}`;
      hydratedRobots = categoryHasPosts
        ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
        : 'noindex, follow';
    }
    if (isPaginatedDiscovery) {
      title = isPaginatedOverflow
        ? matchesSsrRoute
          ? ssrSnapshot.title
          : `${siteTitle} - Page ${publicPage}`
        : currentView === 'category' && selectedCategory
          ? `${selectedCategory} - Page ${publicPage} - ${siteTitle}`
          : `${siteTitle} - Page ${publicPage}`;
      if (matchesSsrRoute) {
        canonical = ssrSnapshot.canonical;
      } else {
        const canonicalParams = new URLSearchParams();
        if (currentView === 'category' && selectedCategory) {
          canonicalParams.set('category', selectedCategory);
        }
        canonicalParams.set('page', String(publicPage));
        canonical = `${canonicalBase}/?${canonicalParams.toString()}`;
      }
      hydratedRobots = isPaginatedOverflow ? 'noindex, follow' : hydratedRobots;
    }
    if (hasPublicSearchQuery) {
      hydratedRobots = 'noindex, follow';
    }
    description = truncateSchemaText(description, 160);

    if (!canonicalBase) {
      try {
        document.title = title;
      } catch (e) {}
      ensureMeta('description', 'name', description);
      ensureMeta('generator', 'name', 'VonSEO 3.0');
      ensureMeta('og:title', 'property', title);
      ensureMeta('og:description', 'property', description);
      ensureMeta('og:site_name', 'property', settings.siteName);
      ensureMeta('og:type', 'property', type);
      ensureMeta('twitter:card', 'name', 'summary');
      ensureMeta('twitter:title', 'name', title);
      ensureMeta('twitter:description', 'name', description);
      clearUrlBearingSeo();
      ensureMeta('robots', 'name', 'noindex, nofollow');
      return;
    }

    // --- 2. Apply Document Title ---
    try {
      document.title = title;
    } catch (e) {}

    // --- 3. Canonical Link ---
    canonical = setLinkCanonical(canonical) ?? canonical;

    // --- 4. Basic Meta Tags ---
    ensureMeta('description', 'name', description);
    ensureMeta('generator', 'name', 'VonSEO 3.0'); // Branding

    // --- 5. Open Graph (Facebook / LinkedIn) ---
    ensureMeta('og:title', 'property', title);
    ensureMeta('og:description', 'property', description);
    ensureMeta('og:url', 'property', canonical);
    ensureMeta('og:site_name', 'property', settings.siteName);
    ensureMeta('og:type', 'property', type);
    const schemaLanguage = normalizeSchemaLanguage(settings.site_language);
    const openGraphLocale =
      schemaLanguage === 'ms'
        ? 'ms_MY'
        : /^[a-z]{2,3}-[A-Z]{2}$/.test(schemaLanguage)
          ? schemaLanguage.replace('-', '_')
          : '';
    ensureMeta('og:locale', 'property', openGraphLocale);

    const resolvedSocialImage = resolveSocialImage(
      [
        ...(routeSocialImage ? [routeSocialImage] : []),
        { url: settings.ogImageUrl, kind: 'large' },
        { url: settings.ogImageSquareUrl, kind: 'square' },
        { url: settings.logoUrl, kind: 'logo' },
      ],
      canonicalBase
    );
    const absoluteOgImage = resolvedSocialImage.url;
    const currentOgImage =
      document.head.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    const currentImageWidth = Number(
      document.head.querySelector('meta[property="og:image:width"]')?.getAttribute('content') || 0
    );
    const currentImageHeight = Number(
      document.head.querySelector('meta[property="og:image:height"]')?.getAttribute('content') || 0
    );
    const canReuseSocialImageDimensions =
      currentOgImage === absoluteOgImage &&
      Number.isFinite(currentImageWidth) &&
      currentImageWidth > 0 &&
      Number.isFinite(currentImageHeight) &&
      currentImageHeight > 0;
    ensureMeta('og:image', 'property', absoluteOgImage);
    ensureMeta('og:image:alt', 'property', absoluteOgImage ? title : '');
    if (!canReuseSocialImageDimensions) {
      ensureMeta('og:image:width', 'property', '');
      ensureMeta('og:image:height', 'property', '');
    }

    // --- 6. Twitter Cards ---
    const cardType = resolvedSocialImage.card;
    const twitterImage = absoluteOgImage;

    ensureMeta('twitter:card', 'name', cardType);
    ensureMeta('twitter:title', 'name', title);
    ensureMeta('twitter:description', 'name', description);
    ensureMeta('twitter:image', 'name', twitterImage);
    ensureMeta('twitter:image:alt', 'name', twitterImage ? title : '');

    // --- 7. JSON-LD (Advanced Schema) ---
    const jsonLd: any = {
      '@context': 'https://schema.org',
      '@graph': [],
    };

    // Organization Node
    const organizationLogoUrl = toAbsolutePublicMediaUrl(settings.logoUrl, canonicalBase);
    const orgNode = {
      '@type': 'Organization',
      '@id': `${canonicalBase}/#organization`,
      name: settings.siteName,
      url: canonicalBase,
      ...(organizationLogoUrl
        ? { logo: { '@type': 'ImageObject', url: organizationLogoUrl } }
        : {}),
    };

    // WebSite Node
    const websiteNode = {
      '@type': 'WebSite',
      '@id': `${canonicalBase}/#website`,
      url: canonicalUrl(),
      name: settings.siteName,
      publisher: { '@id': `${canonicalBase}/#organization` },
      ...(siteDescription ? { description: siteDescription } : {}),
    };

    jsonLd['@graph'].push(orgNode, websiteNode);

    if (currentView === 'single-post' && selectedPost) {
      const authorUsername = selectedPost.author_data?.username || selectedPost.author;
      const authorProfileUrl = authorUsername
        ? canonicalUrl(`profile/${encodeURIComponent(authorUsername)}`)
        : '';
      const articleSection = selectedPost.category?.trim();
      const articleLanguage = normalizeSchemaLanguage(settings.site_language);
      const articleNode = {
        '@type': normalizeArticleSchemaType(settings.seo?.articleSchemaType),
        '@id': `${canonical}#article`,
        headline: selectedPost.title,
        description: description,
        ...(absoluteOgImage
          ? {
              image: [
                {
                  '@type': 'ImageObject',
                  url: absoluteOgImage,
                  ...(canReuseSocialImageDimensions
                    ? { width: currentImageWidth, height: currentImageHeight }
                    : {}),
                },
              ],
            }
          : {}),
        datePublished: normalizeSchemaDateTime(
          getPostPublishTimestamp(selectedPost),
          settings.timeZone
        ),
        dateModified: normalizeSchemaDateTime(
          selectedPost.updatedAt || getPostPublishTimestamp(selectedPost),
          settings.timeZone
        ),
        author: { '@type': 'Person', name: selectedPost.author, url: authorProfileUrl },
        publisher: { '@id': `${canonicalBase}/#organization` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        ...(articleSection ? { articleSection } : {}),
        ...(articleLanguage ? { inLanguage: articleLanguage } : {}),
      };
      jsonLd['@graph'].push(articleNode);
    } else if (currentView === 'profile' && selectedProfile) {
      const profileDisplayName = selectedProfile.display_name || selectedProfile.username;
      const profileImage = toAbsolutePublicMediaUrl(selectedProfile.avatar, canonicalBase);
      const personNode = {
        '@type': 'Person',
        '@id': `${canonical}#person`,
        name: profileDisplayName,
        description,
        ...(profileImage ? { image: profileImage } : {}),
        url: canonical,
      };
      jsonLd['@graph'].push(personNode);
    } else if ((currentView === 'home' || currentView === 'category') && !hasPublicSearchQuery) {
      jsonLd['@graph'].push({
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
      });
    }

    // Breadcrumbs for SEO
    const breadcrumbItems =
      currentView === 'single-post' && selectedPost?.category
        ? [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: canonicalBase,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: selectedPost.category,
              item: `${canonicalBase}/?category=${encodeURIComponent(selectedPost.category)}`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: selectedPost.title,
              item: canonical,
            },
          ]
        : [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: canonicalBase,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: title,
              item: canonical,
            },
          ];

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems,
    };
    jsonLd['@graph'].push(breadcrumbNode);

    const shouldPreservePaginatedSsrSchema =
      isPaginatedDiscovery &&
      existingSsrSchema?.getAttribute('data-voncms-schema-url') === canonical;
    if (isPaginatedOverflow) {
      document.head.querySelector('script[type="application/ld+json"].vp-seo')?.remove();
    } else if (
      isPaginatedDiscovery &&
      matchesSsrRoute &&
      ssrSnapshot.schema &&
      !shouldPreservePaginatedSsrSchema
    ) {
      setJsonLd(ssrSnapshot.schema, canonical);
    } else if (!shouldPreservePaginatedSsrSchema) {
      setJsonLd(jsonLd, canonical);
    }

    // Temporary maintenance is signalled server-side with HTTP 503, not persistent noindex metadata.
    ensureMeta('robots', 'name', hydratedRobots);
  }, [
    settings,
    currentView,
    selectedPost,
    selectedPage,
    selectedProfile,
    selectedCategory,
    categoryPostCount,
    fetchedListingCount,
    location.pathname,
    location.search,
  ]);

  return null;
};

export default VonSEO;
