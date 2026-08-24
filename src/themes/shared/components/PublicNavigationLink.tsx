import React from 'react';
import type { NavItem, Page, Post, SiteSettings } from '../../../types';
import { handleCrawlableLinkClick } from '../../../utils/linkEvents';
import { getPublicNavigationHref } from '../../../utils/siteUtils';

interface PublicNavigationLinkProps {
  nav: NavItem;
  settings: SiteSettings;
  posts?: Post[];
  pages?: Page[];
  onNavigate: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const PublicNavigationLink: React.FC<PublicNavigationLinkProps> = ({
  nav,
  settings,
  posts = [],
  pages = [],
  onNavigate,
  className,
  style,
  children,
}) => {
  const href = getPublicNavigationHref(nav, settings, posts, pages);

  if (!href) {
    return (
      <button type="button" onClick={onNavigate} className={className} style={style}>
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      onClick={(event) => handleCrawlableLinkClick(event, onNavigate)}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
};

export default PublicNavigationLink;
