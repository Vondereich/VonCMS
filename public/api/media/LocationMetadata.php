<?php
/** Container-only metadata cleanup: never decodes/re-encodes image pixels. */
if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}

final class VonCmsLocationMetadata
{
  private const MAX_CONTAINER_CHUNKS = 8192;
  private static function number(string $format, string $bytes): int
  {
    $result = unpack($format, $bytes);
    if (!is_array($result) || !is_int($result[1] ?? null)) {
      throw new RuntimeException('Invalid image metadata integer.');
    }
    return $result[1];
  }
  public static function cleanFile(string $path, string $mime): void
  {
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
      return;
    }
    clearstatcache(true, $path);
    $fileSize = filesize($path);
    if (!is_int($fileSize) || $fileSize > 16777216) {
      throw new RuntimeException('Image exceeds the safe metadata budget.');
    }
    $bytes = file_get_contents($path);
    if (!is_string($bytes)) {
      throw new RuntimeException('Image metadata could not be read safely.');
    }
    $clean = match ($mime) {
      'image/jpeg' => self::jpeg($bytes),
      'image/png' => self::png($bytes),
      default => self::webp($bytes),
    };
    if ($clean !== $bytes) {
      $staged = tempnam(dirname($path), '.voncms-metadata-');
      if ($staged === false) {
        throw new RuntimeException('Image metadata could not be removed safely.');
      }
      try {
        $permissions = fileperms($path);
        if (
          $permissions === false ||
          !chmod($staged, $permissions & 0666) ||
          file_put_contents($staged, $clean, LOCK_EX) !== strlen($clean) ||
          !rename($staged, $path)
        ) {
          throw new RuntimeException('Image metadata could not be removed safely.');
        }
      } finally {
        if (is_file($staged)) {
          unlink($staged);
        }
      }
    }
  }

  /** Keep orientation only; GPS may live in nested/extended metadata blocks. */
  private static function orientationExif(string $bytes): string
  {
    $prefix = str_starts_with($bytes, "Exif\0\0") ? "Exif\0\0" : '';
    $tiff = substr($bytes, strlen($prefix));
    if (strlen($tiff) < 8 || !in_array(substr($tiff, 0, 2), ['II', 'MM'], true)) {
      throw new RuntimeException('Invalid image orientation metadata.');
    }
    $little = str_starts_with($tiff, 'II');
    $short = static fn(string $value): int => self::number($little ? 'v' : 'n', $value);
    $long = static fn(string $value): int => self::number($little ? 'V' : 'N', $value);
    if ($short(substr($tiff, 2, 2)) !== 42) {
      throw new RuntimeException('Invalid image orientation metadata.');
    }
    $offset = $long(substr($tiff, 4, 4));
    if ($offset < 8 || $offset > strlen($tiff) - 2) {
      throw new RuntimeException('Invalid image orientation metadata.');
    }
    $count = $short(substr($tiff, $offset, 2));
    if ($count > 4096 || $offset + 2 + $count * 12 + 4 > strlen($tiff)) {
      throw new RuntimeException('Invalid image orientation metadata.');
    }
    for ($index = 0; $index < $count; $index++) {
      $entry = substr($tiff, $offset + 2 + $index * 12, 12);
      if ($short(substr($entry, 0, 2)) === 0x0112) {
        if ($short(substr($entry, 2, 2)) !== 3 || $long(substr($entry, 4, 4)) !== 1) {
          throw new RuntimeException('Invalid image orientation metadata.');
        }
        $orientation = $short(substr($entry, 8, 2));
        if ($orientation < 1 || $orientation > 8) {
          throw new RuntimeException('Invalid image orientation metadata.');
        }
        return $prefix .
          'II' .
          pack('vVv', 42, 8, 1) .
          pack('vvVvvV', 0x0112, 3, 1, $orientation, 0, 0);
      }
    }
    return '';
  }

  private static function orientationXmp(string $bytes): string
  {
    if (
      !preg_match(
        '/\btiff:Orientation\s*(?:=\s*["\']([1-8])["\']|>\s*([1-8])\s*<)/',
        $bytes,
        $match,
      )
    ) {
      return '';
    }
    $orientation = isset($match[2]) ? $match[2] : $match[1];
    return '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/" tiff:Orientation="' .
      $orientation .
      '"/></rdf:RDF></x:xmpmeta>';
  }

  private static function jpeg(string $bytes): string
  {
    if (!str_starts_with($bytes, "\xff\xd8")) {
      throw new RuntimeException('Invalid JPEG container.');
    }
    $out = substr($bytes, 0, 2);
    $position = 2;
    $length = strlen($bytes);
    $markers = 0;
    while ($position < $length) {
      if (++$markers > self::MAX_CONTAINER_CHUNKS) {
        throw new RuntimeException('JPEG exceeds the safe metadata budget.');
      }
      $start = $position;
      if ($bytes[$position++] !== "\xff") {
        throw new RuntimeException('Invalid JPEG metadata boundary.');
      }
      while ($position < $length && $bytes[$position] === "\xff") {
        $position++;
      }
      if ($position >= $length) {
        break;
      }
      $marker = ord($bytes[$position++]);
      if ($marker === 0xd9) {
        return $out . substr($bytes, $start, $position - $start);
      }
      if ($marker === 1 || ($marker >= 0xd0 && $marker <= 0xd7)) {
        $out .= substr($bytes, $start, $position - $start);
        continue;
      }
      if ($position + 2 > $length) {
        break;
      }
      $size = self::number('n', substr($bytes, $position, 2));
      if ($size < 2 || $size > $length - $position) {
        break;
      }
      $payload = substr($bytes, $position + 2, $size - 2);
      $position += $size;
      if ($marker === 0xe1) {
        $xmpPrefix = "http://ns.adobe.com/xap/1.0/\0";
        $clean = str_starts_with($payload, "Exif\0\0")
          ? self::orientationExif($payload)
          : (str_starts_with($payload, $xmpPrefix)
            ? self::orientationXmp($payload)
            : '');
        if ($clean !== '') {
          if (!str_starts_with($clean, "Exif\0\0")) {
            $clean = $xmpPrefix . $clean;
          }
          $out .= "\xff\xe1" . pack('n', strlen($clean) + 2) . $clean;
        }
      } else {
        $out .= substr($bytes, $start, $position - $start);
      }
      if ($marker === 0xda) {
        // Copy compressed scan data verbatim, but continue at real markers so
        // metadata between progressive scans cannot escape cleanup.
        $scanStart = $position;
        while ($position < $length) {
          $next = strpos($bytes, "\xff", $position);
          if ($next === false) {
            break;
          }
          $codeAt = $next + 1;
          while ($codeAt < $length && $bytes[$codeAt] === "\xff") {
            $codeAt++;
          }
          if ($codeAt >= $length) {
            break;
          }
          $code = ord($bytes[$codeAt]);
          if ($code !== 0 && !($code >= 0xd0 && $code <= 0xd7)) {
            $out .= substr($bytes, $scanStart, $next - $scanStart);
            $position = $next;
            continue 2;
          }
          $position = $codeAt + 1;
        }
        break;
      }
    }
    throw new RuntimeException('Invalid JPEG container.');
  }

  /** Decode recognized ImageMagick EXIF carriers, not arbitrary image text. */
  private static function pngRawExif(string $type, string $data): ?string
  {
    $separator = strpos($data, "\0");
    if (
      $separator === false ||
      !preg_match('/^Raw profile type (?:exif|APP1)$/iD', substr($data, 0, $separator))
    ) {
      return null;
    }
    $body = substr($data, $separator + 1);
    $compressed = false;
    if ($type === 'zTXt') {
      if (!str_starts_with($body, "\0")) {
        throw new RuntimeException('Invalid PNG profile compression.');
      }
      $body = substr($body, 1);
      $compressed = true;
    } elseif ($type === 'iTXt') {
      if (strlen($body) < 4 || !in_array(ord($body[0]), [0, 1], true) || $body[1] !== "\0") {
        throw new RuntimeException('Invalid PNG profile compression.');
      }
      $compressed = ord($body[0]) === 1;
      $fields = explode("\0", substr($body, 2), 3);
      if (count($fields) !== 3) {
        throw new RuntimeException('Invalid PNG profile text.');
      }
      $body = $fields[2];
    }
    // Bound decompression and hex decoding independently of GD/pixel memory.
    if ($compressed) {
      $decoded = function_exists('gzuncompress') ? @gzuncompress($body, 2162688) : false;
      if (!is_string($decoded)) {
        throw new RuntimeException('PNG profile exceeds the safe metadata budget.');
      }
      $body = $decoded;
    }
    if (
      strlen($body) > 2162688 ||
      !preg_match('/\A\s*(?:exif|APP1)\s+([0-9]{1,8})\s+([0-9a-f\s]+)\z/i', $body, $matches)
    ) {
      throw new RuntimeException('Invalid PNG EXIF profile.');
    }
    $size = (int) $matches[1];
    $hex = preg_replace('/\s+/', '', $matches[2]);
    if (
      $size < 8 ||
      $size > 1048576 ||
      !is_string($hex) ||
      strlen($hex) !== $size * 2 ||
      !ctype_xdigit($hex)
    ) {
      throw new RuntimeException('Invalid PNG EXIF profile length.');
    }
    $decoded = hex2bin($hex);
    if (!is_string($decoded)) {
      throw new RuntimeException('Invalid PNG EXIF profile bytes.');
    }
    if (
      str_starts_with($decoded, "http://ns.adobe.com/xap/1.0/\0") ||
      str_starts_with($decoded, "http://ns.adobe.com/xmp/extension/\0")
    ) {
      return '';
    }
    return self::orientationExif($decoded);
  }

  private static function png(string $bytes): string
  {
    if (!str_starts_with($bytes, "\x89PNG\r\n\x1a\n")) {
      throw new RuntimeException('Invalid PNG container.');
    }
    $chunks = [];
    $orientation = '';
    $ended = false;
    $chunkCount = 0;
    for ($position = 8, $length = strlen($bytes); $position + 12 <= $length; ) {
      if (++$chunkCount > self::MAX_CONTAINER_CHUNKS) {
        throw new RuntimeException('PNG exceeds the safe metadata budget.');
      }
      $size = self::number('N', substr($bytes, $position, 4));
      if ($size > $length - $position - 12) {
        break;
      }
      $type = substr($bytes, $position + 4, 4);
      $data = substr($bytes, $position + 8, $size);
      $clean = null;
      if ($type === 'eXIf') {
        $clean = self::orientationExif($data);
      } elseif (in_array($type, ['iTXt', 'tEXt', 'zTXt'], true)) {
        $clean = preg_match('/(?:xmp|xml:com\.adobe)/i', explode("\0", $data)[0])
          ? ''
          : self::pngRawExif($type, $data);
      }
      if ($clean === null) {
        $chunks[] = [$type, substr($bytes, $position, $size + 12)];
      } elseif ($clean !== '') {
        $clean = str_starts_with($clean, "Exif\0\0") ? substr($clean, 6) : $clean;
        if ($orientation !== '' && $orientation !== $clean) {
          throw new RuntimeException('Conflicting PNG orientation metadata.');
        }
        $orientation = $clean;
      }
      $position += $size + 12;
      if ($type === 'IEND') {
        $ended = true;
        break;
      }
    }
    if (!$ended) {
      throw new RuntimeException('Invalid PNG container.');
    }
    $out = substr($bytes, 0, 8);
    foreach ($chunks as [$type, $chunk]) {
      $out .= $chunk;
      if ($type === 'IHDR' && $orientation !== '') {
        $out .=
          pack('N', strlen($orientation)) .
          'eXIf' .
          $orientation .
          pack('N', crc32('eXIf' . $orientation));
      }
    }
    return $out;
  }

  private static function webp(string $bytes): string
  {
    $length = strlen($bytes);
    if (
      $length < 12 ||
      substr($bytes, 0, 4) !== 'RIFF' ||
      substr($bytes, 8, 4) !== 'WEBP' ||
      self::number('V', substr($bytes, 4, 4)) !== $length - 8
    ) {
      throw new RuntimeException('Invalid WebP container.');
    }
    $chunks = [];
    $chunkCount = 0;
    for ($position = 12; $position + 8 <= $length; ) {
      if (++$chunkCount > self::MAX_CONTAINER_CHUNKS) {
        throw new RuntimeException('WebP exceeds the safe metadata budget.');
      }
      $type = substr($bytes, $position, 4);
      $size = self::number('V', substr($bytes, $position + 4, 4));
      $padded = $size + ($size % 2);
      if ($padded > $length - $position - 8) {
        throw new RuntimeException('Invalid WebP metadata boundary.');
      }
      $data = substr($bytes, $position + 8, $size);
      if ($type === 'EXIF') {
        $data = self::orientationExif($data);
      } elseif ($type === 'XMP ') {
        $data = self::orientationXmp($data);
      }
      if ($data !== '' || !in_array($type, ['EXIF', 'XMP '], true)) {
        $chunks[$position] = [$type, $data];
      }
      $position += 8 + $padded;
    }
    if ($position !== $length) {
      throw new RuntimeException('Invalid WebP metadata boundary.');
    }
    $types = array_column($chunks, 0);
    $out = 'WEBP';
    foreach ($chunks as [$type, $data]) {
      if ($type === 'VP8X' && strlen($data) >= 1) {
        $data[0] = chr(
          (ord($data[0]) & ~0x0c) |
            (in_array('EXIF', $types, true) ? 0x08 : 0) |
            (in_array('XMP ', $types, true) ? 0x04 : 0),
        );
      }
      $out .= $type . pack('V', strlen($data)) . $data . (strlen($data) % 2 ? "\0" : '');
    }
    return 'RIFF' . pack('V', strlen($out)) . $out;
  }
}
