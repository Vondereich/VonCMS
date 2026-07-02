/**
 * VonCMS Site Configuration
 *
 * IMPORTANT: Change BASE_PATH before deployment!
 *
 * Examples:
 * - Root domain (example.com): BASE_PATH = '/'
 * - Subdirectory (example.com/blog): BASE_PATH = '/blog/'
 * - Local XAMPP (localhost/voncms): BASE_PATH = '/voncms/'
 */

// Change this to match your deployment path
// For clean install: '/'
// For subdirectory: '/yourfolder/'
// AUTO-DETECTED BASE PATH (Injected by index.php or fallback to relative)
export const BASE_PATH =
  typeof window !== 'undefined' && window.VON_BASE ? window.VON_BASE : import.meta.env['BASE_URL'];

// API endpoint helper - automatically handles path
export const API = {
  // Core endpoints
  settings: `${BASE_PATH}api/get_settings.php`, // NEW: Database API
  saveSettings: `${BASE_PATH}api/save_settings.php`,
  resetPassword: `${BASE_PATH}api/reset_password.php`, // NEW: Password Reset API

  // Auth endpoints
  login: `${BASE_PATH}api/login.php`,
  logout: `${BASE_PATH}api/logout.php`,
  register: `${BASE_PATH}api/register.php`,
  checkAuth: `${BASE_PATH}api/check_auth.php`,

  // Content endpoints
  getPosts: `${BASE_PATH}api/get_posts.php`,
  getPost: `${BASE_PATH}api/get_post.php`, // Single post with full content
  getPages: `${BASE_PATH}api/get_pages.php`,
  savePost: `${BASE_PATH}api/save_post.php`,
  savePage: `${BASE_PATH}api/save_page.php`,
  deletePost: `${BASE_PATH}api/delete_post.php`,
  deletePage: `${BASE_PATH}api/delete_page.php`,
  contentAuditLogs: `${BASE_PATH}api/get_content_audit_logs.php`,
  manageCategories: `${BASE_PATH}api/manage_categories.php`,

  // Comments endpoints
  getComments: `${BASE_PATH}api/get_comments.php`,
  saveComments: `${BASE_PATH}api/save_comments.php`,

  // User endpoints
  getUsers: `${BASE_PATH}api/get_users.php`,
  getUserStats: `${BASE_PATH}api/get_user_stats.php`,
  saveUser: `${BASE_PATH}api/save_user.php`,
  deleteUser: `${BASE_PATH}api/delete_user.php`,
  updateProfile: `${BASE_PATH}api/update_profile.php`,
  getPublicProfile: `${BASE_PATH}api/get_public_profile.php`,

  // Media endpoints
  listMedia: `${BASE_PATH}api/list_media.php`,
  uploadFile: `${BASE_PATH}api/upload_file.php`,
  deleteMedia: `${BASE_PATH}api/delete_media.php`,
  syncMedia: `${BASE_PATH}api/sync_media.php`,
  cleanupMediaVariantRows: `${BASE_PATH}api/cleanup_media_variant_rows.php`,
  mediaTools: `${BASE_PATH}api/media_tools.php`,
  updateMedia: `${BASE_PATH}api/update_media.php`,

  // Database endpoints
  dbQuery: `${BASE_PATH}api/db_query.php`,
  importDb: `${BASE_PATH}api/import_db.php`,
  backupDb: `${BASE_PATH}api/backup_db.php`,
  repairDb: `${BASE_PATH}api/repair_db.php`,
  checkDbStatus: `${BASE_PATH}api/system/check_db_status.php`, // Harmonized to System Check
  fixIntegrity: `${BASE_PATH}api/system/fix_integrity.php`, // Read-only integrity check
  repairHtaccess: `${BASE_PATH}api/system/repair_htaccess.php`,
  clearPublicCache: `${BASE_PATH}api/system/clear_public_cache.php`,
  install: `${BASE_PATH}api/install.php`,
  submitContact: `${BASE_PATH}api/submit_contact.php`,

  // Security Endpoints
  securityLogs: `${BASE_PATH}api/security/get_security_logs.php`,
  createSecurityTable: `${BASE_PATH}api/security/create_security_table.php`,
  clearSecurityLogs: `${BASE_PATH}api/security/clear_all_logs.php`,

  // AI & Other
  aiGenerate: `${BASE_PATH}api/ai_generate.php`,
  aiCheck: `${BASE_PATH}api/ai_check.php`,
  getStorage: `${BASE_PATH}api/get_storage.php`,
  trackVisit: `${BASE_PATH}api/track_visit.php`,
  trackMonolithic: `${BASE_PATH}api/track_monolithic.php`,
  // Contact Forms
  contactForms: `${BASE_PATH}api/contact/get_forms.php`,
  getContactForm: `${BASE_PATH}api/contact/get_form.php`,
  saveContactForm: `${BASE_PATH}api/contact/save_form.php`,
  deleteContactForm: `${BASE_PATH}api/contact/delete_form.php`,
  contactSubmissions: `${BASE_PATH}api/contact/get_submissions.php`,
  migrateContactForms: `${BASE_PATH}api/contact/migrate_from_settings.php`,

  // WP Bridge Tools
  wpScan: `${BASE_PATH}api/tools/wp_scan.php`,
  wpImport: `${BASE_PATH}api/tools/wp_import.php`,

  // Redirects SEO Velocity
  listRedirects: `${BASE_PATH}api/list_redirects.php`,
  scanRedirectLoops: `${BASE_PATH}api/scan_redirect_loops.php`,
  saveRedirect: `${BASE_PATH}api/save_redirect.php`,
  deleteRedirect: `${BASE_PATH}api/delete_redirect.php`,

  // Legacy PHP API
  api: `${BASE_PATH}api.php`,
};

// Home URL for redirects
export const HOME_URL = BASE_PATH;
