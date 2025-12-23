# Installation Guide

> **VonCMS v1.7.2 "Phoenix"**

---

## What is VonCMS?

VonCMS is a modern, ultra-fast Content Management System built with React and PHP. It combines the speed of a Single-Page Application (SPA) with the simplicity of traditional CMS platforms.

### Why VonCMS?

| Feature | Benefit |
|---------|---------|
| ⚡ **Blazing Fast** | React + Vite for instant page loads |
| 🔌 **Easy Install** | No coding required, wizard-based setup |
| 🎨 **Premium Themes** | TechPress, Prism, Default included |
| 💰 **Ads Ready** | Built-in ad zones (AdSense compatible) |
| 📱 **Mobile-First** | Responsive on all devices |
| 🔒 **Secure** | Session protection, CSRF, XSS prevention |

---

## Requirements

| Requirement | Minimum |
|-------------|---------|
| PHP | 8.0+ |
| MySQL | 5.7+ |
| Storage | 50MB |

✅ Works on: cPanel, VPS, XAMPP, WAMP

---

## Quick Install (5 Minutes)

### Step 1: Upload
1. Download `VonCMS_Deploy.zip`
2. Upload to hosting (`public_html`) or localhost (`htdocs`)
3. Extract all files

### Step 2: Create Database
1. Open **phpMyAdmin**
2. Click **New** → Enter name → **Create**

### Step 3: Run Installer
1. Open your site URL in browser
2. Installer Wizard starts automatically
3. Fill in:

| Field | Example |
|-------|---------|
| DB Host | `localhost` |
| DB Name | `my_site` |
| DB User | `root` |
| DB Password | *(your password)* |
| Admin Username | `admin` |
| Admin Email | `admin@site.com` |
| Admin Password | `MyP@ss123!` |

> **Password:** 8+ chars, 1 uppercase, 1 number, 1 symbol

4. Click **Install Now**
5. Done! Login at `yoursite.com/admin`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| White page | Enable `mod_rewrite` in Apache |
| Permission error | Folders: `755`, Files: `644` |
| DB connection failed | Check credentials in phpMyAdmin |

---

*VonCMS v1.7.2 "Phoenix"*
