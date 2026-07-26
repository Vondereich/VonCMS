# VPS Deployment Guide

This guide is for users who are comfortable with cPanel or shared hosting and want to run VonCMS on a VPS without getting lost in server jargon.

> **Simplest choice:** Use Apache or LiteSpeed Enterprise if you do not specifically need Nginx. They can apply the `.htaccess` files shipped with VonCMS. Nginx and OpenLiteSpeed do not automatically apply those files and need server-level configuration.

## Choose Your Web Server First

| Web server           | Reads VonCMS `.htaccess` automatically?                             | What you need to do                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apache               | Yes, when `mod_rewrite` and the required `AllowOverride` are active | Extract the Deploy ZIP and continue with the normal installer. Most managed Apache hosting enables this already.                                               |
| LiteSpeed Enterprise | Yes                                                                 | Use the normal VonCMS installer. This is the Apache-compatible LiteSpeed commonly offered by cPanel/DirectAdmin.                                               |
| OpenLiteSpeed        | No                                                                  | Configure equivalent rewrite and protection rules in its virtual-host settings, then restart it. This Nginx configuration cannot be pasted into OpenLiteSpeed. |
| Nginx                | No                                                                  | Follow this guide completely, including the Nginx-only rules in Step 8.                                                                                        |

If you are unsure which LiteSpeed edition is installed, check the server or hosting-panel information before continuing. LiteSpeed Enterprise automatically reads existing Apache configuration and `.htaccess`; OpenLiteSpeed does not. See the [LiteSpeed edition overview](https://docs.litespeedtech.com/licenses/) and [Apache `.htaccess` requirements](https://httpd.apache.org/docs/2.4/en/howto/htaccess.html).

For beginners, use Apache or LiteSpeed Enterprise. Use Nginx when you are comfortable editing and validating a website `server {}` block. Use OpenLiteSpeed only when you are comfortable translating the required protections into its virtual-host configuration.

The stack used in this guide:

- Ubuntu 22.04 LTS (aaPanel's recommended baseline) or another currently supported Ubuntu LTS release
- aaPanel
- Nginx
- MySQL 8.0
- PHP 8.2+
- Latest VonCMS Deploy package

## Before You Start

Prepare these first:

- A VPS with at least 1 vCPU, 1 GB RAM, and 25 GB SSD
- A domain name
- SSH access from your provider
- The latest VonCMS Deploy package

If your audience is in Malaysia or ASEAN, choose a Singapore region when possible. It usually gives better latency than US or Europe.

## Step 1: Point Your Domain to the VPS

After buying the VPS, you will receive a public IP address.

Option A: Use Cloudflare

1. Add your domain to Cloudflare.
2. Change your domain nameservers to the ones Cloudflare gives you.
3. In Cloudflare DNS, create these records:
   - `A` record for `@` pointing to your VPS IP
   - `A` record for `www` pointing to your VPS IP

Option B: Use your registrar DNS directly

1. Open the DNS management panel where you bought the domain.
2. Create the same two `A` records for `@` and `www`.

Wait for DNS to propagate before continuing.

## Step 2: Log In to the Server

Use Bitvise SSH Client, PuTTY, or any SSH client you prefer.

Login details:

- Host: your VPS IP
- Username: `root`
- Password: the root password from your provider

Once connected, you should see a shell prompt like `root@ubuntu:~#`.

## Step 3: Install aaPanel

Use the current command from the official aaPanel download page. At the time this guide was updated, the free-edition command was:

```bash
URL=https://www.aapanel.com/script/install_panel_en.sh && if [ -f /usr/bin/curl ];then curl -ksSO "$URL" ;else wget --no-check-certificate -O install_panel_en.sh "$URL";fi;bash install_panel_en.sh
```

Installation commands can change. Confirm the command on [the official aaPanel download page](https://www.aapanel.com/new/download.html) before running it on a new server.

After installation finishes, aaPanel will show:

- panel URL
- admin username
- admin password

Save these details before you close the terminal.

## VPS Security Baseline

Before you put VonCMS online, treat the VPS as your responsibility. VonCMS can
protect its own PHP routes, uploads, CSRF, sessions, and admin boundaries, but it
cannot secure an exposed SSH service, aaPanel login, firewall, or operating
system for you.

Minimum production checklist:

- Change the aaPanel password immediately.
- Keep the aaPanel URL private. Do not post screenshots that expose the panel
  address, username, or port.
- Use a strong root password, or preferably SSH keys.
- If you use SSH keys, disable root password login after you confirm key login
  works.
- Keep only required ports open: SSH, HTTP, HTTPS, and the panel port if you
  still need remote panel access.
- Restrict the aaPanel port to your own IP address when your firewall or
  provider panel supports it.
- Keep Ubuntu, Nginx, MySQL, PHP, and aaPanel updated.
- Back up both the database and `uploads/` outside the VPS.
- Do not leave test PHP files, database dumps, ZIP backups, or old installers in
  the web root.

If you manage the firewall with `ufw`, a conservative baseline is:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from YOUR_PUBLIC_IP to any port AAPANEL_PORT proto tcp
ufw enable
ufw status
```

Replace `YOUR_PUBLIC_IP` and `AAPANEL_PORT` first. If your home IP changes often,
use your VPS provider firewall or aaPanel firewall carefully so you do not lock
yourself out. Do not enable a firewall blindly on a production VPS.

## Step 4: Install the Software Stack

Log in to aaPanel and install an LNMP stack.

Recommended versions:

- Nginx 1.24+
- MySQL 8.0
- PHP 8.2+
- phpMyAdmin 5.2
- Pure-FTPD if you want FTP access

Required PHP extensions for VonCMS:

- `pdo_mysql`
- `mbstring`
- `curl`
- `fileinfo`
- `json`
- `gd`
- `zip` or `ZipArchive` for OTA updates and ZIP handling

If your panel image already enables most of these, just verify them before deployment.

## Step 5: Create the Website in aaPanel

1. Open `Website` in aaPanel.
2. Click `Add site`.
3. Enter your domain, for example `example.com`.
4. Create a MySQL database for the site.
5. Save the generated database name, username, and password.

## Step 6: Enable SSL

1. Open your website entry in aaPanel.
2. Go to the `SSL` tab.
3. Choose `Let's Encrypt`.
4. Apply the certificate.

Once SSL is active, open the site with `https://`. After confirming the certificate works, enable `Force HTTPS` for the site in aaPanel. Choose either the root domain or `www` as the canonical hostname and redirect the other hostname to it. The Apache `.htaccess` defaults to non-`www`, but Nginx does not read that rule.

## Step 7: Upload VonCMS

1. Open the `Files` section in aaPanel.
2. Go to your site folder, usually `/www/wwwroot/yourdomain.com`.
3. Delete the default placeholder files such as `index.html` if they exist.
4. Upload the latest VonCMS Deploy package.
5. Extract the ZIP into the site root.

After extraction, your root should contain files such as `index.php`, `.htaccess`, `api/`, `assets/`, and the other deploy files.

The contents of the Deploy ZIP must be placed directly inside the site root. Do not leave VonCMS inside an additional nested folder.

Correct:

```text
/www/wwwroot/example.com/index.php
/www/wwwroot/example.com/api/
/www/wwwroot/example.com/assets/
```

Incorrect:

```text
/www/wwwroot/example.com/VonCMS_Deploy/index.php
```

Confirm that the extracted files are owned by the website or PHP-FPM user configured by aaPanel. Correct `644` and `755` modes are not enough if PHP-FPM cannot write the configuration, lock, uploads, logs, backups, and OTA files it owns.

Do not set the website or `uploads/` directory to `777`.

## Step 8: Add Nginx-Only Rewrite and Protection Rules

VonCMS ships three Apache/LiteSpeed protection layers:

- root `.htaccess`
- `uploads/.htaccess`
- `data/.htaccess`

Apache and LiteSpeed Enterprise users can skip this step after confirming that `.htaccess` is enabled. OpenLiteSpeed users must not paste the Nginx `location` blocks below; configure equivalent virtual-host rules instead and run the security audit in Step 11.

Nginx does not read any of the shipped `.htaccess` files. Complete this step before opening the VonCMS installer. Without these rules, the homepage might appear to work while `/install`, clean permalinks, or protected files behave incorrectly.

The following rules reproduce the required routing and essential file protection for an Nginx-only site.

Open the site configuration in aaPanel. Put these rules inside the same `server {}` block as the website and before the PHP-FPM handler that aaPanel generates, such as:

```nginx
include enable-php-82.conf;
```

The generated include name may differ depending on the selected PHP version. Keep aaPanel's handler unchanged.

> **Path scope:** The block below assumes VonCMS is installed at the website root. It works unchanged for a root domain such as `example.com` and a dedicated subdomain such as `news.example.com`. For a subfolder such as `example.com/blog`, every exact, prefix, and regex URI must be scoped to `/blog`, and the SPA fallback must target `/blog/index.php`. A dedicated domain or subdomain is the safer aaPanel setup for beginners.

For an intentional `/blog` installation:

- extract the Deploy ZIP into `/www/wwwroot/example.com/blog`
- change `/index.html`, `/api/`, `/data`, `/uploads/`, and `/von_config.php` matches below to their `/blog/...` equivalents
- change helper regex anchors from `^/api/` to `^/blog/api/`
- scope the sensitive-extension regex to `^/blog/.*\.(sql|md|json|log|bak|env|zip|lock)$` so it does not alter a sibling application
- change the SPA fallback to `location /blog/ { try_files $uri $uri/ /blog/index.php?$query_string; }`
- change the static cache regex later in this guide from `^/(assets|fonts)/` to `^/blog/(assets|fonts)/`
- use `DOMAIN="https://example.com/blog"` and `WEBROOT="/www/wwwroot/example.com/blog"` in the audit script

Do not paste both the root and subfolder `location` blocks into the same site configuration. If aaPanel already defines a matching `location`, merge or replace it instead of creating a duplicate.

```nginx
# Prefer index.php when both files exist.
index index.php index.html;

# Server-wide security baseline. Add HSTS only after HTTPS works.
server_tokens off;
fastcgi_hide_header X-Powered-By;
add_header Strict-Transport-Security "max-age=31536000" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;

# Route direct index.html requests through PHP hydration.
location = /index.html {
    rewrite ^ /index.php last;
}

# This is intentional: index.html is the static build shell, while index.php
# owns canonical redirects, server-rendered metadata, installer routing, and
# HTTP status handling before React starts.

# Hide the internal public cache directory.
location = /api/public-cache {
    return 404;
}

location ^~ /api/public-cache/ {
    return 404;
}

# Block all direct access to runtime data.
location = /data {
    deny all;
}

location ^~ /data/ {
    deny all;
}

# Protect temporary WordPress import files completely.
location ^~ /uploads/temp/ {
    deny all;
}

# Protect uploaded media. The ^~ prefix prevents files under uploads/
# from reaching the server-level PHP-FPM regex handler.
location ^~ /uploads/ {
    # Repeat hidden and sensitive-file checks because ^~ intentionally
    # skips server-level regex locations.
    location ~ /\.(?!well-known) {
        deny all;
    }

    location ~* \.(sql|md|json|xml|log|bak|env|zip|lock|ini|conf|inc|phar)$ {
        deny all;
    }

    # Block executable and script-like files.
    location ~* \.(php|php3|php4|php5|phtml|pl|py|jsp|asp|htm|html|shtml|sh|cgi|js|exe)$ {
        deny all;
    }

    # Conservative browser cache for public uploaded images.
    location ~* \.(jpg|jpeg|png|gif|webp|avif|svg|ico)$ {
        expires 7d;
        try_files $uri =404;
    }

    # Serve only files that really exist.
    try_files $uri =404;
}

# Block internal API helper files. These regex blocks must appear before
# aaPanel's generic PHP-FPM regex handler.
location ~* ^/api/(content_audit_helper|ImageProcessor|mail_helper|media_library_filter_helper|public_cache_helper|redirect_loop_helper|settings_audit_helper)\.php$ {
    deny all;
}

location ~* ^/api/(system/IndexNow|security/SecurityLogger)\.php$ {
    deny all;
}

# Existing API files continue to the normal PHP-FPM handler.
# Missing non-PHP API paths return 404.
location /api/ {
    try_files $uri =404;
}

# Mirror sensitive-file protection from the root .htaccess.
location ~* \.(sql|md|json|log|bak|env|zip|lock)$ {
    deny all;
}

location = /von_config.php {
    deny all;
}

location = /composer.lock {
    deny all;
}

location = /package.json {
    deny all;
}

# Block hidden files while allowing ACME validation.
location ~ /\.(?!well-known) {
    deny all;
}

# Serve existing files and directories, then fall back to VonCMS.
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
```

Important:

- Keep the PHP handler generated by aaPanel.
- Do not hardcode a PHP socket unless you manage the complete Nginx configuration yourself.
- Confirm the PHP handler contains a missing-file check such as `try_files $uri =404;`.
- Do not add a broad regex `location` for `/api/` or `/admin` merely to attach cache headers. It can override PHP handling and expose PHP source as plain text.
- If you add another `add_header` inside a child location, Nginx may stop inheriting the server-level headers. Repeat the required headers there or avoid the child `add_header`.
- The `/index.html` rewrite is intentional, not a fallback mistake. VonCMS sends the static build shell through `index.php` so canonical redirects, server-rendered metadata, installer routing, and HTTP status handling run before React starts. Direct `/index.php` and `/index.html` requests are then canonicalized to `/` after installation.
- Keep the `/uploads/temp/` rule above the broader `/uploads/` rule.
- VonCMS Integrity Fix repairs the Apache/LiteSpeed managed block. It does not edit Nginx configuration.

Test before reloading:

```bash
nginx -t
```

Reload Nginx only after the test succeeds. You may use aaPanel's reload button if aaPanel manages a custom Nginx installation.

## Step 9: Run the Installer

Run the installer only after Step 8 passes `nginx -t` and Nginx has been reloaded. Open the clean base URL, not `index.php` or `index.html`:

- root domain: `https://example.com/`
- dedicated subdomain: `https://news.example.com/`
- subfolder installation: `https://example.com/blog/`

The first request follows this path:

1. Nginx receives the clean base URL.
2. The `index` or `try_files` rule sends the request to the VonCMS `index.php` front controller through the existing PHP-FPM handler.
3. VonCMS detects that `von_config.php` is missing and redirects to `/install`, or `/blog/install` for a subfolder installation.
4. `/install` is a clean application route rather than a physical directory. The Nginx SPA fallback sends it to `index.php`, which renders the installer.

The Domain URL is derived from the request, so it does not need a separate installer field.

Direct index requests are cleaned automatically:

- `/index.php` returns a `301` redirect to `/`
- `/index.html` is routed through PHP and then returns a `301` redirect to `/`
- `/blog/index.php` and `/blog/index.html` return a `301` redirect to `/blog/` when VonCMS is installed in that subfolder

After installation, the same SPA fallback handles clean URLs such as `/login`, `/profile/name`, and post permalinks without exposing `index.php` in the browser address bar.

Fill in:

- database host, usually `localhost`
- database name, user, and password from Step 5
- site name
- admin username
- admin email
- admin password

The admin password must be at least 8 characters and include an uppercase letter, a number, and one special character from `!@#$%^&*(),.?":{}|<>`. For example, `MyPass1!`. Weak passwords are rejected by the installer.

Complete the installation. VonCMS writes `von_config.php` and `install.lock` automatically. Direct installation attempts are blocked after both files exist.

Sign in at `/admin`.

## Step 10: Post-Install Checks

Check these before you call the deployment done:

- Homepage loads
- Admin login works
- Settings can be saved
- `robots.txt` opens
- `sitemap.xml` opens
- `rss.xml` opens
- One article page opens without 404
- A missing file under `uploads/` returns 404
- Direct access to `data/`, `von_config.php`, `install.lock`, package files, and internal helper PHP files is denied
- PHP files under `uploads/` are denied and never reach PHP-FPM
- Direct `/index.php` and `/index.html` requests redirect once to the canonical `/` URL

### Automated Web Server Security Audit

Run this after replacing `DOMAIN` and `WEBROOT`. The same audit can verify Apache, LiteSpeed Enterprise, OpenLiteSpeed, or Nginx after that server has been configured. It creates one temporary PHP file under `uploads/`, requests it once, and removes it automatically.

```bash
DOMAIN="https://example.com"
WEBROOT="/www/wwwroot/example.com"

failures=0

check_code() {
    path="$1"
    expected="$2"
    code="$(curl -sS -o /dev/null -w "%{http_code}" "${DOMAIN}${path}")"

    if [ "$code" = "$expected" ]; then
        printf "PASS  %-58s %s\n" "$path" "$code"
    else
        printf "FAIL  %-58s expected %s, received %s\n" "$path" "$expected" "$code"
        failures=$((failures + 1))
    fi
}

# Normal public and PHP-FPM paths.
check_code "/" 200
check_code "/api/get_settings.php" 200
check_code "/index.php" 301
check_code "/index.html" 301

# Internal helper files must be stopped by Nginx before PHP-FPM.
for path in \
    "/api/content_audit_helper.php" \
    "/api/ImageProcessor.php" \
    "/api/mail_helper.php" \
    "/api/media_library_filter_helper.php" \
    "/api/public_cache_helper.php" \
    "/api/redirect_loop_helper.php" \
    "/api/settings_audit_helper.php" \
    "/api/system/IndexNow.php" \
    "/api/security/SecurityLogger.php" \
    "/von_config.php" \
    "/install.lock" \
    "/data/" \
    "/package.json" \
    "/.git/config"
do
    check_code "$path" 403
done

# Concealed runtime paths and missing public media.
check_code "/api/public-cache/test.json" 404
check_code "/uploads/missing.jpg" 404

# Critical execution test.
umask 077
test_name="sec_test_$(date +%s)_$$.php"
test_file="${WEBROOT}/uploads/${test_name}"
response_file="$(mktemp)"

cleanup() {
    rm -f -- "$test_file" "$response_file"
}
trap cleanup EXIT INT TERM

printf '%s\n' '<?php echo "VULNERABLE"; ?>' > "$test_file"
upload_code="$(curl -sS -o "$response_file" -w "%{http_code}" "${DOMAIN}/uploads/${test_name}")"

if grep -q "VULNERABLE" "$response_file"; then
    printf "CRITICAL  /uploads/%s executed as PHP\n" "$test_name"
    failures=$((failures + 1))
elif [ "$upload_code" != "403" ]; then
    printf "FAIL  /uploads/%s expected 403, received %s\n" "$test_name" "$upload_code"
    failures=$((failures + 1))
else
    printf "PASS  /uploads/%s blocked without execution (403)\n" "$test_name"
fi

cleanup
trap - EXIT INT TERM

if [ "$failures" -ne 0 ]; then
    printf "\nAudit failed with %s problem(s).\n" "$failures"
    exit 1
fi

printf "\nAll VonCMS web server checks passed.\n"
```

With the correct configuration for the selected web server, protected helper/configuration paths return `403`, deliberately concealed public-cache paths return `404`, and normal public/API paths return `200`. Any `200` from a protected helper, configuration, or data path is a security gap. If the uploads test body contains `VULNERABLE`, disable public access immediately because PHP is executing inside `uploads/`.

If you later change the PHP version or handler rules in aaPanel, run `nginx -t` and repeat this audit. VonCMS Integrity Fix does not edit Nginx configuration.

## Common Problems

### Installer does not load

Check:

- DNS has propagated
- SSL is active if you force HTTPS
- Nginx rewrite rules are present
- PHP 8.2+ is selected
- PHP-FPM can write `von_config.php` and `install.lock`
- The extracted files have the correct owner
- The Deploy ZIP contents are directly inside the site root

### API returns 404 on VPS

Check:

- The requested API file exists
- aaPanel's generic PHP-FPM handler is still present
- The VonCMS rules are inside the same `server {}` block
- The PHP handler contains `try_files $uri =404;`
- The request is not matching a broad cache regex

### PHP source appears as plain text

Immediately disable public access to the site and inspect the Nginx configuration. A `.php` file is being served as a static file instead of being passed to PHP-FPM.

Remove broad blocks such as:

```nginx
location ~* ^/(api|admin)(/|$) {
    try_files $uri $uri/ /index.php?$query_string;
}
```

Keep the normal PHP-FPM handler generated by aaPanel.

### Sensitive files are downloadable on VPS

Nginx is not using the VonCMS `.htaccess` rules. Re-check Step 8 and confirm:

- Every deny rule is inside the same `server {}` block
- Protected helper regex rules appear before the generic PHP-FPM regex handler
- Nginx was reloaded only after `nginx -t` succeeded
- No second website configuration is serving the same hostname

### PHP scripts in uploads are executing

Use the exact `location ^~ /uploads/` block from Step 8. The `^~` prefix prevents requests under `uploads/` from falling through to the server-level PHP-FPM regex handler. Do not create another PHP handler inside that location.

### Uploads fail

Check:

- `fileinfo` is enabled
- `gd` is enabled
- PHP upload limits are large enough
- The website or PHP-FPM user can write to `uploads/`
- directories use `755`
- files use `644`

If manually uploaded images use mode `600`, repair files and directories separately:

```bash
find uploads/ -type f -exec chmod 644 {} +
find uploads/ -type d -exec chmod 755 {} +
```

Do not run `chmod -R 755 uploads/`; it marks ordinary uploaded files as executable. Do not use `777`.

### Permission modes look correct but writing still fails

Check ownership:

```bash
ls -la
ls -la uploads
ls -la data
```

The owner and group must match the website or PHP-FPM user. Do not copy a random `chown` command from another server because aaPanel users can differ between installations.

### OTA updater reports that ZipArchive is missing

Enable the PHP `zip` extension for the same PHP version used by the website, then reload that PHP-FPM service. Command-line PHP can use a different configuration, so verify the extension inside aaPanel too.

### White page or 500 error

Check:

- Nginx error log
- PHP error log in aaPanel
- database credentials in `von_config.php`
- ownership and write permissions
- the selected PHP-FPM service is running
- all required PHP extensions are enabled

## After Install

After the site is live:

- Re-check the VPS Security Baseline
- Confirm database and `uploads/` backups are running
- Remove temporary files from the web root
- Repeat the audit after changing PHP-FPM or Nginx rules
- Keep Deploy ZIP files and checksums outside the public web root
- Keep Ubuntu, Nginx, MySQL, PHP, and aaPanel updated

Optional static cache, CDN, compression, and LiteSpeed tuning belongs at the
server/CDN layer. It is not required for a normal VonCMS install.

## Server Tuning

VonCMS already has a lightweight guest JSON cache for public post lists and
public settings. If you want more performance on a VPS, dedicated server, CDN,
or LiteSpeed host, tune static delivery first instead of adding full-page cache
logic to the CMS core.

### Safe Cache Targets

Safe targets to cache at the server/CDN layer:

- `assets/` build files, because Vite filenames are hashed when they change.
- `fonts/` files, because bundled web fonts are static release assets.
- `uploads/` media, because uploaded file names are generated and normally do
  not change in place.
- image variants generated for public media.

Do **not** aggressively cache these by default:

- `/admin` and all authenticated admin routes
- `/api/` endpoints
- `index.php` and normal HTML responses
- `robots.txt`, `sitemap.xml`, `rss.xml`, and `llms.txt`
- `von_config.php`, backup files, SQL files, logs, ZIP files, or helper PHP
  files

### Nginx Static Cache Example

The Step 8 `uploads/` block already contains conservative image caching. Its `expires` directive creates the `Cache-Control` header, so do not add a second uploads regex or another `Cache-Control` header.

Add only the static build cache inside the same `server {}` block, after the protection rules and before the PHP-FPM include:

```nginx
location ~* ^/(assets|fonts)/.+\.(css|js|woff2?|ttf|otf|eot|svg)$ {
    expires 30d;
    try_files $uri =404;
}
```

Do not create a separate regex block for `/api/` or `/admin` merely to add `Cache-Control`. Keep those routes on the normal VonCMS/PHP-FPM path and bypass them at the CDN layer.

### Cloudflare Or CDN Cache

Use CDN caching for static files first:

- cache `assets/*`
- cache `fonts/*`
- cache `uploads/*`
- bypass `api/*`
- bypass `admin/*`
- do not enable "Cache Everything" for the whole site unless you fully test
  login, comments, previews, scheduled posts, and SEO metadata

Cloudflare can also serve Brotli (`br`) compression at the edge even when the
VonCMS `.htaccess` baseline only enables gzip. That is normal. Compression and
static caching are server/CDN responsibilities; VonCMS only ships the safe
portable baseline.

### LiteSpeed Cache Notes

On LiteSpeed hosting, start with static file/browser cache and compression.
Avoid turning on full-page cache globally until you have tested:

- admin login stays private
- `/api/` responses are not cached
- post updates purge or refresh correctly
- category/search pages do not show stale results for too long
- comments, ads, popups, and scheduled posts still behave correctly

The WordPress LiteSpeed Cache plugin is more complex because it controls
WordPress hooks, purge events, fragments, and page-cache behavior. VonCMS does
not need that complexity by default; server-side static cache plus the built-in
guest JSON cache is the safer baseline.

## Scaling Guidance

VonCMS is designed to run efficiently across hosting tiers with the right indexes in place. The bottleneck is almost always **missing indexes + shared hosting physics**, not row count.

### Hosting Tier Recommendations

| Scale                | Hosting type     | Spec                           | Notes                                                                                                                                                                                                                                        |
| -------------------- | ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **< 5k - 10k posts** | Shared hosting   | Default shared plan            | Indexes eliminate table scans - the real bottleneck on shared I/O. VonCMS caps admin bulk requests at 200 items for safety. Actual capacity depends on your host's resource sharing - these are directional estimates, not a guaranteed SLA. |
| **10k - 100k posts** | VPS (high-end)   | 8-16GB RAM, 4-8 vCPU, NVMe SSD | Index fits in InnoDB buffer pool. No drama for normal publishing traffic. Set `innodb_buffer_pool_size` to 50-70% of available RAM.                                                                                                          |
| **100k - 1M+ posts** | Dedicated server | 32GB+ RAM, 8+ cores, NVMe      | InnoDB handles 1M rows as a small table. PDO + proper indexes = solid foundation. Beyond 1M rows or millions of concurrent hits, consider partitioning.                                                                                      |

### MySQL Tuning for Scale

On VPS or dedicated servers, adjust these in `/etc/mysql/my.cnf` or via aaPanel:

- `innodb_buffer_pool_size` - set to 50-70% of available RAM. This keeps indexes in memory and eliminates disk reads for most queries.
- `innodb_log_file_size` - 256M or higher for write-heavy workloads (frequent publishing, imports).
- `ft_min_word_len` - default is 4. Lower to 3 if you need shorter keyword matching in FULLTEXT search (requires rebuild: `REPAIR TABLE posts QUICK`).
- `max_connections` - default 151. Increase if you expect high concurrent traffic, but monitor RAM usage per connection.

### Why Indexes Matter Most

Without indexes, a search like `LIKE '%keyword%'` scans every row in the table. On shared hosting with 5k posts, this already feels slow because:

1. Table scan = read every row, every query
2. Shared I/O = disk reads queue behind other tenants
3. CPU/RAM limits = no buffer pool caching to compensate

With proper indexes (`FULLTEXT`, `idx_slug`, `idx_status`, etc.), the same search becomes an **index lookup** - logarithmic reads instead of linear scans. On a VPS with NVMe and enough RAM for buffer pool, the index sits in memory and the query returns in milliseconds.

**TL;DR:** Fix indexes first. Upgrade hosting second. Most "slow CMS" problems are missing indexes, not insufficient hardware.

Once these checks pass, your VPS deployment is ready.
