<?php
/**
 * VonCMS Security Middleware
 * Handles CSRF, Session Management, and Rate Limiting
 */

// Prevent direct access
if (basename($_SERVER['PHP_SELF']) == basename(__FILE__)) {
    die('Direct access not allowed');
}

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * CSRF Protection
 */
class CSRFProtection {
    private static $tokenName = 'csrf_token';
    
    /**
     * Generate CSRF token and store in session
     */
    public static function generateToken() {
        if (!isset($_SESSION[self::$tokenName])) {
            $_SESSION[self::$tokenName] = bin2hex(random_bytes(32));
        }
        return $_SESSION[self::$tokenName];
    }
    
    /**
     * Get current CSRF token
     */
    public static function getToken() {
        return $_SESSION[self::$tokenName] ?? self::generateToken();
    }
    
    /**
     * Validate CSRF token from request
     */
    public static function validateToken() {
        // Check header first (SPA pattern)
        $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        
        // Fallback to POST field
        $postToken = $_POST['csrf_token'] ?? '';
        
        // Get JSON body token
        $jsonToken = '';
        $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
        if (strpos($contentType, 'application/json') !== false) {
            $input = json_decode(file_get_contents('php://input'), true);
            $jsonToken = $input['csrf_token'] ?? '';
        }
        
        $submittedToken = $headerToken ?: ($postToken ?: $jsonToken);
        $sessionToken = self::getToken();
        
        return hash_equals($sessionToken, $submittedToken);
    }
    
    /**
     * Require valid CSRF token or die
     */
    public static function requireToken() {
        if (!self::validateToken()) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit();
        }
    }
}

/**
 * Session Management with Expiry
 */
class SessionManager {
    private static $timeout = 1800; // 30 minutes in seconds
    private static $lastActivityKey = 'last_activity';
    
    /**
     * Check if session is valid (not expired)
     */
    public static function isValid() {
        return !self::isExpired();
    }
    
    /**
     * Check if session is expired
     */
    public static function isExpired() {
        if (isset($_SESSION[self::$lastActivityKey])) {
            $elapsed = time() - $_SESSION[self::$lastActivityKey];
            return $elapsed > self::$timeout;
        }
        return false;
    }
    
    /**
     * Update last activity timestamp
     */
    public static function touch() {
        $_SESSION[self::$lastActivityKey] = time();
    }
    
    /**
     * Validate session or terminate
     */
    public static function requireValidSession() {
        if (self::isExpired()) {
            self::destroy();
            http_response_code(401);
            echo json_encode(['error' => 'Session expired']);
            exit();
        }
        self::touch();
    }
    
    /**
     * Destroy session
     */
    public static function destroy() {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
    }
}

/**
 * Rate Limiting (IP-based)
 */
class RateLimiter {
    private static $storageDir = __DIR__ . '/data/rate_limits/';
    private static $maxAttempts = 5;
    private static $lockoutTime = 900; // 15 minutes in seconds
    
    /**
     * Get client IP
     */
    private static function getClientIP() {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        // Handle proxies
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip = trim($ips[0]);
        }
        return $ip;
    }
    
    /**
     * Get rate limit file path
     */
    private static function getFilePath($identifier) {
        if (!is_dir(self::$storageDir)) {
            mkdir(self::$storageDir, 0755, true);
        }
        return self::$storageDir . md5($identifier) . '.json';
    }
    
    /**
     * Check if IP is rate limited
     */
    public static function isLimited($identifier = null) {
        $identifier = $identifier ?? self::getClientIP();
        $file = self::getFilePath($identifier);
        
        if (!file_exists($file)) {
            return false;
        }
        
        $data = json_decode(file_get_contents($file), true);
        $attempts = $data['attempts'] ?? 0;
        $lockoutUntil = $data['lockout_until'] ?? 0;
        
        // Check if still locked out
        if ($lockoutUntil > time()) {
            return true;
        }
        
        // Reset if lockout expired
        if ($lockoutUntil > 0 && $lockoutUntil <= time()) {
            unlink($file);
            return false;
        }
        
        return false;
    }
    
    /**
     * Record failed attempt
     */
    public static function recordAttempt($identifier = null) {
        $identifier = $identifier ?? self::getClientIP();
        $file = self::getFilePath($identifier);
        
        $data = ['attempts' => 1, 'lockout_until' => 0];
        
        if (file_exists($file)) {
            $existing = json_decode(file_get_contents($file), true);
            $data['attempts'] = ($existing['attempts'] ?? 0) + 1;
        }
        
        // Trigger lockout if max attempts reached
        if ($data['attempts'] >= self::$maxAttempts) {
            $data['lockout_until'] = time() + self::$lockoutTime;
        }
        
        file_put_contents($file, json_encode($data));
    }
    
    /**
     * Reset attempts (on successful login)
     */
    public static function reset($identifier = null) {
        $identifier = $identifier ?? self::getClientIP();
        $file = self::getFilePath($identifier);
        
        if (file_exists($file)) {
            unlink($file);
        }
    }
    
    /**
     * Require not rate limited or die
     */
    public static function requireNotLimited($identifier = null) {
        if (self::isLimited($identifier)) {
            http_response_code(429);
            echo json_encode(['error' => 'Too many requests. Please try again later.']);
            exit();
        }
    }
}

?>
