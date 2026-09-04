# VonCMS API Guide

Version: `1.27.0`
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
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

await vonFetch(API.savePost, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
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

PHP entry points accept their documented file path plus query parameters only. Appending path segments after a PHP script, such as `/api/verify_email.php/anything` or `/rss.php/anything`, returns `404`; valid verification links continue to use `/api/verify_email.php?token=...`. Internal helper PHP files are not endpoints and return `403` when requested directly.

### Posts and pages

- `get_posts.php`
- `get_post.php`
- `save_post.php`
- `delete_post.php`
- `get_pages.php`
- `save_page.php`
- `delete_page.php`

`get_post.php` does not increment view counters when fetching content. Public content views use the existing `track_monolithic.php` POST for both SPA navigation and hydrated direct loads. Aggregate post/page counters remain available when visitor analytics is disabled or consent is declined; those requests omit analytics URL and referrer fields. Staff reads retain the existing due-scheduler behavior.

`save_post.php` accepts the normal post payload plus an explicit `workflowAction`. Supported actions are `save_draft`, `save_review`, `submit_review`, `withdraw_review`, `return_draft`, `publish`, `schedule`, and `archive`. Existing-post transitions also send `expectedStatus`; if another reviewer has already changed the stored state, the endpoint returns `409` and requires a reload instead of overwriting the newer decision.

`get_posts.php?status=pending_review&scope=all` is reviewer-only. `countOnly=true` returns the pending total used by the admin navigation badge without transferring post bodies. Writers can read only their own protected posts, and `delete_post.php` permits a Writer to delete only an owned Draft. The server capability helper is the authority for every mutation; hiding a frontend button is not treated as permission.

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
- `repair_db.php` - primary-admin-only, POST-only VonCMS schema repair; serialized with a bounded database advisory lock, releases the PHP session before DDL, verifies each shared capability after repair, and returns visible compatibility warnings
- `backup_db.php` - admin-only SQL export of the configured database tables
- `import_db.php` - admin-only SQL restore into the configured database; intended for VonCMS backup files
- `db_query.php` - admin-only read-only database inspection helper
- `cron_publish.php` - optional authenticated scheduled-publishing trigger for quiet sites

`system/check_db_status.php` is a primary-admin, read-only capability check. It can recommend Database Repair but never changes tables. Shared registration, password-recovery, remember-token, analytics, comment-like, content-audit, and security-log structures are created during fresh installation or repaired explicitly through `repair_db.php`; normal endpoint traffic does not own permanent DDL.

Database repair is resumable rather than transactionally rolled back. MySQL can commit DDL one statement at a time, so a stopped repair reports a controlled failure and the next run re-checks completed structures before continuing. Runtime and core tables are also checked for InnoDB and `utf8mb4`; only empty storage-drifted tables are converted automatically. Populated storage or type drift, duplicate values that block a unique index, and orphaned references stop for operator review instead of deleting or coercing live data.

#### Scheduled publishing endpoint

`GET /api/cron_publish.php` publishes posts whose scheduled time has arrived. Normal site traffic already runs the shared scheduler at most once per minute, so this endpoint is only needed when an idle site requires more predictable timing.

For unattended calls, define `CRON_KEY` in the installed `von_config.php` and send the same value in the `X-Cron-Key` request header. A configured but incorrect key returns `401`. If no key is configured, the endpoint requires a current admin session and returns `403` to anonymous calls.

```bash
/usr/bin/curl --fail --silent --show-error --max-time 30 -H 'X-Cron-Key: your-random-secret' 'https://example.com/api/cron_publish.php'
```

Successful responses include the number of posts published by that request:

```json
{
  "success": true,
  "message": "Publish job completed",
  "published_count": 1,
  "timestamp": "2026-08-09 21:30:00"
}
```

The endpoint accepts the key only through `X-Cron-Key`; `?key=...` is rejected so the secret cannot be copied into normal URL access logs. See [Installation Guide](INSTALL.md#optional-cpanel-cron-for-quiet-sites) for cPanel setup.

### Redirects

- `list_redirects.php`
- `save_redirect.php`
- `delete_redirect.php`

### Newsletter

- `newsletter_subscribe.php` - POST-only public subscription capture with CSRF, bounded email input, dedicated per-IP throttling, and membership-neutral responses
- `newsletter_list.php` - admin-only paginated subscriber listing and deletion with bounded search
- `newsletter_export.php` - admin-only CSRF-protected CSV export with spreadsheet-formula neutralization

### Tracking and contact

- `track_visit.php` - staff-only GET statistics; legacy POST visitor recording uses the same server-owned consent policy as `track_monolithic.php`
- `track_monolithic.php` - POST-only combined view and analytics endpoint; aggregate post/page views remain available while the server-owned plugin setting, consent requirement, and exact consent cookie independently gate URL, referrer, user-agent, and monthly IP-hash storage
- `submit_contact.php` - POST-only public form delivery with CSRF, bounded template-declared fields, server-side type validation, honeypot/rate controls, generic public mail failures, and 90-day lead retention

### AI endpoints

- `ai_check.php`
- `ai_generate.php`

### System endpoints

- `system/check_db_status.php`
- `system/fix_integrity.php`
- `system/indexnow_setup.php`
- `system/indexnow_status.php`
- `system/indexnow_ping.php`
- `system/updater.php`

`system/IndexNow.php` is an internal PHP utility used by the IndexNow endpoints, not a callable HTTP endpoint. Direct browser requests are denied; server-side includes remain available to the owning endpoints.

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

### Adding an internal PHP helper

A helper is included by server-side PHP; it is not a new browser-facing endpoint. A `_helper.php` filename alone does not add it to the explicit deny lists. When adding one:

1. Keep direct execution separate from inclusion. Add a direct-request guard before side effects, following `public/public_render_helper.php`, while allowing legitimate `require_once` calls.
2. For helpers protected by the API deny lists, update the root `.htaccess`, `public/.htaccess`, and the templates in `public/api/install.php` and `public/api/system/repair_htaccess.php`. Preserve the correct relative path, including any nested API directory.
3. Keep the managed-rule integrity checks in `public/security.php` aligned so an older installation can detect and repair missing protection.
4. Update the corresponding Nginx deny rule and root/subfolder guidance in [VPS](VPS.md). Nginx does not read `.htaccess`.
5. Extend the regression coverage in `server/test-integration.cjs`: an exact helper URL must return `403`, a `.php/extra` alias must return `404`, and the legitimate endpoint using the helper must still work. Check active directives rather than accepting commented copies.
6. Rebuild and verify both Source and Deploy ZIPs contain the helper and matching protection. For an existing installation, run the supported integrity repair when notified; do not treat uploading a helper alone as a completed upgrade.

The generic `.php/` rule only rejects appended path segments. It does not replace protection for an exact helper URL, and query-string data remains governed by the owning endpoint's validation.

## Related docs

- [INSTALL.md](INSTALL.md)
- [SECURITY.md](SECURITY.md)
- [UPGRADE.md](UPGRADE.md)
- [../README.md](../README.md)
