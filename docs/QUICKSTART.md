# VonCMS Quickstart v1.25.1 "OpenGate"

This is the short first-run path. Use the full [README](../README.md) when you want source development detail, and use [Installation](INSTALL.md) or [VPS](VPS.md) when you need hosting-specific notes.

## Path A: Install A Website

Use this path when you only want to run VonCMS on hosting.

1. Download `VonCMS_v1.25.1_Deploy.zip` from the release page.
2. Extract the ZIP into your hosting web root, such as `public_html`.
3. Create a MySQL database and database user.
4. Open your site URL in the browser.
5. Complete the installer wizard.
6. Sign in at `/admin`.
7. Create one draft post, publish it, and open the public post page.

Production hosting does not need Node.js or Vite. It needs PHP, MySQL, and Apache/LiteSpeed `.htaccess` routing. For Nginx-only VPS installs, follow [VPS](VPS.md) because Nginx ignores `.htaccess`.

## Path B: Run Locally With Laragon

Use this path when you want to test the Deploy ZIP on Windows before uploading.

1. Install Laragon.
2. Start Apache and MySQL.
3. Extract `VonCMS_v1.25.1_Deploy.zip` into `C:\laragon\www\voncms`.
4. Create a database in phpMyAdmin, HeidiSQL, or another database manager.
5. Open `http://localhost/voncms`.
6. Complete the installer wizard.
7. Sign in at `http://localhost/voncms/admin`.

Default Laragon database values are usually:

| Field    | Value       |
| -------- | ----------- |
| Host     | `localhost` |
| User     | `root`      |
| Password | empty       |

## Path C: Work From Source

Use this path when you want to edit themes, plugins, APIs, docs, or release packages.

```bash
git clone https://github.com/YOUR-USERNAME/VonCMS.git
cd VonCMS
npm install
npm audit
npm outdated
npm run typecheck
npm run build
```

Run the development server while editing React code:

```bash
npm run dev
```

Run the maintainer smoke gate before pull requests or release packaging:

```bash
npm run test:integration
```

## First Checks

After install, verify:

- homepage loads
- `/admin` login works
- one post can be published
- one public post URL opens
- media upload works
- `robots.txt` and `sitemap.xml` open
- `System Tools > Repair .htaccess` is available if routing needs repair

## Where To Continue

- [Theme Development](THEME_DEVELOPMENT.md)
- [Plugin Development](PLUGIN_DEVELOPMENT.md)
- [API](API.md)
- [Security](SECURITY.md)
- [Upgrade](UPGRADE.md)
- [Custom Fonts](CUSTOM_FONTS.md)
