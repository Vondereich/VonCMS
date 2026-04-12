# VPS Deployment Guide

This guide is for users who are comfortable with cPanel or shared hosting but want to run VonCMS on their own VPS without getting lost in server jargon.

> **Note:** VonCMS is designed for the **LAMP** stack (Linux, Apache, MySQL, PHP). This guide uses **LNMP** (Nginx instead of Apache) as an alternative for VPS users who prefer Nginx — but it requires manual rewrite rules (included below). If you want the standard setup, install **Apache** instead.

The stack used in this guide:

- Ubuntu 24.04 LTS or 22.04 LTS
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

Run this command on the server:

```bash
URL=https://www.aapanel.com/script/install_7.0_en.sh && if [ -f /usr/bin/curl ];then curl -ksSO "$URL" ;else wget --no-check-certificate -O install_7.0_en.sh "$URL";fi;bash install_7.0_en.sh ipssl
```

After installation finishes, aaPanel will show:

- panel URL
- admin username
- admin password

Save these details before you close the terminal.

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

Once SSL is active, open the site with `https://`.

## Step 7: Upload VonCMS

1. Open the `Files` section in aaPanel.
2. Go to your site folder, usually `/www/wwwroot/yourdomain.com`.
3. Delete the default placeholder files such as `index.html` if they exist.
4. Upload the latest VonCMS Deploy package.
5. Extract the ZIP into the site root.

After extraction, your root should contain files such as `index.php`, `.htaccess`, `api/`, `assets/`, and the other deploy files.

## Step 8: Add Nginx Rewrite Rules

VonCMS supports Apache through `.htaccess`, but on Nginx you must add rewrite rules manually.

Open your site config in aaPanel and make sure your `server {}` block includes this:

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}

location /api/ {
    try_files $uri $uri/ =404;
}
```

Your PHP handler block must still be present in the Nginx config. aaPanel usually creates it for you automatically.

Reload Nginx after saving changes.

## Step 9: Run the Installer

1. Open your domain in the browser.
2. The installer should appear automatically.
3. Fill in:
   - database host
   - database name
   - database user
   - database password
   - admin username
   - admin email
   - admin password
4. Complete the install.
5. Sign in at `/admin`.

## Step 10: Post-Install Checks

Check these before you call the deployment done:

- Homepage loads
- Admin login works
- Settings can be saved
- `robots.txt` opens
- `sitemap.xml` opens
- One article page opens without 404

If you later change PHP version or handler rules in the panel, VonCMS Integrity Fix will create a `.bak` backup and repair only the VonCMS-managed routing block.

## Common Problems

### Installer does not load

Check:

- DNS has propagated
- SSL is active if you force HTTPS
- Nginx rewrite rules are present
- PHP 8.2+ is selected

### API returns 404 on VPS

Check the Nginx config again. Most VPS issues here come from missing rewrite rules or broken PHP handling.

### Uploads fail

Check:

- `fileinfo` is enabled
- `gd` is enabled
- PHP upload limits are large enough
- folder permissions are correct (`755` for directories, `644` for files)

If images appear broken on the frontend: file permission may be `600`. Run `chmod -R 644 uploads/` and `chmod -R 755 uploads/*/` (for subdirectories). Apache/Nginx needs read access to serve images to visitors.

### White page or 500 error

Check:

- Nginx error log
- PHP error log in aaPanel
- database credentials in `von_config.php`

## Recommended Hardening

After the site is live:

- change the default aaPanel password
- disable root password login if you use SSH keys
- keep Ubuntu, Nginx, MySQL, and PHP updated
- back up both `uploads/` and the database regularly
- avoid leaving test files in the web root

Once these checks pass, your VPS deployment is ready.
