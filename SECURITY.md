# VonCMS Security Guide v1.23.0

This document explains what VonCMS protects by default, what those protections do, and what the site owner still needs to handle.

It is written as an overview, not as a penetration-test report.

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
- blocks dangerous protocols and inline event handlers in saved content flows

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

What this helps with:

- brute-force login attempts
- noisy spam bots
- basic scripted abuse on public forms

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
| **Config** (`von_config.php`)                | `644` or `600` | `600` is more restrictive — only owner can read. Use `600` if your host supports it.                                |

**If images appear broken on the frontend but work in the admin gallery:** Check file permissions. Permission `600` means only the file owner can read — Apache (`www-data`/`nobody`) cannot serve the file to visitors. Change to `644` to fix.

If you are on shared hosting, also be aware that your panel may add PHP handler rules to `.htaccess`. VonCMS Integrity Fix now repairs only the VonCMS-managed routing block and creates a `.bak` backup first.

## 10. What This Guide Does Not Claim

This guide does not claim that VonCMS is impossible to break into.

What it does claim is:

- the core includes real defensive layers by default
- common shared-hosting attack surfaces are not ignored
- the system is designed to fail more safely than a plugin-heavy default install

## Reporting Security Issues

If you discover a real vulnerability, report it privately instead of opening a public issue.

Recommended report contents:

- affected version
- affected endpoint or page
- reproduction steps
- proof of impact
- whether authentication is required

That gives enough context to reproduce and patch the issue quickly.
