export type UserRole = 'Admin' | 'Root' | 'Moderator' | 'Writer' | 'Member';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  display_name?: string;
  displayName?: string;
  email_verified?: boolean | number;
  has_pending_verification?: boolean | number;
  approve_email?: boolean;
  avatar?: string;
  bio?: string;
  password?: string;
  createdAt?: string;
}

export interface Comment {
  id: string;
  dbId?: number | string;
  postId: string;
  userId?: string | null;
  parentId?: number | string | null;
  username: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  likes: number; // Added likes count
  replies?: Comment[]; // Added nested replies
  status?: 'approved' | 'pending' | 'spam';
  emailHash?: string;
  hasEmail?: boolean;
}

export interface Post {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  image?: string;
  imageSrcSet?: string;
  status: 'published' | 'draft' | 'scheduled';
  category: string;
  updatedAt: string;
  updated_at?: string; // Hybrid Contract
  author: string;
  author_data?: {
    username: string;
    display_name?: string;
    avatar?: string;
  }; // Hybrid Contract
  author_id?: string | number | null;
  readTime?: string;
  // New SEO Fields
  metaDescription?: string;
  keywords?: string;
  nid?: number;
  slug?: string;
  scheduledAt?: string;
  scheduled_at?: string; // Hybrid Contract
  createdAt?: string;
  created_at?: string; // Hybrid Contract
}

export interface Page {
  id: string;
  title: string;
  content: string;
  status: 'published' | 'draft';
  updatedAt: string;
  updated_at?: string; // Hybrid Contract
  slug: string;
  excerpt?: string;
  category?: string;
  author?: string;
  author_data?: {
    username: string;
    display_name?: string;
    avatar?: string;
    email?: string;
  }; // Hybrid Contract
  author_id?: string | number | null;
  // SEO
  metaDescription?: string;
  keywords?: string;
  createdAt?: string;
  created_at?: string; // Hybrid Contract
}

export interface ContentAuditLog {
  id: string;
  contentType: 'post' | 'page';
  contentId: string;
  action: string;
  actorUserId?: string | null;
  actorUsername: string;
  actorRole: string;
  summary: string;
  context?: Record<string, any> | null;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'folder'; // Added folder type
  url: string;
  webpUrl?: string; // Added for Breeze series
  size: string;
  uploadedAt: string;
  path?: string; // Relative path for delete operations
  altText?: string;
  caption?: string;
  description?: string;
  extension?: string;
}

export interface AdConfig {
  headerAd: string;
  inFeedAd: string;
  inFeedFrequency?: number; // Frequency of ad injection (e.g. 6, 8, 10)
  popupAd: string;
  popupEnabled: boolean;
  adsEnabled?: boolean;
  adsenseVerification?: string;
}

export interface MediaConfig {
  optimization: {
    enabled: boolean;
    compressionLevel: 'low' | 'medium' | 'high';
    convertToWebP: boolean;
    maxWidth: number;
    maxHeight: number;
  };
  defaultView?: 'grid' | 'list';
  storage: {
    location: 'local'; // Only local storage supported; use cdnUrl for CDN delivery
    folderStructure: 'year_month' | 'flat';
    cdnUrl?: string; // Optional CDN URL for serving media
  };
  performance: {
    lazyLoadImages: boolean;
    lazyLoadIframes: boolean;
  };
}

export interface ThemeConfig {
  name?: string;
  primaryColor: string; // Hex code
  fontFamily: string;
  borderRadius: string;
  customCss?: string;
  // Extended Configs
  prism?: {
    neonEffects: boolean;
    colorScheme: 'cyan' | 'purple' | 'green';
    fontSize: 'sm' | 'md' | 'lg';
  };

  default?: {
    footerLinks?: { label: string; url: string }[];
    footerCopyright?: string;
    navColor?: string; // Header & Footer background color
    showTrending?: boolean;
    enableMarquee?: boolean;
  };

  techpress?: {
    enableBreaking?: boolean;
    enableMarquee?: boolean;
    enableDarkMode?: boolean;
    primaryColor?: string; // Override global primary
    breakingNewsCount?: number;
    footerLinks?: { label: string; url: string }[];
  };

  portfolio?: {
    heroStyle?: 'fullscreen' | 'split' | 'minimal';
    heroWelcomeText?: string;
    heroButtonText?: string;
    projectsTitle?: string;
    projectsSubtitle?: string;
    projectColumns?: 2 | 3 | 4;
    animationStyle?: 'fade' | 'slide' | 'none';
    accentColor?: string;
  };

  digest?: {
    accentColor?: string;
    showCategoryPills?: boolean;
    showHero?: boolean;
    gridColumns?: 2 | 3 | 4;
    heroStyle?: 'split' | 'overlay' | 'minimal';
    showSidebar?: boolean;
    showTrending?: boolean;
    enableMarquee?: boolean;
  };

  sonido?: {
    containerWidth?: 'narrow' | 'medium' | 'wide' | 'fluid';
    textAlign?: 'left' | 'center' | 'justify';
    backgroundColor?: string;
    containerColor?: string;
    fontHeading?: 'serif' | 'sans';
    fontBody?: 'serif' | 'sans';
    showSidebar?: boolean;
  };

  corporatePro?: {
    heroImage?: string;
    aboutImage?: string;
    heroTitle?: string;
    heroText?: string;
    showServices?: boolean;
    showPosts?: boolean;
    servicesTitle?: string;
    servicesSubtitle?: string;
    service1Title?: string;
    service1Desc?: string;
    service1Icon?: string;
    service1Link?: string;
    service2Title?: string;
    service2Desc?: string;
    service2Icon?: string;
    service2Link?: string;
    service3Title?: string;
    service3Desc?: string;
    service3Icon?: string;
    service3Link?: string;
    aboutTitle?: string;
    aboutSubtitle?: string;
    aboutStat1Number?: string;
    aboutStat1Label?: string;
    aboutStat2Number?: string;
    aboutStat2Label?: string;
    ctaTitle?: string;
    ctaSubtitle?: string;
    ctaButtonText?: string;
    ctaButtonLink?: string;
    heroPrimaryLink?: string;
    heroSecondaryLink?: string;
    newsLink?: string;
    footerAbout?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactAddress?: string;
  };
}

export type WidgetType = 'trending' | 'custom' | 'newsletter';

export interface SidebarWidget {
  id: string;
  type: WidgetType;
  title: string;
  content?: string; // For custom widgets HTML/Text
  isVisible: boolean;
  itemCount?: number; // Limit items for trending/recent
}

export interface NavItem {
  id: string;
  label: string;
  url: string; // Internal path ID or External URL
  type: 'internal' | 'external';
}

// --- CONTACT MANAGER TYPES ---
export interface ContactMailConfig {
  to: string;
  from: string;
  subject: string;
  body: string; // The email body template
}

// --- NEWSLETTER TYPES ---
export interface NewsletterSettings {
  enabled: boolean;
  title: string;
  description: string;
  buttonText: string;
  successMessage: string;
  position: 'footer' | 'sidebar' | 'both';
}

export interface AnalyticsConfig {
  googleAnalyticsId?: string;
  enableTracking?: boolean;
  trackPageViews?: boolean;
  trackEvents?: boolean;
  anonymizeIP?: boolean;
  cookieConsent?: boolean;
}

export interface NewsletterSubscriber {
  id: number;
  email: string;
  status: 'active' | 'unsubscribed';
  subscribed_at: string;
  unsubscribed_at?: string;
  source: string;
}

export interface ContactMessages {
  success: string;
  error: string;
  validationError: string;
}

export interface ContactForm {
  id: string; // Generated UUID
  title: string;
  template: string; // The form HTML with tags like [text* name]
  mail: ContactMailConfig;
  messages: ContactMessages;
  createdAt: string;
}

export interface ApiConfig {
  recaptchaSiteKey?: string;
  recaptchaSecretKey?: string;
  recaptchaEnabled?: boolean;
  spamProtectionKey?: string;
  mapsApiKey: string;
  // AI Settings
  aiProvider?: 'gemini';
  aiApiKey?: string;
  aiModel?: string; // e.g. 'gpt-4o' or 'gemini-pro'
  expireAiKeyAfter30Days?: boolean;
  aiKeySavedAt?: string;
  aiKeyExpiresAt?: string;
}

// --- PLUGIN SYSTEM TYPES ---
export type PluginLocation = 'header_top' | 'footer_bottom' | 'sidebar_top' | 'post_after';

// Hardcoded System Plugins (React Components)
export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  render: (location: PluginLocation, props?: any) => React.ReactNode;
}

// Dynamic User Imported Plugins (HTML/CSS Based)
export interface CustomPluginDefinition {
  id: string;
  name: string;
  location: PluginLocation;
  htmlContent: string; // The HTML to inject
  cssContent?: string; // Optional CSS specific to this plugin
  enabled: boolean;
}

export interface SeoConfig {
  siteTitle?: string;
  defaultMetaDescription?: string;
  /** @deprecated Meta keywords are ignored by modern search engines. */
  defaultKeywords?: string;
  /** @deprecated Canonical URLs use SiteSettings.domainUrl. */
  canonicalHost?: string;
  sitemapEnabled?: boolean;
  robotsTxt?: string;
  googleSearchConsole?: string; // Verification Code
}

export interface SiteSettings {
  siteName: string;
  siteUrl?: string; // Base URL (supports subfolders)
  site_language?: string; // ISO language code
  siteDescription: string;
  siteTagline?: string;
  postsPerPage: number;
  maintenanceMode: boolean;
  emailSmtp: string;
  ads: AdConfig;
  theme: ThemeConfig;
  activeThemeId?: string;
  api: ApiConfig;
  media: MediaConfig;
  seo?: SeoConfig;
  sidebarLayout: SidebarWidget[];
  navigation: NavItem[]; // New Navigation Settings
  categories: string[]; // New Dynamic Categories
  activePlugins: string[]; // List of enabled SYSTEM plugin IDs
  customPlugins: CustomPluginDefinition[]; // List of USER IMPORTED plugins
  pluginConfig?: Record<string, any>;
  shareScript?: string;
  sharePlacement?: 'top' | 'bottom' | 'none';
  // Revamp Additions
  domainUrl?: string;
  timeZone?: string;
  permalinkStructure?:
    'plain' | 'slug' | 'date' | 'day_name' | 'month_name' | 'post_name' | 'category';
  adminProfile?: {
    name: string;
    email: string;
    bio?: string;
    avatar?: string;
  };
  discussionEnabled?: boolean;
  logoUrl?: string;
  useLogoAsTitle?: boolean; // New: Replace text with logo
  invertLogoInDarkMode?: boolean;
  faviconUrl?: string;
  ogImageUrl?: string; // Social Share Image (Large)
  ogImageSquareUrl?: string; // Social Share Image (Square/WhatsApp)
  analytics?: AnalyticsConfig;
  socialLinks?: Record<string, string>; // Social Media Links (Platform -> URL)
  // Editable Footer Settings
  footerLinks?: { label: string; url: string }[];
  footerCopyright?: string;
  footer?: {
    text_title?: string;
    text_content?: string;
    copyright_text?: string;
  };
  // Contact Manager
  contactForms?: ContactForm[];
  // Newsletter
  newsletter?: NewsletterSettings;
  registrationEnabled?: boolean;
  spamKeywords?: string; // Added for Breeze
  // IndexNow (Instant Indexing)
  indexnowEnabled?: boolean;
  indexnowKey?: string;
  _serverInfo?: {
    phpVersion: string;
    uploadMaxFilesize: string;
    postMaxSize: string;
    memoryLimit: string;
    integrityNeeded?: boolean;
  };
  _canManageSecrets?: boolean;
}

export interface SqlResult {
  success: boolean;
  message?: string;
  data?: any[];
  headers?: string[];
}
