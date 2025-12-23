# Developer Guide

> **VonCMS v1.7.2 "Phoenix"** | For Programmers

---

## About VonCMS

VonCMS is a **Hybrid Headless CMS** – combining a React Single-Page Application (SPA) frontend with a PHP REST API backend. This architecture gives you the best of both worlds: the speed and interactivity of modern JavaScript frameworks with the simplicity and wide hosting compatibility of PHP.

### Key Technical Features

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** PHP 8+ REST API
- **Database:** MySQL with PDO
- **Build:** ~421 KB bundle (gzipped ~141 KB)
- **APIs:** 38 endpoints

This guide covers customization, theme development, plugin creation, and API usage.

---

## Architecture

**Frontend:** React + TypeScript + Vite  
**Backend:** PHP REST API  
**Database:** MySQL

---

## Project Structure

```
project-root/
├── src/                    # React Frontend
│   ├── App.tsx            # Main app
│   ├── components/        # Reusable UI
│   ├── themes/            # Theme layouts
│   └── plugins/           # Plugin system
│
├── public/                 # PHP Backend
│   ├── api/               # REST endpoints
│   └── von_config.php     # DB config
│
└── dist/                   # Build output
```

---

## Development Setup

```bash
# Install
npm install

# Dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# TypeScript check
npm run typecheck
```

---

## Build System

> ⚠️ **Important:** Always use `npm run build` which auto-cleans `dist/` folder first.

```json
"prebuild": "rimraf dist && rimraf public/assets"
```

This prevents "zombie files" from previous builds.

---

## API Pattern

All PHP endpoints follow this structure:

```php
<?php
header('Content-Type: application/json');
require_once '../von_config.php';

// Security (for write operations)
require_once '../security.php';
SessionManager::requireValidSession();

$input = json_decode(file_get_contents('php://input'), true);

try {
    // Your logic
    echo json_encode(['success' => true, 'data' => $result]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `posts` | Blog posts |
| `pages` | Static pages |
| `comments` | Post comments |
| `settings` | Site configuration |
| `media` | Uploaded files |

---

## Security

- ✅ Prepared statements (PDO)
- ✅ XSS protection (htmlspecialchars)
- ✅ Session validation on write APIs
- ✅ CSRF tokens for sensitive actions
- ✅ File type validation on uploads

---

## Deploy

1. Run `npm run build`
2. Upload `dist/` + `public/` to hosting
3. Or use pre-built `VonCMS_Deploy.zip`

---

## Further Reading

- [API_REFERENCE.md](API_REFERENCE.md) - All 38 endpoints
- [SECURITY.md](SECURITY.md) - Security details

---

*VonCMS v1.7.2 "Phoenix"*
