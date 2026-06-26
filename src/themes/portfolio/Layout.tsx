import React, { useState, useMemo, useEffect } from 'react';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { Post } from '../../types';
import { Edit2, Save, X, Camera, Menu, Moon, Sun, Rss } from 'lucide-react';
import { ThemeLayoutProps } from '../types';
import { getBasePathPrefix, normalizeSiteUrl } from '../../utils/siteUtils';
import {
  getOverflowNavigationItems,
  getVisibleNavigationItems,
  shouldUseTabletBurgerMenu,
} from '../../utils/navigation';

// Theme SDK
import {
  VonSEO,
  ContentRenderer,
  VpComments,
  VonNewsletter,
  ShareButtons,
  LoadMoreButton,
  useAISummary,
  useRelatedPosts,
  decodeEntities,
  AdBlock,
  useAdsPopup,
  usePublicProfile,
  usePublicPostsQuery,
  useProfileActivity,
  VonPopupAd,
  getResponsiveImageAttributes,
  hasEmbeddedVideoMarkup,
} from '../shared';

import { API } from '../../config/site.config';
import { vonFetch } from '../../utils/api';
import { isSystemPluginActive } from '../../utils/pluginRuntime';
import { getProfileDisplayRole, isOwnUserProfile } from '../../utils/profileUtils';

// ===== LIGHTBOX COMPONENT =====
const Lightbox: React.FC<{ src: string; alt: string; onClose: () => void }> = ({
  src,
  alt,
  onClose,
}) => (
  <div
    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
    onClick={onClose}
  >
    <button
      onClick={onClose}
      className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors z-10"
    >
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
    <img
      src={src}
      alt={alt}
      className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

// ==========================================
// PORTFOLIO THEME v1.0
// A stunning single-page portfolio showcase
// ==========================================

// Type for Portfolio Settings
interface PortfolioSettings {
  heroStyle: 'fullscreen' | 'split' | 'minimal';
  heroWelcomeText: string;
  heroButtonText: string;
  projectsTitle: string;
  projectsSubtitle: string;
  projectColumns: 2 | 3 | 4;
  animationStyle: 'fade' | 'slide' | 'none';
  accentColor: string;
  // Social Links
  githubUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  dribbbleUrl: string;
  instagramUrl: string;
  websiteUrl: string;
}

// Default settings
const defaultSettings: PortfolioSettings = {
  heroStyle: 'fullscreen',
  heroWelcomeText: 'Welcome to my portfolio',
  heroButtonText: 'View My Work',
  projectsTitle: 'Featured Projects',
  projectsSubtitle: 'A showcase of my best work across design, development, and creative projects',
  projectColumns: 3,
  animationStyle: 'fade',
  accentColor: '#8B5CF6',
  // Social Links
  githubUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
  dribbbleUrl: '',
  instagramUrl: '',
  websiteUrl: '',
};

// ===== CREATIVE COLOR PALETTE =====
const getColors = (isDark: boolean, accent: string) => ({
  // Base colors
  bg: isDark ? '#0f0f0f' : '#fafafa',
  bgSecondary: isDark ? '#1a1a1a' : '#ffffff',
  bgTertiary: isDark ? '#252525' : '#f5f5f5',

  // Text
  text: isDark ? '#ffffff' : '#1a1a1a',
  textSecondary: isDark ? '#e5e5e5' : '#525252',
  textMuted: isDark ? '#a3a3a3' : '#737373',

  // Accent (creative gradient base)
  accent: accent,
  accentLight: isDark ? `${accent}40` : `${accent}20`,

  // Gradients (creative!)
  gradientPrimary: `linear-gradient(135deg, ${accent} 0%, #EC4899 50%, #F59E0B 100%)`,
  gradientSecondary: `linear-gradient(135deg, #3B82F6 0%, ${accent} 100%)`,
  gradientDark: isDark
    ? 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)',

  // Card effects
  cardBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  cardShadow: isDark ? '0 20px 40px rgba(0,0,0,0.4)' : '0 20px 40px rgba(0,0,0,0.1)',
  cardGlow: `0 0 60px ${accent}30`,
});

// ===== SOCIAL LINKS COMPONENT =====
const SocialLinks = ({ settings, colors }: { settings: PortfolioSettings; colors: any }) => {
  const links = [
    {
      url: settings.githubUrl,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
      ),
      label: 'GitHub',
    },
    {
      url: settings.linkedinUrl,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      label: 'LinkedIn',
    },
    {
      url: settings.twitterUrl,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      label: 'X (Twitter)',
    },
    {
      url: settings.dribbbleUrl,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308 2.3-1.555 3.936-4.02 4.395-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.025-8.04 6.4 1.73 1.358 3.92 2.166 6.29 2.166 1.42 0 2.77-.29 4-.814zm-11.62-2.58c.232-.4 3.045-5.055 8.332-6.765.135-.045.27-.084.405-.12-.26-.585-.54-1.167-.832-1.74C7.17 11.775 2.206 11.71 1.756 11.7l-.004.312c0 2.633.998 5.037 2.634 6.855zm-2.42-8.955c.46.008 4.683.026 9.477-1.248-1.698-3.018-3.53-5.558-3.8-5.928-2.868 1.35-5.01 3.99-5.676 7.17zM9.6 2.052c.282.38 2.145 2.914 3.822 6 3.645-1.365 5.19-3.44 5.373-3.702-1.81-1.61-4.19-2.586-6.795-2.586-.825 0-1.63.1-2.4.285zm10.335 3.483c-.218.29-1.935 2.493-5.724 4.04.24.49.47.985.68 1.486.08.18.15.36.22.53 3.41-.43 6.8.26 7.14.33-.02-2.42-.88-4.64-2.31-6.38z" />
        </svg>
      ),
      label: 'Dribbble',
    },
    {
      url: settings.instagramUrl,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
      label: 'Instagram',
    },
    {
      url: settings.websiteUrl,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      label: 'Website',
    },
  ].filter((link) => link.url && link.url.trim() !== '');

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-3 mt-6">
      {links.map((link, index) => (
        <a
          key={index}
          href={normalizeSiteUrl(link.url)}
          target="_blank"
          rel="noopener noreferrer"
          title={link.label}
          className="p-3 rounded-full transition-all duration-300 hover:scale-110"
          style={{
            color: colors.textSecondary,
            background: colors.bgTertiary,
            border: `1px solid ${colors.cardBorder}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.background = colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.textSecondary;
            e.currentTarget.style.background = colors.bgTertiary;
          }}
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
};

// ===== ANIMATION CLASSES =====
const getAnimationClass = (style: string, delay: number = 0) => {
  const baseDelay = `animation-delay: ${delay * 100}ms;`;
  switch (style) {
    case 'fade':
      return `opacity-0 animate-[fadeIn_0.6s_ease-out_forwards] ${baseDelay}`;
    case 'slide':
      return `opacity-0 translate-y-8 animate-[slideUp_0.6s_ease-out_forwards] ${baseDelay}`;
    default:
      return '';
  }
};

// ===== HERO COMPONENTS =====

// Fullscreen Hero
const HeroFullscreen = ({ settings, name, tagline, colors }: any) => (
  <section
    className="relative min-h-screen flex items-center justify-center overflow-hidden"
    style={{ background: colors.bg }}
  >
    {/* Animated gradient background */}
    <div
      className="absolute inset-0 opacity-30"
      style={{
        background: colors.gradientPrimary,
        filter: 'blur(100px)',
        transform: 'scale(1.2)',
      }}
    />

    {/* Grid pattern overlay */}
    <div
      className="absolute inset-0 opacity-10"
      style={{
        backgroundImage: `radial-gradient(${colors.accent} 1px, transparent 1px)`,
        backgroundSize: '30px 30px',
      }}
    />

    {/* Content */}
    <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
      <div className={getAnimationClass(settings.animationStyle, 0)}>
        <span
          className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6"
          style={{
            background: colors.accentLight,
            color: colors.accent,
          }}
        >
          {settings.heroWelcomeText}
        </span>
      </div>

      <h1
        className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6 ${getAnimationClass(settings.animationStyle, 1)}`}
        style={{ color: colors.text }}
      >
        {name || 'Creative Portfolio'}
      </h1>

      <p
        className={`text-xl md:text-2xl max-w-2xl mx-auto mb-10 ${getAnimationClass(settings.animationStyle, 2)}`}
        style={{ color: colors.textSecondary }}
      >
        {tagline || 'Showcasing creative works and professional projects'}
      </p>

      <div className={getAnimationClass(settings.animationStyle, 3)}>
        <a
          href="#projects"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white transition-all hover:scale-105 hover:shadow-lg"
          style={{ background: colors.gradientPrimary }}
        >
          {settings.heroButtonText}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </a>
      </div>

      {/* Social Links */}
      <div className={getAnimationClass(settings.animationStyle, 4)}>
        <SocialLinks settings={settings} colors={colors} />
      </div>
    </div>

    {/* Scroll indicator */}
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
      <div
        className="w-6 h-10 rounded-full border-2 flex items-start justify-center p-2"
        style={{ borderColor: colors.textMuted }}
      >
        <div
          className="w-1.5 h-3 rounded-full animate-pulse"
          style={{ background: colors.accent }}
        />
      </div>
    </div>
  </section>
);

// Split Hero
const HeroSplit = ({
  settings,
  name,
  tagline,
  colors,
  featuredImage,
  featuredImageSrcSet,
}: any) => (
  <section className="min-h-screen grid md:grid-cols-2" style={{ background: colors.bg }}>
    {/* Left: Content */}
    <div className="flex items-center justify-center p-8 md:p-16 order-2 md:order-1">
      <div className="max-w-lg">
        <span
          className={`inline-block px-4 py-2 rounded-full text-sm font-medium mb-6 ${getAnimationClass(settings.animationStyle, 0)}`}
          style={{
            background: colors.accentLight,
            color: colors.accent,
          }}
        >
          Portfolio
        </span>

        <h1
          className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6 ${getAnimationClass(settings.animationStyle, 1)}`}
          style={{ color: colors.text }}
        >
          {name || 'Creative Portfolio'}
        </h1>

        <p
          className={`text-lg mb-8 ${getAnimationClass(settings.animationStyle, 2)}`}
          style={{ color: colors.textSecondary }}
        >
          {tagline || 'Showcasing creative works and professional projects'}
        </p>

        <div className={`flex gap-4 ${getAnimationClass(settings.animationStyle, 3)}`}>
          <a
            href="#projects"
            className="px-6 py-3 rounded-full font-medium text-white transition-all hover:scale-105"
            style={{ background: colors.gradientPrimary }}
          >
            View Projects
          </a>
        </div>

        {/* Social Links */}
        <div className={getAnimationClass(settings.animationStyle, 4)}>
          <SocialLinks settings={settings} colors={colors} />
        </div>
      </div>
    </div>

    {/* Right: Image */}
    <div
      className="relative min-h-[50vh] md:min-h-screen order-1 md:order-2"
      style={{ background: colors.gradientPrimary }}
    >
      {featuredImage && (
        <img
          {...getResponsiveImageAttributes(
            { image: featuredImage, imageSrcSet: featuredImageSrcSet },
            'hero'
          )}
          alt="Featured"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
        />
      )}
      {/* Decorative shapes */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  </section>
);

// Minimal Hero
const HeroMinimal = ({ settings, name, tagline, colors }: any) => (
  <section className="py-20 px-6" style={{ background: colors.bg }}>
    <div className="max-w-4xl mx-auto text-center">
      <h1
        className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-4 ${getAnimationClass(settings.animationStyle, 0)}`}
        style={{ color: colors.text }}
      >
        {name || 'Portfolio'}
      </h1>
      <p
        className={`text-lg ${getAnimationClass(settings.animationStyle, 1)}`}
        style={{ color: colors.textSecondary }}
      >
        {tagline || 'Creative works & projects'}
      </p>
    </div>
  </section>
);

// ===== PROJECT CARD =====
const ProjectCard = ({ project, colors, settings, index, onClick }: any) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-500 ${getAnimationClass(settings.animationStyle, index)}`}
      style={{
        background: colors.bgSecondary,
        border: `1px solid ${colors.cardBorder}`,
        boxShadow: isHovered ? colors.cardGlow : colors.cardShadow,
        transform: isHovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(project.id)}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {project.image ? (
          <img
            {...getResponsiveImageAttributes(project, 'card')}
            alt={decodeEntities(project.title)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: colors.gradientPrimary }}
          >
            <span className="text-6xl opacity-50">🎨</span>
          </div>
        )}

        {/* Overlay gradient */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `linear-gradient(180deg, transparent 0%, ${colors.accent}90 100%)` }}
        />

        {/* Category badge */}
        {project.category && (
          <span
            className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-medium text-white"
            style={{ background: `${colors.accent}CC` }}
          >
            {project.category}
          </span>
        )}

        {/* View icon on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3
          className="text-lg font-semibold mb-2 transition-colors duration-300"
          style={{ color: isHovered ? colors.accent : colors.text }}
        >
          {decodeEntities(project.title)}
        </h3>
        {project.excerpt && (
          <p className="text-sm line-clamp-2" style={{ color: colors.textSecondary }}>
            {decodeEntities(project.excerpt)}
          </p>
        )}
      </div>
    </article>
  );
};

// ===== PROJECTS SECTION =====
const ProjectsSection = ({
  projects,
  settings,
  colors,
  onProjectClick,
  selectedCategory,
  onCategoryClick,
}: any) => {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  // Category Filter State
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    setActiveCategory(selectedCategory || 'all');
  }, [selectedCategory]);

  // Get unique categories from projects
  const categories = useMemo(() => {
    const cats = new Set<string>();
    projects.forEach((p: Post) => {
      if (p.category) cats.add(p.category);
    });
    return ['all', ...Array.from(cats)];
  }, [projects]);

  // Pagination State (Respects Global 'Posts Per Page' setting)
  const perPage = settings.postsPerPage || 6;
  const publicPosts = usePublicPostsQuery({
    initialPosts: projects,
    category: activeCategory === 'all' ? null : activeCategory,
    limit: perPage,
  });

  const filteredProjects = publicPosts.posts;
  const hasMore = publicPosts.hasMore;
  const loadingMore = publicPosts.loadingMore;
  const onLoadMore = publicPosts.loadMore;
  const isInitialDiscoveryLoading = publicPosts.isLoading && filteredProjects.length === 0;

  return (
    <section id="projects" className="py-20 px-6" style={{ background: colors.bgSecondary }}>
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4"
            style={{
              background: colors.accentLight,
              color: colors.accent,
            }}
          >
            Portfolio
          </span>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4"
            style={{ color: colors.text }}
          >
            {settings.projectsTitle}
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: colors.textSecondary }}>
            {settings.projectsSubtitle}
          </p>
        </div>

        {/* Category Filter Buttons */}
        {categories.length > 2 && (
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  onCategoryClick?.(cat === 'all' ? '' : cat);
                }}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeCategory === cat ? 'scale-105 shadow-lg' : 'hover:scale-105'
                }`}
                style={{
                  background: activeCategory === cat ? colors.accent : colors.bgTertiary,
                  color: activeCategory === cat ? '#fff' : colors.textSecondary,
                  border: `1px solid ${activeCategory === cat ? colors.accent : colors.cardBorder}`,
                }}
              >
                {cat === 'all' ? 'All Projects' : cat}
              </button>
            ))}
          </div>
        )}

        {isInitialDiscoveryLoading ? (
          <div className="text-center py-20 rounded-2xl" style={{ background: colors.bgTertiary }}>
            <p
              className="text-sm font-semibold uppercase tracking-[0.25em]"
              style={{ color: colors.textSecondary }}
            >
              Loading projects...
            </p>
          </div>
        ) : (
          <>
            {/* Projects grid */}
            <div className={`grid ${gridCols[settings.projectColumns as 2 | 3 | 4]} gap-8`}>
              {filteredProjects.map((project: Post, index: number) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  colors={colors}
                  settings={settings}
                  index={index}
                  onClick={onProjectClick}
                />
              ))}
            </div>

            {/* Load More Button */}
            <div className="mt-16">
              <LoadMoreButton
                loading={loadingMore}
                hasMore={hasMore}
                onLoadMore={onLoadMore}
                label="Show More Projects"
                style={{
                  background: colors.bgSecondary,
                  color: colors.text,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '9999px', // Maintain rounded-full look
                }}
              />
            </div>

            {filteredProjects.length === 0 && (
              <div
                className="text-center py-20 rounded-2xl"
                style={{ background: colors.bgTertiary }}
              >
                <span className="text-6xl mb-4 block">📁</span>
                <p style={{ color: colors.textSecondary }}>No projects yet</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

// ===== FOOTER =====
const PortfolioFooter = ({ colors, settings }: any) => {
  const rssPath = `${getBasePathPrefix()}/rss`;
  return (
    <footer
      className="py-6 px-6 text-center"
      style={{
        background: colors.bgSecondary,
        borderTop: `1px solid ${colors.cardBorder}`,
      }}
    >
      <div className="max-w-4xl mx-auto mb-12">
        {/* Newsletter Widget - Portfolio Style */}
        {settings?.newsletter?.enabled &&
          (settings.newsletter?.position === 'footer' ||
            settings.newsletter?.position === 'both') && (
            <VonNewsletter
              settings={settings.newsletter}
              variant="footer"
              accentColor={colors.accent}
              themeColors={{
                surface: colors.bgTertiary,
                surfaceAlt: colors.bgSecondary,
                border: colors.cardBorder,
                text: colors.text,
                textSecondary: colors.textSecondary,
              }}
            />
          )}
      </div>

      <p
        className="text-sm mb-4 flex items-center justify-center gap-6"
        style={{ color: colors.textMuted }}
      >
        <a
          href={rssPath}
          className="hover:opacity-100 transition-opacity flex items-center gap-1.5"
          style={{ color: colors.textMuted }}
          title="RSS Feed"
        >
          <Rss size={14} />
          <span>RSS</span>
        </a>
        <span>Powered by VonCMS</span>
      </p>
    </footer>
  );
};

// ===== NAVIGATION =====
const PortfolioNav = ({
  colors,
  siteName,
  isDark,
  toggleDarkMode,
  user,
  onLogin,
  onLogout,
  onNavigateAdmin,
  onViewProfile,
  onBackToHome,
  onPageClick,
  onPostClick,
  settings,
  pages,
  transparentTextColor,
}: any) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigationItems = settings?.navigation || [];
  const visibleNavigationItems = getVisibleNavigationItems(navigationItems);
  const overflowNavigationItems = getOverflowNavigationItems(navigationItems);
  const useTabletBurgerMenu = shouldUseTabletBurgerMenu(navigationItems);
  const desktopNavigationItemClassName = `${
    useTabletBurgerMenu ? 'hidden lg:block' : 'hidden md:block'
  } text-sm font-medium transition-colors hover:opacity-80 bg-transparent border-none cursor-pointer`;
  const compactNavigationClassName = useTabletBurgerMenu ? 'lg:hidden' : 'md:hidden';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'py-4' : 'py-6'}`}
      style={{
        top: 'var(--top-bar-height, 0px)',
        background: isScrolled ? `${colors.bg}E6` : 'transparent',
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        borderBottom: isScrolled ? `1px solid ${colors.cardBorder}` : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-3 bg-transparent border-none cursor-pointer"
          title={siteName || 'Portfolio'}
        >
          {settings?.logoUrl && (
            <img
              src={settings.logoUrl}
              alt={siteName}
              className={`${settings.useLogoAsTitle ? 'h-10' : 'h-8'} w-auto object-contain`}
            />
          )}
          {(!settings?.logoUrl || !settings?.useLogoAsTitle) && (
            <span
              className="text-xl font-bold max-w-[200px] truncate"
              style={{
                color: !isScrolled && transparentTextColor ? transparentTextColor : colors.text,
              }}
            >
              {siteName || 'Portfolio'}
            </span>
          )}
        </button>

        <div className="flex items-center gap-4">
          {/* Standard Navigation */}
          {visibleNavigationItems.map((nav: any) => (
            <button
              key={nav.id}
              onClick={() => {
                if (nav.url === 'home') return onBackToHome();
                if (nav.url.startsWith('page:') && onPageClick) {
                  const pid = nav.url.split(':')[1];
                  const page = pages?.find((p: any) => p.id === pid || p.slug === pid);
                  return onPageClick(page?.slug || pid);
                }
                if (nav.url.startsWith('post:') && onPostClick)
                  return onPostClick(nav.url.split(':')[1]);
                window.location.href = normalizeSiteUrl(nav.url);
              }}
              className={desktopNavigationItemClassName}
              style={{
                color:
                  !isScrolled && transparentTextColor ? transparentTextColor : colors.textSecondary,
              }}
            >
              {nav.label || nav.url}
            </button>
          ))}

          {/* More Dropdown */}
          {overflowNavigationItems.length > 0 && (
            <div
              className={`relative group ${
                useTabletBurgerMenu ? 'hidden lg:block' : 'hidden md:block'
              }`}
            >
              <button
                className="text-sm font-medium transition-colors hover:opacity-80 flex items-center gap-1 bg-transparent border-none cursor-pointer"
                style={{
                  color:
                    !isScrolled && transparentTextColor
                      ? transparentTextColor
                      : colors.textSecondary,
                }}
              >
                More
                <svg
                  className="w-3 h-3 transition-transform group-hover:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div
                className="absolute top-full right-0 mt-2 w-48 py-2 rounded-xl shadow-xl border overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
                style={{ background: colors.bgSecondary, borderColor: colors.cardBorder }}
              >
                {overflowNavigationItems.map((nav: any) => (
                  <button
                    key={nav.id}
                    onClick={() => {
                      if (nav.url === 'home') return onBackToHome();
                      if (nav.url.startsWith('page:') && onPageClick) {
                        const pid = nav.url.split(':')[1];
                        const page = pages?.find((p: any) => p.id === pid || p.slug === pid);
                        return onPageClick(page?.slug || pid);
                      }
                      if (nav.url.startsWith('post:') && onPostClick)
                        return onPostClick(nav.url.split(':')[1]);
                      window.location.href = normalizeSiteUrl(nav.url);
                    }}
                    className="w-full px-4 py-3 text-left text-sm hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer"
                    style={{ color: colors.text }}
                  >
                    {nav.label || nav.url}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* User section */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-full transition-all"
                style={{ background: colors.bgTertiary }}
                aria-label="User Menu"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-[28px] h-[28px] rounded-full object-cover"
                  />
                ) : (
                  <Gravatar email={user.email} size={28} className="rounded-full" />
                )}
                <span
                  className="text-sm font-medium hidden sm:block"
                  style={{ color: colors.text }}
                >
                  {user.username}
                </span>
              </button>

              {showUserMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl border overflow-hidden z-50"
                  style={{ background: colors.bgSecondary, borderColor: colors.cardBorder }}
                >
                  <button
                    onClick={() => {
                      onViewProfile(user.username);
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm hover:opacity-80 transition-opacity"
                    style={{ color: colors.text }}
                  >
                    👤 View Profile
                  </button>
                  {['Admin', 'Moderator', 'Writer'].includes(user.role) && (
                    <button
                      onClick={() => {
                        onNavigateAdmin();
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm hover:opacity-80 transition-opacity"
                      style={{ color: colors.text }}
                    >
                      ⚙️ Dashboard
                    </button>
                  )}
                  <div style={{ borderTop: `1px solid ${colors.cardBorder}` }} />
                  <button
                    onClick={() => {
                      onLogout();
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-red-500 hover:opacity-80 transition-opacity"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: colors.accent }}
            >
              Login
            </button>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full transition-colors"
            style={{ background: colors.bgTertiary }}
          >
            {isDark ? (
              <Moon size={20} className="text-blue-400" />
            ) : (
              <Sun size={20} className="text-amber-500" />
            )}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`${compactNavigationClassName} p-2 rounded-full transition-colors bg-transparent border-none cursor-pointer`}
            style={{
              color: !isScrolled && transparentTextColor ? transparentTextColor : colors.text,
            }}
            aria-label={isMobileMenuOpen ? 'Close Mobile Menu' : 'Open Mobile Menu'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className={`${compactNavigationClassName} absolute top-full left-0 right-0 py-6 px-6 shadow-xl border-t animate-slide-in-top`}
          style={{ background: colors.bgSecondary, borderColor: colors.cardBorder }}
        >
          <div className="flex flex-col gap-4">
            {navigationItems.map((nav: any) => (
              <button
                key={nav.id}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (nav.url === 'home') return onBackToHome();
                  if (nav.url.startsWith('page:') && onPageClick) {
                    const pid = nav.url.split(':')[1];
                    const page = pages?.find((p: any) => p.id === pid || p.slug === pid);
                    return onPageClick(page?.slug || pid);
                  }
                  if (nav.url.startsWith('post:') && onPostClick)
                    return onPostClick(nav.url.split(':')[1]);
                  window.location.href = normalizeSiteUrl(nav.url);
                }}
                className="text-left py-2 text-lg font-medium border-b bg-transparent cursor-pointer"
                style={{ color: colors.text, borderColor: colors.cardBorder }}
              >
                {nav.label || nav.url}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

// ===== SINGLE PROJECT VIEW =====
const SingleProject = ({
  project,
  colors,
  onBack,
  comments,
  user,
  onAddComment,
  onLikeComment,
  onReplyComment,
  onLogin,
  settings,
  onViewProfile,
  posts, // Added
  onPostClick, // Added
}: any) => {
  // Plugin Hooks (v1.9.9)
  const { component: aiSummary, position: aiSummaryPos } = useAISummary(
    settings,
    project.content || ''
  ) || { component: null, position: 'top' };
  const relatedPosts = useRelatedPosts(
    settings,
    project as any,
    posts || [],
    (p) => onPostClick && onPostClick(p.id),
    {
      primary: colors.accent,
      secondary: colors.textSecondary,
      surface: colors.bgSecondary,
      surfaceAlt: colors.bgTertiary,
      border: colors.cardBorder,
      text: colors.text,
      textSecondary: colors.textMuted,
    }
  );

  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <article style={{ background: colors.bg }} className="min-h-screen">
      {/* Lightbox */}
      {lightboxOpen && project.image && (
        <Lightbox
          src={project.image}
          alt={decodeEntities(project.title)}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Back button - Floating */}
      <button
        onClick={onBack}
        className="fixed top-24 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full text-white bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header Section */}
      <header className="relative py-32 px-6 md:px-16 text-center">
        <div
          className="absolute inset-0"
          style={{ background: colors.gradientDark, opacity: 0.95 }}
        />
        <div className="max-w-4xl mx-auto relative z-10">
          {project.category && (
            <span
              className="inline-block px-4 py-2 rounded-full text-sm font-medium text-white mb-4"
              style={{ background: `${colors.accent}CC` }}
            >
              {project.category}
            </span>
          )}
          <h1
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ color: colors.text }}
          >
            {decodeEntities(project.title)}
          </h1>
          <div className="flex items-center justify-center gap-4">
            <div>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {project.author} •{' '}
                {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : ''} •{' '}
                {project.readTime || '5 min read'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Featured Image - Smart Detection */}
      {(() => {
        if (!project.image) return null;

        // Check for video embeds
        const hasVideo = hasEmbeddedVideoMarkup(project.content);

        if (hasVideo) return null;

        // Check filename match
        const imageFilename = project.image.split('/').pop()?.split('?')[0] || '';
        const imageInContent =
          (project.content && project.content.includes(project.image)) ||
          (imageFilename && project.content && project.content.includes(imageFilename));

        if (imageInContent) return null;

        return (
          <div className="max-w-6xl mx-auto px-6 -mt-16 mb-16 relative z-10">
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <img
                {...getResponsiveImageAttributes(project, 'hero')}
                alt={decodeEntities(project.title)}
                className="w-full h-auto max-h-[600px] object-cover cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
              />
            </div>
          </div>
        );
      })()}

      {/* AI Summary Plugin */}
      {aiSummaryPos === 'top' && aiSummary}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Share Buttons (Top) */}
        {settings.sharePlacement === 'top' && (
          <div className="mb-8">
            <ShareButtons
              title={decodeEntities(project.title)}
              url={window.location.href}
              className="justify-start"
            />
          </div>
        )}

        <ContentRenderer
          className="prose prose-lg dark:prose-invert max-w-none"
          style={{ color: colors.text }}
          html={project.content || ''}
        />
        {aiSummaryPos === 'bottom' && aiSummary}

        {/* Tags */}
        {project.keywords && (
          <div className="mt-8 pt-8 border-t" style={{ borderColor: colors.cardBorder }}>
            <div className="flex flex-wrap gap-2">
              {project.keywords.split(',').map((tag: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1.5 text-sm rounded-full"
                  style={{ background: colors.bgTertiary, color: colors.textSecondary }}
                >
                  #{tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Related Posts Plugin */}
      <div className="max-w-4xl mx-auto px-6 pb-8">{relatedPosts}</div>

      {/* Comments Section */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        {/* Share Buttons (Bottom) */}
        {(settings.sharePlacement === 'bottom' || !settings.sharePlacement) && (
          <div className="max-w-4xl mx-auto px-6 mb-8">
            <ShareButtons
              title={decodeEntities(project.title)}
              url={window.location.href}
              className="justify-start"
            />
          </div>
        )}

        <hr className="my-12 border-t" style={{ borderColor: colors.cardBorder }} />
        <VpComments
          comments={comments}
          user={user}
          onAddComment={(content: string) => onAddComment(project.id, content)}
          onLikeComment={onLikeComment}
          onReplyComment={onReplyComment}
          onLogin={onLogin}
          settings={settings}
          onViewProfile={onViewProfile}
          themeColors={{
            surface: colors.bgSecondary,
            surfaceAlt: colors.bgTertiary,
            border: colors.cardBorder,
            text: colors.text,
            textSecondary: colors.textSecondary,
            primary: colors.accent,
          }}
          id="portfolio-comments"
        />
      </div>
    </article>
  );
};

// ===== SINGLE PAGE VIEW =====
const SinglePage = ({ page, colors, onBack }: any) => (
  <article style={{ background: colors.bg }} className="min-h-screen">
    {/* Simple Hero */}
    <div className="relative h-[40vh] bg-black/50">
      <div className="w-full h-full" style={{ background: colors.gradientPrimary }} />
      <div className="absolute inset-0" style={{ background: colors.gradientDark, opacity: 0.8 }} />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-24 left-6 flex items-center gap-2 px-4 py-2 rounded-full text-white bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors z-10"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 flex justify-center">
        <h1
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-center"
          style={{ color: colors.text }}
        >
          {page.title}
        </h1>
      </div>
    </div>

    {/* Content */}
    <div className="max-w-4xl mx-auto px-6 py-16">
      <ContentRenderer
        className="prose prose-lg dark:prose-invert max-w-none"
        style={{ color: colors.text }}
        html={page.content || ''}
      />
    </div>
  </article>
);

// ===== PORTFOLIO PROFILE COMPONENT =====
const PortfolioProfile = ({
  profileUser,
  currentUser,
  projects: _projects,
  comments: _comments,
  colors,
  settings,
  onPostClick,
  onBack,
  onUpdateUser,
}: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(profileUser.display_name || '');
  const [editBio, setEditBio] = useState(profileUser.bio || '');
  const [editAvatar, setEditAvatar] = useState(profileUser.avatar || '');
  const [localUser, setLocalUser] = useState(profileUser);

  // Password Change State
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    setLocalUser(profileUser);
    setEditDisplayName(profileUser.display_name || '');
    setEditBio(profileUser.bio || '');
    setEditAvatar(profileUser.avatar || '');
  }, [profileUser]);

  const handleSave = async () => {
    try {
      // Validate Password Change
      if (showPasswordFields) {
        if (!currentPassword) {
          toast.error('Current password is required');
          return;
        }
        if (
          newPassword &&
          (newPassword.length < 8 ||
            !/[A-Z]/.test(newPassword) ||
            !/[0-9]/.test(newPassword) ||
            !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword))
        ) {
          toast.error('Password too weak (8+ chars, Upper, Number, Symbol)');
          return;
        }
        if (newPassword !== confirmNewPassword) {
          toast.error('Passwords do not match');
          return;
        }
      }

      const updated = {
        ...localUser,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };

      const payload: any = {
        id: currentUser?.id,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };

      if (showPasswordFields && newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const response = await vonFetch(API.updateProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setLocalUser(updated);
        setIsEditing(false);
        if (onUpdateUser)
          onUpdateUser({ display_name: editDisplayName, bio: editBio, avatar: editAvatar });
        toast.success(data.message || 'Profile updated');

        // Clear passwords
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordFields(false);
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch (e) {
      toast.error('Failed to save');
    }
  };

  // Pagination State
  const postsPerPage = settings.postsPerPage || 6;
  const [activeTab, setActiveTab] = useState<'projects' | 'comments'>('projects');
  const {
    articlePosts,
    articleTotal,
    articleHasMore,
    articlesLoading,
    articlesError,
    commentItems,
    commentTotal,
    commentHasMore,
    commentsLoading,
    commentsError,
    loadMoreArticles,
    loadMoreComments,
  } = useProfileActivity(profileUser, postsPerPage);

  return (
    <div className="flex-1 py-24 px-6 min-h-screen">
      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden relative">
            <button
              onClick={() => setIsEditing(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>

            <div className="p-8">
              <h3
                className="text-2xl font-bold mb-6 flex items-center gap-3"
                style={{ color: colors.text }}
              >
                <Edit2 className="text-purple-500" /> Edit Profile
              </h3>

              <div className="space-y-6">
                <div>
                  <span
                    className="block text-xs font-bold uppercase tracking-widest mb-2 opacity-60"
                    style={{ color: colors.text }}
                  >
                    Display name / Pen name
                  </span>
                  <input
                    aria-label="Display name / Pen name"
                    id="layout-display-name"
                    name="layoutDisplayName"
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    style={{ color: colors.text }}
                    placeholder="Public author name"
                  />
                </div>
                <div>
                  <span
                    className="block text-xs font-bold uppercase tracking-widest mb-2 opacity-60"
                    style={{ color: colors.text }}
                  >
                    Avatar Image
                  </span>
                  <div className="relative">
                    <input
                      aria-label="Avatar Image"
                      id="layout-1398"
                      name="layout1398"
                      type="text"
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      style={{ color: colors.text }}
                      placeholder="https://..."
                    />
                    <div className="absolute right-3 top-3 text-gray-400 pointer-events-none">
                      <Camera size={18} />
                    </div>
                  </div>
                </div>

                <div>
                  <span
                    className="block text-xs font-bold uppercase tracking-widest mb-2 opacity-60"
                    style={{ color: colors.text }}
                  >
                    Bio / Intro
                  </span>
                  <textarea
                    id="layout-1419"
                    name="layout1419"
                    aria-label="Bio / Intro"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={4}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
                    style={{ color: colors.text }}
                    placeholder="Write a short bio..."
                  />
                </div>

                {/* Password Change Section */}
                <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowPasswordFields(!showPasswordFields)}
                    className="text-sm font-bold flex items-center gap-2 hover:opacity-80 transition-opacity"
                    style={{ color: colors.accent }}
                  >
                    {showPasswordFields ? 'Cancel Password Change' : 'Change Password'}
                  </button>

                  {showPasswordFields && (
                    <div className="mt-4 space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 animate-fade-in">
                      <div>
                        <span
                          className="block text-xs font-bold uppercase tracking-widest mb-1 opacity-60"
                          style={{ color: colors.text }}
                        >
                          Current Password
                        </span>
                        <input
                          aria-label="Current Password"
                          id="layout-1449"
                          name="layout1449"
                          type="password"
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-sans"
                          style={{ color: colors.text }}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                      </div>
                      <div>
                        <span
                          className="block text-xs font-bold uppercase tracking-widest mb-1 opacity-60"
                          style={{ color: colors.text }}
                        >
                          New Password (min 8 chars)
                        </span>
                        <input
                          id="8-chars-upper-number-symbol"
                          name="8CharsUpperNumberSymbol"
                          aria-label="8+ chars, Upper, Number, Symbol"
                          type="password"
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-sans"
                          placeholder="8+ chars, Upper, Number, Symbol"
                          style={{ color: colors.text }}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <div>
                        <span
                          className="block text-xs font-bold uppercase tracking-widest mb-1 opacity-60"
                          style={{ color: colors.text }}
                        >
                          Confirm Password
                        </span>
                        <input
                          id="layout-1480"
                          name="layout1480"
                          aria-label="Confirm Password"
                          type="password"
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-sans"
                          style={{ color: colors.text }}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-4">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2 rounded-full font-medium transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
                  style={{ color: colors.textSecondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-8 py-2 rounded-full font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <Save size={18} /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-8 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: colors.textSecondary }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Portfolio
        </button>

        {/* Profile Card */}
        <div
          className="text-center p-8 rounded-3xl mb-12 relative group"
          style={{
            background: colors.bgSecondary,
            border: `1px solid ${colors.cardBorder}`,
            boxShadow: colors.cardShadow,
          }}
        >
          <div className="relative inline-block">
            <div className="relative">
              {localUser.avatar ? (
                <img
                  src={localUser.avatar}
                  alt={localUser.display_name || localUser.username}
                  className="w-32 h-32 rounded-full object-cover mx-auto mb-6 ring-4 ring-purple-500/30"
                />
              ) : (
                <Gravatar
                  email={localUser.email || localUser.username}
                  size={120}
                  className="rounded-full mx-auto mb-6 ring-4 ring-purple-500/30"
                />
              )}
            </div>

            {isOwnUserProfile(currentUser, localUser) && (
              <button
                onClick={() => setIsEditing(true)}
                className="absolute bottom-6 right-0 bg-white dark:bg-zinc-800 p-2 rounded-full shadow-lg border border-gray-100 dark:border-zinc-700 hover:scale-110 transition-transform text-purple-600 z-10"
                title="Edit Profile"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>

          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2"
            style={{ color: colors.text }}
          >
            {localUser.display_name || localUser.username}
          </h1>
          {localUser.display_name && (
            <p className="text-sm mb-2" style={{ color: colors.textSecondary }}>
              @{localUser.username}
            </p>
          )}
          <span
            className="inline-block px-4 py-1 rounded-full text-sm font-medium mb-4"
            style={{ background: colors.accentLight, color: colors.accent }}
          >
            {getProfileDisplayRole(currentUser, localUser, 'Creator')}
          </span>
          {localUser.bio && (
            <p className="max-w-lg mx-auto text-lg" style={{ color: colors.textSecondary }}>
              {localUser.bio}
            </p>
          )}

          {/* Stats Row */}
          <div
            className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-8 pt-6 border-t"
            style={{ borderColor: colors.cardBorder }}
          >
            <div className="text-center">
              <span className="block text-2xl font-bold" style={{ color: colors.text }}>
                {articleTotal}
              </span>
              <span
                className="text-xs uppercase tracking-wider font-medium"
                style={{ color: colors.textSecondary }}
              >
                Projects
              </span>
            </div>
            <div
              className="text-center border-l border-r"
              style={{ borderColor: colors.cardBorder }}
            >
              <span className="block text-2xl font-bold" style={{ color: colors.text }}>
                {commentTotal}
              </span>
              <span
                className="text-xs uppercase tracking-wider font-medium"
                style={{ color: colors.textSecondary }}
              >
                Comments
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mb-8 border-b" style={{ borderColor: colors.cardBorder }}>
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'projects' ? '' : 'opacity-60 hover:opacity-100'}`}
            style={{ color: activeTab === 'projects' ? colors.accent : colors.textSecondary }}
          >
            Projects ({articleTotal})
            {activeTab === 'projects' && (
              <span
                className="absolute bottom-0 left-0 w-full h-0.5 rounded-full"
                style={{ background: colors.accent }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'comments' ? '' : 'opacity-60 hover:opacity-100'}`}
            style={{ color: activeTab === 'comments' ? colors.accent : colors.textSecondary }}
          >
            Discussion ({commentTotal})
            {activeTab === 'comments' && (
              <span
                className="absolute bottom-0 left-0 w-full h-0.5 rounded-full"
                style={{ background: colors.accent }}
              />
            )}
          </button>
        </div>

        {activeTab === 'projects' ? (
          <>
            {articlePosts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {articlePosts.map((project: Post, index: number) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      colors={colors}
                      settings={settings}
                      index={index}
                      onClick={onPostClick}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                <div className="mt-12 mb-8">
                  <LoadMoreButton
                    loading={articlesLoading}
                    hasMore={articleHasMore && activeTab === 'projects'}
                    error={articlesError}
                    onLoadMore={loadMoreArticles}
                    label="Load More Projects"
                    style={{
                      background: colors.bgSecondary,
                      color: colors.text,
                      border: `1px solid ${colors.cardBorder}`,
                      borderRadius: '9999px',
                    }}
                  />
                </div>
              </>
            ) : (
              <div
                className="text-center py-16 rounded-2xl"
                style={{ background: colors.bgTertiary }}
              >
                <span className="text-4xl mb-4 block">📁</span>
                <p style={{ color: colors.textSecondary }}>No projects yet</p>
              </div>
            )}
          </>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="space-y-4">
              {commentItems.length > 0 ? (
                commentItems.map((comment: any) => (
                  <div
                    key={comment.id}
                    className="p-6 rounded-2xl border transition-all hover:shadow-lg relative group"
                    style={{ background: colors.bgSecondary, borderColor: colors.cardBorder }}
                  >
                    <p className="mb-4 italic text-lg" style={{ color: colors.text }}>
                      "{comment.content}"
                    </p>
                    <div
                      className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider"
                      style={{ color: colors.textSecondary }}
                    >
                      <span>{comment.createdAt}</span>
                      <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                      <span style={{ color: colors.accent }}>{comment.likes || 0} Likes</span>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="text-center py-16 rounded-2xl"
                  style={{ background: colors.bgTertiary }}
                >
                  <span className="text-4xl mb-4 block">💬</span>
                  <p style={{ color: colors.textSecondary }}>
                    {commentsLoading ? 'Loading discussion...' : 'No discussion yet'}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-12 mb-8">
              <LoadMoreButton
                loading={commentsLoading}
                hasMore={commentHasMore}
                error={commentsError}
                onLoadMore={loadMoreComments}
                label="Load More Discussion"
                style={{
                  background: colors.bgSecondary,
                  color: colors.text,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '9999px',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== MAIN LAYOUT COMPONENT =====
const PortfolioLayout = ({
  posts,
  pages,
  settings: siteSettings,
  isDarkMode,
  toggleDarkMode,
  onPostClick,
  onPageClick,
  currentView,
  selectedPost,
  selectedPage,
  onBackToHome,
  user,
  onLogin,
  onLogout,
  onNavigateAdmin,
  onViewProfile,
  comments,
  onAddComment,
  onLikeComment,
  onReplyComment,
  selectedProfile,
  selectedCategory,
  onCategoryClick,
  allUsers,
  onUpdateUser,
}: ThemeLayoutProps) => {
  // Portfolio settings (merge from saved config)
  const portfolioSettings: PortfolioSettings = useMemo(
    () =>
      ({
        ...defaultSettings,
        ...((siteSettings.theme as any)?.portfolio || {}),
      }) as PortfolioSettings,
    [(siteSettings.theme as any)?.portfolio]
  );

  // Get colors
  const colors = useMemo(
    () => getColors(isDarkMode, portfolioSettings.accentColor),
    [isDarkMode, portfolioSettings.accentColor]
  );
  const shouldRenderVonSEO = isSystemPluginActive(siteSettings, 'vp_von_seo');

  // Filter published posts as projects
  const projects = useMemo(() => posts.filter((p) => p.status === 'published'), [posts]);

  // Shared Hooks
  const { showPopup, closePopup } = useAdsPopup(siteSettings.ads);
  const { targetProfile, isLoading: isLoadingProfile } = usePublicProfile(
    selectedProfile,
    allUsers,
    siteSettings.adminProfile
  );

  // Get featured image from first project
  const featuredImage = projects[0]?.image;
  const featuredImageSrcSet = projects[0]?.imageSrcSet;

  // Site info
  const siteName = siteSettings.siteName || 'Portfolio';
  const tagline = siteSettings.siteDescription || '';

  // Handle Home Reset
  const [resetKey, setResetKey] = useState(0);
  const handleGoHome = () => {
    onBackToHome();
    setResetKey((prev) => prev + 1);
  };

  // Main Render with persistence
  return (
    <div
      style={{ background: colors.bg }}
      className={`min-h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}
    >
      <VonPopupAd show={showPopup} onClose={closePopup} content={siteSettings.ads.popupAd} />

      {(() => {
        // Render based on current view
        if (currentView === 'single-post' && selectedPost) {
          return (
            <>
              {shouldRenderVonSEO && (
                <VonSEO
                  settings={siteSettings}
                  currentView={currentView}
                  selectedPost={selectedPost}
                  selectedPage={selectedPage}
                  selectedProfile={
                    selectedProfile
                      ? allUsers?.find((u) => u.username === selectedProfile) || null
                      : null
                  }
                  selectedCategory={selectedCategory}
                />
              )}
              <PortfolioNav
                colors={colors}
                siteName={siteName}
                isDark={isDarkMode}
                toggleDarkMode={toggleDarkMode}
                user={user}
                onLogin={onLogin}
                onLogout={onLogout}
                onNavigateAdmin={onNavigateAdmin}
                onViewProfile={onViewProfile}
                onBackToHome={handleGoHome}
                pages={pages}
                onPageClick={onPageClick}
                onPostClick={onPostClick}
                settings={siteSettings}
              />
              <div className="flex-1">
                <SingleProject
                  project={selectedPost}
                  colors={colors}
                  settings={siteSettings}
                  onBack={onBackToHome}
                  comments={(comments || []).filter((c) => c.postId === selectedPost.id)}
                  user={user}
                  onAddComment={onAddComment}
                  onLikeComment={onLikeComment}
                  onReplyComment={onReplyComment}
                  onLogin={onLogin}
                  onViewProfile={onViewProfile}
                  posts={posts}
                  onPostClick={onPostClick}
                />

                {/* Bottom Header Ad Slot */}
                {siteSettings.ads?.adsEnabled && siteSettings.ads?.headerAd && (
                  <div className="pb-8">
                    <div className="max-w-7xl mx-auto px-6 ad-slot-flex">
                      <AdBlock content={siteSettings.ads.headerAd} slotId="header" />
                    </div>
                  </div>
                )}
              </div>
              <PortfolioFooter colors={colors} settings={siteSettings} />
            </>
          );
        }

        if (currentView === 'page' && selectedPage) {
          return (
            <>
              {shouldRenderVonSEO && (
                <VonSEO
                  settings={siteSettings}
                  currentView={currentView}
                  selectedPost={selectedPost}
                  selectedPage={selectedPage}
                  selectedProfile={
                    selectedProfile
                      ? allUsers?.find((u) => u.username === selectedProfile) || null
                      : null
                  }
                  selectedCategory={selectedCategory}
                />
              )}
              <PortfolioNav
                colors={colors}
                siteName={siteName}
                isDark={isDarkMode}
                toggleDarkMode={toggleDarkMode}
                user={user}
                onLogin={onLogin}
                onLogout={onLogout}
                onNavigateAdmin={onNavigateAdmin}
                onViewProfile={onViewProfile}
                onBackToHome={handleGoHome}
                pages={pages}
                onPageClick={onPageClick}
                onPostClick={onPostClick}
                settings={siteSettings}
              />
              <div className="flex-1">
                <SinglePage page={selectedPage} colors={colors} onBack={onBackToHome} />
              </div>
              <PortfolioFooter colors={colors} settings={siteSettings} />
            </>
          );
        }

        if (currentView === 'profile' && selectedProfile) {
          if (isLoadingProfile || !targetProfile) {
            return null;
          }

          return (
            <>
              {shouldRenderVonSEO && (
                <VonSEO
                  settings={siteSettings}
                  currentView={currentView}
                  selectedPost={selectedPost}
                  selectedPage={selectedPage}
                  selectedProfile={targetProfile}
                  selectedCategory={selectedCategory}
                />
              )}
              <PortfolioNav
                colors={colors}
                siteName={siteName}
                isDark={isDarkMode}
                toggleDarkMode={toggleDarkMode}
                user={user}
                onLogin={onLogin}
                onLogout={onLogout}
                onNavigateAdmin={onNavigateAdmin}
                onViewProfile={onViewProfile}
                onBackToHome={handleGoHome}
                pages={pages}
                onPageClick={onPageClick}
                onPostClick={onPostClick}
                settings={siteSettings}
              />

              <PortfolioProfile
                key={targetProfile.id}
                profileUser={targetProfile}
                currentUser={user}
                projects={projects}
                comments={comments}
                colors={colors}
                settings={siteSettings}
                onPostClick={onPostClick}
                onBack={handleGoHome}
                onUpdateUser={onUpdateUser}
              />

              <PortfolioFooter colors={colors} settings={siteSettings} />
            </>
          );
        }

        // Home View (Hero + Projects)
        const HeroComponent = {
          fullscreen: HeroFullscreen,
          split: HeroSplit,
          minimal: HeroMinimal,
        }[portfolioSettings.heroStyle];

        return (
          <>
            {shouldRenderVonSEO && (
              <VonSEO
                settings={siteSettings}
                currentView={currentView}
                selectedPost={selectedPost}
                selectedPage={selectedPage}
                selectedProfile={
                  selectedProfile
                    ? allUsers?.find((u) => u.username === selectedProfile) || null
                    : null
                }
                selectedCategory={selectedCategory}
              />
            )}

            <PortfolioNav
              colors={colors}
              siteName={siteName}
              isDark={isDarkMode}
              toggleDarkMode={toggleDarkMode}
              user={user}
              onLogin={onLogin}
              onLogout={onLogout}
              onNavigateAdmin={onNavigateAdmin}
              onViewProfile={onViewProfile}
              onBackToHome={handleGoHome}
              pages={pages}
              onPageClick={onPageClick}
              onPostClick={onPostClick}
              settings={siteSettings}
            />

            <div className="flex-1">
              <HeroComponent
                settings={portfolioSettings}
                name={siteName}
                tagline={tagline}
                colors={colors}
                isDark={isDarkMode}
                featuredImage={featuredImage}
                featuredImageSrcSet={featuredImageSrcSet}
              />

              <ProjectsSection
                key={resetKey}
                projects={projects}
                settings={portfolioSettings}
                colors={colors}
                onProjectClick={onPostClick}
                selectedCategory={selectedCategory}
                onCategoryClick={onCategoryClick}
              />

              {/* Footer Ad Slot */}
              {siteSettings.ads?.adsEnabled && siteSettings.ads?.headerAd && (
                <div className="pb-8 pt-20">
                  <div className="max-w-7xl mx-auto px-6 ad-slot-flex">
                    <AdBlock content={siteSettings.ads.headerAd} slotId="header" />
                  </div>
                </div>
              )}
            </div>

            <PortfolioFooter colors={colors} settings={siteSettings} />
          </>
        );
      })()}

      {/* Custom CSS animations */}
      <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(2rem); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
    </div>
  );
};

export default PortfolioLayout;
