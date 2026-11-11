# VonCMS API Guide

Version: `1.28.2`

Runtime minimum: PHP 8.2.0; PHP 8.3+ is recommended. Use a supported, patched PHP build; the CMS version guard does not install PHP security updates.
Primary API location: `/api/*.php`
System endpoints: `/api/system/*.php`

This guide is a practical map of the current API surface. It focuses on the endpoint structure that exists in the project today instead of trying to document every response field in exhaustive detail.

Guest settings and initial HTML use the same public projection. Only the active bundled theme namespace and shared `primaryColor`, `fontFamily`, `borderRadius` and `customCss` fields are included; an unknown theme ID follows the bundled Default fallback. Explicit `ads.adsEnabled: false` omits `headerAd`, `inFeedAd` and `popupAd`, while preserving flags and intervals. Explicit Newsletter OFF projects `{ "enabled": false }`. Enabled empty values are not filtered. Inactive system-plugin configuration and disabled custom HTML plugins remain omitted. Authorized Admin reads retain the saved configuration; Member, Writer and Moderator reads use the reduced public projection, with existing staff capability hints unchanged.

Treat a public response as a complete reduced snapshot, never as a settings-write payload. Admin editing requires the full response described below. Canonical Ads/Newsletter rows take precedence over legacy aliases even when empty. No new endpoint, storage schema or authorization rule is introduced; the existing cache is cleared after a successful Settings save.

Complete Admin settings responses carry the runtime-only `_settingsScope: "admin"` readiness hint, including secret-masked responses for appointed Admins. It is not an authorization grant or persisted setting. The frontend waits for this response before showing Admin settings screens and rejects public-only/stale drafts; session, role and CSRF checks remain enforced by the server.

## How the API is organized

### Public News sitemap

`GET /sitemap-news.xml` (or `?page=N`) is served by the existing sitemap controller through the exact installation-root front-controller route. Root, subdomain and subfolder installations use the configured canonical Domain URL. Each file contains at most 1,000 selected, Published posts from the preceding 48 hours; `/sitemap.xml` advertises its chunks. The first-publication/scheduled/creation fallback is shared with public rendering, never `updated_at`. No article bodies are selected.

The existing authenticated, Admin-authorized, CSRF-protected `/api/save_settings.php` persists `seo.newsSitemap` in `seo.site_config`, with `enabled` (boolean), `publicationName` (string, at most 200 characters), `language` (blank to inherit, or a two/three-letter ISO 639 code, `zh-cn`, `zh-tw`), `scope` (`all` or `categories`) and `categories` (up to 200 nonempty names). Selected-category mode requires at least one category when enabled. Merge the latest SEO configuration when saving, preserving its other fields. No public write endpoint, new table or migration is added.

OFF is the default. Disabling XML Sitemap also disables News while retaining its saved options. Disabled: 404; enabled and empty: 200 with valid empty XML; invalid/out-of-range page: 404 with empty XML; unavailable metadata/database: 503 with `Retry-After: 300`. News-only configuration errors omit News links from the otherwise usable ordinary index. See the [manual](MANUAL.md#optional-news-sitemap) for publication metadata and legacy-date limitations.

Dashboard article report: `GET /api/track_visit.php?report=articles&days=7` returns up to 10 published articles ranked by daily views (7 or 30 days, including today). It retains the existing staff-only permission. Existing sites must run Database Repair to enable `post_daily_views`; fresh installation creates it automatically. Unavailable storage returns 503 rather than a misleading zero result. These anonymous counts follow accepted, session-deduplicated article views, independently of consent-gated visitor logs; no reader identifiers are stored. Lifetime counts are not backfilled, and aggregate writes are best-effort so reporting faults cannot break the existing counters. Dates use the configured site timezone, and bounded opportunistic cleanup removes expired daily rows.

`get_posts.php` keeps a maximum of 200 records per response. Public themes use the Posts Per Page setting (6-50) and numbered pagination, with a maximum page number of 1,000,000. This is a navigation boundary, not a limit on stored articles. Existing sites activate optional large-archive query indexes through Database Repair; unrepaired schemas keep the original queries and search behavior is unchanged.

VonCMS mainly uses file-based PHP endpoints.

Examples:

- `/api/login.php`
- `/api/get_posts.php`
- `/api/save_settings.php`
- `/api/system/fix_integrity.php`

Most read endpoints use `GET`. Most write endpoints use `POST`.

## Authentication and request rules

Global Gemini credentials are owner-only. `get_settings.php` masks `api.aiApiKey` even for the Primary Admin and reports `api.aiKeyStorage` (`empty`, `legacy`, `encrypted`, or `unavailable`). `save_settings.php` accepts plaintext for an owner replacement, a protected placeholder/omitted field to retain the key, or an empty string to remove it. An owner Save can migrate a legacy value; the private `encryptStoredAiKey` intent ensures the UI sends that API group even without another field change and is not persisted. `replaceAiKey` marks explicit field editing so a legacy client's unchanged plaintext echo does not silently restart expiry. Stored ciphertext is not accepted as an API key. Successful API-group writes return a masked `apiCredential` projection so the client discards entered plaintext from canonical settings state. Existing session, Primary Admin and CSRF controls remain authoritative; appointed Admins cannot change this group. See [credential encryption and recovery](SECURITY.md#global-gemini-credential-encryption).

Owner credential status also includes response-only `aiKeyCanRotate` and opaque `aiKeyRevision`, plus server-owned persisted `aiKeyRotatedAt`. POST `save_settings.php` with exactly `{"_credentialAction":"rotate","_credentialRevision":"<current revision>"}` for a separate Primary Admin/CSRF-protected rotation; do not mix it with other Settings changes. Success returns only the masked `apiCredential` acknowledgement. Malformed requests return 400, unauthenticated/unauthorized requests 401/403, stale or competing actions 409, and unavailable storage or an unconfirmed write 503. Reload canonical Settings after an uncertain response. Rotation preserves the provider key/model/expiry and uses a bounded protected key ring so file/database transition failures do not require deleting the master. No new endpoint is added.

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

Login verifies the password before taking a short users-row lock, then rechecks that exact password hash and commits any new remember token before publishing session or cookie credentials. Reset and other password writers use the same lock order. A password changed in between causes ordinary `401` rejection. Missing optional remember-token storage permits session-only login after the mandatory password guard; other transaction failures do not issue credentials.

Enabled registration reserves five requests per client IP in a fixed 15-minute window before input validation. IPv6 addresses share a /64 allowance, and mapped IPv4 uses its ordinary IPv4 identity. The sixth request returns `429` with `Retry-After: 900`. Registration has its own expiry-pruned ledger, capped at 4,096 active keys and 1 MiB, rather than persistent files per address. Corrupt/unavailable storage or capacity exhaustion refuses new registration attempts without changing login/recovery quotas. This replaces the old escalating registration penalty. Legacy files are retained for rollback, not migrated or deleted automatically.

`POST login.php` also accepts `action: "resend_verification"` with the existing `username` (or email) and `password`. It verifies credentials and CSRF before changing a pending link, accepts at most one resend per minute and three per 15 minutes per account, and never establishes an authenticated session. The latest link expires after 24 hours; only its digest is stored. Rejected credentials and throttled requests do not replace the link. Mail failures leave the account unverified and return retry guidance without transport details. Normal login may omit `action` or use `"login"`.

Login POSTs require a CSRF token from the same guest session before credentials are processed. The app's `vonFetch` obtains it automatically; custom clients must first call `/api.php?action=get_csrf_token`, retain that session cookie, and send the token in `X-CSRF-Token`. Missing or invalid tokens return `403`; login GET remains `405`.

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

Post and Page slugs share a reservation across both content types. Saving a conflicting slug returns `409` with a request to choose another slug; review publication and scheduling enforce the same rule. WordPress import reports conflicting items without replacing the existing owner. Existing cross-type collisions are not renamed automatically, and public routing priority remains unchanged. Same-type editor collisions retain the existing suffix behavior.

`get_posts.php?status=pending_review&scope=all` is reviewer-only. `countOnly=true` returns the pending total used by the admin navigation badge without transferring post bodies. Writers can read only their own protected posts, and `delete_post.php` permits a Writer to delete only an owned Draft. The server capability helper is the authority for every mutation; hiding a frontend button is not treated as permission.

### Editorial Calendar

`/api/calendar.php` requires a validated Admin/root/Moderator session and the server-owned `calendar.manage` capability. Responses are private/no-store and are not included in guest settings, feeds, sitemap or public caches.

- `GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&type=all|event|post|page&author=ID&page=1`: the end is exclusive; ranges are limited to 62 days. Responses contain up to 200 metadata records, scoped content-author choices, site timezone/today and `meta.hasMore`. Content author filtering does not filter events. Author choices are capped at 200 with `meta.authorsTruncated`; no account emails or full article bodies are returned. Post/Page dates use the shared publication fallback and existing read/edit capabilities. Views do not invoke publishing.
- `POST`: JSON `title`, `notes`, boolean `allDay`, `start` and `end`; dates are `YYYY-MM-DD` for all-day events or `YYYY-MM-DDTHH:mm` otherwise. The all-day end supplied by the caller is inclusive. Create requires a fresh 36-character lowercase UUID `requestKey`. Update requires `id` and the previously read positive integer `version`. The response returns `id`; reload the date range for the new version. While the event exists, reusing a successful create key with the identical actor/payload returns the same ID; a changed payload is rejected. A retained creation-audit token also prevents late retries from recreating a deleted event; that tombstone follows the 90-day audit retention policy.
- `DELETE`: JSON `id` and `version`, with confirmation owned by the client. `POST` with `action: "delete"`, `id` and `version` is an equivalent fallback. Both methods require the same capability and CSRF checks. Updates and deletions use atomic version comparison; conflicts return 409. Event persistence and minimal audit insertion commit together or roll back together. Invalid types/dates/lengths return 400; oversized bodies return 413. Event form rejection must not be treated as successful persistence.

Storage is `calendar_events` plus `calendar_event_audit` in the same database. Fresh install and explicit Primary Admin Database Repair own table/index creation; requests never execute DDL. Missing schema returns 409 with repair guidance. Removing an event does not remove its audit history or any Post/Page. Calendar events have no public publishing endpoint.

New events must start today or later in the configured site timezone. The API rejects backdated creates and attempts to move an event to a past start. Existing historical events and their notes remain available; correcting notes without changing their stored start is allowed. Exact creation retries still return the existing record even after its date has passed. GET includes site-local `today` and `now` for the UI; none of these rules changes publication or Scheduled post dates.

### Comments and discussion

- `get_comments.php`
- `save_comments.php`

Flat moderation lists include a compact parent `post` reference for Admin/Moderator roles only. It contains the current title, permalink fields and public-visibility flag, or `null` when the parent was deleted. Public comments and Writer/Member responses omit this context. No article body is included.

Comment status changes and deletion of another user's comment require the server-owned `comments.moderate` capability (Root/Admin/Moderator). Authenticated users retain deletion of their own comments, including their replies; Writers cannot approve their own pending comments or moderate other users' comments. Session and CSRF checks remain required for these mutations.

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

User deletion locks and authorizes the current target account within the cleanup transaction. Primary Admin and self-deletion protection use its stored ID, including when a numeric alias is submitted. Appointed Admins cannot delete protected Admin/Root accounts. Failed cleanup rolls back; successful deletion retains content bodies and clears the removed account's author associations.

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

#### WordPress Bridge endpoints

`POST /api/tools/wp_scan.php` accepts multipart `xml_file` (1 byte to 64 MiB). `POST /api/tools/wp_import.php` accepts JSON `temp_file`, `batch_index` and `limit` (1-50; the UI uses 10). Both require a valid Primary Admin session and CSRF. DOM, XMLReader and SimpleXML are required; cURL is required for remote image localization. The complete XML is validated before the first content write. WXR 1.0-1.2 namespace URIs and supported flat Post XML are recognized; unrelated/empty exports and malformed XML are refused.

Article bodies use the RSS content namespace URI, independent of its XML prefix. A matching local field name under an unrelated namespace is not treated as the body. Flat `<content>` and `<description>` remain supported fallbacks.

The server's protected checkpoint owns the cursor, not a caller-provided offset. Responses include `phase` (`import` or `links`), `has_more`, `paused`, authoritative processed/imported/skipped totals, `errors`, `warnings` and a warning count. Continue while `has_more` is true, even if the final link-resolution request imports no new records. Stop on `paused` and retain the checkpoint; retry resumes the failed item rather than skipping it. Successful finalization removes the XML and JSON state. A later scan prunes temporary import files older than 24 hours. Checkpoints are capped at 16 MiB and concurrent requests for the same import are refused. Browser checkpoints are scoped to the installation base path.

Password-protected items are imported as Drafts, not as password-protected published articles. Native excerpts and post tags map to `excerpt` and `keywords`; `_yoast_wpseo_metadesc` and `rank_math_description` map to `meta_description`. Destination field caps produce warnings; articles above the 1 MiB content limit pause instead of being silently truncated. Imported image storage remains Year/Month.

Only newly imported, unchanged article bodies are eligible for the final internal-link rewrite. Existing duplicate content, concurrent edits, and existing conflicting redirects are not overwritten. Actual exported permalinks drive exact path redirects; query-based WordPress permalinks can be resolved inside imported content, but external query redirects need hosting/server configuration. WordPress authors, comments, hierarchical taxonomies/pages, custom post types, schedules, arbitrary custom fields, shortcodes and dynamic/plugin-rendered blocks are not transferred in full. Keep the original export and source media until verification is complete; reimport skips existing slugs rather than updating them. The Bridge does not repair previously imported rows in bulk.

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

From v1.28.1, both tracking POST endpoints return `success: true`, `visit: false`, `retry: false`, `throttled: false` and `excluded: true` for recognized automation User-Agents; the combined endpoint also returns `view: false` and `view_throttled: false`. Exclusion follows CSRF/input validation and precedes measurement admission, identity issuance, deduplication claims and view/visit writes. GET reports retain their staff boundary. PHP page HTML marks a recognized crawler document with `<meta name="voncms-tracking" content="excluded">`; the bundled frontend skips native tracking for that document, even if its renderer changes User-Agent. The marker is not a credential or server authorization signal, and removing it or disguising all requests can evade this best-effort exclusion. Existing history and public crawl access are unchanged.

- `submit_contact.php` - POST-only public form delivery with CSRF, bounded template-declared fields, server-side type validation, honeypot/rate controls, generic public mail failures, and 90-day lead retention

Both tracking POST routes share the same 120-request/minute address budget, independent of PHP sessions and endpoint choice. Over-budget requests return HTTP 200 with `success: true`, no recorded visit/view and `throttled: true`; they do not trigger tracking cleanup or writes. GET staff reports do not consume this quota. Balanced uses signed, installation-scoped cookies with an absolute 30-day expiry, plus separate 120/hour address budgets for cookie issuance and new session rows. Missing/unsigned cookies use the existing one-retry handshake; no cookie echo means no visitor row. Busy shared addresses can undercount, and distributed-address traffic is not eliminated. These quotas use separate storage from login and recovery.

The owner-saved `analytics.measurementMode` accepts `strict`, `balanced` or `hybrid`; an omitted mode retains Strict. Hybrid feeds both existing measurements after the same server-owned consent gate. Request admission runs once per incoming request, not once per measurement. Balanced identity retry must not repeat a Strict visit or aggregate content view; each measurement reports its own bounded outcome under `measurements`. The aggregate `visit` flag means at least one measurement recorded, not two people. One optional measurement's failure does not undo the other's accepted visit. Strict uses a per-database/per-identity advisory lock with a one-second acquisition bound and releases it on every acquired exit path.

Both kinds of visit remain in `analytics`, partitioned by `measurement_mode`; `analytics_sessions` holds Balanced deduplication state, not a second report. GET `mode` accepts only `strict` or `balanced`. Hybrid is a collection policy, not a third report, and report selection never writes settings. Missing Balanced storage is reported as `needsRepair`; existing history is not backfilled.

Analytics uses `REMOTE_ADDR` by default. The explicit, analytics-only trusted-proxy option in [INSTALL.md](INSTALL.md) applies consistently to both POST budgets, cookie/session admission and Strict identity. Header presence alone never enables it, and authentication addresses are unchanged. Invalid or missing selected headers fall back to the immediate peer.

Request, cookie-issue and new-session budgets each use 16 fixed shards, with at most 4096 active buckets and 1 MiB per shard. A full shard refuses new buckets without evicting live quotas or blocking other shards/purposes. Existing buckets can still consume their remaining allowance. Each new shard imports matching unexpired counters from the old shared analytics ledger once, under locks, and persists initialization even on quota denial. The old ledger is retained for rollback; concurrent old/new application versions do not share subsequent quota updates. Finish a deployment before comparing counts. Storage corruption remains fail-closed for tracking, not page delivery; login and recovery ledgers are not imported or changed.

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
