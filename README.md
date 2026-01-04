# 🚀 VonCMS v1.9.x

<div align="center">

### ⚡ The Ultra-Fast, Hybrid Headless CMS ⚡

**React + PHP | Blazing Fast | Zero Plugin Headaches**

[![Version](https://img.shields.io/badge/version-1.9.x-blue.svg)](https://github.com/Vondereich/VonCMS/releases)
[![Lighthouse](https://img.shields.io/badge/Lighthouse-89%2F96%2F100%2F100-brightgreen.svg)](https://web.dev/measure/)
[![License](https://img.shields.io/badge/license-Private-red.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Vondereich/VonCMS?style=social)](https://github.com/Vondereich/VonCMS)

**[📥 Download Latest Release](https://github.com/Vondereich/VonCMS/releases) • [📖 Documentation](docs/) • [🐛 Report Bug](https://github.com/Vondereich/VonCMS/issues)**

---

_If you find VonCMS useful, please consider giving it a ⭐ — it helps others discover the project!_

</div>

---

## 🎯 Why VonCMS?

| Feature                     | VonCMS v1.9.x |      WordPress       | Ghost |
| --------------------------- | :----: | :------------------: | :---: |
| **Setup Time**              | 2 min  |       15+ min        | 5 min |
| **Core Files**              |  ~200  |        3,000+        | ~500  |
| **Built-in SEO**            |   ✅   |   ❌ (needs Yoast)   |  ✅   |
| **Newsletter System**       |   ✅   | ❌ (needs Mailchimp) |  ✅   |
| **Built-in Ads Manager**    |   ✅   |  ❌ (needs plugin)   |  ❌   |
| **WP Migration Tool**       |   ✅   |         N/A          |  ✅   |
| **Plugin Dependencies**     |   0    |    10-30+ typical    |   0   |
| **Security Patches Needed** |  Rare  |        Weekly        | Rare  |
| **Lighthouse SEO Score**    |  100   |  70-90 (optimized)   |  95+  |

---

## 🎬 Watch Demo

<div align="center">
  <a href="https://www.youtube.com/watch?v=A4Rd9D4HtmQ">
    <img src="https://img.youtube.com/vi/A4Rd9D4HtmQ/maxresdefault.jpg" alt="VonCMS Demo" width="600">
  </a>
  <p><strong>▶️ Why I Built VonCMS (Click to Watch)</strong></p>
</div>

### 📚 More Tutorials

| Topic                 | Video                                                  |
| --------------------- | ------------------------------------------------------ |
| 🔧 Installation Guide | [Watch →](https://www.youtube.com/watch?v=kybRZDPDVBY) |
| 🌉 WP Migration Demo  | [Watch →](https://www.youtube.com/watch?v=mHXNfc6bGkk) |

---

## 🔥 Feature Spotlight: The v1.9 Era

We skipped straight to **v1.9.x** to bring you a consolidated, feature-complete experience. Here is the breakdown of the major systems added in this generation:

### 1. 🧠 Smart Systems (v1.9.x)

- **Algorithmic Dark Mode**: Mathematically detects and cleans "dirty" inline colors.
- **Intelligent SEO**: Auto-keywords weighted by Title priority.
- **XSS Shield**: Deep sanitization for ads and custom blocks.
- **Privacy-First Avatar Sync**: Consistent Gravatars across Profile/Comments using secure MD5 hashing.

### 2. 🏗️ Theme Standardization (v1.9.5)

- **Shared Hooks**: Centralized logic for Profiles, Popups, and UX across themes.
- **Discussion Tabs**: Standardized "Articles vs Discussion" tabs on user profiles.
- **Developer SOP**: Full `THEME_DEV_GUIDE` included for future-proof theming.

### 3. 🛡️ Enterprise Database Safety (v1.9.3)

- **Safety Switch**: A fail-safe toggle that blocks destructive queries (`DROP`, `DELETE`) by default.
- **Auto-Repair Tool**: A "Self-Healing" engine that detects missing tables/columns and rebuilds them instantly.
- **Atomic Architecture**: Config files use "Write-Verify-Rename" logic to prevent corruption during server crashes.

### 4. 📧 Native Newsletter CRM (v1.9.2)

- **Subscriber Database**: Built-in management for your audience.
- **Growth Widgets**: Ready-to-use subscription forms for Footer & Sidebar.
- **Data Sovereignty**: Full CSV export ownership. No external dependencies.

### 5. 📰 "Von Digest" Theme (v1.9.2)

- **Modern Magazine UI**: Designed for high-readability and engagement.
- **Smart Categories**: Dynamic hero sections for topic filtering.
- **Dark Mode 2.0**: Refined high-contrast dark theme.

### 6. ⚡ Smart UX Engine (v1.9.0)

- **Skeleton Loading**: Eliminated "white screen" flashes.
- **Instant Feel**: Perceptual performance optimized for slower networks.
- **React Hydration**: Seamless transition from static HTML to interactive App.

---

## 🛡️ Enhanced Security (v1.8.6)

**14 vulnerabilities patched** with multi-layer protection:

```
Request → CORS → Session → CSRF → Admin Check → Execute
```

- ✅ Session validation on all write endpoints
- ✅ CSRF token protection
- ✅ Super Admin (ID 1) immutable protection
- ✅ Avatar privacy (Gravatar MD5 hashing)

---

## ⚡ Key Features

<table>
<tr>
<td width="50%">

### 🚀 Performance

- ⚡ React + Vite = <1s page loads
- 🪶 15x lighter than WordPress
- 📊 **Smart Analytics** (Auto-purge + Throttling)
- 📱 Mobile-first responsive design
- 🎯 **Lighthouse Score**: 89/96/100/100

### 🎨 Themes

- 📰 TechPress (News/Magazine)
- 🗞️ **Digest** (Modern Blog/Magazine) _New_
- 🌙 Prism (Modern Dark Grid)
- 💼 Portfolio (Clean, Professional Showcase)
- 🎛️ Fully customizable

</td>
<td width="50%">

### 🛠️ Content Management

- 🕒 Content scheduling
- 🗑️ Bulk delete operations
- 📂 Drag-drop file manager
- ✏️ WYSIWYG editor
- 📞 **VonContact System** (New)

### 💰 Monetization

- 📊 Built-in Ads Manager
- 🎯 Header, Sidebar, In-Feed ads
- 💵 AdSense-ready

</td>
</tr>
</table>

---

## 📥 Quick Start

```bash
# 1. Download from GitHub Releases
# 2. Upload to your hosting (cPanel, DirectAdmin, etc.)
# 3. Extract ZIP
# 4. Open your domain in browser
# 5. Follow installation wizard (2 minutes!)
```

### System Requirements

- **PHP**: 8.0+
- **Database**: MySQL / MariaDB
- **Server**: Apache (recommended) or Nginx

---

## 📦 What's Included

| Component           | Description                                |
| ------------------- | ------------------------------------------ |
| 🎨 3 Premium Themes | TechPress + Prism + Portfolio              |
| 🔍 VonSEO           | Built-in SEO optimization (Lighthouse 100) |
| 📞 **VonContact**   | Special Contact Form Builder (SMTP Ready)  |
| 💾 **Autosave**     | Never lose work with 60s background save   |
| 💰 Ads Manager      | Full advertising system                    |
| 🌉 WP Bridge        | WordPress migration tool                   |
| 🛡️ Security Suite   | Multi-layer authentication                 |

---

## 🙋‍♂️ Default Admin Access

After installation:

```
URL: yoursite.com/admin
Username: (created during install)
Password: (created during install)
```

---

## 🐛 Bug Reports & Feedback

Found a bug? Have an idea? [Open an issue](https://github.com/Vondereich/VonCMS/issues) — community feedback shapes VonCMS!

---

<div align="center">

### 🌟 Star History

If VonCMS helped you, leave a ⭐ to support the project!

**[⭐ Star on GitHub](https://github.com/Vondereich/VonCMS)**

---

_Built with ❤️ by the VonCMS Team_

</div>
