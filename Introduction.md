# Introduction to VonCMS

> **VonCMS v1.8.3 "Aegis"** | Getting Started

---

## What is VonCMS?

VonCMS is a **modern Content Management System** that allows you to create and manage websites without any coding knowledge. It's built with cutting-edge technology (React + PHP) to deliver blazing-fast performance while remaining simple to use.

### Perfect For

| Use Case | Examples |
|----------|----------|
| **Personal Blogs** | Travel journals, photo blogs, hobby sites |
| **News Portals** | Local news, tech news, sports coverage |
| **Business Websites** | Company pages, portfolios, landing pages |
| **Community Sites** | Forums, member-only areas |

---

## Key Features

### ⚡ Performance
- **Sub-second load times** using React Single-Page Application
- **Instant navigation** - pages load without full refresh
- **Optimized for mobile** - works great on phones and tablets

### 🎨 Beautiful Themes
Three premium themes included:
- **Default** - Clean, minimalist design
- **TechPress** - News portal layout with sidebars
- **Prism** - Modern grid-based design

### ✍️ Content Creation
- **Visual Editor** - Write content without knowing HTML
- **AI Writing Assistant** - Generate content with Google Gemini
- **Media Library** - Upload and manage images easily
- **Categories & Tags** - Organize your content

### 👥 User Management
- **Multiple roles** - Admin, Moderator, Writer, Member
- **Secure authentication** - Strong password requirements
- **Profile management** - Avatars and bios

### 🔒 Security Built-In
- **Session protection** - Automatic logout on inactivity
- **CSRF protection** - Prevents cross-site attacks
- **Spam detection** - Filters malicious comments
- **Strong passwords** - Enforced requirements

### 💰 Monetization Ready
- **Ad zones** - Header, sidebar, in-feed placements
- **AdSense compatible** - Works with Google ads
- **Promo bar** - Highlight special offers

---

## System Requirements

### Hosting Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **PHP** | 8.0+ | 8.1+ |
| **MySQL** | 5.7+ | 8.0+ |
| **Storage** | 50 MB | 100 MB+ |

### Compatible Hosting

✅ **Works perfectly on:**
- cPanel shared hosting (Hostinger, Bluehost, GoDaddy)
- VPS (DigitalOcean, Linode, Vultr)
- Cloud (AWS, Google Cloud, Azure)
- Local development (XAMPP, WAMP, MAMP)

---

## Installation Methods

### Method 1: Shared Hosting (cPanel)

**Best for:** Beginners, small websites

1. Download `VonCMS_vX.X.X_Deploy.zip`
2. Upload to `public_html` via cPanel File Manager
3. Extract the zip file
4. Create a MySQL database in phpMyAdmin
5. Visit your website URL
6. Follow the installation wizard

### Method 2: VPS/Dedicated Server

**Best for:** High-traffic sites, developers

1. SSH into your server
2. Clone or upload files to web root
3. Set up MySQL database
4. Configure web server (Apache/Nginx)
5. Run the installation wizard

### Method 3: Local Development (XAMPP)

**Best for:** Testing, development

1. Install XAMPP
2. Extract files to `htdocs/yourfolder`
3. Create database in phpMyAdmin
4. Visit `localhost/yourfolder`
5. Complete installation wizard

---

## Quick Start Guide

### Step 1: Install VonCMS
Follow the installation instructions in [INSTALLATION.md](INSTALLATION.md)

### Step 2: Login to Admin Panel
Go to `yoursite.com/admin` and login with your admin credentials

### Step 3: Create Your First Post
1. Click **Posts** → **+ New Post**
2. Write your content
3. Set status to **Published**
4. Click **Save**

### Step 4: Customize Your Site
1. Go to **Settings** → **General**
2. Add your site name and logo
3. Choose a theme in **Settings** → **Theme**

### Step 5: You're Live!
Visit your website to see your first post

---

## Architecture Overview

VonCMS uses a **Hybrid Headless Architecture**:

```
┌─────────────────────────────────────────────┐
│               Frontend (React)               │
│  - Single Page Application                   │
│  - Instant navigation                        │
│  - Visual editor                             │
└─────────────────┬───────────────────────────┘
                  │ API Calls
                  ▼
┌─────────────────────────────────────────────┐
│               Backend (PHP)                  │
│  - REST API endpoints                        │
│  - Authentication                            │
│  - Database operations                       │
└─────────────────┬───────────────────────────┘
                  │ SQL Queries
                  ▼
┌─────────────────────────────────────────────┐
│               Database (MySQL)               │
│  - Posts, Pages, Users                       │
│  - Comments, Settings                        │
│  - Media metadata                            │
└─────────────────────────────────────────────┘
```

### Why This Architecture?

| Benefit | Explanation |
|---------|-------------|
| **Speed** | React handles UI without page reloads |
| **Flexibility** | PHP works on any hosting |
| **Security** | Backend API validates all requests |
| **SEO** | PHP renders meta tags for bots |

---

## Documentation Map

| Document | Who Should Read | Content |
|----------|-----------------|---------|
| [INSTALLATION.md](INSTALLATION.md) | Everyone | How to install VonCMS |
| [USER_MANUAL.md](USER_MANUAL.md) | Website Owners | Admin panel guide |

| [API_REFERENCE.md](API_REFERENCE.md) | Developers | All API endpoints |
| [SECURITY.md](SECURITY.md) | Everyone | Security features |

---

## Version History

| Version | Codename | Highlights |
|---------|----------|------------|
| 1.8.3 | Aegis | Content Scheduling, Bulk Delete |
| 1.7.4 | Refactor | Code refactoring, hooks architecture |
| 1.7.3 | Phoenix | Bug fixes, Prism theme improvements |
| 1.7.0 | Phoenix | Security hardening, spam detection |
| 1.6.0 | Sierra | React 19 upgrade |

See [CHANGELOG.md](../CHANGELOG.md) for full history.

---

## Support & Community

### Getting Help

1. Read the documentation (you're here!)
2. Check [CHANGELOG.md](../CHANGELOG.md) for known issues
3. Review error messages carefully
4. Contact your hosting provider for server issues

### Contributing

VonCMS is free to use. You can:
- Report bugs
- Suggest features
- Submit improvements

---

## License

VonCMS is released under a **Proprietary License**.

You are free to:
- Use for personal or commercial projects
- Share the official download link

See [LICENSE.md](LICENSE.md) for full terms.

---

*Welcome to VonCMS! Let's build something great together.*

*VonCMS v1.8.3 "Aegis"*
