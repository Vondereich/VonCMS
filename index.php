<?php
/**
 * VonCMS - Server-Side SEO Engine
 * Handles dynamic meta tags for better search engine crawling
 */

$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\') . '/';
if ($basePath === '//') $basePath = '/';

// ============================================
// SERVER-SIDE SEO ENGINE
// ============================================

// Default SEO values (white-label friendly)
$seoTitle = 'My Website';
$seoDescription = 'Built with CMS Core';
$seoKeywords = '';
$seoImage = '';

// Try to load site settings from database
try {
    $configFile = __DIR__ . '/von_config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
        
        if (isset($pdo)) {
            // Get site name from settings
            $stmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'site_name' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['setting_value'])) {
                $seoTitle = $row['setting_value'];
            }
            
            // Get site description
            $stmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'site_description' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['setting_value'])) {
                $seoDescription = $row['setting_value'];
            }
            
            // Parse URL to detect post/page slug
            $requestUri = $_SERVER['REQUEST_URI'] ?? '';
            $path = parse_url($requestUri, PHP_URL_PATH);
            
            // Remove base path from URL
            if ($basePath !== '/' && strpos($path, $basePath) === 0) {
                $path = substr($path, strlen($basePath));
            }
            $path = trim($path, '/');
            
            // Check for /post/{slug} pattern
            if (preg_match('/^post\/([^\/]+)$/', $path, $matches)) {
                $slug = $matches[1];
                $stmt = $pdo->prepare("SELECT title, excerpt, meta_description, keywords, image_url FROM posts WHERE slug = ? LIMIT 1");
                $stmt->execute([$slug]);
                $post = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($post) {
                    $seoTitle = $post['title'] . ' | ' . $seoTitle;
                    
                    // Triple-step sanitization for description
                    $desc = $post['meta_description'] ?: $post['excerpt'] ?: '';
                    if (!empty($desc)) {
                        // Step 1: Strip HTML tags
                        $cleanDesc = strip_tags($desc);
                        // Step 2: Decode HTML entities
                        $cleanDesc = html_entity_decode($cleanDesc, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                        // Step 3: Replace double quotes with single quotes (prevents breaking content="...")
                        $cleanDesc = str_replace('"', "'", $cleanDesc);
                        // Trim to reasonable length
                        $seoDescription = substr($cleanDesc, 0, 160);
                    }
                    
                    $seoKeywords = $post['keywords'] ?? '';
                    $seoImage = $post['image_url'] ?? '';
                }
            }
            
            // Check for plain slug (could be post or page)
            elseif (!empty($path) && !preg_match('/^(admin|api|login|install|assets)/', $path)) {
                // Try posts first
                $stmt = $pdo->prepare("SELECT title, excerpt, meta_description, keywords, image_url FROM posts WHERE slug = ? LIMIT 1");
                $stmt->execute([$path]);
                $post = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$post) {
                    // Try pages
                    $stmt = $pdo->prepare("SELECT title, content FROM pages WHERE slug = ? LIMIT 1");
                    $stmt->execute([$path]);
                    $post = $stmt->fetch(PDO::FETCH_ASSOC);
                }
                
                if ($post) {
                    $seoTitle = $post['title'] . ' | ' . $seoTitle;
                    
                    $desc = $post['meta_description'] ?? $post['excerpt'] ?? $post['content'] ?? '';
                    if (!empty($desc)) {
                        $cleanDesc = strip_tags($desc);
                        $cleanDesc = html_entity_decode($cleanDesc, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                        $cleanDesc = str_replace('"', "'", $cleanDesc);
                        $seoDescription = substr($cleanDesc, 0, 160);
                    }
                    
                    $seoKeywords = $post['keywords'] ?? '';
                    $seoImage = $post['image_url'] ?? '';
                }
            }
        }
    }
} catch (Exception $e) {
    // Silently fail - use defaults
}

// ============================================
// AUTO-DETECT ASSET FILENAMES
// ============================================
$assetsDir = __DIR__ . '/assets/';
$jsFile = '';
$cssFile = '';

if (is_dir($assetsDir)) {
    $files = scandir($assetsDir);
    foreach ($files as $file) {
        if (preg_match('/^index-.*\.js$/', $file)) {
            $jsFile = $file;
        }
        if (preg_match('/^index-.*\.css$/', $file)) {
            $cssFile = $file;
        }
    }
}

// Fallback if not found
if (!$jsFile) $jsFile = 'index.js';
if (!$cssFile) $cssFile = 'index.css';
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- Dynamic SEO Meta Tags -->
  <title><?php echo $seoTitle; ?></title>
  <meta name="description" content="<?php echo $seoDescription; ?>">
  <?php if (!empty($seoKeywords)): ?>
  <meta name="keywords" content="<?php echo htmlspecialchars($seoKeywords); ?>">
  <?php endif; ?>
  
  <!-- Open Graph / Social Media -->
  <meta property="og:title" content="<?php echo $seoTitle; ?>">
  <meta property="og:description" content="<?php echo $seoDescription; ?>">
  <?php if (!empty($seoImage)): ?>
  <meta property="og:image" content="<?php echo htmlspecialchars($seoImage); ?>">
  <?php endif; ?>
  <meta property="og:type" content="website">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?php echo $seoTitle; ?>">
  <meta name="twitter:description" content="<?php echo $seoDescription; ?>">

  <!-- Google Fonts: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          },
          colors: {
            primary: {
              50: '#f0f9ff',
              100: '#e0f2fe',
              500: '#0ea5e9',
              600: '#0284c7',
              700: '#0369a1',
              900: '#0c4a6e',
            }
          },
          animation: {
            'fade-in': 'fadeIn 0.3s ease-out',
            'slide-up': 'slideUp 0.4s ease-out',
            'slide-down': 'slideDown 0.3s ease-out',
            'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          },
          keyframes: {
            fadeIn: {
              '0%': { opacity: '0' },
              '100%': { opacity: '1' },
            },
            slideUp: {
              '0%': { transform: 'translateY(20px)', opacity: '0' },
              '100%': { transform: 'translateY(0)', opacity: '1' },
            },
            slideDown: {
              '0%': { transform: 'translateY(-20px)', opacity: '0' },
              '100%': { transform: 'translateY(0)', opacity: '1' },
            }
          }
        }
      }
    }
  </script>
  <script>window.VON_BASE = '<?php echo $basePath; ?>';</script>
  <style>
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    .dark ::-webkit-scrollbar-thumb { background: #475569; }
    body { font-family: 'Inter', sans-serif; scroll-behavior: smooth; }
    .prose img { border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
  </style>

  <link rel="stylesheet" crossorigin href="<?php echo $basePath . 'assets/' . $cssFile; ?>">
  <script async src="https://static.addtoany.com/menu/page.js"></script>
</head>

<body class="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased transition-colors duration-200">
  <div id="root"></div>
  <script type="module" crossorigin src="<?php echo $basePath . 'assets/' . $jsFile; ?>"></script>
  <script>
      (function waitForA2A() {
        try {
          if (window.a2a) {
            if (typeof window.a2a.init === 'function') { window.a2a.init(); return; }
            if (typeof window.a2a.init_all === 'function') { window.a2a.init_all(); return; }
          }
        } catch (e) {}
        setTimeout(waitForA2A, 250);
      })();
  </script>
</body>

</html>
