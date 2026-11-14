# VonCMS Security Policy v1.28.3

## PHP Runtime Baseline

VonCMS 1.28.x requires PHP 8.2.0 or newer; PHP 8.3+ is recommended. The PHP 8.2 dashboard notice is advisory and does not lock out compatible sites. This is an application compatibility floor, not proof that a PHP installation has current security patches. CMS updates do not update the hosting runtime.

Use a supported PHP branch with the latest security updates from PHP or your hosting/OS vendor. The [21 October 2026 PHP advisory](https://www.php.net/archive/2026.php#2026-10-21-5) identifies PHP 8.3.36, 8.4.27 and 8.5.12 as fixed releases for CVE-2026-109618 and CVE-2026-109619. A vendor may provide equivalent backported fixes; confirm the web-serving runtime with the provider. Merely changing a version guard or selecting an older PHP 8.3 build does not remediate those vulnerabilities.

## Security Overview

This document explains how to report security issues and summarizes the default protections in VonCMS.

It is written as a practical security overview, not as a penetration-test certificate.

Password-reset and verification emails require a valid **General Settings > Domain URL** on public installations, including any installation subfolder. Arbitrary request Host headers are not used as email destinations; only exact loopback hosts retain a development fallback. Missing configuration stops delivery safely.

The same configured Domain URL owns public canonical, social metadata, schema, sitemap, robots, RSS, and `llms.txt` origins. Request-derived SEO origins are limited to local development hosts; a public installation with a missing canonical URL fails closed instead of reflecting an arbitrary Host header into crawler output.

Post, page, and WordPress import writes validate iframe providers on the server. Supported YouTube, Vimeo, Facebook video, TikTok, and Instagram reel embeds retain their video controls; unsupported iframe sources are removed when content is saved or imported.

The local development Theme API validates ZIP entries and extracts into a fresh random directory before activation. This is a local extraction mitigation and does not establish that the underlying archive dependency has no published advisories.

## Report Dangerous Issues Privately

If you find a dangerous security issue, do not open a public GitHub issue with exploit details.

This includes:

- authentication bypass
- admin or session takeover
- secret, API key, or config leakage
- SQL injection
- upload bypass
- arbitrary file access
- remote code execution
- destructive data loss
- any similarly high-impact weakness

Report it privately first:

`kurama87@gmail.com`

Please include:

- affected VonCMS version
- affected endpoint or page
- reproduction steps
- proof of impact
- whether authentication is required

This gives enough context to verify and patch the issue before public disclosure.

## Security Model at a Glance

VonCMS protects the system in several layers:

- request validation
- session protection
- CSRF protection
- rate limiting
- upload restrictions
- error masking
- installer and update safeguards

The goal is simple: make common attacks harder without turning normal publishing work into a headache.

## 1. Session Protection

VonCMS uses PHP sessions with secure defaults.

What it does:

- uses `HttpOnly` cookies
- uses `SameSite=Lax`
- enables the `Secure` flag when HTTPS is active
- regenerates the session ID on login
- binds active sessions to the current user agent to reduce session hijacking risk
- binds authenticated sessions to the current database user ID, role, and password state
- revalidates that authorization state once per request so role changes, password changes, and user deletion revoke existing session authority
- limits PHP sessions to one hour of inactivity and a fixed 12-hour absolute lifetime
- uses a dedicated hashed selector/validator token for remember-me instead of persisting the raw PHP session ID
- rotates the remember validator when restoring a session and revokes the active token on logout

What this helps with:

- stolen old session IDs
- basic session fixation
- some cookie theft scenarios

## 2. CSRF Protection

VonCMS protects state-changing requests with CSRF validation.

What it does:

- generates a per-session token
- expects the token on mutation requests
- standardizes around the `X-CSRF-TOKEN` header pattern

What this helps with:

- forged requests from another site
- silent state changes while an admin is already logged in

## 3. Input and Output Safety

VonCMS reduces injection risk on both the backend and frontend.

What it does:

- uses prepared statements through PDO for database access
- escapes normal UI output through React rendering
- sanitizes HTML content through controlled filters where raw HTML is allowed
- validates parsed single-value URL attributes and removes inline event handlers and script/style containers on Post/Page saves, including entity-encoded schemes and parser-hidden markup; output renderers retain their own full HTML sanitization
- rejects inline `data:image/` sources with a validation message before saving, rather than silently discarding pasted image sources; upload images through the Media Library

What this helps with:

- SQL injection
- stored XSS through unsafe HTML
- unsafe script-style payloads in normal content fields

## 4. File Upload Rules

VonCMS treats uploads as a high-risk area.

What it does:

- accepts only allowed image formats through the upload API
- validates both extension and MIME type
- rejects suspicious file types
- secures the uploads directory against script execution with an `.htaccess` shield on Apache-style deployments
- sets uploaded files to `644` permissions so the web server can read them even on restrictive hosting setups

In practice, standard image uploads are limited to safe raster formats such as:

- `jpg`
- `jpeg`
- `png`
- `gif`
- `webp`
- `ico`

SVG is not accepted through the standard upload API because it is an XML document and can carry active script payloads.

## 5. Rate Limiting and Bot Friction

VonCMS includes lightweight abuse controls for sensitive flows.

What it does:

- rate limits login and selected public submission flows
- uses honeypot fields in places where bot traffic is common
- logs suspicious events for review

The Security Dashboard describes recorded checks, not confirmed attackers or successful break-ins. A failed login can be a typo; a honeypot hit suggests automation. When the login limiter refuses further attempts from a network, it samples `login_rate_limited` events after releasing the limiter file lock. A separate expiry-pruned ledger caps these events at one per network per 15 minutes and 60 per minute across the site, with at most 4,096 keys and 1 MiB of state. The dashboard describes that repeated-attempt pattern as "Possible brute force", with a shared-connection caveat. Logging is best-effort: missing database/log storage or an exhausted sampling budget can drop events but must not change a denial into admission. Rejection counts are recorded events, not every throttled request. No cross-IP attack correlation, general exploit detection or automatic extra ban is implied. The visible log refreshes every 30 seconds; summary statistics are cached for up to 60 seconds.

Login reserves attempts atomically per client IP, grouping IPv6 privacy addresses by /64 and ignoring untrusted forwarding headers. A successful login refunds only its own reserved attempt. There is no additional cross-IP account lockout: wrong passwords from other networks cannot exhaust the owner's allowance on a fresh IP. The tradeoff is that distributed guessing has no account-wide quota; operators can add trusted edge-level abuse controls without replacing strong passwords. Known, unknown and legacy bcrypt checks retain normalized hashing work, not a promise of identical network response times.

Successful credential issuance is serialized with password replacement. The exact hash accepted by bcrypt must still match under the users-row lock, held through the remember-token insert and commit. Session and cookie credentials are published only afterwards. Reset-first rejects the old login; issuance-first allows reset to revoke the token. Optional missing remember storage falls back to session-only login, not to an unchecked password.

Registration uses a separate fixed five-request/15-minute IP budget, with IPv6 /64 grouping and IPv4-mapped normalization. Attempts count before validation and successful registrations are not refunded. Its locked ledger is expiry-pruned and capped at 4,096 active networks and 1 MiB; storage failure denies registration rather than bypassing its quota. A full ledger rejects new networks while existing keys retain remaining allowance. Many independent networks can still exhaust that bounded capacity; this is not a distributed-abuse availability guarantee. Login and recovery use their existing independent policies. The old escalating registration penalty is replaced; old per-address files remain untouched for rollback and no new files of that kind are allocated by registration.

Password-recovery mail requests retain limits of three attempts per IP/email pair and five per normalized email in 15 minutes, reserved together under one ledger lock. Unknown emails allocate no quota state, and honeypot log accounting uses a separate bounded ledger. Unknown, accepted and quota-denied requests share the ordinary generic HTTP 200 message; a denied request sends no mail and does not replace a reset token. Storage failure refuses mail side effects, while login and token submission remain independent. Existing live quotas are not reset during upgrades; a previously saturated ledger may require its remaining 15-minute window to expire. These controls bound abuse but do not guarantee availability against arbitrary traffic or an attacker targeting known recovery addresses.

Contact submissions are restricted to bounded fields declared by the selected form template and validated by field type before storage or mail tag replacement. Stored contact leads are pruned after 90 days, linked leads are removed with their form, and detailed mail transport failures remain server-side.

Newsletter subscription attempts use a dedicated per-IP throttle, including repeated requests for addresses already in the list. Public responses do not reveal whether an address is active or previously unsubscribed, and an unsubscribed address is not reactivated without a separate ownership-confirmation flow.

What this helps with:

- brute-force login attempts
- noisy spam bots
- basic scripted abuse on public forms

## Fixed Role and Review Authorization

VonCMS keeps the built-in Root, Admin, Moderator, Writer, and Member roles behind one server-owned capability policy. The React admin mirrors those capabilities for usable buttons and tabs, but every endpoint checks the current database-backed session role again.

Writer review transitions use an explicit action and expected source status. Existing post rows are locked before ownership and state decisions are applied, stale concurrent reviewer actions receive `409`, and status-only review decisions do not overwrite article fields. Writers remain limited to their own Draft or submitted posts, while reviewer actions retain the original author. Public queries continue to exclude `pending_review` content.

Primary-administrator protections remain separate from the fixed role matrix. Database repair, owner credentials, destructive media tools, and other primary-only operations are not delegated merely because a user can review posts.

## Internal Calendar Boundary

Calendar requires the server-owned `calendar.manage` capability, limited to root/Admin/Moderator roles. Its write methods additionally require CSRF. Publication entries retain existing content read/edit permissions and never invoke scheduling or modify content. Events and minimal audit records commit together; stale versions are rejected, and private creation keys prevent duplicate retries while the record or its retained creation audit exists. HTML-like event titles/notes remain plain text. Queries have a validated date range, fixed response cap and no guest/public-cache path. Calendar schema creation belongs to fresh install or explicit Primary Admin Database Repair, never normal reads/writes.

## Settings Ownership and Secret History

The primary administrator owns canonical-domain, SMTP/API credential, Media storage or optimization, and Analytics settings, together with protected IndexNow key actions. IndexNow, GA4 and VonAnalytics privacy controls are read-only for appointed administrators. They can still manage normal site settings, including delegated SEO, Search Console and AdSense fields, but direct API requests cannot overwrite owner-only values; disabled UI controls do not replace server authorization.

Secret-bearing settings are not retained in rollback history. Legacy sensitive audit rows are removed when Settings or the audit viewer runs, and public contact forms receive only the dedicated safe field projection rather than private delivery configuration.

### Shared and personal Gemini credential encryption

New and explicitly saved global Gemini keys use authenticated AES-256-GCM with a random 32-byte installation key, fresh 12-byte nonce, 16-byte authentication tag and a server-owned credential context. PHP OpenSSL with AES-256-GCM is required when saving or using an encrypted credential; unrelated CMS features do not gain a new runtime prerequisite. Plaintext and encrypted key values are never returned by Settings, including to the Primary Admin. The owner receives a protected placeholder and `empty`, `legacy`, `encrypted` or `unavailable` storage status.

Existing plaintext keys remain compatible until an explicit owner Save Settings action migrates them. Reads do not rewrite the database or create a master key. Migration preserves the existing optional 30-day expiry; an unchanged or omitted key neither renews nor erases an expired or unreadable credential. Explicit re-entry starts a new local expiry period, even if the provider key has not changed. Clearing the field explicitly removes the saved credential. VonCMS expiry does not revoke the key at Google.

The master key is generated automatically in `data/credential_master.key.php` relative to the installed public root. It is created with private file permissions and a PHP denial guard, in addition to the existing data-directory HTTP shield. It is excluded from Git, release copying and ZIPs, and is not in a SQL backup. OTA preserves the existing data directory. Back up this file separately and protect the backup: a database restore on another server needs the matching key file to use previously encrypted credentials. Old SQL backups that contain plaintext are not rewritten by this change.

Advanced deployments can define an absolute `VONCMS_CREDENTIAL_KEY_FILE` path in private server configuration before the helper loads. Keep the filename `credential_master.key.php` so release/Git exclusions remain effective. A private path outside the web root or a durable mounted secret file is supported; the existing file is read without changing it. Multiple instances must use the same durable key file. Do not rely on an ephemeral container filesystem.

Missing, wrong or malformed master material fails closed on decryption, without treating ciphertext as a provider key. Restore the matching private backup first. A new master can be generated on an explicit Save only when no encrypted shared credential or personal record remains. Replacement cannot strand other users' encrypted keys by silently creating a new master. A corrupt existing file is never overwritten. If the matching backup is permanently lost, plan an explicit credential reset instead of deleting files as routine maintenance. An unchanged shared-key Save preserves unreadable encrypted bytes; unrelated settings remain maintainable.

With an encrypted shared key configured, Primary Admin can use **Rotate Encryption Key** in API Settings after saving/discarding other edits. The existing Settings endpoint requires a valid session, CSRF, owner permission and the current opaque ciphertext revision; appointed staff cannot rotate. It re-encrypts the shared credential and all personal credentials, including expired keys and keys retained for demoted users. Provider values, model and expiry dates are preserved. Read-only or symlink-mounted secret files do not offer application-managed rotation; server operators manage those files.

File publication and a database commit cannot form one filesystem/SQL transaction. Rotation therefore publishes protected transition material before updating all locked credential rows in one database transaction. The ring contains at most three keys. After an incomplete transition, the next rotation first consolidates the live rows onto the existing active generation rather than minting another generation. A failed or uncertain response requires reloading status, not deleting or restoring an old-only master file. Saves and rotation exclusively lock the private API-settings anchor; request selection holds a short shared lock through read/decrypt, then releases it before quotas or provider HTTP. Future credential families must join this coordinator before sharing its master key.

Back up the private key file again after rotation. Old backups may require their matching older key snapshot; the bounded live ring is not a substitute for a backup policy. On Linux, restoring an automatically managed key via FTP may reset its mode to `0644`; restore restrictive `0600` permissions and correct ownership. Windows uses filesystem ACLs rather than the same POSIX mode check. The PHP denial guard remains intentionally present in the internal file; key bytes are never shown in the Settings panel.

Personal credentials use private `user_ai_keys` records unique by user/provider and an authenticated encryption context bound to that user and Gemini. The own-account endpoint accepts only the validated session's account and fresh staff eligibility; even Admins cannot use it to read or replace another user's key. Only masked own status is returned. General user lists, sessions, public profiles/settings, caches and editor/browser storage do not receive these records. Removing a user cascades to their key. Runtime actions do not create schema; installation/Database Repair owns it.

The server selects a saved personal key before shared access. Only a genuinely absent personal record permits fallback. Expiry, decryption/storage failure, provider rejection or quota failure never silently spends the shared key. Existing per-user and shared-site quotas, safe provider errors and same-credential model fallback remain in force.

This protects credentials against disclosure of SQL data alone, not a compromised PHP process, server administrator or attacker with both SQL and the master key. Existing Admin account-management powers, including lower-role password resets, remain unchanged; this is direct key-endpoint isolation, not protection against a malicious hosting operator or account takeover. SMTP, other secrets and cloud-secret-manager integration remain outside this change.

## Database Operations and Security Exports

Database backup, import, repair, and query inspection are primary-administrator operations protected by session and CSRF checks. The query console is read-only, while SQL restore accepts only the table-level statements produced by VonCMS backups and rejects server/account/global operations.

Pre-import safety backups are access-protected, excluded from release packages, and bounded by count and age. Security-log and newsletter-subscriber CSV exports neutralize formula-leading cells before spreadsheet software receives them.

## 6. Error Handling and Information Exposure

VonCMS tries to avoid leaking sensitive internals to the public.

What it does:

- routes API errors through a unified response helper
- hides sensitive details from public users on server errors
- keeps validation errors readable when user feedback is actually needed
- exposes more detail to authenticated admins when debugging is necessary

What this helps with:

- accidental database detail leaks
- stack trace exposure to visitors
- broken public UX where every failure looks the same

## 7. Installer and Reinstall Protection

VonCMS protects the installer after setup is complete.

What it does:

- blocks the installer when `install.lock` exists
- also treats `von_config.php` as a sign that the system is already installed
- shows a locked-state response instead of silently allowing re-entry into setup

What this helps with:

- accidental reinstallation
- opportunistic installer abuse after a site is already live

## 8. CORS and Public API Behavior

VonCMS does not blindly mirror every origin.

Current behavior is more conservative:

- trusted same-host origins can be mirrored for credentialed requests
- requests without an `Origin` header may receive a wildcard response
- this keeps normal frontend/API communication working without turning the whole API into a free-for-all credentialed endpoint

This area still depends on your deployment pattern, so if you build external apps on top of VonCMS, test your exact CORS flow in staging.

## 9. What the Admin Still Needs to Do

No CMS can replace basic server hygiene. You still need to:

- run HTTPS in production
- use strong admin passwords
- keep PHP and the web stack updated
- remove test files from the web root
- back up the database and `uploads/`
- restrict access to your hosting panel and SSH
- verify file permissions are sane after manual uploads

### File Permission Reference

VonCMS sets `644` on uploaded files automatically. If you upload files manually via FTP, SFTP, or a file manager, use these permissions:

| Target                                       | Permission     | Why                                                                                                                 |
| -------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Files** (`uploads/*`, `.htaccess`, `.php`) | `644`          | Owner read/write, everyone else read-only. Apache needs read access to serve images, CSS, JS.                       |
| **Directories** (`uploads/`, subfolders)     | `755`          | Owner read/write/execute (traverse), everyone else read/execute. Apache needs traverse access to enter directories. |
| **Config** (`von_config.php`)                | `644` or `600` | `600` is more restrictive; only the owner can read. Use `600` if your host supports it.                             |

**If images appear broken on the frontend but work in the admin gallery:** Check file permissions. Permission `600` means only the file owner can read, so Apache (`www-data`/`nobody`) cannot serve the file to visitors. Change to `644` to fix.

If you are on shared hosting, also be aware that your panel may add PHP handler rules to `.htaccess`. VonCMS Integrity Fix now repairs only the VonCMS-managed routing block and creates a `.bak` backup first.

## 10. What This Guide Does Not Claim

This guide does not claim that VonCMS is impossible to break into.

What it does claim is:

- the core includes real defensive layers by default
- common shared-hosting attack surfaces are not ignored
- the system is designed to fail more safely than a plugin-heavy default install

### v1.28 account tokens and native analytics

Known automation exclusion in v1.28.1 is a measurement policy, not an access-control or bot-authentication boundary. Recognized User-Agents do not record native visitor/content views; crawler-rendered PHP documents mark the bundled frontend to skip native tracking when a renderer uses a different User-Agent. No shared-IP reputation, OS/browser ban, new identity cookie or external bot lookup is introduced. An unmarked request that impersonates an ordinary browser can still be counted. The public marker grants no authority, and CSRF, authentication and consent policy remain independent. Historical analytics rows are not rewritten.

New reset and email-verification tokens are random secrets sent only in account-action links. The database stores `s1:`-prefixed SHA-256 digests encoded to fit the existing token columns. The prefix separates new digests from legacy raw 64-hex tokens: a stored digest is not a usable account token. Outstanding legacy links retain their original expiry and single-use behavior. Reset consumption remains transactional and revokes remember tokens. Protect database backups regardless; digest storage does not make database disclosure harmless.

Native analytics remains optional and server-gated by plugin state and the configured consent policy. Strict uses an installation-keyed HMAC of the monthly client address and the existing 30-minute recorded-visit window. Unexpired legacy IP-hash rows are consulted only for their remaining deduplication window; new writes never persist that unkeyed representation. Historical rows are not rewritten. Both modes need the private analytics signing key; key loss changes future identities rather than exposing raw addresses. Balanced stores hashes of installation-scoped random browser IDs and updates session activity under a database transaction/row lock. The separate browser cookie is not authentication, is not IP-bound, and is client-accessible so declining consent can remove it; it must never authorize privileged actions. Client-controlled browser IDs and IPs are visitor estimates, not proof of a human or fraud-resistant accounting. No-cookie requests do not allocate visitor sessions. Reports do not combine identities across modes. Session expiry and bounded opportunistic cleanup limit lifetime, not the absolute number of admitted identifiers.

Public tracking POST routes share a 120-request/minute budget per client address, grouping IPv6 /64 addresses. Forwarding headers are ignored by default; the separate analytics opt-in requires a trusted immediate peer and a header whose provenance is guaranteed by that proxy, as described in [INSTALL.md](INSTALL.md). X-Forwarded-For strips only the trusted right-hand suffix, never selecting a spoofable left-hand prefix. Missing, oversized or malformed used hops fall back to the peer. Already restored `REMOTE_ADDR` needs no opt-in. Login/recovery retain their original direct-address policy. Balanced cookies carry an installation HMAC and absolute 30-day expiry, bound to their installation path. A private `data/analytics_signing.key` owns this signature and is excluded from Git, builds and release packages; protect it like other private runtime data. Unsigned, altered or expired cookies receive at most one client retry after an allowed replacement. Cookie issuance and new session-row admission each have separate 120/hour address budgets. Tracking uses three purpose-specific, 16-shard ledgers, with at most 4096 active buckets and 1 MiB per shard, never a file per visitor. Shard saturation refuses new buckets there, not all visitor addresses. First use imports unexpired old shared-ledger counters once without deleting them; simultaneous old/new writers are not a combined quota authority. Unavailable admission storage refuses tracking without failing page delivery. Login/recovery storage and multi-key atomic reservations are unchanged. Extremely busy shared-IP networks may undercount while a budget is exhausted. Multiple attacker addresses can still inflate estimates or fill shards: these controls are not a global database-size cap or DDoS guarantee. Disabling the consent requirement permits the optional Balanced cookie without a consent prompt; operators remain responsible for their privacy policy.

The internal Calendar retains deleted-event creation-key tombstones for its 90-day audit window; it does not promise permanent retry suppression after pruning.

## Reporting Security Issues

For normal bugs, use GitHub Issues. For dangerous vulnerabilities, report privately first instead of opening a public issue with exploit details.

Private report contact:

`kurama87@gmail.com`

After the issue is verified and patched, public notes can be added without exposing users before they have a fix.
