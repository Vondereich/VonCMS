<?php

if (
  !defined('VONCMS_CORE_LOADED') ||
  (is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
    realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}

/** A deliberately static vector profile, not a general-purpose SVG/document uploader. */
final class SvgLogo
{
  public const MAX_BYTES = 1048576;
  private const NS = 'http://www.w3.org/2000/svg';
  private const ELEMENTS = [
    'svg',
    'g',
    'defs',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'linearGradient',
    'radialGradient',
    'stop',
    'clipPath',
    'mask',
    'title',
    'desc',
    'text',
    'tspan',
    'style',
  ];
  private const ATTRIBUTES = [
    'id',
    'class',
    'viewBox',
    'preserveAspectRatio',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'width',
    'height',
    'd',
    'points',
    'transform',
    'clipPathUnits',
    'maskUnits',
    'maskContentUnits',
    'gradientUnits',
    'gradientTransform',
    'spreadMethod',
    'offset',
    'dx',
    'dy',
    'rotate',
    'textLength',
    'lengthAdjust',
    'version',
    'role',
    'aria-label',
  ];
  private const PRESENTATION = [
    'fill',
    'fill-opacity',
    'fill-rule',
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'stroke-dasharray',
    'stroke-dashoffset',
    'opacity',
    'color',
    'stop-color',
    'stop-opacity',
    'clip-path',
    'clip-rule',
    'mask',
    'mask-type',
    'vector-effect',
    'paint-order',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'text-anchor',
    'dominant-baseline',
    'letter-spacing',
    'word-spacing',
    'display',
    'visibility',
  ];

  public static function sanitize(string $raw): string
  {
    if (!class_exists(DOMDocument::class) || !function_exists('mb_check_encoding')) {
      throw new RuntimeException('SVG logos require the PHP DOM and mbstring extensions.');
    }
    if ($raw === '' || strlen($raw) > self::MAX_BYTES) {
      throw new InvalidArgumentException('SVG logos must be 1MB or smaller.');
    }
    if (
      str_contains($raw, "\0") ||
      !mb_check_encoding($raw, 'UTF-8') ||
      preg_match('/<!DOCTYPE|<!ENTITY/i', $raw)
    ) {
      throw new InvalidArgumentException('SVG logos must be UTF-8 without DTDs or entities.');
    }
    $previous = libxml_use_internal_errors(true);
    try {
      $input = new DOMDocument();
      $input->resolveExternals = false;
      $input->substituteEntities = false;
      if (
        !$input->loadXML($raw, LIBXML_NONET) ||
        $input->doctype !== null ||
        !$input->documentElement ||
        $input->documentElement->localName !== 'svg'
      ) {
        throw new InvalidArgumentException('The uploaded logo is not valid SVG.');
      }
      $encoding = $input->encoding;
      if ($encoding !== null && strcasecmp($encoding, 'UTF-8') !== 0) {
        throw new InvalidArgumentException('SVG logos must use UTF-8 encoding.');
      }
      foreach ($input->childNodes as $node) {
        if ($node instanceof DOMProcessingInstruction) {
          throw new InvalidArgumentException('SVG processing instructions are not supported.');
        }
      }
      $output = new DOMDocument('1.0', 'UTF-8');
      $count = 0;
      $root = self::copy($input->documentElement, $output, $count, 0);
      $output->appendChild($root);
      $viewBox = $root->getAttribute('viewBox');
      if ($viewBox !== '') {
        $numbers = preg_split('/[\s,]+/', trim($viewBox)) ?: [];
        if (count($numbers) !== 4) {
          throw new InvalidArgumentException('SVG viewBox needs four numbers.');
        }
        foreach ($numbers as $number) {
          if (!is_numeric($number) || !is_finite((float) $number)) {
            throw new InvalidArgumentException('Invalid SVG viewBox.');
          }
        }
        if ((float) $numbers[2] <= 0 || (float) $numbers[3] <= 0) {
          throw new InvalidArgumentException('SVG viewBox must have positive dimensions.');
        }
      } elseif (
        !self::positiveLength($root->getAttribute('width')) ||
        !self::positiveLength($root->getAttribute('height'))
      ) {
        throw new InvalidArgumentException(
          'SVG logos need a viewBox or positive width and height.',
        );
      }
      $safe = $output->saveXML($root);
      if (!is_string($safe) || strlen($safe) > self::MAX_BYTES) {
        throw new InvalidArgumentException('SVG logo is too complex.');
      }
      return $safe;
    } finally {
      libxml_clear_errors();
      libxml_use_internal_errors($previous);
    }
  }

  private static function positiveLength(string $value): bool
  {
    return preg_match('/^(\d+(?:\.\d+)?|\.\d+)(?:px|pt|pc|cm|mm|in|em|ex)?$/D', $value, $match) ===
      1 &&
      (float) $match[1] > 0 &&
      is_finite((float) $match[1]);
  }

  private static function copy(
    DOMElement $input,
    DOMDocument $output,
    int &$count,
    int $depth,
  ): DOMElement {
    if (
      ++$count > 5000 ||
      $depth > 64 ||
      !in_array($input->namespaceURI, [null, '', self::NS], true) ||
      !in_array($input->localName, self::ELEMENTS, true)
    ) {
      throw new InvalidArgumentException(
        'SVG logo contains unsupported or excessive content. Export a static vector SVG.',
      );
    }
    $element = $output->createElementNS(self::NS, $input->localName);
    if (!($element instanceof DOMElement)) {
      throw new RuntimeException('Unable to prepare SVG logo.');
    }
    foreach ($input->attributes as $attribute) {
      if ($attribute->namespaceURI === 'http://www.w3.org/2000/xmlns/') {
        continue;
      }
      $name = $attribute->localName;
      if ($name === null) {
        throw new InvalidArgumentException('Invalid SVG attribute name.');
      }
      $value = trim($attribute->value);
      if (
        $attribute->namespaceURI === 'http://www.w3.org/XML/1998/namespace' &&
        $name === 'space' &&
        in_array($value, ['default', 'preserve'], true)
      ) {
        $element->setAttributeNS($attribute->namespaceURI, 'xml:space', $value);
        continue;
      }
      if (
        $attribute->namespaceURI !== null &&
        !($attribute->namespaceURI === 'http://www.w3.org/1999/xlink' && $name === 'href')
      ) {
        throw new InvalidArgumentException('SVG logo contains unsupported namespaced attributes.');
      }
      if (str_starts_with($name, 'data-')) {
        continue;
      }
      if ($name === 'style') {
        $element->setAttribute('style', self::declarations($value));
        continue;
      }
      if ($name === 'type' && $input->localName === 'style' && $value === 'text/css') {
        continue;
      }
      if (!in_array($name, [...self::ATTRIBUTES, ...self::PRESENTATION, 'href'], true)) {
        throw new InvalidArgumentException('SVG logo contains unsupported attributes.');
      }
      self::value($name, $value);
      $element->setAttribute($name, $value);
    }
    if ($input->localName === 'style') {
      $element->appendChild($output->createTextNode(self::stylesheet($input->textContent)));
      return $element;
    }
    foreach ($input->childNodes as $child) {
      if ($child instanceof DOMElement) {
        // Editor metadata has no rendering role and is never projected into the served SVG.
        if (
          $child->localName === 'metadata' &&
          in_array($child->namespaceURI, [null, '', self::NS], true)
        ) {
          continue;
        }
        $element->appendChild(self::copy($child, $output, $count, $depth + 1));
      } elseif ($child instanceof DOMText) {
        $element->appendChild($output->createTextNode($child->textContent));
      } elseif (!($child instanceof DOMComment)) {
        throw new InvalidArgumentException('SVG logo contains unsupported XML content.');
      }
    }
    return $element;
  }

  private static function value(string $name, string $value): void
  {
    if (
      strlen($value) > 262144 ||
      str_contains($value, '/*') ||
      str_contains($value, '*/') ||
      preg_match('/[\x00-\x1F\x7F\\\\<>;{}@]/', $value)
    ) {
      throw new InvalidArgumentException('Invalid SVG attribute value.');
    }
    if ($name === 'href') {
      if (!preg_match('/^#[A-Za-z_][A-Za-z0-9_.:-]*$/D', $value)) {
        throw new InvalidArgumentException('SVG logos cannot reference external resources.');
      }
    } elseif (preg_match('/url\s*\(/i', $value) || in_array($name, ['clip-path', 'mask'], true)) {
      if (
        $value !== 'none' &&
        (!in_array($name, ['fill', 'stroke', 'clip-path', 'mask'], true) ||
          !preg_match('/^url\(\s*(["\x27]?)#[A-Za-z_][A-Za-z0-9_.:-]*\1\s*\)$/iD', $value))
      ) {
        throw new InvalidArgumentException('Only local SVG paint references are supported.');
      }
    }
    if (preg_match('/expression\s*\(|javascript\s*:|data\s*:|https?\s*:|\/\//i', $value)) {
      throw new InvalidArgumentException('Active or external SVG values are not supported.');
    }
  }

  private static function declarations(string $input): string
  {
    $output = [];
    foreach (explode(';', $input) as $part) {
      if (trim($part) === '') {
        continue;
      }
      $pair = explode(':', $part, 2);
      $property = strtolower(trim($pair[0]));
      if (count($pair) !== 2 || !in_array($property, self::PRESENTATION, true)) {
        throw new InvalidArgumentException('SVG logos support static presentation styles only.');
      }
      $value = trim($pair[1]);
      self::value($property, $value);
      $output[] = $property . ':' . $value;
      if (count($output) > 64) {
        throw new InvalidArgumentException('SVG logo styles are too complex.');
      }
    }
    return implode(';', $output);
  }

  private static function stylesheet(string $input): string
  {
    $input = preg_replace('#/\*[\s\S]*?\*/#', '', $input) ?? '';
    $offset = 0;
    $output = [];
    while (trim(substr($input, $offset)) !== '') {
      if (
        !preg_match(
          '/\G\s*([.#]?[A-Za-z_][A-Za-z0-9_-]*(?:\s*,\s*[.#]?[A-Za-z_][A-Za-z0-9_-]*)*)\s*\{([^{}]*)\}\s*/',
          $input,
          $match,
          0,
          $offset,
        )
      ) {
        throw new InvalidArgumentException(
          'SVG logos support simple static class, ID or element styles only.',
        );
      }
      $output[] = $match[1] . '{' . self::declarations($match[2]) . '}';
      $offset += strlen($match[0]);
      if (count($output) > 256) {
        throw new InvalidArgumentException('SVG logo styles are too complex.');
      }
    }
    return implode("\n", $output);
  }
}
