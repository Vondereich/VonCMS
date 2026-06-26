<?php
/**
 * VonCMS System Updater
 *
 * Handles safe OTA updates from GitHub Releases.
 */

// 1. LOAD SECURITY FIRST
require_once __DIR__ . '/../../security.php';

// 2. SEND HEADERS IMMEDIATELY
sendApiHeaders('POST, OPTIONS');

// 3. EXIT FOR PREFLIGHT
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// 4. LOAD CONFIG LAST
if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

// STRICT SECURITY CHECK: OTA updates can replace application code.
SessionManager::requirePrimaryAdmin();

class SystemUpdater
{
  /** @var string */
  private $rootPath;

  /** @var string */
  private $tempPath;

  /** @var string */
  private $backupPath;

  /** @var string */
  private $logFile;

  /** @var array<int, string> */
  private $logMessages = [];

  // FILES TO NEVER TOUCH (Files AND Directories)
  /** @var array<int, string> */
  private $protected = [
    'von_config.php',
    'von_config.sample.php',
    '.htaccess',
    '.env',
    'data',
    'uploads',
    'backups',
    'public/data',
    'public/uploads',
    '.git',
    'node_modules',
  ];

  public function __construct()
  {
    // SMART ROOT DETECTION: Compatible with all VonCMS deployment structures
    // __DIR__ = .../api/system
    // /..     = .../api
    // /../..  = .../public (in standard deployment) or .../project_root (in Vite/dev)
    $this->rootPath = realpath(__DIR__ . '/../..');
    if (!$this->rootPath) {
      $this->rootPath = dirname(__DIR__, 2);
    }

    // SMART DETECTION: Are we sitting in a nested 'public' folder?
    // If so, our project root is actually one level up, but we want to update THIS level.
    // However, if we find another 'public/api' INSIDE here, it means we are in a dev structure.
    if (is_dir($this->rootPath . '/public/api')) {
      $this->rootPath = $this->rootPath . '/public';
    }

    $this->tempPath = $this->rootPath . '/temp_update';
    $this->backupPath = $this->rootPath . '/backups';
    $this->logFile = __DIR__ . '/updater_debug.log'; // Local log file

    // Ensure paths exist
    if (!file_exists($this->backupPath)) {
      mkdir($this->backupPath, 0755, true);
    }
  }

  /**
   * @param string $msg
   * @return void
   */
  private function log($msg)
  {
    $entry = '[' . date('Y-m-d H:i:s') . '] ' . $msg;
    $this->logMessages[] = $entry;
    @file_put_contents($this->logFile, $entry . PHP_EOL, FILE_APPEND);
  }

  /**
   * @return array<string, mixed>
   */
  public function checkPermissions()
  {
    $this->log('Checking permissions...');
    if (!class_exists('ZipArchive')) {
      return [
        'root_writable' => false,
        'root_path' => $this->rootPath,
        'error' => 'PHP ZipArchive extension is missing. Please enable it in php.ini.',
      ];
    }

    $rootWritable = is_writable($this->rootPath);

    // Double check for Windows: try to write a temp file
    if (!$rootWritable) {
      $testFile = $this->rootPath . '/.perm_test';
      if (@file_put_contents($testFile, 'test') !== false) {
        $rootWritable = true;
        @unlink($testFile);
      }
    }

    return [
      'root_writable' => $rootWritable,
      'root_path' => $this->rootPath, // Debug info
      'api_writable' => is_writable($this->rootPath . '/api'),
      'assets_writable' => is_writable($this->rootPath . '/assets'),
    ];
  }

  /**
   * @param string $version
   * @param string $downloadUrl
   * @param string|null $expectedHash
   * @return array<string, mixed>
   */
  public function startUpdate($version, $downloadUrl, $expectedHash = null)
  {
    $this->log("Starting update process to v$version...");
    ignore_user_abort(true); // Keep running even if connection drops
    set_time_limit(300);

    try {
      // Pre-check ZipArchive
      if (!class_exists('ZipArchive')) {
        throw new Exception('PHP ZipArchive extension is missing. Please enable it in php.ini.');
      }

      // 0. Security Validation
      $this->validateUrl($downloadUrl);

      // 1. Pre-flight Checks
      $this->log('Step 1: Pre-flight checks');
      if (!is_writable($this->rootPath)) {
        throw new Exception('Root directory is not writable. Check permissions.');
      }

      // 2. Download Zip
      $this->log("Step 2: Downloading zip from $downloadUrl");
      $resolvedHash = $this->resolveExpectedHash($version, $downloadUrl, $expectedHash);
      $zipFile = $this->downloadFile($downloadUrl, $resolvedHash);
      $this->log("Download complete: $zipFile");

      // 3. Create Backup
      $this->log('Step 3: Creating backup');
      $this->createBackup();
      $this->log('Backup created');

      // 4. Extract & Verify
      $this->log('Step 4: Extracting update');
      $this->extractUpdate($zipFile);
      $this->log('Extraction complete');

      // 5. ATOMIC SWAP (The scary part)
      $this->log('Step 5: Performing swap');
      $this->performSwap();
      $this->log('Swap complete');

      // 6. Cleanup
      $this->log('Step 6: Cleanup');
      $this->cleanup();
      $this->log('Update Process Finished Successfully');

      return [
        'status' => 'success',
        'message' => "Successfully updated to $version",
        'logs' => $this->logMessages,
      ];
    } catch (Throwable $e) {
      $this->log('CRITICAL ERROR: ' . $e->getMessage());
      $this->cleanup(); // Always cleanup temp files
      return [
        'status' => 'error',
        'message' => $e->getMessage(),
        'debug' => basename($e->getFile()) . ':' . $e->getLine(),
        'logs' => $this->logMessages,
      ];
    }
  }

  /**
   * @param string $url
   * @return void
   */
  private function validateUrl($url)
  {
    $host = (string) (parse_url($url, PHP_URL_HOST) ?? '');
    $allowedHosts = [
      'github.com',
      'api.github.com',
      'codeload.github.com',
      'release-assets.githubusercontent.com',
      'objects.githubusercontent.com',
    ];

    if (!in_array($host, $allowedHosts)) {
      throw new Exception('Invalid download source. Only GitHub is allowed.');
    }

    // Additional protocol check
    if (!preg_match('/^https:\/\//', $url)) {
      throw new Exception('HTTPS is required for updates.');
    }
  }

  /**
   * @param string $location
   * @param string $currentUrl
   * @return string
   */
  private function resolveRedirectUrl($location, $currentUrl)
  {
    $location = trim((string) $location);
    if ($location === '') {
      throw new Exception('Download redirected without a Location header.');
    }

    if (preg_match('/^https?:\/\//i', $location)) {
      $this->validateUrl($location);
      return $location;
    }

    $scheme = (string) (parse_url($currentUrl, PHP_URL_SCHEME) ?? 'https');
    $host = (string) (parse_url($currentUrl, PHP_URL_HOST) ?? '');
    if (strpos($location, '//') === 0) {
      $resolved = $scheme . ':' . $location;
      $this->validateUrl($resolved);
      return $resolved;
    }

    if ($host === '') {
      throw new Exception('Download redirect could not be resolved.');
    }

    if (strpos($location, '/') === 0) {
      $resolved = $scheme . '://' . $host . $location;
    } else {
      $path = (string) (parse_url($currentUrl, PHP_URL_PATH) ?? '/');
      $basePath = rtrim(str_replace('\\', '/', dirname($path)), '/');
      $resolved = $scheme . '://' . $host . ($basePath === '' ? '' : $basePath) . '/' . $location;
    }

    $this->validateUrl($resolved);
    return $resolved;
  }

  /**
   * @param string $url
   * @param string $accept
   * @param string|null $saveTo
   * @param int $timeout
   * @param int $connectTimeout
   * @return array{status: int, body: string}
   */
  private function fetchWithValidatedRedirects(
    $url,
    $accept = 'application/octet-stream',
    $saveTo = null,
    $timeout = 60,
    $connectTimeout = 15,
  ) {
    $currentUrl = $url;
    $maxRedirects = 5;

    for ($redirects = 0; $redirects <= $maxRedirects; $redirects++) {
      $this->validateUrl($currentUrl);

      $handle = null;
      if ($saveTo !== null) {
        $handle = fopen($saveTo, 'w+');
        if (!$handle) {
          throw new Exception("Cannot create temp file: $saveTo");
        }
      }

      $redirectLocation = '';
      $currentStatus = 0;
      $responseBody = '';

      $ch = curl_init($currentUrl);
      curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => $saveTo === null,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_USERAGENT => 'VonCMS-Updater/1.0',
        CURLOPT_HTTPHEADER => ['Accept: ' . $accept],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => $connectTimeout,
        CURLOPT_HEADERFUNCTION => function ($curlHandle, $headerLine) use (
          &$redirectLocation,
          &$currentStatus,
        ) {
          $trimmed = trim($headerLine);
          if (preg_match('~^HTTP/\S+\s+(\d{3})~i', $trimmed, $matches)) {
            $currentStatus = (int) $matches[1];
            $redirectLocation = '';
          } elseif (stripos($trimmed, 'Location:') === 0) {
            $redirectLocation = trim(substr($trimmed, 9));
          }

          return strlen($headerLine);
        },
      ]);

      if ($handle !== null) {
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($curlHandle, $data) use (
          $handle,
          &$currentStatus,
        ) {
          if ($currentStatus >= 300 && $currentStatus < 400) {
            return strlen($data);
          }

          $written = fwrite($handle, $data);
          return $written === false ? 0 : $written;
        });
      }

      if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
        curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
      }

      if (defined('CURLOPT_REDIR_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
        curl_setopt($ch, CURLOPT_REDIR_PROTOCOLS, CURLPROTO_HTTPS);
      }

      $result = curl_exec($ch);
      $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
      $curlError = curl_error($ch);

      if ($handle !== null) {
        fclose($handle);
      } elseif (is_string($result)) {
        $responseBody = $result;
      }

      if ($result === false || $curlError) {
        throw new Exception('Download failed: ' . ($curlError ?: 'Unknown cURL failure'));
      }

      if ($httpCode >= 300 && $httpCode < 400) {
        if ($redirects >= $maxRedirects) {
          throw new Exception('Download redirected too many times.');
        }

        if ($saveTo !== null) {
          @file_put_contents($saveTo, '');
        }
        $currentUrl = $this->resolveRedirectUrl($redirectLocation, $currentUrl);
        continue;
      }

      return [
        'status' => $httpCode,
        'body' => $responseBody,
      ];
    }

    throw new Exception('Download redirected too many times.');
  }

  /**
   * @param mixed $value
   * @return string|null
   */
  private function normalizeSha256($value)
  {
    $value = strtolower(trim((string) $value));
    if (strpos($value, 'sha256:') === 0) {
      $value = substr($value, 7);
    }

    return preg_match('/^[a-f0-9]{64}$/', $value) ? $value : null;
  }

  /**
   * @param string $url
   * @param string $accept
   * @return array{status: int, body: string}
   */
  private function downloadRemoteBody($url, $accept = 'application/octet-stream')
  {
    return $this->fetchWithValidatedRedirects($url, $accept, null, 60, 15);
  }

  /**
   * @param string $version
   * @param string $downloadUrl
   * @param string|null $expectedHash
   * @return string
   */
  private function resolveExpectedHash($version, $downloadUrl, $expectedHash = null)
  {
    $normalizedHash = $this->normalizeSha256($expectedHash);
    if ($normalizedHash) {
      $this->log('Using caller-supplied SHA256 digest.');
      return $normalizedHash;
    }

    $sidecarUrl = $downloadUrl . '.sha256';
    try {
      $sidecar = $this->downloadRemoteBody($sidecarUrl, 'text/plain');
      if (
        $sidecar['status'] === 200 &&
        preg_match('/([a-fA-F0-9]{64})/', $sidecar['body'], $matches)
      ) {
        $sidecarHash = $this->normalizeSha256($matches[1]);
        if ($sidecarHash) {
          $this->log('Resolved SHA256 digest from sidecar checksum asset.');
          return $sidecarHash;
        }
      }
    } catch (Throwable $e) {
      $this->log('Sidecar checksum lookup skipped: ' . $e->getMessage());
    }

    $normalizedVersion = preg_replace('/^v\.?/i', '', (string) $version);
    $tagCandidates = array_values(
      array_unique(
        array_filter([
          $version,
          $normalizedVersion !== '' ? 'v' . $normalizedVersion : '',
          $normalizedVersion !== '' ? 'v.' . $normalizedVersion : '',
        ]),
      ),
    );

    foreach ($tagCandidates as $tag) {
      try {
        $release = $this->downloadRemoteBody(
          'https://api.github.com/repos/Vondereich/VonCMS/releases/tags/' . rawurlencode($tag),
          'application/vnd.github+json',
        );

        if ($release['status'] !== 200) {
          continue;
        }

        $releaseData = json_decode($release['body'], true);
        if (
          !is_array($releaseData) ||
          !isset($releaseData['assets']) ||
          !is_array($releaseData['assets'])
        ) {
          continue;
        }

        foreach ($releaseData['assets'] as $asset) {
          if (($asset['browser_download_url'] ?? '') !== $downloadUrl) {
            continue;
          }

          $assetHash = $this->normalizeSha256($asset['digest'] ?? ($asset['sha256'] ?? ''));
          if ($assetHash) {
            $this->log('Resolved SHA256 digest from GitHub release metadata.');
            return $assetHash;
          }
        }
      } catch (Throwable $e) {
        $this->log('GitHub release digest lookup skipped for ' . $tag . ': ' . $e->getMessage());
      }
    }

    throw new Exception(
      'Integrity check failed: No SHA256 digest is available for this release package.',
    );
  }

  /**
   * @param string $url
   * @param string $expectedHash
   * @return string
   */
  private function downloadFile($url, $expectedHash)
  {
    // Increase execution time for large downloads
    set_time_limit(300); // 5 minutes

    $saveTo = $this->tempPath . '/update.zip';
    if (!file_exists($this->tempPath)) {
      mkdir($this->tempPath, 0755, true);
    }

    $download = $this->fetchWithValidatedRedirects(
      $url,
      'application/octet-stream',
      $saveTo,
      300,
      30,
    );
    $httpCode = $download['status'];

    if ($httpCode !== 200) {
      throw new Exception("Download failed: HTTP $httpCode");
    }

    // Verify file was downloaded
    if (!file_exists($saveTo) || filesize($saveTo) < 1000) {
      throw new Exception('Download incomplete or file too small');
    }
    // OTA updater integrity check
    $expectedHash = $this->normalizeSha256($expectedHash);
    if (!$expectedHash) {
      throw new Exception('Integrity check failed: Missing or invalid SHA256 digest.');
    }

    $actualHash = hash_file('sha256', $saveTo);
    if (!hash_equals($expectedHash, $actualHash)) {
      throw new Exception('Integrity check failed: Update package hash mismatch.');
    }
    $this->log('Integrity check passed (SHA256 verified)');

    return $saveTo;
  }

  /**
   * @return void
   */
  private function createBackup()
  {
    $timestamp = date('Y-m-d_H-i-s');
    $backupFile = $this->backupPath . "/pre_update_$timestamp.zip";

    $zip = new ZipArchive();
    if ($zip->open($backupFile, ZipArchive::CREATE) !== true) {
      throw new Exception('Could not create backup zip.');
    }

    // Determine what to backup (Core folders only to save time?)
    $this->addFolderToZip($this->rootPath . '/assets', $zip, 'assets');
    $this->addFolderToZip($this->rootPath . '/api', $zip, 'api');
    if (file_exists($this->rootPath . '/index.html')) {
      $zip->addFile($this->rootPath . '/index.html', 'index.html');
    }
    if (file_exists($this->rootPath . '/.htaccess')) {
      $zip->addFile($this->rootPath . '/.htaccess', '.htaccess');
    }

    $zip->close();
  }

  /**
   * @param string $zipFile
   * @return void
   */
  private function extractUpdate($zipFile)
  {
    $zip = new ZipArchive();
    if ($zip->open($zipFile) === true) {
      $extractPath = $this->tempPath . '/extracted';
      $zip->extractTo($extractPath);
      $zip->close();
    } else {
      throw new Exception('Failed to open update ZIP.');
    }
  }

  /**
   * @param mixed $path
   * @return string
   */
  private function normalizeRelativePath($path)
  {
    return trim(str_replace('\\', '/', ltrim((string) $path, './')), '/');
  }

  /**
   * @param string $relativePath
   * @return bool
   */
  private function isProtectedPath($relativePath)
  {
    $normalized = $this->normalizeRelativePath($relativePath);
    if ($normalized === '') {
      return false;
    }

    // Preserve any existing .htaccess file, even in nested custom folders.
    if (basename($normalized) === '.htaccess') {
      return true;
    }

    foreach ($this->protected as $item) {
      if ($normalized === $this->normalizeRelativePath($item)) {
        return true;
      }
    }

    return false;
  }

  /**
   * @return void
   */
  private function performSwap()
  {
    $sourceBase = $this->tempPath . '/extracted';
    $this->log("Swap started. Base: $sourceBase");

    $source = $this->findDeepRoot($sourceBase);

    if (!$source) {
      $items = is_dir($sourceBase) ? scandir($sourceBase) : ['dir_not_found'];
      $this->log(
        'Error: Could not find valid update root. Items in base: ' . implode(', ', $items),
      );
      throw new Exception('Update package structure is invalid (Missing assets or public folder).');
    }

    $this->log('Syncing from discovered root: ' . $source);
    $dest = $this->rootPath;
    $this->log('Dest Root: ' . $dest);

    // Scan source and copy everything except protected files
    $items = scandir($source);
    foreach ($items as $item) {
      if ($item === '.' || $item === '..' || $item === '__MACOSX') {
        continue;
      }

      // SECURITY: Never overwrite protected files (von_config.php, etc.)
      if ($this->isProtectedPath($item)) {
        $this->log("Skipping protected item: $item");
        continue;
      }

      $srcItem = $source . '/' . $item;
      $dstItem = $dest . '/' . $item;

      if (is_dir($srcItem)) {
        $this->log("Syncing directory: $item");

        // SPECIAL CASE: 'assets' folder (Delete-First Strategy)
        // This ensures we don't have orphaned JS/CSS files from previous versions
        if ($item === 'assets') {
          if (is_dir($dstItem)) {
            $this->log('Cleaning old assets folder for fresh sync...');
            $this->recursiveDelete($dstItem);
          }
        }

        $this->recursiveCopy($srcItem, $dstItem, $item);
      } else {
        $this->log("Syncing file: $item");
        $this->forceCopyFile($srcItem, $dstItem);
      }
    }

    $this->log('Swap Finished Successfully');
  }

  /**
   * @param string $dir
   * @return string|null
   */
  private function findDeepRoot($dir)
  {
    if (!is_dir($dir)) {
      return null;
    }
    $items = @scandir($dir);
    if ($items === false) {
      return null;
    }

    $filtered = array_diff($items, ['.', '..', '__MACOSX']);

    // Check if this dir is a root
    if (
      in_array('assets', $filtered) ||
      in_array('public', $filtered) ||
      in_array('index.html', $filtered)
    ) {
      return $dir;
    }

    // Search deeper
    foreach ($filtered as $item) {
      $path = $dir . '/' . $item;
      if (is_dir($path)) {
        $root = $this->findDeepRoot($path);
        if ($root) {
          return $root;
        }
      }
    }

    return null;
  }

  // Atomic Force Copy with Rename-Aside Strategy
  /**
   * @param string $src
   * @param string $dst
   * @return bool
   */
  private function forceCopyFile($src, $dst)
  {
    if (!@copy($src, $dst)) {
      // Unlink failed or File Locked? Try Rename-Aside
      if (file_exists($dst)) {
        $trash = $dst . '.trash.' . uniqid();
        if (@rename($dst, $trash)) {
          if (!@copy($src, $dst)) {
            $this->log("Error: Critical - Could not copy to $dst even after rename.");
            return false;
          }
          $this->log('Force Updated: ' . basename($dst));
          return true;
        } else {
          $this->log("Error: Critical lock on $dst. Cannot rename.");
          return false;
        }
      }
      return false;
    }
    return true;
  }

  // --- Helpers ---

  /**
   * @param string $dir
   * @param ZipArchive $zipArchive
   * @param string $zipDir
   * @return void
   */
  private function addFolderToZip($dir, $zipArchive, $zipDir)
  {
    if (!is_dir($dir)) {
      return;
    }
    $files = new RecursiveIteratorIterator(
      new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
      RecursiveIteratorIterator::SELF_FIRST,
    );

    foreach ($files as $file) {
      $file = realpath($file);
      $relativePath = substr($file, strlen(realpath($dir)) + 1);
      if ($file == realpath($dir)) {
        continue;
      } // Ignore self

      if (is_dir($file)) {
        $zipArchive->addEmptyDir("$zipDir/$relativePath");
      } elseif (is_file($file)) {
        $zipArchive->addFile($file, "$zipDir/$relativePath");
      }
    }
  }

  /**
   * @param string $dir
   * @return void
   */
  private function recursiveDelete($dir)
  {
    if (!is_dir($dir)) {
      return;
    }
    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
      is_dir("$dir/$file") ? $this->recursiveDelete("$dir/$file") : unlink("$dir/$file");
    }
    rmdir($dir);
  }

  /**
   * @param string $srcDir
   * @param string $dstDir
   * @return void
   */
  private function cleanOrphanedFiles($srcDir, $dstDir)
  {
    if (!is_dir($dstDir)) {
      return;
    }

    $files = scandir($dstDir);
    foreach ($files as $file) {
      if ($file === '.' || $file === '..') {
        continue;
      }

      $srcFile = $srcDir . '/' . $file;
      $dstFile = $dstDir . '/' . $file;

      if (is_dir($dstFile)) {
        // Determine if we should recursively clean
        $this->cleanOrphanedFiles($srcFile, $dstFile);
        // If directory is empty now, remove it
        if (count(scandir($dstFile)) <= 2) {
          @rmdir($dstFile);
        }
      } else {
        // If file does NOT exist in source, it's garbage. Delete it.
        if (!file_exists($srcFile)) {
          // Suppress errors (in case of file locking)
          @unlink($dstFile);
        }
      }
    }
  }

  /**
   * @param string $src
   * @param string $dst
   * @param string $relativeBase
   * @return void
   */
  private function recursiveCopy($src, $dst, $relativeBase = '')
  {
    if (!is_dir($src)) {
      $this->log("Warning: Source not found for copy: $src");
      return;
    }

    $dir = opendir($src);
    if ($dir === false) {
      $this->log("Error: Failed to open dir: $src");
      return;
    }

    if (!file_exists($dst)) {
      @mkdir($dst, 0755, true);
    }

    while (false !== ($file = readdir($dir))) {
      if ($file != '.' && $file != '..') {
        $relativePath = $relativeBase === '' ? $file : $relativeBase . '/' . $file;

        if ($this->isProtectedPath($relativePath)) {
          $this->log('Skipping protected item: ' . $relativePath);
          continue;
        }

        if (is_dir($src . '/' . $file)) {
          $this->recursiveCopy($src . '/' . $file, $dst . '/' . $file, $relativePath);
        } else {
          if (!@copy($src . '/' . $file, $dst . '/' . $file)) {
            $this->log('Warning: Failed to copy ' . $relativePath);
            // Don't throw - API files may have locks but aren't critical for frontend
          }
        }
      }
    }
    closedir($dir);
  }

  /**
   * @param string $src
   * @param string $dst
   * @param string $relativeBase
   * @return void
   */
  private function forceRecursiveCopy($src, $dst, $relativeBase = '')
  {
    if (!is_dir($dst)) {
      @mkdir($dst, 0755, true);
    }

    $dir = opendir($src);
    if ($dir === false) {
      return;
    }

    while (false !== ($file = readdir($dir))) {
      if ($file != '.' && $file != '..') {
        $relativePath = $relativeBase === '' ? $file : $relativeBase . '/' . $file;

        if ($this->isProtectedPath($relativePath)) {
          $this->log('Skipping protected item: ' . $relativePath);
          continue;
        }

        $srcFile = $src . '/' . $file;
        $dstFile = $dst . '/' . $file;

        if (is_dir($srcFile)) {
          $this->forceRecursiveCopy($srcFile, $dstFile, $relativePath);
        } else {
          // Try to copy directly
          if (!@copy($srcFile, $dstFile)) {
            // If Failed (Assume Locked): Try Rename-Aside
            if (file_exists($dstFile)) {
              $trashFile = $dstFile . '.trash.' . time();
              if (@rename($dstFile, $trashFile)) {
                // Rename succeeeded, now Copy
                if (!@copy($srcFile, $dstFile)) {
                  $this->log("Error: Failed to copy $relativePath even after rename-aside.");
                  throw new Exception("Critical: Cannot copy $relativePath after rename");
                } else {
                  $this->log("Force Updated: $relativePath (Original moved to trash)");
                }
              } else {
                $this->log("Error: Critical Lock on $relativePath. Cannot rename or overwrite.");
                throw new Exception("Critical: File locked - $relativePath");
              }
            } else {
              // File doesn't exist at destination but copy still failed
              $this->log("Error: Cannot copy $relativePath (Permission denied or source missing)");
              throw new Exception("Critical: Copy failed - $relativePath");
            }
          }
        }
      }
    }
    closedir($dir);
  }

  /**
   * @return void
   */
  private function cleanup()
  {
    if (is_dir($this->tempPath)) {
      $this->recursiveDelete($this->tempPath);
    }
  }
}

// REQUEST HANDLER - Wrapped in try-catch for safety
if (!defined('IN_API')) {
  ob_start(); // Start output buffering

  try {
    $action = $_GET['action'] ?? '';
    $updater = new SystemUpdater();

    if ($action === 'check') {
      $permissions = $updater->checkPermissions();
      // Return CSRF token for the next step
      ob_end_clean(); // Clear any stray output
      echo json_encode([
        'status' => 'success',
        'data' => $permissions,
        'csrf_token' => CSRFProtection::getToken(),
      ]);
    } elseif ($action === 'start') {
      // Only accept POST for destructive actions
      if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        ob_end_clean();
        die(
          json_encode([
            'error' => 'POST required',
            'received_method' => $_SERVER['REQUEST_METHOD'],
            'request_uri' => $_SERVER['REQUEST_URI'],
          ])
        );
      }

      // Read input ONCE and store it
      $rawInput = CSRFProtection::getRequestBody();
      $input = json_decode($rawInput, true);

      // CSRF validation - check token from JSON body or header
      $csrfToken = $input['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
      $sessionToken = CSRFProtection::getToken();

      if (!$csrfToken || !hash_equals($sessionToken, $csrfToken)) {
        ob_end_clean();
        die(
          json_encode([
            'error' => 'CSRF token validation failed',
            'received' => substr($csrfToken, 0, 10) . '...',
          ])
        );
      }

      $url = $input['download_url'] ?? '';
      $version = $input['version'] ?? 'unknown';
      $expectedHash = $input['expected_hash'] ?? null;

      if (!$url) {
        ob_end_clean();
        ResponseHelper::sendError('No download URL provided', 400);
      }

      $result = $updater->startUpdate($version, $url, $expectedHash);
      ob_end_clean(); // Clear buffer before output
      echo json_encode($result);
    } else {
      ob_end_clean();
      if (!isset($pdo)) {
        ResponseHelper::sendError('Database not configured', 503);
      }
    }
  } catch (Throwable $e) {
    // Catch ANY error (including fatal errors in PHP 7+)
    ob_end_clean(); // Clear buffer
    ResponseHelper::sendError('Server error: ' . $e->getMessage(), 500);
  }
}
