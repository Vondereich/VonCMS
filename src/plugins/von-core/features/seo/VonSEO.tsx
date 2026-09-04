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
  if (!href) return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const setJsonLd = (obj: any, schemaUrl: string) => {
  let el = document.head.querySelector('script[type="application/ld+json"].vp-seo');
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.classList.add('vp-seo');
    document.head.appendChild(el);
  }

  if (
    el.getAttribute('data-voncms-schema-source') === 'ssr' &&
    el.getAttribute('data-voncms-schema-url') === schemaUrl
  ) {
    return;
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
  return htmlToPlainText(contentAttribute || rawValue);
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
  const [fetchedCategoryPostCount, setFetchedCategoryPostCount] = useState<number | null>(null);

  useEffect(() => {
    if (currentView !== 'category' || !selectedCategory || typeof categoryPostCount === 'number') {
      setFetchedCategoryPostCount(null);
      return;
    }

    const abortController = new AbortController();
    const params = new URLSearchParams({
      category: selectedCategory,
      countOnly: 'true',
      public: 'true',
    });

    fetch(`${API.getPosts}?${params.toString()}`, {
      signal: abortController.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (abortController.signal.aborted) return;
        const total = Number(data?.meta?.total);
        setFetchedCategoryPostCount(Number.isFinite(total) ? total : null);
      })
      .catch((error) => {
        if ((error as Error)?.name !== 'AbortError') {
          setFetchedCategoryPostCount(null);
        }
      });

    return () => abortController.abort();
  }, [currentView, selectedCategory, categoryPostCount]);

  useEffect(() => {
    const siteTitle = settings.siteName;
    const queryParams = new URLSearchParams(location.search);
    const rawPublicPage = queryParams.get('page')?.trim() || '';
    const publicPage = /^\d+$/.test(rawPublicPage)
      ? Math.max(1, Math.min(100000, Number(rawPublicPage)))
      : 1;
    const existingRobots =
      document.head.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    const existingCanonical =
      document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    const hasPublicSearchQuery = Array.from(queryParams.entries()).some(
      ([key, value]) =>
        (key === 'search' || key.startsWith('search[')) && hasNonemptySeoQueryValue(value)
    );
    const isPaginatedDiscovery =
      publicPage > 1 &&
      !hasPublicSearchQuery &&
      (currentView === 'home' || currentView === 'category');
    const isPaginatedOverflow =
      isPaginatedDiscovery && existingRobots.trim().toLowerCase().startsWith('noindex');
    const existingSsrSchema = document.head.querySelector(
      'script[type="application/ld+json"].vp-seo[data-voncms-schema-source="ssr"]'
    );

    // --- 1. Construct Metadata ---
    let title = siteTitle;
    let description = settings.siteDescription || '';
    let routeSocialImage: SocialImageCandidate | null = null;
    let type = 'website';
    let hydratedRobots =
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

    const basePrefix =
      BASE_PATH === '/' || !BASE_PATH ? '' : `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}`;
    const configuredBase = (settings.domainUrl || settings.siteUrl || '')
      .trim()
      .replace(/\/+$/, '');
    const canonicalBase = configuredBase || `${window.location.origin}${basePrefix}`;
    const canonicalUrl = (path = '') =>
      `${canonicalBase}${path ? `/${path.replace(/^\/+/, '')}` : '/'}`;
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
      // Use authoritative permalink for canonical
      canonical = getPermalink(selectedPost, settings, true);
      if (!settings.domainUrl) {
        canonical = canonicalUrl(getPermalink(selectedPost, settings, false, true));
      }
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
        selectedProfile.bio || `Profile of ${profileDisplayName} on ${settings.siteName}`;
      routeSocialImage = { url: selectedProfile.avatar, kind: 'profile' };
      type = 'profile';
      canonical = canonicalUrl(`profile/${encodeURIComponent(selectedProfile.username)}`);
    } else if (currentView === 'category' && selectedCategory) {
      const categoryHasPosts =
        typeof categoryPostCount === 'number'
          ? categoryPostCount > 0
          : typeof fetchedCategoryPostCount === 'number'
            ? fetchedCategoryPostCount > 0
            : !existingRobots.trim().toLowerCase().startsWith('noindex');
      title = `${selectedCategory} - ${siteTitle}`;
      const categoryDescriptionContext = settings.siteDescription?.trim() || settings.siteName;
      description = `${selectedCategory} - ${categoryDescriptionContext}`;
      canonical = `${canonicalBase}/?category=${encodeURIComponent(selectedCategory)}`;
      hydratedRobots = categoryHasPosts
        ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
        : 'noindex, follow';
    }
    if (isPaginatedDiscovery) {
      title = isPaginatedOverflow
        ? document.title
        : currentView === 'category' && selectedCategory
          ? `${selectedCategory} - Page ${publicPage} - ${siteTitle}`
          : `${siteTitle} - Page ${publicPage}`;
      const existingCanonicalPage = (() => {
        try {
          return new URL(existingCanonical, window.location.origin).searchParams.get('page');
        } catch {
          return null;
        }
      })();
      if (existingCanonicalPage === String(publicPage)) {
        canonical = existingCanonical;
      } else {
        const canonicalParams = new URLSearchParams();
        if (currentView === 'category' && selectedCategory) {
          canonicalParams.set('category', selectedCategory);
        }
        canonicalParams.set('page', String(publicPage));
        canonical = `${canonicalBase}/?${canonicalParams.toString()}`;
      }
      hydratedRobots = existingRobots || hydratedRobots;
    }
    if (hasPublicSearchQuery) {
      hydratedRobots = 'noindex, follow';
    }
    description = truncateSchemaText(description, 160);

    // --- 2. Apply Document Title ---
    try {
      document.title = title;
    } catch (e) {}

    // --- 3. Canonical Link ---
    setLinkCanonical(canonical);

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
      ...(settings.siteDescription?.trim() ? { description: settings.siteDescription.trim() } : {}),
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
        description: selectedProfile.bio,
        ...(profileImage ? { image: profileImage } : {}),
        url: canonical,
      };
      jsonLd['@graph'].push(personNode);
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
    fetchedCategoryPostCount,
    location.pathname,
    location.search,
  ]);

  return null;
};

export default VonSEO;
