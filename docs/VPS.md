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
URL=https://www.aapanel.com/script/install_panel_en.sh && if [ -f /usr/bin/curl ];then curl -ksSO $URL ;else wget --no-check-certificate -O install_panel_en.sh $URL;fi;bash install_panel_en.sh ipssl
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
Once SSL is active, open the site with https://.

## Step 7: Upload VonCMS
Open the Files section in aaPanel.
Go to your site folder, usually /www/wwwroot/yourdomain.com.
Delete the default placeholder files such as index.html if they exist.
Upload the latest VonCMS Deploy package.
Extract the ZIP into the site root.

After extraction, your root should contain files such as index.php, .htaccess, api/, assets/, and the other deploy files.

## Step 8: Add Nginx Rewrite and Protection Rules
VonCMS ships Apache/LiteSpeed rules in .htaccess. On Nginx, add the equivalent rules manually in the same server {} block as the site.

Open your site config in aaPanel and make sure these rules are present. Place them **before** the PHP-FPM handler block that aaPanel generates — Nginx matches regex location blocks in the order they appear, so deny rules must come first.

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}

location = /index.html {
    rewrite ^ /index.php last;
}

location /api/ {
    try_files $uri =404;
}

# Block access to the data/ directory.
# On Apache this is handled by data/.htaccess automatically.
# On Nginx, files inside data/ are accessible unless blocked explicitly.
location ^~ /data/ {
    deny all;
}

# Block uploads/ directory.
# ^~ prefix stops Nginx from falling through to the PHP-FPM regex handler,
# which would otherwise execute PHP files uploaded by users.
# On Apache, uploads/.htaccess handles script blocking automatically.
location ^~ /uploads/ {
    location ~* \.(php|php3|php4|php5|phtml|pl|py|jsp|asp|htm|html|shtml|sh|cgi|js|exe)$ {
        deny all;
    }
    try_files $uri =404;
}

# Block internal API helper files.
# On Apache these are blocked by .htaccess with [F,L,NC].
# On Nginx they must be listed explicitly — the files exist on disk and
# PHP-FPM will execute them if not denied here.
location ~* ^/api/(content_audit_helper|ImageProcessor|mail_helper|media_library_filter_helper|public_cache_helper|redirect_loop_helper|settings_audit_helper)\.php$ {
    deny all;
}

location ~* ^/api/(system/IndexNow|security/SecurityLogger)\.php$ {
    deny all;
}

# Mirror the sensitive-file protection normally handled by .htaccess.
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

location ~ /\.(?!well-known) {
    deny all;
}
```

The /index.html rule is intentional. It keeps direct index.html requests on the same PHP hydration path as Apache/LiteSpeed, instead of serving the static Vite shell directly.

Keep the PHP handler block that aaPanel creates automatically. The rules above only add VonCMS routing and file-protection parity; they do not replace PHP-FPM handling.

Reload Nginx after saving changes.

## Step 9: Run the Installer
Open your domain in the browser. The installer will appear automatically — VonCMS detects that von_config.php is missing and redirects to /install. The domain URL is auto-detected from your request; you do not need to enter it manually.

Fill in the following fields:

- **Database host** — usually localhost
- **Database name** — from Step 5
- **Database user** — from Step 5
- **Database password** — from Step 5
- **Site name** — the display name for your site
- **Admin username**
- **Admin email**
- **Admin password**

> **Password requirement:** The admin password must be at least 8 characters and include one uppercase letter, one number, and one special character from `!@#$%^&*(),.?":{}|<>`. Example: `MyPass1!`. Weak passwords will be rejected by the installer.

Complete the install. VonCMS writes von_config.php and creates an install.lock file automatically. Direct access to /install is blocked once these files exist.

Sign in at /admin.

## Step 10: Post-Install Checks
Check these before you call the deployment done:

Homepage loads
Admin login works
Settings can be saved
robots.txt opens
sitemap.xml opens
One article page opens without 404

If you later change PHP version or handler rules in the panel, VonCMS Integrity Fix will create a .bak backup and repair only the VonCMS-managed routing block.

## Common Problems

### Installer does not load
Check:

DNS has propagated
SSL is active if you force HTTPS
Nginx rewrite rules are present
PHP 8.2+ is selected

### API returns 404 on VPS
Check the Nginx config again. Most VPS issues here come from missing rewrite rules or broken PHP handling.

### Sensitive files are downloadable on VPS
Nginx is not using the VonCMS .htaccess rules. Re-check Step 8 and make sure all deny rules are inside the same server {} block as the site, and that they appear before the PHP-FPM handler block.

### PHP scripts in uploads/ are executing
This happens when the PHP-FPM handler block appears before the uploads deny rules in the Nginx config. The fix is to use `location ^~ /uploads/` with a nested deny block as shown in Step 8 — the `^~` prefix stops Nginx from matching the PHP handler regex for anything under uploads/.

### Uploads fail
Check:

fileinfo is enabled
gd is enabled
PHP upload limits are large enough
folder permissions are correct (755 for directories, 644 for files)

If images appear broken on the frontend: file permission may be 600. Run chmod -R 644 uploads/ and chmod -R 755 uploads/*/ (for subdirectories). Apache/Nginx needs read access to serve images to visitors.

### White page or 500 error
Check:

Nginx error log
PHP error log in aaPanel
database credentials in von_config.php

## After Install
After the site is live, re-check the VPS Security Baseline above, confirm database and uploads/ backups are running, and remove any temporary files from the web root.

Optional static cache, CDN, compression, and LiteSpeed tuning belongs at the server/CDN layer. It is not required for a normal VonCMS install.

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
Add this inside the same server {} block after the protection rules:

```nginx
location ~* ^/(assets|fonts)/.+\.(css|js|woff2?|ttf|otf|eot|svg)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    try_files $uri =404;
}

location ~* ^/uploads/.+\.(jpg|jpeg|png|gif|webp|avif|svg)$ {
    expires 7d;
    add_header Cache-Control "public, max-age=604800";
    try_files $uri =404;
}

location ~* ^/(api|admin)(/|$) {
    add_header Cache-Control "no-store";
    try_files $uri $uri/ /index.php?$query_string;
}
```

Use the uploads cache window conservatively. If your workflow replaces media at the same URL, keep it short. If your workflow always creates new upload file names, you can raise it later.

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
| < 5k – 10k posts | Shared hosting | Default shared plan | Indexes eliminate table scans the real bottleneck on shared I/O. VonCMS caps admin bulk requests at 200 items for safety. Actual capacity depends on your host's resource sharing these are directional estimates, not a guaranteed SLA. |
| 10k – 100k posts | VPS (high-end) | 8-16GB RAM, 4-8 vCPU, NVMe SSD | Index fits in InnoDB buffer pool. No drama for normal publishing traffic. Set innodb_buffer_pool_size to 50-70% of available RAM. |
| 100k – 1M+ posts | Dedicated server | 32GB+ RAM, 8+ cores, NVMe | InnoDB handles 1M rows as a small table. PDO + proper indexes = solid foundation. Beyond 1M rows or millions of concurrent hits, consider partitioning. |

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
