import type { ArticleSchemaType } from './utils/articleSchema';

export type UserRole = 'Admin' | 'Root' | 'Moderator' | 'Writer' | 'Member';

export type PostStatus = 'published' | 'draft' | 'scheduled' | 'archived' | 'pending_review';

export type PostWorkflowAction =
  | 'save_draft'
  | 'save_review'
  | 'submit_review'
  | 'withdraw_review'
  | 'return_draft'
  | 'publish'
  | 'schedule'
  | 'archive';

export interface PostSaveOptions {
  workflowAction?: PostWorkflowAction;
  expectedStatus?: PostStatus;
}

export type HeaderIdentityMode = 'logo_and_text' | 'logo_only' | 'text_only';

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
  // Compact parent context is returned only to authorized flat moderation lists.
  post?:
    (Pick<Post, 'id' | 'title' | 'slug' | 'category' | 'createdAt'> & { isPublic: boolean }) | null;
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
  hasProfile?: boolean;
}

export interface Post {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  image?: string;
  imageSrcSet?: string;
  status: PostStatus;
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
  views?: number;
  // New SEO Fields
  metaDescription?: string;
  keywords?: string;
  nid?: number;
  slug?: string;
  scheduledAt?: string;
  scheduled_at?: string; // Hybrid Contract
  publishedAt?: string;
  published_at?: string; // First actual publication
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
  meta_description?: string; // Retained PHP/seed compatibility alias.
  keywords?: string;
  createdAt?: string;
  created_at?: string; // Hybrid Contract
  publishedAt?: string;
  published_at?: string; // First actual publication
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
  context?: Record<string, unknown> | null;
  createdAt: string;
}

// Wire aliases retained by the first-party PHP post/page APIs.
export interface PostApiRecord extends Post {
  image_url?: string;
  image_srcset?: string;
  meta_description?: string;
}
export interface PageApiRecord extends Page {
  meta_description?: string;
}
export type ContentSaveResult = Omit<Partial<Post>, 'id'> & {
  id?: string | number;
  public_categories_changed?: boolean;
};
export interface ContentEditorResponse {
  success: boolean;
  error?: string;
  message?: string;
  text?: string;
  model?: string;
  logs?: ContentAuditLog[];
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

export interface ThemeAppearance {
  primaryColor?: string;
  fontFamily?: string;
  borderRadius?: string;
}

export interface ThemeConfig {
  name?: string;
  primaryColor: string; // Hex code
  fontFamily: string;
  borderRadius: string;
  customCss?: string;
  // Extended Configs
  prism?: ThemeAppearance & {
    neonEffects: boolean;
    colorScheme: 'cyan' | 'purple' | 'green';
    fontSize: 'sm' | 'md' | 'lg';
  };

  default?: ThemeAppearance & {
    footerLinks?: { label: string; url: string }[];
    footerCopyright?: string;
    navColor?: string; // Header & Footer background color
    showTrending?: boolean;
    enableMarquee?: boolean;
  };

  techpress?: ThemeAppearance & {
    enableBreaking?: boolean;
    enableMarquee?: boolean;
    enableDarkMode?: boolean;
    breakingNewsCount?: number;
    footerLinks?: { label: string; url: string }[];
  };

  portfolio?: ThemeAppearance & {
    heroStyle?: 'fullscreen' | 'split' | 'minimal';
    heroWelcomeText?: string;
    heroButtonText?: string;
    projectsTitle?: string;
    projectsSubtitle?: string;
    projectColumns?: 2 | 3 | 4;
    animationStyle?: 'fade' | 'slide' | 'none';
    accentColor?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
    dribbbleUrl?: string;
    instagramUrl?: string;
    websiteUrl?: string;
  };

  digest?: ThemeAppearance & {
    accentColor?: string;
    showHero?: boolean;
    gridColumns?: 2 | 3 | 4;
    heroStyle?: 'split' | 'overlay' | 'minimal';
    showSidebar?: boolean;
    showTrending?: boolean;
    enableMarquee?: boolean;
  };

  corporatePro?: ThemeAppearance & {
    sectionOrder?: ('hero' | 'services' | 'about' | 'posts' | 'cta')[];
    showHero?: boolean;
    showAbout?: boolean;
    showCta?: boolean;
    heroEyebrow?: string;
    heroPrimaryText?: string;
    heroSecondaryText?: string;
    postsTitle?: string;
    postsSubtitle?: string;
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

export type WidgetType = 'trending' | 'categories' | 'profile' | 'custom';

export interface SidebarWidget {
  id: string;
  type: WidgetType | 'search'; // Legacy persisted search widgets remain read-compatible, not selectable.
  title: string;
  content?: string; // For custom widgets HTML/Text
  isVisible: boolean;
  itemCount?: number; // Bounded visible-item limit for list widgets
}

export interface NavItem {
  id: string;
  label: string;
  url: string; // Internal path ID or External URL
  type: 'internal' | 'external';
  resolvedHref?: string; // Runtime-only public projection for synthetic targets such as page:id
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

export type AnalyticsReportMode = 'strict' | 'balanced';
export type AnalyticsCollectionMode = AnalyticsReportMode | 'hybrid';

export interface AnalyticsConfig {
  measurementMode?: AnalyticsCollectionMode;
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
  aiKeyStorage?: 'empty' | 'legacy' | 'encrypted' | 'unavailable';
  aiKeyRevision?: string; // Opaque ciphertext revision for stale-action protection.
  aiKeyCanRotate?: boolean;
  aiKeyRotatedAt?: string;
  encryptStoredAiKey?: boolean; // Save intent only; not persisted by PHP.
  replaceAiKey?: boolean; // Distinguish explicit field edits from legacy client echoes.
}

export interface AiAssistantConfig {
  sharedAvailable: boolean;
  model: string;
}

// --- PLUGIN SYSTEM TYPES ---
export type PluginLocation = 'header_top' | 'footer_bottom' | 'sidebar_top' | 'post_after';

// Hardcoded System Plugins (React Components)
export interface PluginDefinition<Config extends object = object> {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  render(location: PluginLocation, props?: Config): React.ReactNode;
}

export interface GiftWidgetConfig {
  targetUrl?: string;
  tooltipText?: string;
  buttonColor?: string;
  position?: string;
  iconLabel?: string;
  targetBlank?: boolean | string;
}
export interface PromoBarConfig {
  text?: string;
  linkUrl?: string;
  linkText?: string;
  backgroundColor?: string;
  allowDismiss?: boolean;
  dismissHours?: number | string;
  startsAt?: string;
  endsAt?: string;
  targetBlank?: boolean | string;
}
export interface PluginConfigurations {
  [pluginId: string]: object | undefined;
  pluginStatus?: Record<string, 'active' | 'inactive' | 'not_installed'>;
  vp_ai_summary?: import('./plugins/von-core/features/plugins/built-in/ai-summary/types').AISummaryConfig;
  vp_related_posts?: import('./plugins/von-core/features/plugins/built-in/related-posts/types').RelatedPostsConfig;
  vp_gift_widget?: GiftWidgetConfig;
  vp_promo_bar?: PromoBarConfig;
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

export interface NewsSitemapConfig {
  enabled: boolean;
  publicationName: string;
  language: string;
  scope: 'all' | 'categories';
  categories: string[];
}

export interface SeoConfig {
  siteTitle?: string;
  defaultMetaDescription?: string;
  /** @deprecated Meta keywords are ignored by modern search engines. */
  defaultKeywords?: string;
  /** @deprecated Canonical URLs use SiteSettings.domainUrl. */
  canonicalHost?: string;
  sitemapEnabled?: boolean;
  newsSitemap?: NewsSitemapConfig;
  robotsTxt?: string;
  articleSchemaType?: ArticleSchemaType;
  googleSearchConsole?: string; // Verification Code
}

export type SiteDateFormat =
  | 'month_day_year_long'
  | 'month_day_year_short'
  | 'day_month_year_long'
  | 'day_month_year_short'
  | 'day_month_year_numeric'
  | 'month_day_year_numeric'
  | 'iso';

export type AdminPaletteId = 'charcoal-blue' | 'meadow-gold' | 'harbour-amber';

export interface SiteSettings {
  /** Runtime-only read scope; never an authorization grant or a persisted setting. */
  _settingsScope?: 'public' | 'admin';
  siteName: string;
  siteUrl?: string; // Base URL (supports subfolders)
  site_language?: string; // ISO language code
  siteDescription: string;
  siteTagline?: string;
  postsPerPage: number;
  maintenanceMode: boolean;
  emailSmtp: string;
  emailFrom?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpEncryption?: string;
  smtpFromName?: string;
  ads: AdConfig;
  theme: ThemeConfig;
  activeThemeId?: string;
  api: ApiConfig;
  aiAssistant?: AiAssistantConfig;
  media: MediaConfig;
  seo?: SeoConfig;
  sidebarLayout: SidebarWidget[];
  navigation: NavItem[]; // New Navigation Settings
  categories: string[]; // New Dynamic Categories
  publicCategories?: string[]; // Runtime-only categories backed by currently public posts
  activePlugins: string[]; // List of enabled SYSTEM plugin IDs
  customPlugins: CustomPluginDefinition[]; // List of USER IMPORTED plugins
  pluginConfig?: PluginConfigurations;
  shareScript?: string;
  sharePlacement?: 'top' | 'bottom' | 'none';
  // Revamp Additions
  domainUrl?: string;
  timeZone?: string;
  dateFormat?: SiteDateFormat;
  adminPalette?: AdminPaletteId;
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
  headerIdentityMode?: HeaderIdentityMode;
  useLogoAsTitle?: boolean; // Legacy compatibility for sites saved before v1.26.6
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
    rateLimitStorageHealthy?: boolean;
    rateLimitStorageMessage?: string;
  };
  _canManageSecrets?: boolean;
}

export type SettingsFieldChange<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export interface SqlResult {
  success: boolean;
  message?: string;
  data?: (string | number | boolean | null)[][];
  headers?: string[];
}
