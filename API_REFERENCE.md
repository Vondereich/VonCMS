# 🔌 VonCMS API Reference

> **Version**: 1.7.2  
> **Base URL**: `/api/` or `/api.php`  
> **Last Updated**: December 21, 2025

---

## Overview

VonCMS provides a REST API for all content management operations. All responses are in JSON format.

### API Structure

VonCMS has two types of API endpoints:

| Type | Location | Usage |
|------|----------|-------|
| **Individual Endpoints** | `/api/*.php` | Specific operations |
| **Central API** | `/api.php?action=*` | Settings and utility |

### Authentication

Most write operations require:
1. **Session** - User must be logged in
2. **CSRF Token** - Must be included in request header

```javascript
// Example: Authenticated request
fetch('/api/save_post.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken
    },
    body: JSON.stringify(postData)
});
```

---

## Authentication Endpoints

### POST `/api/login.php`

Authenticate a user.

**Request:**
```json
{
    "username": "admin",
    "password": "password123"
}
```

**Response (Success):**
```json
{
    "success": true,
    "user": {
        "id": "1",
        "username": "admin",
        "email": "admin@example.com",
        "role": "Admin",
        "avatar": ""
    },
    "csrf_token": "abc123xyz..."
}
```

**Response (Error):**
```json
{
    "success": false,
    "message": "Invalid credentials"
}
```

**Rate Limiting:** 5 failed attempts = 15 minute lockout

---

### POST `/api/logout.php`

End user session.

**Response:**
```json
{
    "success": true,
    "message": "Logged out"
}
```

---

### GET `/api/check_auth.php`

Check if user session is valid.

**Response (Logged In):**
```json
{
    "authenticated": true,
    "user": {
        "id": "1",
        "username": "admin",
        "email": "admin@example.com",
        "role": "Admin"
    }
}
```

**Response (Not Logged In):**
```json
{
    "authenticated": false
}
```

---

### POST `/api/register.php`

Register a new user.

**Request:**
```json
{
    "username": "newuser",
    "email": "user@example.com",
    "password": "password123"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Registration successful",
    "user": {
        "id": "2",
        "username": "newuser",
        "email": "user@example.com",
        "role": "Member"
    }
}
```

---

## Content Endpoints

### GET `/api/get_posts.php`

Fetch all posts.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status (published/draft) |
| `category` | string | Filter by category |
| `limit` | int | Number of posts to return |

**Response:**
```json
{
    "success": true,
    "posts": [
        {
            "id": "1",
            "title": "Hello World",
            "slug": "hello-world",
            "excerpt": "Welcome to VonCMS...",
            "content": "<p>Full content here...</p>",
            "image": "/uploads/featured.jpg",
            "status": "published",
            "category": "News",
            "author": "admin",
            "updatedAt": "2025-12-18T10:00:00Z",
            "keywords": "cms, blog"
        }
    ]
}
```

---

### GET `/api/get_post.php`

Fetch single post.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Post ID |
| `slug` | string | Post slug (alternative to ID) |

**Response:**
```json
{
    "success": true,
    "post": {
        "id": "1",
        "title": "Hello World",
        "slug": "hello-world",
        "content": "<p>Full content...</p>",
        "excerpt": "Short summary...",
        "image": "/uploads/featured.jpg",
        "status": "published",
        "category": "News",
        "author": "admin",
        "keywords": "cms, blog",
        "metaDescription": "SEO description"
    }
}
```

---

### POST `/api/save_post.php`

Create or update a post.

**Headers Required:**
- `X-CSRF-TOKEN`: CSRF token

**Request (Create):**
```json
{
    "title": "New Post",
    "content": "<p>Post content...</p>",
    "excerpt": "Short summary",
    "status": "published",
    "category": "News",
    "keywords": "tag1, tag2"
}
```

**Request (Update):**
```json
{
    "id": "1",
    "title": "Updated Title",
    "content": "<p>Updated content...</p>",
    "status": "published"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Post created",
    "id": "5",
    "slug": "new-post",
    "image": "/uploads/auto-detected.jpg"
}
```

---

### POST `/api/delete_post.php`

Delete a post.

**Request:**
```json
{
    "id": "5"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Post deleted"
}
```

---

### GET `/api/get_pages.php`

Fetch all pages.

**Response:**
```json
{
    "success": true,
    "pages": [
        {
            "id": "1",
            "title": "About Us",
            "slug": "about-us",
            "content": "<p>About page content...</p>",
            "status": "published"
        }
    ]
}
```

---

### POST `/api/save_page.php`

Create or update a page.

**Request:**
```json
{
    "title": "Contact",
    "content": "<p>Contact us at...</p>",
    "slug": "contact",
    "status": "published"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Page saved",
    "id": "3",
    "slug": "contact"
}
```

---

### POST `/api/delete_page.php`

Delete a page.

**Request:**
```json
{
    "id": "3"
}
```

---

## Comments Endpoints

### GET `/api/get_comments.php`

Fetch comments for a post.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `post_id` | string | Post ID (optional, returns all if omitted) |
| `status` | string | Filter by status |

**Response:**
```json
{
    "success": true,
    "comments": [
        {
            "id": "1",
            "postId": "1",
            "userId": "2",
            "username": "user1",
            "content": "Great post!",
            "likes": 5,
            "status": "approved",
            "createdAt": "2025-12-18T10:00:00Z",
            "replies": []
        }
    ]
}
```

---

### POST `/api/save_comments.php`

Add or update a comment.

**Request:**
```json
{
    "postId": "1",
    "content": "Nice article!",
    "parentId": null
}
```

**Response:**
```json
{
    "success": true,
    "message": "Comment saved",
    "id": "5"
}
```

---

## Media Endpoints

### GET `/api/list_media.php`

List all uploaded media files.

**Response:**
```json
{
    "success": true,
    "media": [
        {
            "id": "1",
            "name": "photo.jpg",
            "type": "image",
            "url": "/uploads/photo.jpg",
            "size": "245 KB",
            "uploadedAt": "2025-12-18"
        }
    ]
}
```

---

### POST `/api/upload_file.php`

Upload a file.

**Request:** `multipart/form-data`
- `file`: The file to upload

**Response:**
```json
{
    "success": true,
    "message": "File uploaded",
    "url": "/uploads/2025/12/filename.jpg",
    "name": "filename.jpg"
}
```

---

### POST `/api/delete_media.php`

Delete a media file.

**Request:**
```json
{
    "path": "/uploads/photo.jpg"
}
```

---

## User Endpoints

### GET `/api/get_users.php`

Fetch all users (Admin only).

**Response:**
```json
{
    "success": true,
    "users": [
        {
            "id": "1",
            "username": "admin",
            "email": "admin@example.com",
            "role": "Admin",
            "avatar": ""
        }
    ]
}
```

---

### POST `/api/save_user.php`

Create or update user.

**Request:**
```json
{
    "username": "newuser",
    "email": "new@example.com",
    "password": "password123",
    "role": "Writer"
}
```

---

### POST `/api/delete_user.php`

Delete a user.

**Request:**
```json
{
    "id": "5"
}
```

---

### POST `/api/update_user_role.php`

Change user role.

**Request:**
```json
{
    "id": "5",
    "role": "Moderator"
}
```

---

## Settings Endpoints

### GET `/api.php?action=get_settings`

Fetch site settings.

**Response:**
```json
{
    "success": true,
    "settings": {
        "siteName": "My Site",
        "siteDescription": "A VonCMS website",
        "postsPerPage": 10,
        "activeThemeId": "default",
        "navigation": [...],
        "categories": [...]
    }
}
```

---

### POST `/api.php?action=save_settings`

Update site settings.

**Request:**
```json
{
    "siteName": "Updated Name",
    "siteDescription": "New description",
    "postsPerPage": 12
}
```

---

### GET `/api.php?action=get_csrf_token`

Get CSRF token for frontend.

**Response:**
```json
{
    "csrf_token": "abc123xyz..."
}
```

---

## Database Endpoints

### POST `/api/db_query.php`

Execute SQL query (Admin only, use with caution).

**Request:**
```json
{
    "query": "SELECT * FROM posts LIMIT 10"
}
```

**Response:**
```json
{
    "success": true,
    "data": [...],
    "headers": ["id", "title", "slug", "..."]
}
```

---

### POST `/api/backup_db.php`

Create database backup.

**Response:** SQL file download

---

### POST `/api/import_db.php`

Import SQL file.

**Request:** `multipart/form-data`
- `file`: SQL file to import

---

## Utility Endpoints

### POST `/api/track_visit.php`

Track page visit (analytics).

**Request:**
```json
{
    "page": "/post/hello-world",
    "referrer": "https://google.com"
}
```

---

### GET `/api/get_storage.php`

Get storage usage statistics.

**Response:**
```json
{
    "success": true,
    "storage": {
        "used": "150 MB",
        "total": "1 GB",
        "percentage": 15
    }
}
```

---

## Error Responses

All endpoints return consistent error formats:

```json
{
    "success": false,
    "error": "Error message here",
    "message": "Human readable message"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (missing/invalid params) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (CSRF invalid or no permission) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Server Error |

---

## CORS Headers

All API endpoints include:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-CSRF-TOKEN
```

---

## Rate Limiting

Login endpoint is rate limited:
- **Max attempts**: 5 per 15 minutes
- **Lockout duration**: 15 minutes
- **Reset on**: Successful login

Rate limit data stored in: `/data/rate_limits/`

---

**VonCMS v1.7.2** - API Reference

---

[ Back to Documentation Home](README.md)

