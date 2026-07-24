# VPS Deployment Guide
This guide is for users who are comfortable with cPanel or shared hosting and want to run VonCMS on a VPS without getting lost in server jargon.

Recommended default: VonCMS is designed for LAMP: Linux, Apache, MySQL, PHP. This guide uses LNMP with Nginx for VPS users who prefer it, but Nginx does not read .htaccess, so the rewrite and protection rules in Step 8 are required. If you want the simplest path, install Apache instead of Nginx.

The stack used in this guide:

Ubuntu 24.04 LTS or 22.04 LTS
aaPanel
Nginx
MySQL 8.0
PHP 8.2+
Latest VonCMS Deploy package

## Before You Start
Prepare these first:

A VPS with at least 1 vCPU, 1 GB RAM, and 25 GB SSD
A domain name
SSH access from your provider
The latest VonCMS Deploy package

If your audience is in Malaysia or ASEAN, choose a Singapore region when possible. It usually gives better latency than US or Europe.

## Step 1: Point Your Domain to the VPS
After buying the VPS, you will receive a public IP address.

Option A: Use Cloudflare

Add your domain to Cloudflare.
Change your domain nameservers to the ones Cloudflare gives you.
In Cloudflare DNS, create these records:
A record for @ pointing to your VPS IP
A record for www pointing to your VPS IP

Option B: Use your registrar DNS directly

Open the DNS management panel where you bought the domain.
Create the same two A records for @ and www.
Wait for DNS to propagate before continuing.

## Step 2: Log In to the Server
Use Bitvise SSH Client, PuTTY, or any SSH client you prefer.

Login details:

Host: your VPS IP
Username: root
Password: the root password from your provider

Once connected, you should see a shell prompt like root@ubuntu:~#.

## Step 3: Install aaPanel
Run this command on the server:

```
URL=https://www.aapanel.com/script/install_panel_en.sh && if [ -f /usr/bin/curl ];then curl -ksSO $URL ;else wget --no-check-certificate -O install_panel_en.sh $URL;fi;bash install_panel_en.sh forum
```

After installation finishes, aaPanel will show:

panel URL
admin username
admin password

Save these details before you close the terminal.

## VPS Security Baseline
Before you put VonCMS online, treat the VPS as your responsibility. VonCMS can protect its own PHP routes, uploads, CSRF, sessions, and admin boundaries, but it cannot secure an exposed SSH service, aaPanel login, firewall, or operating system for you.

Minimum production checklist:

Change the aaPanel password immediately.
Keep the aaPanel URL private. Do not post screenshots that expose the panel address, username, or port.
Use a strong root password, or preferably SSH keys.
If you use SSH keys, disable root password login after you confirm key login works.
Keep only required ports open: SSH, HTTP, HTTPS, and the panel port if you still need remote panel access.
Restrict the aaPanel port to your own IP address when your firewall or provider panel supports it.
Keep Ubuntu, Nginx, MySQL, PHP, and aaPanel updated.
Back up both the database and uploads/ outside the VPS.
Do not leave test PHP files, database dumps, ZIP backups, or old installers in the web root.

If you manage the firewall with ufw, a conservative baseline is:

```
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from YOUR_PUBLIC_IP to any port AAPANEL_PORT proto tcp
ufw enable
ufw status
```

Replace YOUR_PUBLIC_IP and AAPANEL_PORT first. If your home IP changes often, use your VPS provider firewall or aaPanel firewall carefully so you do not lock yourself out. Do not enable a firewall blindly on a production VPS.

## Step 4: Install the Software Stack
Log in to aaPanel and install an LNMP stack.

Recommended versions:

Nginx 1.24+
MySQL 8.0
PHP 8.2+
phpMyAdmin 5.2
Pure-FTPD if you want FTP access

Required PHP extensions for VonCMS:

pdo_mysql
mbstring
curl
fileinfo
json
gd
zip or ZipArchive for OTA updates and ZIP handling

If your panel image already enables most of these, just verify them before deployment.

## Step 5: Create the Website in aaPanel
Open Website in aaPanel.
Click Add site.
Enter your domain, for example example.com.
Create a MySQL database for the site.
Save the generated database name, username, and password.

## Step 6: Enable SSL
Open your website entry in aaPanel.
Go to the SSL tab.
Choose Let's Encrypt.
Apply the certificate.
Once SSL is active, open the site with https://. After confirming the certificate works, enable Force HTTPS for the site in aaPanel. Choose either the root domain or www as the canonical hostname and redirect the other hostname to it. The Apache .htaccess defaults to non-www, but Nginx does not read that rule.

## Step 7: Upload VonCMS
Open the Files section in aaPanel.
Go to your site folder, usually /www/wwwroot/yourdomain.com.
Delete the default placeholder files such as index.html if they exist.
Upload the latest VonCMS Deploy package.
Extract the ZIP into the site root.

After extraction, your root should contain files such as index.php, .htaccess, api/, assets/, data/, uploads/, and the other deploy files.

The contents of the Deploy ZIP must be placed directly inside the site root. Do not leave VonCMS inside an additional nested folder.

Correct example:

```text
/www/wwwroot/example.com/index.php
/www/wwwroot/example.com/api/
/www/wwwroot/example.com/assets/
```

Incorrect example:

```text
/www/wwwroot/example.com/VonCMS_Deploy/index.php
```

Confirm that the extracted files are owned by the website or PHP-FPM user configured by aaPanel. Correct 644 and 755 modes are not enough if PHP-FPM cannot write to files or directories required by the installer, uploads, logs, backups, and OTA updater.

Do not set the website or uploads/ directory to 777.

## Step 8: Add Nginx Rewrite and Protection Rules
VonCMS ships three layers of Apache/LiteSpeed protection:

- the root .htaccess
- uploads/.htaccess
- data/.htaccess

Nginx does not read any of these files. The following rules reproduce the required routing and essential file protection for an Nginx-only site.

Open the site config in aaPanel. Put these rules inside the same server {} block as the website and before the PHP-FPM handler block that aaPanel generates, such as:

```nginx
include enable-php-82.conf;
```

The generated include name may be different depending on the PHP version selected for the website. Keep aaPanel's PHP-FPM handler unchanged.

```nginx
# Prefer index.php when both index.php and index.html exist.
index index.php index.html;

# Mirror the security headers from the Apache/LiteSpeed baseline.
server_tokens off;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;

# Route direct index.html requests through PHP hydration.
location = /index.html {
    rewrite ^ /index.php last;
}

# Hide the internal public cache directory.
location = /api/public-cache {
    return 404;
}

location ^~ /api/public-cache/ {
    return 404;
}

# Block all direct access to data/.
location = /data {
    deny all;
}

location ^~ /data/ {
    deny all;
}

# Protect uploaded media.
# The ^~ prefix prevents requests under uploads/ from reaching PHP-FPM.
location ^~ /uploads/ {
    # Block executable and script-like files.
    location ~* \.(php|php3|php4|php5|phtml|pl|py|jsp|asp|htm|html|shtml|sh|cgi|js|exe)$ {
        deny all;
    }

    # Optional browser cache for public uploaded images.
    location ~* \.(jpg|jpeg|png|gif|webp|avif|svg|ico)$ {
        expires 7d;
        try_files $uri =404;
    }

    # Serve only files that really exist.
    try_files $uri =404;
}

# Block internal API helper files.
# These regex blocks must appear before the generic PHP-FPM regex handler.
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

# Mirror sensitive file protection from the root .htaccess.
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

Important notes:

- Keep the PHP handler block generated by aaPanel.
- These rules do not replace PHP-FPM handling.
- Do not hardcode a PHP socket unless you manage the complete Nginx config yourself.
- Confirm the PHP handler contains a missing file check such as `try_files $uri =404;`.
- Do not add a broad regex location for `/api/` or `/admin` just to attach cache headers.
- A broad `/api|admin` regex can override PHP handling and may serve PHP source as plain text.
- Security headers are declared at server level with `always` so they also cover static and error responses. If you add another `add_header` inside a child location, Nginx may stop inheriting the server-level headers, so repeat them there or avoid the child `add_header`.
- The `/index.html` rule is intentional. It keeps direct index.html requests on the same PHP hydration path as Apache/LiteSpeed.
- VonCMS Integrity Fix repairs the Apache/LiteSpeed managed block. It does not edit Nginx configuration.

Test the configuration before reloading Nginx:

```bash
nginx -t
```

Reload Nginx only after the configuration test succeeds. You may use aaPanel's reload button if aaPanel manages a custom Nginx installation.

## Step 9: Run the Installer
Open your domain in the browser. The installer will appear automatically - VonCMS detects that von_config.php is missing and redirects to /install. The domain URL is auto-detected from your request; you do not need to enter it manually.

Fill in the following fields:

- **Database host** - usually localhost
- **Database name** - from Step 5
- **Database user** - from Step 5
- **Database password** - from Step 5
- **Site name** - the display name for your site
- **Admin username**
- **Admin email**
- **Admin password**

> **Password requirement:** The admin password must be at least 8 characters and include one uppercase letter, one number, and one special character from `!@#$%^&*(),.?":{}|<>`. Example: `MyPass1!`. Weak passwords will be rejected by the installer.

Complete the install. VonCMS writes von_config.php and creates an install.lock file automatically. Direct access to /install is blocked once these files exist.

Sign in at /admin.

## Step 10: Post-Install Checks
Check these before you call the deployment done:

- Homepage loads
- Admin login works
- Settings can be saved
- robots.txt opens
- sitemap.xml opens
- rss.xml opens
- One article page opens without 404
- A missing file under uploads/ returns 404
- Direct access to data/, von_config.php, and install.lock is denied
- PHP files under uploads/ are denied and never reach PHP-FPM

Optional command line checks:

```bash
curl -I https://example.com/
curl -I https://example.com/install
curl -I https://example.com/robots.txt
curl -I https://example.com/sitemap.xml
curl -I https://example.com/uploads/missing.jpg
curl -I https://example.com/data/
curl -I https://example.com/von_config.php
curl -I https://example.com/install.lock
curl -I https://example.com/api/public-cache/test.json
```

Expected protection results:

```text
/uploads/missing.jpg             404
/data/                           403 or 404
/von_config.php                  403 or 404
/install.lock                    403 or 404
/api/public-cache/test.json      404
```

If you later change the PHP version or handler rules in the panel, re-check the Nginx configuration manually. VonCMS Integrity Fix does not edit Nginx configuration.

## Common Problems

### Installer does not load
Check:

- DNS has propagated
- SSL is active if you force HTTPS
- Nginx rewrite rules are present
- PHP 8.2+ is selected
- PHP-FPM can write von_config.php and install.lock
- The site files have the correct owner
- The Deploy ZIP contents are directly inside the site root

### API returns 404 on VPS
Check:

- The requested API file exists
- The generic PHP-FPM handler is still present
- The VonCMS rules are inside the same server {} block
- The PHP handler contains `try_files $uri =404;`
- The request is not matching a broad cache regex

### PHP source appears as plain text
Immediately disable public access to the site and inspect the Nginx configuration.

This usually means a location block is serving a .php file as a normal static file instead of passing it to PHP-FPM.

Remove broad blocks similar to:

```nginx
location ~* ^/(api|admin)(/|$) {
    try_files $uri $uri/ /index.php?$query_string;
}
```

Keep the normal PHP-FPM handler generated by aaPanel.

### Sensitive files are downloadable on VPS
Nginx does not use the VonCMS .htaccess files. Re-check Step 8 and confirm:

- All deny rules are inside the same server {} block
- Protected API regex rules appear before the generic PHP-FPM regex handler
- Nginx was reloaded after the config test succeeded
- No second website config is serving the same domain

### PHP scripts in uploads/ are executing
Use the exact `location ^~ /uploads/` block shown in Step 8.

The `^~` prefix prevents requests under uploads/ from falling through to the PHP-FPM regex handler. Do not create another PHP handler inside the uploads/ location.

### Uploads fail
Check:

- fileinfo is enabled
- gd is enabled
- PHP upload limits are large enough
- The website or PHP-FPM user can write to uploads/
- Directories use 755
- Files use 644

If images appear broken because manually uploaded files use mode 600, repair the modes without making files executable:

```bash
find uploads/ -type f -exec chmod 644 {} +
find uploads/ -type d -exec chmod 755 {} +
```

Do not use:

```bash
chmod -R 755 uploads/
```

The command above makes normal uploaded files executable. Do not use 777.

### Permission modes look correct but writing still fails
Check ownership:

```bash
ls -la
ls -la uploads
ls -la data
```

The owner and group must match the user used by the website or PHP-FPM configuration. Do not copy a random chown command from another server because aaPanel users can differ between installations.

### OTA updater reports that ZipArchive is missing
Enable the PHP zip extension for the same PHP version used by the website. Restart or reload that PHP-FPM service after enabling it.

The command line PHP version may differ from the website PHP version, so verify the extension inside aaPanel too.

### White page or 500 error
Check:

- Nginx error log
- PHP error log in aaPanel
- Database credentials in von_config.php
- Ownership and write permissions
- Whether the selected PHP-FPM service is running
- Whether all required PHP extensions are enabled

## After Install
After the site is live:

- Re-check the VPS Security Baseline
- Confirm database and uploads/ backups are running
- Remove temporary files from the web root
- Re-check Nginx after changing the PHP version or PHP-FPM handler
- Keep the Deploy ZIP and checksum outside the public web root
- Keep Ubuntu, Nginx, MySQL, PHP, and aaPanel updated

Optional static cache, CDN, compression, and LiteSpeed tuning belongs at the server or CDN layer. It is not required for a normal VonCMS install.

## Server Tuning
VonCMS already has a lightweight guest JSON cache for public post lists and public settings. If you want more performance on a VPS, dedicated server, CDN, or LiteSpeed host, tune static delivery first instead of adding full-page cache logic to the CMS core.

### Safe Cache Targets
Safe targets to cache at the server/CDN layer:

assets/ build files, because Vite filenames are hashed when they change.
fonts/ files, because bundled web fonts are static release assets.
uploads/ media, because uploaded file names are generated and normally do not change in place.
image variants generated for public media.

Do not aggressively cache these by default:

/admin and all authenticated admin routes
/api/ endpoints
index.php and normal HTML responses
robots.txt, sitemap.xml, rss.xml, and llms.txt
von_config.php, backup files, SQL files, logs, ZIP files, or helper PHP files

### Nginx Static Cache Example
The Step 8 uploads/ block already contains conservative caching for public uploaded images. The expires directive generates the Cache-Control header, so do not add a second Cache-Control header in the same location.

Add only the static build cache below inside the same server {} block, after the protection rules and before the PHP-FPM include:

```nginx
location ~* ^/(assets|fonts)/.+\.(css|js|woff2?|ttf|otf|eot|svg)$ {
    expires 30d;
    try_files $uri =404;
}
```

Do not create a separate regex block for `/api/` or `/admin` just to add Cache-Control. Keep those routes on the normal VonCMS and PHP-FPM path, then bypass them at the CDN layer.

### Cloudflare Or CDN Cache
Use CDN caching for static files first:

cache assets/*
cache fonts/*
cache uploads/*
bypass api/*
bypass admin/*
do not enable "Cache Everything" for the whole site unless you fully test login, comments, previews, scheduled posts, and SEO metadata

Cloudflare can also serve Brotli (br) compression at the edge even when the VonCMS .htaccess baseline only enables gzip. That is normal. Compression and static caching are server/CDN responsibilities; VonCMS only ships the safe portable baseline.

### LiteSpeed Cache Notes
On LiteSpeed hosting, start with static file/browser cache and compression. Avoid turning on full-page cache globally until you have tested:

admin login stays private
/api/ responses are not cached
post updates purge or refresh correctly
category/search pages do not show stale results for too long
comments, ads, popups, and scheduled posts still behave correctly

The WordPress LiteSpeed Cache plugin is more complex because it controls WordPress hooks, purge events, fragments, and page-cache behavior. VonCMS does not need that complexity by default; server-side static cache plus the built-in guest JSON cache is the safer baseline.

## Scaling Guidance
VonCMS is designed to run efficiently across hosting tiers with the right indexes in place. The bottleneck is almost always missing indexes + shared hosting physics, not row count.

### Hosting Tier Recommendations

| Scale | Hosting type | Spec | Notes |
|---|---|---|---|
| < 5k - 10k posts | Shared hosting | Default shared plan | Indexes eliminate table scans the real bottleneck on shared I/O. VonCMS caps admin bulk requests at 200 items for safety. Actual capacity depends on your host's resource sharing these are directional estimates, not a guaranteed SLA. |
| 10k - 100k posts | VPS (high-end) | 8-16GB RAM, 4-8 vCPU, NVMe SSD | Index fits in InnoDB buffer pool. No drama for normal publishing traffic. Set innodb_buffer_pool_size to 50-70% of available RAM. |
| 100k - 1M+ posts | Dedicated server | 32GB+ RAM, 8+ cores, NVMe | InnoDB handles 1M rows as a small table. PDO + proper indexes = solid foundation. Beyond 1M rows or millions of concurrent hits, consider partitioning. |

### MySQL Tuning for Scale
On VPS or dedicated servers, adjust these in /etc/mysql/my.cnf or via aaPanel:

innodb_buffer_pool_size - set to 50-70% of available RAM. This keeps indexes in memory and eliminates disk reads for most queries.
innodb_log_file_size - 256M or higher for write-heavy workloads (frequent publishing, imports).
ft_min_word_len - default is 4. Lower to 3 if you need shorter keyword matching in FULLTEXT search (requires rebuild: REPAIR TABLE posts QUICK).
max_connections - default 151. Increase if you expect high concurrent traffic, but monitor RAM usage per connection.

### Why Indexes Matter Most
Without indexes, a search like LIKE '%keyword%' scans every row in the table. On shared hosting with 5k posts, this already feels slow because:

Table scan = read every row, every query
Shared I/O = disk reads queue behind other tenants
CPU/RAM limits = no buffer pool caching to compensate

With proper indexes (FULLTEXT, idx_slug, idx_status, etc.), the same search becomes an index lookup logarithmic reads instead of linear scans. On a VPS with NVMe and enough RAM for buffer pool, the index sits in memory and the query returns in milliseconds.

TL;DR: Fix indexes first. Upgrade hosting second. Most "slow CMS" problems are missing indexes, not insufficient hardware.

Once these checks pass, your VPS deployment is ready.
