# VonCMS API Guide

Version: `1.25.13`
Primary API location: `/api/*.php`
System endpoints: `/api/system/*.php`

This guide is a practical map of the current API surface. It focuses on the endpoint structure that exists in the project today instead of trying to document every response field in exhaustive detail.

## How the API is organized

VonCMS mainly uses file-based PHP endpoints.

Examples:

- `/api/login.php`
- `/api/get_posts.php`
- `/api/save_settings.php`
- `/api/system/fix_integrity.php`

Most read endpoints use `GET`. Most write endpoints use `POST`.

## Authentication and request rules

Admin write operations usually require:

- an authenticated session
- a valid CSRF token
- JSON or `multipart/form-data`, depending on the endpoint

Frontend code in the app should use the project fetch helpers instead of building raw requests everywhere. The current repo standard is `vonFetch`, which injects credentials and adds the CSRF header automatically for mutating requests.

### Example authenticated request

```ts
import { getAuthHeader } from '../config/auth.config';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

await vonFetch(API.savePost, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
  },
  body: JSON.stringify(payload),
});
```

## Endpoint groups

### Authentication

- `login.php`
- `logout.php`
- `check_auth.php`
- `register.php`
- `reset_password.php`
- `verify_email.php`

When remember-me is enabled, `login.php` issues a dedicated selector/validator cookie, `check_auth.php` restores and rotates that token, and `logout.php` revokes it. Persistent authentication does not store the raw PHP session ID in the remember cookie.

### Posts and pages

- `get_posts.php`
- `get_post.php`
- `save_post.php`
- `delete_post.php`
- `get_pages.php`
- `save_page.php`
- `delete_page.php`

### Comments and discussion

- `get_comments.php`
- `save_comments.php`

### Media

- `list_media.php`
- `upload_file.php`
- `update_media.php`
- `delete_media.php`
- `sync_media.php`
- `media_tools.php`
- `ImageProcessor.php` (internal processing utility used by media flows)

### Users and profiles

- `get_users.php`
- `save_user.php`
- `delete_user.php`
- `update_profile.php`
- `get_public_profile.php`

### Settings and system data

- `get_settings.php`
- `save_settings.php`
- `get_settings_audit.php`
- `rollback_setting.php`
- `get_storage.php`
- `repair_db.php` - admin-only VonCMS schema repair for the configured database
- `backup_db.php` - admin-only SQL export of the configured database tables
- `import_db.php` - admin-only SQL restore into the configured database; intended for VonCMS backup files
- `db_query.php` - admin-only read-only database inspection helper
- `cron_publish.php`

### Redirects

- `list_redirects.php`
- `save_redirect.php`
- `delete_redirect.php`

### Newsletter

- `newsletter_subscribe.php` - POST-only public subscription capture with CSRF, bounded email input, dedicated per-IP throttling, and membership-neutral responses
- `newsletter_list.php` - admin-only paginated subscriber listing and deletion with bounded search
- `newsletter_export.php` - admin-only CSRF-protected CSV export with spreadsheet-formula neutralization

### Tracking and contact

- `track_visit.php`
- `track_monolithic.php`
- `submit_contact.php` - POST-only public form delivery with CSRF, bounded template-declared fields, server-side type validation, honeypot/rate controls, generic public mail failures, and 90-day lead retention

### AI helpers

- `ai_check.php`
- `ai_generate.php`

### System endpoints

- `system/check_db_status.php`
- `system/fix_integrity.php`
- `system/indexnow_setup.php`
- `system/indexnow_status.php`
- `system/indexnow_ping.php`
- `system/updater.php`
- `system/IndexNow.php`

## Common response pattern

Most endpoints return JSON with a success flag and a message or payload.

Typical shapes:

```json
{
  "success": true,
  "message": "Saved successfully"
}
```

```json
{
  "success": false,
  "message": "Forbidden"
}
```

Some older endpoints may return slightly different keys or object shapes, so treat the API as a practical system rather than a perfect textbook REST layer.

## Error handling

In general, expect these cases:

- `400` for bad or missing input
- `401` for unauthenticated requests
- `403` for permission or CSRF failures
- `404` for missing resources
- `429` for rate-limited actions
- `500` for server-side failures

## CORS and origin behavior

Do not assume the API is an open public cross-origin API.

VonCMS is primarily designed for same-site use. Origin handling is intentionally conservative and depends on the request context. If you are building a custom external integration, test the exact endpoint and host setup instead of assuming wildcard CORS access.

## Notes for developers

- Keep write requests behind session and CSRF checks.
- Follow the project backend pattern for headers and path resolution.
- On the frontend, prefer the existing fetch wrappers instead of ad-hoc request code.
- If you add a new endpoint, document the request method, auth requirement, and payload shape.

## Related docs

- [INSTALL.md](INSTALL.md)
- [SECURITY.md](SECURITY.md)
- [UPGRADE.md](UPGRADE.md)
- [../README.md](../README.md)
