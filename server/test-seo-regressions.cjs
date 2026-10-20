// Maintained SEO regressions. Uses controlled DOM/decoder fixtures and in-memory PHP SQL only.
// Actual PHP/TS logic is reused. DOM and React scheduling below are controlled fixtures,
// not substitutes for the separately exercised real-browser history flow.
const fs = require('node:fs');
const path = require('node:path');
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
    setter(input);
    const links = dom.nodes.filter((node) => node.tagName === 'link');
    const actual = links[0]?.getAttribute('href') ?? null;
    check(
      `canonical setter ${existing ? 'update' : 'create'}:${input}`,
      actual === (expected ?? (existing ? previous : null)) &&
        links.length === (expected !== null || existing ? 1 : 0),
      { input, expected, actual, links: links.length }
    );
  }
}

function makeRuntime(domain, base) {
  const dom = makeHead(),
    effects = [],
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
      if (id.endsWith('/utils/security')) return { htmlToPlainText: (s) => s };
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
    location.search = search;
    effects.length = 0;
    component({ settings, currentView: view, categoryPostCount: 3, ...extra });
    for (const cb of effects) cb();
    return {
      title: dom.document.title,
      canonical: dom.document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      robots: dom.document.head.querySelector('meta[name="robots"]')?.getAttribute('content'),
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
  return { render, settings, load, dom };
}

for (const [domain, base] of [
  ['https://example.test', '/'],
  ['https://news.example.test', '/'],
  ['http://localhost/zangetsu', '/zangetsu/'],
  ['https://example.test/news/cms', '/news/cms/'],
]) {
  const runtime = makeRuntime(domain, base);
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
const fingerprintFiles = [
  'public/index.php',
  'public/seo_route_helper.php',
  'public/seo_schema_helper.php',
  'public/api/save_post.php',
  'public/api/save_page.php',
  'src/plugins/von-core/features/seo/VonSEO.tsx',
  'src/utils/siteUtils.ts',
];
const final = {
  version: JSON.parse(read('package.json')).version,
  sourceHashes: Object.fromEntries(
    fingerprintFiles.map((f) => [f, createHash('sha256').update(read(f)).digest('hex')])
  ),
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  results,
};
console.log(JSON.stringify(final, null, 2));
process.exitCode = final.failed ? 1 : 0;
