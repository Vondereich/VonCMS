# User Manual

> **VonCMS v1.8.3 "Aegis"** | Complete Admin Panel Guide

---

## Welcome to VonCMS

VonCMS is a modern, lightweight Content Management System designed for bloggers, news portals, and businesses. This guide will walk you through every feature of the admin panel step by step.

### Who is this guide for?

- **Website Owners** - Manage your content without coding
- **Content Writers** - Create and publish articles
- **Administrators** - Manage users and settings
- **Beginners** - No technical experience required!

---

## Table of Contents

1. [Logging In](#logging-in)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Posts](#managing-posts)
4. [Creating Pages](#creating-pages)
5. [Using the Editor](#using-the-editor)
6. [Media Library](#media-library)
7. [Managing Comments](#managing-comments)
8. [User Management](#user-management)
9. [Settings](#settings)
10. [Extensions (Plugins)](#extensions-plugins)
11. [Backup & Database](#backup--database)
12. [Troubleshooting](#troubleshooting)

---

## Logging In

### How to Access Admin Panel

1. Open your web browser (Chrome, Firefox, Safari, or Edge)
2. Type your website address followed by `/admin` or `/login`
   - Example: `https://yoursite.com/admin`
3. Enter your **Username** and **Password**
4. Click the **Login** button

### Forgot Your Password?

If you forgot your password:
1. Click "Forgot Password" on the login page
2. Enter your email address
3. Check your email for reset instructions
4. Follow the link to create a new password

> **Password Requirements:**
> - At least 8 characters
> - At least 1 uppercase letter (A-Z)
> - At least 1 number (0-9)
> - At least 1 special character (!@#$%^&*)

---

## Dashboard Overview

After logging in, you'll see the Dashboard - your control center.

### What You'll See

| Section | Description |
|---------|-------------|
| **Total Posts** | Number of published articles |
| **Total Pages** | Number of static pages |
| **Total Users** | Registered users on your site |
| **Total Comments** | All comments received |
| **Recent Activity** | Latest actions on your site |

### Navigation Sidebar

The sidebar on the left contains all admin sections:
- 📝 **Posts** - Manage articles
- 📄 **Pages** - Manage static pages
- 🖼️ **Media** - Upload and manage images
- 💬 **Comments** - Moderate discussions
- 👥 **Users** - Manage user accounts
- 🧩 **Extensions** - Enable/disable plugins
- ⚙️ **Settings** - Configure your site
- 💾 **Database** - Backup your data

---

## Managing Posts

Posts are your blog articles or news items.

### Creating a New Post

1. Click **Posts** in the sidebar
2. Click the green **+ New Post** button
3. Fill in the following:

| Field | What to Enter |
|-------|---------------|
| **Title** | Your article headline (e.g., "10 Tips for Better Writing") |
| **Content** | The full article text |
| **Category** | Select a category (News, Updates, etc.) |
| **Featured Image** | The main image that appears on listings |
| **Status** | Draft (save for later) or Published (go live) |

4. Click **Save** when done

### Editing an Existing Post

1. Go to **Posts**
2. Find the post in the list
3. Click the **Edit** button (pencil icon)
4. Make your changes
5. Click **Save**

### Deleting a Post

1. Go to **Posts**
2. Find the post you want to delete
3. Click the **Delete** button (trash icon)
4. Confirm the deletion

> ⚠️ **Warning:** Deleted posts cannot be recovered!

---

## Creating Pages

Pages are for static content that doesn't change often, like:
- About Us
- Contact
- Privacy Policy
- Terms of Service

### Creating a New Page

1. Click **Pages** in the sidebar
2. Click **+ New Page**
3. Enter the **Title** and **Content**
4. Check **Add to Navigation** if you want it in the menu
5. Click **Save**

### Adding a Page to Your Menu

1. When editing a page, enable **Add to Navigation**
2. Or go to **Settings** → **Navigation** → **Add Item**
3. Select the page from the dropdown

---

## Using the Editor

The visual editor makes content creation easy without knowing HTML.

### Editor Toolbar Explained

| Button | Name | What It Does |
|--------|------|--------------|
| **B** | Bold | Makes text **bold** |
| *I* | Italic | Makes text *italic* |
| U̲ | Underline | Adds underline to text |
| S̶ | Strikethrough | ~~Crosses out~~ text |
| 🔗 | Link | Adds a clickable hyperlink |
| 📷 | Image | Inserts an image |
| 📹 | Video | Embeds YouTube, TikTok, or Facebook video |
| 📊 | Table | Creates a table |
| 📝 | Code | Adds a code block |
| 🎨 | Text Color | Changes text color |
| H1-H6 | Headings | Creates different sized headings |
| • | Bullet List | Creates a bulleted list |
| 1. | Numbered List | Creates a numbered list |
| " | Quote | Creates a blockquote |
| 🤖 | AI Write | Generate content with AI |
| `</>` | HTML View | Edit raw HTML code |

### Inserting Images

**Method 1: From Media Library**
1. Click the 📷 button in the editor
2. Click **Choose from Library**
3. Select an image
4. Click **Insert**

**Method 2: Upload New**
1. Click the 📷 button
2. Click **Upload New**
3. Select a file from your computer
4. Wait for upload to complete
5. Click **Insert**

**Method 3: From URL**
1. Click the 📷 button
2. Paste the image URL
3. Click **Insert**

### Embedding Videos

**YouTube:**
1. Click the 📹 button
2. Paste the YouTube URL (e.g., `https://youtube.com/watch?v=ABC123`)
3. Click **Insert**

**TikTok:**
1. Click the 📹 button
2. Paste the TikTok video URL
3. Click **Insert**

### Using AI Writing Assistant

VonCMS includes an AI writing helper powered by Google Gemini.

**First Time Setup:**
1. Click the 🤖 button in the editor
2. Enter your Gemini API Key
3. Get a free key at: https://aistudio.google.com/apikey

**Using AI:**
1. Click the 🤖 button
2. Type a prompt (e.g., "Write an introduction about climate change")
3. Click **Generate**
4. The AI will write content for you
5. Edit as needed

---

## Media Library

Store and manage all your images and files.

### Uploading Files

**Method 1: Click Upload**
1. Go to **Media**
2. Click the **Upload** button
3. Select files from your computer

**Method 2: Drag and Drop**
1. Go to **Media**
2. Drag files from your computer
3. Drop them in the upload area

### Supported File Types

| Type | Extensions |
|------|------------|
| Images | .jpg, .jpeg, .png, .gif, .webp |
| Documents | .pdf, .doc, .docx |
| Video | .mp4, .webm |

### Deleting Files

1. In Media Library, click the checkbox on files to delete
2. Click the **Delete** button
3. Confirm deletion

---

## Managing Comments

Moderate discussions on your posts.

### Comment Statuses

| Status | Meaning |
|--------|---------|
| ✅ **Approved** | Visible to public |
| ⏳ **Pending** | Waiting for your approval |
| 🚫 **Spam** | Marked as spam, hidden |

### Approving Comments

1. Go to **Comments**
2. Find pending comments (marked with yellow)
3. Click **Approve** to make visible

### Deleting Spam

1. Go to **Comments**
2. Find spam comments
3. Click **Delete** to remove permanently

### Bulk Actions

1. Select multiple comments using checkboxes
2. Use the dropdown to choose action (Approve All, Delete All)
3. Click **Apply**

---

## User Management

Control who can access your admin panel.

### User Roles Explained

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to everything |
| **Moderator** | Manage posts, pages, comments. Cannot access settings |
| **Writer** | Create and edit their own posts only |
| **Member** | Can login and comment only |

### Adding a New User

1. Go to **Users**
2. Click **+ Add User**
3. Fill in the form:
   - **Username** - Login name
   - **Email** - User's email address
   - **Password** - Strong password
   - **Role** - Select appropriate role
4. Click **Save**

### Editing a User

1. Find the user in the list
2. Click **Edit**
3. Modify the information
4. Click **Save**

### Deleting a User

1. Find the user in the list
2. Click **Delete**
3. Confirm deletion

> ⚠️ **Note:** You cannot delete your own account!

---

## Settings

Configure every aspect of your website.

### General Settings

| Option | Description |
|--------|-------------|
| **Site Name** | Your website's name (appears in browser tab) |
| **Site Description** | Short description for SEO |
| **Logo** | Your site's logo image |
| **Favicon** | Small icon in browser tab |
| **Posts Per Page** | How many posts to show per page |

### Theme Settings

| Option | Description |
|--------|-------------|
| **Active Theme** | Choose between Default, TechPress, or Prism |
| **Primary Color** | Main color used throughout the site |
| **Dark Mode** | Enable/disable dark theme |

### Navigation Settings

Customize your menu:

1. Go to **Settings** → **Navigation**
2. Click **+ Add Item** to add a menu link
3. Enter the label (what users see) and URL
4. Drag items to reorder
5. Click **Save**

### Sidebar Settings

Customize your sidebar widgets:

1. Go to **Settings** → **Sidebar**
2. Toggle widgets on/off
3. Drag to reorder
4. Click **Save**

### SEO Settings

Optimize for search engines:

| Option | Description |
|--------|-------------|
| **Meta Title** | Title shown in search results |
| **Meta Description** | Description in search results |
| **Keywords** | Relevant keywords for your site |

---

## Extensions (Plugins)

Extend your site with additional features.

### Built-in Plugins

| Plugin | Description |
|--------|-------------|
| **Promo Bar** | Shows a promotional banner at the top |
| **Gift Widget** | Floating gift button for promotions |
| **VonSEO** | Automatic meta tags for SEO |
| **VonAnalytics** | Track visitor statistics |

### Enabling a Plugin

1. Go to **Extensions**
2. Find the plugin you want
3. Click **Enable**
4. Configure settings if needed

### Disabling a Plugin

1. Go to **Extensions**
2. Find the active plugin
3. Click **Disable**

---

## Backup & Database

Keep your data safe.

### Creating a Backup

1. Go to **Database**
2. Click **Backup Now**
3. A `.sql` file will download to your computer
4. Store this file safely

### When to Backup

- Before updating VonCMS
- Weekly (recommended)
- Before major content changes

---

## Troubleshooting

Common problems and solutions.

### White/Blank Page

**Cause:** Browser cache or server issue

**Solution:**
1. Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Clear browser cache completely
3. Check if `mod_rewrite` is enabled on your server

### Images Won't Upload

**Cause:** File too large

**Solution:**
1. Resize images to under 2MB
2. Use .jpg or .webp format for smaller size
3. Check folder permissions (755 for folders, 644 for files)

### Can't Login

**Cause:** Incorrect credentials or session issue

**Solution:**
1. Double-check username and password
2. Clear browser cookies
3. Try incognito/private browsing mode

### Settings Won't Save

**Cause:** Session timeout

**Solution:**
1. Log out completely
2. Log back in
3. Try saving again

### Old Version Showing After Update

**Cause:** Cached JavaScript files

**Solution:**
1. Delete the `assets` folder from your hosting
2. Upload the new version files
3. Hard refresh with `Ctrl + Shift + R`

---

## Keyboard Shortcuts

Speed up your workflow:

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save |
| `Ctrl + B` | Bold |
| `Ctrl + I` | Italic |
| `Ctrl + U` | Underline |
| `Ctrl + K` | Insert Link |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |

---

## Best Practices

1. **Backup regularly** - At least weekly
2. **Use strong passwords** - Never share login credentials
3. **Optimize images** - Compress before uploading
4. **Update VonCMS** - Keep your system current
5. **Moderate comments** - Check pending comments daily
6. **Log out when done** - Especially on shared computers

---

## Getting Help

If you encounter issues:

1. Check this documentation first
2. Review the [CHANGELOG.md](CHANGELOG.md) for known issues
3. Contact your website administrator

---

*VonCMS v1.8.3 "Aegis"*
