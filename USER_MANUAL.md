# User Manual

> **VonCMS v1.10.x "Solana"** | Complete Admin Panel Guide

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
10. [Newsletter Management](#newsletter-management)
11. [Extensions (Plugins)](#extensions-plugins)
12. [WordPress Migration](#wordpress-migration)
13. [Backup & Database](#backup--database)
14. [Troubleshooting](#troubleshooting)

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
>
> - At least 8 characters
> - At least 1 uppercase letter (A-Z)
> - At least 1 number (0-9)
> - At least 1 special character (!@#$%^&\*)

---

## Dashboard Overview

After logging in, you'll see the Dashboard - your control center.

### What You'll See

| Section             | Description                   |
| ------------------- | ----------------------------- |
| **Total Posts**     | Number of published articles  |
| **Total Pages**     | Number of static pages        |
| **Total Users**     | Registered users on your site |
| **Total Comments**  | All comments received         |
| **Recent Activity** | Latest actions on your site   |

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

| Field              | What to Enter                                              |
| ------------------ | ---------------------------------------------------------- |
| **Title**          | Your article headline (e.g., "10 Tips for Better Writing") |
| **Content**        | The full article text                                      |
| **Category**       | Select a category (News, Updates, etc.)                    |
| **Featured Image** | The main image that appears on listings                    |
| **Status**         | Draft (save for later) or Published (go live)              |

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

| Button | Name          | What It Does                              |
| ------ | ------------- | ----------------------------------------- |
| **B**  | Bold          | Makes text **bold**                       |
| _I_    | Italic        | Makes text _italic_                       |
| U̲      | Underline     | Adds underline to text                    |
| S̶      | Strikethrough | ~~Crosses out~~ text                      |
| 🔗     | Link          | Adds a clickable hyperlink                |
| 📷     | Image         | Inserts an image                          |
| 📹     | Video         | Embeds YouTube, TikTok, or Facebook video |
| 📊     | Table         | Creates a table                           |
| 📝     | Code          | Adds a code block                         |
| 🎨     | Text Color    | Changes text color                        |
| H1-H6  | Headings      | Creates different sized headings          |
| •      | Bullet List   | Creates a bulleted list                   |
| 1.     | Numbered List | Creates a numbered list                   |
| "      | Quote         | Creates a blockquote                      |
| 🤖     | AI Write      | Generate content with AI                  |
| `</>`  | HTML View     | Edit raw HTML code                        |

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

| Type      | Extensions                     |
| --------- | ------------------------------ |
| Images    | .jpg, .jpeg, .png, .gif, .webp |
| Documents | .pdf, .doc, .docx              |
| Video     | .mp4, .webm                    |

### Deleting Files

1. In Media Library, click the checkbox on files to delete
2. Click the **Delete** button
3. Confirm deletion

---

## Managing Comments

Moderate discussions on your posts.

### Comment Statuses

| Status          | Meaning                   |
| --------------- | ------------------------- |
| ✅ **Approved** | Visible to public         |
| ⏳ **Pending**  | Waiting for your approval |
| 🚫 **Spam**     | Marked as spam, hidden    |

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

Control who has access to your admin panel.

### User Roles

| Role          | Permissions                 |
| ------------- | --------------------------- |
| **Admin**     | Full access to everything   |
| **Moderator** | Manage comments and content |
| **Writer**    | Create and edit own posts   |
| **Member**    | View-only access            |

### Adding a New User

1. Go to **Users**
2. Click **+ Add User**
3. Fill in username, email, password
4. Select a role
5. Click **Save**

### Editing a User

1. Go to **Users**
2. Find the user
3. Click **Edit**
4. Change role or reset password
5. Click **Save**

### Deleting a User

1. Go to **Users**
2. Find the user
3. Click **Delete**
4. Confirm

> ⚠️ **Note:** You cannot delete the primary admin account!

---

## Settings

Configure your entire website from one place.

### General Settings

| Setting      | Description                             |
| ------------ | --------------------------------------- |
| Site Name    | Your website's title                    |
| Site Tagline | Short description                       |
| Site URL     | Your domain (e.g., https://example.com) |
| Timezone     | Your local timezone                     |

### SEO Settings

| Setting             | Description                            |
| ------------------- | -------------------------------------- |
| Meta Description    | Default description for search engines |
| Meta Keywords       | Keywords for SEO                       |
| Google Verification | Google Search Console code             |
| robots.txt          | Control search engine crawling         |

### Theme Settings

1. Go to **Settings** → **Appearance**
2. Choose from available themes:
   - **Default** - Clean and minimal
   - **TechPress** - News/Magazine style
   - **Prism** - Modern dark grid
   - **Portfolio** - Showcase projects
3. Click **Save** to apply

### Navigation Menu

1. Go to **Settings** → **Navigation**
2. Click **+ Add Item**
3. Enter label and URL
4. Arrange order by dragging
5. Click **Save**

---

---

## Newsletter Management

Manage your email subscribers and widget settings.

### Configuring the Widget

1.  Go to **Newsletter** via the Sidebar (Settings icon).
2.  **Enable/Disable**: Toggle the master switch to show/hide the widget public-wide.
3.  **Customization**:
    - **Title**: "Subscribe to our Newsletter"
    - **Description**: "Get the latest updates..."
    - **Button Text**: "Join Now"
4.  **Position**: Choose between `Footer`, `Sidebar`, or `Both`.
5.  Click **Save Settings**.

### Managing Subscribers

1.  Click the **Subscribers** tab.
2.  **Search**: Find specific emails using the search bar.
3.  **Filter**: View only `Active` or `Unsubscribed` users.
4.  **Delete**: Click the Trash icon to remove a subscriber (Admin only).

### Exporting Data

1.  Go to **Newsletter** → **Subscribers**.
2.  Click the **Export CSV** button.
3.  A `.csv` file will download containing all filtered subscribers.

---

---

## 9. Extensions (Plugins)

VonCMS v1.10.0 introduces a robust Plugin System designed to enhance your content without bloating the core.

### 🤖 AI Summary (New)

Automatically generates a "TL;DR" summary at the top of your posts.

- **Enable**: Go to **Admin > Extensions > AI Summary**.
- **Settings**:
  - **Mode**: Choose between "First Paragraph" or "Keyword Density".
  - **Bullets**: Set the number of summary points (3-5 recommended).
  - **Label**: Customize the header text (e.g., "AI Insights", "Quick Summary").

### 🔗 Related Posts (New)

Keeps readers engaged by suggesting similar content at the bottom of articles.

- **Enable**: Go to **Admin > Extensions > Related Posts**.
- **Settings**:
  - **Algorithm**: Match by Tags, Category, or Random.
  - **Layout**: Choose **Grid** (visual), **List** (compact), or **Cards** (modern).
  - **Count**: Control how many posts to display (3, 6, or 9).

### Other Available Plugins

- **Promo Bar**: Show announcements at top of site.
- **Gift Widget**: Display promotional gifts/offers.
- **VonSEO**: Advanced SEO optimization.
- **VonAnalytics**: Track visitor statistics.

### Activating/Deactivating Plugins

1. Go to **Extensions**
2. Find the plugin
3. Toggle the switch ON/OFF
4. Changes apply immediately

---

## WordPress Migration

VonCMS includes a powerful tool to migrate your content from WordPress easily.

### Step 1: Export from WordPress

1. Log in to your **WordPress Admin Panel**
2. Go to **Tools** → **Export**
3. Select **All content**
4. Click **Download Export File**
5. You will get an `.xml` file (e.g., `wordpress.xml`)

### Step 2: Import into VonCMS

1. Log in to your **VonCMS Admin Panel**
2. Go to **Settings** → **Content**
3. Locate the **WordPress Bridge** section
4. Click **Upload XML** and select your file
5. Check the **Safety Check** box (confirming you have a backup)
6. Click **Start Scan**

### Step 3: Run Migration

1. The system will analyze your file and show stats (Post count, Pages, etc.)
2. Click **Start Import**
3. Wait for the progress bar to reach 100%
4. Done! Your posts, pages, and authors are now in VonCMS.

> **Feature Note:**
>
> - **Smart Images:** VonCMS automatically finds the first image in your post content and sets it as the Featured Image.
> - **Self-Healing:** If the import stops, just run it again. It automatically skips duplicates.

---

## Backup & Database

Protect your data with regular backups.

### Creating a Backup

1. Go to **Database**
2. Click **Export Database**
3. The `.sql` file will download automatically

### Restoring from Backup

1. Go to **Database**
2. Click **Import Database**
3. Select your `.sql` backup file
4. Confirm the restore

> ⚠️ **Warning:** Restoring will overwrite current data!

### Running SQL Queries

For advanced users:

1. Go to **Database** → **Query Editor**
2. Type your SQL query
3. Click **Execute**
4. View results

---

## Troubleshooting

### Common Issues

| Problem             | Solution                                         |
| ------------------- | ------------------------------------------------ |
| White screen        | Delete `assets/` folder, re-upload, hard refresh |
| Can't login         | Check credentials, clear cookies                 |
| Images not showing  | Check file permissions (755/644)                 |
| Settings not saving | Check database connection                        |
| Slow performance    | Clear browser cache, optimize images             |

### Getting Help

If you need assistance:

1. Check the documentation in `docs/` folder
2. Review the CHANGELOG for recent changes
3. Contact support at **kurama87@gmail.com**

---

_VonCMS v1.10.x "Solana"_ - User Manual
