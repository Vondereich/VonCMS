<?php
/**
 * VonCMS - IndexNow Integration
 * Instantly notifies search engines (Bing, Yandex, etc.) when content is published/updated.
 *
 * @see https://www.indexnow.org/documentation
 */

// Prevent direct access
if (basename($_SERVER['PHP_SELF']) == basename(__FILE__)) {
  die('Direct access not allowed');
}

require_once __DIR__ . '/../settings_audit_helper.php';

class IndexNow
{
  // IndexNow API endpoints (all use the same protocol)
  private const ENDPOINTS = [
    'bing' => 'https://www.bing.com/indexnow',
    'yandex' => 'https://yandex.com/indexnow',
    // 'indexnow' => 'https://api.indexnow.org/indexnow', // Redundant, Bing/Yandex share pool
  ];

  private const KEY_LENGTH = 32; // 32 hex characters = 128 bits of entropy
  private const TIMEOUT_SECONDS = 3; // Max wait time for API response (performance critical)
  private const USER_AGENT = 'VonCMS IndexNow';

  private ?PDO $pdo;
  private string $host;
  private string $publicBaseUrl;

  public function __construct(?PDO $pdo = null)
  {
    $this->pdo = $pdo;
    $this->publicBaseUrl = $this->detectPublicBaseUrl();
    $this->host = (string) (parse_url($this->publicBaseUrl, PHP_URL_HOST) ?: $this->detectHost());
  }

  /**
   * Detect the host domain from server variables
   */
  private function detectHost(): string
  {
    $host = preg_replace(
      '/[^a-zA-Z0-9.\-:]/',
      '',
      (string) ($_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? 'localhost')),
    );
    return $host;
  }

  private function detectPublicBaseUrl(): string
  {
    if ($this->pdo) {
      try {
        $stmt = $this->pdo->prepare(
          "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'domain_url' LIMIT 1",
        );
        $stmt->execute();
        $configuredUrl = trim((string) ($stmt->fetchColumn() ?: ''));
        if (
          filter_var($configuredUrl, FILTER_VALIDATE_URL) &&
          in_array(
            strtolower((string) parse_url($configuredUrl, PHP_URL_SCHEME)),
            ['http', 'https'],
            true,
          )
        ) {
          return rtrim($configuredUrl, '/');
        }
      } catch (Exception $e) {
        // Fall back to the current request path.
      }
    }

    $scheme = is_https() ? 'https' : 'http';
    $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
    $basePath = dirname($scriptName);
    if (strpos($basePath, '/api') !== false) {
      $basePath = preg_replace('#/api(/.*)?$#i', '', $basePath);
    }
    $basePath = in_array($basePath, ['/', '\\', '.'], true) ? '' : rtrim((string) $basePath, '/');

    return $scheme . '://' . $this->detectHost() . $basePath;
  }

  /**
   * Get the expected key file path in the web root
   */
  private function getKeyFilePath(): string
  {
    // Navigate from /public/api/system/ to /public/
    $publicRoot = dirname(__DIR__, 2);
    return $publicRoot . '/' . $this->getKey() . '.txt';
  }

  private function getKeyLocationUrl(string $key): string
  {
    return $this->publicBaseUrl . '/' . rawurlencode($key) . '.txt';
  }

  /**
   * Generate a cryptographically secure API key
   *
   * @return string 32-character hex key
   */
  public static function generateKey(): string
  {
    return bin2hex(random_bytes(self::KEY_LENGTH / 2)); // 16 bytes = 32 hex chars
  }

  /**
   * Get the current IndexNow API key from settings
   *
   * @return string|null The key or null if not set
   */
  public function getKey(): ?string
  {
    if (!$this->pdo) {
      return null;
    }

    try {
      $stmt = $this->pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_group = 'seo' AND setting_key = 'indexnow_key' LIMIT 1",
      );
      $stmt->execute();
      $result = $stmt->fetch(PDO::FETCH_ASSOC);
      return $result ? $result['setting_value'] : null;
    } catch (Exception $e) {
      return null;
    }
  }

  /**
   * Check if IndexNow is enabled in settings
   *
   * @return bool
   */
  public function isEnabled(): bool
  {
    if (!$this->pdo) {
      return false;
    }

    try {
      $stmt = $this->pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_group = 'seo' AND setting_key = 'indexnow_enabled' LIMIT 1",
      );
      $stmt->execute();
      $result = $stmt->fetch(PDO::FETCH_ASSOC);
      return $result && ($result['setting_value'] === 'true' || $result['setting_value'] === '1');
    } catch (Exception $e) {
      return false;
    }
  }

  /**
   * Save a new IndexNow API key to settings
   *
   * @param string $key The API key to save
   * @return bool Success status
   */
  public function saveKey(string $key): bool
  {
    if (!$this->pdo || strlen($key) !== self::KEY_LENGTH) {
      return false;
    }

    try {
      $auditBefore = voncms_get_setting_audit_snapshot($this->pdo, 'seo', 'indexnow_key');
      $stmt = $this->pdo->prepare("
                INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, is_public, version)
                VALUES ('seo', 'indexnow_key', ?, 'string', 0, 1)
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    version = version + 1,
                    updated_at = NOW()
            ");
      $saved = $stmt->execute([$key]);
      if ($saved) {
        voncms_record_setting_audit(
          $this->pdo,
          'seo',
          'indexnow_key',
          $auditBefore,
          $key,
          isset($_SESSION['user']['id']) ? (int) $_SESSION['user']['id'] : null,
        );
      }

      return $saved;
    } catch (Exception $e) {
      return false;
    }
  }

  /**
   * Create the key verification file at web root
   * IndexNow requires this file to verify ownership
   *
   * @param string $key The API key
   * @return bool Success status
   */
  public function createKeyFile(string $key): bool
  {
    $publicRoot = dirname(__DIR__, 2);
    $filePath = $publicRoot . '/' . $key . '.txt';

    // Auto-Cleanup: Remove old key files to prevent clutter
    $this->cleanupOldKeys($publicRoot, $key);

    try {
      // The file content must be the key itself (per IndexNow spec)
      if (@file_put_contents($filePath, $key) === false) {
        $error = error_get_last();
        throw new Exception(
          'Failed to write IndexNow key file: ' .
            ($error['message'] ?? 'Check directory permissions.'),
        );
      }
      return true;
    } catch (Exception $e) {
      throw $e;
    }
  }

  /**
   * Remove old IndexNow verification files
   * Scans for 32-char hex .txt files and deletes them
   */
  private function cleanupOldKeys(string $directory, string $currentKey): void
  {
    try {
      $files = glob($directory . '/*.txt');
      foreach ($files as $file) {
        $filename = basename($file, '.txt');
        // Check if filename matches 32-char hex usage (IndexNow format)
        if (preg_match('/^[a-f0-9]{32}$/', $filename)) {
          // Don't delete the current key if it already exists
          if ($filename !== $currentKey) {
            @unlink($file);
          }
        }
      }
    } catch (Exception $e) {
      // Passive failure - don't stop execution
    }
  }

  /**
   * Check if the key verification file exists
   *
   * @return bool
   */
  public function keyFileExists(): bool
  {
    $key = $this->getKey();
    if (!$key) {
      return false;
    }

    $publicRoot = dirname(__DIR__, 2);
    $filePath = $publicRoot . '/' . $key . '.txt';
    return file_exists($filePath);
  }

  /**
   * Ping IndexNow with a single URL
   *
   * @param string $url The full URL to submit (e.g., https://example.com/my-post)
   * @return array Result with 'success', 'status_code', 'message'
   */
  public function ping(string $url): array
  {
    if (!$this->isEnabled()) {
      return ['success' => false, 'message' => 'IndexNow is disabled'];
    }

    $key = $this->getKey();
    if (!$key) {
      return ['success' => false, 'message' => 'IndexNow API key not configured'];
    }

    // Validate URL
    $url = filter_var($url, FILTER_VALIDATE_URL);
    if (!$url) {
      return ['success' => false, 'message' => 'Invalid URL format'];
    }

    // Build the IndexNow request URL
    // Format: https://www.bing.com/indexnow?url=<url>&key=<key>
    $endpoint = self::ENDPOINTS['bing']; // We only need to ping one (they share the pool)
    $requestUrl =
      $endpoint .
      '?' .
      http_build_query([
        'url' => $url,
        'key' => $key,
        'keyLocation' => $this->getKeyLocationUrl($key),
      ]);

    // Use cURL with strict timeout
    $ch = curl_init();
    curl_setopt_array($ch, [
      CURLOPT_URL => $requestUrl,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT => self::TIMEOUT_SECONDS,
      CURLOPT_CONNECTTIMEOUT => 2,
      CURLOPT_FOLLOWLOCATION => false,
      CURLOPT_SSL_VERIFYPEER => true,
      CURLOPT_USERAGENT => self::USER_AGENT,
    ]);

    $response = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    if ($error) {
      return ['success' => false, 'message' => 'cURL error: ' . $error, 'status_code' => 0];
    }

    // IndexNow returns:
    // 200 = URL submitted successfully
    // 202 = URL received, will be checked later
    // 400 = Invalid request
    // 403 = Key not valid (needs verification file)
    // 422 = URL doesn't match key location
    // 429 = Too many requests (rate limited)
    $success = in_array($statusCode, [200, 202]);

    return [
      'success' => $success,
      'status_code' => $statusCode,
      'message' => $success
        ? 'URL submitted to IndexNow'
        : 'IndexNow returned status ' . $statusCode,
    ];
  }

  /**
   * Ping IndexNow with multiple URLs (batch)
   *
   * @param array $urls Array of full URLs
   * @return array Result with 'success', 'status_code', 'message'
   */
  public function pingBatch(array $urls): array
  {
    if (!$this->isEnabled()) {
      return ['success' => false, 'message' => 'IndexNow is disabled'];
    }

    $key = $this->getKey();
    if (!$key) {
      return ['success' => false, 'message' => 'IndexNow API key not configured'];
    }

    // Validate and filter URLs
    $validUrls = array_filter($urls, function ($url) {
      return filter_var($url, FILTER_VALIDATE_URL) !== false;
    });

    if (empty($validUrls)) {
      return ['success' => false, 'message' => 'No valid URLs to submit'];
    }

    // Batch endpoint uses POST with JSON body
    $endpoint = self::ENDPOINTS['bing'];
    $payload = [
      'host' => $this->host,
      'key' => $key,
      'keyLocation' => $this->getKeyLocationUrl($key),
      'urlList' => array_values($validUrls),
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
      CURLOPT_URL => $endpoint,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_POSTFIELDS => json_encode($payload),
      CURLOPT_HTTPHEADER => ['Content-Type: application/json; charset=utf-8'],
      CURLOPT_TIMEOUT => self::TIMEOUT_SECONDS,
      CURLOPT_CONNECTTIMEOUT => 2,
      CURLOPT_SSL_VERIFYPEER => true,
      CURLOPT_USERAGENT => self::USER_AGENT,
    ]);

    $response = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    if ($error) {
      return ['success' => false, 'message' => 'cURL error: ' . $error, 'status_code' => 0];
    }

    $success = in_array($statusCode, [200, 202]);

    return [
      'success' => $success,
      'status_code' => $statusCode,
      'message' => $success
        ? count($validUrls) . ' URLs submitted to IndexNow'
        : 'IndexNow returned status ' . $statusCode,
      'submitted_count' => count($validUrls),
    ];
  }

  /**
   * Build the full URL for a post given its slug
   *
   * @param string $slug The post slug
   * @return string The full URL
   */
  public function buildPostUrl(string $slug): string
  {
    return $this->publicBaseUrl . '/' . ltrim($slug, '/');
  }

  public function buildPostUrlForPost(int $postId): string
  {
    if (!$this->pdo) {
      throw new RuntimeException('Database not configured');
    }

    $stmt = $this->pdo->prepare(
      'SELECT id, slug, category, created_at FROM posts WHERE id = ? LIMIT 1',
    );
    $stmt->execute([$postId]);
    $post = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$post) {
      throw new RuntimeException('Post not found');
    }

    $permalinkStyle = 'slug';
    $stmt = $this->pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'permalink_structure' LIMIT 1",
    );
    $stmt->execute();
    $savedPermalinkStyle = trim((string) ($stmt->fetchColumn() ?: ''));
    if ($savedPermalinkStyle !== '') {
      $permalinkStyle = $savedPermalinkStyle;
    }

    $slug = trim((string) ($post['slug'] ?? '')) ?: (string) $post['id'];
    $path = '/' . $slug;
    $createdAt = !empty($post['created_at']) ? new DateTime((string) $post['created_at']) : null;

    switch ($permalinkStyle) {
      case 'date':
      case 'day_name':
        if ($createdAt) {
          $path = '/' . $createdAt->format('Y/m/d') . '/' . $slug;
        }
        break;
      case 'month_name':
        if ($createdAt) {
          $path = '/' . $createdAt->format('Y/m') . '/' . $slug;
        }
        break;
      case 'category':
        $category = html_entity_decode(
          trim((string) ($post['category'] ?? 'uncategorized')),
          ENT_QUOTES | ENT_HTML5,
          'UTF-8',
        );
        $category = function_exists('mb_strtolower')
          ? mb_strtolower($category, 'UTF-8')
          : strtolower($category);
        $category = preg_replace('/[^\p{L}\p{N}\s_-]+/u', '', $category);
        $category = str_replace('_', ' ', (string) $category);
        $category = preg_replace('/\s+/u', '-', (string) $category);
        $category = trim((string) preg_replace('/-+/', '-', (string) $category), '-');
        $path = '/' . ($category !== '' ? $category : 'uncategorized') . '/' . $slug;
        break;
      case 'plain':
        $path = '/post/' . $post['id'];
        break;
    }

    return $this->publicBaseUrl . $path;
  }
}
