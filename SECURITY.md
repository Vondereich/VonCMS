# 🔐 VonCMS Security Guide

> **Version**: 1.7.2  
> **Last Updated**: December 20, 2025

---

## Security Overview

VonCMS implements enterprise-grade security features to protect your website and users.

| Feature | Status | Description |
|---------|--------|-------------|
| CSRF Protection | ✅ Enabled | Token-based cross-site request forgery prevention |
| XSS Protection | ✅ Enabled | DOMPurify sanitization on all user content |
| SQL Injection | ✅ Protected | PDO prepared statements throughout |
| Session Security | ✅ Enabled | Secure cookies, 30-minute timeout |
| Rate Limiting | ✅ Enabled | IP-based brute force protection |
| Password Security | ✅ Enabled | bcrypt hashing with salt |

---

## CSRF Protection

### How It Works

1. Server generates unique token per session
2. Token sent to frontend on login
3. Frontend includes token in `X-CSRF-TOKEN` header
4. Server validates token on every write operation

### Implementation

**Backend (security.php):**
```php
class CSRFProtection {
    public static function generateToken() {
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }
    
    public static function validateToken() {
        $submittedToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        $sessionToken = $_SESSION['csrf_token'] ?? '';
        return hash_equals($sessionToken, $submittedToken);
    }
    
    public static function requireToken() {
        if (!self::validateToken()) {
            http_response_code(403);
            die(json_encode(['error' => 'Invalid CSRF token']));
        }
    }
}
```

**Frontend Usage:**
```typescript
// Get token on login
const { csrf_token } = await loginResponse.json();
localStorage.setItem('csrf_token', csrf_token);

// Include in requests
fetch('/api/save_post.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': localStorage.getItem('csrf_token')
    },
    body: JSON.stringify(data)
});
```

---

## XSS Protection

### DOMPurify Sanitization

All user-generated content is sanitized before rendering:

**Frontend (utils/security.ts):**
```typescript
import DOMPurify from 'dompurify';

export const sanitizeHtml = (dirty: string): string => {
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target']
    });
};
```

**Usage:**
```tsx
// Always sanitize before rendering HTML
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
```

### Backend Sanitization

```php
// Sanitize input on server side
function sanitize_input($data) {
    if (is_array($data)) {
        return array_map('sanitize_input', $data);
    }
    return htmlspecialchars(strip_tags($data), ENT_QUOTES, 'UTF-8');
}
```

---

## SQL Injection Protection

### PDO Prepared Statements

All database queries use prepared statements:

```php
// ✅ SAFE - Prepared statement
$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute([$email]);

// ✅ SAFE - Named parameters
$stmt = $pdo->prepare("SELECT * FROM posts WHERE id = :id AND status = :status");
$stmt->execute(['id' => $postId, 'status' => 'published']);

// ❌ VULNERABLE - Never do this!
$query = "SELECT * FROM users WHERE email = '" . $email . "'";
```

---

## Session Security

### Configuration

**von_config.php:**
```php
session_set_cookie_params([
    'lifetime' => 1800,        // 30 minutes
    'path' => '/',
    'domain' => '',
    'secure' => true,          // HTTPS only
    'httponly' => true,        // No JavaScript access
    'samesite' => 'Strict'     // CSRF protection
]);
session_start();
```

### Session Management

```php
class SessionManager {
    private static $timeout = 1800; // 30 minutes
    
    public static function isExpired() {
        if (isset($_SESSION['last_activity'])) {
            return (time() - $_SESSION['last_activity']) > self::$timeout;
        }
        return false;
    }
    
    public static function touch() {
        $_SESSION['last_activity'] = time();
    }
    
    public static function destroy() {
        $_SESSION = [];
        session_destroy();
    }
}
```

---

## Rate Limiting

### How It Works

1. Track failed login attempts by IP address
2. After 5 failed attempts → 15 minute lockout
3. Successful login resets counter

### Implementation

```php
class RateLimiter {
    private static $maxAttempts = 5;
    private static $lockoutTime = 900; // 15 minutes
    
    public static function isLimited($identifier = null) {
        $file = self::getFilePath($identifier ?? self::getClientIP());
        if (!file_exists($file)) return false;
        
        $data = json_decode(file_get_contents($file), true);
        return ($data['lockout_until'] ?? 0) > time();
    }
    
    public static function recordAttempt($identifier = null) {
        $file = self::getFilePath($identifier ?? self::getClientIP());
        $data = ['attempts' => 1];
        
        if (file_exists($file)) {
            $existing = json_decode(file_get_contents($file), true);
            $data['attempts'] = ($existing['attempts'] ?? 0) + 1;
        }
        
        if ($data['attempts'] >= self::$maxAttempts) {
            $data['lockout_until'] = time() + self::$lockoutTime;
        }
        
        file_put_contents($file, json_encode($data));
    }
    
    public static function reset($identifier = null) {
        $file = self::getFilePath($identifier ?? self::getClientIP());
        if (file_exists($file)) unlink($file);
    }
}
```

### Rate Limit Storage

Rate limit data stored in: `data/rate_limits/`
- Each IP has a JSON file with attempt count and lockout time
- Files are automatically cleaned up after lockout expires

---

## Password Security

### Hashing

```php
// Creating password hash
$hash = password_hash($password, PASSWORD_DEFAULT);

// Verifying password
if (password_verify($inputPassword, $storedHash)) {
    // Password correct
}
```

### Password Requirements

Recommended enforcement:
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character

```javascript
const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);
    return minLength && hasUpper && hasNumber && hasSpecial;
};
```

---

## Security Headers

### Apache (.htaccess)

```apache
# Security Headers
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "SAMEORIGIN"
Header set X-XSS-Protection "1; mode=block"
Header set Referrer-Policy "strict-origin-when-cross-origin"
Header set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"

# Prevent directory listing
Options -Indexes

# Protect sensitive files
<FilesMatch "^(von_config|security)\.php$">
    Order Allow,Deny
    Deny from all
</FilesMatch>
```

### Nginx Configuration

```nginx
# Security Headers
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Protect sensitive files
location ~ ^/(von_config|security)\.php$ {
    deny all;
    return 404;
}
```

---

## CORS Configuration

All API endpoints include CORS headers:

```php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-CSRF-TOKEN");
```

For production, restrict to your domain:
```php
header("Access-Control-Allow-Origin: https://yourdomain.com");
```

---

## File Upload Security

### Validation

```php
// Allowed file types
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

// Validate MIME type
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($_FILES['file']['tmp_name']);

if (!in_array($mimeType, $allowedTypes)) {
    die('Invalid file type');
}

// Validate extension
$extension = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
if (!in_array($extension, $allowedExtensions)) {
    die('Invalid file extension');
}

// Generate safe filename
$safeFilename = bin2hex(random_bytes(16)) . '.' . $extension;
```

### Storage

- Files stored outside webroot when possible
- Random filenames to prevent guessing
- `.htaccess` protection on upload directories

---

## Security Checklist

### Before Going Live

- [ ] Change default admin credentials
- [ ] Enable HTTPS (SSL certificate)
- [ ] Set `secure: true` in session config
- [ ] Disable PHP error display (`display_errors = Off`)
- [ ] Remove installation files
- [ ] Set proper file permissions (644 for files, 755 for folders)
- [ ] Configure firewall rules
- [ ] Enable server access logs
- [ ] Set up automated backups

### Regular Maintenance

- [ ] Keep dependencies updated (`npm audit`, `composer update`)
- [ ] Monitor rate limit logs
- [ ] Review access logs for suspicious activity
- [ ] Test backup restoration
- [ ] Rotate admin passwords periodically

---

## Incident Response

### If Compromised

1. **Isolate** - Take site offline immediately
2. **Identify** - Check logs for attack vector
3. **Contain** - Change all passwords and API keys
4. **Eradicate** - Remove malicious code/files
5. **Recover** - Restore from clean backup
6. **Learn** - Document incident and improve security

### Reporting Security Issues

If you discover a security vulnerability:
1. **Do not** publicly disclose
2. Email security report to **security@voncms.com**
3. Include steps to reproduce
4. We will respond within 48 hours

---

## Security Resources

- [OWASP Top 10](https://owasp.org/Top10/)
- [PHP Security Best Practices](https://www.php.net/manual/en/security.php)
- [React Security](https://reactjs.org/docs/security.html)
- [DOMPurify](https://github.com/cure53/DOMPurify)

---

**VonCMS v1.7.2** - Security Guide

---

[ Back to Documentation Home](README.md)

