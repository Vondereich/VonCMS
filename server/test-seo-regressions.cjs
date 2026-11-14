// Maintained SEO regressions: production-operation review inventory, PHP and controlled
// DOM/decoder fixtures. Add --encoding-browser for real Chrome/DOMPurify text checks.
// These fixtures do not substitute for installed-site or real-browser history flows.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const localRequire = createRequire(path.join(root, 'package.json'));
const ts = localRequire('typescript');
const phpBinary = process.env.PHP_BIN || 'php';
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const results = [];
const check = (name, ok, evidence) => results.push({ name, ok: Boolean(ok), evidence });

// Review inventory, not a vulnerability classifier. Discover production sources on every
// run; a new/removed encoding operation requires an explicit contract/test review.
// Counts do not prove semantics. The output and mutation checks below are separate.
const expectedEncodingOperations = {
  'public/api/contact/get_forms.php': { html_entity_decode: 3 },
  'public/api/content_embed_helper.php': { html_entity_decode: 4 },
  'public/api/get_comments.php': { html_entity_decode: 1 },
  'public/api/get_posts.php': { html_entity_decode: 1 },
  'public/api/install.php': { 'template:htmlspecialchars': 1 },
  'public/api/mail_helper.php': { htmlspecialchars: 4 },
  'public/api/media_tools.php': { html_entity_decode: 3 },
  'public/api/reset_password.php': { htmlspecialchars: 2 },
  'public/api/save_comments.php': { htmlspecialchars: 6 },
  'public/api/submit_contact.php': { html_entity_decode: 1, htmlspecialchars: 2 },
  'public/api/system/IndexNow.php': { html_entity_decode: 1 },
  'public/api/tools/wp_import.php': { html_entity_decode: 7, htmlspecialchars: 7 },
  'public/api/verify_email.php': { htmlspecialchars: 3 },
  'public/core/ResponseHelper.php': { html_entity_decode: 1 },
  'public/index.php': { html_entity_decode: 3, htmlspecialchars: 45 },
  'public/news_sitemap_helper.php': { htmlspecialchars: 1 },
  'public/rss.php': { html_entity_decode: 1, htmlspecialchars: 15 },
  'public/search_query_helper.php': { html_entity_decode: 1 },
  'public/seo_route_helper.php': { html_entity_decode: 3 },
  'public/seo_schema_helper.php': { html_entity_decode: 12, htmlspecialchars: 3 },
  'public/sitemap.php': { htmlspecialchars: 6 },
  'public/von_config.sample.php': { htmlspecialchars: 1 },
  'src/components/editor/postEditorTextHelpers.ts': { decodeEntities: 1 },
  'src/plugins/von-core/features/calendar/CalendarManager.tsx': { decodeEntities: 1 },
  'src/plugins/von-core/features/content/ContentManager.tsx': { decodeEntities: 11 },
  'src/plugins/von-core/features/public/components/Sidebar.tsx': { decodeEntities: 1 },
  'src/plugins/von-core/features/seo/VonSEO.tsx': { decodeEntities: 4 },
  'src/plugins/von-core/features/settings/SettingsManager.tsx': { decodeEntities: 2 },
  'src/plugins/von-core/features/users/UserProfile.tsx': { decodeEntities: 1 },
  'src/themes/corporate-pro/Layout.tsx': { decodeEntities: 6 },
  'src/themes/corporate-pro/sections/LatestPostsSection.tsx': { decodeEntities: 2 },
  'src/themes/default/Layout.tsx': { decodeEntities: 10 },
  'src/themes/digest/Layout.tsx': { decodeEntities: 12 },
  'src/themes/portfolio/Layout.tsx': { decodeEntities: 8 },
  'src/themes/prism/Layout.tsx': { decodeEntities: 7 },
  'src/themes/techpress/Layout.tsx': { decodeEntities: 17 },
  'src/utils/security.ts': { 'DOMPurify.sanitize': 4 },
  'src/utils/siteUtils.ts': { decodeEntities: 1 },
  'src/utils/textUtils.ts': { 'DOMPurify.sanitize': 1, decodeEntities: 2 },
};
const sortedObject = (value) => Object.fromEntries(Object.entries(value).sort());
const inventoryDifferences = (expected, actual) =>
  [...new Set([...Object.keys(expected), ...Object.keys(actual)])].filter(
    (file) =>
      JSON.stringify(sortedObject(expected[file] || {})) !==
      JSON.stringify(sortedObject(actual[file] || {}))
  );
const productionFiles = [];
function collectProductionFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['assets', 'data', 'uploads', 'node_modules', 'vendor'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collectProductionFiles(file);
    else if (/\.(?:php|[cm]?[jt]sx?|html)$/.test(entry.name) && entry.name !== 'von_config.php')
      productionFiles.push(file);
  }
}
for (const directory of ['public', 'src']) collectProductionFiles(path.join(root, directory));
for (const entry of ['index.php', 'index.html']) {
  const file = path.join(root, entry);
  if (fs.existsSync(file)) productionFiles.push(file);
}
function collectClientEncoding(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const counts = {};
  const watched = new Set([
    'decodeEntities',
    'encodeEntities',
    'html_entity_decode',
    'htmlspecialchars_decode',
    'htmlspecialchars',
    'htmlentities',
  ]);
  const aliases = new Map();
  const purifiers = new Set(['DOMPurify']);
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (statement.moduleSpecifier.text === 'dompurify' && clause?.name)
      purifiers.add(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const specifier of clause.namedBindings.elements) {
        const imported = (specifier.propertyName || specifier.name).text;
        if (watched.has(imported)) aliases.set(specifier.name.text, imported);
      }
    }
  }
  const add = (name) => (counts[name] = (counts[name] || 0) + 1);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const name = ts.isIdentifier(expression)
        ? aliases.get(expression.text) || expression.text
        : ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : '';
      if (watched.has(name)) add(name);
      if (
        ts.isPropertyAccessExpression(expression) &&
        purifiers.has(expression.expression.getText(ast)) &&
        name === 'sanitize'
      )
        add('DOMPurify.sanitize');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return sortedObject(counts);
}
const phpInventoryProbe = spawnSync(
  phpBinary,
  [
    '-r',
    String.raw`
$count = static function(string $code): array {
  $counts = [];
  foreach (token_get_all($code) as $token) {
    if (!is_array($token) || in_array($token[0], [T_COMMENT, T_DOC_COMMENT, T_INLINE_HTML], true)) continue;
    if (in_array($token[0], [T_STRING, T_NAME_FULLY_QUALIFIED], true)) {
      $name = strtolower(ltrim($token[1], '\\'));
      if (in_array($name, ['html_entity_decode', 'htmlspecialchars_decode', 'htmlspecialchars', 'htmlentities'], true))
        $counts[$name] = ($counts[$name] ?? 0) + 1;
    } elseif (in_array($token[0], [T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE], true)) {
      // Installer-generated PHP is inside a string, not an ordinary call token.
      preg_match_all('/\b(html_entity_decode|htmlspecialchars_decode|htmlspecialchars|htmlentities)\s*\(/i', $token[1], $matches);
      foreach ($matches[1] as $name) {
        $key = 'template:' . strtolower($name);
        $counts[$key] = ($counts[$key] ?? 0) + 1;
      }
    }
  }
  ksort($counts);
  return $counts;
};
$rows = [];
foreach (json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR) as $file) {
  $counts = $count(file_get_contents($file));
  if ($counts !== []) $rows[$file] = $counts;
}
echo json_encode(['files' => $rows, 'controls' => [
  $count('<?php /* html_entity_decode($x) */ // htmlspecialchars($x)' . "\n"),
  $count('<?php $x = html_entity_decode($x);'),
  $count('<?php $template = "htmlspecialchars(\\$value)";'),
  $count('<?php $x = html_entity_decode(html_entity_decode($x));'),
]], JSON_THROW_ON_ERROR);`,
  ],
  {
    input: JSON.stringify(productionFiles.filter((file) => file.endsWith('.php'))),
    encoding: 'utf8',
  }
);
if (phpInventoryProbe.status !== 0 || phpInventoryProbe.stderr.trim())
  throw new Error(phpInventoryProbe.stderr || phpInventoryProbe.stdout);
const phpInventory = JSON.parse(phpInventoryProbe.stdout);
const actualEncodingOperations = {};
for (const [file, counts] of Object.entries(phpInventory.files))
  actualEncodingOperations[path.relative(root, file).split(path.sep).join('/')] = counts;
for (const file of productionFiles.filter((file) => !file.endsWith('.php'))) {
  const source = fs.readFileSync(file, 'utf8');
  const scripts = file.endsWith('.html')
    ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
        .map((match) => match[1])
        .join('\n')
    : source;
  const counts = collectClientEncoding(file, scripts);
  if (Object.keys(counts).length)
    actualEncodingOperations[path.relative(root, file).split(path.sep).join('/')] = counts;
}
const encodingInventoryChanges = inventoryDifferences(
  expectedEncodingOperations,
  actualEncodingOperations
);
check(
  'production encoding inventory requires review of new/removed operations',
  !encodingInventoryChanges.length,
  {
    scannedFiles: productionFiles.length,
    encodingFiles: Object.keys(actualEncodingOperations).length,
    reviewRequired: encodingInventoryChanges,
  }
);
const aliasControl = collectClientEncoding(
  'new-decoder.ts',
  "import {decodeEntities as decode} from './textUtils'; decode(value);"
);
const introducedOperation = {
  ...actualEncodingOperations,
  'src/fixture-new-decoder.ts': aliasControl,
};
check(
  'encoding inventory rejects a new aliased decoder in an unlisted file',
  inventoryDifferences(expectedEncodingOperations, introducedOperation).includes(
    'src/fixture-new-decoder.ts'
  ),
  aliasControl
);
const doubledOperation = {
  ...actualEncodingOperations,
  'public/core/ResponseHelper.php': phpInventory.controls[3],
};
check(
  'encoding inventory rejects an added decode in an existing owner',
  inventoryDifferences(expectedEncodingOperations, doubledOperation).includes(
    'public/core/ResponseHelper.php'
  )
);
check(
  'encoding inventory ignores comments but checks generated installer PHP',
  Object.keys(
    collectClientEncoding(
      'comment.ts',
      "// decodeEntities(value)\nconst example='decodeEntities(value)';"
    )
  ).length === 0 &&
    JSON.stringify(phpInventory.controls) ===
      JSON.stringify([
        [],
        { html_entity_decode: 1 },
        { 'template:htmlspecialchars': 1 },
        { html_entity_decode: 2 },
      ]),
  phpInventory.controls
);

// Reuse selected existing integration probes, without running the full release gate.
const integration = read('server/test-integration.cjs');
const ast = ts.createSourceFile(
  'test.cjs',
  integration,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS
);
function initializer(name, sourceAst = ast) {
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceAst) === name)
      result = node.initializer.getText(sourceAst);
    ts.forEachChild(node, visit);
  }
  visit(sourceAst);
  if (!result) throw new Error('Missing probe initializer: ' + name);
  return result;
}
const sliceBetween = (s, start, end) => {
  const a = s.indexOf(start),
    b = s.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('Missing source boundary');
  return s.slice(a, b);
};
const permalinkSettingsAst = ts.createSourceFile(
  'PermalinkSettings.tsx',
  read('src/plugins/von-core/features/settings/components/PermalinkSettings.tsx'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
for (const baseUrl of ['https://settings.example.test', 'https://settings.example.test/blog']) {
  const options = vm.runInNewContext(
    ts.transpileModule(`(${initializer('options', permalinkSettingsAst)});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    { baseUrl }
  );
  const dateOption = options.find((option) => option.id === 'date');
  check(
    'Date permalink guidance includes the day and names the creation-date contract:' + baseUrl,
    dateOption.example === baseUrl + '/2023/12/15/sample-post' &&
      /creation date/i.test(dateOption.description) &&
      !/publish date/i.test(dateOption.description),
    dateOption
  );
}
const probeContext = vm.createContext({
  spawnSync,
  phpBinary,
  JSON,
  resolveFromRoot: (f) => path.join(root, f),
  automaticPostExcerptBlock: sliceBetween(
    read('public/api/save_post.php'),
    '// Auto-generate excerpt from content if not provided',
    '$db = null;'
  ),
  automaticPageExcerptBlock: sliceBetween(
    read('public/api/save_page.php'),
    '// Auto-generate excerpt from content if not provided',
    'try {'
  ),
});
for (const name of ['seoSchemaHelperProbe', 'postSlugRedirectProbe']) {
  const r = vm.runInContext(initializer(name), probeContext);
  check(name, r.status === 0 && r.stdout.trim() === 'ok' && !r.stderr.trim(), {
    status: r.status,
    stdout: r.stdout.trim(),
    stderr: r.stderr.trim(),
  });
}
for (const name of ['runSeoRouteHelperProbe', 'runSeoResponseHelperProbe']) {
  const run = vm.runInContext(initializer(name), probeContext);
  const helper = name.includes('Route') ? 'seo_route_helper.php' : 'seo_response_helper.php';
  for (const folder of ['public', 'dist']) {
    const r = run(folder + '/index.php', folder + '/' + helper);
    check(name + ':' + folder, r.status === 0 && r.stdout.trim() === 'ok' && !r.stderr.trim(), {
      status: r.status,
      stdout: r.stdout.trim(),
      stderr: r.stderr.trim(),
    });
  }
}
const numeric = spawnSync(
  phpBinary,
  [path.join(root, 'server/integration/public-numeric-routes.php')],
  { encoding: 'utf8' }
);
check('existing numeric public-route regression', numeric.status === 0 && !numeric.stderr.trim(), {
  status: numeric.status,
  stdout: numeric.stdout.trim(),
  stderr: numeric.stderr.trim(),
});

// Cross-content slug ownership: extend only the existing in-memory route fixture.
const collisionCode = `ob_start(); require ${JSON.stringify(path.join(root, 'server/integration/public-numeric-routes.php'))}; ob_end_clean();
$pdo->exec("UPDATE pages SET slug = 'ordinary' WHERE id = 902");
$observed = [];
foreach (['/' => 'https://example.test', '/blog/' => 'https://example.test/blog'] as $bp => $origin) {
  foreach (['slug', 'post_name', 'category', 'date', 'day_name', 'month_name', 'plain'] as $style) {
    $r = $runRoute($bp . 'ordinary', $bp, $origin, $style);
    $observed[] = ['base' => $bp, 'style' => $style, 'response' => $r, 'pageReachable' => ($r['status'] ?? 0) === 200 && ($r['id'] ?? 0) === 902 && ($r['type'] ?? '') === 'WebPage'];
  }
}
echo json_encode($observed, JSON_THROW_ON_ERROR);`;
const collision = spawnSync(phpBinary, ['-r', collisionCode], { encoding: 'utf8' });
if (collision.status !== 0) throw new Error(collision.stderr || collision.stdout);
const collisionRows = JSON.parse(collision.stdout);
check(
  'legacy cross-type collisions retain Post routing priority without silently renaming content',
  collisionRows.length === 14 && collisionRows.every((r) => !r.pageReachable),
  collisionRows
);
const slugGuards = spawnSync(phpBinary, [path.join(root, 'server/integration/content-slug.php')], {
  encoding: 'utf8',
});
check(
  'new and updated content cannot claim the other type slug',
  slugGuards.status === 0 && !slugGuards.stderr.trim(),
  { status: slugGuards.status, stdout: slugGuards.stdout.trim(), stderr: slugGuards.stderr.trim() }
);

// The installed-config template sanitizes category storage, but get_posts/get_post
// project that stored category unchanged. Compare both actual permalink owners.
const configSample = read('public/von_config.sample.php');
const sanitizeStart = configSample.indexOf('function sanitize_input($data)');
let sanitizeEnd = configSample.indexOf('{', sanitizeStart),
  sanitizeDepth = 0;
for (; sanitizeEnd < configSample.length; sanitizeEnd += 1) {
  if (configSample[sanitizeEnd] === '{') sanitizeDepth += 1;
  if (configSample[sanitizeEnd] === '}' && --sanitizeDepth === 0) {
    sanitizeEnd += 1;
    break;
  }
}
const sanitizerSource = configSample.slice(sanitizeStart, sanitizeEnd);
const categoryProbe = spawnSync(
  phpBinary,
  [
    '-r',
    `
require ${JSON.stringify(path.join(root, 'public/seo_route_helper.php'))};
${sanitizerSource}
$input = sanitize_input(['category' => 'Tech & AI']);
$post = ['id' => 56, 'slug' => 'ordinary', 'category' => $input['category'], 'created_at' => '2026-10-01 12:00:00'];
echo json_encode(['storedCategory' => $post['category'], 'canonicalPath' => buildCanonicalContentPath($post, 'category')], JSON_THROW_ON_ERROR);
`,
  ],
  { encoding: 'utf8' }
);
if (categoryProbe.status !== 0) throw new Error(categoryProbe.stderr || categoryProbe.stdout);
const storedCategory = JSON.parse(categoryProbe.stdout);

function makeHead() {
  const nodes = [];
  const matches = (e, selector) => {
    if (!selector.startsWith(e.tagName)) return false;
    for (const m of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) {
      if (m[2] === undefined ? e.getAttribute(m[1]) === null : e.getAttribute(m[1]) !== m[2])
        return false;
    }
    if (selector.includes('.vp-seo') && !e.classes.has('vp-seo')) return false;
    return true;
  };
  const document = {
    title: '',
    head: {
      querySelector: (s) => nodes.find((e) => matches(e, s)) || null,
      appendChild: (e) => nodes.push(e),
    },
    createElement: (tag) => {
      const attrs = new Map(),
        classes = new Set();
      return {
        tagName: tag,
        classes,
        textContent: '',
        classList: { add: (v) => classes.add(v) },
        getAttribute: (n) => attrs.get(n) ?? null,
        setAttribute: (n, v) => attrs.set(n, String(v)),
        removeAttribute: (n) => attrs.delete(n),
        remove: function () {
          const i = nodes.indexOf(this);
          if (i >= 0) nodes.splice(i, 1);
        },
      };
    },
  };
  const add = (tag, attrs, text) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.textContent = text || '';
    if (tag === 'script') e.classList.add('vp-seo');
    document.head.appendChild(e);
    return e;
  };
  return { document, add, nodes };
}

// Exercise the real setter without exporting a production-only test hook.
const canonicalSetterAst = ts.createSourceFile(
  'VonSEO.tsx',
  read('src/plugins/von-core/features/seo/VonSEO.tsx'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const canonicalSetterCode = ts.transpileModule(
  `const setter = ${initializer('setLinkCanonical', canonicalSetterAst)}; setter;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;
const acceptedCanonicalCases = [
  ['https://example.test/', 'https://example.test/'],
  ['http://localhost/zangetsu/?page=2', 'http://localhost/zangetsu/?page=2'],
  ['https://news.example.test/cms/', 'https://news.example.test/cms/'],
  ['HTTPS://EXAMPLE.TEST:443/news/', 'https://example.test/news/'],
  ['https://example.test/news/?', 'https://example.test/news/?'],
  ['https://example.test/news/#', 'https://example.test/news/#'],
  ['http://[::1]:8080/zangetsu/?page=2', 'http://[::1]:8080/zangetsu/?page=2'],
  ['https://example.test/a%2fb%2Fc%252f', 'https://example.test/a%2fb%2Fc%252f'],
  [
    'https://example.test/?category=Tech%20%26%20AI&page=2&x=&x=+&x=%20',
    'https://example.test/?category=Tech%20%26%20AI&page=2&x=&x=+&x=%20',
  ],
  ['https://example.test/berita/é?x=✓', 'https://example.test/berita/%C3%A9?x=%E2%9C%93'],
  ['https://bücher.example/', 'https://xn--bcher-kva.example/'],
  ['https://example.test/"<test>?x="<y', 'https://example.test/%22%3Ctest%3E?x=%22%3Cy'],
];
const rejectedCanonicalCases = [
  '',
  '/post/56',
  '//example.test/post/56',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'java\nscript:alert(1)',
  'javascript&#58;alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///tmp/test',
  'https://',
  'https://[invalid]/',
  'https://user@example.test/',
  'https://user:pass@example.test/',
  'https://example.test@attacker.test/',
];
for (const existing of [false, true]) {
  for (const [input, expected] of [
    ...acceptedCanonicalCases,
    ...rejectedCanonicalCases.map((value) => [value, null]),
  ]) {
    const dom = makeHead();
    const previous = 'https://example.test/unchanged';
    if (existing) dom.add('link', { rel: 'canonical', href: previous });
    const setter = vm.runInNewContext(canonicalSetterCode, { document: dom.document, URL });
    const accepted = setter(input);
    const links = dom.nodes.filter((node) => node.tagName === 'link');
    const actual = links[0]?.getAttribute('href') ?? null;
    check(
      `canonical setter ${existing ? 'update' : 'create'}:${input}`,
      accepted === (expected ?? undefined) &&
        actual === (expected ?? (existing ? previous : null)) &&
        links.length === (expected !== null || existing ? 1 : 0),
      { input, expected, accepted, actual, links: links.length }
    );
  }
}

// Execute the actual metadata application block, not a duplicate URL serializer.
const canonicalApplySource = sliceBetween(
  read('src/plugins/von-core/features/seo/VonSEO.tsx'),
  '// --- 3. Canonical Link ---',
  'const schemaLanguage ='
);
const canonicalApplyCode = ts.transpileModule(
  `const setLinkCanonical = ${initializer('setLinkCanonical', canonicalSetterAst)};
   const ensureMeta = ${initializer('ensureMeta', canonicalSetterAst)};
   (canonical => { ${canonicalApplySource} });`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;
for (const [input, expected] of acceptedCanonicalCases) {
  const dom = makeHead();
  const apply = vm.runInNewContext(canonicalApplyCode, {
    document: dom.document,
    URL,
    title: 'Canonical fixture',
    description: 'Plain description',
    settings: { siteName: 'Fixture' },
    type: 'website',
  });
  apply(input);
  const canonical = dom.document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
  const ogUrl = dom.document.head.querySelector('meta[property="og:url"]')?.getAttribute('content');
  check(
    'canonical/Open Graph serialized parity:' + input,
    canonical === expected && ogUrl === expected,
    {
      input,
      expected,
      canonical,
      ogUrl,
    }
  );
}

// Reuse both the App hydration initializer and the existing API/seed page normalizer.
const pageAst = ts.createSourceFile(
  'useContent.ts',
  read('src/hooks/useContent.ts'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const appAst = ts.createSourceFile(
  'App.tsx',
  read('src/App.tsx'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const normalizePage = vm.runInNewContext(
  ts.transpileModule(`(${initializer('normalizePage', pageAst)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
);
const injectedPageCode = ts.transpileModule(
  `(injectedState => ${initializer('injectedPage', appAst)});`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;
let memoSlot;
const readInjectedPage = vm.runInNewContext(injectedPageCode, {
  normalizePage,
  useMemo: (factory, deps) => {
    if (!memoSlot || deps.some((value, i) => value !== memoSlot.deps[i]))
      memoSlot = { deps, value: factory() };
    return memoSlot.value;
  },
});
for (const state of [
  undefined,
  { status: 'not_found' },
  { status: 'loaded', contentType: 'post', page: { slug: 'wrong-type' } },
  { status: 'loaded', contentType: 'page', page: null },
]) {
  check(
    'injected page rejects absent/non-page state:' + JSON.stringify(state),
    readInjectedPage(state) === null,
    state
  );
}

function makeRuntime(domain, base, normalizeText = (s) => s) {
  const dom = makeHead(),
    effects = [],
    cleanups = [],
    location = { pathname: '/', search: '?page=2' };
  const url = new URL(domain);
  const ctx = {
    document: dom.document,
    window: { location: { origin: url.origin, hostname: url.hostname } },
    URL,
    URLSearchParams,
    AbortController,
    console,
    fetch: async () => ({ ok: true, json: async () => ({ meta: { total: 40 } }) }),
  };
  const cache = new Map();
  const react = { useState: () => [null, () => {}], useEffect: (cb) => effects.push(cb) };
  const load = (file) => {
    if (cache.has(file)) return cache.get(file);
    const source = ts.transpileModule(read(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }).outputText;
    const module = { exports: {} };
    cache.set(file, module.exports);
    const requireModule = (id) => {
      if (id === 'react') return react;
      if (id === 'react-router') return { useLocation: () => location };
      if (id.endsWith('/config/site.config')) return { BASE_PATH: base, API: {} };
      if (id.endsWith('/hooks/usePublicPostsQuery')) return { PUBLIC_LISTING_MAX_PAGE: 1000000 };
      // Only plain controlled strings are used in this harness. Sanitization is tested by PHP/browser probes separately.
      if (id.endsWith('/utils/security')) return { htmlToPlainText: normalizeText };
      // Controlled one-layer decoder; real DOMPurify decoding is covered separately in the browser.
      if (id.endsWith('/textUtils'))
        return { decodeEntities: (s) => s.replace(/&(?:amp|#38|#x26);/gi, '&') };
      if (id.startsWith('.')) {
        const p = path.posix.normalize(path.posix.join(path.posix.dirname(file), id));
        return load(fs.existsSync(path.join(root, p + '.ts')) ? p + '.ts' : p + '.tsx');
      }
      throw new Error('Unexpected module: ' + id);
    };
    vm.runInNewContext('(function(require,module,exports){' + source + '\n})', ctx)(
      requireModule,
      module,
      module.exports
    );
    cache.set(file, module.exports);
    return module.exports;
  };
  const component = load('src/plugins/von-core/features/seo/VonSEO.tsx').default;
  const settings = {
    siteName: 'Audit Site',
    siteDescription: 'Audit description',
    domainUrl: domain,
    timeZone: 'Asia/Kuala_Lumpur',
    site_language: 'ms',
    seo: { articleSchemaType: 'NewsArticle' },
    permalinkStructure: 'category',
  };
  const render = (search, view = 'home', extra = {}) => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    location.search = search;
    effects.length = 0;
    component({ settings, currentView: view, categoryPostCount: 3, ...extra });
    for (const cb of effects) {
      const cleanup = cb();
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    }
    return {
      title: dom.document.title,
      canonical: dom.document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      robots: dom.document.head.querySelector('meta[name="robots"]')?.getAttribute('content'),
      description: dom.document.head
        .querySelector('meta[name="description"]')
        ?.getAttribute('content'),
      ogDescription: dom.document.head
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content'),
      twitterDescription: dom.document.head
        .querySelector('meta[name="twitter:description"]')
        ?.getAttribute('content'),
      ogUrl: dom.document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'),
      author: dom.document.head.querySelector('meta[name="author"]')?.getAttribute('content'),
      schemaCount: dom.nodes.filter((e) => e.tagName === 'script').length,
    };
  };
  dom.document.title = 'Audit Site - Page 2';
  dom.add('link', { rel: 'canonical', href: domain + '/?page=2' });
  dom.add('meta', { name: 'robots', content: 'index, follow' });
  dom.add(
    'script',
    {
      type: 'application/ld+json',
      'data-voncms-schema-source': 'ssr',
      'data-voncms-schema-url': domain + '/?page=2',
    },
    JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage' }] })
  );
  return {
    render,
    settings,
    load,
    dom,
    browserLocation: ctx.window.location,
    unmount: () => {
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}

// Compare SSR identity using the actual schema owner; assert the graph, not just its script count.
const jsonLdSetterCode = ts.transpileModule(`(${initializer('setJsonLd', canonicalSetterAst)});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
for (const [ssrUrl, canonical, preserve] of [
  ...acceptedCanonicalCases.map(([raw, serialized]) => [raw, serialized, true]),
  ...rejectedCanonicalCases.map((raw) => [raw, 'https://example.test/current', false]),
  ['https://example.test/old', 'https://example.test/current', false],
  ['https://example.test/?a=1&b=2', 'https://example.test/?b=2&a=1', false],
  ['https://example.test/a%2Fb', 'https://example.test/a%252Fb', false],
  ['https://example.test/?', 'https://example.test/', false],
  ['https://example.test/#', 'https://example.test/', false],
]) {
  const dom = makeHead();
  const ssrGraph = { '@graph': [{ '@type': 'WebPage', name: 'SSR-only page', url: ssrUrl }] };
  const original = JSON.stringify(ssrGraph);
  const script = dom.add(
    'script',
    {
      type: 'application/ld+json',
      'data-voncms-schema-source': 'ssr',
      'data-voncms-schema-url': ssrUrl,
    },
    original
  );
  const generated = {
    '@graph': [{ '@type': 'BreadcrumbList', name: 'New route', url: canonical }],
  };
  const setter = vm.runInNewContext(jsonLdSetterCode, { document: dom.document, URL });
  setter(generated, canonical);
  check(
    'SSR graph identity preserves only the same serialized document:' + ssrUrl + ':' + canonical,
    script.textContent === (preserve ? original : JSON.stringify(generated)) &&
      script.getAttribute('data-voncms-schema-source') === (preserve ? 'ssr' : null),
    { ssrUrl, canonical, preserve, graph: JSON.parse(script.textContent) }
  );
}

// Seed the page graph through the real PHP schema/path helpers, then run real VonSEO.
const pageSchemaProbe = spawnSync(
  phpBinary,
  [
    '-r',
    `
date_default_timezone_set('Asia/Kuala_Lumpur');
require ${JSON.stringify(path.join(root, 'public/seo_schema_helper.php'))};
$rows = [];
foreach (['https://example.test', 'https://news.example.test', 'http://localhost/zangetsu', 'https://example.test/news/cms'] as $domain) {
  foreach (['café', 'é-✓', 'ordinary'] as $slug) {
    $page = ['id' => '3', 'slug' => $slug, 'title' => 'Page ' . $slug, 'author' => 'Editor',
      'author_username' => 'editor', 'meta_description' => 'Manual page description', 'content' => 'Plain page body.',
      'created_at' => '2026-10-01 12:00:00', 'published_at' => '2026-10-01 12:00:00', 'updated_at' => '2026-10-02 14:00:00'];
    $url = $domain . buildCanonicalContentPath($page, 'slug', 'page');
    $schema = [];
    voncms_apply_content_schema($schema, $page, 'page', $page['meta_description'], '', $url, $domain, 'NewsArticle', 'ms');
    $rows[] = ['domain' => $domain, 'page' => $page, 'url' => $url,
      'graph' => ['@context' => 'https://schema.org', '@graph' => [$schema]]];
  }
}
echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
`,
  ],
  { encoding: 'utf8' }
);
if (pageSchemaProbe.status !== 0 || pageSchemaProbe.stderr.trim())
  throw new Error(pageSchemaProbe.stderr || pageSchemaProbe.stdout);
for (const fixture of JSON.parse(pageSchemaProbe.stdout)) {
  const base = new URL(fixture.domain).pathname.replace(/\/$/, '') + '/';
  for (const encodedIdentity of [false, true]) {
    const runtime = makeRuntime(fixture.domain, base);
    const script = runtime.dom.document.head.querySelector('script[type="application/ld+json"]');
    const identity = encodedIdentity ? new URL(fixture.url).href : fixture.url;
    script.setAttribute('data-voncms-schema-url', identity);
    script.textContent = JSON.stringify(fixture.graph);
    const original = script.textContent;
    const selectedPage = readInjectedPage({
      status: 'loaded',
      contentType: 'page',
      page: fixture.page,
    });
    const first = runtime.render('', 'page', { selectedPage });
    const firstGraph = JSON.parse(script.textContent);
    const repeated = runtime.render('', 'page', { selectedPage });
    check(
      'PHP WebPage graph survives fresh hydration/re-render:' + identity,
      JSON.stringify(firstGraph) === original &&
        script.textContent === original &&
        firstGraph['@graph'][0]['@type'] === 'WebPage' &&
        firstGraph['@graph'][0].description === fixture.page.meta_description &&
        firstGraph['@graph'][0].datePublished === fixture.graph['@graph'][0].datePublished &&
        firstGraph['@graph'][0].dateModified === fixture.graph['@graph'][0].dateModified &&
        script.getAttribute('data-voncms-schema-source') === 'ssr' &&
        first.canonical === new URL(fixture.url).href &&
        first.ogUrl === first.canonical &&
        repeated.description === fixture.page.meta_description,
      { identity, first, types: firstGraph['@graph'].map((node) => node['@type']) }
    );
    const next = runtime.render('', 'page', {
      selectedPage: { ...selectedPage, slug: 'other', title: 'Other page' },
    });
    check(
      'SPA page change does not retain previous SSR graph:' + identity,
      script.textContent !== original &&
        script.getAttribute('data-voncms-schema-source') === null &&
        !JSON.parse(script.textContent)['@graph'].some(
          (node) => node['@type'] === 'WebPage' && node.name === fixture.page.title
        ) &&
        next.canonical === fixture.domain + '/other',
      { identity, next }
    );
  }
}

for (const [domain, base] of [
  ['https://example.test', '/'],
  ['https://news.example.test', '/'],
  ['http://localhost/zangetsu', '/zangetsu/'],
  ['https://example.test/news/cms', '/news/cms/'],
]) {
  const runtime = makeRuntime(domain, base);
  for (const [manual, expected] of [
    ['Manual description x<y, not the excerpt.', 'Manual description x<y, not the excerpt.'],
    ['', 'Fallback excerpt.'],
    ['0', '0'],
  ]) {
    const rawPage = {
      id: '2',
      slug: 'site-disclaimer',
      title: 'Disclaimer',
      content: 'Body fallback.',
      excerpt: 'Fallback excerpt.',
      meta_description: manual,
      created_at: '2026-08-01 12:00:00',
      updated_at: '2026-08-29 00:13:35',
      published_at: '2026-08-01 13:00:00',
    };
    const before = JSON.stringify(rawPage);
    const state = { status: 'loaded', contentType: 'page', page: rawPage };
    const selectedPage = readInjectedPage(state);
    const output = runtime.render('', 'page', { selectedPage });
    check(
      'direct page manual/fallback metadata survives hydration:' + domain + ':' + manual,
      output.description === expected &&
        output.ogDescription === expected &&
        output.twitterDescription === expected &&
        output.canonical === domain + '/site-disclaimer' &&
        output.ogUrl === output.canonical &&
        selectedPage.metaDescription === manual &&
        selectedPage.meta_description === manual &&
        selectedPage.updatedAt === rawPage.updated_at &&
        selectedPage.publishedAt === rawPage.published_at &&
        JSON.stringify(rawPage) === before &&
        readInjectedPage(state) === selectedPage,
      { output, manual, sourceUnchanged: JSON.stringify(rawPage) === before }
    );
  }
  const unicodePage = readInjectedPage({
    status: 'loaded',
    contentType: 'page',
    page: {
      id: '3',
      slug: 'é-✓',
      title: 'Unicode page',
      content: 'Page body.',
      metaDescription: 'Camel-case manual.',
    },
  });
  const unicode = runtime.render('', 'page', { selectedPage: unicodePage });
  check(
    'page camel alias and encoded canonical/social parity:' + domain,
    unicode.description === 'Camel-case manual.' &&
      unicode.canonical === domain + '/%C3%A9-%E2%9C%93' &&
      unicode.ogUrl === unicode.canonical &&
      unicodePage.meta_description === 'Camel-case manual.',
    unicode
  );
  const direct = runtime.render('?page=2');
  check(
    'direct page 2 metadata:' + domain,
    direct.title === 'Audit Site - Page 2' &&
      direct.canonical === domain + '/?page=2' &&
      direct.robots.startsWith('index') &&
      direct.schemaCount === 1,
    direct
  );
  const search = runtime.render('?category=News&search=malaysia', 'category', {
    selectedCategory: 'News',
  });
  check('search noindex control:' + domain, search.robots === 'noindex, follow', search);
  const restored = runtime.render('?page=2');
  check(
    'Back to valid page 2 restores index/title/schema:' + domain,
    restored.robots.startsWith('index') &&
      restored.canonical === domain + '/?page=2' &&
      restored.title === 'Audit Site - Page 2' &&
      restored.schemaCount === 1,
    restored
  );
  const styles = {
    slug: '/ordinary',
    post_name: '/ordinary',
    category: '/technology/ordinary',
    date: '/2026/10/01/ordinary',
    day_name: '/2026/10/01/ordinary',
    month_name: '/2026/10/ordinary',
    plain: '/post/56',
  };
  for (const [style, expected] of Object.entries(styles)) {
    const article = {
      id: '56',
      slug: 'ordinary',
      title: 'Ordinary article',
      content: 'Plain article body.',
      excerpt: 'Plain article summary.',
      category: 'Technology',
      author: 'Editor',
      author_data: { username: 'editor' },
      created_at: '2026-10-01 12:00:00',
      updatedAt: '2026-10-02 12:00:00',
    };
    runtime.settings.permalinkStructure = style;
    const output = runtime.render('', 'single-post', { selectedPost: article });
    check(
      'article permalink/metadata:' + domain + ':' + style,
      output.canonical === domain + expected && output.robots.startsWith('index'),
      output
    );
  }
  runtime.settings.permalinkStructure = 'category';
  const encodedCategoryOutput = runtime.render('', 'single-post', {
    selectedPost: {
      id: '56',
      slug: 'ordinary',
      title: 'Encoded category',
      excerpt: 'Plain summary',
      category: storedCategory.storedCategory,
      created_at: '2026-10-01 12:00:00',
    },
  });
  check(
    'stored category entity retains SSR/client canonical parity:' + domain,
    encodedCategoryOutput.canonical === domain + storedCategory.canonicalPath,
    {
      ...storedCategory,
      expected: domain + storedCategory.canonicalPath,
      actual: encodedCategoryOutput.canonical,
    }
  );
}
for (const [domain, base] of [
  ['https://example.test', '/'],
  ['http://localhost/zangetsu', '/zangetsu/'],
]) {
  const runtime = makeRuntime(domain, base);
  const robots = runtime.dom.document.head.querySelector('meta[name="robots"]');
  robots.setAttribute('content', 'noindex, follow');
  robots.setAttribute('data-voncms-ssr-route', (base === '/' ? '/' : base) + '?page=2');
  robots.setAttribute('data-voncms-ssr-canonical', domain + '/?page=2');
  robots.setAttribute('data-voncms-ssr-robots', 'noindex, follow');
  robots.setAttribute('data-voncms-ssr-title', 'Not Found - Audit Site');
  const overflow = runtime.render('?page=2');
  check(
    'real SSR overflow remains noindex with no schema:' + domain,
    overflow.robots === 'noindex, follow' && overflow.schemaCount === 0,
    overflow
  );
  runtime.render('?search=test');
  const restored = runtime.render('?page=2');
  check(
    'Back does not turn real overflow into an indexable page:' + domain,
    restored.robots === 'noindex, follow' &&
      restored.schemaCount === 0 &&
      restored.title === 'Not Found - Audit Site',
    restored
  );
}
for (const [domain, base] of [
  ['https://example.test', '/'],
  ['http://localhost/zangetsu', '/zangetsu/'],
]) {
  for (const source of ['robots', 'schema']) {
    const runtime = makeRuntime(domain, base);
    const query = '?category=Tech%20%26%20AI&page=2';
    const canonical = domain + '/' + query;
    const element = runtime.dom.document.head.querySelector(
      source === 'robots' ? 'meta[name="robots"]' : 'script[type="application/ld+json"]'
    );
    element.setAttribute(
      source === 'robots' ? 'data-voncms-ssr-canonical' : 'data-voncms-schema-url',
      canonical
    );
    const direct = runtime.render(query, 'category', {
      selectedCategory: 'Tech & AI',
      categoryPostCount: 40,
    });
    runtime.render('?search=other');
    const restored = runtime.render(query, 'category', {
      selectedCategory: 'Tech & AI',
      categoryPostCount: 40,
    });
    check(
      `SSR ${source} canonical survives hydration and cached restoration:${domain}`,
      direct.canonical === canonical &&
        restored.canonical === canonical &&
        restored.robots.startsWith('index'),
      { canonical, direct, restored }
    );
  }
}
// Exercise actual SSR description owners and bootstrap expression, without a database or site writes.
const siteDescriptionBlock = sliceBetween(
  read('public/public_render_helper.php'),
  '$seoDescription = $defaultSeoDescription;',
  '$domainUrl = function_exists'
);
const profileDescriptionBlock = sliceBetween(
  read('public/index.php'),
  '$profileBio = trim((string)',
  '$profileAvatar = ResponseHelper'
);
const categoryDescriptionBlock = sliceBetween(
  read('public/index.php'),
  '$categoryDescriptionContext =',
  '$categorySeoQuery ='
);
const bootstrapSiteDescription = read('public/index.php')
  .slice(read('public/index.php').indexOf('window.__INITIAL_SETTINGS__ ='))
  .match(/'siteDescription'\s*=>\s*([^\r\n]+),/)?.[1];
if (!bootstrapSiteDescription) throw new Error('Missing actual site description bootstrap');
const descriptionSamples = [
  { name: 'ordinary', raw: 'Berita teknologi Malaysia.' },
  { name: 'quotes', raw: 'Saya tulis "teknologi" & inovasi.' },
  { name: 'comparisons', raw: 'Perbandingan x<y dan z>w kekal betul.' },
  { name: 'long', raw: 'Penulis teknologi dan sains. '.repeat(11).trim() },
  { name: 'unicode', raw: 'Berita 😀 sains dan teknologi. '.repeat(9).trim() },
  { name: 'zero', raw: '0' },
  { name: 'blank', raw: '' },
  { name: 'whitespace', raw: '   ' },
  {
    name: 'html',
    raw: '<p>Berita</p><p>Malaysia &amp; dunia.</p>',
    plain: 'Berita Malaysia & dunia.',
  },
  {
    name: 'literal markup',
    raw: '&lt;b&gt;literal&lt;/b&gt; &amp; teks',
    plain: '<b>literal</b> & teks',
  },
  {
    name: 'meta form',
    raw: '<meta name="description" content="Ringkasan pilihan.">',
    plain: 'Ringkasan pilihan.',
  },
];
const descriptionProbe = spawnSync(
  phpBinary,
  [
    '-r',
    `require ${JSON.stringify(path.join(root, 'public/seo_schema_helper.php'))};
$samples = json_decode(base64_decode('${Buffer.from(JSON.stringify(descriptionSamples)).toString('base64')}'), true);
$observed = [];
foreach ($samples as $sample) {
  $publicSettingsSnapshot = $publicSettings = ['siteDescription' => $sample['raw']];
  $defaultSeoDescription = 'Audit description';
  $siteName = $seoTitle = 'Audit Site';
  ${siteDescriptionBlock}
  $homeDescription = $seoDescription;
  $plainContext = $siteDescription;
  $bootstrap = ${bootstrapSiteDescription};
  $selectedCategoryName = 'Technology';
  ${categoryDescriptionBlock}
  $categoryDescription = $seoDescription;
  $profileUser = ['bio' => $sample['raw']];
  $profileName = 'Member Example';
  ${profileDescriptionBlock}
  $observed[] = ['name' => $sample['name'], 'plain' => $plainContext, 'home' => $homeDescription,
    'category' => $categoryDescription, 'profile' => $profileDescription, 'bootstrap' => $bootstrap];
}
echo json_encode($observed, JSON_THROW_ON_ERROR);`,
  ],
  { encoding: 'utf8' }
);
if (descriptionProbe.status !== 0)
  throw new Error(descriptionProbe.stderr || descriptionProbe.stdout);
const descriptionRows = JSON.parse(descriptionProbe.stdout);
for (const [domain, base] of [
  ['https://example.test', '/'],
  ['http://localhost/zangetsu', '/zangetsu/'],
]) {
  for (const sample of descriptionSamples) {
    const row = descriptionRows.find((r) => r.name === sample.name);
    // The controlled decoder proves wiring/order, not browser HTML parsing. Real sanitizer checks are separate.
    const expectedPlain = sample.plain ?? sample.raw.trim();
    const runtime = makeRuntime(domain, base, (s) => {
      if (sample.plain !== undefined && s === sample.raw) return sample.plain;
      return s;
    });
    check(
      'SSR plain context and raw bootstrap:' + domain + ':' + sample.name,
      row.plain === expectedPlain && row.bootstrap === sample.raw,
      { sample, row }
    );
    for (const view of ['home', 'category', 'profile']) {
      const extra =
        view === 'profile'
          ? {
              selectedProfile: {
                username: 'member',
                display_name: 'Member Example',
                bio: sample.raw,
              },
            }
          : view === 'category'
            ? { selectedCategory: 'Technology' }
            : {};
      runtime.settings.siteDescription = row.bootstrap;
      const hydrated = runtime.render(
        view === 'category' ? '?category=Technology' : '',
        view,
        extra
      );
      runtime.settings.siteDescription = sample.raw;
      const refreshed = runtime.render(
        view === 'category' ? '?category=Technology' : '',
        view,
        extra
      );
      const expected = row[view];
      check(
        'description parity before/after settings refresh:' +
          domain +
          ':' +
          view +
          ':' +
          sample.name,
        [hydrated, refreshed].every(
          (r) =>
            (r.description ?? '') === expected &&
            (r.ogDescription ?? '') === expected &&
            (r.twitterDescription ?? '') === expected &&
            Array.from(r.description ?? '').length <= 160
        ),
        { expected, hydrated, refreshed }
      );
    }
    runtime.unmount();
  }
  const runtime = makeRuntime(domain, base);
  runtime.dom.add('meta', { name: 'author', content: 'SSR old author' });
  const post = { id: '56', slug: 'ordinary', title: 'Post', author: 'Hakim', category: 'News' };
  const page = { id: '2', slug: 'page', title: 'Page', author: 'Page Editor' };
  for (const [view, extra, author] of [
    ['single-post', { selectedPost: post }, 'Hakim'],
    ['home', {}, undefined],
    ['single-post', { selectedPost: { ...post, author: 'gamemaster' } }, 'gamemaster'],
    ['page', { selectedPage: page }, 'Page Editor'],
    ['profile', { selectedProfile: { username: 'member', bio: 'Profile.' } }, undefined],
    ['category', { selectedCategory: 'News' }, undefined],
    ['home', {}, undefined],
  ]) {
    const output = runtime.render('', view, extra);
    check(
      'author belongs to current route:' + domain + ':' + view + ':' + author,
      output.author === author,
      output
    );
  }
  runtime.settings.domainUrl = '';
  runtime.browserLocation.hostname = 'news.example.com';
  runtime.browserLocation.origin = 'https://news.example.com';
  const noBase = runtime.render('', 'single-post', { selectedPost: post });
  check(
    'author ownership survives missing canonical base:' + domain,
    noBase.author === 'Hakim' &&
      noBase.robots === 'noindex, nofollow' &&
      noBase.canonical === undefined &&
      noBase.schemaCount === 0,
    noBase
  );
  runtime.unmount();
  check(
    'author removed when SEO owner unmounts:' + domain,
    !runtime.dom.document.head.querySelector('meta[name="author"]'),
    {
      author: runtime.dom.document.head
        .querySelector('meta[name="author"]')
        ?.getAttribute('content'),
    }
  );
}
// Settings refresh must not replace the server-normalized site name with raw stored entities.
const siteNameProbe = spawnSync(
  phpBinary,
  [path.join(root, 'server/integration/public-plugin-settings.php'), '--site-name-json'],
  { encoding: 'utf8' }
);
if (siteNameProbe.status !== 0 || siteNameProbe.stderr.trim()) {
  throw new Error(siteNameProbe.stderr || siteNameProbe.stdout);
}
for (const fixture of JSON.parse(siteNameProbe.stdout)) {
  const runtime = makeRuntime(fixture.domain, fixture.base);
  const script = runtime.dom.document.head.querySelector('script[type="application/ld+json"]');
  script.setAttribute('data-voncms-schema-url', fixture.domain + '/');
  script.textContent = JSON.stringify(fixture.schema);
  const observed = [];
  for (const [view, extra] of [
    ['home', {}],
    [
      'single-post',
      { selectedPost: { id: '56', slug: 'story', title: 'Story', category: 'News' } },
    ],
    ['page', { selectedPage: { id: '2', slug: 'about', title: 'About' } }],
    ['category', { selectedCategory: 'News' }],
    ['home', {}],
  ]) {
    for (const siteName of [fixture.seed, fixture.api]) {
      runtime.settings.siteName = siteName;
      runtime.render(view === 'category' ? '?category=News' : '', view, extra);
      const scripts = runtime.dom.nodes.filter((node) => node.tagName === 'script');
      const websites = JSON.parse(scripts[0].textContent)['@graph'].filter(
        (node) => node['@type'] === 'WebSite'
      );
      observed.push({
        view,
        scripts: scripts.length,
        websites: websites.length,
        name: websites[0]?.name,
        url: websites[0]?.url,
        og: runtime.dom.document.head
          .querySelector('meta[property="og:site_name"]')
          ?.getAttribute('content'),
      });
    }
  }
  check(
    'site-name identity survives SSR hydration, API refresh and route changes:' +
      fixture.domain +
      ':' +
      fixture.case,
    observed.every(
      (row) =>
        row.scripts === 1 &&
        row.websites === 1 &&
        row.name === fixture.expected &&
        row.og === fixture.expected &&
        row.url === fixture.domain + '/'
    ),
    { expected: fixture.expected, observed }
  );
  runtime.unmount();
}

// Reuse actual RSS and HTML title templates, not a duplicate encoder.
const titleSamples = [
  { raw: 'Tom & Jerry', expected: 'Tom & Jerry' },
  { raw: 'Tom &amp; Jerry', expected: 'Tom & Jerry' },
  { raw: 'Tom &amp;amp; Jerry', expected: 'Tom &amp; Jerry' },
  { raw: 'Café “世界”', expected: 'Café “世界”' },
  { raw: 'News </script> & "Quotes"', expected: 'News </script> & "Quotes"' },
];
// Independent oracle: construct each encoded layer from known text. The expected
// result is the preceding layer, never another call to the implementation under test.
const encodingSeeds = [
  'Tom & Jerry',
  "Nur'Aini & Partners",
  'He said "News & Views"',
  'Café 世界 😀 & tea',
  '2 < 3 & 5 > 4',
  '<b>literal code & text</b>',
  '</script><img src=x onerror=alert(1)> & news',
  'Use &unknown; literally & keep it',
  'A&B < C&D',
  'AT&T - R&D',
  'Rock \'n\' roll & "quotes"',
  'Line one & line two\nnext line',
];
const encodingSamples = [];
const seenEncodingSamples = new Set(titleSamples.map((sample) => sample.raw));
for (const seed of encodingSeeds) {
  for (const form of ['named', 'decimal', 'hex']) {
    let previous = seed;
    for (let depth = 0; depth <= 3; depth += 1) {
      const raw =
        depth === 0
          ? seed
          : previous.replace(/[&<>"']/g, (character) => {
              if (form === 'decimal') return '&#' + character.codePointAt(0) + ';';
              if (form === 'hex') return '&#x' + character.codePointAt(0).toString(16) + ';';
              return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[
                character
              ];
            });
      if (!seenEncodingSamples.has(raw)) {
        encodingSamples.push({ raw, expected: depth === 0 ? seed : previous });
        seenEncodingSamples.add(raw);
      }
      previous = raw;
    }
  }
}
const allTitleSamples = [...titleSamples, ...encodingSamples];
const rssSource = read('public/rss.php');
const rssNameAssignment = rssSource.match(/^ {2}\$siteName =[^\r\n]+/m)?.[0];
const rssTitleTemplates = Array.from(rssSource.matchAll(/<title><\?php[\s\S]*?\?><\/title>/g)).map(
  (match) => match[0]
);
const rssItemTitle = rssTitleTemplates.find((template) => template.includes("$post['title']"));
const rssChannelTitle = rssTitleTemplates.find((template) => template.includes('$feedTitle'));
const rssDescriptionBlock = sliceBetween(rssSource, '  $rawSiteDesc =', '  $configuredDomainUrl =');
const rssDescriptionTemplate = Array.from(
  rssSource.matchAll(/<description><\?php[\s\S]*?\?><\/description>/g)
).find((match) => match[0].includes('$feedDesc'))?.[0];
const htmlTitleTemplates = [
  read('public/index.php').match(/<title><\?php echo htmlspecialchars\(\$seoTitle[^\r\n]+/)?.[0],
  read('public/index.php').match(/<meta property="og:title"[^\r\n]+/)?.[0],
  read('public/index.php').match(/<meta name="twitter:title"[^\r\n]+/)?.[0],
  read('public/index.php').match(/<meta property="og:image:alt"[^\r\n]+/)?.[0],
  read('public/index.php').match(/<meta name="twitter:image:alt"[^\r\n]+/)?.[0],
];
if (
  !rssNameAssignment ||
  !rssItemTitle ||
  !rssChannelTitle ||
  !rssDescriptionTemplate ||
  htmlTitleTemplates.some((s) => !s)
)
  throw new Error('Missing production site-name/title template');
const titleProbe = spawnSync(
  phpBinary,
  [
    '-r',
    `require ${JSON.stringify(path.join(root, 'public/seo_schema_helper.php'))};
$samples = json_decode(base64_decode('${Buffer.from(JSON.stringify(allTitleSamples)).toString('base64')}'), true);
$htmlTemplates = json_decode(base64_decode('${Buffer.from(JSON.stringify(htmlTitleTemplates)).toString('base64')}'), true);
$xmlTemplates = json_decode(base64_decode('${Buffer.from(JSON.stringify([rssChannelTitle, rssItemTitle])).toString('base64')}'), true);
$rows = [];
foreach ($samples as $sample) {
  $post = ['title' => $sample['raw']];
  $feedName = (static function(array $rows): string { ${rssNameAssignment} return $siteName; })(['site_name' => $sample['raw']]);
  $feedTitle = $feedName;
  $seoTitle = html_entity_decode($sample['raw'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $xml = [];
  foreach ($xmlTemplates as $template) {
    ob_start(); eval('?>' . $template); $encoded = ob_get_clean();
    $doc = new DOMDocument();
    if (!$doc->loadXML($encoded, LIBXML_NONET)) throw new RuntimeException('Invalid title XML');
    $xml[] = $doc->documentElement->textContent;
  }
  $html = [];
  foreach ($htmlTemplates as $template) {
    ob_start(); eval('?>' . $template); $encoded = ob_get_clean();
    $doc = new DOMDocument();
    $doc->loadHTML('<meta charset="UTF-8">' . $encoded, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    $node = $doc->getElementsByTagName('title')->item(0) ?? $doc->getElementsByTagName('meta')->item(1);
    $html[] = $node->nodeName === 'title' ? $node->textContent : $node->getAttribute('content');
    if ($doc->getElementsByTagName('script')->length !== 0) throw new RuntimeException('Title became markup');
  }
  $schema = [];
  $content = $post + ['id' => 56, 'slug' => 'story', 'category' => 'News', 'created_at' => '2026-11-01 12:00:00'];
  voncms_apply_content_schema($schema, $content, 'post', 'Description', '', 'https://example.test/story', 'https://example.test', 'NewsArticle');
  $graph = voncms_build_public_schema_graph($schema, ['path' => 'story', 'domainUrl' => 'https://example.test', 'siteName' => 'Audit Site', 'post' => $content]);
  $article = array_values(array_filter($graph['@graph'], static fn(array $node): bool => $node['@type'] === 'NewsArticle'))[0];
  $rows[] = ['expected' => $sample['expected'], 'xml' => $xml, 'html' => $html, 'headline' => $article['headline'], 'name' => $article['name']];
}
$descriptions = [];
foreach ([['R&D', 'R&D'], ['R&amp;D', 'R&D'], ['<p>R&amp;D</p>', 'R&D'], ['x<y and z>w', 'x<y and z>w'], ['', '']] as [$rawDescription, $expectedDescription]) {
  $feedDesc = (static function(array $rows): string { ${rssDescriptionBlock} return $siteDesc; })(['site_description' => $rawDescription]);
  ob_start(); eval('?>' . base64_decode('${Buffer.from(rssDescriptionTemplate).toString('base64')}')); $encoded = ob_get_clean();
  $doc = new DOMDocument();
  if (!$doc->loadXML($encoded, LIBXML_NONET)) throw new RuntimeException('Invalid channel description XML');
  $descriptions[] = ['expected' => $expectedDescription, 'actual' => $doc->documentElement->textContent];
}
echo json_encode(['titles' => $rows, 'descriptions' => $descriptions], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);`,
  ],
  { encoding: 'utf8' }
);
if (titleProbe.status !== 0 || titleProbe.stderr.trim()) {
  throw new Error(titleProbe.stderr || titleProbe.stdout);
}
const titleData = JSON.parse(titleProbe.stdout);
const titleRows = titleData.titles;
check(
  'generated entity corpus has one result for every independently constructed sample',
  titleRows.length === allTitleSamples.length && encodingSamples.length > 100,
  { samples: allTitleSamples.length, generated: encodingSamples.length }
);
check(
  'RSS channel descriptions clean legacy entities and rich text without losing comparisons',
  titleData.descriptions.every((row) => row.actual === row.expected),
  titleData.descriptions
);
for (let index = 0; index < allTitleSamples.length; index += 1) {
  const sample = allTitleSamples[index];
  const row = titleRows[index];
  check(
    'HTML and RSS titles round-trip one entity layer as text:' + sample.raw,
    [...row.xml, ...row.html, row.headline, row.name].every((text) => text === sample.expected),
    row
  );
  // Existing controlled client fixtures exercise route/hydration wiring; use the
  // optional real-Chrome branch below for the generated corpus and actual decoder.
  if (index >= titleSamples.length) continue;
  for (const [domain, base] of [
    ['https://example.test', '/'],
    ['https://example.test/blog', '/blog/'],
  ]) {
    const runtime = makeRuntime(domain, base);
    for (const view of ['single-post', 'page']) {
      const content = { id: '56', slug: 'story', title: sample.raw, category: 'News' };
      const output = runtime.render(
        '',
        view,
        view === 'page' ? { selectedPage: content } : { selectedPost: content }
      );
      const graph = JSON.parse(
        runtime.dom.document.head.querySelector('script[type="application/ld+json"]').textContent
      )['@graph'];
      const article = graph.find((node) => node['@type'] === 'NewsArticle');
      const breadcrumbs = graph.find((node) => node['@type'] === 'BreadcrumbList');
      check(
        'client title uses the same decoded text as theme headings:' +
          domain +
          ':' +
          view +
          ':' +
          sample.raw,
        output.title === sample.expected + ' | Audit Site' &&
          (view !== 'single-post' || article.headline === sample.expected) &&
          breadcrumbs.itemListElement.at(-1).name ===
            (view === 'single-post' ? sample.expected : sample.expected + ' | Audit Site'),
        { output, article, breadcrumbs }
      );
    }
    runtime.unmount();
  }
}

// Collection producers already combine the resolved site name with route text.
// Exercise their actual assignments and the final graph at root and subfolder.
const collectionIndexSource = read('public/index.php');
const collectionTitleProducer = sliceBetween(
  collectionIndexSource,
  '$categoryPageSuffix =',
  '$categoryDescriptionContext ='
);
const paginatedTitleProducer = collectionIndexSource.match(
  /\$seoTitle = \$siteName \. ' - Page ' \. \$publicListingPage;/
)?.[0];
const collectionSchemaProducers = Array.from(
  collectionIndexSource.matchAll(
    /\$schemaData = \[\s*'@context' => 'https:\/\/schema.org',\s*'@type' => 'CollectionPage',[\s\S]*?\];/g
  )
).map((match) => match[0]);
if (!paginatedTitleProducer || collectionSchemaProducers.length !== 2)
  throw new Error('Missing production collection title/schema assignment');
const collectionProbe = spawnSync(
  phpBinary,
  [
    '-r',
    `require ${JSON.stringify(path.join(root, 'public/seo_schema_helper.php'))};
$samples = json_decode(base64_decode('${Buffer.from(JSON.stringify(allTitleSamples)).toString('base64')}'), true);
$schemas = json_decode(base64_decode('${Buffer.from(JSON.stringify(collectionSchemaProducers)).toString('base64')}'), true);
$rows = [];
foreach (['https://example.test', 'https://example.test/blog'] as $domainUrl) {
  foreach ($samples as $sample) {
    $siteName = voncms_normalize_public_site_name($sample['raw']);
    $siteDescription = $seoDescription = 'Description &amp; details';
    foreach (['category', 'page-2'] as $route) {
      $selectedCategoryName = 'News';
      $publicListingPage = $route === 'category' ? 1 : 2;
      if ($route === 'category') { ${collectionTitleProducer} } else { ${paginatedTitleProducer} }
      $seoUrl = $domainUrl . ($route === 'category' ? '/?category=News' : '/?page=2');
      eval($schemas[$route === 'category' ? 0 : 1]);
      $graph = voncms_build_public_schema_graph($schemaData, ['path' => '', 'domainUrl' => $domainUrl, 'siteName' => $siteName, 'isCategoryLanding' => $route === 'category']);
      $collection = array_values(array_filter($graph['@graph'], static fn(array $node): bool => $node['@type'] === 'CollectionPage'))[0];
      $expected = $route === 'category' ? 'News - ' . $sample['expected'] : $sample['expected'] . ' - Page 2';
      $rows[] = ['domain' => $domainUrl, 'raw' => $sample['raw'], 'route' => $route, 'expected' => $expected, 'title' => $seoTitle, 'schema' => $collection['name'], 'description' => $collection['description'], 'url' => $collection['url'], 'expectedUrl' => $seoUrl];
    }
  }
}
echo json_encode($rows, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);`,
  ],
  { encoding: 'utf8' }
);
if (collectionProbe.status !== 0 || collectionProbe.stderr.trim())
  throw new Error(collectionProbe.stderr || collectionProbe.stdout);
for (const row of JSON.parse(collectionProbe.stdout)) {
  check(
    'resolved collection titles retain one site-name entity layer:' +
      row.domain +
      ':' +
      row.route +
      ':' +
      row.raw,
    row.title === row.expected &&
      row.schema === row.expected &&
      row.description === 'Description & details' &&
      row.url === row.expectedUrl,
    row
  );
}

const projectionProbe = spawnSync(
  phpBinary,
  [
    '-r',
    `define('VONCMS_CORE_LOADED', true);
require ${JSON.stringify(path.join(root, 'public/core/ResponseHelper.php'))};
require ${JSON.stringify(path.join(root, 'public/news_sitemap_helper.php'))};
$samples = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$rows = []; $doubleDecodeRejected = false;
foreach ($samples as $sample) {
  $name = voncms_normalize_public_site_name($sample['raw']);
  if (voncms_normalize_public_site_name($name) !== $sample['expected']) $doubleDecodeRejected = true;
  $comments = [];
  foreach ([[false, false], [true, false], [true, true]] as [$staff, $owner]) {
    $comment = ResponseHelper::shapeCommentPayload(['username' => $sample['raw'], 'content' => $sample['raw']], $staff, $owner);
    $comments[] = [$comment['username'], $comment['content']];
  }
  // News XML escapes already-resolved text; it must not decode it again.
  $doc = new DOMDocument();
  if (!$doc->loadXML('<title>' . voncms_news_sitemap_xml_text($name) . '</title>', LIBXML_NONET)) throw new RuntimeException('Invalid News XML');
  $rows[] = ['name' => $name, 'comments' => $comments, 'newsTitle' => $doc->documentElement->textContent];
}
echo json_encode(['rows' => $rows, 'doubleDecodeRejected' => $doubleDecodeRejected], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);`,
  ],
  { input: JSON.stringify(allTitleSamples), encoding: 'utf8' }
);
if (projectionProbe.status !== 0 || projectionProbe.stderr.trim())
  throw new Error(projectionProbe.stderr || projectionProbe.stdout);
const projections = JSON.parse(projectionProbe.stdout);
check(
  'one-layer name contract detects an intentionally repeated decode',
  projections.doubleDecodeRejected
);
check(
  'PHP projections return one row per generated sample',
  projections.rows.length === allTitleSamples.length
);
for (let index = 0; index < allTitleSamples.length; index += 1) {
  const expected = allTitleSamples[index].expected;
  const row = projections.rows[index];
  check(
    'name/comment projections and final News XML preserve the declared entity layer:' + index,
    row.name === expected &&
      row.newsTitle === expected &&
      row.comments.flat().every((value) => value === expected),
    { sample: allTitleSamples[index], actual: row }
  );
}

// Browser parsing is an explicit additional rung, not a silently skipped PASS or
// a new Chrome prerequisite for the ordinary PHP/client-fixture integration gate.
let encodingBrowser = {
  status: 'NOT_RUN',
  command: 'node server/test-seo-regressions.cjs --encoding-browser',
};
function removeEncodingFixture(directory) {
  // Only this generated fixture/profile, never a user browser or shared temp root.
  const tempRoot = fs.realpathSync(os.tmpdir());
  const resolved = fs.realpathSync(directory);
  if (
    path.dirname(resolved) !== tempRoot ||
    !path.basename(resolved).startsWith('voncms-encoding-')
  )
    throw new Error('Refusing unexpected encoding-fixture cleanup target.');
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
if (process.argv.includes('--encoding-browser')) {
  const chrome =
    process.env.CHROME_BIN ||
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : '/usr/bin/google-chrome');
  if (!fs.existsSync(chrome))
    throw new Error('Encoding browser check requires CHROME_BIN or installed Chrome.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-encoding-'));
  try {
    const textModule = ts.transpileModule(read('src/utils/textUtils.ts'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
    const purifyScript = path.join(path.dirname(localRequire.resolve('dompurify')), 'purify.js');
    const fixture = `<!doctype html><meta charset="utf-8"><pre id="encoding-result"></pre>
<script src="${pathToFileURL(purifyScript).href}"></script>
<script>
try {
  const module = {exports:{}};
  Function('require','module','exports',${scriptJson(textModule)})(
    id => {if(id !== 'dompurify') throw Error('Unexpected fixture dependency');return window.DOMPurify},module,module.exports);
  const decode = module.exports.decodeEntities;
  const samples = ${scriptJson(allTitleSamples)};
  const failures = [];
  const mutations = {missingDecode:0,doubleDecode:0,markupReparse:0};
  for (const [index,sample] of samples.entries()) {
    const actual = decode(sample.raw);
    const label = document.createElement('h1'); label.textContent = actual;
    const meta = document.createElement('meta'); meta.content = actual;
    const parsed = new DOMParser().parseFromString(label.outerHTML + meta.outerHTML,'text/html');
    if(actual !== sample.expected || parsed.querySelector('h1').textContent !== sample.expected ||
       parsed.querySelector('meta').content !== sample.expected || parsed.querySelector('script,img,b'))
      failures.push({index,raw:sample.raw,expected:sample.expected,actual});
    if(sample.raw !== sample.expected) mutations.missingDecode++;
    if(decode(actual) !== sample.expected) mutations.doubleDecode++;
    const reparsed = window.DOMPurify.sanitize(sample.raw,{ALLOWED_TAGS:[],ALLOWED_ATTR:[],RETURN_DOM_FRAGMENT:true}).textContent;
    if(reparsed !== sample.expected) mutations.markupReparse++;
  }
  for(const raw of ['',undefined,'0']) {
    const expected = raw === '0' ? '0' : '';
    if(decode(raw) !== expected) failures.push({raw,expected,actual:decode(raw)});
  }
  const result = {samples:samples.length+3,failures,mutations};
  document.getElementById('encoding-result').textContent = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(result))));
} catch(error) {
  document.getElementById('encoding-result').textContent = btoa(JSON.stringify({error:String(error)}));
}
</script>`;
    const file = path.join(temporary, 'index.html');
    fs.writeFileSync(file, fixture);
    const browser = spawnSync(
      chrome,
      [
        '--headless=new',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-extensions',
        '--disable-sync',
        '--disable-component-update',
        '--user-data-dir=' + path.join(temporary, 'profile'),
        '--dump-dom',
        pathToFileURL(file).href,
      ],
      { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
    );
    const match = browser.stdout?.match(/<pre id="encoding-result">([A-Za-z0-9+/=]+)<\/pre>/);
    if (browser.status !== 0 || !match)
      throw new Error(
        'Encoding Chrome fixture failed: ' +
          (browser.error?.message || browser.stderr || browser.stdout)
      );
    const observed = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    if (observed.error) throw new Error(observed.error);
    check(
      'real Chrome and installed DOMPurify preserve one text layer, literal code and meta attributes',
      observed.failures.length === 0,
      observed
    );
    check(
      'real-browser assertions reject missing decode, double decode and markup reinterpretation',
      Object.values(observed.mutations).every((count) => count > 0),
      observed.mutations
    );
    encodingBrowser = { status: observed.failures.length ? 'FAIL' : 'PASS', ...observed };
  } finally {
    removeEncodingFixture(temporary);
  }
}

const fingerprintFiles = [
  'public/index.php',
  'public/public_render_helper.php',
  'public/seo_route_helper.php',
  'public/seo_schema_helper.php',
  'public/api/save_post.php',
  'public/api/save_page.php',
  'src/plugins/von-core/features/seo/VonSEO.tsx',
  'src/hooks/useSettings.ts',
  'src/utils/siteUtils.ts',
  'src/utils/textUtils.ts',
  'public/rss.php',
  'public/news_sitemap_helper.php',
  'public/core/ResponseHelper.php',
];
const final = {
  version: JSON.parse(read('package.json')).version,
  sourceHashes: Object.fromEntries(
    fingerprintFiles.map((f) => [f, createHash('sha256').update(read(f)).digest('hex')])
  ),
  encodingCoverage: {
    sourceFiles: productionFiles.length,
    encodingFiles: Object.keys(actualEncodingOperations).length,
    generatedSamples: allTitleSamples.length,
    browser: encodingBrowser,
    boundary:
      'Known encoding-operation inventory plus selected real output contracts; not whole-CMS behavioral proof.',
  },
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  results,
};
console.log(JSON.stringify(final, null, 2));
process.exitCode = final.failed ? 1 : 0;
