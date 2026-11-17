<?php
// Actual static-vector parser; constructed inputs only, no site/configuration/filesystem writes.
if (PHP_SAPI !== 'cli') {
  exit(1);
}
define('VONCMS_CORE_LOADED', true);
require_once dirname(__DIR__, 3) . '/public/api/media/SvgLogo.php';
$checks = 0;
function svgCheck(bool $ok, string $message): void
{
  global $checks;
  if (!$ok) {
    throw new RuntimeException($message);
  }
  $checks++;
}
$wrap = static fn(
  string $body,
  string $attributes = '',
): string => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" ' .
  $attributes .
  '>' .
  $body .
  '</svg>';
foreach (
  [
    $wrap('<path fill="#123456" d="M0 0H200V50H0Z"/>'),
    $wrap(
      '<defs><style>.cls-1{fill:#000000}.cls-2,.cls-3{stroke:#fff;stroke-width:2}</style></defs><title>VonCMSLogo</title><g data-name="Layer 1"><path class="cls-1" d="M0 0H200V50Z"/></g>',
    ),
    $wrap(
      '<defs><linearGradient id="colour"><stop offset="0%" stop-color="#f00"/><stop offset="100%" stop-color="#00f"/></linearGradient><clipPath id="clip"><rect width="200" height="50"/></clipPath></defs><rect width="200" height="50" fill="url(#colour)" clip-path="url(&quot;#clip&quot;)"/>',
    ),
    $wrap(
      '<metadata><anything xmlns="urn:editor">Editor metadata only</anything></metadata><text style="fill:currentColor;font-size:16">JavaScript &amp; R&amp;D &lt;script&gt; Pokémon 中文 أخبار</text>',
    ),
    '<svg xmlns="http://www.w3.org/2000/svg" width="200px" height="50px"><circle cx="25" cy="25" r="20"/></svg>',
    '<svg viewBox="0 0 64 64"><path d="M0 0H64V64Z"/></svg>',
    $wrap(
      '<defs><linearGradient id="a"/><linearGradient id="b" xlink:href="#a" xmlns:xlink="http://www.w3.org/1999/xlink"/></defs><path d="M0 0H200V50Z" fill="url(\'#b\')"/>',
    ),
  ]
  as $input
) {
  $safe = SvgLogo::sanitize($input);
  $document = new DOMDocument();
  svgCheck($document->loadXML($safe, LIBXML_NONET), 'Safe SVG is not valid XML');
  svgCheck(
    $document->documentElement->namespaceURI === 'http://www.w3.org/2000/svg',
    'Safe SVG lost its namespace',
  );
  svgCheck(SvgLogo::sanitize($safe) === $safe, 'Sanitization must remain stable on its own output');
}
$unsafe = [
  '',
  '<html><svg/></html>',
  '<svg xmlns="urn:html" viewBox="0 0 1 1"/>',
  '<?xml-stylesheet href="https://example.invalid/evil.css"?>' . $wrap(''),
  '<?xml version="1.0" encoding="ISO-8859-1"?>' . $wrap(''),
  '<!DOCTYPE svg SYSTEM "file:///etc/passwd">' . $wrap(''),
  '<!DOCTYPE svg [<!ENTITY x SYSTEM "https://example.invalid/entity">]>' .
  $wrap('<text>&x;</text>'),
  $wrap('<script>alert(1)</script>'),
  $wrap('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">HTML</div></foreignObject>'),
  $wrap('<image href="data:image/svg+xml,evil"/>'),
  $wrap('<use href="#recursive"/>'),
  $wrap('<a href="https://example.invalid">Link</a>'),
  $wrap('<animate attributeName="href" values="javascript:evil"/>'),
  $wrap('<set attributeName="onload" to="evil"/>'),
  $wrap('<path d="M0 0"/>', 'onload="alert(1)"'),
  $wrap('<path oNclick="alert(1)" d="M0 0"/>'),
  $wrap('<path href="javascript:alert(1)"/>'),
  $wrap('<path href="&#x68;ttps://example.invalid/remote.svg"/>'),
  $wrap('<g xml:base="https://example.invalid"><path fill="url(#remote)"/></g>'),
  $wrap('<path fill="url(https://example.invalid/paint.svg#id)"/>'),
  $wrap('<path fill="url(//example.invalid/paint.svg#id)"/>'),
  $wrap('<path style="fill:u/**/rl(/external.svg#id)"/>'),
  $wrap('<path style="fill:u\\72l(/external.svg#id)"/>'),
  $wrap('<style>@import url(https://example.invalid/x.css);</style>'),
  $wrap('<style>.a{fill:url(/external.svg#id)}</style>'),
  $wrap('<style>.a{position:fixed;inset:0}</style>'),
  $wrap('<style>.a{--paint:url(/external.svg#id);fill:var(--paint)}</style>'),
  $wrap('<path/>', 'viewBox="0 0 0 10"'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 NaN 50"/>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 50"/>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"/>',
  str_repeat(' ', SvgLogo::MAX_BYTES + 1),
  $wrap(str_repeat('<g>', 66) . str_repeat('</g>', 66)),
  $wrap(str_repeat('<path d="M0 0"/>', 5001)),
  "\xff\xfe<\0s\0v\0g\0/\0>\0",
];
foreach ($unsafe as $input) {
  try {
    SvgLogo::sanitize($input);
    svgCheck(false, 'Unsafe/unsupported SVG accepted');
  } catch (InvalidArgumentException $expected) {
    svgCheck(true, 'Unsafe vector rejected');
  }
}
// CSS appearance survives, while non-rendering editor metadata is removed.
$safe = SvgLogo::sanitize(
  $wrap(
    '<defs><style>.a{fill:#ff0000}.b{fill:#0000ff}</style></defs><path class="a" d="M0 0H200V50Z"/>',
  ),
);
svgCheck(
  str_contains($safe, ".a{fill:#ff0000}\n.b{fill:#0000ff}"),
  'Multiple CSS rules changed syntax',
);
svgCheck(
  !str_contains(
    SvgLogo::sanitize($wrap('<metadata><secret>not retained</secret></metadata>')),
    'not retained',
  ),
  'Editor metadata retained',
);
echo "PASS SVG logo profile: $checks checks; actual XML reconstruction, static classes/gradients/clips, Unicode/text controls, external/active content rejection and bounded input/depth/node counts.\n";
