<?php
/**
 * VonCMS - Image Processor
 *
 * Handles image resize, compression, and optional WebP conversion.
 * Uses PHP GD library for image manipulation.
 *
 * @package VonCMS
 */

// Prevent direct access
if (basename($_SERVER['PHP_SELF']) == basename(__FILE__)) {
  die('Direct access not allowed');
}

require_once __DIR__ . '/../media_variants.php';

class ImageProcessor
{
  /** @var array Supported MIME types */
  private const SUPPORTED_TYPES = [
    'image/jpeg' => IMAGETYPE_JPEG,
    'image/png' => IMAGETYPE_PNG,
    'image/gif' => IMAGETYPE_GIF,
    'image/webp' => IMAGETYPE_WEBP,
  ];

  private const MAX_PROCESSING_PIXELS = 50000000;

  /** @var array Default settings */
  private array $settings;

  /**
   * Constructor
   *
   * @param array $settings Media optimization settings
   */
  public function __construct(array $settings = [])
  {
    $this->settings = array_merge(
      [
        'enabled' => true,
        'maxWidth' => 1920,
        'maxHeight' => 1080,
        'quality' => 85,
        'convertToWebP' => false,
        'generateResponsiveVariants' => true,
        'responsiveWidths' => [480, 960, 1920],
      ],
      $settings,
    );
  }

  /**
   * Process an uploaded image file
   *
   * @param string $filePath Absolute path to uploaded file
   * @return array Result with processed file info
   */
  public function processUpload(string $filePath): array
  {
    $result = [
      'success' => false,
      'original' => $filePath,
      'processed' => $filePath,
      'resized' => false,
      'compressed' => false,
      'message' => '',
      'responsiveVariants' => [],
      'responsiveVariantStatus' => empty($this->settings['generateResponsiveVariants'])
        ? 'disabled'
        : 'not_processed',
      'responsiveVariantMessage' => '',
    ];

    // Skip if processing disabled
    if (!$this->settings['enabled']) {
      $result['success'] = true;
      $result['message'] = 'Processing disabled, file saved as-is.';
      return $result;
    }

    // Validate file exists
    if (!file_exists($filePath)) {
      $result['message'] = 'File not found.';
      return $result;
    }

    // Get image info
    $imageInfo = @getimagesize($filePath);
    if ($imageInfo === false) {
      $result['message'] = 'Unable to read image dimensions.';
      return $result;
    }

    $mimeType = $imageInfo['mime'];
    $originalWidth = $imageInfo[0];
    $originalHeight = $imageInfo[1];

    // Check if supported type
    if (!isset(self::SUPPORTED_TYPES[$mimeType])) {
      $result['success'] = true;
      $result['message'] = 'Unsupported image type, saved as-is.';
      return $result;
    }

    if (!self::hasProcessingMemoryBudget($originalWidth, $originalHeight)) {
      $result['success'] = true;
      $result['message'] =
        'Image saved as-is because processing would exceed the safe memory budget.';
      $result['responsiveVariantStatus'] = 'fallback_original';
      $result['responsiveVariantMessage'] =
        'Responsive processing was skipped to protect server memory.';
      return $result;
    }

    // Create image resource from file
    $sourceImage = $this->createImageFromFile($filePath, $mimeType);
    if ($sourceImage === null) {
      $result['message'] = 'Failed to create image resource.';
      return $result;
    }

    // Preserve transparency for PNG/GIF/WebP
    if ($mimeType !== 'image/jpeg') {
      imagealphablending($sourceImage, false);
      imagesavealpha($sourceImage, true);
    }

    // Calculate new dimensions (maintain aspect ratio)
    $maxWidth = (int) $this->settings['maxWidth'];
    $maxHeight = (int) $this->settings['maxHeight'];

    $newWidth = $originalWidth;
    $newHeight = $originalHeight;
    $needsResize = false;

    if ($originalWidth > $maxWidth || $originalHeight > $maxHeight) {
      $ratio = min($maxWidth / $originalWidth, $maxHeight / $originalHeight);
      $newWidth = (int) round($originalWidth * $ratio);
      $newHeight = (int) round($originalHeight * $ratio);
      $needsResize = true;
    }

    // Resize if needed
    if ($needsResize) {
      $resizedImage = $this->resizeImage(
        $sourceImage,
        $originalWidth,
        $originalHeight,
        $newWidth,
        $newHeight,
      );
      if ($resizedImage !== null) {
        imagedestroy($sourceImage);
        $sourceImage = $resizedImage;
        $result['resized'] = true;
      }
    }

    // Convert to WebP if enabled and supported
    $convertToWebP = $this->settings['convertToWebP'] ?? false;
    $webpPath = null;

    if ($convertToWebP && function_exists('imagewebp') && $mimeType !== 'image/webp') {
      // Generate WebP version with same name but .webp extension
      $pathInfo = pathinfo($filePath);
      $webpPath = $pathInfo['dirname'] . '/' . $pathInfo['filename'] . '.webp';

      $quality = (int) $this->settings['quality'];
      $webpSuccess = imagewebp($sourceImage, $webpPath, $quality);

      if ($webpSuccess) {
        $result['convertedToWebP'] = true;
        $result['webpPath'] = $webpPath;

        // Ensure WebP file is world-readable (Apache needs 0644, not 0600 from restrictive umask)
        @chmod($webpPath, 0644);

        // Absolute Conversion (Replace original with WebP)
        // Skip deletion if it's a "System Asset" (Logo/Favicon) requiring max compatibility
        $skipAbsolute = $this->settings['skipAbsolute'] ?? false;
        if (!$skipAbsolute) {
          if (file_exists($filePath)) {
            unlink($filePath);
          }
          $filePath = $webpPath;
          $mimeType = 'image/webp';
          $result['processed'] = $filePath;
        }
      }
    }

    // Save processed image (with compression) - keep original format too
    $quality = (int) $this->settings['quality'];
    $saveSuccess = $this->saveImage($sourceImage, $filePath, $mimeType, $quality);
    imagedestroy($sourceImage);

    if ($saveSuccess) {
      $result['compressed'] = true;
      $result['success'] = true;
      $result['message'] = 'Image processed successfully.';
    } else {
      $result['message'] = 'Failed to save processed image.';
    }

    if (!empty($this->settings['generateResponsiveVariants']) && $result['success']) {
      $responsiveWidths = $this->settings['responsiveWidths'] ?? [];
      $result['responsiveVariants'] = $this->generateResponsiveVariants(
        $filePath,
        $responsiveWidths,
      );

      if (!empty($result['responsiveVariants'])) {
        $result['responsiveVariantStatus'] = 'generated';
        $result['responsiveVariantMessage'] = 'Responsive variants generated.';
      } else {
        $candidateWidths = array_values(
          array_filter(array_map('intval', $responsiveWidths), function ($width) {
            return $width > 0;
          }),
        );
        $smallestWidth = !empty($candidateWidths) ? min($candidateWidths) : 0;
        if ($smallestWidth > 0 && $originalWidth <= $smallestWidth) {
          $result['responsiveVariantStatus'] = 'not_needed';
          $result['responsiveVariantMessage'] =
            'Source image is already smaller than the responsive floor.';
        } else {
          $result['responsiveVariantStatus'] = 'fallback_original';
          $result['responsiveVariantMessage'] =
            'Responsive variant generation failed; original optimized image is being served.';
        }
      }
    }

    // Cleanup

    return $result;
  }

  /**
   * Create GD image resource from file
   *
   * @param string $filePath File path
   * @param string $mimeType MIME type
   * @return GdImage|null
   */
  private function createImageFromFile(string $filePath, string $mimeType): ?GdImage
  {
    $image = match ($mimeType) {
      'image/jpeg' => @imagecreatefromjpeg($filePath),
      'image/png' => @imagecreatefrompng($filePath),
      'image/gif' => @imagecreatefromgif($filePath),
      'image/webp' => @imagecreatefromwebp($filePath),
      default => false,
    };

    return $image !== false ? $image : null;
  }

  /**
   * Resize image to new dimensions
   *
   * @param GdImage $source Source image
   * @param int $srcWidth Original width
   * @param int $srcHeight Original height
   * @param int $dstWidth Target width
   * @param int $dstHeight Target height
   * @return GdImage|null
   */
  private function resizeImage(
    GdImage $source,
    int $srcWidth,
    int $srcHeight,
    int $dstWidth,
    int $dstHeight,
  ): ?GdImage {
    $destination = imagecreatetruecolor($dstWidth, $dstHeight);
    if ($destination === false) {
      return null;
    }

    // Preserve transparency for PNG/GIF
    imagealphablending($destination, false);
    imagesavealpha($destination, true);
    $transparent = imagecolorallocatealpha($destination, 0, 0, 0, 127);
    imagefill($destination, 0, 0, $transparent);

    // High-quality resize
    $success = imagecopyresampled(
      $destination,
      $source,
      0,
      0,
      0,
      0,
      $dstWidth,
      $dstHeight,
      $srcWidth,
      $srcHeight,
    );

    if (!$success) {
      imagedestroy($destination);
      return null;
    }

    return $destination;
  }

  /**
   * Save image to file with compression
   *
   * @param GdImage $image Image resource
   * @param string $filePath Target path
   * @param string $mimeType MIME type
   * @param int $quality Quality (1-100)
   * @return bool
   */
  private function saveImage(GdImage $image, string $filePath, string $mimeType, int $quality): bool
  {
    // Clamp quality to valid range
    $quality = max(1, min(100, $quality));

    $result = match ($mimeType) {
      'image/jpeg' => imagejpeg($image, $filePath, $quality),
      'image/png' => imagepng(
        $image,
        $filePath,
        6,
      ), // Always use level 6 (balanced) for PNG to ensure reasonable file size
      'image/gif' => imagegif($image, $filePath),
      'image/webp' => imagewebp($image, $filePath, $quality),
      default => false,
    };

    // Ensure saved image is world-readable (Apache needs 0644, not 0600 from restrictive umask)
    @chmod($filePath, 0644);

    return $result;
  }

  /**
   * Generate responsive width variants for a processed content image.
   *
   * @param string $sourcePath Path to the canonical processed image
   * @param array<int> $widths Width candidates to generate
   * @return array<int, string>
   */
  public function generateResponsiveVariants(string $sourcePath, array $widths = []): array
  {
    $imageInfo = @getimagesize($sourcePath);
    if ($imageInfo === false) {
      return [];
    }

    $mimeType = $imageInfo['mime'];
    $sourceWidth = (int) $imageInfo[0];
    $sourceHeight = (int) $imageInfo[1];

    if (!isset(self::SUPPORTED_TYPES[$mimeType])) {
      return [];
    }

    if (!self::hasProcessingMemoryBudget($sourceWidth, $sourceHeight)) {
      return [];
    }

    // WebP images from WordPress imports can be very large — GD needs ~3× file size
    // in temporary memory. Skip WebP files over 10MB to prevent fatal OOM crashes.
    if ($mimeType === 'image/webp') {
      $fileSize = @filesize($sourcePath);
      if ($fileSize !== false && $fileSize > 10 * 1024 * 1024) {
        return [];
      }
      // Also skip very high-res images (>4K) to prevent GD buffer allocation failures.
      if ($sourceWidth > 4000 || $sourceHeight > 4000) {
        return [];
      }
      // WebP decoding needs ~3× raw pixel memory. Check if enough memory is available.
      // Raw pixels: width × height × 4 (RGBA). 3× for GD temp buffers.
      $neededBytes = (int) ($sourceWidth * $sourceHeight * 4 * 3);
      $memoryLimit = ini_get('memory_limit');
      $limitBytes = -1;
      if ($memoryLimit !== false && $memoryLimit !== '-1') {
        $val = trim($memoryLimit);
        $multiplier = 1;
        if (preg_match('/^(\d+)([GgMmKk])$/', $val, $m)) {
          $multiplier = ['K' => 1024, 'M' => 1048576, 'G' => 1073741824][strtoupper($m[2])] ?? 1;
        }
        $limitBytes = ((int) $val) * $multiplier;
      }
      if ($limitBytes > 0 && $neededBytes > $limitBytes - memory_get_usage(true)) {
        return [];
      }
    }

    $sourceImage = $this->createImageFromFile($sourcePath, $mimeType);
    if ($sourceImage === null) {
      return [];
    }

    $uniqueWidths = array_values(array_unique(array_map('intval', $widths)));
    sort($uniqueWidths, SORT_NUMERIC);

    $generated = [];
    foreach ($uniqueWidths as $targetWidth) {
      if ($targetWidth <= 0 || $targetWidth >= $sourceWidth) {
        continue;
      }

      $targetHeight = (int) round($sourceHeight * ($targetWidth / $sourceWidth));
      $variantImage = $this->resizeImage(
        $sourceImage,
        $sourceWidth,
        $sourceHeight,
        $targetWidth,
        $targetHeight,
      );

      if ($variantImage === null) {
        continue;
      }

      $pathInfo = pathinfo($sourcePath);
      $variantPath =
        $pathInfo['dirname'] .
        '/' .
        $pathInfo['filename'] .
        '_' .
        $targetWidth .
        'w.' .
        $pathInfo['extension'];

      $saved = $this->saveImage(
        $variantImage,
        $variantPath,
        $mimeType,
        (int) $this->settings['quality'],
      );
      imagedestroy($variantImage);
      if ($saved) {
        $generated[$targetWidth] = $variantPath;
      }
    }

    imagedestroy($sourceImage);

    if (!empty($generated)) {
      voncms_record_generated_media_variants($sourcePath, array_values($generated));
    }

    return $generated;
  }

  private static function hasProcessingMemoryBudget(
    int $width,
    int $height,
    int $bufferMultiplier = 4,
  ): bool {
    if ($width <= 0 || $height <= 0) {
      return false;
    }

    $pixels = $width * $height;
    if ($pixels > self::MAX_PROCESSING_PIXELS) {
      return false;
    }

    $memoryLimit = ini_get('memory_limit');
    if ($memoryLimit === false || trim($memoryLimit) === '-1') {
      return true;
    }

    $value = trim($memoryLimit);
    if (!preg_match('/^(\d+)([GgMmKk]?)$/', $value, $matches)) {
      return true;
    }

    $multiplier = match (strtoupper($matches[2] ?? '')) {
      'G' => 1073741824,
      'M' => 1048576,
      'K' => 1024,
      default => 1,
    };
    $limitBytes = (int) $matches[1] * $multiplier;
    $estimatedBytes = $pixels * 4 * max(2, $bufferMultiplier);
    $availableBytes = max(0, $limitBytes - memory_get_usage(true) - 16 * 1024 * 1024);

    return $estimatedBytes <= $availableBytes;
  }
  /**
   * Get settings
   *
   * @return array
   */
  public function getSettings(): array
  {
    return $this->settings;
  }

  /**
   * Check if GD library is available
   *
   * @return bool
   */
  public static function isGdAvailable(): bool
  {
    return extension_loaded('gd') && function_exists('imagecreatetruecolor');
  }
}
