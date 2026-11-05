# Installation Guide

> **VonCMS v1.28.1 "The BluePrint".** The installation wizard retains the 1.28 series label. Use the published Deploy ZIP from [GitHub Releases](https://github.com/Vondereich/VonCMS/releases) for a normal hosting installation.

PHP 8.2 is the compatibility minimum; PHP 8.3+ is recommended. The dashboard recommendation does not block compatible PHP 8.2 sites. Use a supported, security-patched PHP build; CMS updates do not update PHP. See [PHP Runtime Baseline](SECURITY.md#php-runtime-baseline).

---

Need the shortest first-run checklist? Start with the root [README](../README.md). This guide explains the hosting path in more detail.

For product positioning and feature coverage, read [Features](FEATURES.md).

## Requirements

VonCMS runs on a standard **LAMP** stack:

| Requirement | Minimum                 |
| ----------- | ----------------------- |
| PHP         | 8.2+ (8.3+ recommended) |
| MySQL       | 5.7+                    |
| Storage     | 50MB                    |

Enable the PHP DOM extension for Post/Page HTML saves and WordPress HTML imports. The installer checks the parser before reserving the setup key or accessing the database and reports a missing extension in the setup wizard. HTML saves also fail before writing content if the parser is unavailable; they do not fall back to regex-only filtering.

WordPress Bridge additionally requires XMLReader and SimpleXML to validate and read WXR exports. Remote image localization requires cURL. Its XML upload limit is 64 MiB; configure PHP/server request-size limits accordingly. These optional import prerequisites do not change the CMS PHP minimum.

Saving a global Gemini API key requires PHP OpenSSL with AES-256-GCM. VonCMS stores the installation's private encryption key separately from SQL backups and release ZIPs; preserve that private file for hosting moves/restores. Existing legacy API keys migrate on an explicit Primary Admin Settings save, not a guest visit or normal read. See [credential storage and recovery](SECURITY.md#global-gemini-credential-encryption). Other CMS features do not require this optional AI capability.

**Server:** Apache or LiteSpeed Enterprise with `.htaccess` support

**Hosting:** cPanel (Apache), DirectAdmin (Apache), WAMP, XAMPP, Laragon

> **Important:** VonCMS uses `.htaccess` for normal shared-hosting routing. This requires **Apache**, **LiteSpeed**, or **Apache behind an Nginx proxy** (common on cPanel/DirectAdmin). If your hosting runs **Nginx-only** with no Apache/LiteSpeed layer, `.htaccess` rules are ignored and routing/protection rules must be added manually. Ask your host which stack they use, or refer to the [VPS Guide](VPS.md) for Nginx config parity.

> **HTTPS and canonical hostname:** Enable Force HTTPS and choose the preferred root or `www` hostname in Cloudflare, cPanel/DirectAdmin, the reverse proxy, or the virtual host using that fixed domain. VonCMS deliberately does not construct an absolute redirect target from the incoming request `Host` header.

> **Reverse-proxy HTTPS:** If HTTPS terminates at a proxy before PHP, configure the PHP environment variable `VONCMS_TRUSTED_PROXIES` with the proxy IP addresses or CIDR ranges, separated by commas. Do not enter visitor ranges. Direct HTTPS and normal Cloudflare Full/Strict origin HTTPS need no extra setting.

> **Analytics behind a proxy:** Keep the default `REMOTE_ADDR` source when the web server already restores the visitor IP. If PHP instead sees the proxy address, the operator may set `VONCMS_ANALYTICS_CLIENT_IP_HEADER=CF-Connecting-IP` or `X-Forwarded-For`, together with the exact proxy addresses/CIDRs in `VONCMS_TRUSTED_PROXIES`. Select only a header that the trusted proxy overwrites or safely appends; a proxy that passes visitor-supplied values unchanged is not a trusted identity source. Do not trust all addresses or add visitor networks. Loopback is treated as a trusted local proxy only after this separate analytics header opt-in. X-Forwarded-For is read right-to-left until the first untrusted hop; malformed used hops fall back to `REMOTE_ADDR`. No other forwarding header is used. This changes analytics quotas and Strict identity only, not login/recovery IP handling. Changing this source can count a visitor again in the current Strict window; historical records are not rewritten. Shared public IPs can still undercount.

---

## Local Testing

### XAMPP / WAMP (Recommended)

- **XAMPP** is the easiest baseline, with phpMyAdmin included out of the box.
- **WAMP** offers easier PHP version switching for `8.4+` testing.

### Laragon

Laragon is lightweight but requires a small manual step:

1. **Download phpMyAdmin** from [phpmyadmin.net](https://www.phpmyadmin.net/)
2. **Extract** to `C:\laragon\etc\apps\phpMyAdmin`
3. **Start Laragon** → **Start All** (Apache + MySQL/MariaDB)
4. **Access phpMyAdmin** → `http://localhost/phpmyadmin`
5. **Connect via database manager** (HeidiSQL/other):
   - **Connection type:** TCP/IP
   - **Host:** `localhost`
   - **Port:** `3306`
   - **Username:** `root`
   - **Password:** _(leave empty)_

> **Default DB credentials:** Host: `localhost`, User: `root`, Password: _(empty)_. MariaDB is fully compatible with VonCMS (uses standard `mysql:` PDO DSN).

VonCMS keeps PHP error display disabled by default on every host, including localhost. Developers who need browser-visible diagnostics must explicitly set the web-server environment variable `VONCMS_ENV=development`; removing that variable restores the production-safe default. PHP logs are written to a private per-install directory outside the server document root, with a private system-temporary fallback when the host does not expose or permit that location.

---

## Quick Install

### Subfolder crawler files

Search crawlers only treat the host-root `/robots.txt` as authoritative. If VonCMS is installed
under a path such as `example.com/blog`, configure the parent virtual host or root application so
`https://example.com/robots.txt` serves the VonCMS policy or references
`https://example.com/blog/sitemap.xml`. The bundled `/blog/robots.txt` route remains useful for
inspection, but it cannot replace host-root robots configuration.

### Step 1: Upload

1. Download the latest published VonCMS Deploy package from the GitHub Releases page.
2. Upload to hosting (`public_html`) or localhost (`htdocs`)
3. For Laragon: extract to `C:\laragon\www\your-project`

### Step 2: Create Database

1. Open **phpMyAdmin**
2. Click **New** &rarr; Enter name &rarr; **Create**

### Step 3: Run Installer

1. Open your site URL in browser
2. Installer Wizard starts automatically
3. Fill in:

| Field          | Example                  |
| -------------- | ------------------------ |
| DB Host        | `localhost`              |
| DB Name        | `my_site`                |
| DB User        | `root`                   |
| DB Password    | _(your password)_        |
| Setup Key      | `data/install_setup.key` |
| Admin Username | `admin`                  |
| Admin Email    | `admin@site.com`         |
| Admin Password | `MyP@ss123!`             |

> **Password:** 8+ chars, 1 uppercase, 1 number, 1 symbol

> **Setup key:** After opening the installer, open `data/install_setup.key` in your hosting File Manager, or download it through SFTP and open it in a plain-text editor such as Notepad. Copy **only the 64-character key** into the **Installer setup key** field, not the filename, quotes or additional text. Do not insert spaces within the key. Avoid Word or LibreOffice, which may introduce formatting characters when copying.
>
> Ordinary spaces and line breaks before or after the key are ignored automatically. Spaces inside the key or other extra characters cause a validation error before database changes; copy the key again and retry. The data directory is blocked from web access, and VonCMS removes the key after installation succeeds.

4. Click **Install Now**
5. Done! Login at `yoursite.com/admin`

> **PHP Version Changes Later:** After the site is installed, changing PHP version in cPanel may add or update handler rules inside `.htaccess`. If you later run **Integrity Fix**, VonCMS creates a `.bak` backup first and repairs only the VonCMS-managed routing block.

---

## Updating VonCMS

This guide is for fresh installs. For OTA updates, manual Deploy ZIP replacement, `.htaccess` repair, and rollback steps, read [Upgrade](UPGRADE.md).

The installer creates the shared authentication, analytics, comment-like, audit, and security-log capabilities as part of installation. Later public or admin requests do not silently create these permanent structures. If an older database needs reconciliation, back it up and use the primary-admin **Settings > Tools > Repair Database** action described in the upgrade guide.

---

## Optional cPanel cron for quiet sites

VonCMS already checks for due scheduled posts during normal public traffic. The check is lock-protected and runs at most once per minute, so most sites do not need a separate cron job.

An external cron is optional when a site can remain completely idle around a scheduled publish time. It improves timing on a quiet site, but it does not replace the built-in scheduler.

1. Edit the installed `von_config.php` and add a long random secret:

   ```php
   define('CRON_KEY', 'replace-with-a-long-random-secret');
   ```

2. In cPanel, open **Advanced > Cron Jobs**.
3. Choose every five minutes for normal shared hosting, or every minute only when the host permits it and near-exact publishing is required.
4. Use this command after replacing the secret and domain:

   ```bash
   /usr/bin/curl --fail --silent --show-error --max-time 30 -H 'X-Cron-Key: replace-with-a-long-random-secret' 'https://example.com/api/cron_publish.php' >/dev/null 2>&1
   ```

For a subfolder install, include the subfolder in the URL, for example `https://example.com/news/api/cron_publish.php`. Some hosts place `curl` elsewhere, so use the path shown by the hosting provider if `/usr/bin/curl` is unavailable.

Keep the key in the `X-Cron-Key` header. Query-string cron keys are not accepted because URLs are commonly stored in access logs. If you do not configure cPanel cron, leave `CRON_KEY` undefined and continue using VonCMS normally.

The endpoint contract and response fields are documented in [API Guide](API.md#scheduled-publishing-endpoint).

---

## Troubleshooting

| Problem                                     | Solution                                         |
| ------------------------------------------- | ------------------------------------------------ |
| White page                                  | Enable `mod_rewrite` in Apache                   |
| Permission error                            | Folders: `755`, Files: `644`                     |
| DB connection failed                        | Check credentials in phpMyAdmin                  |
| Old version showing                         | Delete `assets/` folder, re-upload, hard refresh |
| Images broken on frontend but work in admin | File permission is `600`; change it to `644`     |

### File Permissions

VonCMS sets `644` on uploaded files automatically. If images appear broken on the public site after manual upload:

```bash
# Fix all files in uploads/
find uploads/ -type f -exec chmod 644 {} +
# Fix all directories
find uploads/ -type d -exec chmod 755 {} +
```

Or via FTP/File Manager: right-click the file → Permissions → set to `644`.

---

_VonCMS v1.28.1 "The BluePrint"_
