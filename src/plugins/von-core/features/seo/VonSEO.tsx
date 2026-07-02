import React, { useEffect } from 'react';
import { Post, Page, SiteSettings, User } from '../../../../types';
import { getPermalink } from '../../../../utils/siteUtils';
import { BASE_PATH } from '../../../../config/site.config';
import { htmlToPlainText } from '../../../../utils/security';

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
    let image = settings.ogImageUrl || settings.logoUrl || '';
    let type = 'website';

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
      title = `${selectedPost.title} — ${siteTitle}`;
      description = selectedPost.metaDescription || selectedPost.excerpt || description;
      image = selectedPost.image || settings.ogImageUrl || image;
      type = 'article';
      // Use authoritative permalink for canonical
      canonical = getPermalink(selectedPost, settings, true);
      if (!settings.domainUrl) {
        canonical = canonicalUrl(getPermalink(selectedPost, settings, false, true));
      }
    } else if (currentView === 'page' && selectedPage) {
      title = `${selectedPage.title} — ${siteTitle}`;
      description =
        selectedPage.excerpt ||
        (selectedPage.content ? htmlToPlainText(selectedPage.content).slice(0, 160) : description);
      type = 'website';
      canonical = canonicalUrl(selectedPage.slug);
    } else if (currentView === 'profile' && selectedProfile) {
      const profileDisplayName = selectedProfile.display_name || selectedProfile.username;
      title = `${profileDisplayName} — ${siteTitle}`;
      description =
        selectedProfile.bio || `Profile of ${profileDisplayName} on ${settings.siteName}`;
      image = selectedProfile.avatar || image;
      type = 'profile';
      canonical = canonicalUrl(`profile/${encodeURIComponent(selectedProfile.username)}`);
    } else if (currentView === 'category' && selectedCategory) {
      title = `${selectedCategory} — ${siteTitle}`;
      description = `Latest posts in ${selectedCategory} on ${settings.siteName}`;
      canonical = `${canonicalBase}/?category=${encodeURIComponent(selectedCategory)}`;
    }

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
    // Fix: Force Absolute URLs for Client-Side OG Tags (Robustness Upgrade)
    const toAbsolute = (url: string) => {
      if (!url) return '';
      if (/^https?:\/\//i.test(url)) return url;

      const canonicalUrlObject = new URL(canonicalBase, window.location.origin);
      const canonicalPath = canonicalUrlObject.pathname.replace(/\/$/, '');
      if (canonicalPath && (url === canonicalPath || url.startsWith(`${canonicalPath}/`))) {
        return `${canonicalUrlObject.origin}${url}`;
      }

      return `${canonicalBase}/${url.replace(/^\/+/, '')}`;
    };

    ensureMeta('og:title', 'property', title);
    ensureMeta('og:description', 'property', description);
    ensureMeta('og:url', 'property', canonical);
    ensureMeta('og:site_name', 'property', settings.siteName);
    ensureMeta('og:type', 'property', type);

    const ogImage = image || settings.ogImageSquareUrl || '';
    const absoluteOgImage = toAbsolute(ogImage);
    ensureMeta('og:image', 'property', absoluteOgImage);
    ensureMeta('og:image:alt', 'property', absoluteOgImage ? title : '');

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
    ensureMeta('twitter:image', 'name', twitterImage);

    // --- 7. JSON-LD (Advanced Schema) ---
    const jsonLd: any = {
      '@context': 'https://schema.org',
      '@graph': [],
    };

    // Organization Node
    const orgNode = {
      '@type': 'Organization',
      '@id': `${canonicalBase}/#organization`,
      name: settings.siteName,
      url: canonicalBase,
      logo: {
        '@type': 'ImageObject',
        url: toAbsolute(settings.logoUrl || ''),
      },
    };

    // WebSite Node
    const websiteNode = {
      '@type': 'WebSite',
      '@id': `${canonicalBase}/#website`,
      url: canonicalBase,
      name: settings.siteName,
      publisher: { '@id': `${canonicalBase}/#organization` },
    };

    jsonLd['@graph'].push(orgNode, websiteNode);

    if (currentView === 'single-post' && selectedPost) {
      const authorUsername = selectedPost.author_data?.username || selectedPost.author;
      const authorProfileUrl = authorUsername
        ? canonicalUrl(`profile/${encodeURIComponent(authorUsername)}`)
        : '';
      const articleNode = {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: selectedPost.title,
        description: description,
        image: absoluteOgImage ? [absoluteOgImage] : [],
        datePublished: normalizeSchemaDate(selectedPost.createdAt || selectedPost.updatedAt),
        dateModified: normalizeSchemaDate(selectedPost.updatedAt || selectedPost.createdAt),
        author: { '@type': 'Person', name: selectedPost.author, url: authorProfileUrl },
        publisher: { '@id': `${canonicalBase}/#organization` },
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

    setJsonLd(jsonLd);

    // Temporary maintenance is signalled server-side with HTTP 503, not persistent noindex metadata.
    ensureMeta('robots', 'name', 'index, follow');
  }, [settings, currentView, selectedPost, selectedPage, selectedProfile, selectedCategory]);

  return null;
};

export default VonSEO;
