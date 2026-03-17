# 🌐 Guide to Setting Up VonCMS on Linux VPS (Noob-Friendly Edition)

> "Confused by the black and white terminal? Don't worry. We will use a free 'Control Panel' that looks like cPanel but is more modern!"

This guide is specifically designed for those used to **cPanel** but wanting to switch to a **VPS** to get 10x the speed (Mandala Architecture style).

---

## 🛠️ Project Summary

- **Server**: Ubuntu 24.04 LTS (or 22.04 LTS).
- **Control Panel**: **aaPanel** (Free, with a beautiful interface).
- **Stack**: **LNMP** (Linux, Nginx, MySQL, PHP 8.2+).
- **Region**: **Singapore / ASEAN** (Mandatory for low latency).

---

## 🏗️ PHASE 1: Buy VPS & Choose Region (Singapore Mandatory!)

IMPORTANT: Don't choose a server in the US or Europe if your target audience is in Malaysia/ASEAN. **You must choose the Singapore (SG) region** – the speed will feel like the server is sitting right next to you!

**Providers with Singapore (SG) Nodes:**

1. **DigitalOcean** (Choose Region: Singapore).
2. **Vultr** (Choose Region: Singapore).
3. **UpCloud** (Among the fastest in Singapore).
4. **Hetzner** (Now has a Singapore Region!).
5. **Azozo / Shinjiru** (If you want servers specifically inside Malaysia).

**Minimum Specs:**

- 1 vCPU / 1GB RAM / 25GB SSD.
- OS: **Ubuntu 24.04 x86_64** (or 22.04).

---

## 🌐 PHASE 2: Connect Domain to VPS (DNS Setup)

After buying a VPS, you will get an **IP Address**. Now, your domain must "know" that IP.

### Option A: Use Cloudflare (Highly Recommended!)

1. Register at [Cloudflare.com](https://www.cloudflare.com) (Free).
2. Enter your domain. Cloudflare will give you new **Nameservers**.
3. Change your original domain Nameservers (at MyNIC/Namecheap/etc.) to Cloudflare's Nameservers.
4. In the Cloudflare Dashboard, go to the **DNS** tab and add **Record A**:
   - Type: `A` | Host: `@` | Value: `YOUR VPS IP`
   - Type: `A` | Host: `www` | Value: `YOUR VPS IP`

### Option B: Direct Method

Add **Record A** in the DNS Management menu where you bought your domain, pointing directly to the VPS IP.

---

## 🖥️ PHASE 3: Accessing the Server (The Only Terminal Part)

Now we want to log in to the "brain" of the server.

1. Install **Bitvise SSH Client** or **PuTTY** on your PC.
2. Login using:
   - **Host**: Your Server IP.
   - **Username**: `root`
   - **Password**: (Password from provider).
3. Once logged in, you will see a black screen saying `root@ubuntu:~#`.

---

## 🎨 PHASE 4: Install aaPanel (The Magic Command)

Copy & Paste this command into the black screen (Right-click to paste) and press **Enter**:

```bash
URL=https://www.aapanel.com/script/install_7.0_en.sh && if [ -f /usr/bin/curl ];then curl -ksSO "$URL" ;else wget --no-check-certificate -O install_7.0_en.sh "$URL";fi;bash install_7.0_en.sh ipssl
```

- Wait 2-5 minutes.
- At the end, it will provide the **Login URL, Username, & Password**.
- **COPY & SAVE THIS INFO!** Open that URL in your browser.

---

## 🚀 PHASE 5: Setup Software Stack (LNMP)

When logged into aaPanel in the browser, a popup will ask what to install. Choose **LNMP**:

1. **Nginx 1.24+** (Fastest web engine).
2. **MySQL 8.0** (Modern database).
3. **PHP 8.2+** (Mandatory for VonCMS — enable extensions: `pdo_mysql`, `mbstring`, `curl`, `fileinfo`, `json`).
4. **phpMyAdmin 5.2** (Managing the database via UI).
5. **Pure-FTPD** (For uploading files).

Click **One-click Install** (Method: **Fast** / RPM). Wait for completion.

---

## 🏠 PHASE 6: Add Website & SSL

1. Go to **Website** > **Add site**.
2. Enter your domain (e.g., `ournews.my`).
3. Under **Database**, choose **MySQL** (set a new username & password).
4. Click **Submit**.
5. **SSL (HTTPS)**: Click on the domain name > **SSL** menu > Choose **Let's Encrypt** > Click **Apply**. (Free for life!).

---

## 📦 PHASE 7: Upload & Install VonCMS

1. Go to the **Files** menu in aaPanel.
2. Find your domain folder (usually `/www/wwwroot/yourdomain.my`).
3. Delete default files (index.html, etc.).
4. **Upload** the `VonCMS_v1.20.0_Deploy.zip` file.
5. Right-click on the zip > **Unzip**.
6. **Final Step**: Open `yourdomain.my` in your browser — it will auto-redirect to the install wizard.

---

## ⚙️ PHASE 8: Nginx Rewrite Rules (Important!)

VonCMS is an SPA — Nginx needs rewrite rules (Apache uses `.htaccess` automatically, but Nginx does not).

In aaPanel, click your domain > **Config** > add this inside the `server {}` block:

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}

location /api/ {
    try_files $uri $uri/ =404;
}
```

Without this, refreshing any page besides the homepage will show a 404.

---

### 🔥 Extra Tips:

- **Fast CGI**: Activate in PHP settings in aaPanel for even better speed.
- **Auto Backup**: Use the **Cron** menu in aaPanel to automatically backup the database to Google Drive.
- **PHP Extensions**: Make sure `fileinfo` is enabled (needed for upload MIME sniffing).

**Done! Your news portal is now living in its "Own House" and it is very fast!**
