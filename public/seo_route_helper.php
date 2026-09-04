<?php
/**
 * VonCMS - Public SEO Route Helpers
 * Shared crawler endpoint, route, permalink, and metadata fallback behavior.
 */

$seoRouteHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($seoRouteHelperPath !== false && $requestedScriptPath === $seoRouteHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($seoRouteHelperPath, $requestedScriptPath);

require_once __DIR__ . '/api/publication_time_helper.php';
require_once __DIR__ . '/search_query_helper.php';

if (!function_exists('voncms_request_path')) {
  /**
   * Extract the origin-form request path without treating a leading double
   * slash as a scheme-relative host.
   *
   * @param mixed $requestUri
   * @return string
   */
  function voncms_request_path($requestUri): string
  {
    $uri = (string) $requestUri;
    if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $uri)) {
      $absolutePath = parse_url($uri, PHP_URL_PATH);
      return is_string($absolutePath) ? $absolutePath : '';
    }
    $pathLength = strcspn($uri, '?#');

    return substr($uri, 0, $pathLength);
  }
}

if (!function_exists('voncms_match_seo_endpoint')) {
  /**
   * Resolve crawler endpoints only at the installation root.
   *
   * @param mixed $requestUri
   * @param mixed $basePath
   * @return string|null
   */
  function voncms_match_seo_endpoint($requestUri, $basePath): ?string
  {
    $uriPath = voncms_request_path($requestUri);
    if ($uriPath === '') {
      return null;
    }

    $normalizedBasePath = '/' . trim(str_replace('\\', '/', (string) $basePath), '/');
    if ($normalizedBasePath === '/') {
      if (!str_starts_with($uriPath, '/')) {
        return null;
      }
      $relativePath = substr($uriPath, 1);
    } else {
      if ($uriPath === $normalizedBasePath) {
        $relativePath = '';
      } elseif (str_starts_with($uriPath, $normalizedBasePath . '/')) {
        $relativePath = substr($uriPath, strlen($normalizedBasePath) + 1);
      } else {
        return null;
      }
    }

    $route = strtolower($relativePath);
    $routes = [
      'robots.txt' => 'robots.php',
      'llms.txt' => 'llms.php',
      'sitemap.xml' => 'sitemap.php',
      'rss' => 'rss.php',
      'rss.xml' => 'rss.php',
      'feed' => 'rss.php',
      'feed.xml' => 'rss.php',
    ];

    return $routes[$route] ?? null;
  }
}

if (!function_exists('voncms_canonical_redirect_location')) {
  /**
   * Return the canonical path redirect for public page requests, or null when
   * the path is already canonical or belongs to an API/assets boundary.
   *
   * @param mixed $requestUri
   * @param mixed $queryString
   * @param mixed $basePath
   * @param mixed $currentPath
   * @return string|null
   */
  function voncms_canonical_redirect_location(
    $requestUri,
    $queryString,
    $basePath,
    $currentPath,
  ): ?string {
    $rawPath = voncms_request_path($requestUri);
    $collapsedPath = preg_replace('#/{2,}#', '/', $rawPath);
    if (!is_string($collapsedPath)) {
      return null;
    }

    $hasDuplicateSlash = $collapsedPath !== $rawPath;
    $hasTrailingSlash = $rawPath !== '/' && str_ends_with($rawPath, '/');
    if (!$hasDuplicateSlash && !$hasTrailingSlash) {
      return null;
    }

    $normalizedBasePath = '/' . trim(str_replace('\\', '/', (string) $basePath), '/');
    if ($normalizedBasePath !== '/') {
      $normalizedBasePath .= '/';
    }

    $collapsedRoute = $collapsedPath;
    if ($normalizedBasePath !== '/' && str_starts_with($collapsedPath, $normalizedBasePath)) {
      $collapsedRoute = substr($collapsedPath, strlen($normalizedBasePath));
    }
    $boundaryPath = trim((string) $currentPath, '/');
    $collapsedBoundaryPath = trim($collapsedRoute, '/');
    if (
      preg_match('#^(api|assets)(/|$)#i', $boundaryPath) ||
      preg_match('#^(api|assets)(/|$)#i', $collapsedBoundaryPath)
    ) {
      return null;
    }

    $cleanPath =
      $normalizedBasePath !== '/' && $collapsedPath === $normalizedBasePath
        ? $normalizedBasePath
        : rtrim($collapsedPath, '/');
    if ($cleanPath === '') {
      $cleanPath = '/';
    }
    if ($cleanPath === $rawPath) {
      return null;
    }

    $rawQueryString = is_string($queryString) ? $queryString : '';

    return $cleanPath . ($rawQueryString !== '' ? '?' . $rawQueryString : '');
  }
}

if (!function_exists('voncms_normalize_query_whitespace')) {
  /**
   * @param mixed $value
   * @return string
   */
  function voncms_normalize_query_whitespace($value): string
  {
    $normalized = preg_replace(
      '/[\x{0009}-\x{000D}\x{0020}\x{0085}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]+/u',
      ' ',
      (string) $value,
    );

    return trim($normalized ?? (string) $value);
  }
}

if (!function_exists('voncms_normalize_discovery_query')) {
  /**
   * @param mixed $value
   * @param int $maxLength
   * @return string
   */
  function voncms_normalize_discovery_query($value, int $maxLength): string
  {
    if (!is_string($value)) {
      return '';
    }

    $withoutForbiddenContent = preg_replace(
      '#<(script|style|noscript|template)\b[^>]*>.*?(?:</\1\s*>|$)#is',
      '',
      $value,
    );
    $normalized = html_entity_decode(
      strip_tags($withoutForbiddenContent ?? $value),
      ENT_QUOTES | ENT_HTML5,
      'UTF-8',
    );
    $normalized = voncms_normalize_query_whitespace($normalized);

    return mb_substr($normalized, 0, max(0, $maxLength));
  }
}

if (!function_exists('voncms_has_nonempty_query_value')) {
  /**
   * Conservatively detect a non-empty scalar or bracketed query value while
   * preserving duplicate parameters instead of inheriting PHP's last-value
   * collapse.
   *
   * @param mixed $queryString
   * @param string $key
   * @return bool
   */
  function voncms_has_nonempty_query_value($queryString, string $key): bool
  {
    if (!is_string($queryString) || $queryString === '') {
      return false;
    }

    foreach (preg_split('/&/', $queryString) ?: [] as $queryPart) {
      [$rawKey, $rawValue] = array_pad(explode('=', $queryPart, 2), 2, '');
      $decodedKey = urldecode($rawKey);
      if ($decodedKey !== $key && !str_starts_with($decodedKey, $key . '[')) {
        continue;
      }

      $decodedValue = urldecode($rawValue);
      if (voncms_normalize_query_whitespace($decodedValue) !== '') {
        return true;
      }
    }

    return false;
  }
}

if (!function_exists('voncms_first_query_value')) {
  /**
   * Read the first exact query value to match URLSearchParams.get() during
   * hydration. A null result means the key was absent; an empty string means
   * the first value was present but empty after discovery normalization.
   *
   * @param mixed $queryString
   * @param string $key
   * @param int $maxLength
   * @return string|null
   */
  function voncms_first_query_value($queryString, string $key, int $maxLength): ?string
  {
    if (!is_string($queryString) || $queryString === '') {
      return null;
    }

    foreach (preg_split('/&/', $queryString) ?: [] as $queryPart) {
      [$rawKey, $rawValue] = array_pad(explode('=', $queryPart, 2), 2, '');
      if (urldecode($rawKey) !== $key) {
        continue;
      }

      return voncms_normalize_discovery_query(urldecode($rawValue), $maxLength);
    }

    return null;
  }
}

if (!function_exists('voncms_normalize_public_page')) {
  /**
   * Keep public discovery pagination bounded and deterministic across PHP and
   * React. Invalid, empty, or non-scalar values resolve to the first page.
   *
   * @param mixed $value
   * @param int $maxPage
   * @return int
   */
  function voncms_normalize_public_page($value, int $maxPage = 100000): int
  {
    if (!is_scalar($value) || is_bool($value)) {
      return 1;
    }

    $normalized = trim((string) $value);
    if ($normalized === '' || !ctype_digit($normalized)) {
      return 1;
    }

    return max(1, min(max(1, $maxPage), (int) $normalized));
  }
}

if (!function_exists('voncms_build_public_page_query')) {
  /**
   * Replace pagination with one canonical page value while preserving the
   * current public discovery scope and raw query ordering.
   *
   * @param mixed $queryString
   * @param int $page
   * @param mixed $category
   * @return string
   */
  function voncms_build_public_page_query($queryString, int $page, $category = null): string
  {
    $queryParts = [];
    $replaceCategory = is_string($category) && $category !== '';
    if ($replaceCategory) {
      $queryParts[] = 'category=' . rawurlencode($category);
    }

    if (is_string($queryString) && $queryString !== '') {
      foreach (preg_split('/&/', $queryString) ?: [] as $queryPart) {
        if ($queryPart === '') {
          continue;
        }

        [$rawKey] = explode('=', $queryPart, 2);
        $decodedKey = urldecode($rawKey);
        if (
          $decodedKey === 'page' ||
          str_starts_with($decodedKey, 'page[') ||
          ($replaceCategory &&
            ($decodedKey === 'category' || str_starts_with($decodedKey, 'category[')))
        ) {
          continue;
        }
        if (str_contains($queryPart, "\r") || str_contains($queryPart, "\n")) {
          continue;
        }

        $queryParts[] = $queryPart;
      }
    }

    $normalizedPage = voncms_normalize_public_page($page);
    if ($normalizedPage > 1) {
      $queryParts[] = 'page=' . $normalizedPage;
    }

    return implode('&', $queryParts);
  }
}

if (!function_exists('voncms_build_noscript_listing_model')) {
  /**
   * Build the data model used by the public no-JavaScript listing fallback.
   * HTML emission remains in index.php.
   *
   * @param array<string, mixed> $context
   * @return array{
   *   listingPosts:array<int, array<string, mixed>>,
   *   discoveryLanding:bool,
   *   previousHref:string,
   *   nextHref:string,
   *   showLogo:bool,
   *   showTitle:bool
   * }
   */
  function voncms_build_noscript_listing_model(array $context): array
  {
    $path = (string) ($context['path'] ?? '');
    $isHomepage = voncms_is_homepage_path($path);
    $isCategoryLanding = !empty($context['isCategoryLanding']) && $isHomepage;
    $categoryPosts = is_array($context['categoryPosts'] ?? null) ? $context['categoryPosts'] : [];
    $homepagePosts = is_array($context['homepagePosts'] ?? null) ? $context['homepagePosts'] : [];
    $listingPosts = $isCategoryLanding ? $categoryPosts : $homepagePosts;
    $page = max(1, (int) ($context['page'] ?? 1));
    $pageInRange = !empty($context['pageInRange']);
    $rootHref = rtrim((string) ($context['basePath'] ?? '/'), '/') . '/';
    $category = $isCategoryLanding ? (string) ($context['categoryName'] ?? '') : null;
    $rawQuery = (string) ($context['rawQuery'] ?? '');
    $previousHref = '';
    $nextHref = '';

    if ($page > 1 && $pageInRange) {
      $previousQuery = voncms_build_public_page_query($rawQuery, $page - 1, $category);
      $previousHref = $rootHref . ($previousQuery !== '' ? '?' . $previousQuery : '');
    }
    if (!empty($context['hasNextPage'])) {
      $nextQuery = voncms_build_public_page_query($rawQuery, $page + 1, $category);
      $nextHref = $rootHref . ($nextQuery !== '' ? '?' . $nextQuery : '');
    }

    $logoUrl = (string) ($context['logoUrl'] ?? '');
    $headerIdentityMode = (string) ($context['headerIdentityMode'] ?? 'logo_and_text');

    return [
      'listingPosts' => $listingPosts,
      'discoveryLanding' =>
        $isHomepage &&
        ($isCategoryLanding ||
          !empty($context['hasSearchQuery']) ||
          $page > 1 ||
          $listingPosts !== []),
      'previousHref' => $previousHref,
      'nextHref' => $nextHref,
      'showLogo' => $logoUrl !== '' && $headerIdentityMode !== 'text_only',
      'showTitle' => $headerIdentityMode !== 'logo_only' || $logoUrl === '',
    ];
  }
}

if (!function_exists('voncms_build_category_canonical_query')) {
  /**
   * Collapse duplicate category keys to one stored spelling while preserving
   * other raw query pairs, including duplicate search values and their order.
   *
   * @param mixed $queryString
   * @param mixed $category
   * @param int $page
   * @return string
   */
  function voncms_build_category_canonical_query($queryString, $category, int $page = 1): string
  {
    return voncms_build_public_page_query($queryString, $page, (string) $category);
  }
}

if (!function_exists('voncms_category_slug')) {
  /**
   * @param mixed $category
   * @return string
   */
  function voncms_category_slug($category)
  {
    $categorySlug = html_entity_decode(trim((string) $category), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if ($categorySlug === '') {
      return 'uncategorized';
    }

    $categorySlug = function_exists('mb_strtolower')
      ? mb_strtolower($categorySlug, 'UTF-8')
      : strtolower($categorySlug);
    $categorySlug = preg_replace('/[^\p{L}\p{N}\s_-]+/u', '', $categorySlug);
    $categorySlug = str_replace('_', ' ', $categorySlug ?? '');
    $categorySlug = preg_replace('/\s+/u', '-', $categorySlug);
    $categorySlug = preg_replace('/-+/', '-', $categorySlug);
    $categorySlug = trim((string) $categorySlug, '-');

    return $categorySlug !== '' ? $categorySlug : 'uncategorized';
  }
}

if (!function_exists('voncms_is_homepage_path')) {
  /**
   * @param mixed $path
   * @return bool
   */
  function voncms_is_homepage_path($path): bool
  {
    return $path === '' || $path === '/';
  }
}

if (!function_exists('buildCanonicalContentPath')) {
  /**
   * @param array<string, mixed> $content
   * @param string $permalinkStyle
   * @param string $contentType
   * @return string
   */
  function buildCanonicalContentPath($content, $permalinkStyle, $contentType = 'post')
  {
    if ($contentType !== 'post') {
      return '/' . ltrim((string) ($content['slug'] ?? ''), '/');
    }

    $postSlug = $content['slug'] ?: $content['id'];
    switch ($permalinkStyle) {
      case 'category':
        $catSlug = voncms_category_slug($content['category'] ?? 'uncategorized');
        return '/' . $catSlug . '/' . $postSlug;
      case 'date':
      case 'day_name':
        // Date-based permalinks deliberately retain creation time so upgrades never move existing URLs.
        $postDate = new DateTime(!empty($content['created_at']) ? $content['created_at'] : 'now');
        return '/' .
          $postDate->format('Y') .
          '/' .
          $postDate->format('m') .
          '/' .
          $postDate->format('d') .
          '/' .
          $postSlug;
      case 'month_name':
        $postDate = new DateTime(!empty($content['created_at']) ? $content['created_at'] : 'now');
        return '/' . $postDate->format('Y') . '/' . $postDate->format('m') . '/' . $postSlug;
      case 'post_name':
      case 'slug':
        return '/' . $postSlug;
      case 'plain':
        return '/post/' . $content['id'];
      default:
        return '/' . $postSlug;
    }
  }
}

if (!function_exists('voncms_fetch_public_post')) {
  /**
   * @param PDO $pdo
   * @param string $slugOrId
   * @param bool $isId
   * @param string $currentTime
   * @param string $authorNameSql
   * @param string $authorDisplayNameSql
   * @return array<string, mixed>|null
   */
  function voncms_fetch_public_post(
    $pdo,
    $slugOrId,
    $isId,
    $currentTime,
    $authorNameSql,
    $authorDisplayNameSql,
  ) {
    $lookupColumn = $isId ? 'p.id' : 'p.slug';
    $publishedAtSql = voncms_publication_column_sql($pdo, 'posts', 'p');
    $sql =
      'SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.author, p.author_id, p.meta_description, p.keywords, p.image_url, p.category, p.created_at, p.updated_at, p.scheduled_at, ' .
      $publishedAtSql .
      ', ' .
      $authorNameSql .
      ' as author_name, u.username as author_username, ' .
      $authorDisplayNameSql .
      ' as author_display_name, u.avatar as author_avatar FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE ' .
      $lookupColumn .
      " = ? AND (p.status = 'published' OR p.status IS NULL) AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?) LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$slugOrId, $currentTime]);
    $post = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($post) ? $post : null;
  }
}

if (!function_exists('voncms_fetch_public_listing_page')) {
  /**
   * @param PDO $pdo
   * @param string $currentTime
   * @param int $page
   * @param int $limit
   * @param string $category
   * @param string $search
   * @param bool $hasDisplayNameColumn
   * @param bool $categoryCaseFolded
   * @return array{posts: array<int, array<string, mixed>>, hasNext: bool, offset: int, inRange: bool, total: int|null}
   */
  function voncms_fetch_public_listing_page(
    PDO $pdo,
    string $currentTime,
    int $page,
    int $limit,
    string $category = '',
    string $search = '',
    bool $hasDisplayNameColumn = false,
    bool $categoryCaseFolded = false,
  ): array {
    $normalizedPage = voncms_normalize_public_page($page);
    $normalizedLimit = max(6, min(50, $limit));
    $offset = ($normalizedPage - 1) * $normalizedLimit;
    $publicationExpression = voncms_publication_expression_sql($pdo, 'posts', 'p');
    $publishedAtSql = voncms_publication_column_sql($pdo, 'posts', 'p');
    $authorNameSql = $hasDisplayNameColumn
      ? "COALESCE(NULLIF(u.display_name, ''), u.username)"
      : 'u.username';
    $authorDisplayNameSql = $hasDisplayNameColumn ? 'u.display_name' : 'NULL';
    $where = "WHERE p.status = 'published'
      AND (p.scheduled_at IS NULL OR p.scheduled_at <= :currentTime)";
    $searchTerm = null;
    $searchLike = null;

    if ($category !== '') {
      $where .= $categoryCaseFolded
        ? ' AND LOWER(p.category) = LOWER(:category)'
        : ' AND p.category = :category';
    }
    $normalizedSearch = trim($search);
    if ($normalizedSearch !== '' && strlen($normalizedSearch) >= 2) {
      $fulltextSearch = voncms_normalize_fulltext_search($normalizedSearch);
      $searchLike = '%' . voncms_escape_like_search($normalizedSearch) . '%';
      $driverName = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
      if ($driverName === 'mysql' && $fulltextSearch !== '' && strlen($fulltextSearch) >= 2) {
        $where .=
          " AND (MATCH(p.title, p.content) AGAINST(:searchTerm IN BOOLEAN MODE) OR p.title LIKE :searchLike ESCAPE '\\\\')";
        $searchTerm = $fulltextSearch;
      } elseif ($driverName === 'mysql') {
        $where .= " AND p.title LIKE :searchLike ESCAPE '\\\\'";
      } else {
        $where .= ' AND (p.title LIKE :searchLike OR p.content LIKE :searchLike)';
      }
    }

    $bindDiscoveryValues = static function (PDOStatement $statement, string $sql) use (
      $currentTime,
      $category,
      $searchTerm,
      $searchLike,
    ): void {
      if (str_contains($sql, ':currentTime')) {
        $statement->bindValue(':currentTime', $currentTime);
      }
      if (str_contains($sql, ':category')) {
        $statement->bindValue(':category', $category);
      }
      if (str_contains($sql, ':searchTerm')) {
        $statement->bindValue(':searchTerm', $searchTerm);
      }
      if (str_contains($sql, ':searchLike')) {
        $statement->bindValue(':searchLike', $searchLike);
      }
    };

    $total = null;
    if ($normalizedPage > 1) {
      $countSql = "SELECT COUNT(*) FROM posts p {$where}";
      $countStatement = $pdo->prepare($countSql);
      $bindDiscoveryValues($countStatement, $countSql);
      $countStatement->execute();
      $total = (int) $countStatement->fetchColumn();
      if ($offset >= $total) {
        return [
          'posts' => [],
          'hasNext' => false,
          'offset' => $offset,
          'inRange' => false,
          'total' => $total,
        ];
      }
    }

    $listingSql = "SELECT p.id, p.title, p.slug, CHAR_LENGTH(p.content) AS content_chars,
              COALESCE(NULLIF(p.excerpt, ''), SUBSTRING(p.content, 1, 200)) AS excerpt,
              p.author, p.author_id, p.meta_description, p.keywords, p.image_url,
              p.category, p.created_at, p.updated_at, p.scheduled_at,
              {$publishedAtSql},
              {$publicationExpression} AS effective_publish_at,
              {$authorNameSql} AS author_name,
              u.username AS author_username,
              {$authorDisplayNameSql} AS author_display_name,
              u.avatar AS author_avatar
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       {$where}
       ORDER BY effective_publish_at DESC, p.created_at DESC, p.id DESC
       LIMIT :limit OFFSET :offset";
    $statement = $pdo->prepare($listingSql);
    $bindDiscoveryValues($statement, $listingSql);
    $statement->bindValue(':limit', $normalizedLimit + 1, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();
    $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
    $hasNext = count($rows) > $normalizedLimit;

    return [
      'posts' => array_slice($rows, 0, $normalizedLimit),
      'hasNext' => $hasNext,
      'offset' => $offset,
      'inRange' => true,
      'total' => $total,
    ];
  }
}

if (!function_exists('voncms_fetch_public_category_match')) {
  /**
   * Resolve the stored category spelling and published count. The indexed
   * equality path covers normal VonCMS collations; the fallback also repairs
   * case variants on installations using a case-sensitive collation.
   *
   * @param PDO $pdo
   * @param string $category
   * @param string $currentTime
   * @return array{name: string, postCount: int, caseFolded: bool}|null
   */
  function voncms_fetch_public_category_match(
    PDO $pdo,
    string $category,
    string $currentTime,
  ): ?array {
    $normalizeMatches = static function ($matches, bool $caseFolded): ?array {
      if (!is_array($matches) || empty($matches)) {
        return null;
      }

      $name = '';
      $postCount = 0;
      foreach ($matches as $match) {
        if (!is_array($match)) {
          continue;
        }
        $candidateName = trim((string) ($match['category'] ?? ''));
        $candidateCount = (int) ($match['post_count'] ?? 0);
        if ($candidateName === '' || $candidateCount < 1) {
          continue;
        }
        if ($name === '') {
          $name = $candidateName;
        }
        $postCount += $candidateCount;
      }

      if ($name === '' || $postCount < 1) {
        return null;
      }

      return ['name' => $name, 'postCount' => $postCount, 'caseFolded' => $caseFolded];
    };

    if ((string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
      $exactStatement = $pdo->prepare(
        "SELECT category, COUNT(*) AS post_count, MIN(COLLATION(category)) AS category_collation
         FROM posts
         WHERE status = 'published'
           AND (scheduled_at IS NULL OR scheduled_at <= :currentTime)
           AND category = :category
         GROUP BY category
         ORDER BY post_count DESC, category ASC
         LIMIT 1",
      );
      $exactStatement->bindValue(':currentTime', $currentTime);
      $exactStatement->bindValue(':category', $category);
      $exactStatement->execute();
      $exactRows = $exactStatement->fetchAll(PDO::FETCH_ASSOC);
      $exactCollation = strtolower((string) ($exactRows[0]['category_collation'] ?? ''));
      if ($exactCollation !== '' && str_ends_with($exactCollation, '_ci')) {
        return $normalizeMatches($exactRows, false);
      }
    }

    $foldedStatement = $pdo->prepare(
      "SELECT category, COUNT(*) AS post_count
       FROM posts
       WHERE status = 'published'
         AND (scheduled_at IS NULL OR scheduled_at <= :currentTime)
         AND LOWER(category) = LOWER(:category)
       GROUP BY category
       ORDER BY post_count DESC, category ASC",
    );
    $foldedStatement->bindValue(':currentTime', $currentTime);
    $foldedStatement->bindValue(':category', $category);
    $foldedStatement->execute();

    return $normalizeMatches($foldedStatement->fetchAll(PDO::FETCH_ASSOC), true);
  }
}

if (!function_exists('voncms_is_spa_shell_route')) {
  /**
   * @param mixed $path
   * @return bool
   */
  function voncms_is_spa_shell_route($path): bool
  {
    $normalizedPath = strtolower(trim((string) $path, '/'));
    if ($normalizedPath === '') {
      return true;
    }

    if (in_array($normalizedPath, ['login', 'install'], true)) {
      return true;
    }

    return preg_match('#^admin(/|$)#i', $normalizedPath) === 1;
  }
}

if (!function_exists('voncms_is_private_spa_shell_route')) {
  /**
   * @param mixed $path
   * @return bool
   */
  function voncms_is_private_spa_shell_route($path): bool
  {
    $normalizedPath = strtolower(trim((string) $path, '/'));
    return in_array($normalizedPath, ['login', 'install'], true) ||
      preg_match('#^admin(/|$)#i', $normalizedPath) === 1;
  }
}

if (!function_exists('voncms_pick_seo_description')) {
  /**
   * @param array<string, mixed> $content
   * @return string
   */
  function voncms_pick_seo_description(array $content): string
  {
    foreach (['meta_description', 'excerpt', 'content'] as $field) {
      $value = (string) ($content[$field] ?? '');
      if (trim($value) === '') {
        continue;
      }

      if (function_exists('voncms_clean_seo_description')) {
        $visibleValue = voncms_clean_seo_description($value);
      } else {
        $visibleValue = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $visibleValue = str_replace("\u{00A0}", ' ', $visibleValue);
        $visibleValue = trim((string) preg_replace('/\s+/u', ' ', $visibleValue));
      }

      if ($visibleValue !== '') {
        return $value;
      }
    }

    return '';
  }
}
