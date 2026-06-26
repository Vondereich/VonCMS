import React, { useEffect } from 'react';
import { Post, Page, SiteSettings, User } from '../../../../types';
import { getPermalink } from '../../../../utils/siteUtils';
import { BASE_PATH } from '../../../../config/site.config';

const ensureMeta = (nameOrProp: string, attr: 'name' | 'property', content: string) => {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${nameOrProp}"]`);
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

const setJsonLd = (obj: any) => {
  let el = document.head.querySelector('script[type="application/ld+json"].vp-seo');
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.classList.add('vp-seo');
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(obj);
};

const normalizeSchemaDate = (value?: string) => {
  const rawValue = value?.trim();
  if (!rawValue) return undefined;
  if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(rawValue)) return rawValue;

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return rawValue;

  return parsed.toISOString();
};

interface VonSEOProps {
  settings: SiteSettings;
  currentView: 'home' | 'single-post' | 'page' | 'profile' | 'category';
  selectedPost?: Post | null;
  selectedPage?: Page | null;
  selectedProfile?: User | null;
  selectedCategory?: string | null;
}

const VonSEO: React.FC<VonSEOProps> = ({
  settings,
  currentView,
  selectedPost,
  selectedPage,
  selectedProfile,
  selectedCategory,
}) => {
  useEffect(() => {
    const siteTitle = settings.seo?.siteTitle || settings.siteName;

    // --- 1. Construct Metadata ---
    let title = siteTitle;
    let description = settings.siteDescription || '';
    let keywords = settings.seo?.defaultKeywords || '';
    let image = settings.ogImageUrl || settings.logoUrl || '';
    let type = 'website';
    let authorName = '';

    const basePrefix =
      BASE_PATH === '/' || !BASE_PATH ? '' : `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}`;
    let canonicalPath = window.location.pathname;

    if (currentView === 'single-post' && selectedPost) {
      title = `${selectedPost.title} — ${siteTitle}`;
      description = selectedPost.metaDescription || selectedPost.excerpt || description;
      keywords = selectedPost.keywords || keywords;
      image = selectedPost.image || settings.ogImageUrl || image;
      type = 'article';
      authorName = selectedPost.author;
      // Use authoritative permalink for canonical
      canonicalPath = getPermalink(selectedPost, settings);
    } else if (currentView === 'page' && selectedPage) {
      title = `${selectedPage.title} — ${siteTitle}`;
      description =
        selectedPage.excerpt ||
        (selectedPage.content
          ? selectedPage.content.replace(/<[^>]+>/g, '').slice(0, 160)
          : description);
      type = 'website';
      canonicalPath = `${basePrefix}/${selectedPage.slug}`;
    } else if (currentView === 'profile' && selectedProfile) {
      const profileDisplayName = selectedProfile.display_name || selectedProfile.username;
      title = `${profileDisplayName} — ${siteTitle}`;
      description =
        selectedProfile.bio || `Profile of ${profileDisplayName} on ${settings.siteName}`;
      image = selectedProfile.avatar || image;
      type = 'profile';
      canonicalPath = `${basePrefix}/profile/${selectedProfile.username}`;
    } else if (currentView === 'category' && selectedCategory) {
      title = `${selectedCategory} — ${siteTitle}`;
      description = `Latest posts in ${selectedCategory} on ${settings.siteName}`;
      canonicalPath = `${basePrefix}/?category=${encodeURIComponent(selectedCategory)}`;
    }

    const canonical = (settings.seo?.canonicalHost || window.location.origin) + canonicalPath;

    // --- 2. Apply Document Title ---
    try {
      document.title = title;
    } catch (e) {}

    // --- 3. Canonical Link ---
    setLinkCanonical(canonical);

    // --- 4. Basic Meta Tags ---
    ensureMeta('description', 'name', description);
    ensureMeta('keywords', 'name', keywords);
    ensureMeta('generator', 'name', 'VonSEO 3.0'); // Branding

    // --- 5. Open Graph (Facebook / LinkedIn) ---
    // Fix: Force Absolute URLs for Client-Side OG Tags (Robustness Upgrade)
    const origin = window.location.origin;
    const toAbsolute = (url: string) => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    ensureMeta('og:title', 'property', title);
    ensureMeta('og:description', 'property', description);
    ensureMeta('og:url', 'property', canonical);
    ensureMeta('og:site_name', 'property', settings.siteName);
    ensureMeta('og:type', 'property', type);

    const ogImage = image || settings.ogImageSquareUrl || '';
    if (ogImage) ensureMeta('og:image', 'property', toAbsolute(ogImage));

    // --- 6. Twitter Cards ---
    // If we have a square image but no large image, use 'summary'. Large image -> 'summary_large_image'
    const cardType = ogImage
      ? 'summary_large_image'
      : settings.ogImageSquareUrl
        ? 'summary'
        : 'summary';

    // Fix: Ensure Twitter images are also absolute
    const twitterImage = ogImage ? toAbsolute(ogImage) : '';

    ensureMeta('twitter:card', 'name', cardType);
    ensureMeta('twitter:title', 'name', title);
    ensureMeta('twitter:description', 'name', description);
    if (twitterImage) ensureMeta('twitter:image', 'name', twitterImage);
    if (authorName) ensureMeta('twitter:creator', 'name', authorName); // Ideally handles if author has twitter handle

    // --- 7. JSON-LD (Advanced Schema) ---
    const jsonLd: any = {
      '@context': 'https://schema.org',
      '@graph': [],
    };

    // Organization Node
    const orgNode = {
      '@type': 'Organization',
      '@id': `${window.location.origin}/#organization`,
      name: settings.siteName,
      url: window.location.origin,
      logo: {
        '@type': 'ImageObject',
        url: settings.logoUrl,
      },
    };

    // WebSite Node (with Sitelinks Searchbox Discovery)
    const websiteNode = {
      '@type': 'WebSite',
      '@id': `${window.location.origin}/#website`,
      url: window.location.origin,
      name: settings.siteName,
      publisher: { '@id': `${window.location.origin}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${window.location.origin}/?s={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };

    jsonLd['@graph'].push(orgNode, websiteNode);

    if (currentView === 'single-post' && selectedPost) {
      const authorUsername = selectedPost.author_data?.username || selectedPost.author;
      const authorProfileUrl = authorUsername
        ? `${settings.seo?.canonicalHost || window.location.origin}${basePrefix}/profile/${encodeURIComponent(authorUsername)}`
        : '';
      const articleNode = {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: selectedPost.title,
        description: description,
        image: image ? [image] : [],
        datePublished: normalizeSchemaDate(selectedPost.createdAt || selectedPost.updatedAt),
        dateModified: normalizeSchemaDate(selectedPost.updatedAt || selectedPost.createdAt),
        author: { '@type': 'Person', name: selectedPost.author, url: authorProfileUrl },
        publisher: { '@id': `${window.location.origin}/#organization` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      };
      jsonLd['@graph'].push(articleNode);
    } else if (currentView === 'profile' && selectedProfile) {
      const profileDisplayName = selectedProfile.display_name || selectedProfile.username;
      const personNode = {
        '@type': 'Person',
        '@id': `${canonical}#person`,
        name: profileDisplayName,
        description: selectedProfile.bio,
        image: selectedProfile.avatar,
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
              item: window.location.origin,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: selectedPost.category,
              item: `${window.location.origin}${basePrefix}/?category=${encodeURIComponent(selectedPost.category)}`,
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
              item: window.location.origin,
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

    setJsonLd(jsonLd);

    // Robots
    // FIXED: Only noindex if Maintenance Mode is ON.
    // Previous logic blindly checked for "Disallow" string which caused issues with standard "Disallow:" (Allow all).
    if (settings.maintenanceMode) {
      ensureMeta('robots', 'name', 'noindex, nofollow');
    } else {
      ensureMeta('robots', 'name', 'index, follow');
    }
  }, [settings, currentView, selectedPost, selectedPage, selectedProfile, selectedCategory]);

  return null;
};

export default VonSEO;
