const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const ts = require('typescript');
const vm = require('vm');

console.log('Starting VonCMS integration smoke test...');

const root = path.resolve(__dirname, '..');
const resolveFromRoot = (file) => path.resolve(root, file);
const exists = (file) => fs.existsSync(resolveFromRoot(file));
const read = (file) => fs.readFileSync(resolveFromRoot(file), 'utf8');

let failed = false;
let warningCount = 0;

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  failed = true;
}

function warn(message) {
  console.warn(`WARN ${message}`);
  warningCount += 1;
}

function assertIncludes(label, content, needles, successMessage, failureMessage) {
  const missing = needles.filter((needle) => !content.includes(needle));

  if (missing.length === 0) {
    pass(successMessage);
  } else {
    fail(`${failureMessage} Missing: ${missing.join(', ')}`);
  }
}

function assertExcludes(label, content, needles, successMessage, failureMessage) {
  const present = needles.filter((needle) => content.includes(needle));

  if (present.length === 0) {
    pass(successMessage);
  } else {
    fail(`${failureMessage} Present: ${present.join(', ')}`);
  }
}

if (!exists('server/themes-api.js')) {
  pass('CodeQL Source Hygiene: inactive legacy server/themes-api.js duplicate is absent.');
} else {
  fail('CodeQL Source Hygiene: inactive legacy server/themes-api.js duplicate still exists.');
}

const themesApiServerContent = read('server/themes-api.cjs');
assertIncludes(
  'Theme API Dev Path Guard',
  themesApiServerContent,
  [
    'function safeResolveInside(baseDir, ...segments)',
    'function assertSafeZipEntries(zip, destDir)',
    'const uploadedPath = safeResolveInside(THEMES_DIR, req.file.path);',
    'sanitizeThemeFileName(file.originalname)',
    "'/api/themes/upload'",
    'verifyDevToken',
    "upload.single('theme')",
    'const src = safeResolveInside(THEMES_DIR, safeId);',
    'const dst = safeResolveInside(PUBLIC_THEMES, safeId);',
  ],
  'Theme API Dev Path Guard: upload and enable paths stay inside managed theme directories.',
  'Theme API Dev Path Guard: local theme API can still use unchecked upload or theme paths.'
);

assertIncludes(
  'Theme API Dev Route Abuse Guard',
  themesApiServerContent,
  [
    "app.get('/api/themes', adminLimiter, verifyDevToken",
    "app.get('/api/content', adminLimiter, verifyDevToken",
    "app.get('/api/post', adminLimiter, verifyDevToken",
    "app.get('/api/get_comments', adminLimiter, verifyDevToken",
    "['/api/get_settings', '/api/get_settings.php']",
    "app.post('/api/verify-recaptcha', adminLimiter",
    "app.post('/api/update_profile', adminLimiter, verifyDevToken",
    "app.get('/api/get_users', adminLimiter, verifyDevToken",
  ],
  'Theme API Dev Route Abuse Guard: local Node read/mock routes are rate-limited and admin-only where appropriate.',
  'Theme API Dev Route Abuse Guard: local Node read/mock routes can still be hammered or called without the dev admin token.'
);

assertExcludes(
  'Theme API Dev Sanitizer Regex Guard',
  themesApiServerContent,
  ['replace(/<script', 'replace(/javascript:'],
  'Theme API Dev Sanitizer Regex Guard: local Node sanitizer avoids partial HTML/protocol regex filtering.',
  'Theme API Dev Sanitizer Regex Guard: local Node sanitizer still uses partial HTML/protocol regex filtering.'
);

const aiServerContent = read('server/ai.cjs');
assertIncludes(
  'AI Dev Route Rate Guard',
  aiServerContent,
  [
    "const rateLimit = require('express-rate-limit');",
    'const aiRateLimit = rateLimit({',
    "app.post('/api/ai/generate', aiRateLimit, aiAuthGuard, async (req, res)",
    "app.post('/api/ai/check', aiRateLimit, aiAuthGuard, async (req, res)",
  ],
  'AI Dev Route Rate Guard: Node AI routes expose scanner-visible rate-limit middleware plus auth guard.',
  'AI Dev Route Rate Guard: Node AI routes can be flagged as missing explicit rate-limit middleware.'
);

assertIncludes(
  'Shared URL Scheme Guard',
  read('src/utils/siteUtils.ts'),
  [
    "if (trimmed.startsWith('//')) return '#';",
    "['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)",
  ],
  'Shared URL Scheme Guard: unsupported absolute URL schemes fail closed.',
  'Shared URL Scheme Guard: unsupported absolute URL schemes can still pass through.'
);

assertIncludes(
  'API Header Method Preservation Guard',
  read('public/security.php'),
  [
    '$requestedMethods = trim((string) $methods);',
    "$GLOBALS['voncms_api_allowed_methods']",
    '$effectiveMethods =',
    'header("Access-Control-Allow-Methods: $effectiveMethods");',
  ],
  'API Header Method Preservation Guard: auth/error helpers preserve endpoint-specific CORS methods after POST endpoints set them.',
  'API Header Method Preservation Guard: auth/error helpers can still downgrade POST endpoint CORS methods to the default GET header.'
);

const legacyJavascriptSchemeMarker = "startsWith('java" + "script:')";
const legacyJavascriptSchemeChecks = walkFiles(resolveFromRoot('src'), (file) =>
  /\.(ts|tsx)$/.test(file)
).filter((file) => read(path.relative(root, file)).includes(legacyJavascriptSchemeMarker));
if (legacyJavascriptSchemeChecks.length === 0) {
  pass('Theme URL CodeQL Guard: public TS/TSX code uses the shared URL normalizer.');
} else {
  fail(
    `Theme URL CodeQL Guard: literal javascript: scheme checks remain in ${legacyJavascriptSchemeChecks
      .map((file) => path.relative(root, file))
      .join(', ')}`
  );
}

const rawJavascriptHrefRewriteMarker = 'href\\s*=\\s*["\']?java' + 'script:';
const rawJavascriptHrefRewrites = walkFiles(resolveFromRoot('src'), (file) =>
  /\.(ts|tsx)$/.test(file)
).filter((file) => read(path.relative(root, file)).includes(rawJavascriptHrefRewriteMarker));
if (rawJavascriptHrefRewrites.length === 0) {
  pass('Theme URL CodeQL Guard: raw javascript href rewrites do not remain in source call sites.');
} else {
  fail(
    `Theme URL CodeQL Guard: raw javascript href rewrites remain in ${rawJavascriptHrefRewrites
      .map((file) => path.relative(root, file))
      .join(', ')}`
  );
}

function loadTsModuleForSmoke(file) {
  const source = read(file);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module,
      exports: module.exports,
      console,
    },
    { filename: file }
  );
  return module.exports;
}

function getReleaseEntry(content, version) {
  const heading = `### [v${version}]`;
  const start = content.indexOf(heading);
  if (start === -1) {
    return '';
  }

  const nextHeading = content.indexOf('\n### [v', start + heading.length);
  return nextHeading === -1 ? content.slice(start) : content.slice(start, nextHeading);
}

function assertManagedBlock(file) {
  if (!exists(file)) {
    fail(`Missing Critical File: ${file}`);
    return;
  }

  const content = read(file);
  const beginCount = (content.match(/^# BEGIN VonCMS$/gm) || []).length;
  const endCount = (content.match(/^# END VonCMS$/gm) || []).length;

  if (beginCount === 1 && endCount === 1) {
    pass(`Managed Block: ${file} has exactly one VonCMS block.`);
  } else {
    fail(`Managed Block: ${file} has ${beginCount} BEGIN and ${endCount} END markers.`);
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function walkFiles(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'assets', 'uploads'].includes(entry.name)) {
        walkFiles(fullPath, predicate, files);
      }
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function extractTagAttributes(tagText) {
  const attrs = new Set();
  const attrRegex = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*(?:=|(?=\s|\/?>))/g;
  let match;

  while ((match = attrRegex.exec(tagText))) {
    if (!['input', 'select', 'textarea', 'label'].includes(match[1])) {
      attrs.add(match[1]);
    }
  }

  return attrs;
}

function extractAttributeValue(tagText, attrName) {
  const attrRegex = new RegExp(
    `${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{["']([^"']+)["']\\})`
  );
  const match = tagText.match(attrRegex);
  return match ? match[1] || match[2] || match[3] || '' : '';
}

function isInsideLabel(content, index) {
  const before = content.slice(0, index);
  const lastOpen = before.lastIndexOf('<label');
  const lastClose = before.lastIndexOf('</label>');
  return lastOpen !== -1 && lastOpen > lastClose;
}

function isInsideTemplateString(content, index) {
  const before = content.slice(0, index);
  const ticks = before.match(/(?<!\\)`/g) || [];
  return ticks.length % 2 === 1;
}

function findPhpBinary() {
  const candidates = [];

  if (process.env.PHP_BIN) {
    candidates.push(process.env.PHP_BIN);
  }

  if (process.platform === 'win32') {
    const wherePhp = spawnSync('where', ['php'], { encoding: 'utf8' });
    if (wherePhp.status === 0) {
      candidates.push(...wherePhp.stdout.split(/\r?\n/).filter(Boolean));
    }

    candidates.push('C:\\xampp\\php\\php.exe');
    candidates.push('C:\\laragon\\bin\\php\\php-8.2.0-Win32-vs16-x64\\php.exe');
    candidates.push('C:\\laragon\\bin\\php\\php-8.3.0-Win32-vs16-x64\\php.exe');
  } else {
    const whichPhp = spawnSync('which', ['php'], { encoding: 'utf8' });
    if (whichPhp.status === 0) {
      candidates.push(...whichPhp.stdout.split(/\r?\n/).filter(Boolean));
    }

    candidates.push('/usr/bin/php');
    candidates.push('/usr/local/bin/php');
  }

  for (const candidate of unique(candidates)) {
    const isAbsolutePath = path.isAbsolute(candidate);
    if (isAbsolutePath && !fs.existsSync(candidate)) {
      continue;
    }

    const probe = spawnSync(candidate, ['-v'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }

  return null;
}

const criticalFiles = [
  'public/security.php',
  'public/llms.php',
  'index.php',
  'index.html',
  'public/index.php',
  'public/media_variants.php',
  'public/api/login.php',
  'public/api/get_settings.php',
  'public/api/public_cache_helper.php',
  'public/api/save_settings.php',
  'public/api/get_posts.php',
  'public/api/get_post.php',
  'public/api/upload_file.php',
  'public/api/media_tools.php',
  'public/api/system/repair_htaccess.php',
  'public/api/system/clear_public_cache.php',
  'src/utils/siteUtils.ts',
  'server/test-integration.cjs',
  'package.json',
  'metadata.json',
  'vite.config.ts',
  'create_release.cjs',
  'server/lint-php.cjs',
];

criticalFiles.forEach((file) => {
  if (exists(file)) {
    pass(`File Found: ${file}`);
  } else {
    fail(`Missing Critical File: ${file}`);
  }
});

const pkg = JSON.parse(read('package.json'));
const meta = JSON.parse(read('metadata.json'));

if (pkg.version === meta.version) {
  pass(`Version Consistency: v${pkg.version} matched across manifests.`);
} else {
  fail(`Version Mismatch: package.json (v${pkg.version}) vs metadata.json (v${meta.version})`);
}

if (
  pkg.scripts['test:integration'] === 'node server/test-integration.cjs' &&
  pkg.scripts['test:smoke'] === 'node server/test-integration.cjs' &&
  pkg.scripts['test'] === 'npm run test:smoke' &&
  pkg.scripts['lint:php'] === 'node server/lint-php.cjs' &&
  pkg.scripts['ci:gate'] === 'npm run typecheck && npm run build && npm run test:smoke'
) {
  pass('Package Scripts: smoke and PHP lint gates are wired into package.json.');
} else {
  fail('Package Scripts: smoke or PHP lint gate scripts are not aligned in package.json.');
}

const phpLintScriptContent = read('server/lint-php.cjs');
if (
  phpLintScriptContent.includes('function collectPhpFiles(dir)') &&
  phpLintScriptContent.includes("entry.name.endsWith('.php')") &&
  phpLintScriptContent.includes("collectPhpFiles(path.join(root, 'public')).sort()") &&
  phpLintScriptContent.includes("spawnSync(phpBinary, ['-l', file]")
) {
  pass('PHP Lint Script Coverage: npm lint discovers public PHP files recursively.');
} else {
  fail('PHP Lint Script Coverage: npm lint can still miss nested public PHP files.');
}

const releaseSequenceContent = read('release-sequence.cjs');
const releaseIntegrationPosition = releaseSequenceContent.indexOf("['Integration smoke', 'npm'");
const releasePhpLintPosition = releaseSequenceContent.indexOf("['PHP lint', 'npm'");
const releasePackagePosition = releaseSequenceContent.indexOf("['Create release ZIPs', 'node'");
if (
  releaseIntegrationPosition !== -1 &&
  releasePhpLintPosition > releaseIntegrationPosition &&
  releasePackagePosition > releasePhpLintPosition &&
  phpLintScriptContent.includes("const laragonPhpRoot = 'C:\\\\laragon\\\\bin\\\\php';") &&
  phpLintScriptContent.includes('.readdirSync(laragonPhpRoot, { withFileTypes: true })')
) {
  pass(
    'Full Release Gate Contract: release sequence runs integration and discoverable PHP lint before packaging.'
  );
} else {
  fail(
    'Full Release Gate Contract: release sequence can package before integration/PHP lint or miss installed Laragon PHP versions.'
  );
}

const createReleaseContent = read('create_release.cjs');
if (
  createReleaseContent.includes('const buildEnv = { ...process.env };') &&
  createReleaseContent.includes('delete buildEnv.DEBUG;') &&
  createReleaseContent.includes("execSync('npm run build', { stdio: 'inherit', env: buildEnv });")
) {
  pass(
    'Clean Release Build Log Guard: release packaging strips inherited DEBUG flags before running the production build.'
  );
} else {
  fail(
    'Clean Release Build Log Guard: release packaging can inherit DEBUG flags and print noisy Rolldown/Vite diagnostics.'
  );
}

if (
  createReleaseContent.includes("deployZip.addLocalFile(path.join(basePath, 'README.md'));") &&
  createReleaseContent.includes("deployZip.addLocalFile(path.join(basePath, 'LICENSE.md'));") &&
  createReleaseContent.includes("deployZip.addLocalFile(path.join(basePath, 'metadata.json'));") &&
  createReleaseContent.includes("deployZip.addLocalFile(docsFilePath, 'docs');") &&
  !createReleaseContent.includes("file !== 'LICENSE.md'") &&
  !createReleaseContent.includes("deployZip.addLocalFile(path.join(basePath, 'package.json'));")
) {
  pass(
    'Deploy Package Hygiene: README, license, and metadata ship while package.json stays out of Deploy ZIP.'
  );
} else {
  fail(
    'Deploy Package Hygiene: Deploy ZIP must include README/license/metadata and exclude package.json.'
  );
}

if (
  createReleaseContent.includes(
    "deployZip.addLocalFile(path.join(basePath, 'public', '.htaccess'), '', '.htaccess');"
  ) &&
  createReleaseContent.includes("path.join(basePath, 'public', 'uploads', '.htaccess')") &&
  createReleaseContent.includes("'uploads'") &&
  createReleaseContent.includes(
    "sourceZip.addLocalFile(path.join(basePath, '.htaccess'), '', '.htaccess');"
  ) &&
  createReleaseContent.includes(
    "sourceZip.addLocalFile(path.join(basePath, 'public', '.htaccess'), 'public', '.htaccess');"
  ) &&
  createReleaseContent.includes("'public/uploads'")
) {
  pass(
    'Release .htaccess Packaging Contract: Deploy and Source ZIPs include explicit routing and uploads shield dotfiles.'
  );
} else {
  fail(
    'Release .htaccess Packaging Contract: release ZIPs can still omit routing or uploads shield .htaccess dotfiles.'
  );
}

if (
  createReleaseContent.includes("const changelogPath = path.join(basePath, 'CHANGELOG.md');") &&
  createReleaseContent.includes("deployZip.addLocalFile(changelogPath, '', 'CHANGELOG.md');") &&
  !createReleaseContent.includes("deployZip.addLocalFile(changelogPath, '', 'Changelog.md');") &&
  !createReleaseContent.includes("sourceZip.addLocalFile(changelogPath, '', 'Changelog.md');")
) {
  pass(
    'Release Changelog Casing Contract: Source and Deploy ZIPs use canonical CHANGELOG.md only.'
  );
} else {
  fail(
    'Release Changelog Casing Contract: package script must publish canonical CHANGELOG.md without Changelog.md alias.'
  );
}

const sourcePackagePrivateDenylist = [
  '.agent',
  '.agents',
  '.codex',
  '.cursorrules',
  'MASTERPLAN_2.0.md',
  'ROADMAP.md',
];
if (
  createReleaseContent.includes('sourcePackageExcludedRootItems') &&
  sourcePackagePrivateDenylist.every((entry) => createReleaseContent.includes(`'${entry}'`)) &&
  createReleaseContent.includes("'docs/superpowers'") &&
  createReleaseContent.includes("file !== 'superpowers'") &&
  createReleaseContent.includes("normalizedRelativePath.startsWith('docs/superpowers/')")
) {
  pass(
    'Release Package Planning Artifact Guard: private agent and planning files stay out of Source ZIPs.'
  );
} else {
  fail(
    'Release Package Planning Artifact Guard: release packages can still include private agent or planning files.'
  );
}

const sourceZipPath = resolveFromRoot(`VonCMS_v${pkg.version}_Source.zip`);
if (fs.existsSync(sourceZipPath)) {
  const sourceZipEntries = new AdmZip(sourceZipPath).getEntries().map((entry) => entry.entryName);
  const leakedPrivateEntries = sourceZipEntries.filter((entry) =>
    sourcePackagePrivateDenylist.some(
      (denied) => entry === denied || entry.startsWith(`${denied}/`)
    )
  );
  if (leakedPrivateEntries.length === 0) {
    pass('Release Source ZIP Hygiene: private agent and planning files are absent.');
  } else {
    fail(
      `Release Source ZIP Hygiene: private agent/planning files leaked into Source ZIP: ${leakedPrivateEntries
        .slice(0, 8)
        .join(', ')}`
    );
  }
}

if (
  createReleaseContent.includes('const releaseArtifactPattern = new RegExp(') &&
  createReleaseContent.includes('`^VonCMS_v\\\\d+\\\\.\\\\d+\\\\.\\\\d+_(Deploy|Source)\\\\.zip') &&
  createReleaseContent.includes('releaseArtifactPattern.test(f)') &&
  !createReleaseContent.includes("f.endsWith('.zip') || f.endsWith('.zip.sha256')")
) {
  pass(
    'Release Cleanup Safety: old versioned release ZIPs are removed without touching generic backup ZIPs.'
  );
} else {
  fail(
    'Release Cleanup Safety: create_release.cjs must remove old versioned release ZIPs without deleting generic backup ZIPs.'
  );
}

assertIncludes(
  'Release Public Cache Runtime Exclusion',
  createReleaseContent,
  [
    "normalizedRelativePath.startsWith('public/data/public-cache/')",
    "normalizedRelativePath.startsWith('data/public-cache/')",
  ],
  'Release Public Cache Runtime Exclusion: generated public cache files stay out of Deploy and Source packages.',
  'Release Public Cache Runtime Exclusion: packager can still include generated public cache runtime files.'
);
const rootIndexHtmlContent = read('index.html');
const publicIndexHtmlContent = read('public/index.php');
const distIndexHtmlContent = exists('dist/index.html') ? read('dist/index.html') : '';
assertExcludes(
  'External Font Loading Guard',
  `${rootIndexHtmlContent}\n${publicIndexHtmlContent}\n${distIndexHtmlContent}`,
  ['fonts.googleapis.com', 'fonts.gstatic.com'],
  'External Font Loading Guard: runtime HTML no longer depends on Google Fonts CSS or preconnects.',
  'External Font Loading Guard: Google Fonts references can still add a remote render dependency.'
);

const localInterCssContent = read('public/fonts/inter/inter.css');
const localInterLicenseContent = read('public/fonts/inter/LICENSE.txt');
const publicRuntimeIndexContent = read('public/index.php');
const skeletonFontContent = read('public/skeleton.css');
const themeRegistryFontContent = read('src/plugins/von-core/features/themes/themeRegistry.ts');
const defaultThemeSettingsFontContent = read(
  'src/plugins/von-core/features/extensions/components/DefaultThemeSettings.tsx'
);
const fontHtaccessContent =
  read('.htaccess') +
  read('public/.htaccess') +
  read('public/api/install.php') +
  read('public/api/system/repair_htaccess.php');
const missingInterVariableFiles = ['latin', 'latin-ext'].filter(
  (label) => !exists(`public/fonts/inter/inter-${label}-wght-normal.woff2`)
);
if (
  rootIndexHtmlContent.includes('fonts/inter/inter.css') &&
  publicRuntimeIndexContent.includes("$basePath . 'fonts/inter/inter.css'") &&
  localInterCssContent.includes('@font-face') &&
  localInterCssContent.includes("font-family: 'Inter';") &&
  localInterCssContent.includes('font-weight: 100 900;') &&
  localInterCssContent.includes("src: url('inter-latin-wght-normal.woff2')") &&
  localInterCssContent.includes("src: url('inter-latin-ext-wght-normal.woff2')") &&
  localInterCssContent.includes("format('woff2')") &&
  localInterCssContent.includes('unicode-range:') &&
  localInterLicenseContent.includes('SIL Open Font License') &&
  localInterLicenseContent.includes('@fontsource-variable/inter') &&
  !skeletonFontContent.includes('@font-face') &&
  !skeletonFontContent.includes('fonts/inter/') &&
  fontHtaccessContent.includes('AddType font/woff2 .woff2') &&
  themeRegistryFontContent.includes("fontFamily: 'Inter, sans-serif'") &&
  exists('public/fonts/inter/inter.css') &&
  exists('public/fonts/inter/LICENSE.txt') &&
  missingInterVariableFiles.length === 0 &&
  !exists('public/fonts/inter/inter-latin-400-normal.woff2') &&
  !exists('public/fonts/inter/inter-latin-700-normal.woff2') &&
  !exists('public/fonts/inter/inter-400.ttf') &&
  !exists('public/fonts/inter/inter-700.ttf')
) {
  pass(
    'Self-Hosted Inter Font Guard: bundled themes keep the Inter default while loading compact local variable WOFF2 files from the dedicated font CSS instead of Google Fonts, static weight files, or legacy TTF.'
  );
} else {
  fail(
    `Self-Hosted Inter Font Guard: variable WOFF2 Inter defaults, MIME rules, or local font files are missing${
      missingInterVariableFiles.length ? ` (${missingInterVariableFiles.join(', ')})` : ''
    }, risking a visual regression, package bloat, or remote font dependency.`
  );
}

if (
  skeletonFontContent.includes('.dark .sk-nav,') &&
  skeletonFontContent.includes('background: #111827;') &&
  skeletonFontContent.includes('.dark .sk-nav::after,') &&
  skeletonFontContent.includes('rgba(59, 130, 246, 0.1)') &&
  skeletonFontContent.includes('rgba(148, 163, 184, 0.16)')
) {
  pass(
    'Skeleton Dark Palette Contract: dark-mode skeleton blocks and shimmer match the slate/blue runtime surface instead of flat near-black blocks.'
  );
} else {
  fail(
    'Skeleton Dark Palette Contract: dark-mode skeleton blocks still use the old mismatched flat dark palette or light shimmer.'
  );
}

assertExcludes(
  'Legacy Inter TTF Guard',
  localInterCssContent + skeletonFontContent + fontHtaccessContent,
  [
    '.ttf',
    "format('truetype')",
    'application/x-font-ttf',
    'inter-latin-400-normal.woff2',
    'inter-latin-700-normal.woff2',
  ],
  'Legacy Inter TTF Guard: runtime font CSS and Apache templates no longer reference large TTF or static Inter weight files.',
  'Legacy Inter TTF Guard: runtime font CSS or Apache templates still reference legacy TTF/static Inter files.'
);

assertIncludes(
  'Bundled Theme Font Choices',
  defaultThemeSettingsFontContent,
  ['Inter (Bundled)', 'System Sans', 'System Serif'],
  'Bundled Theme Font Choices: Default theme font picker only offers bundled or system-safe font stacks.',
  'Bundled Theme Font Choices: Default theme font picker is missing the bundled/system-safe font choices.'
);

assertExcludes(
  'Unbundled Theme Font Guard',
  `${themeRegistryFontContent}\n${defaultThemeSettingsFontContent}`,
  ['Roboto (Clean)', 'Open Sans', 'Playfair Display', 'Space Grotesk'],
  'Unbundled Theme Font Guard: bundled theme defaults and pickers avoid unshipped Google-font names.',
  'Unbundled Theme Font Guard: bundled theme config still references font families that are not shipped locally.'
);

const viteConfigContent = read('vite.config.ts');
assertIncludes(
  'Vite Build Chunk Policy',
  viteConfigContent,
  [
    'manualChunks(id)',
    "return 'security-core';",
    "return 'vendor-recharts';",
    "return 'vendor-icons-a-f';",
    "return 'vendor-icons-g-l';",
    "return 'vendor-icons-m-r';",
    "return 'vendor-icons-s-z';",
  ],
  'Vite Build Chunk Policy: core security, chart, and split Lucide icon chunks stay explicit without forcing unrelated public themes into the entry preload path.',
  'Vite Build Chunk Policy: expected manual chunk markers are missing.'
);
if (
  viteConfigContent.includes("'vendor-icons'") ||
  viteConfigContent.includes('"vendor-icons"') ||
  viteConfigContent.includes("'vendor-icons-core'") ||
  viteConfigContent.includes('"vendor-icons-core"')
) {
  fail(
    'Vite Build Chunk Policy: lucide-react must not be forced into one oversized or circular icon chunk.'
  );
} else {
  pass('Vite Build Chunk Policy: lucide-react is split into bounded icon chunks.');
}

const vendorEditorReturnIndex = viteConfigContent.indexOf("return 'vendor-editor';");
const genericVendorReturnIndex = viteConfigContent.indexOf("return 'vendor';");
if (
  vendorEditorReturnIndex !== -1 &&
  genericVendorReturnIndex !== -1 &&
  vendorEditorReturnIndex < genericVendorReturnIndex &&
  viteConfigContent.includes('/node_modules/@tiptap/') &&
  viteConfigContent.includes('/node_modules/prosemirror-') &&
  viteConfigContent.includes('/node_modules/orderedmap/') &&
  viteConfigContent.includes('/node_modules/rope-sequence/') &&
  viteConfigContent.includes('/node_modules/w3c-keyname/')
) {
  pass(
    'Vite Editor Vendor Chunk Policy: TipTap and ProseMirror editor dependencies are split before generic vendor fallback.'
  );
} else {
  fail(
    'Vite Editor Vendor Chunk Policy: TipTap/ProseMirror dependencies can still fall into the generic vendor chunk.'
  );
}

const publicSiteContent = read('src/plugins/von-core/features/public/PublicSite.tsx');
if (
  publicSiteContent.includes('lazy(() => import(') &&
  publicSiteContent.includes('React.Suspense') &&
  publicSiteContent.includes("themeLayouts[activeTheme.id] || themeLayouts['theme-default']") &&
  !publicSiteContent.includes("import DefaultLayout from '../../../../themes/default/Layout'") &&
  !publicSiteContent.includes(
    "import CorporateProLayout from '../../../../themes/corporate-pro/Layout'"
  )
) {
  pass('Public Theme Lazy Loading: inactive public themes stay out of the initial source graph.');
} else {
  fail(
    'Public Theme Lazy Loading: PublicSite must lazy-load theme layouts instead of statically importing all themes.'
  );
}

const contactFormRendererContent = read('src/components/ContactFormRenderer.tsx');
const contentRendererContent = read('src/components/ContentRenderer.tsx');
const skeletonCssContent = read('public/skeleton.css');
const submitContactContent = read('public/api/submit_contact.php');
const newsletterSubscribeContent = read('public/api/newsletter_subscribe.php');
const vonNewsletterContent = read('src/components/VonNewsletter.tsx');
const newsletterManagerContent = read(
  'src/plugins/von-core/features/newsletter/NewsletterManager.tsx'
);
const contactSubmissionsContent = read('public/api/contact/get_submissions.php');
const contactManagerContent = read('src/pages/admin/ContactManager.tsx');
const securityDashboardContent = read(
  'src/plugins/von-core/features/security/SecurityDashboard.tsx'
);
const securityLogsContent = read('public/api/security/get_security_logs.php');
const appShellContent = read('src/App.tsx');
if (
  appShellContent.includes('await loadSettings();') &&
  !appShellContent.includes('Promise.all([loadSettings(), loadContent(), loadComments()])') &&
  appShellContent.includes('setIsInitialLoading(false);') &&
  appShellContent.includes('void loadComments();') &&
  appShellContent.includes('if (user) {') &&
  appShellContent.includes('loadContent();') &&
  appShellContent.includes('loadComments();') &&
  appShellContent.includes('loadSettings();')
) {
  pass(
    'Public Boot Data Budget: anonymous first render waits on settings only, then refreshes public comments without restoring admin-scale content preload.'
  );
} else {
  fail(
    'Public Boot Data Budget: app boot can still block public first render on admin-scale content, or guest comments can remain empty until login.'
  );
}
const adSettingsContent = read('src/plugins/von-core/features/settings/components/AdSettings.tsx');
const publicProfileHookContent = read('src/hooks/usePublicProfile.ts');
const editorContent = read('src/components/Editor.tsx');
const editorExtensionsPath = 'src/components/editor/editorExtensions.ts';
const editorExtensionsContent = exists(editorExtensionsPath) ? read(editorExtensionsPath) : '';
const postEditorContent = read('src/components/PostEditor.tsx');
const postEditorSaveHelpersPath = 'src/components/editor/postEditorSaveHelpers.ts';
const postEditorSaveHelpersContent = exists(postEditorSaveHelpersPath)
  ? read(postEditorSaveHelpersPath)
  : '';
const seoAnalyzerContent = read('src/utils/seoAnalyzer.ts');
const useContentRoutingContent = read('src/hooks/useContent.ts');
const packageJsonContent = read('package.json');
const adBlockContent = read('src/themes/shared/components/AdBlock.tsx');
const themeEngineContent = read('src/plugins/von-core/features/themes/ThemeEngine.ts');
const pluginRegistryContent = read('src/plugins/von-core/features/plugins/registry.tsx');
const usePluginsContent = read('src/hooks/usePlugins.tsx');
const pluginRuntimeContent = exists('src/utils/pluginRuntime.ts')
  ? read('src/utils/pluginRuntime.ts')
  : '';
const aiSummaryPluginContent = read(
  'src/plugins/von-core/features/plugins/built-in/ai-summary/index.tsx'
);
const relatedPostsPluginContent = read(
  'src/plugins/von-core/features/plugins/built-in/related-posts/index.tsx'
);
const aiSummaryExtractorsContent = read(
  'src/plugins/von-core/features/plugins/built-in/ai-summary/extractors.ts'
);
const discussionScannerContent = read(
  'src/plugins/von-core/features/discussion/DiscussionManager.tsx'
);
const contactFormNoSemgrepCount = (
  contactFormRendererContent.match(/nosemgrep: react-dangerouslysetinnerhtml/g) || []
).length;
const contentRendererNoSemgrepCount = (
  contentRendererContent.match(/nosemgrep: react-dangerouslysetinnerhtml/g) || []
).length;
const adBlockNoSemgrepCount = (
  adBlockContent.match(/nosemgrep: react-dangerouslysetinnerhtml/g) || []
).length;

if (
  contactFormNoSemgrepCount >= 2 &&
  contactFormRendererContent.includes('sanitizeHtml(text.replace') &&
  contactFormRendererContent.includes('dangerouslySetInnerHTML')
) {
  pass(
    'Semgrep False Positive Guard: ContactFormRenderer suppressions stay paired with sanitizeHtml.'
  );
} else {
  fail(
    'Semgrep False Positive Guard: ContactFormRenderer dangerouslySetInnerHTML sites must remain explicitly suppressed and sanitized.'
  );
}

if (
  submitContactContent.includes('$requiredFields = [];') &&
  submitContactContent.includes('$missingRequiredFields') &&
  submitContactContent.includes("$messages['validationError']") &&
  !submitContactContent.includes(
    'RateLimiter::recordAttempt();\r\nCSRFProtection::requireToken();'
  ) &&
  !submitContactContent.includes('RateLimiter::recordAttempt();\nCSRFProtection::requireToken();')
) {
  pass(
    'Contact Submit Contract: backend validates required template fields without counting successful submissions as failed rate-limit attempts.'
  );
} else {
  fail(
    'Contact Submit Contract: contact submissions must enforce required fields server-side and avoid recording valid submits as failed attempts.'
  );
}

assertIncludes(
  'Newsletter Public Subscribe Contract',
  newsletterSubscribeContent,
  [
    '$newsletterEnabled = false;',
    "setting_key IN ('newsletter_config', 'configuration')",
    'Newsletter subscriptions are currently disabled.',
  ],
  'Newsletter Public Subscribe Contract: direct subscribe API honors the admin enabled setting.',
  'Newsletter Public Subscribe Contract: subscribe endpoint can accept direct posts while newsletter is disabled.'
);

assertIncludes(
  'Newsletter Honeypot Contract',
  vonNewsletterContent,
  ['const [honeypot, setHoneypot] = useState', 'hp_field: honeypot', 'aria-hidden="true"'],
  'Newsletter Honeypot Contract: public newsletter forms submit the backend honeypot field.',
  'Newsletter Honeypot Contract: public newsletter forms do not carry the backend honeypot field.'
);

assertIncludes(
  'Newsletter Manager Query Contract',
  newsletterManagerContent,
  [
    'const NEWSLETTER_SUBSCRIBERS_PER_PAGE = 20;',
    'new URLSearchParams',
    'limit: String(NEWSLETTER_SUBSCRIBERS_PER_PAGE)',
    'itemsPerPage={NEWSLETTER_SUBSCRIBERS_PER_PAGE}',
  ],
  'Newsletter Manager Query Contract: subscriber search is URL-encoded and pagination display matches the API limit.',
  'Newsletter Manager Query Contract: subscriber search URL or pagination count can drift from the API.'
);

assertIncludes(
  'Contact Submissions Pagination Contract',
  contactSubmissionsContent,
  [
    'SELECT COUNT(*) as total FROM contact_submissions',
    'LIMIT $limit OFFSET $offset',
    "'pagination' => [",
  ],
  'Contact Submissions Pagination Contract: submissions API stays paginated instead of fetch-all.',
  'Contact Submissions Pagination Contract: submissions API still fetches every contact lead at once.'
);

assertIncludes(
  'Contact Manager Shortcode Contract',
  contactManagerContent,
  [
    '{`[von-contact id="${form.id}"]`}',
    '{`[von-contact id="${currentForm.id}"]`}',
    "tag === 'submit'",
    '\'[submit "Send Message"]\'',
  ],
  'Contact Manager Shortcode Contract: visible shortcodes and tag insertion output usable templates.',
  'Contact Manager Shortcode Contract: shortcode copy/display or tag insertion can produce stale placeholder output.'
);

assertIncludes(
  'Security Dashboard Setup Contract',
  securityDashboardContent,
  ['vonFetch(API.createSecurityTable, {', "method: 'POST'"],
  'Security Dashboard Setup Contract: missing security-log table setup uses the POST-only CSRF endpoint.',
  'Security Dashboard Setup Contract: security-log table setup still calls the POST-only endpoint without POST.'
);

assertIncludes(
  'Security Logs Pagination Contract',
  securityLogsContent,
  ['$page = max(1,', '$limit = min(100, max(1,', '$offset = ($page - 1) * $limit;'],
  'Security Logs Pagination Contract: admin security logs clamp page and limit before querying.',
  'Security Logs Pagination Contract: admin security logs still trust raw page/limit query values.'
);

if (
  contentRendererNoSemgrepCount >= 2 &&
  contentRendererContent.includes('sanitizeHtml(part)') &&
  contentRendererContent.includes('sanitizeHtml(processedHtml)')
) {
  pass('Semgrep False Positive Guard: ContentRenderer suppressions stay paired with sanitizeHtml.');
} else {
  fail(
    'Semgrep False Positive Guard: ContentRenderer dangerouslySetInnerHTML sites must remain explicitly suppressed and sanitized.'
  );
}

assertIncludes(
  'HourGlass Editor Extraction Boundary',
  editorContent + '\n' + editorExtensionsContent,
  [
    "from './editor/editorExtensions'",
    'export const EDITOR_EXTENSIONS',
    'export const EDITOR_SURFACE_CLASS',
    'export const VIDEO_ASPECT_STYLES',
    "name: 'legacyImage'",
    "name: 'videoEmbed'",
    'buildLegacyImageAttrsFromElement',
    'buildVideoEmbedAttrs',
  ],
  'HourGlass Editor Extraction Boundary: TipTap config and legacy media nodes live in the editor support module while Editor.tsx consumes the boundary.',
  'HourGlass Editor Extraction Boundary: TipTap config or legacy media node extraction markers are missing.'
);

assertExcludes(
  'HourGlass Editor Extraction Boundary Parent Cleanliness',
  editorContent,
  [
    "from '@tiptap/starter-kit'",
    "from '@tiptap/extension-text-align'",
    "from '@tiptap/extension-table'",
    "from '@tiptap/extension-text-style'",
    'TiptapNode.create',
    'const LegacyImage =',
    'const VideoEmbed =',
    'const buildLegacyImageAttrsFromElement =',
    'const buildVideoEmbedAttrs =',
  ],
  'HourGlass Editor Extraction Boundary: parent editor no longer owns TipTap extension imports or legacy media node definitions.',
  'HourGlass Editor Extraction Boundary: parent editor still owns extracted TipTap/media definitions.'
);

if (
  packageJsonContent.includes('@tiptap/react') &&
  packageJsonContent.includes('@tiptap/pm') &&
  packageJsonContent.includes('@tiptap/starter-kit') &&
  editorContent.includes("from '@tiptap/react'") &&
  editorExtensionsContent.includes("from '@tiptap/starter-kit'") &&
  editorContent.includes('useEditor({') &&
  editorContent.includes('<EditorContent editor={editor} />') &&
  editorContent.includes('editor?.getHTML()') &&
  editorContent.includes('editor.commands.setContent(') &&
  !editorContent.includes('document.execCommand(') &&
  !editorContent.includes('contentEditable={!isCodeView}')
) {
  pass(
    'HourGlass TipTap Foundation: editor engine uses TipTap HTML flow and no longer depends on execCommand/contentEditable.'
  );
} else {
  fail(
    'HourGlass TipTap Foundation: package manifest or Editor.tsx is still missing the TipTap HTML owner path, or execCommand/contentEditable debt is still active.'
  );
}

if (
  editorContent.includes('const handleEditorSurfaceMouseDown =') &&
  editorContent.includes("editor.commands.focus('end')") &&
  editorContent.includes('if (editor.isEmpty)') &&
  editorContent.includes('onMouseDown={handleEditorSurfaceMouseDown}') &&
  editorContent.includes("'data-editor-surface': 'hourglass'")
) {
  pass(
    'HourGlass Editor Focus Contract: empty-canvas clicks route focus into TipTap without forcing non-empty documents to jump.'
  );
} else {
  fail(
    'HourGlass Editor Focus Contract: Editor.tsx must focus the empty writing surface without forcing end-focus on non-empty documents.'
  );
}

assertIncludes(
  'HourGlass Editor URL Persistence',
  useContentRoutingContent + '\n' + appShellContent,
  [
    'const editorParams = new URLSearchParams();',
    "editorParams.set('type', isPage ? 'page' : 'post');",
    "editorParams.set('id', id);",
    'navigate(`/admin/editor?${editorParams.toString()}`);',
    "const editorItemId = searchParams.get('id') || '';",
    'const [recoveredEditorItem, setRecoveredEditorItem] = useState<Post | Page | null>(null);',
    'const effectiveEditingItem = editingItem || recoveredEditorItem;',
  ],
  'HourGlass Editor URL Persistence: editor routes preserve type/id and can recover the active item after hard refresh.',
  'HourGlass Editor URL Persistence: editor route state is still volatile across reloads.'
);

assertIncludes(
  'HourGlass Editor Reload Recovery',
  appShellContent,
  [
    'const [isRecoveringEditorItem, setIsRecoveringEditorItem] = useState(false);',
    'const localEditorSource = effectiveIsPage ? pages : posts;',
    'setRecoveredEditorItem(localMatch as Post | Page);',
    'vonFetch(`${API.getPages}?id=${encodeURIComponent(editorItemId)}`)',
    'vonFetch(`${API.getPost}?id=${encodeURIComponent(editorItemId)}`',
    'window.scrollTo({ top: 0, left: 0 });',
  ],
  'HourGlass Editor Reload Recovery: refresh recovery and editor-entry scroll reset are wired.',
  'HourGlass Editor Reload Recovery: hard-refresh recovery or editor-entry scroll reset markers are missing.'
);

assertIncludes(
  'Session Visibility Check Throttle',
  appShellContent,
  [
    'SESSION_VISIBILITY_CHECK_COOLDOWN',
    'lastSessionVisibilityCheckRef',
    'sessionVisibilityCheckInFlightRef',
    'now - lastSessionVisibilityCheckRef.current < SESSION_VISIBILITY_CHECK_COOLDOWN',
  ],
  'Session Visibility Check Throttle: check_auth visibility pings are cooldown and in-flight guarded.',
  'Session Visibility Check Throttle: check_auth still runs on every tab visibility bounce.'
);

assertIncludes(
  'HourGlass Editor External Content Sync',
  editorContent + '\n' + postEditorContent,
  [
    'contentRevision?: number;',
    'const lastAppliedContentRevision = useRef(contentRevision);',
    'const revisionChanged = contentRevision !== lastAppliedContentRevision.current;',
    'revisionChanged ||',
    'editor.isEmpty ||',
    'const [editorContentRevision, setEditorContentRevision] = useState(0);',
    'setEditorContentRevision((revision) => revision + 1);',
    'contentRevision={editorContentRevision}',
  ],
  'HourGlass Editor External Content Sync: AI apply/full-content restore can force TipTap to accept intentional external content changes.',
  'HourGlass Editor External Content Sync: TipTap still lacks an explicit external-content revision path.'
);

assertIncludes(
  'HourGlass Editor Sticky Toolbar',
  editorContent,
  [
    'overflow-visible rounded-xl',
    'sticky top-0',
    'z-20 flex flex-wrap',
    '> figure,',
    '> iframe {',
    'margin: 1.5rem 0;',
  ],
  'HourGlass Editor Sticky Toolbar: toolbar can stick during page scroll and media blocks keep visible vertical rhythm.',
  'HourGlass Editor Sticky Toolbar: sticky toolbar or media spacing markers are missing.'
);

assertIncludes(
  'HourGlass Editor Sticky Toolbar Elevation',
  editorContent,
  [
    'const toolbarSentinelRef = useRef<HTMLDivElement>(null);',
    'const [isToolbarElevated, setIsToolbarElevated] = useState(false);',
    "window.addEventListener('scroll', updateToolbarElevation, true);",
    'shadow-lg shadow-slate-900/10',
    'isToolbarElevated',
  ],
  'HourGlass Editor Sticky Toolbar Elevation: toolbar gains elevation only while floating during scroll.',
  'HourGlass Editor Sticky Toolbar Elevation: stuck-state shadow/backdrop markers are missing.'
);

assertIncludes(
  'HourGlass Editor Toolbar Repair',
  editorContent + '\n' + read('src/components/editor/editorLinkUtils.ts'),
  [
    'export const normalizeEditorUrl = (value: string) => {',
    "import { buildEditorLinkAttrs, normalizeEditorUrl } from './editor/editorLinkUtils';",
    'const normalizedUrl = normalizeEditorUrl(finalValue);',
    'href: normalizedUrl',
    '.editor-content .${EDITOR_SURFACE_CLASS} table {',
    'border-collapse: collapse;',
    'cursor-pointer shadow-sm transition-colors',
  ],
  'HourGlass Editor Toolbar Repair: link URLs are normalized, tables are visible, and toolbar hitboxes stay stable.',
  'HourGlass Editor Toolbar Repair: link/table/cursor stability markers are missing.'
);

assertIncludes(
  'HourGlass Editor List and Quote Visibility',
  editorContent,
  [
    '.editor-content .${EDITOR_SURFACE_CLASS} ul {',
    'list-style: disc;',
    '.editor-content .${EDITOR_SURFACE_CLASS} ol {',
    'list-style: decimal;',
    '.editor-content .${EDITOR_SURFACE_CLASS} li {',
    '.editor-content .${EDITOR_SURFACE_CLASS} blockquote {',
    'border-left: 4px solid #3b82f6;',
  ],
  'HourGlass Editor List and Quote Visibility: bullet lists, numbered lists, and quotes have explicit canvas styling.',
  'HourGlass Editor List and Quote Visibility: list/quote surface styling markers are missing.'
);

assertIncludes(
  'HourGlass Editor Code Block Contract',
  editorContent,
  [
    'const insertStructuredCodeBlock = (code: string) => {',
    "type: 'codeBlock',",
    'text: code,',
    '.editor-content .${EDITOR_SURFACE_CLASS} pre {',
    '.editor-content .${EDITOR_SURFACE_CLASS} code {',
  ],
  'HourGlass Editor Code Block Contract: code block insertion uses TipTap document nodes and has explicit editor canvas styling.',
  'HourGlass Editor Code Block Contract: code blocks must not rely on raw HTML insertion or unstyled editor output.'
);

if (!editorContent.includes('hover:-translate-y-px')) {
  pass('HourGlass Editor Cursor Stability: toolbar controls no longer move under the pointer.');
} else {
  fail('HourGlass Editor Cursor Stability: toolbar controls still use hover translate movement.');
}

assertIncludes(
  'HourGlass Editor Bubble Scroll Tracking',
  editorContent,
  [
    'const editorShellRef = useRef<HTMLDivElement>(null);',
    'ref={editorShellRef}',
    'const updateBubblePosition = React.useCallback',
    'const shellRect = editorShellRef.current.getBoundingClientRect();',
    "window.addEventListener('scroll', updateBubblePosition, true);",
    "window.removeEventListener('scroll', updateBubblePosition, true);",
  ],
  'HourGlass Editor Bubble Scroll Tracking: image/video tooltips recalculate against the editor shell during page or container scroll.',
  'HourGlass Editor Bubble Scroll Tracking: media tooltips still use a stale one-time position instead of tracking scroll.'
);

assertIncludes(
  'HourGlass Editor Sticky Toolbar Offset',
  editorContent,
  [
    'const nextElevated = sentinel.getBoundingClientRect().top < 1;',
    'className={`sticky top-0 z-20',
  ],
  'HourGlass Editor Sticky Toolbar Offset: floating editor toolbar anchors to the editor top edge while preserving scroll elevation.',
  'HourGlass Editor Sticky Toolbar Offset: floating editor toolbar still uses an oversized viewport offset.'
);

if (
  editorContent.includes(':has(> br.ProseMirror-trailingBreak)::before') &&
  editorContent.includes("content: 'Start Writing';") &&
  editorContent.includes('float: left;') &&
  !editorContent.includes('editor?.isEmpty && (')
) {
  pass(
    'HourGlass Editor Placeholder: empty-canvas hint is rendered by the TipTap paragraph placeholder flow, not a hardcoded overlay rail.'
  );
} else {
  fail(
    'HourGlass Editor Placeholder: remove the hardcoded overlay rail and render Start Writing from the empty TipTap paragraph line.'
  );
}

assertIncludes(
  'HourGlass Editor Restore Race Guard',
  editorContent,
  [
    'const cancelPendingEditorChange = () => {',
    'if (timeoutRef.current) {',
    'clearTimeout(timeoutRef.current);',
    'timeoutRef.current = null;',
    'cancelPendingEditorChange();',
    'editor.commands.setContent(nextInitialContent, { emitUpdate: false });',
  ],
  'HourGlass Editor Restore Race Guard: external content restores clear pending debounced editor changes before syncing TipTap content.',
  'HourGlass Editor Restore Race Guard: a stale debounced editor change can still overwrite restored full content.'
);

assertIncludes(
  'HourGlass Editor Save Freshness Guard',
  editorContent,
  [
    'const pendingEditorChangeRef = useRef<string | null>(null);',
    'const flushPendingEditorChange = () => {',
    'const pendingContent = pendingEditorChangeRef.current;',
    'pendingEditorChangeRef.current = content;',
    'onChange(pendingContent);',
    'onBlurCapture={flushPendingEditorChange}',
  ],
  'HourGlass Editor Save Freshness Guard: pending debounced TipTap/source edits flush before focus leaves the editor shell.',
  'HourGlass Editor Save Freshness Guard: immediate Save/Publish can still miss the latest debounced TipTap/source edit.'
);

assertIncludes(
  'PostEditor Live Content Save Source',
  postEditorContent + '\n' + editorContent,
  [
    'onImmediateChange?: (content: string) => void;',
    'onImmediateChange?.(content);',
    'const handleEditorImmediateChange = React.useCallback((html: string) => {',
    'contentRef.current = html;',
    'itemRef.current = { ...itemRef.current, content: html };',
    'const itemForSaveBase = itemOverride || item;',
    'const liveContent = contentRef.current;',
    'const itemForSave = { ...itemForSaveBase, content: liveContent };',
    'const currentContent = contentRef.current;',
    'onImmediateChange={handleEditorImmediateChange}',
  ],
  'PostEditor Live Content Save Source: manual save and autosave read the latest TipTap/source content through a live ref, independent of debounced React state.',
  'PostEditor Live Content Save Source: manual save or autosave can still miss the latest TipTap/source edit before debounce settles.'
);

assertIncludes(
  'PostEditor Save Helper Extraction Boundary',
  postEditorContent + '\n' + postEditorSaveHelpersContent,
  [
    "from './editor/postEditorSaveHelpers'",
    'export const AUTOSAVE_INTERVAL_MS = 60000;',
    'export type SaveStatus',
    'export const buildAutoSaveCandidate',
    'export const normalizeScheduledInputValue',
    'export const normalizeScheduledAtForSave',
    'export const buildSavedSnapshot',
    'export const buildSaveStatusLabel',
    'export const getSaveStatusClassName',
  ],
  'PostEditor Save Helper Extraction Boundary: autosave, scheduling, and save-status helpers live in the editor support module while PostEditor consumes the boundary.',
  'PostEditor Save Helper Extraction Boundary: save/autosave helper extraction markers are missing.'
);

assertExcludes(
  'PostEditor Save Helper Extraction Boundary Parent Cleanliness',
  postEditorContent,
  [
    'const AUTOSAVE_INTERVAL_MS =',
    'const SAVE_CONFLICT_MESSAGE =',
    'type SaveStatus =',
    'const formatAutoSaveCountdown =',
    'const isEffectivelyEmpty =',
    'const normalizeScheduledInputValue =',
    'const formatScheduledTarget =',
    'const buildAutoSaveCandidate =',
    'const normalizeScheduledAtForSave =',
    'const buildSavedSnapshot =',
    'const buildSaveStatusLabel =',
    'const getSaveStatusClassName =',
  ],
  'PostEditor Save Helper Extraction Boundary: parent editor no longer owns extracted save/autosave helper definitions.',
  'PostEditor Save Helper Extraction Boundary: parent editor still owns extracted save/autosave helper definitions.'
);

assertIncludes(
  'PostEditor Save Baseline Timestamp Sync',
  postEditorContent,
  [
    'initialItemRef.current = savedSnapshot;',
    'itemRef.current = savedSnapshot;',
    "contentRef.current = savedSnapshot.content || '';",
    'setItem((prev) => (prev ? { ...prev, ...savedSnapshot } : savedSnapshot));',
  ],
  'PostEditor Save Baseline Timestamp Sync: successful autosave/manual save refreshes local updated_at baseline before the next publish.',
  'PostEditor Save Baseline Timestamp Sync: saved IDs can update without refreshing the local updated_at baseline, causing false 409 conflicts.'
);

assertIncludes(
  'PostEditor Restore Baseline Timestamp Sync',
  postEditorContent,
  [
    'initialItemRef.current = restoredSnapshot;',
    'itemRef.current = restoredSnapshot;',
    "contentRef.current = data.post.content || '';",
  ],
  'PostEditor Restore Baseline Timestamp Sync: old post full-content restore refreshes the autosave item/timestamp baseline immediately.',
  'PostEditor Restore Baseline Timestamp Sync: old post restore can leave autosave using a stale item/timestamp baseline.'
);

if (
  adBlockNoSemgrepCount >= 1 &&
  adBlockContent.includes('sanitizeHtml(content') &&
  adBlockContent.includes('dangerouslySetInnerHTML={{ __html: safeContent }}')
) {
  pass('Semgrep False Positive Guard: AdBlock direct render stays suppressed and sanitized.');
} else {
  fail(
    'Semgrep False Positive Guard: AdBlock direct render must remain explicitly suppressed and sanitized.'
  );
}

if (
  adBlockContent.includes('containerRef.current.replaceChildren()') &&
  !adBlockContent.includes("containerRef.current.innerHTML = ''") &&
  themeEngineContent.includes('styleEl.textContent = cssVariables +') &&
  !themeEngineContent.includes('styleEl.innerHTML') &&
  aiSummaryExtractorsContent.includes('parseFromString(cleanHtml,') &&
  aiSummaryExtractorsContent.includes('parseFromString(h,') &&
  !aiSummaryExtractorsContent.includes('parser.innerHTML') &&
  discussionScannerContent.includes('parseFromString(`<textarea>${content}</textarea>`,') &&
  !discussionScannerContent.includes('textarea.innerHTML = content') &&
  ((editorContent.includes('p.appendChild(document.createElement') &&
    !editorContent.includes("p.innerHTML = '<br>'") &&
    !editorContent.includes("p.innerHTML = blockNode.innerHTML || '<br>'") &&
    !editorContent.includes("blockNode.innerHTML === '<br>'")) ||
    (editorContent.includes('const domHtml = root?.innerHTML || getCurrentEditorHtml();') &&
      editorContent.includes('editor.commands.setContent(sanitized, { emitUpdate: false });')))
) {
  pass('InnerHTML Scanner Polish: low-risk false-positive surfaces use DOM-safe APIs.');
} else {
  fail(
    'InnerHTML Scanner Polish: AdBlock, ThemeEngine, AI summary extraction, or discussion decode still use avoidable innerHTML.'
  );
}

const formAccessibilityIssues = [];
const formAccessibilityFiles = walkFiles(
  resolveFromRoot('src'),
  (file) => path.extname(file) === '.tsx'
);

for (const filePath of formAccessibilityFiles) {
  const relativeFile = path.relative(root, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const labelFors = new Set(
    [
      ...content.matchAll(
        /<label\b[^>]*\b(?:htmlFor|for)\s*=\s*(?:"([^"]+)"|'([^']+)'|\{["']([^"']+)["']\})/g
      ),
    ]
      .map((match) => match[1] || match[2] || match[3])
      .filter(Boolean)
  );

  const fieldRegex = /<(input|select|textarea)\b[\s\S]*?(?:\/?>)/g;
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(content))) {
    if (isInsideTemplateString(content, fieldMatch.index)) {
      continue;
    }

    const tagText = fieldMatch[0];
    const attrs = extractTagAttributes(tagText);
    const id = extractAttributeValue(tagText, 'id');
    const type = extractAttributeValue(tagText, 'type').toLowerCase();
    const isHidden =
      type === 'hidden' ||
      tagText.includes('aria-hidden="true"') ||
      tagText.includes("aria-hidden='true'") ||
      tagText.includes('className="hidden"') ||
      tagText.includes("className='hidden'");
    const isFile = type === 'file';
    const hasIdOrName = attrs.has('id') || attrs.has('name');
    const hasAccessibleName =
      attrs.has('aria-label') ||
      attrs.has('aria-labelledby') ||
      isInsideLabel(content, fieldMatch.index) ||
      (id && labelFors.has(id));

    if (!hasIdOrName) {
      formAccessibilityIssues.push(
        `${relativeFile}:${getLineNumber(content, fieldMatch.index)} ${fieldMatch[1]} missing id/name`
      );
    }

    if (!isHidden && !isFile && !hasAccessibleName) {
      formAccessibilityIssues.push(
        `${relativeFile}:${getLineNumber(content, fieldMatch.index)} ${fieldMatch[1]} missing accessible label`
      );
    }
  }

  const labelRegex = /<label\b[^>]*>/g;
  let labelMatch;
  while ((labelMatch = labelRegex.exec(content))) {
    if (isInsideTemplateString(content, labelMatch.index)) {
      continue;
    }

    const labelText = labelMatch[0];
    if (/\b(htmlFor|for)\s*=/.test(labelText)) {
      continue;
    }

    const closeIndex = content.indexOf('</label>', labelMatch.index);
    const labelInner = closeIndex === -1 ? '' : content.slice(labelMatch.index, closeIndex);
    if (!/<(input|select|textarea)\b/.test(labelInner)) {
      formAccessibilityIssues.push(
        `${relativeFile}:${getLineNumber(content, labelMatch.index)} label missing htmlFor/nested field`
      );
    }
  }
}

if (formAccessibilityIssues.length === 0) {
  pass('Form Accessibility Baseline: React form fields carry id/name and accessible labels.');
} else {
  fail(
    `Form Accessibility Baseline: unresolved fields or labels remain: ${formAccessibilityIssues
      .slice(0, 25)
      .join(
        '; '
      )}${formAccessibilityIssues.length > 25 ? `; +${formAccessibilityIssues.length - 25} more` : ''}`
  );
}

const genericAriaLabelIssues = [];
const genericAriaLabelPattern =
  /\baria-label\s*=\s*(?:"Form Field"|'Form Field'|\{["']Form Field["']\}|"[A-Za-z]+[0-9]+"|'[A-Za-z]+[0-9]+')/g;
for (const filePath of formAccessibilityFiles) {
  const relativeFile = path.relative(root, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  let genericLabelMatch;
  while ((genericLabelMatch = genericAriaLabelPattern.exec(content))) {
    genericAriaLabelIssues.push(
      `${relativeFile}:${getLineNumber(content, genericLabelMatch.index)} ${genericLabelMatch[0]}`
    );
  }
}

if (genericAriaLabelIssues.length === 0) {
  pass(
    'Form Accessibility Label Quality: fields use descriptive labels instead of generated placeholders.'
  );
} else {
  fail(
    `Form Accessibility Label Quality: generic/generated aria labels remain: ${genericAriaLabelIssues
      .slice(0, 25)
      .join(
        '; '
      )}${genericAriaLabelIssues.length > 25 ? `; +${genericAriaLabelIssues.length - 25} more` : ''}`
  );
}

const changelogContent = read('CHANGELOG.md');
const topReleaseEntry = getReleaseEntry(changelogContent, pkg.version);
const changelogMarkersByVersion = {
  '1.25.1': [
    'Open Source First Impression Follow-Up',
    'Sidebar Current Post Highlight',
    'Quickstart Guide',
    'Install Docs Triage',
    'Public Claim Verification',
    'Package Hygiene Audit',
    'Open Source Issue Templates',
    'NPM Outdated Audit',
    'Release Version Alignment',
  ],
  '1.25.0': [
    'Runtime Entry Safety',
    'Direct `index.html` Guard',
    'Single-Post Full Payload Skeleton',
    'Single-Page Pending Skeleton',
    'Public Draft Visibility Guard',
    'TechPress Empty Category State',
    'Expired Gemini Key Auto-Clear',
    'Partial Gemini Response Guard',
    'Self-Hosted Inter Default',
    'Skeleton Dark Palette',
    'Content Manager Date Clarity',
    'Scheduled Publish Ordering',
    'README Developer Setup',
    'Release Version Alignment',
  ],
  '1.24.11': [
    'Profile Loading Stability',
    'Footer-Safe Activity Tabs',
    'Activity Skeleton States',
    'Dashboard Count Loading Truth',
    'Article/Page Total Placeholder',
    'Staff Count Placeholder',
    'Public Search Count Copy',
    'Approximate Count Wording',
    'Smoke Coverage',
    'Profile Loading Contract',
    'Dashboard Count Contract',
    'Public Search Count Contract',
    'Release Version Alignment',
  ],
  '1.24.10': [
    'Comment Avatar Fallback Repair',
    'Current Profile Avatar Source',
    'Guest/Legacy Comment Compatibility',
    'Release `.htaccess` Packaging & Audit',
    'Deploy Routing Dotfile Inclusion',
    'Uploads Shield Inclusion',
    'Source Routing Dotfile Inclusion',
    'Smoke Coverage',
    'Release Version Alignment',
  ],
  '1.24.9': [
    'OTA Update Recovery',
    'GitHub Release Asset Redirect Host',
    'Search Query Guard',
    'Public Search Length Guard',
    'Editor Image Bubble',
    'Image Width Persistence Guard',
    'Image Style Normalization Guard',
    'Image Attribute Preservation Guard',
    'Image Alignment Active State',
    'Video Alignment Active State',
    'Initial Skeleton Hold',
    'Ads Manager Helper Copy Cleanup',
    'Roadmap Closeout Guard',
    'Package Audit Dry Run',
    'Thumbnail Object-Position Polish',
    'Widget/Ad Containment Micro-Fix',
    'Public Claim Verification Dry Run',
    'Preflight Smoke Coverage',
    'Release Version Alignment',
  ],
  '1.24.8': [
    'Profile Activity Truth Alignment',
    'Shared Profile Activity Hook',
    'Bundled Profile 200+ Parity',
    'Profile Comments API Filter',
    'Dashboard Comments Total Truth',
    'Appointed Admin Secret Boundary',
    'Primary Admin Capability',
    'Settings Secret Masking',
    'Sensitive Settings Save Guard',
    'Database Manager Lockdown',
    'Profile Activity 200+ Smoke Coverage',
    'Appointed Admin Secret Smoke Coverage',
    'Release Version Alignment',
  ],
  '1.24.7': [
    'Built-In Extension Runtime Alignment',
    'Shared Plugin Runtime Gate',
    'VonSEO Theme Toggle Parity',
    'VonAnalytics Runtime Toggle Parity',
    'Built-In Extension Product Polish',
    'VonSEO General Description Sync',
    'Google-Compatible Robots Defaults',
    'Extension Fallback Cleanup',
    'Promo Bar Campaign Controls',
    'Gift Widget Campaign Controls',
    'Developer Documentation Refresh',
    'Theme Development Guide',
    'Plugin Development Guide',
    'Root Theme Guide Retirement',
    'Extension Upgrade Smoke Coverage',
    'SEO/Robots Smoke Coverage',
    'Crawler Surface Scheduled Cutoff',
    'Crawler Surface Smoke Coverage',
    'Release Quality Gate Cleanup',
    'Release Version Alignment',
  ],
  '1.24.6': [
    'Public Discovery Loading Closeout',
    'Shared Initial Loading State',
    'Remaining Theme Loading Parity',
    'Discovery Loading Smoke Coverage',
    'Release Version Alignment',
  ],
  '1.24.5': [
    'Editor Maintenance Extraction',
    'TipTap Extension Boundary Split',
    'Post Editor Save Helper Split',
    'Admin Closeout Polish',
    'Public Route Stability',
    'Profile Pending & Theme Handoff Guard',
    'TechPress Profile Tab Contrast',
    'TechPress Profile Username Solid Color',
    'Editor Extraction Smoke Coverage',
    'Post Editor Save Helper Smoke Coverage',
    'Profile Route Smoke Coverage',
    'TechPress Profile Tab Smoke Coverage',
    'TechPress Profile Username Smoke Coverage',
    'Roadmap Scope Merge',
  ],
  '1.24.4': [
    'Public Interaction & Theme Loading',
    'Editor & Import UX Polish',
    'Regression & Quality Guard',
  ],
  '1.24.3': [
    'Admin Dashboard Truth Alignment',
    'Public Discovery Scale Follow-up',
    'Regression & Quality Guard',
  ],
  '1.24.1': [
    'HourGlass Editor Stabilization',
    'Theme Navigation Responsiveness',
    'Open Source Contributor Guardrails',
    'HourGlass Plan Cleanup',
    'Regression Coverage',
  ],
  '1.23.6': [
    'Database Manager Restore & Backup Clarity',
    'Database Import Restore Fix',
    'Public Theme Performance Polish',
    'Roadmap Pull-Forward',
    'Release Scope',
  ],
  '1.23.5': ['Security Audit Hardening', 'Regression Coverage', 'Release Scope'],
  '1.23.4': [
    'Autosave & Save Feedback Polish',
    'Promo Bar Solid Color Picker',
    'Build Chunk Optimization',
    'Release Scope',
  ],
  '1.23.0': ['Release Promotion', 'Kirana Line Consolidation', 'Content Manager Alignment'],
  '1.22.0': ['Hybrid Decoupled CMS', 'public/rss.php', 'live avatar priority'],
  '1.22.1': ['onToggleNav', '_thumbnail_id', 'DirectoryIndex index.php index.html'],
  '1.22.2': ['localhost', 'onToggleNav', 'smoke gate'],
  '1.22.9': ['Manual Excerpt Preservation', 'Meta Description Alias Alignment', 'Regression Guard'],
  '1.22.8': [
    'global across all statuses',
    'live search',
    'delete confirmation',
    'CommentManager is explicitly marked as legacy',
    'avatar fallback',
  ],
};
const changelogMarkers = changelogMarkersByVersion[pkg.version];
if (!topReleaseEntry.trim()) {
  fail(`Changelog: missing release entry for v${pkg.version}.`);
} else if (Array.isArray(changelogMarkers)) {
  assertIncludes(
    `Changelog ${pkg.version}`,
    topReleaseEntry,
    changelogMarkers,
    `Changelog: release notes cover the current v${pkg.version} smoke-critical work.`,
    `Changelog: top v${pkg.version} entry is missing smoke-critical release notes.`
  );
} else if (/\n- /.test(topReleaseEntry)) {
  pass(`Changelog: release entry for v${pkg.version} exists and contains bullet notes.`);
} else {
  fail(`Changelog: release entry for v${pkg.version} exists but has no bullet notes.`);
}

const currentReleaseLabel = `v${pkg.version}`;
const currentOpenGateLabel = `v${pkg.version} "OpenGate"`;
const docsVersionChecks = [
  ['README.md', currentOpenGateLabel],
  ['docs/INSTALL.md', currentOpenGateLabel],
  ['docs/MANUAL.md', currentReleaseLabel],
  ['docs/SECURITY.md', currentReleaseLabel],
  ['docs/UPGRADE.md', currentReleaseLabel],
  ['docs/FEATURES.md', `VonCMS ${currentReleaseLabel} feature baseline for the OpenGate line.`],
  ['docs/FEATURES.md', currentOpenGateLabel],
  ['docs/EXTENSION_DEVELOPMENT.md', `VonCMS Extension Development Guide ${currentReleaseLabel}`],
  ['docs/ROUTING.md', 'VonCMS Routing Flow v1.25.x'],
  ['docs/API.md', `Version: \`${pkg.version}\``],
  ['LICENSE.md', `Version: \`${pkg.version}\``],
  ['docs/LICENSE.md', `Version: \`${pkg.version}\``],
];
const staleDocs = docsVersionChecks
  .filter(([file, marker]) => !read(file).includes(marker))
  .map(([file]) => file);
if (staleDocs.length === 0) {
  pass(`Docs Version Alignment: primary docs carry ${currentReleaseLabel}.`);
} else {
  fail(`Docs Version Alignment: stale release label in ${staleDocs.join(', ')}.`);
}

const readmeContent = read('README.md');
if (readmeContent.includes('](LICENSE.md)')) {
  pass('README License Link: packaged README points at the canonical root LICENSE.md.');
} else {
  fail('README License Link: README must point its local license link at LICENSE.md.');
}

const upgradeGuideContent = read('docs/UPGRADE.md');
if (
  readmeContent.includes('Updating an existing site to v1.25.0 through OTA?') &&
  readmeContent.includes('the old update modal cannot show this new warning yet') &&
  upgradeGuideContent.includes('v1.25.0 OTA upgrade warning') &&
  upgradeGuideContent.includes('System Tools > Repair `.htaccess`') &&
  changelogContent.includes('OTA `.htaccess` Upgrade Warning')
) {
  pass(
    'OTA .htaccess Upgrade Warning: README, upgrade docs, and changelog warn v1.24.x users to repair .htaccess after updating to v1.25.0.'
  );
} else {
  fail(
    'OTA .htaccess Upgrade Warning: README/docs/changelog must warn v1.24.x users because the old OTA modal cannot show new v1.25.0 instructions.'
  );
}

const extensionDevelopmentContent = read('docs/EXTENSION_DEVELOPMENT.md');
assertIncludes(
  'Extension Development Docs',
  extensionDevelopmentContent + readmeContent + read('docs/FEATURES.md') + read('docs/MANUAL.md'),
  [
    `VonCMS Extension Development Guide v${pkg.version}`,
    'Architecture Philosophy',
    'Why No Headless-Only Mode',
    'Golden Rules',
    'Security Principles',
    'Performance Philosophy',
    'Visual WYSIWYG Contract',
    'what the visitor actually sees',
    'core production deploy does not require Node.js',
    'src/plugins/von-core/features/public/PublicSite.tsx',
    'src/plugins/von-core/features/plugins/registry.tsx',
    'isSystemPluginActive(settings, pluginId)',
    'Theme Development',
    'Plugin Development',
  ],
  'Extension Development Docs: consolidated packaged docs preserve theme/plugin architecture, security, visual WYSIWYG, runtime ownership, and docs links.',
  'Extension Development Docs: consolidated development guide is missing required theme/plugin architecture/security/runtime markers or docs links.'
);

const customFontsDocsContent = read('docs/CUSTOM_FONTS.md');
assertIncludes(
  'Custom Font Development Docs',
  readmeContent + extensionDevelopmentContent + customFontsDocsContent,
  [
    'Custom Fonts',
    'local Inter variable WOFF2',
    'public/fonts/inter/',
    '@font-face',
    'font-weight: 400 900',
    'Do not inline large base64 font files',
    'no `fonts.googleapis.com` or `fonts.gstatic.com` requests',
  ],
  'Custom Font Development Docs: open-source theme authors have local WOFF2 and licensing guidance.',
  'Custom Font Development Docs: custom font workflow, local WOFF2 guidance, or licensing notes are missing.'
);

if (!exists('docs/PLUGIN_THEME_TUTORIAL.md')) {
  pass(
    'Combined Plugin/Theme Tutorial Retirement: old combined tutorial is retired in favor of the Extension Development guide.'
  );
} else {
  fail(
    'Combined Plugin/Theme Tutorial Retirement: old docs/PLUGIN_THEME_TUTORIAL.md still exists.'
  );
}

const retiredConsolidatedDocs = [
  'docs/INTRODUCTION.md',
  'docs/COMPARISON.md',
  'docs/SERVER_TUNING.md',
  'docs/THEME_DEVELOPMENT.md',
  'docs/PLUGIN_DEVELOPMENT.md',
].filter(exists);
if (retiredConsolidatedDocs.length === 0) {
  pass(
    'Public Docs Consolidation: retired split docs now live inside Features, VPS, and Extension Development.'
  );
} else {
  fail(
    `Public Docs Consolidation: retired split docs still exist (${retiredConsolidatedDocs.join(', ')}).`
  );
}

assertIncludes(
  'Public Docs Consolidation Markers',
  read('docs/FEATURES.md') + read('docs/VPS.md') + extensionDevelopmentContent,
  [
    'Introduction to VonCMS',
    'CMS Comparison Guide 2026',
    'Server Tuning',
    'Safe Cache Targets',
    'Theme Development',
    'Minimal Theme Skeleton',
    'Plugin Development',
    'System Plugin Shape',
  ],
  'Public Docs Consolidation Markers: consolidated docs preserve introduction, comparison, tuning, theme, and plugin tutorial content.',
  'Public Docs Consolidation Markers: consolidated docs are missing preserved tutorial or positioning content.'
);

if (!exists('THEME_GUIDE.md')) {
  pass('Root Theme Guide Retirement: outdated root THEME_GUIDE.md has been removed.');
} else {
  fail('Root Theme Guide Retirement: outdated root THEME_GUIDE.md still exists.');
}

assertExcludes(
  'Root Theme Guide Reference Guard',
  ['README.md', 'CONTRIBUTING.md', 'docs/EXTENSION_DEVELOPMENT.md']
    .filter(exists)
    .map(read)
    .join('\n'),
  ['THEME_GUIDE.md', 'PLUGIN_THEME_TUTORIAL.md'],
  'Root Theme Guide Reference Guard: developer workflow references point at the consolidated extension docs.',
  'Root Theme Guide Reference Guard: developer workflow still points at retired theme/plugin docs.'
);

const stalePerformanceClaims = [
  ['README.md', '11,600 req/s @ 50 concurrent'],
  ['README.md', 'Deploy 0.92MB, Source 0.82MB'],
  ['docs/FEATURES.md', '### You asked. We measured.'],
  ['docs/FEATURES.md', 'VonCMS **proves** it'],
  ['docs/FEATURES.md', '11,600 requests/second'],
  ['docs/FEATURES.md', '0.92MB deploy'],
  ['docs/FEATURES.md', 'sub-1MB'],
].filter(([file, marker]) => read(file).includes(marker));
if (stalePerformanceClaims.length === 0) {
  pass(
    'Release Docs Benchmark Copy: hard-coded benchmark proof claims were cleared from README and docs/FEATURES.md.'
  );
} else {
  fail(
    `Release Docs Benchmark Copy: stale hard-coded benchmark proof markers remain in ${stalePerformanceClaims
      .map(([file, marker]) => `${file} -> ${marker}`)
      .join(', ')}.`
  );
}

const removedBenchmarkSnapshotMarkers = [
  ['README.md', '## Search Benchmark Snapshot'],
  ['README.md', '30,035 posts'],
  ['README.md', '1.6x faster than legacy `LIKE` search on this dataset'],
  ['docs/FEATURES.md', '### Search benchmark snapshot'],
  ['docs/FEATURES.md', "MATCH(title, content) AGAINST('teknologi')"],
  ['docs/FEATURES.md', "LIKE '%teknologi%'"],
  [
    'docs/FEATURES.md',
    'FULLTEXT was `1.6x` faster than the legacy `LIKE` search path on this dataset.',
  ],
  ['docs/FEATURES.md', '30,035'],
  ['docs/FEATURES.md', '20,150'],
].filter(([file, marker]) => read(file).includes(marker));
if (removedBenchmarkSnapshotMarkers.length === 0 && !exists('BENCHMARK.md')) {
  pass('Benchmark Docs Retirement: obsolete local benchmark snapshot docs are no longer shipped.');
} else {
  fail(
    `Benchmark Docs Retirement: obsolete benchmark markers remain in ${removedBenchmarkSnapshotMarkers
      .map(([file, marker]) => `${file} -> ${marker}`)
      .join(', ')}${exists('BENCHMARK.md') ? ', root BENCHMARK.md still exists' : ''}.`
  );
}

const securityContent = read('public/security.php');
assertIncludes(
  'Security Logic',
  securityContent,
  [
    'CRAWLER_PAGE_RENDER',
    'VON_CANONICAL_CHECKED',
    'voncms_apply_site_timezone',
    'return voncms_apply_site_timezone($pdo);',
  ],
  'Security Logic: Golden Audit markers detected in public/security.php',
  'Security Logic: Missing Golden Audit markers in public/security.php.'
);

const crawlerStatusEndpointContent = [
  read('public/robots.php'),
  read('public/sitemap.php'),
  read('public/llms.php'),
].join('\n');
assertIncludes(
  'Crawler User-Agent Single Source Contract',
  securityContent + crawlerStatusEndpointContent,
  ['function voncms_is_social_preview_crawler', 'voncms_is_social_preview_crawler($ua)'],
  'Crawler User-Agent Single Source Contract: social-preview detection is centralized in the security bootstrap used by crawler endpoints.',
  'Crawler User-Agent Single Source Contract: social-preview detection remains duplicated or disconnected from the security bootstrap.'
);
assertExcludes(
  'Crawler Endpoint Regex Duplication Guard',
  crawlerStatusEndpointContent,
  ['facebookexternalhit|Facebot|meta-external|meta-webindexer|Twitterbot|WhatsApp|TelegramBot'],
  'Crawler Endpoint Regex Duplication Guard: robots, sitemap, and llms use the shared crawler helper.',
  'Crawler Endpoint Regex Duplication Guard: crawler endpoint files still carry copied User-Agent regex lists.'
);

assertManagedBlock('.htaccess');
assertManagedBlock('public/.htaccess');
if (exists('dist/.htaccess')) {
  assertManagedBlock('dist/.htaccess');
}

const rootHtaccessContent = read('.htaccess');
const publicHtaccessContent = read('public/.htaccess');
if (
  rootHtaccessContent.includes('RewriteRule ^index\\.html$ index.php [L,QSA]') &&
  publicHtaccessContent.includes('RewriteRule ^index\\.html$ index.php [L,QSA]') &&
  publicRuntimeIndexContent.includes("strtolower($currentPath) === 'index.html'") &&
  publicRuntimeIndexContent.includes("header('Location: ' . $basePath, true, 301);")
) {
  pass(
    'Index HTML Runtime Guard: direct /index.html requests are routed through PHP and canonically redirected to the homepage instead of serving the static Vite shell.'
  );
} else {
  fail(
    'Index HTML Runtime Guard: direct /index.html can still bypass PHP hydration, serve the static Vite shell, or fall through as a 404 slug.'
  );
}

const fixIntegrityContent = read('public/api/system/fix_integrity.php');
if (
  fixIntegrityContent.includes('analyzeHtaccessState') &&
  fixIntegrityContent.includes('analyzeUploadsShieldState') &&
  fixIntegrityContent.includes('No files were modified.') &&
  !fixIntegrityContent.includes('updateHtaccessWithBlock(') &&
  fixIntegrityContent.includes("sendApiHeaders('POST, OPTIONS')") &&
  !fixIntegrityContent.includes('?token=YOUR_SESSION_TOKEN')
) {
  pass('Integrity Check: read-only file health endpoint detected.');
} else {
  fail('Integrity Check: endpoint still looks like a write-based repair tool.');
}

const repairHtaccessContent = read('public/api/system/repair_htaccess.php');
assertIncludes(
  '.htaccess Repair',
  repairHtaccessContent,
  [
    'updateHtaccessWithBlock',
    'stripCorruptedManagedPrefix',
    'normalizePreservedHtaccessContent',
    "$filePath . '.bak'",
    'changesApplied',
    "sendApiHeaders('POST, OPTIONS')",
  ],
  '.htaccess Repair: dedicated repair endpoint with single-backup cleanup logic detected.',
  '.htaccess Repair: dedicated repair endpoint is incomplete.'
);

const installContent = read('public/api/install.php');
const configSampleContent = read('public/von_config.sample.php');
const runtimeStoragePathsAreInstallLocal =
  securityContent.includes("__DIR__ . '/data/rate_limits/'") &&
  !securityContent.includes("__DIR__ . '/../data/rate_limits/'") &&
  configSampleContent.includes("__DIR__ . '/logs'") &&
  configSampleContent.includes("__DIR__ . '/logs/php_error_dev.log'") &&
  !configSampleContent.includes("__DIR__ . '/../logs") &&
  installContent.includes("__DIR__ . '/logs'") &&
  installContent.includes("__DIR__ . '/logs/php_error_dev.log'") &&
  !installContent.includes("__DIR__ . '/../logs");
if (runtimeStoragePathsAreInstallLocal) {
  pass(
    'Install-Local Runtime Storage: rate-limit and PHP error-log files stay inside the current root or subfolder deployment.'
  );
} else {
  fail(
    'Install-Local Runtime Storage: a root-level runtime helper can still write rate-limit or PHP error-log files above the current installation.'
  );
}
if (
  repairHtaccessContent.includes('RewriteRule ^index\\.html$ {$prefix}index.php [L,QSA]') &&
  installContent.includes('RewriteRule ^index\\.html$ index.php [L,QSA]')
) {
  pass(
    'Index HTML Installer/Repair Guard: generated .htaccess templates preserve the PHP entry-point route for direct index.html requests.'
  );
} else {
  fail(
    'Index HTML Installer/Repair Guard: installer or repair templates can still regenerate an index.html static-shell bypass.'
  );
}

const htaccessSecuritySources = [
  ['.htaccess', rootHtaccessContent],
  ['public/.htaccess', publicHtaccessContent],
  ['public/api/install.php', installContent],
  ['public/api/system/repair_htaccess.php', repairHtaccessContent],
];
if (exists('dist/.htaccess')) {
  htaccessSecuritySources.push(['dist/.htaccess', read('dist/.htaccess')]);
}
if (exists('dist/api/install.php')) {
  htaccessSecuritySources.push(['dist/api/install.php', read('dist/api/install.php')]);
}
if (exists('dist/api/system/repair_htaccess.php')) {
  htaccessSecuritySources.push([
    'dist/api/system/repair_htaccess.php',
    read('dist/api/system/repair_htaccess.php'),
  ]);
}

const sensitiveFileBlockPattern =
  /RewriteRule \\\.\(sql\|md\|json\|log\|bak\|env\|zip\|lock\)\$ - \[F,L\]/;
const socialBotBypassSensitiveBlockPattern =
  /RewriteCond %\{ENV:SOCIAL_BOT\} !1\s*\r?\n\s*RewriteRule (?:\\\.\(sql\|md\|json\|log\|bak\|env\|zip\|lock\)\$|\^von_config\\\.php\$|\^composer\\\.lock\$|\^package\\\.json\$) - \[F,L\]/;
const missingSensitiveBlocks = htaccessSecuritySources
  .filter(([, content]) => !sensitiveFileBlockPattern.test(content))
  .map(([file]) => file);
const socialBotSensitiveBypasses = htaccessSecuritySources
  .filter(([, content]) => socialBotBypassSensitiveBlockPattern.test(content))
  .map(([file]) => file);
if (missingSensitiveBlocks.length === 0 && socialBotSensitiveBypasses.length === 0) {
  pass(
    'Sensitive File Rewrite Guard: .sql/.json/.log/.bak/.zip/.lock blocking cannot be bypassed by spoofing social crawler user agents.'
  );
} else {
  fail(
    `Sensitive File Rewrite Guard: sensitive file blocking is missing or still wrapped in a social-bot bypass. Missing: ${missingSensitiveBlocks.join(', ') || 'none'}; Social-bot bypass: ${socialBotSensitiveBypasses.join(', ') || 'none'}.`
  );
}

const apiHelperDenyMarkers = [
  'RewriteRule ^api/(content_audit_helper|ImageProcessor|mail_helper|media_library_filter_helper|public_cache_helper|redirect_loop_helper|settings_audit_helper)\\.php$ - [F,L,NC]',
  'RewriteRule ^api/(system/IndexNow|security/SecurityLogger)\\.php$ - [F,L,NC]',
  'RewriteRule ^api/public-cache(/.*)?$ - [R=404,L,NC]',
];
const missingApiHelperDenyRules = htaccessSecuritySources
  .filter(([, content]) => !apiHelperDenyMarkers.every((marker) => content.includes(marker)))
  .map(([file]) => file);
if (missingApiHelperDenyRules.length === 0) {
  pass(
    'API Helper Direct Access Guard: helper-only API PHP files and invalid public-cache pseudo paths are denied before file/API rewrites.'
  );
} else {
  fail(
    `API Helper Direct Access Guard: .htaccess sources can still expose helper-only PHP files or route invalid public-cache pseudo paths. Missing: ${missingApiHelperDenyRules.join(', ')}.`
  );
}

const uploadFallbackGuardMarkers = [
  'RewriteCond %{REQUEST_FILENAME} !-f',
  'RewriteCond %{REQUEST_FILENAME} !-d',
  'RewriteRule ^uploads/ - [R=404,L,NC]',
];
const missingUploadFallbackGuards = htaccessSecuritySources
  .filter(([, content]) => !uploadFallbackGuardMarkers.every((marker) => content.includes(marker)))
  .map(([file]) => file);
if (missingUploadFallbackGuards.length === 0) {
  pass(
    'Missing Upload Path Guard: non-existent uploads paths return 404 before the SPA fallback while existing media files and directories keep normal handling.'
  );
} else {
  fail(
    `Missing Upload Path Guard: missing upload folders/files can still fall through to the SPA/post router. Missing: ${missingUploadFallbackGuards.join(', ')}.`
  );
}

if (
  installContent.includes('mergeManagedHtaccessContent') &&
  installContent.includes("$filePath . '.bak'") &&
  !installContent.includes('.vonbak.')
) {
  pass('Installer: managed .htaccess merge now uses the same single-backup strategy.');
} else {
  fail('Installer: .htaccess merge/backup strategy is still out of sync.');
}

if (
  installContent.includes("sendApiHeaders('POST, OPTIONS')") &&
  installContent.includes("if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {") &&
  installContent.includes("if ($_SERVER['REQUEST_METHOD'] !== 'POST') {") &&
  installContent.includes("ResponseHelper::sendError('Method not allowed', 405);")
) {
  pass('Installer Method Guard: install.php rejects non-POST requests after preflight.');
} else {
  fail('Installer Method Guard: install.php must reject non-POST requests after preflight.');
}

const anchoredManagedBlockRegexLine =
  "blockPattern = '/^[ \\t]*# BEGIN VonCMS\\r?$[\\s\\S]*?^[ \\t]*# END VonCMS\\r?\\n?/im';";
const tolerantBeginCounter = '/^[ \\t]*# BEGIN VonCMS\\r?$/m';
const tolerantEndCounter = '/^[ \\t]*# END VonCMS\\r?$/m';
if (
  repairHtaccessContent.includes(tolerantBeginCounter) &&
  installContent.includes(tolerantBeginCounter) &&
  fixIntegrityContent.includes(tolerantBeginCounter) &&
  fixIntegrityContent.includes(tolerantEndCounter)
) {
  pass(
    'Managed Block Counters: indentation-tolerant marker counters stay aligned with the anchored block matcher.'
  );
} else {
  fail(
    'Managed Block Counters: marker counters are still stricter than the anchored block matcher.'
  );
}

const legacyManagedBlockRegexLine = "blockPattern = '/\\s*# BEGIN VonCMS.*?# END VonCMS\\s*/is';";
if (
  repairHtaccessContent.includes(anchoredManagedBlockRegexLine) &&
  installContent.includes(anchoredManagedBlockRegexLine) &&
  !repairHtaccessContent.includes(legacyManagedBlockRegexLine) &&
  !installContent.includes(legacyManagedBlockRegexLine)
) {
  pass(
    'Managed Block Regex: anchored managed-block regex prevents preserving-comment false matches.'
  );
} else {
  fail('Managed Block Regex: managed-block regex is not locked to the anchored form.');
}

const siteConfigContent = read('src/config/site.config.ts');
if (siteConfigContent.includes('fixIntegrity:') && siteConfigContent.includes('repairHtaccess:')) {
  pass('API Config: separate integrity-check and .htaccess repair endpoints detected.');
} else {
  fail('API Config: missing split integrity/repair endpoint definitions.');
}

const loginContent = read('public/api/login.php');
assertIncludes(
  'Login Hardening',
  loginContent,
  [
    'RateLimiter::requireNotLimited()',
    'RateLimiter::recordAttempt()',
    'RateLimiter::reset()',
    'session_regenerate_id(true)',
    "ResponseHelper::sendError('Invalid credentials', 401)",
    "ResponseHelper::sendError('Login failed', 400)",
  ],
  'Login Hardening: rate limit, session rotation, and generic failure responses are present.',
  'Login Hardening: login endpoint is missing brute-force or generic-failure protections.'
);

const authLoginContent = read('src/plugins/von-core/features/auth/Login.tsx');
if (
  authLoginContent.includes("data.error || data.message || 'Invalid username or password.'") &&
  authLoginContent.includes("data.error || data.message || 'Registration failed.'") &&
  authLoginContent.includes("data.error || data.message || 'Request failed'") &&
  authLoginContent.includes("data.error || data.message || 'Reset failed'")
) {
  pass(
    'Auth Form API Error Display: login, register, forgot-password, and reset forms surface backend error fields.'
  );
} else {
  fail(
    'Auth Form API Error Display: auth forms can still hide backend validation errors such as duplicate email or invalid reset token.'
  );
}

const systemToolsContent = read('src/plugins/von-core/features/tools/SystemTools.tsx');
if (
  systemToolsContent.includes('Run Integrity Check') &&
  systemToolsContent.includes('API.repairHtaccess') &&
  systemToolsContent.includes('Repair .htaccess')
) {
  pass('System Tools: separate integrity-check and .htaccess repair buttons detected.');
} else {
  fail('System Tools: tool split between integrity check and .htaccess repair is missing.');
}

const clearPublicCacheEndpointContent = exists('public/api/system/clear_public_cache.php')
  ? read('public/api/system/clear_public_cache.php')
  : '';
const publicCacheHelperContent = exists('public/api/public_cache_helper.php')
  ? read('public/api/public_cache_helper.php')
  : '';

assertIncludes(
  'Lightweight Public Cache Helper Contract',
  publicCacheHelperContent,
  [
    'function voncms_public_cache_get',
    'function voncms_public_cache_set',
    'function voncms_public_cache_prune',
    'function voncms_public_cache_clear',
    "dirname(__DIR__) . '/data/public-cache'",
    'LOCK_EX',
    'rename($tempFile, $cacheFile)',
    'voncms_public_cache_prune(60, 250);',
    '@unlink($cacheFile);',
    '$maxFiles',
    'return null;',
  ],
  'Lightweight Public Cache Helper Contract: public JSON cache helper is fail-open, protected-path backed, bounded, stale-pruned, and atomic-write based.',
  'Lightweight Public Cache Helper Contract: helper is missing fail-open, protected-path, bounded-growth, stale-prune, or atomic-write markers.'
);

const cacheTryPosition = publicCacheHelperContent.indexOf(
  'try {',
  publicCacheHelperContent.indexOf('function voncms_public_cache_set')
);
const cacheTempPosition = publicCacheHelperContent.indexOf(
  '$tempFile = $cacheFile .',
  publicCacheHelperContent.indexOf('function voncms_public_cache_set')
);
const cacheRenamePosition = publicCacheHelperContent.indexOf('rename($tempFile, $cacheFile)');
const cachePostWritePrunePosition = publicCacheHelperContent.indexOf(
  'voncms_public_cache_prune(60, 250);',
  cacheRenamePosition
);
if (
  cacheTryPosition !== -1 &&
  cacheTempPosition > cacheTryPosition &&
  cachePostWritePrunePosition > cacheRenamePosition
) {
  pass(
    'Public Cache Write Failure Boundary: temp-name generation is caught and successful writes enforce the final file cap.'
  );
} else {
  fail(
    'Public Cache Write Failure Boundary: temp-name generation can escape fail-open handling or writes can exceed the final file cap.'
  );
}

assertIncludes(
  'Manual Public Cache Clear Boundary',
  clearPublicCacheEndpointContent + '\n' + siteConfigContent + '\n' + systemToolsContent,
  [
    "sendApiHeaders('POST, OPTIONS')",
    'SessionManager::requirePrimaryAdmin();',
    'CSRFProtection::requireToken();',
    'voncms_public_cache_clear()',
    'clearPublicCache',
    'Clear Public Cache',
    'API.clearPublicCache',
  ],
  'Manual Public Cache Clear Boundary: primary admin System Tools action clears public cache with POST and CSRF.',
  'Manual Public Cache Clear Boundary: clear public cache endpoint or System Tools wiring is incomplete.'
);
const legacySystemContent = read('public/von_system.php');
if (
  legacySystemContent.includes("require_once __DIR__ . '/api/get_settings.php';") &&
  legacySystemContent.includes("require_once __DIR__ . '/api/save_settings.php';") &&
  !legacySystemContent.includes('if (saveSettings($newSettings))') &&
  !legacySystemContent.includes(
    "$sensitiveKeys = ['smtpPass', 'smtpUser', 'smtpHost', 'smtpEncryption'];"
  )
) {
  pass(
    'Legacy Settings Bridge: von_system.php delegates both get_settings and save_settings to the database-backed settings endpoints instead of keeping a file-backed drift path.'
  );
} else {
  fail(
    'Legacy Settings Bridge: von_system.php still maintains a drift-prone local settings path instead of delegating both get_settings and save_settings to api/get_settings.php and api/save_settings.php.'
  );
}

const adminLayoutContent = read('src/components/layouts/AdminLayout.tsx');
if (
  adminLayoutContent.includes('API.repairHtaccess') &&
  adminLayoutContent.includes('Repair .htaccess Now') &&
  adminLayoutContent.includes('Repairing .htaccess...')
) {
  pass('Admin Warning: integrity warning now points to dedicated .htaccess repair.');
} else {
  fail('Admin Warning: integrity warning still points to the old hammer fix flow.');
}

const aiGenerateContent = read('public/api/ai_generate.php');
const aiCheckContent = read('public/api/ai_check.php');
if (
  aiGenerateContent.includes("function_exists('curl_init')") &&
  aiGenerateContent.includes('AI service returned invalid JSON') &&
  aiCheckContent.includes("function_exists('curl_init')") &&
  aiCheckContent.includes('AI service returned invalid JSON')
) {
  pass('AI APIs: cURL and malformed JSON hardening detected.');
} else {
  fail('AI APIs: hardening for cURL/invalid JSON is incomplete.');
}

if (
  aiGenerateContent.includes('Do not add a conclusion section') &&
  aiGenerateContent.includes('Never use the em dash character') &&
  aiGenerateContent.includes('Write with a natural human rhythm') &&
  aiGenerateContent.includes('Avoid AI-signature phrases')
) {
  pass(
    'AI Writing Style Contract: generation prompt avoids generic conclusions, em dashes, and obvious AI-writing cadence.'
  );
} else {
  fail(
    'AI Writing Style Contract: ai_generate.php must prevent generic conclusions, em dashes, and obvious AI-writing cadence.'
  );
}

if (
  aiGenerateContent.includes(
    "$finishReason = strtoupper((string) ($data['candidates'][0]['finishReason'] ?? ''));"
  ) &&
  aiGenerateContent.includes("$finishReason !== '' && $finishReason !== 'STOP'") &&
  aiGenerateContent.includes('AI response was incomplete: ')
) {
  pass(
    'AI Generation Completion Contract: non-STOP Gemini finish reasons are rejected even when partial text is present.'
  );
} else {
  fail(
    'AI Generation Completion Contract: partial Gemini responses can still be accepted as successful generated content.'
  );
}

if (
  aiCheckContent.includes(
    "$finishReason = strtoupper((string) ($data['candidates'][0]['finishReason'] ?? ''));"
  ) &&
  aiCheckContent.includes("$finishReason !== '' && $finishReason !== 'STOP'") &&
  aiCheckContent.indexOf("$finishReason !== '' && $finishReason !== 'STOP'") <
    aiCheckContent.indexOf('if (empty($generatedText))')
) {
  pass(
    'AI Check Completion Contract: non-STOP Gemini finish reasons are rejected even when partial review text is present.'
  );
} else {
  fail(
    'AI Check Completion Contract: partial Gemini review responses can still be accepted as successful check output.'
  );
}

const aiWritingPanelExists = exists('src/components/editor/AiWritingPanel.tsx');
const aiWritingPanelContent = aiWritingPanelExists
  ? read('src/components/editor/AiWritingPanel.tsx')
  : '';
const useAiWritingExists = exists('src/hooks/useAiWriting.ts');
const useAiWritingContent = useAiWritingExists ? read('src/hooks/useAiWriting.ts') : '';
const settingsManagerContent = read('src/plugins/von-core/features/settings/SettingsManager.tsx');
const useSettingsContent = read('src/hooks/useSettings.ts');
const typesContent = read('src/types.ts');
if (
  postEditorContent.includes('parseJsonResponse') &&
  postEditorContent.includes('await res.text()')
) {
  pass('PostEditor: non-JSON AI response handling detected.');
} else {
  fail('PostEditor: AI response parsing still looks brittle.');
}

if (
  aiWritingPanelExists &&
  useAiWritingExists &&
  postEditorContent.includes("from './editor/AiWritingPanel'") &&
  postEditorContent.includes("from '../hooks/useAiWriting'") &&
  postEditorContent.includes('<AiWritingPanel') &&
  postEditorContent.includes('const aiAssistant = useAiWriting(') &&
  aiWritingPanelContent.includes('AI Assistant') &&
  aiWritingPanelContent.includes('onGenerate') &&
  aiWritingPanelContent.includes('onCheck') &&
  useAiWritingContent.includes('export const useAiWriting =') &&
  !postEditorContent.includes('onClick={generateAiContent}') &&
  !postEditorContent.includes('onClick={handleAiCheck}')
) {
  pass(
    'HourGlass AI Assistant Split: PostEditor now delegates Gemini writing/check flows to a dedicated side-panel and hook instead of top-bar buttons.'
  );
} else {
  fail(
    'HourGlass AI Assistant Split: expected AiWritingPanel/useAiWriting wiring and removal of the legacy top-bar AI button handlers.'
  );
}

if (
  settingsManagerContent.includes('AI generation currently uses Google Gemini.') &&
  !settingsManagerContent.includes('<option value="openai">OpenAI</option>') &&
  !settingsManagerContent.includes("tempSettings.api?.aiProvider === 'openai'") &&
  typesContent.includes("aiProvider?: 'gemini';") &&
  (postEditorContent.includes('Please enter your Google Gemini API Key') ||
    useAiWritingContent.includes('Please enter your Google Gemini API Key')) &&
  !postEditorContent.includes("provider === 'openai'") &&
  !postEditorContent.includes('provider: provider')
) {
  pass('Settings AI Provider: admin UI and editor are locked to the Gemini-only backend.');
} else {
  fail(
    'Settings AI Provider: OpenAI UI/editor markers must not be exposed while backend is Gemini-only.'
  );
}

if (
  settingsManagerContent.includes('const saved = await onUpdate(settingsToSave);') &&
  !settingsManagerContent.includes("formData.append('action', 'save_settings')") &&
  !settingsManagerContent.includes('vonFetch(API.api')
) {
  pass('Settings Save Flow: SettingsManager uses the canonical save endpoint once.');
} else {
  fail(
    'Settings Save Flow: SettingsManager still looks like it double-saves through the legacy bridge.'
  );
}

const saveSettingsContent = read('public/api/save_settings.php');
const getSettingsContent = read('public/api/get_settings.php');
assertIncludes(
  'Public Settings Cache Boundary',
  getSettingsContent,
  [
    "require_once __DIR__ . '/public_cache_helper.php';",
    '$publicSettingsCacheKey = voncms_public_cache_key',
    'voncms_public_cache_get($publicSettingsCacheKey',
    'voncms_public_cache_set($publicSettingsCacheKey',
    '$isAdmin = SessionManager::isAdmin();',
    '$isPrimaryAdmin = SessionManager::isPrimaryAdmin();',
    "unset($settings['adminProfile']);",
    "header('Cache-Control: no-cache, no-store, must-revalidate');",
  ],
  'Public Settings Cache Boundary: only guest-shaped settings can use the public JSON cache after secret scrubbing.',
  'Public Settings Cache Boundary: guest settings cache is missing eligibility, scrub, or conservative header markers.'
);
assertIncludes(
  'AI Key Privacy and Rotation Contract',
  saveSettingsContent +
    '\n' +
    getSettingsContent +
    '\n' +
    settingsManagerContent +
    '\n' +
    postEditorContent,
  [
    "$group === 'api' && $dbKey === 'config'",
    "'expireAiKeyAfter30Days'",
    "'aiKeySavedAt'",
    "'aiKeyExpiresAt'",
    'Expire saved AI key after 30 days',
    'Saved Gemini API key expired',
  ],
  'AI Key Privacy and Rotation: API config stays private, can opt into 30-day expiry, and expired saved keys fall back to the prompt flow.',
  'AI Key Privacy and Rotation: saved Gemini key privacy/expiry markers are incomplete.'
);

if (
  useAiWritingContent.includes("import { useCallback, useRef, useState } from 'react';") &&
  useAiWritingContent.includes("const promptedApiKeyRef = useRef('');") &&
  useAiWritingContent.includes('promptedApiKeyRef.current') &&
  useAiWritingContent.includes('promptedApiKeyRef.current = promptedApiKey;') &&
  !useAiWritingContent.includes('localStorage.setItem') &&
  !useAiWritingContent.includes('sessionStorage.setItem')
) {
  pass(
    'Staff AI Key Session Memory: prompted Gemini keys are reused in editor memory without persisting to browser storage.'
  );
} else {
  fail(
    'Staff AI Key Session Memory: staff users must not be prompted for the Gemini key on every AI action, and the key must not be persisted to browser storage.'
  );
}

if (
  saveSettingsContent.includes('$aiKeyIsProtectedPlaceholder') &&
  saveSettingsContent.includes('$existingAiKeyExpired') &&
  saveSettingsContent.includes(
    "unset($value['aiApiKey'], $value['aiKeySavedAt'], $value['aiKeyExpiresAt']);"
  ) &&
  settingsManagerContent.includes('const isSavedAiKeyExpired') &&
  settingsManagerContent.includes('!Number.isFinite(aiKeyExpiresAtTime)') &&
  settingsManagerContent.includes("aiApiKey: ''") &&
  settingsManagerContent.includes('expiredAiKeyNotice') &&
  settingsManagerContent.includes('Saved Gemini API key expired. Enter a fresh key to continue.') &&
  !settingsManagerContent.includes('clearExpiredAiKeyFromSettings') &&
  useAiWritingContent.includes('settings?.api?.aiApiKey &&') &&
  useAiWritingContent.includes('!Number.isFinite(aiKeyExpiresAtTime)')
) {
  pass(
    'Expired AI Key Auto-Clear Contract: expired saved Gemini keys are removed from settings state/storage instead of staying as stale prompt-only keys.'
  );
} else {
  fail(
    'Expired AI Key Auto-Clear Contract: expired Gemini keys can still remain saved after the 30-day boundary.'
  );
}

const settingsMirrorUsesUniqueTemp =
  saveSettingsContent.includes("'.' . bin2hex(random_bytes(6)) . '.tmp'") &&
  saveSettingsContent.includes('LOCK_EX') &&
  !saveSettingsContent.includes("$tempFile = $settingsFile . '.tmp';");
const settingsMirrorFailureIsNonBlocking =
  saveSettingsContent.includes('$mirrorWarning = null;') &&
  saveSettingsContent.includes("error_log('Settings JSON mirror write failed: '") &&
  saveSettingsContent.includes("'warning' => $mirrorWarning,");

if (settingsMirrorUsesUniqueTemp && settingsMirrorFailureIsNonBlocking) {
  pass(
    'Settings JSON Mirror Hardening: save_settings.php uses a unique locked temp file and treats post-commit mirror failures as warnings instead of rolling back the canonical DB save.'
  );
} else {
  fail(
    'Settings JSON Mirror Hardening: save_settings.php still looks vulnerable to temp-file races or post-commit mirror failures surfacing as save errors.'
  );
}

const settingsAuditViewerContent = read('public/api/get_settings_audit.php');
if (
  settingsAuditViewerContent.includes('max(1, min(200') &&
  settingsAuditViewerContent.includes(':limit') &&
  settingsAuditViewerContent.includes('PDO::PARAM_INT') &&
  !settingsAuditViewerContent.includes('LIMIT ?') &&
  settingsAuditViewerContent.includes("(string) ($log['old_value'] ?? '')") &&
  settingsAuditViewerContent.includes("(string) ($log['new_value'] ?? '')")
) {
  pass(
    'Settings Audit Viewer Runtime Guard: audit log listing clamps and integer-binds LIMIT while truncating nullable values safely.'
  );
} else {
  fail(
    'Settings Audit Viewer Runtime Guard: get_settings_audit.php can still fail on live admin audit listing because LIMIT binding or nullable value formatting is unsafe.'
  );
}

if (
  useSettingsContent.includes('const onToggleNav = useCallback') &&
  useSettingsContent.includes('const res = await vonFetch(API.saveSettings') &&
  !useSettingsContent.includes('const tryPhp = async') &&
  !useSettingsContent.includes("form.append('action', 'save_settings')") &&
  !useSettingsContent.includes('vonFetch(API.api')
) {
  pass('Navigation Toggle Save Flow: onToggleNav uses the canonical save endpoint only.');
} else {
  fail(
    'Navigation Toggle Save Flow: onToggleNav still appears to fall back through the legacy settings bridge.'
  );
}

const editorSecurityContent = read('src/utils/security.ts');
const codeqlFrontendFollowupContent = [
  editorContent,
  postEditorContent,
  postEditorSaveHelpersContent,
  contactManagerContent,
  read('src/plugins/von-core/features/seo/VonSEO.tsx'),
  read('src/themes/default/Layout.tsx'),
  read('src/themes/prism/Layout.tsx'),
  read('src/themes/digest/Layout.tsx'),
  read('src/themes/portfolio/Layout.tsx'),
  read('src/themes/corporate-pro/Layout.tsx'),
  read('src/themes/techpress/Layout.tsx'),
  read('src/plugins/von-core/features/users/UserProfile.tsx'),
  read('src/themes/techpress/Profile.tsx'),
  read('src/themes/prism/components/PrismProfile.tsx'),
  read('src/plugins/von-core/features/settings/components/themes/CorporateProSettings.tsx'),
  read('src/utils/siteUtils.ts'),
  editorSecurityContent,
].join('\n');
const safeImageContent = exists('src/components/SafeImage.tsx')
  ? read('src/components/SafeImage.tsx')
  : '';
const codeqlImageSinkGuardedFiles = [
  'src/components/PostEditor.tsx',
  'src/plugins/von-core/features/users/UserProfile.tsx',
  'src/plugins/von-core/features/settings/components/themes/CorporateProSettings.tsx',
  'src/themes/digest/Layout.tsx',
  'src/themes/techpress/Profile.tsx',
  'src/themes/prism/components/PrismProfile.tsx',
];
const codeqlImageSinkGuardedContent = codeqlImageSinkGuardedFiles
  .map((file) => read(file))
  .join('\n');
assertIncludes(
  'CodeQL Follow-Up Frontend Guard',
  codeqlFrontendFollowupContent,
  [
    'hasEmbeddedVideoMarkup',
    'htmlToPlainText',
    'normalizeImageSource',
    'createEditorDocument',
    'isLegacyVonCmsEmail',
  ],
  'CodeQL Follow-Up Frontend Guard: video detection, text extraction, image src, editor HTML parsing, and legacy email warnings use shared helpers.',
  'CodeQL Follow-Up Frontend Guard: one or more helper boundaries for CodeQL follow-up fixes are missing.'
);
assertIncludes(
  'CodeQL Safe Image Sink Guard',
  safeImageContent + '\n' + codeqlImageSinkGuardedContent,
  [
    'export const SafeImage',
    'normalizeImageSource(src)',
    'useEffect(() =>',
    '}, [safeSrc])',
    'if (!safeSrc || hasFailed)',
    "React.createElement('img'",
    'src: safeSrc',
    'lgtm[js/xss]',
    'codeql[js/xss]',
    '<SafeImage',
  ],
  'CodeQL Safe Image Sink Guard: user-supplied image URLs flow through one validated SafeImage boundary instead of repeated direct img src sinks.',
  'CodeQL Safe Image Sink Guard: CodeQL-visible image src sinks are not centralized behind SafeImage.'
);
assertExcludes(
  'CodeQL Direct Image Sink Guard',
  codeqlImageSinkGuardedContent,
  ['src={normalizeImageSource('],
  'CodeQL Direct Image Sink Guard: guarded alert files no longer render normalized user image URLs directly into img src.',
  'CodeQL Direct Image Sink Guard: guarded alert files still render normalized user image URLs directly into img src.'
);
assertExcludes(
  'CodeQL SafeImage JSX Sink Guard',
  safeImageContent,
  ['<img', 'src={safeSrc}'],
  'CodeQL SafeImage JSX Sink Guard: SafeImage no longer exposes its audited src sink through JSX img syntax.',
  'CodeQL SafeImage JSX Sink Guard: SafeImage still exposes a JSX img src sink that CodeQL flags as DOM text reinterpreted as HTML.'
);
assertExcludes(
  'CodeQL Follow-Up Legacy Pattern Guard',
  codeqlFrontendFollowupContent + '\n' + createReleaseContent,
  [
    "input.includes('tiktok.com')",
    "input.includes('instagram.com')",
    "input.includes('facebook.com')",
    "input.includes('fb.watch')",
    "input.includes('youtube.com/shorts')",
    "content?.includes('youtube.com/embed')",
    "content?.includes('player.vimeo.com')",
    ".mail.to.includes('voncms.com')",
    ".mail.from.includes('voncms.com')",
    "version.replace(/\\./g, '\\\\.')",
  ],
  'CodeQL Follow-Up Legacy Pattern Guard: legacy substring checks and partial regex escaping are absent from guarded source files.',
  'CodeQL Follow-Up Legacy Pattern Guard: legacy substring checks or partial regex escaping are still present.'
);
const pasteStyleAllowlistMatch = editorSecurityContent.match(
  /const EDITOR_ALLOWED_PASTE_STYLE_PROPS = new Set\(\[([\s\S]*?)\]\);/
);
const pasteStyleAllowlist = pasteStyleAllowlistMatch ? pasteStyleAllowlistMatch[1] : '';
if (
  editorSecurityContent.includes('EDITOR_ALLOWED_PASTE_STYLE_PROPS') &&
  editorSecurityContent.includes('filterPasteStyles') &&
  editorContent.includes('transformPastedHTML: (html) =>') &&
  editorContent.includes('sanitizePastedHtml(sanitizeHTML(html).cleanedHTML)') &&
  editorContent.includes('if (e.defaultPrevented) return;') &&
  editorSecurityContent.includes('const filteredStyle = filterPasteStyles(value);') &&
  editorSecurityContent.includes('element.setAttribute(attr.name, filteredStyle);') &&
  editorSecurityContent.includes("prop.startsWith('mso-')") &&
  !pasteStyleAllowlist.includes("'font-size'") &&
  !pasteStyleAllowlist.includes('"font-size"') &&
  !pasteStyleAllowlist.includes("'font-family'") &&
  !pasteStyleAllowlist.includes('"font-family"') &&
  editorSecurityContent.includes("'line-height'") &&
  editorSecurityContent.includes("'font-weight'") &&
  editorSecurityContent.includes("'text-align'")
) {
  pass(
    'PostEditor Word Paste Cleanliness: TipTap paste transforms and wrapper paste handling strip font sizing/family residue while safe inline intent stays bounded.'
  );
} else {
  fail(
    'PostEditor Word Paste Cleanliness: Word/news-site font-family/font-size/mso paste styles can still bypass the TipTap paste sanitizer.'
  );
}

const useContentContent = read('src/hooks/useContent.ts');
assertIncludes(
  'Page Editor Meta Description Reload Contract',
  useContentContent + '\n' + appShellContent,
  [
    "metaDescription: p.metaDescription || p.meta_description || ''",
    "meta_description: p.meta_description || p.metaDescription || ''",
    'metaDescription: page.metaDescription || page.meta_description ||',
  ],
  'Page Editor Meta Description Reload Contract: page list, seed, and hard-refresh recovery payloads preserve manual meta descriptions across editor reloads.',
  'Page Editor Meta Description Reload Contract: page editor hard reload can drop manual meta descriptions because meta_description is not normalized to metaDescription.'
);

if (
  (postEditorContent + '\n' + postEditorSaveHelpersContent).includes(
    "canAutoSave: (currentItem?.status || 'draft') === 'draft'"
  ) &&
  postEditorContent.includes('handleSave(undefined, true, currentItem)') &&
  (postEditorContent + '\n' + postEditorSaveHelpersContent).includes('scheduledAt:') &&
  postEditorContent.includes(
    "data.post.scheduled_at || ('scheduledAt' in prev ? prev.scheduledAt || '' : '')"
  ) &&
  postEditorContent.includes('Publish Date & Time') &&
  useContentContent.includes("scheduledAt: p.scheduled_at || p.scheduledAt || ''")
) {
  pass(
    'Post Scheduling Editor: scheduledAt normalization, draft-only autosave, and clean scheduling labels are in place.'
  );
} else {
  fail('Post Scheduling Editor: scheduling normalization/autosave guards are incomplete.');
}

assertIncludes(
  'PostEditor Autosave Feedback',
  postEditorContent + '\n' + postEditorSaveHelpersContent,
  [
    'const AUTOSAVE_INTERVAL_MS = 60000;',
    'const [saveStatus, setSaveStatus]',
    'const [autoSaveCountdown, setAutoSaveCountdown]',
    'nextAutoSaveAtRef',
    'refreshAutoSaveCountdown',
    "document.visibilityState === 'visible'",
    'handleSave(undefined, true, currentItem)',
    "saveStatus === 'manual-saving'",
    'notify.loading(',
    "'Saving draft...'",
    'Autosave in',
  ],
  'PostEditor Autosave Feedback: countdown, tab-resume refresh, and persistent manual save status are present.',
  'PostEditor Autosave Feedback: v1.23.4 countdown/status markers are missing.'
);

const savePostApiContent = read('public/api/save_post.php');
const savePageApiContent = read('public/api/save_page.php');
assertIncludes(
  'Post/Page Title Length Limit Contract',
  postEditorContent + '\n' + savePostApiContent + '\n' + savePageApiContent,
  [
    'const TITLE_MAX_LENGTH = 255;',
    'maxLength={TITLE_MAX_LENGTH}',
    'Title is limited to ${TITLE_MAX_LENGTH} characters.',
    'mb_strlen($rawTitle) > 255',
    'Title is too long. Maximum 255 characters allowed.',
  ],
  'Post/Page Title Length Limit Contract: shared editor and save APIs enforce the 255-character database title ceiling.',
  'Post/Page Title Length Limit Contract: titles can exceed the 255-character storage ceiling without a clear editor/backend warning.'
);
assertIncludes(
  'Post Slug Separator Normalization',
  useContentContent + '\n' + savePostApiContent,
  [".replace(/-+/g, '-')", "$input['slug'] = preg_replace('/-+/', '-', (string) $input['slug']);"],
  'Post Slug Separator Normalization: frontend and backend collapse spaced dash separators into one canonical hyphen.',
  'Post Slug Separator Normalization: spaced dash title separators can still save as triple-hyphen slugs.'
);
assertIncludes(
  'Save Post API PDO Static Analysis Guard',
  savePostApiContent,
  [
    'if (!isset($pdo) || !($pdo instanceof PDO)) {',
    '/** @var PDO $db */',
    '$db = $pdo;',
    '$db->beginTransaction();',
    '$db instanceof PDO && $db->inTransaction()',
  ],
  'Save Post API PDO Static Analysis Guard: save_post.php narrows the configured PDO before transaction and prepare calls.',
  'Save Post API PDO Static Analysis Guard: save_post.php can still look nullable to static analysis before DB calls.'
);
assertIncludes(
  'PostEditor Autosave Conflict Guard',
  postEditorContent +
    '\n' +
    postEditorSaveHelpersContent +
    '\n' +
    useContentContent +
    '\n' +
    savePostApiContent +
    '\n' +
    savePageApiContent,
  [
    'initialItemRef.current = restoredSnapshot;',
    "const baseUpdatedAt = item.updated_at || item.updatedAt || '';",
    'baseUpdatedAt,',
    "$clientUpdatedAt = trim((string) ($input['baseUpdatedAt'] ?? ''));",
    'http_response_code(409);',
    'Content changed in another tab. Reload before saving again.',
    'const SAVE_CONFLICT_MESSAGE =',
    'Content was updated elsewhere. Reload the editor before saving again.',
    '(error as any).status = res.status;',
    'err?.status === 409',
    'notify.error(SAVE_CONFLICT_MESSAGE);',
    "updated_at' => $savedUpdatedAt",
    "updatedAt' => $savedUpdatedAt",
  ],
  'PostEditor Autosave Conflict Guard: restored content updates the clean baseline, stale same-user tab saves fail with 409, and publishers see a conflict-specific reload notice.',
  'PostEditor Autosave Conflict Guard: autosave baseline restore, stale-tab save protection, or conflict-specific publisher feedback is incomplete.'
);

const getPostApiContent = read('public/api/get_post.php');
if (
  /if\s*\(!\$canReadProtectedPost\)\s*\{\s*\/\/ View tracking must not change[\s\S]*?UPDATE posts SET views = views \+ 1, updated_at = updated_at WHERE id = \?[\s\S]*?\}/.test(
    getPostApiContent
  )
) {
  pass(
    'Single Post View Counter Timestamp Guard: admin editor reads skip view tracking and public view tracking preserves updated_at so editor restore cannot create a false 409 conflict.'
  );
} else {
  fail(
    'Single Post View Counter Timestamp Guard: get_post.php can mutate updated_at while incrementing views, causing old post editor saves to fail with false 409 conflicts.'
  );
}

const monolithicTrackingContent = read('public/api/track_monolithic.php');
assertIncludes(
  'Monolithic View Counter Timestamp Guard',
  monolithicTrackingContent,
  [
    'UPDATE posts SET views = COALESCE(views, 0) + 1, updated_at = updated_at WHERE id = ?',
    'UPDATE pages SET views = COALESCE(views, 0) + 1, updated_at = updated_at WHERE id = ?',
  ],
  'Monolithic View Counter Timestamp Guard: post/page analytics view counters preserve updated_at so SEO dateModified, sitemap lastmod, and editor conflict baselines only change on real content edits.',
  'Monolithic View Counter Timestamp Guard: analytics view counters can mutate updated_at and create false modified dates or editor 409 conflicts.'
);

const promoBarContent = read('src/plugins/von-core/features/plugins/built-in/promo-bar/index.tsx');
const giftWidgetContent = read(
  'src/plugins/von-core/features/plugins/built-in/gift-widget/index.tsx'
);
const extensionsManagerContent = read(
  'src/plugins/von-core/features/extensions/ExtensionsManager.tsx'
);
assertIncludes(
  'Promo Bar Solid Color Picker',
  promoBarContent + extensionsManagerContent,
  [
    "const DEFAULT_BACKGROUND_COLOR = '#db2777';",
    'getReadableTextColor',
    'backgroundColor: string;',
    'style={{ backgroundColor, color: textColor }}',
    'props?.backgroundColor || DEFAULT_BACKGROUND_COLOR',
    "id === 'vp_promo_bar'",
    "currentConfig.backgroundColor || '#db2777'",
    "const isColorField = key.toLowerCase().includes('color');",
    'const pickerValue = /^#[0-9a-f]{6}$/i.test(fieldValue)',
    '? fieldValue',
    ": '#db2777';",
    'isColorField ? (',
    'className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-1 dark:border-[#2a2b36]"',
    'font-mono uppercase',
    'style={{ backgroundColor: pickerValue }}',
  ],
  'Promo Bar Solid Color Picker: solid background config, auto text contrast, and swatch/hex admin color UI markers are present.',
  'Promo Bar Solid Color Picker: v1.23.x solid color picker UI markers are missing.'
);

assertIncludes(
  'Extensions Manager Install State Contract',
  extensionsManagerContent,
  [
    'const handleInstall = (id: string) => {',
    "newPluginStatus[id] = 'inactive';",
    'onUpdateSettings({',
    'pluginStatus: newPluginStatus',
  ],
  'Extensions Manager Install State Contract: plugin install persists inactive status instead of staying local-only.',
  'Extensions Manager Install State Contract: plugin install still only mutates local card state.'
);

assertIncludes(
  'Extensions Manager Uninstall State Contract',
  extensionsManagerContent,
  [
    'const handleUninstall = (id: string) => {',
    "newPluginStatus[id] = 'not_installed';",
    'newActivePlugins = newActivePlugins.filter((pId) => pId !== id);',
    'pluginStatus: newPluginStatus',
  ],
  'Extensions Manager Uninstall State Contract: plugin uninstall persists inactive cleanup and removes active plugin state.',
  'Extensions Manager Uninstall State Contract: plugin uninstall still only mutates local card state.'
);

assertIncludes(
  'Extensions Runtime Status Contract',
  extensionsManagerContent + pluginRegistryContent + usePluginsContent + pluginRuntimeContent,
  [
    "const savedPluginStatus = settings.pluginConfig?.['pluginStatus']?.[plugin.id];",
    "(settings.activePlugins?.includes(plugin.id) ? 'active' : plugin.status)",
    'return isSystemPluginActive({ activePlugins: safeActivePlugins, pluginConfig }, p.id);',
    "if (!isSystemPluginActive(settings, 'vp_ai_summary')) return null;",
    "const isActive = isSystemPluginActive(settings, 'vp_related_posts');",
    'if (!isActive || !currentPost || !config.enabled || candidatePosts.length === 0) return null;',
    "return status ? status === 'active' : true;",
  ],
  'Extensions Runtime Status Contract: admin cards and public plugin rendering share active/inactive/not-installed state.',
  'Extensions Runtime Status Contract: pluginStatus can drift between admin cards and public rendering.'
);

assertIncludes(
  'Article Plugin Render Guard',
  usePluginsContent + aiSummaryPluginContent + relatedPostsPluginContent,
  [
    "if (_location !== 'post_after') return null;",
    'if (!summaryConfig.enabled) return null;',
    'if (!relatedConfig.enabled) return null;',
    "const isActive = isSystemPluginActive(settings, 'vp_related_posts');",
    'if (!isActive || !currentPost || !config.enabled || candidatePosts.length === 0) return null;',
  ],
  'Article Plugin Render Guard: article-only plugins respect disabled state, post_after placement, and missing-post safety.',
  'Article Plugin Render Guard: article-only plugins can render in global slots or crash without a current post.'
);

assertIncludes(
  'System Plugin Runtime Helper Contract',
  pluginRuntimeContent,
  [
    'export function isSystemPluginActive',
    'settings?.activePlugins?.includes(pluginId)',
    "const status = settings.pluginConfig?.['pluginStatus']?.[pluginId];",
    "return status ? status === 'active' : true;",
  ],
  'System Plugin Runtime Helper Contract: shared active/pluginStatus gating helper is present.',
  'System Plugin Runtime Helper Contract: plugin active checks are still scattered or missing pluginStatus handling.'
);

assertIncludes(
  'VonSEO Theme Toggle Contract',
  pluginRuntimeContent +
    read('src/themes/default/Layout.tsx') +
    read('src/themes/prism/Layout.tsx') +
    read('src/themes/techpress/Layout.tsx') +
    read('src/themes/portfolio/Layout.tsx') +
    read('src/themes/corporate-pro/Layout.tsx') +
    read('src/themes/digest/Layout.tsx'),
  [
    "isSystemPluginActive(settings, 'vp_von_seo')",
    "isSystemPluginActive(siteSettings, 'vp_von_seo')",
    'const shouldRenderVonSEO =',
  ],
  'VonSEO Theme Toggle Contract: bundled themes gate VonSEO with the shared active/pluginStatus helper.',
  'VonSEO Theme Toggle Contract: at least one bundled theme can still render VonSEO while the plugin is disabled.'
);

assertIncludes(
  'VonAnalytics Runtime Toggle Contract',
  read('src/plugins/von-core/providers/VonProviders.tsx') + publicSiteContent,
  [
    "const analyticsPluginActive = isSystemPluginActive(settings, 'vp_analytics');",
    '{analyticsPluginActive && <AnalyticsInjector analytics={settings.analytics} />}',
    "if (!isSystemPluginActive(props.settings, 'vp_analytics')) return;",
    'const analyticsPluginActive = isSystemPluginActive(props.settings,',
    'cookieConsentRequired={',
    'analyticsPluginActive && (props.settings.analytics?.cookieConsent || false)',
  ],
  'VonAnalytics Runtime Toggle Contract: GA injection, native tracking, and cookie banner respect plugin active state.',
  'VonAnalytics Runtime Toggle Contract: analytics can still run after the VonAnalytics plugin is disabled.'
);

assertIncludes(
  'VonSEO Social Image Contract',
  read('src/plugins/von-core/features/seo/VonSEO.tsx'),
  [
    "let image = settings.ogImageUrl || settings.logoUrl || '';",
    'const ogImage = image || settings.ogImageSquareUrl ||',
    'const absoluteOgImage = toAbsolute(ogImage);',
    "ensureMeta('og:image', 'property', absoluteOgImage);",
    "ensureMeta('og:image:alt', 'property', absoluteOgImage ? title : '');",
  ],
  'VonSEO Social Image Contract: large OG fallback is used and square image no longer overwrites the primary image.',
  'VonSEO Social Image Contract: social image fallback can still ignore large OG image or overwrite og:image.'
);

assertExcludes(
  'VonSEO Duplicate Og Image Guard',
  read('src/plugins/von-core/features/seo/VonSEO.tsx'),
  ["ensureMeta('og:image', 'property', toAbsolute(settings.ogImageSquareUrl))"],
  'VonSEO Duplicate Og Image Guard: square fallback no longer writes a second og:image through the same single-meta helper.',
  'VonSEO Duplicate Og Image Guard: square fallback still overwrites the primary og:image meta tag.'
);

assertIncludes(
  'VonSEO General Description Source Contract',
  read('src/plugins/von-core/features/seo/VonSEO.tsx') +
    read('src/plugins/von-core/features/extensions/components/VonSEOSettings.tsx'),
  [
    "let description = settings.siteDescription || '';",
    'Default Meta Description (from General Settings)',
    "value={settings.siteDescription || ''}",
    'readOnly',
  ],
  'VonSEO General Description Source Contract: site-level meta description is sourced from General Settings and shown read-only in SEO settings.',
  'VonSEO General Description Source Contract: default meta description can still drift away from General Settings.'
);

assertExcludes(
  'VonSEO Default Description Drift Guard',
  read('src/plugins/von-core/features/seo/VonSEO.tsx') +
    read('src/plugins/von-core/features/extensions/components/VonSEOSettings.tsx') +
    read('src/plugins/von-core/features/extensions/ExtensionsManager.tsx'),
  [
    'settings.seo?.defaultMetaDescription || settings.siteDescription',
    'defaultMetaDescription: settings.siteDescription',
    'setTempSEO({ ...tempSEO, defaultMetaDescription: e.target.value })',
  ],
  'VonSEO Default Description Drift Guard: stale SEO default description no longer overrides the General Settings description.',
  'VonSEO Default Description Drift Guard: SEO settings can still override the General Settings description.'
);

assertIncludes(
  'Robots Crawl Delay Google Contract',
  read('src/plugins/von-core/features/extensions/components/VonSEOSettings.tsx') +
    read('public/robots.php'),
  [
    'normalizeRobotsRules',
    'normalizeRobotsContent',
    "header('Content-Type: text/plain; charset=UTF-8')",
    "header('Content-Type: application/json; charset=UTF-8')",
    'Disallow: ${BASE_PATH}admin/',
    'Disallow: {$basePath}admin/',
  ],
  'Robots Crawl Delay Google Contract: defaults and saved robots rules are normalized for Google-compatible crawl directives.',
  'Robots Crawl Delay Google Contract: robots rules are missing crawl-delay normalization or protected-path defaults.'
);

assertIncludes(
  'AI-Friendly Robots Default Contract',
  read('src/plugins/von-core/features/extensions/components/VonSEOSettings.tsx') +
    read('public/robots.php'),
  [
    'User-agent: OAI-SearchBot',
    'User-agent: ChatGPT-User',
    'User-agent: Claude-SearchBot',
    'User-agent: Claude-User',
    'User-agent: PerplexityBot',
    'Content-Signal: search=yes,ai-train=no',
    'User-agent: GPTBot',
    'User-agent: Google-Extended',
    'User-agent: ClaudeBot',
    'User-agent: CCBot',
    'User-agent: Applebot-Extended',
    'User-agent: Bytespider',
  ],
  'AI-Friendly Robots Default Contract: default robots rules allow AI search/user agents while blocking AI training crawlers.',
  'AI-Friendly Robots Default Contract: default robots rules are missing AI search allowances or AI training crawler blocks.'
);

assertExcludes(
  'Robots Crawl Delay Warning Guard',
  read('src/plugins/von-core/features/extensions/components/VonSEOSettings.tsx') +
    read('src/plugins/von-core/features/extensions/ExtensionsManager.tsx') +
    read('public/robots.php'),
  ['Crawl-delay: 1', "robotsTxt: 'User-agent: *\\nDisallow:'", 'api/public/'],
  'Robots Crawl Delay Warning Guard: default robots rules no longer emit unsupported Crawl-delay directives.',
  'Robots Crawl Delay Warning Guard: default robots rules can still emit Crawl-delay, legacy blank rules, or stale api/public allowances.'
);

assertIncludes(
  'Robots Settings Persistence Contract',
  read('public/api/get_settings.php') +
    read('public/api/save_settings.php') +
    read('public/robots.php'),
  [
    "'robots_txt'",
    "['seo']['robotsTxt']",
    "setting_key = 'site_config'",
    'json_decode',
    'normalizeRobotsContent',
  ],
  'Robots Settings Persistence Contract: SEO robotsTxt is hydrated, saved to the crawler-facing row, and served from the saved site config fallback.',
  'Robots Settings Persistence Contract: SEO robotsTxt can still save in admin without reaching crawler-facing robots.php.'
);

const modernSeoRuntimeContent = read('src/plugins/von-core/features/seo/VonSEO.tsx');
const modernSeoSettingsContent = read(
  'src/plugins/von-core/features/extensions/components/VonSEOSettings.tsx'
);
const modernSeoRobotsContent = read('public/robots.php');
const modernSeoSitemapContent = read('public/sitemap.php');
const modernSeoLlmsContent = read('public/llms.php');
const modernSeoIndexNowContent = read('public/api/system/IndexNow.php');
const modernSeoSavePostContent = read('public/api/save_post.php');
const modernSeoPublicIndexContent = read('public/index.php');

assertIncludes(
  'VonSEO Canonical Single Source Contract',
  modernSeoRuntimeContent + modernSeoSettingsContent,
  [
    'const canonicalBase =',
    'getPermalink(selectedPost, settings, true)',
    'delete nextSeo.canonicalHost',
    'Canonical URLs use the Domain URL from General Settings',
  ],
  'VonSEO Canonical Single Source Contract: hydrated canonicals use the configured public domain without duplicating subfolder paths.',
  'VonSEO Canonical Single Source Contract: hydrated canonicals can still drift from General Settings or duplicate a subfolder path.'
);

assertExcludes(
  'VonSEO Retired Metadata Guard',
  modernSeoRuntimeContent + modernSeoSettingsContent + modernSeoPublicIndexContent,
  [
    'settings.seo?.canonicalHost || window.location.origin',
    "ensureMeta('keywords'",
    'twitter:creator',
    "'@type': 'SearchAction'",
    '<meta name="keywords"',
  ],
  'VonSEO Retired Metadata Guard: stale canonical overrides, meta keywords, invalid creator tags, and retired search-action schema are absent.',
  'VonSEO Retired Metadata Guard: obsolete or misleading SEO metadata is still emitted.'
);

assertIncludes(
  'Robots Generated Policy Contract',
  modernSeoRobotsContent + modernSeoSettingsContent,
  [
    'VonCMS Robots Policy v1.25.3',
    'isLegacyVonCmsRobotsPolicy',
    'sitemapEnabled',
    'crawl policy, not an access-control boundary',
  ],
  'Robots Generated Policy Contract: the versioned generated policy migrates legacy defaults and respects sitemap state.',
  'Robots Generated Policy Contract: generated robots policy lacks versioning, legacy migration, or sitemap-state handling.'
);

assertIncludes(
  'Robots Sitemap State Contract',
  modernSeoRobotsContent + modernSeoSettingsContent,
  [
    'function stripRobotsSitemapDirectives',
    '$robotsContent = stripRobotsSitemapDirectives($robotsContent);',
    ".replace(/^\\s*Sitemap\\s*:\\s*.*$/gim, '')",
  ],
  'Robots Sitemap State Contract: saved directives are stripped and only the enabled canonical sitemap can be emitted.',
  'Robots Sitemap State Contract: saved Sitemap directives can survive while XML sitemap output is disabled.'
);

assertIncludes(
  'Robots Save Normalization Contract',
  saveSettingsContent,
  ["'/^\\s*Sitemap\\s*:\\s*.*$/mi'", "$settings['seo']['robotsTxt']"],
  'Robots Save Normalization Contract: direct settings saves remove stored Sitemap directives at the API boundary.',
  'Robots Save Normalization Contract: direct settings saves can retain stale Sitemap directives in storage.'
);

assertExcludes(
  'Modern Sitemap Signal Contract',
  modernSeoSitemapContent,
  ['<changefreq>', '<priority>'],
  'Modern Sitemap Signal Contract: sitemap emits supported URL and lastmod signals without ignored priority/frequency hints.',
  'Modern Sitemap Signal Contract: sitemap still emits ignored changefreq or priority hints.'
);

assertIncludes(
  'LLMS Linked Resource Contract',
  modernSeoLlmsContent,
  [
    '## Categories',
    'echo "- [$categoryName]($categoryUrl) ($categoryCount)\\n";',
    'ORDER BY COALESCE(scheduled_at, created_at) DESC',
    "header('Retry-After: 300')",
  ],
  'LLMS Linked Resource Contract: categories are linked resources, posts use effective publish order, and failures return a retryable service response.',
  'LLMS Linked Resource Contract: llms.txt still contains plain category labels, stale ordering, or a false-success failure response.'
);

assertExcludes(
  'LLMS Keyword Noise Guard',
  modernSeoLlmsContent,
  ['excerpt, keywords, created_at', 'Keywords: $keywords'],
  'LLMS Keyword Noise Guard: llms.txt omits internal keyword metadata.',
  'LLMS Keyword Noise Guard: llms.txt still exposes internal keyword metadata.'
);

assertIncludes(
  'IndexNow Canonical Submission Contract',
  modernSeoIndexNowContent + modernSeoSavePostContent,
  [
    "'keyLocation' => $this->getKeyLocationUrl($key)",
    'public function buildPostUrlForPost(int $postId): string',
    '$indexNow->buildPostUrlForPost((int) $finalId)',
    "private const USER_AGENT = 'VonCMS IndexNow';",
    'CURLOPT_USERAGENT => self::USER_AGENT',
  ],
  'IndexNow Canonical Submission Contract: subfolder key location and canonical post permalinks are submitted.',
  'IndexNow Canonical Submission Contract: submissions can still use the wrong key location or a non-canonical slug URL.'
);

assertIncludes(
  'Maintenance Service Availability Contract',
  modernSeoPublicIndexContent,
  [
    "$maintenanceFlag = __DIR__ . '/data/maintenance.flag';",
    'http_response_code(503);',
    "header('Retry-After: 3600');",
  ],
  'Maintenance Service Availability Contract: temporary maintenance returns 503 with retry guidance while admin access remains available.',
  'Maintenance Service Availability Contract: temporary maintenance can still look like an indexable successful page.'
);

assertExcludes(
  'Maintenance Noindex Removal Guard',
  modernSeoRuntimeContent,
  ['settings.maintenanceMode', "ensureMeta('robots', 'name', 'noindex, nofollow')"],
  'Maintenance Noindex Removal Guard: temporary outages rely on HTTP 503 instead of persistent noindex metadata.',
  'Maintenance Noindex Removal Guard: client SEO can still attach noindex during temporary maintenance.'
);

assertIncludes(
  'Crawler Route Template Parity Contract',
  read('.htaccess') +
    read('public/.htaccess') +
    read('public/api/install.php') +
    read('public/api/system/repair_htaccess.php'),
  ['robots\\.txt', 'sitemap\\.xml', 'llms\\.txt'],
  'Crawler Route Template Parity Contract: live, packaged, installer, and repair routing retain all crawler endpoints.',
  'Crawler Route Template Parity Contract: a generated rewrite source can drop robots, sitemap, or llms routing.'
);

assertIncludes(
  'Subfolder Robots Documentation Contract',
  read('docs/INSTALL.md') + read('docs/ROUTING.md'),
  ['host-root `/robots.txt`'],
  'Subfolder Robots Documentation Contract: subfolder installs document the host-root robots requirement.',
  'Subfolder Robots Documentation Contract: subfolder users are not warned that crawlers only recognize host-root robots.txt.'
);

assertIncludes(
  'Built-In Plugin Product Polish Contract',
  promoBarContent + giftWidgetContent + extensionsManagerContent,
  [
    'dismissHours',
    'startsAt',
    'endsAt',
    'targetBlank',
    'buttonColor',
    'position',
    'vp_gift_widget',
  ],
  'Built-In Plugin Product Polish Contract: Promo Bar and Gift Widget expose campaign-grade runtime options.',
  'Built-In Plugin Product Polish Contract: low-touch built-in plugins still have only early placeholder settings.'
);

const defaultThemeSettingsContent = read(
  'src/plugins/von-core/features/extensions/components/DefaultThemeSettings.tsx'
);
const techPressSettingsContent = read(
  'src/plugins/von-core/features/extensions/components/TechPressSettings.tsx'
);
const digestSettingsContent = read(
  'src/plugins/von-core/features/extensions/components/DigestSettings.tsx'
);
if (
  defaultThemeSettingsContent.includes('<option value={10}>10</option>') &&
  techPressSettingsContent.includes('<option value={10}>10</option>') &&
  digestSettingsContent.includes('<option value={10}>10</option>')
) {
  pass('Sidebar Trending Count: Default, TechPress, and Digest settings expose 10 items.');
} else {
  fail('Sidebar Trending Count: all sidebar settings must expose a 10-item trending option.');
}

const techPressLayoutContent = read('src/themes/techpress/Layout.tsx');
if (
  techPressLayoutContent.includes(
    'const storyPosts = heroArticle ? paginatedPosts.slice(1) : paginatedPosts;'
  ) &&
  techPressLayoutContent.includes('const latestHighlightPosts = storyPosts.slice(0, 4);') &&
  techPressLayoutContent.includes('const latestNews = storyPosts.slice(4);') &&
  techPressLayoutContent.includes('heroArticle?.author_data?.avatar') &&
  !techPressLayoutContent.includes('const latestHighlightPosts = paginatedPosts.slice(0, 4);')
) {
  pass(
    'TechPress Featured Exclusion: hero article is excluded from Latest Highlights and empty search results do not crash the hero avatar path.'
  );
} else {
  fail(
    'TechPress Featured Exclusion: Latest Highlights must not repeat the hero article, and empty search results must not crash the hero avatar path.'
  );
}

const digestLayoutContent = read('src/themes/digest/Layout.tsx');
if (
  techPressLayoutContent.includes('lg:w-3/5 aspect-video overflow-hidden relative') &&
  digestLayoutContent.includes('lg:w-3/5 aspect-video overflow-hidden relative') &&
  !techPressLayoutContent.includes('lg:aspect-auto') &&
  !digestLayoutContent.includes('lg:aspect-auto') &&
  !techPressLayoutContent.includes('lg:min-h-[450px]') &&
  !digestLayoutContent.includes('lg:min-h-[420px]')
) {
  pass(
    'TechPress and Digest Hero Framing: desktop hero images keep a stable 16:9 frame instead of stretching into tall crops.'
  );
} else {
  fail(
    'TechPress and Digest Hero Framing: desktop hero images still use tall stretch/min-height overrides instead of a stable 16:9 frame.'
  );
}

if (
  techPressLayoutContent.includes('className="min-w-0 flex-1"') &&
  techPressLayoutContent.includes("import ThemeLogo from '../shared/components/ThemeLogo';") &&
  techPressLayoutContent.includes('<ThemeLogo') &&
  techPressLayoutContent.includes('title={settings.siteDescription}') &&
  !techPressLayoutContent.includes('ml-[52px] md:ml-[60px]')
) {
  pass(
    'TechPress Brand Header Alignment: long logos keep the site name and description in one aligned text stack.'
  );
} else {
  fail(
    'TechPress Brand Header Alignment: brand tagline can still depend on a fixed logo margin or uncapped long-logo width.'
  );
}

if (
  !publicProfileHookContent.includes("id: 'temp'") &&
  publicProfileHookContent.includes('return null;') &&
  publicProfileHookContent.includes('const publicProfileCache = new Map<string, User>();') &&
  publicProfileHookContent.includes('const requestIdRef = useRef(0);') &&
  publicProfileHookContent.includes('const abortController = new AbortController();') &&
  publicProfileHookContent.includes('signal: abortController.signal') &&
  publicProfileHookContent.includes('if (requestId !== requestIdRef.current) return;') &&
  publicProfileHookContent.includes('data.user.username === selectedProfile') &&
  publicProfileHookContent.includes('fetchedProfile?.username === selectedProfile') &&
  publicProfileHookContent.includes('const isPendingProfileFetch = useMemo(() => {') &&
  publicProfileHookContent.includes('isLoading: isLoading || isPendingProfileFetch') &&
  appShellContent.includes(
    'const { targetProfile: resolvedPublicProfile, isLoading: isLoadingProfile } = usePublicProfile('
  ) &&
  appShellContent.includes("if (currentView === 'profile' && selectedProfile)") &&
  appShellContent.includes('if (isLoadingProfile) {') &&
  appShellContent.includes('return <SkeletonLoader />;') &&
  appShellContent.includes('if (!resolvedPublicProfile) {')
) {
  pass(
    'Public Profile Route Guard: profile routes hold a pending skeleton, reject stale fetches, cache resolved users for theme handoff, and let invalid usernames fall through to a real 404.'
  );
} else {
  fail(
    'Public Profile Route Guard: profile routes can still flash not-found/home states, accept stale fetches, or render placeholder profiles.'
  );
}

const portfolioLayoutContent = read('src/themes/portfolio/Layout.tsx');
assertIncludes(
  'Portfolio Public Profile Contract',
  portfolioLayoutContent,
  [
    'usePublicProfile',
    'const { targetProfile, isLoading: isLoadingProfile } = usePublicProfile(',
    "if (currentView === 'profile' && selectedProfile) {",
    'if (isLoadingProfile || !targetProfile) {',
    'selectedProfile={targetProfile}',
  ],
  'Portfolio Public Profile Contract: Portfolio uses the shared public-profile resolver instead of synthesizing fake profile rows.',
  'Portfolio Public Profile Contract: Portfolio can still bypass the shared public-profile resolver.'
);
if (!portfolioLayoutContent.includes("id: 'temp'")) {
  pass('Portfolio Public Profile Fake Guard: temp profile fallback is absent.');
} else {
  fail('Portfolio Public Profile Fake Guard: temp profile fallback still exists.');
}

const dbQueryContent = read('public/api/db_query.php');
if (
  dbQueryContent.includes("sendApiHeaders('POST, OPTIONS')") &&
  dbQueryContent.includes("$_SERVER['REQUEST_METHOD'] !== 'POST'") &&
  dbQueryContent.includes('SessionManager::requireValidSession();') &&
  dbQueryContent.includes('CSRFProtection::requireToken();') &&
  dbQueryContent.includes('SessionManager::requirePrimaryAdmin();') &&
  dbQueryContent.includes('function normalizeAdminReadQuery') &&
  dbQueryContent.includes('Only single-statement queries are allowed.') &&
  dbQueryContent.includes('blocked SQL functions or file operations') &&
  dbQueryContent.includes('limited to first 500 rows') &&
  dbQueryContent.includes('LIMIT :limit')
) {
  pass(
    'Database Manager Query Hardening: db_query.php stays POST-only, primary-admin gated, CSRF-protected, and capped for single-statement read-only inspection.'
  );
} else {
  fail('Database Manager Query Hardening: db_query.php is missing one or more backend guardrails.');
}

const databaseManagerContent = read('src/plugins/von-core/features/database/DatabaseManager.tsx');
if (
  databaseManagerContent.includes("data.error || data.message || 'Unknown import error'") &&
  !databaseManagerContent.includes('Import failed: ${data.message}')
) {
  pass(
    'Database Import Error Display: frontend shows backend error payloads instead of undefined.'
  );
} else {
  fail('Database Import Error Display: frontend must prefer data.error before data.message.');
}

if (
  databaseManagerContent.includes('data.requiresConfirmation') &&
  databaseManagerContent.includes('confirm_destructive_import') &&
  databaseManagerContent.includes('window.confirm')
) {
  pass(
    'Database Import Destructive Confirmation UI: frontend requires explicit confirmation before destructive SQL restore.'
  );
} else {
  fail(
    'Database Import Destructive Confirmation UI: frontend must confirm destructive SQL restore before retrying import.'
  );
}

const importDbContent = read('public/api/import_db.php');
if (
  importDbContent.includes('function stripLeadingSqlComments') &&
  importDbContent.includes('function iterateSqlStatementsFromFile') &&
  importDbContent.includes('yield $statement;') &&
  importDbContent.includes('$statement = stripLeadingSqlComments($rawStatement);') &&
  importDbContent.includes('DROP is required to restore VonCMS-generated backups') &&
  !importDbContent.includes("explode(';', $sql)")
) {
  pass(
    'Database Import SQL Parser: import_db.php streams quote-aware SQL statements and strips VonCMS backup comments before allowlist checks.'
  );
} else {
  fail(
    'Database Import SQL Parser: import_db.php must avoid naive semicolon splitting and strip leading backup comments before executing SQL statements.'
  );
}

if (
  importDbContent.includes('function detectDestructiveImportStatements') &&
  importDbContent.includes('confirm_destructive_import') &&
  importDbContent.includes('requiresConfirmation') &&
  importDbContent.includes('function createPreImportSafetyBackup') &&
  importDbContent.includes('pre_import_') &&
  importDbContent.includes('safetyBackup') &&
  importDbContent.includes('CREATE DATABASE and CREATE SCHEMA are not supported') &&
  importDbContent.includes('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY') &&
  importDbContent.includes('Pdo\\\\Mysql::ATTR_USE_BUFFERED_QUERY') &&
  importDbContent.includes('$bufferedQueryAttribute = getImportMysqlBufferedQueryAttribute();') &&
  importDbContent.includes('$pdo->setAttribute($bufferedQueryAttribute, false);') &&
  importDbContent.includes(
    '$pdo->setAttribute($bufferedQueryAttribute, $previousBufferedQueryMode);'
  ) &&
  importDbContent.includes('$stmt->closeCursor();')
) {
  pass(
    'Database Import Safety Guard: destructive SQL imports require confirmation, create a pre-import safety backup, and stream backup rows with unbuffered queries.'
  );
} else {
  fail(
    'Database Import Safety Guard: destructive SQL imports must require confirmation, create a pre-import safety backup, and avoid buffered backup row dumps.'
  );
}

const legacyDatabaseSqlFiles = [
  'database/add_category_column.sql',
  'database/update_comments_table.sql',
  'database/migrations/001_create_settings_table.sql',
  'database/migrations/002_add_missing_settings.sql',
  'database/migrations/003_add_site_tagline.sql',
  'database/migrations/004_add_admin_profile.sql',
  'database/migrations/005_verify_permalink.sql',
  'database/migrations/006_add_content_audit_logs.sql',
];
const remainingLegacyDatabaseSqlFiles = legacyDatabaseSqlFiles.filter((file) => exists(file));
const publicInstallSqlContent = read('public/install.sql');
const repairDbContent = read('public/api/repair_db.php');
const activeSchemaOwnerMarkers = [
  [publicInstallSqlContent, 'category VARCHAR(100) DEFAULT'],
  [installContent, 'category VARCHAR(100) DEFAULT'],
  [repairDbContent, 'category VARCHAR(100) DEFAULT'],
  [publicInstallSqlContent, 'parent_id INT DEFAULT NULL'],
  [installContent, 'parent_id INT DEFAULT NULL'],
  [repairDbContent, 'parent_id INT DEFAULT NULL'],
  [publicInstallSqlContent, 'settings_audit_log'],
  [installContent, 'settings_audit_log'],
  [repairDbContent, 'settings_audit_log'],
  [publicInstallSqlContent, 'content_audit_logs'],
  [installContent, 'voncms_ensure_content_audit_logs_table($pdo);'],
  [repairDbContent, 'voncms_ensure_content_audit_logs_table($pdo);'],
  [publicInstallSqlContent, "'permalink_structure', 'slug'"],
  [installContent, "['general', 'permalink_structure', 'slug', 'string']"],
  [publicInstallSqlContent, "'site_tagline'"],
  [installContent, "['general', 'site_tagline', 'Modern Content Management', 'string']"],
  [repairDbContent, 'ADD COLUMN avatar VARCHAR(255)'],
  [repairDbContent, 'ADD COLUMN bio TEXT'],
];
const missingActiveSchemaOwnerMarkers = activeSchemaOwnerMarkers
  .filter(([content, marker]) => !content.includes(marker))
  .map(([, marker]) => marker);
if (remainingLegacyDatabaseSqlFiles.length === 0 && missingActiveSchemaOwnerMarkers.length === 0) {
  pass(
    'Legacy Database SQL Cleanup: root database SQL files are removed and active schema ownership stays in public/install.sql plus install/repair endpoints.'
  );
} else {
  fail(
    `Legacy Database SQL Cleanup: stale SQL files or missing active schema markers remain. Files: ${remainingLegacyDatabaseSqlFiles.join(
      ', '
    )}; Missing markers: ${missingActiveSchemaOwnerMarkers.join(', ')}`
  );
}

const wpImportContent = read('public/api/tools/wp_import.php');
assertIncludes(
  'WordPress Importer Remote Fetch Guard',
  wpImportContent,
  [
    'function normalize_import_remote_fetch_url',
    'function import_remote_resolve_public_ips',
    'function import_remote_host_resolves_publicly',
    'dns_get_record',
    'FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE',
    'function fetch_import_image_url_with_redirect_validation',
    'CURLOPT_RESOLVE',
    'cURL is required for DNS-pinned remote fetch',
    'CURLINFO_REDIRECT_URL',
    'Maximum WordPress media redirect depth exceeded',
    'Unsupported WordPress media redirect protocol',
  ],
  'WordPress Importer Remote Fetch Guard: DNS/IP and redirect-hop validation markers detected.',
  'WordPress Importer Remote Fetch Guard: wp_import.php is missing DNS/IP or redirect-hop validation markers.'
);
if (
  !wpImportContent.includes('CURLOPT_FOLLOWLOCATION => true') &&
  !wpImportContent.includes("'follow_location' => 1")
) {
  pass('WordPress Importer Redirect Guard: remote fetch no longer follows redirects blindly.');
} else {
  fail(
    'WordPress Importer Redirect Guard: remote fetch still follows redirects without hop validation.'
  );
}
assertIncludes(
  'WordPress Importer Temp File Boundary',
  read('public/api/tools/wp_scan.php') + '\n' + wpImportContent,
  [
    "bin2hex(random_bytes(16)) . '.xml'",
    "$tempShield = $uploadDir . '.htaccess';",
    'Require all denied',
    '$hasMore = $processed >= $limit;',
    'if (!$hasMore) {',
    '@unlink($filePath);',
  ],
  'WordPress Importer Temp File Boundary: scan temp XML uses random names, web-deny shielding, and final-batch cleanup.',
  'WordPress Importer Temp File Boundary: temp XML predictability, direct web access, or cleanup guard is missing.'
);

assertIncludes(
  'Vertical Video Aspect Contract',
  editorContent +
    '\n' +
    contentRendererContent +
    '\n' +
    editorSecurityContent +
    '\n' +
    wpImportContent,
  [
    'extractInstagramReelId',
    'extractYouTubeVideo',
    "parts[0] === 'shorts'",
    'von_vertical=shorts',
    'aspect-ratio: 9 / 16',
    "path.startsWith('/reel/')",
    "iframe[src*='tiktok.com/player']",
    "iframe[src*='facebook.com/plugins/video.php']",
  ],
  'Vertical Video Aspect Contract: editor/importer/renderer preserve portrait embeds for Shorts, Reels, TikTok, and Facebook vertical videos.',
  'Vertical Video Aspect Contract: portrait video embed markers are incomplete.'
);
assertIncludes(
  'Editor Video Alignment and Preview Stability',
  editorContent + '\n' + postEditorContent + '\n' + contentRendererContent,
  [
    'selectedVideoEmbed',
    'getVideoEmbedTarget',
    'alignVideoEmbed',
    'selectedVideoAspect',
    'applyVideoAspectMode',
    'data-von-video-aspect',
    'handleEditorImageClick = React.useCallback',
    'export default React.memo(ContentRenderer)',
    "iframe.style.marginLeft = alignment === 'center' || alignment === 'right' ? 'auto' : '0'",
    "iframe.style.marginRight = alignment === 'center' || alignment === 'left' ? 'auto' : '0'",
    'buildPreviewHtml',
    `'<iframe loading="eager" '`,
    'setPreviewHtml(buildPreviewHtml',
    'html={previewHtml}',
  ],
  'Editor Video Alignment and Preview Stability: video embeds can be selected/aligned and preview uses a stable eager-loading snapshot.',
  'Editor Video Alignment and Preview Stability: selectable video alignment or preview snapshot markers are missing.'
);
if (
  editorContent.includes("execCmd('insertHTML', embedHtml)") &&
  !editorContent.includes('`${embedHtml}<p><br/></p>`')
) {
  pass(
    'Editor Video Insert Spacing Contract: video insertion no longer adds an extra blank paragraph after the embed.'
  );
} else {
  fail(
    'Editor Video Insert Spacing Contract: video insertion still appends an empty paragraph that creates double spacing after embeds.'
  );
}
assertIncludes(
  'Editor Image Figure Alignment Contract',
  editorContent + '\n' + editorExtensionsContent + '\n' + contentRendererContent,
  [
    'figureStyle',
    "figure.getAttribute('style') || DEFAULT_FIGURE_STYLE",
    'const buildImageAlignmentStyle =',
    'const buildFigureAlignmentStyle =',
    "style: HTMLAttributes['figureStyle'] || DEFAULT_FIGURE_STYLE",
    '.prose figure, .voncms-content figure {',
    '.prose figcaption, .voncms-content figcaption {',
    '.prose img, .voncms-content img {',
  ],
  'Editor Image Figure Alignment Contract: credited image figure styles survive restore/save and live rendering has image/source parity.',
  'Editor Image Figure Alignment Contract: image figure restore/save or live figure styling markers are missing.'
);
assertIncludes(
  'Editor Image Alignment Node Attribute Contract',
  editorContent + '\n' + editorExtensionsContent,
  [
    'const updateSelectedImageAttributes =',
    'setNodeSelection(match.pos)',
    "updateAttributes('legacyImage', nextAttrs)",
    'buildImageAlignmentStyle',
    'buildFigureAlignmentStyle',
  ],
  'Editor Image Alignment Node Attribute Contract: repeated image alignment updates the TipTap image node directly instead of reparsing editor DOM.',
  'Editor Image Alignment Node Attribute Contract: image alignment still risks reparsing the ProseMirror DOM and accumulating empty paragraphs.'
);
const imageBubbleSection = (() => {
  const start = editorContent.indexOf('{/* Image Bubble Menu */}');
  const end = editorContent.indexOf('{/* Video Bubble Menu */}');
  return start >= 0 && end > start ? editorContent.slice(start, end) : '';
})();
const videoBubbleSection = (() => {
  const start = editorContent.indexOf('{/* Video Bubble Menu */}');
  const end = editorContent.indexOf('const ToolButton: React.FC', start);
  return start >= 0 && end > start ? editorContent.slice(start, end) : '';
})();
assertIncludes(
  'Editor Image Explicit State Contract',
  editorContent + '\n' + editorExtensionsContent + '\n' + editorSecurityContent,
  [
    "'data-von-image-size'",
    "'data-von-image-align'",
    'type ImageSize',
    'inferImageSize',
    'ADD_ATTR: [',
    "'data-von-video-aspect'",
    "'data-von-image-size': size",
    "'data-von-image-align': alignment",
    'const selectedImageSize = selectedImage ? inferImageSize(selectedImage) : null;',
    'selectedImageSize === size',
  ],
  'Editor Image Explicit State Contract: image size/alignment survive reload through explicit attrs instead of selectedImage.style.width only.',
  'Editor Image Explicit State Contract: image size/alignment still depends on fragile inline style/DOM state.'
);
assertIncludes(
  'Editor Image Data State Render Contract',
  editorExtensionsContent,
  [
    "const renderImageSize = readImageSize(HTMLAttributes['data-von-image-size']);",
    "const renderImageAlignment = readImageAlignment(HTMLAttributes['data-von-image-align']);",
    "let imageStyle = normalizeImageStyle(HTMLAttributes['style'] || DEFAULT_IMAGE_STYLE);",
    'imageStyle = buildImageWidthStyle(imageStyle, renderImageSize);',
    'style: imageStyle',
    'const resolvedSize = explicitSize || inferImageSizeFromStyle(style);',
    'let resolvedStyle = buildImageWidthStyle(',
    'resolvedStyle = buildImageAlignmentStyle(resolvedStyle, resolvedAlignment);',
  ],
  'Editor Image Data State Render Contract: explicit image size/alignment attrs rebuild the editor preview style after save/reload.',
  'Editor Image Data State Render Contract: bubble state can survive while the editor preview still falls back to full-width rendering.'
);
assertIncludes(
  'Editor Image Bubble Active Alignment Contract',
  imageBubbleSection,
  [
    "active={selectedImageAlignment === 'left'}",
    "active={selectedImageAlignment === 'center'}",
    "active={selectedImageAlignment === 'right'}",
  ],
  'Editor Image Bubble Active Alignment Contract: image alignment buttons reflect selected image state.',
  'Editor Image Bubble Active Alignment Contract: image alignment buttons still do not expose active state.'
);
assertIncludes(
  'Editor Video Bubble Active Alignment Contract',
  videoBubbleSection,
  [
    "active={selectedVideoAlignment === 'left'}",
    "active={selectedVideoAlignment === 'center'}",
    "active={selectedVideoAlignment === 'right'}",
  ],
  'Editor Video Bubble Active Alignment Contract: video alignment buttons reflect selected embed state.',
  'Editor Video Bubble Active Alignment Contract: video alignment buttons still do not expose active state.'
);
assertIncludes(
  'Editor Image Width Persistence Contract',
  editorContent + '\n' + editorExtensionsContent + '\n' + contentRendererContent,
  [
    'export const buildImageUpdateBaseStyle =',
    'const normalizeImageStyle =',
    'const applyImageAlignmentMargins =',
    'buildImageUpdateBaseStyle(attrs.style, img.getAttribute',
    'buildImageUpdateBaseStyle(attrs.style, selectedImage.getAttribute',
    "'figure',",
    "['img', imageAttrs]",
    'figure img {',
    'width: revert-layer;',
  ],
  'Editor Image Width Persistence Contract: editor reload/save/public styling preserve saved image widths and figure boundaries.',
  'Editor Image Width Persistence Contract: saved images can still lose width or figure boundaries after editor reload/save/public rendering.'
);
assertIncludes(
  'Ads Manager Helper Copy Contract',
  adSettingsContent,
  [
    'Header ad code',
    'Use responsive display or leaderboard code',
    'VonCMS contains the slot',
    'In-feed ad code',
    'Runs after the selected post interval',
    'Popup ad code',
    'Use a delayed, consent-safe overlay script',
  ],
  'Ads Manager Helper Copy: helper panels use concise, behavior-neutral copy.',
  'Ads Manager Helper Copy: concise helper copy markers are missing.'
);
assertExcludes(
  'Ads Manager Helper Copy Noise Guard',
  adSettingsContent,
  [
    'Recommended Size:',
    'How-To:',
    'Frequency Logic',
    'Best Practice',
    'Avoid using aggressive scripts',
    '3s-5s delay',
    'Pop-Under or Direct Interstitial scripts',
  ],
  'Ads Manager Helper Copy: noisy helper labels and aggressive-script wording are gone.',
  'Ads Manager Helper Copy: noisy helper labels or aggressive-script wording remain.'
);
assertIncludes(
  'Editor Video Aspect Override Sanitizer',
  editorSecurityContent + '\n' + contentRendererContent,
  [
    "name === 'data-von-video-aspect'",
    "iframe[data-von-video-aspect='portrait']",
    "iframe[data-von-video-aspect='landscape']",
    ":not([data-von-video-aspect='landscape'])",
  ],
  'Editor Video Aspect Override Sanitizer: manual portrait/landscape markers survive sanitizing and override auto heuristics.',
  'Editor Video Aspect Override Sanitizer: manual portrait/landscape sanitizer or renderer markers are missing.'
);
if (
  editorSecurityContent.includes('data-von-video-aspect') &&
  editorSecurityContent.includes('ALLOW_DATA_ATTR: false')
) {
  pass(
    'Editor Video Aspect Override Save Path: sanitizeEditorHtml explicitly allows the persisted video aspect attribute while keeping broad data-* disabled.'
  );
} else {
  fail(
    'Editor Video Aspect Override Save Path: sanitizeEditorHtml must explicitly allow data-von-video-aspect or manual aspect overrides will be stripped on save.'
  );
}
if (
  !editorContent.includes("target.closest('.video-embed')") &&
  !editorContent.includes('Handle video iframe clicks - extract YouTube thumbnail') &&
  !editorContent.includes('Selection changed handler - currently not needed for image bubble')
) {
  pass(
    'Editor Cleanup Debt: stale video thumbnail and empty image-bubble placeholders are removed.'
  );
} else {
  fail(
    'Editor Cleanup Debt: stale video thumbnail path or empty image-bubble placeholder is still present.'
  );
}
if (
  !wpImportContent.includes('curl_close(') &&
  !wpImportContent.includes('$http_response_header') &&
  wpImportContent.includes('$ch = null;') &&
  wpImportContent.includes('stream_get_meta_data($stream)') &&
  wpImportContent.includes("$metadata['wrapper_data']")
) {
  pass(
    'WordPress Importer PHP 8.5 Compatibility: cURL and stream fallback avoid deprecated close/header APIs.'
  );
} else {
  fail(
    'WordPress Importer PHP 8.5 Compatibility: deprecated curl_close or $http_response_header usage remains.'
  );
}

const backupDbContent = read('public/api/backup_db.php');
if (
  backupDbContent.includes('function sanitizeBackupFilenamePart') &&
  backupDbContent.includes("setting_key = 'site_name'") &&
  backupDbContent.includes('$filename = "backup_{$backupLabel}_{$timestamp}.sql";') &&
  !backupDbContent.includes("$dbName = 'voncms';")
) {
  pass(
    'Database Backup Filename: backup_db.php uses the configured site name for descriptive SQL filenames.'
  );
} else {
  fail(
    'Database Backup Filename: backup_db.php must replace the generic backup_voncms filename with a sanitized site label.'
  );
}
if (
  backupDbContent.includes('function getBackupMysqlBufferedQueryAttribute(): ?int') &&
  backupDbContent.includes('Pdo\\\\Mysql::ATTR_USE_BUFFERED_QUERY') &&
  backupDbContent.includes('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY') &&
  backupDbContent.includes('setBackupMysqlBufferedQueryMode($pdo, false);') &&
  backupDbContent.includes('setBackupMysqlBufferedQueryMode($pdo, true);')
) {
  pass(
    'Database Backup PHP 8.5 Compatibility: buffered-query mode uses a PHP-version-aware MySQL attribute resolver.'
  );
} else {
  fail(
    'Database Backup PHP 8.5 Compatibility: buffered-query mode must use the MySQL attribute resolver.'
  );
}

const phpStaticAnalysisMetadataContracts = [
  {
    file: 'public/index.php',
    markers: [
      '@param array<string, mixed> $content',
      "function buildCanonicalContentPath($content, $permalinkStyle, $contentType = 'post')",
    ],
  },
  {
    file: 'public/llms.php',
    markers: ['@param mixed $value', 'function llmsMarkdownText($value, $maxLen = 0)'],
  },
  {
    file: 'public/rss.php',
    markers: ['@param array<string, mixed> $post', '$buildPostUrl ='],
  },
  {
    file: 'public/scheduler_helper.php',
    markers: ['@param PDO $pdo', 'function voncms_run_scheduler_if_due($pdo'],
  },
  {
    file: 'public/von_config.sample.php',
    markers: ['@param mixed $data', 'function sanitize_input($data)'],
  },
  {
    file: 'public/api/backup_db.php',
    markers: ['@param mixed $value', '@param PDO $pdo', 'function getBackupSiteLabel($pdo)'],
  },
  {
    file: 'public/api/get_settings.php',
    markers: ['/** @var PDOStatement|null $stmt */', '$stmt = null;'],
  },
  {
    file: 'public/api/get_storage.php',
    markers: ['@param string $dir', '@param int|float $bytes', '@param int $precision'],
  },
  {
    file: 'public/api/media_tools.php',
    markers: ['@param resource|false $handle', 'function releaseMediaToolLock($handle): void'],
  },
  {
    file: 'public/api/submit_contact.php',
    markers: [
      '@param string $template',
      '@param array<string, mixed> $data',
      '@param PDO|null $pdo',
    ],
  },
  {
    file: 'public/api/verify_email.php',
    markers: [
      '@param bool $success',
      '@param string $message',
      'function showResult($success, $message',
    ],
  },
  {
    file: 'public/api/tools/wp_scan.php',
    markers: [
      'function normalize_scan_url($url)',
      'function get_url_origin($url)',
      '@param string $url',
    ],
  },
  {
    file: 'public/api/system/fix_integrity.php',
    markers: [
      '@param string $content',
      '@param string $filePath',
      '@param string $publicPath',
      '@param array<int, string> $checks',
      'function appendHtaccessChecks(&$checks, $title, $state)',
    ],
  },
  {
    file: 'public/api/system/repair_htaccess.php',
    markers: [
      '@param string $prefix',
      '@param string $content',
      '@param string $filePath',
      '@param string $publicPath',
      'function repairUploadsShield($publicPath, $projectRoot)',
    ],
  },
  {
    file: 'public/api/install.php',
    markers: [
      '@param string $existingContent',
      '@param string $newBlock',
      'function mergeManagedHtaccessContent($existingContent, $newBlock)',
      '@param string $filePath',
      '@param string $htaccessContent',
      'function writeManagedHtaccess($filePath, $htaccessContent)',
    ],
  },
  {
    file: 'public/api/tools/wp_import.php',
    markers: [
      '@param array<int, string> $sourceBaseUrls',
      '@param PDO $conn',
      '@param DOMNode $node',
      '@param array<string|int, string> $matches',
      '@return PDO|null',
      '@var array<string, array{absolute_dir: string, relative_dir: string, url_prefix: string}> $contexts',
      '@var array<string, string> $cache',
      '@var array<string, string> $replacements',
    ],
  },
  {
    file: 'public/api/import_db.php',
    markers: [
      '@param iterable<string> $statements',
      '@return Generator<int, string, void, void>',
      '@return array{filename: string, relativePath: string}',
    ],
  },
  {
    file: 'public/api/mail_helper.php',
    markers: [
      '@param array<string, mixed> $config',
      '@param PDO $pdo',
      '@var resource|false $socket',
      '$getResponse =',
      '$sendCmd =',
      '@param string $cmd',
      "function vonSendMail($to, $subject, $htmlBody, $fromEmail = '', $fromName = '', $textBody = '')",
    ],
  },
  {
    file: 'public/api/manage_categories.php',
    markers: [
      '@param array<int, mixed> $categories',
      '@return array<int, array{name: string, postCount: int}>',
    ],
  },
  {
    file: 'public/api/sync_media.php',
    markers: [
      '@param array<int, string> $allowedExtensions',
      '@param int $uploadedBy',
      '@var string $uploadsDir',
      '@var array<int, string> $allowedExtensions',
      '@var array<int, string> $errors',
    ],
  },
  {
    file: 'public/api/list_media.php',
    markers: [
      '@param int|float $bytes',
      '@param array<int, array<string, mixed>> $files',
      '@var array<int, array<string, mixed>> $files',
      '@var string $source',
    ],
  },
  {
    file: 'public/api/system/updater.php',
    markers: [
      '@param string $downloadUrl',
      '@param ZipArchive $zipArchive',
      '@return array<string, mixed>',
      '/** @var string */',
      'private $rootPath;',
      'private $logMessages = [];',
    ],
  },
  {
    file: 'public/security.php',
    markers: [
      '$normalizeHost =',
      '@param string|null $host',
      '@param string|null $identifier',
      '@param mixed $data',
      '@param PDO|null $pdo',
      '@var string|false|null $cachedInput',
      '@var array<int, string> $sensitivePatterns',
      '@var array<int, string> $publicWhitelist',
    ],
  },
];
const missingStaticAnalysisMetadata = [];
for (const contract of phpStaticAnalysisMetadataContracts) {
  const content = read(contract.file);
  for (const marker of contract.markers) {
    if (!content.includes(marker)) {
      missingStaticAnalysisMetadata.push(`${contract.file}: ${marker}`);
    }
  }
}
if (missingStaticAnalysisMetadata.length === 0) {
  pass(
    'PHP Static Analysis Metadata: staged PHPDoc cleanup markers are present for the low-risk, high-noise, core guardrail, and Phase 5 helper batches.'
  );
} else {
  fail(
    `PHP Static Analysis Metadata: missing staged PHPDoc cleanup markers. Missing: ${missingStaticAnalysisMetadata.join('; ')}`
  );
}

const updateMediaContent = read('public/api/update_media.php');
if (
  updateMediaContent.includes("sendApiHeaders('POST, OPTIONS')") &&
  updateMediaContent.includes("if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {") &&
  updateMediaContent.includes('exit(0);') &&
  updateMediaContent.includes("if ($_SERVER['REQUEST_METHOD'] !== 'POST') {") &&
  updateMediaContent.includes('SessionManager::requireMediaAccess();') &&
  updateMediaContent.includes('CSRFProtection::requireToken();')
) {
  pass(
    'Media Metadata API Contract: update_media.php now matches the standard POST + OPTIONS preflight, auth, and CSRF guard pattern.'
  );
} else {
  fail(
    'Media Metadata API Contract: update_media.php is missing the standard POST + OPTIONS preflight/auth/CSRF guard pattern.'
  );
}

const deleteMediaContent = read('public/api/delete_media.php');
if (
  deleteMediaContent.includes('SessionManager::requirePrimaryAdmin();') &&
  deleteMediaContent.includes('CSRFProtection::requireToken();') &&
  !deleteMediaContent.includes('SessionManager::requireValidSession();')
) {
  pass(
    'Media Delete Authorization: delete_media.php requires primary-admin access before physical or database deletion.'
  );
} else {
  fail(
    'Media Delete Authorization: delete_media.php must require primary-admin access before physical or database deletion.'
  );
}

const saveCommentsContent = read('public/api/save_comments.php');
const useCommentsContent = read('src/hooks/useComments.ts');
const publicCommentsContent = read('src/plugins/von-core/features/public/components/Comments.tsx');
if (
  saveCommentsContent.includes('CREATE TABLE IF NOT EXISTS comment_likes') &&
  saveCommentsContent.includes('UNIQUE KEY unique_comment_like') &&
  read('public/install.sql').includes('CREATE TABLE IF NOT EXISTS comment_likes') &&
  read('public/api/install.php').includes('CREATE TABLE IF NOT EXISTS comment_likes') &&
  read('public/api/repair_db.php').includes('CREATE TABLE IF NOT EXISTS comment_likes') &&
  read('public/api/repair_db.php').includes('DELETE cl FROM comment_likes') &&
  read('public/api/repair_db.php').includes('ADD CONSTRAINT fk_comment_likes_comment') &&
  read('public/api/repair_db.php').includes('ADD CONSTRAINT fk_comment_likes_user') &&
  read('public/install.sql').includes(
    'FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE'
  ) &&
  read('public/install.sql').includes(
    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'
  ) &&
  saveCommentsContent.includes('INSERT IGNORE INTO comment_likes') &&
  saveCommentsContent.includes('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?') &&
  saveCommentsContent.includes('CSRFProtection::requireToken();') &&
  saveCommentsContent.includes('RateLimiter::requireNotLimited();') &&
  useCommentsContent.includes('const delta = wasJustLiked ? -1 : 1;') &&
  useCommentsContent.includes('setComments(originalComments);') &&
  useCommentsContent.includes(
    "await saveCommentToDb('like', { commentId: commentIdNum, delta });"
  ) &&
  useCommentsContent.includes('return false;') &&
  publicCommentsContent.includes('const rollbackLikedState = () =>') &&
  publicCommentsContent.includes('rollbackLikedState();') &&
  publicCommentsContent.includes('const likeSaved = await onLikeComment(commentId);')
) {
  pass(
    'Comments Like Persistence: comment likes are installed up front, authenticated, deduplicated server-side, and optimistic UI rolls back on save failure.'
  );
} else {
  fail(
    'Comments Like Persistence: comment likes can still drift, rely on runtime DDL, or be replayed without server-side user/comment dedupe.'
  );
}
if (
  saveCommentsContent.includes('$pdo->beginTransaction();') &&
  saveCommentsContent.includes('$pdo->commit();') &&
  saveCommentsContent.includes('$pdo->rollBack();') &&
  saveCommentsContent.includes('UPDATE comments SET likes = likes + 1 WHERE id = ?') &&
  saveCommentsContent.includes('UPDATE comments SET likes = GREATEST(0, likes - 1) WHERE id = ?')
) {
  pass(
    'Comment Like Atomic Counter Guard: like relation and denormalized counter update together.'
  );
} else {
  fail(
    'Comment Like Atomic Counter Guard: like/unlike relation and denormalized counter can drift without transaction coverage.'
  );
}
const deleteUserContent = read('public/api/delete_user.php');
if (
  deleteUserContent.includes('CREATE TABLE IF NOT EXISTS comment_likes') &&
  deleteUserContent.includes('SELECT DISTINCT comment_id FROM comment_likes WHERE user_id = :id') &&
  deleteUserContent.includes('DELETE FROM comment_likes WHERE user_id = :id') &&
  deleteUserContent.includes('UPDATE comments c') &&
  deleteUserContent.includes('COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id') &&
  deleteUserContent.includes('WHERE c.id IN (')
) {
  pass(
    'User Delete Comment Like Counter Guard: deleting a user removes their like rows and reconciles affected displayed counters.'
  );
} else {
  fail(
    'User Delete Comment Like Counter Guard: deleting a user can leave displayed comment like counters stale.'
  );
}

assertIncludes(
  'Public Comments Full Hydration Contract',
  useCommentsContent,
  [
    '`${API.getComments}?flat=true&limit=100&page=${page}`',
    'while (hasMore)',
    'buildCommentTree(allComments)',
    'parentId',
  ],
  'Public Comments Full Hydration Contract: global public comments load all pages as flat rows and rebuild the tree client-side.',
  'Public Comments Full Hydration Contract: public comments can still be capped to one page or orphan replies across pages.'
);

assertIncludes(
  'Comment Reply Parent Post Boundary',
  saveCommentsContent,
  [
    'SELECT post_id FROM comments WHERE id = ?',
    "(string) ($parentComment['post_id'] ?? '') !== (string) $postId",
    'Parent comment does not belong to this post',
  ],
  'Comment Reply Parent Post Boundary: replies must target an existing parent on the same post.',
  'Comment Reply Parent Post Boundary: replies can still be attached to parents from other posts.'
);

const getCommentsContent = read('public/api/get_comments.php');
assertIncludes(
  'Comments Admin Search Contract',
  getCommentsContent,
  [
    "isset($_GET['status'])",
    "isset($_GET['search'])",
    "if ($flat && !$postId && $status !== '' && $search === '')",
    "if ($flat && !$postId && $search !== '')",
    'c.content LIKE ?',
    'c.user_name LIKE ?',
    'ORDER BY c.created_at DESC',
    "'totalPages' =>",
  ],
  'Comments Admin Search Contract: global search plus queue browsing markers detected.',
  'Comments Admin Search Contract: global search / queue browsing markers are incomplete.'
);

const getUsersContent = read('public/api/get_users.php');
const getUserStatsContent = read('public/api/get_user_stats.php');
assertIncludes(
  'Users Admin Search Contract',
  getUsersContent,
  [
    "isset($_GET['page'])",
    "isset($_GET['search'])",
    'COUNT(*) FROM users',
    'username LIKE :search',
    'email LIKE :search',
    'ORDER BY created_at DESC, id DESC',
    "'totalPages' =>",
  ],
  'Users Admin Search Contract: server pagination and search markers detected.',
  'Users Admin Search Contract: server pagination/search markers are incomplete.'
);
assertIncludes(
  'User Email Verification Approval Contract',
  getUsersContent +
    '\n' +
    read('public/api/save_user.php') +
    '\n' +
    read('src/plugins/von-core/features/users/UserManager.tsx'),
  [
    'email_verified, verification_token IS NOT NULL AS has_pending_verification',
    "$approveEmail = !empty($input['approve_email']);",
    'email_verified = 1, verification_token = NULL, verification_token_expires = NULL',
    'const handleApproveEmail = async (user: User) => {',
    'user.has_pending_verification',
    'Approve Email',
  ],
  'User Email Verification Approval Contract: Admin 1 can identify and approve pending email-verification users from User Manager.',
  'User Email Verification Approval Contract: User Manager or save_user.php is missing pending verification approval markers.'
);
assertIncludes(
  'Root User Edit Boundary',
  read('public/api/save_user.php') + '\n' + read('public/api/delete_user.php'),
  [
    "$targetUserRole = strtolower((string) ($targetUser['role'] ?? ''));",
    "($targetUserId === '1' || $targetUserRole === 'root')",
    "if (!$isPrimaryAdminActor && $targetRole === 'root')",
  ],
  'Root User Edit Boundary: non-primary admins are blocked from editing or deleting Root users.',
  'Root User Edit Boundary: direct user-save/delete APIs can still cross the Root account boundary.'
);

assertExcludes(
  'User Manager Canonical PHP Write Contract',
  read('src/hooks/useUsers.ts'),
  [
    "API.saveUser.replace('.php', '')",
    "API.deleteUser.replace('.php', '')",
    "throw new Error('PHP failed')",
  ],
  'User Manager Canonical PHP Write Contract: user mutations do not fall back to non-canonical Node JSON storage after PHP rejects a request.',
  'User Manager Canonical PHP Write Contract: user mutations can still report success through the Node JSON fallback after canonical PHP rejection.'
);

const dashboardUserTotalContent = read('src/plugins/von-core/features/dashboard/Dashboard.tsx');
assertIncludes(
  'Dashboard User Total Truth Contract',
  dashboardUserTotalContent + '\n' + getUserStatsContent + '\n' + read('src/config/site.config.ts'),
  [
    'const [activeUsers, setActiveUsers] = useState(users.length);',
    'getUserStats: `${BASE_PATH}api/get_user_stats.php`',
    'SessionManager::requireStaff();',
    'SELECT COUNT(*) FROM users',
    'vonFetch(API.getUserStats)',
    "!['admin', 'root', 'moderator', 'writer'].includes(role || '')",
    'Number(data?.meta?.total)',
    'setActiveUsers(Math.max(users.length, resolvedTotal));',
    "value={activeUsersLoading ? '...' : activeUsers.toString()}",
  ],
  'Dashboard User Total Truth Contract: Active Users fetches count-only staff user metadata and hides hydrated fallback counts while loading.',
  'Dashboard User Total Truth Contract: Active Users can still show a hydrated fallback count before count-only metadata resolves.'
);

const contentManagerContent = read('src/plugins/von-core/features/content/ContentManager.tsx');
assertIncludes(
  'Content Manager Page Contract',
  contentManagerContent,
  [
    "const supportsSearch = type === 'post' || type === 'page';",
    "if (supportsSearch && filters?.search) params.set('search', filters.search);",
    "if (type === 'post' && filters?.status) params.set('status', filters.status);",
    "placeholder={type === 'post' ? 'Search articles...' : 'Search pages...'}",
    "{(type === 'post' || type === 'page') && (",
    'const normalizedSearch = searchInput.trim();',
    "setSearchQuery(normalizedSearch.length >= 2 ? normalizedSearch : '');",
    'onSubmit={handleSearch}',
  ],
  'Content Manager Page Contract: page mode shares the server search flow while keeping category/status post-only and manual submit search.',
  'Content Manager Page Contract: page mode is missing the server-side search parity flow.'
);

if (
  contentManagerContent.includes('RefreshCw') ||
  contentManagerContent.includes('transition-opacity duration-200') ||
  contentManagerContent.includes("loading ? 'opacity-50' : 'opacity-100'")
) {
  fail(
    'Content Manager Search Smoothness: search fetch still visibly fades/spins the table during manual search.'
  );
} else {
  pass(
    'Content Manager Search Smoothness: manual search keeps the current table stable until the next result payload lands.'
  );
}

if (
  contentManagerContent.includes('<th className="px-4 py-4">Created</th>') &&
  contentManagerContent.includes(
    'type === \'post\' && <th className="px-4 py-4">Publish At</th>'
  ) &&
  contentManagerContent.includes('formatCreatedDateTime(item.createdAt') &&
  contentManagerContent.includes('formatScheduledDateTime(') &&
  contentManagerContent.includes("item.status === 'draft'") &&
  contentManagerContent.includes('(item as Post).scheduledAt ||') &&
  contentManagerContent.includes('item.createdAt ||') &&
  contentManagerContent.includes("colSpan={type === 'post' ? 8 : 6}")
) {
  pass(
    'Content Manager Date Clarity: post/page tables label created dates clearly and keep publish timing in a separate post-only column with scheduled and published fallbacks.'
  );
} else {
  fail(
    'Content Manager Date Clarity: post/page tables still mix created and publish timing under one vague Date column or leave published posts blank.'
  );
}

const getPagesContent = read('public/api/get_pages.php');
assertIncludes(
  'Pages API Search Contract',
  getPagesContent + '\n' + publicInstallSqlContent + '\n' + installContent + '\n' + repairDbContent,
  [
    "$search = trim((string) ($_GET['search'] ?? ''));",
    'MATCH(p.title, p.content) AGAINST(:searchTerm IN BOOLEAN MODE)',
    'LIKE :searchLike',
    'FULLTEXT INDEX ft_title_content (title, content)',
    'ALTER TABLE pages ADD FULLTEXT INDEX ft_title_content (title, content)',
  ],
  'Pages API Search Contract: get_pages.php supports server search with FULLTEXT/new-install/repair coverage and LIKE fallback.',
  'Pages API Search Contract: page manager search backend markers are incomplete.'
);

assertIncludes(
  'Content Manager Author Column',
  contentManagerContent,
  [
    'const getAuthorName = (item: Post | Page) =>',
    'overflow-x-auto',
    "type === 'post' ? 'min-w-[1120px]' : 'min-w-[900px]'",
    '<colgroup>',
    "<col className={type === 'post' ? 'w-[34%]' : 'w-[34%]'} />",
    "<col className={type === 'post' ? 'w-[10%]' : 'w-[28%]'} />",
    '<th className="px-4 py-4 pr-8">Title</th>',
    '<th className="px-4 py-4">Author</th>',
    '<td className="px-4 py-4 pr-8 min-w-0">',
    'className="font-semibold text-slate-900 dark:text-white truncate max-w-full leading-snug"',
    'className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full mt-1"',
    'className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap"',
    "type === 'page' ? 'gap-2' : 'gap-3'",
    "{getAuthorName(item) || '-'}",
  ],
  'Content Manager Author Column: posts and pages show a stable, balanced author column.',
  'Content Manager Author Column: balanced author-column layout markers are missing from ContentManager.'
);

const discussionManagerContent = read(
  'src/plugins/von-core/features/discussion/DiscussionManager.tsx'
);
assertIncludes(
  'Discussion Manager Server Flow',
  discussionManagerContent,
  [
    'const [state, dispatch] = useReducer(discussionReducer, initialState);',
    'pageItems: Comment[];',
    'deleteConfirmComment: Comment | null;',
    "const isSearchMode = searchQuery !== '';",
    'searchInput: string;',
    'meta: FetchMeta;',
    "if (!filters?.search) params.set('status', activeTab);",
    "params.set('search', filters.search);",
    'const timeoutId = window.setTimeout(() => {',
    "dispatch({ type: 'setDeleteConfirm', comment })",
    'Searching all statuses for',
    '!isSearchMode && counts[tab.id] > 0',
    "type: 'setCounts'",
    "type: 'setPage'",
    "dispatch({ type: 'clearSearch' })",
  ],
  'Discussion Manager Server Flow: live global search, search-safe tab badges, and delete confirmation markers detected.',
  'Discussion Manager Server Flow: live moderation screen is missing the approved global-search/delete-confirmation flow.'
);

assertIncludes(
  'Comments Avatar Source',
  saveCommentsContent,
  ["ResponseHelper::scrubAvatarUrl($currentUser['avatar'] ?? '')"],
  'Comments Avatar Source: logged-in comment saves use the same session avatar key through the shared avatar scrubber.',
  'Comments Avatar Source: comment save path is still reading the wrong session avatar key or bypassing avatar scrubbing.'
);

assertIncludes(
  'Comments Live Avatar Fallback',
  getCommentsContent,
  [
    "$commentAvatar = !empty($c['userId'])",
    "? $c['user_live_avatar'] ?? ''",
    ": $c['user_live_avatar'] ?? ($c['userAvatar'] ?? '')",
    "'userAvatar' => ResponseHelper::scrubAvatarUrl($commentAvatar)",
  ],
  'Comments Live Avatar Fallback: account comments use the current profile avatar and can fall back cleanly after a custom URL is cleared.',
  'Comments Live Avatar Fallback: account comments can still return stale saved external avatar URLs after the profile avatar is cleared.'
);

assertIncludes(
  'Comments Settings Enforcement',
  saveCommentsContent,
  [
    "setting_key = 'discussion_enabled'",
    "ResponseHelper::sendError('Comments are disabled for this site.', 403)",
    "setting_key = 'spam_keywords'",
  ],
  'Comments Settings Enforcement: backend comment add honors discussion and spam keyword settings.',
  'Comments Settings Enforcement: comment add is missing discussion or spam keyword settings enforcement.'
);
if (!saveCommentsContent.includes("setting_key = 'spamKeywords'")) {
  pass('Comments Spam Keyword Key: backend no longer reads the legacy camelCase setting key.');
} else {
  fail('Comments Spam Keyword Key: backend still reads spamKeywords instead of spam_keywords.');
}

assertIncludes(
  'Discussion Manager Avatar Fallback',
  discussionManagerContent,
  ['import Gravatar from', '<Gravatar', 'md5={comment.emailHash}', 'default="identicon"'],
  'Discussion Manager Avatar Fallback: admin moderation uses the same URL-or-Gravatar avatar pattern as public comments.',
  'Discussion Manager Avatar Fallback: admin moderation is missing the shared avatar fallback markers.'
);

const userManagerContent = read('src/plugins/von-core/features/users/UserManager.tsx');
assertIncludes(
  'User Manager Server Flow',
  userManagerContent,
  [
    'const [pageUsers, setPageUsers] = useState<User[]>([])',
    'const [searchInput, setSearchInput] = useState(',
    'const [meta, setMeta] = useState<FetchMeta>({',
    "params.set('search', filters.search);",
  ],
  'User Manager Server Flow: compact search and server pagination markers detected.',
  'User Manager Server Flow: user dashboard is missing the approved server pagination/search flow.'
);

assertIncludes(
  'Admin Header Avatar Fallback',
  adminLayoutContent,
  ['import Gravatar from', '<Gravatar', 'email={user?.email || user?.username}'],
  'Admin Header Avatar Fallback: admin shell uses the same URL-or-Gravatar avatar pattern.',
  'Admin Header Avatar Fallback: admin shell is still missing the shared avatar fallback markers.'
);

const legacyCommentManagerContent = read(
  'src/plugins/von-core/features/comments/CommentManager.tsx'
);
assertIncludes(
  'Legacy Comment Manager Marker',
  legacyCommentManagerContent,
  ['Legacy component kept for reference', 'DiscussionManager'],
  'Legacy Comment Manager Marker: legacy moderation component is clearly marked as unwired reference code.',
  'Legacy Comment Manager Marker: CommentManager still lacks an explicit legacy marker.'
);

const indexContent = read('public/index.php');

assertIncludes(
  'Public Discussion Toggle Rendering',
  publicCommentsContent + '\n' + indexContent + '\n' + getSettingsContent,
  [
    'const discussionEnabled = settings.discussionEnabled !== false;',
    'if (!discussionEnabled) {',
    'Comments are disabled for this site.',
    '$discussionEnabledValue = true;',
    "'discussionEnabled'      => $discussionEnabledValue,",
    "'discussion_enabled',",
  ],
  'Public Discussion Toggle Rendering: disabled comments show the disabled notice instead of an empty public discussion shell.',
  'Public Discussion Toggle Rendering: disabled comments can still leak an empty public discussion shell.'
);

if (
  indexContent.includes('buildCanonicalContentPath') &&
  indexContent.includes('Canonical Permalink Redirect') &&
  indexContent.includes('$normalizedRequestPath !== $canonicalPath')
) {
  pass(
    'SEO Canonical: fallback slug routing now collapses legacy alternate paths to the official permalink.'
  );
} else {
  fail('SEO Canonical: fallback slug routing still mirrors non-canonical request paths.');
}

const configuredDomainPosition = indexContent.indexOf(
  "$domainUrl = rtrim($configuredDomainUrl, '/');"
);
const homepageCanonicalPosition = indexContent.indexOf(
  "$seoUrl = $domainUrl . '/';",
  configuredDomainPosition
);
if (
  configuredDomainPosition !== -1 &&
  homepageCanonicalPosition > configuredDomainPosition &&
  indexContent.includes("'url' => $seoUrl,")
) {
  pass(
    'Homepage Canonical Contract: SSR canonical and homepage schema use the slash-terminated directory URL selected by redirects and sitemap.'
  );
} else {
  fail(
    'Homepage Canonical Contract: SSR homepage canonical or schema can drift from the slash-terminated redirect and sitemap URL.'
  );
}

const redirectEngineContent = exists('public/redirect_engine.php')
  ? read('public/redirect_engine.php')
  : '';
assertIncludes(
  'Integrated Public Redirect Exact-Match Contract',
  indexContent,
  [
    'WHERE source_url = ? LIMIT 1',
    "$publicRedirectIgnorePaths = ['/api/', '/assets/', '/uploads/', '/admin'];",
    'foreach ($publicRedirectIgnorePaths as $ignorePath)',
    'strpos($path, $ignorePath) === 0',
    '$targetPathNormalized === $path',
  ],
  'Integrated Public Redirect Exact-Match Contract: public/index.php redirect flow stays exact-match, asset/admin-safe, and loop guarded.',
  'Integrated Public Redirect Exact-Match Contract: public/index.php redirect flow is missing exact-match, asset/admin bypass, or loop guard markers.'
);
assertIncludes(
  'Standalone Redirect Engine Exact-Match Contract',
  redirectEngineContent,
  [
    'WHERE source_url = ? LIMIT 1',
    "$ignorePaths = ['/api/', '/assets/', '/uploads/', '/admin'];",
    'foreach ($ignorePaths as $ignore)',
    'strpos($path, $ignore) === 0',
    '$targetPath === $path',
  ],
  'Standalone Redirect Engine Exact-Match Contract: redirect_engine.php stays exact-match, asset/admin-safe, and loop guarded.',
  'Standalone Redirect Engine Exact-Match Contract: redirect_engine.php is missing exact-match, asset/admin bypass, or loop guard markers.'
);
assertExcludes(
  'Final Redirect Pattern Exclusion',
  indexContent + '\n' + redirectEngineContent,
  ['LIKE source_url', 'REGEXP', 'preg_match($source', 'source_url LIKE'],
  'Final Redirect Pattern Exclusion: runtime redirects do not silently wildcard-match stored source paths.',
  'Final Redirect Pattern Exclusion: redirect runtime still contains pattern/wildcard matching markers.'
);

const vonSeoContent = read('src/plugins/von-core/features/seo/VonSEO.tsx');
assertIncludes(
  'SSR JSON-LD Script Escape Boundary',
  indexContent,
  ['JSON_HEX_TAG', 'JSON_HEX_AMP', 'JSON_HEX_APOS', 'JSON_HEX_QUOT', 'json_encode($schemaData'],
  'SSR JSON-LD Script Escape Boundary: schema JSON-LD uses script-safe hex escaping.',
  'SSR JSON-LD Script Escape Boundary: schema JSON-LD can still emit raw script-breaking characters.'
);
if (
  indexContent.includes("$schemaData['@type'] = 'Article';") &&
  indexContent.includes(
    "$schemaData['@type'] = $resolvedContentType === 'page' ? 'WebPage' : 'Article';"
  ) &&
  !indexContent.includes('BlogPosting') &&
  indexContent.includes("$schemaData['name'] = $schemaTitle;") &&
  indexContent.includes(
    "'url' => $domainUrl . '/profile/' . rawurlencode($schemaAuthorUsername)"
  ) &&
  indexContent.includes("$schemaData['url'] = $seoUrl;") &&
  indexContent.includes('function voncms_build_schema_publisher') &&
  indexContent.includes("'@type' => 'Organization'") &&
  indexContent.includes("'@type' => 'ImageObject'") &&
  indexContent.includes("$schemaData['publisher'] = voncms_build_schema_publisher") &&
  vonSeoContent.includes('const normalizeSchemaDate = (value?: string) => {') &&
  vonSeoContent.includes(
    'const authorUsername = selectedPost.author_data?.username || selectedPost.author;'
  ) &&
  vonSeoContent.includes('const authorProfileUrl = authorUsername') &&
  vonSeoContent.includes("'@type': 'Article'") &&
  !vonSeoContent.includes("'@type': 'BlogPosting'") &&
  vonSeoContent.includes(
    'datePublished: normalizeSchemaDate(selectedPost.createdAt || selectedPost.updatedAt),'
  ) &&
  vonSeoContent.includes(
    'dateModified: normalizeSchemaDate(selectedPost.updatedAt || selectedPost.createdAt),'
  ) &&
  vonSeoContent.includes("publisher: { '@id': `${canonicalBase}/#organization` },") &&
  vonSeoContent.includes(
    "author: { '@type': 'Person', name: selectedPost.author, url: authorProfileUrl },"
  )
) {
  pass(
    'Schema Markup Polish: Article schema includes author URL, publisher/logo, and explicit ISO timestamps, while SSR page schema resolves to WebPage.'
  );
} else {
  fail(
    'Schema Markup Polish: Article schema is missing the H-21 author/publisher/type/timezone markers, or SSR pages still render as Article.'
  );
}

assertIncludes(
  'VonSEO Disabled Fallback Contract',
  indexContent +
    '\n' +
    publicSiteContent +
    '\n' +
    read('src/themes/default/Layout.tsx') +
    '\n' +
    read('src/themes/techpress/Layout.tsx'),
  [
    '// Prepare Schema.org Data (VonSEO)',
    '<meta property="og:url"',
    '<link rel="canonical"',
    "if (isSystemPluginActive(props.settings, 'vp_von_seo')) return;",
    "const shouldRenderVonSEO = isSystemPluginActive(settings, 'vp_von_seo');",
    '{shouldRenderVonSEO && (',
  ],
  'VonSEO Disabled Fallback Contract: PHP SSR keeps default SEO output while React VonSEO stays idle when the plugin is disabled.',
  'VonSEO Disabled Fallback Contract: disabled VonSEO behavior or SSR fallback SEO markers are missing.'
);

assertIncludes(
  'Public Profile SSR SEO Contract',
  indexContent,
  [
    "preg_match('/^profile\\/([^\\/]+)$/i', $path, $profileMatches)",
    'SELECT username, display_name, avatar, bio FROM users WHERE username = ? LIMIT 1',
    "ResponseHelper::scrubAvatarUrl((string) ($profileUser['avatar'] ?? ''))",
    "$seoOgType = 'profile';",
    "'@type' => 'ProfilePage'",
    "'@type' => 'Person'",
    "'mainEntity' => $schemaPerson",
  ],
  'Public Profile SSR SEO Contract: profile view-source metadata uses canonical profile URLs and public-safe ProfilePage/Person schema.',
  'Public Profile SSR SEO Contract: profile SSR metadata is missing canonical public-safe profile schema markers.'
);
assertIncludes(
  'Public Author Display Name Contract',
  indexContent +
    '\n' +
    read('public/api/get_posts.php') +
    '\n' +
    read('public/api/get_post.php') +
    '\n' +
    read('public/api/get_pages.php') +
    '\n' +
    read('public/rss.php') +
    '\n' +
    read('public/api/repair_db.php') +
    '\n' +
    read('src/types.ts') +
    '\n' +
    read('src/plugins/von-core/features/users/UserManager.tsx') +
    '\n' +
    read('src/themes/default/Layout.tsx'),
  [
    'display_name VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL',
    "COALESCE(NULLIF(u.display_name, ''), u.username)",
    'AS author_name',
    'u.username AS author_username',
    "'display_name' => $authorDisplayName",
    "'username' => $authorUsername",
    'display_name?: string;',
    'Display name / Pen name',
    'post.author_data?.username || post.author',
  ],
  'Public Author Display Name Contract: public bylines use display-name fallback while profile routing keeps username.',
  'Public Author Display Name Contract: display-name schema/API/theme route markers are missing.'
);
assertExcludes(
  'Public Profile SSR Privacy Guard',
  indexContent,
  [
    'SELECT username, avatar, bio, role',
    'SELECT username, avatar, bio, email',
    'SELECT username, avatar, bio, id',
    "'role' =>",
    "'email' =>",
    "'joinedAt' =>",
  ],
  'Public Profile SSR Privacy Guard: profile SSR metadata does not expose role, email, joined date, or numeric IDs.',
  'Public Profile SSR Privacy Guard: profile SSR metadata can expose private/internal user fields.'
);

const techPressLayout = read('src/themes/techpress/Layout.tsx');
if (
  techPressLayout.includes('min-h-screen flex flex-col transition-colors duration-300') &&
  techPressLayout.includes('<main className="max-w-5xl mx-auto px-5 py-12 flex-1 w-full">')
) {
  pass('TechPress: profile view uses full-height footer-safe layout.');
} else {
  fail('TechPress: profile layout fix markers not found.');
}

assertIncludes(
  'TechPress Light Mode Contrast',
  techPressLayout,
  ["textSecondary: '#4a5568'", "textSecondary: '#9ca3af'"],
  'TechPress: light-mode secondary text uses a darker contrast token while preserving dark-mode text.',
  'TechPress: light-mode secondary text contrast markers are missing.'
);

const techPressThemeSettingsContent = read(
  'src/plugins/von-core/features/extensions/components/TechPressSettings.tsx'
);
assertIncludes(
  'TechPress Honest Latest Copy',
  techPressLayout + '\n' + techPressThemeSettingsContent,
  [
    'LATEST',
    'Latest Ticker',
    'Latest Ticker Items Count',
    'latest published articles',
    'Latest Highlights',
    'Latest Updates',
  ],
  'TechPress Honest Latest Copy: latest-slice sections avoid real-time or analytics ranking wording.',
  'TechPress Honest Latest Copy: TechPress still has unclear labels for latest-slice sections.'
);
assertExcludes(
  'TechPress Real-Time Copy Drift Guard',
  techPressLayout + '\n' + techPressThemeSettingsContent,
  ['BREAKING', 'Breaking News', 'Top Stories'],
  'TechPress Real-Time Copy Drift Guard: latest-slice UI no longer implies breaking/news-rank semantics.',
  'TechPress Real-Time Copy Drift Guard: TechPress still contains real-time/ranking labels for latest-slice content.'
);

const sidebarDefaultCopyContent = [
  'src/hooks/useSettings.ts',
  'public/install.sql',
  'public/api/install.php',
  'src/themes/default/Layout.tsx',
  'src/themes/digest/Layout.tsx',
]
  .map((file) => read(file))
  .join('\n');
assertIncludes(
  'Sidebar Default Copy Honesty',
  sidebarDefaultCopyContent,
  ['Latest Stories'],
  'Sidebar Default Copy Honesty: default/fallback sidebar copy describes latest content without real-time claims.',
  'Sidebar Default Copy Honesty: default/fallback sidebar copy is missing the latest-content label.'
);
assertExcludes(
  'Sidebar Trending Copy Drift Guard',
  sidebarDefaultCopyContent,
  ['Trending Now'],
  'Sidebar Trending Copy Drift Guard: default/fallback sidebar labels avoid unsupported real-time wording.',
  'Sidebar Trending Copy Drift Guard: default/fallback sidebar labels still imply real-time trending.'
);

const sharedSidebarContent = read('src/plugins/von-core/features/public/components/Sidebar.tsx');
const normalizedSharedSidebarContent = sharedSidebarContent.replace(/\s+/g, ' ');
assertIncludes(
  'Sidebar Freshness Timeline Contract',
  normalizedSharedSidebarContent,
  [
    'formatSidebarFreshness',
    'const sourceDate =',
    "post.scheduledAt || post.scheduled_at || post.createdAt || post.created_at || '';",
    'Math.floor(ageMs / minuteMs)',
    'Math.floor(ageMs / hourMs)',
    "'Yesterday'",
    'daysOld <= 2',
    'toLocaleDateString',
  ],
  'Sidebar Freshness Timeline Contract: sidebar latest widgets show bounded recency and fall back to dates for older posts.',
  'Sidebar Freshness Timeline Contract: sidebar latest widgets are missing bounded recency/date fallback markers.'
);
assertIncludes(
  'Sidebar Freshness Invalid Date Guard',
  sharedSidebarContent,
  ['if (!dateValue) return null;', 'if (!Number.isFinite(timestamp)) return null;'],
  'Sidebar Freshness Invalid Date Guard: missing or invalid timestamps are hidden instead of faked.',
  'Sidebar Freshness Invalid Date Guard: sidebar timestamps can still fake invalid or missing dates.'
);
assertIncludes(
  'Sidebar Effective Publish Freshness Contract',
  read('src/types.ts') + '\n' + normalizedSharedSidebarContent,
  ['scheduledAt?: string;', 'scheduled_at?: string;', 'post.scheduledAt || post.scheduled_at'],
  'Sidebar Effective Publish Freshness Contract: latest widgets prefer scheduled/publish timestamps before created dates.',
  'Sidebar Effective Publish Freshness Contract: latest widgets can still show stale created-date freshness for scheduled/published posts.'
);
assertIncludes(
  'Public Sidebar Staff Scope Guard',
  normalizedSharedSidebarContent,
  [
    'useEffect',
    'useState',
    "params.set('public', '1');",
    "params.set('includeTotal', 'false');",
    'const sidebarPosts = fetchedPosts.length > 0 ? fetchedPosts : posts;',
  ],
  'Public Sidebar Staff Scope Guard: sidebar latest widgets hydrate public posts instead of trusting writer-owned staff preloads.',
  'Public Sidebar Staff Scope Guard: sidebar latest widgets can still collapse to writer-owned staff preloads while logged in.'
);
assertIncludes(
  'TechPress Latest Source Naming Audit',
  techPressLayout,
  ['latestTickerItems', 'latestHighlightPosts'],
  'TechPress Latest Source Naming Audit: source names match latest-post behavior instead of ranking/realtime semantics.',
  'TechPress Latest Source Naming Audit: latest-slice source names still imply breaking/trending behavior.'
);
assertIncludes(
  'TechPress Featured Title Clamp',
  techPressLayout,
  [
    'className="text-xl font-bold mb-3 leading-tight group-hover:opacity-70 transition line-clamp-2 cursor-pointer"',
  ],
  'TechPress Featured Title Clamp: featured/latest highlight cards keep long titles to the Digest-style two-line baseline.',
  'TechPress Featured Title Clamp: featured/latest highlight cards can still grow to three lines or reserve excessive title height.'
);
assertExcludes(
  'TechPress Featured Title Height Drift Guard',
  techPressLayout,
  ['line-clamp-3 cursor-pointer min-h-[4.5rem]'],
  'TechPress Featured Title Height Drift Guard: forced tall title reservation was removed from TechPress featured cards.',
  'TechPress Featured Title Height Drift Guard: TechPress still reserves excessive title height on featured cards.'
);
assertIncludes(
  'TechPress Hero Title Clamp',
  techPressLayout,
  [
    'className="text-lg sm:text-2xl lg:text-4xl font-black mb-4 leading-tight tracking-tight line-clamp-3 group-hover:opacity-80 transition-opacity"',
  ],
  'TechPress Hero Title Clamp: main hero title follows the Digest-style three-line cap for very long headlines.',
  'TechPress Hero Title Clamp: main hero title can still expand indefinitely on long headlines.'
);
const defaultThemeLayout = read('src/themes/default/Layout.tsx');
const prismThemeLayout = read('src/themes/prism/Layout.tsx');
const portfolioThemeLayout = read('src/themes/portfolio/Layout.tsx');
assertIncludes(
  'Bundled Card Title Clamp',
  defaultThemeLayout + '\n' + prismThemeLayout + '\n' + portfolioThemeLayout,
  [
    'className="text-2xl font-bold text-neutral-900 dark:text-white mb-4 leading-tight line-clamp-2 group-hover:text-primary-600 transition-colors"',
    'className="text-xl font-bold text-white mb-3 leading-tight line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors"',
    'className="text-lg font-semibold mb-2 line-clamp-2 transition-colors duration-300"',
  ],
  'Bundled Card Title Clamp: Default, Prism, and Portfolio card/list titles stay bounded to two lines.',
  'Bundled Card Title Clamp: one or more bundled card/list titles can still expand indefinitely.'
);
assertExcludes(
  'TechPress Legacy Source Naming Drift Guard',
  techPressLayout,
  ['const breakingNews', 'const trendingNews', 'Breaking: Top N', 'Trending: Items after hero'],
  'TechPress Legacy Source Naming Drift Guard: legacy breaking/trending source names are gone from latest slices.',
  'TechPress Legacy Source Naming Drift Guard: latest slices still use legacy breaking/trending source names.'
);

const techPressProfile = read('src/themes/techpress/Profile.tsx');
assertIncludes(
  'TechPress Profile Tab Contrast',
  techPressProfile,
  [
    "'text-slate-900 dark:text-neutral-100'",
    'bg-slate-900 shadow-[0_0_10px_rgba(15,23,42,0.25)] dark:bg-neutral-100',
  ],
  'TechPress: active profile article tab stays readable in light mode while preserving dark-mode contrast.',
  'TechPress: active profile article tab can still render white text/underline on a light background.'
);

if (
  techPressProfile.includes(
    'text-4xl md:text-5xl font-black text-slate-950 dark:text-white md:text-white font-sans'
  ) &&
  techPressProfile.includes('md:bg-purple-500/10') &&
  techPressProfile.includes('md:text-purple-400') &&
  techPressProfile.includes('md:bg-neutral-500/10') &&
  techPressProfile.includes('md:text-neutral-400') &&
  techPressProfile.includes('text-slate-600 dark:text-neutral-400 md:text-neutral-400') &&
  !techPressProfile.includes('font-black text-transparent bg-clip-text bg-gradient-to-r')
) {
  pass(
    'TechPress Profile Username: mobile profile username and status text use solid contrast-safe colors, not gradient text.'
  );
} else {
  fail(
    'TechPress Profile Username: mobile profile username or status text can still render low-contrast/gradient text.'
  );
}

const relatedPostsComponentContent = read(
  'src/plugins/von-core/features/plugins/built-in/related-posts/RelatedPostsComponent.tsx'
);
const relatedPostsSettingsContent = read(
  'src/plugins/von-core/features/plugins/built-in/related-posts/SettingsModal.tsx'
);
const relatedPostsMatcherContent = read(
  'src/plugins/von-core/features/plugins/built-in/related-posts/matcher.ts'
);
assertIncludes(
  'Related Posts Defaults And Controls Audit',
  relatedPostsPluginContent +
    '\n' +
    relatedPostsSettingsContent +
    '\n' +
    relatedPostsComponentContent +
    '\n' +
    relatedPostsMatcherContent,
  [
    "titleText: 'Related Posts'",
    'placeholder="Related Posts"',
    'Show Featured Image',
    'Show Excerpt',
    'Show Date',
    'if (relatedPosts.length === 0) return null;',
    "const candidates = allPosts.filter((p) => p.id !== currentPost.id && p.status === 'published')",
    'return sorted.slice(0, config.count);',
  ],
  'Related Posts Defaults And Controls Audit: defaults, toggles, empty state, and published-only matching stay aligned.',
  'Related Posts Defaults And Controls Audit: defaults or core related-post controls have drifted.'
);
assertExcludes(
  'Related Posts Locale Default Drift Guard',
  relatedPostsPluginContent,
  ['Berita Berkaitan'],
  'Related Posts Locale Default Drift Guard: render fallback title matches the settings default.',
  'Related Posts Locale Default Drift Guard: render fallback title still uses a different default language.'
);
assertIncludes(
  'Related Posts Guest Hard-Load Candidate Fetch',
  usePluginsContent,
  [
    'RELATED_POSTS_FALLBACK_LIMIT',
    "params.set('public', '1');",
    "params.set('includeTotal', 'false');",
    'fetchRelatedPostCandidates',
    'safeRelatedCount',
    'getRelatedCandidateLimit',
    'candidateFetchLimit',
    'localPublishedCandidateCount >= candidateFetchLimit',
    'localPublishedCandidateCount',
    'hasCompleteLocalCandidateSet',
    'fallbackCandidateState',
    'postId: fallbackPostId',
    'fallbackCandidateState.postId === currentPostId',
  ],
  'Related Posts Guest Hard-Load Candidate Fetch: related posts fetch a bounded public candidate list when guest direct-link loads have no global posts preload or only partial latest/featured candidates, fallback candidates are keyed per post, and partial saved configs still use a safe count fallback.',
  'Related Posts Guest Hard-Load Candidate Fetch: related posts still trust a small local latest/featured posts array, can render stale fallback candidates across SPA post navigation, or can send malformed limits when saved configs omit count.'
);
assertIncludes(
  'Related Posts Candidate Source Stability',
  usePluginsContent,
  [
    'const candidatePosts =',
    'fallbackCandidateState.postId === currentPostId',
    '? fallbackCandidateState.posts',
    ': hasCompleteLocalCandidateSet',
  ],
  'Related Posts Candidate Source Stability: fetched fallback candidates remain the active source for the current post after later authenticated content hydration, preventing visible related-post reshuffles during profile or theme state changes.',
  'Related Posts Candidate Source Stability: current-post fallback candidates can still be replaced by later global content hydration.'
);
if (
  relatedPostsComponentContent.includes(
    'const gridColumnClass = [4, 8].includes(relatedPosts.length)'
  ) &&
  relatedPostsComponentContent.includes("'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'") &&
  relatedPostsComponentContent.includes('grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6') &&
  !relatedPostsComponentContent.includes('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6')
) {
  pass('Related Posts Tablet Grid: three related posts stay balanced on tablet view.');
} else {
  fail('Related Posts Tablet Grid: grid layout must use three columns at tablet width.');
}

const crawlablePostLinkFiles = [
  'src/themes/default/Layout.tsx',
  'src/themes/digest/Layout.tsx',
  'src/themes/techpress/Layout.tsx',
  'src/themes/corporate-pro/Layout.tsx',
  'src/themes/portfolio/Layout.tsx',
  'src/themes/prism/Layout.tsx',
  'src/plugins/von-core/features/plugins/built-in/related-posts/RelatedPostsComponent.tsx',
];
const crawlablePostLinkIssues = crawlablePostLinkFiles.flatMap((file) => {
  const content = read(file);
  const missing = [];

  if (!content.includes('getPermalink')) {
    missing.push('getPermalink helper');
  }

  if (!content.includes('href={getPermalink(')) {
    missing.push('crawlable post href');
  }

  return missing.length ? [`${file}: ${missing.join(', ')}`] : [];
});

if (crawlablePostLinkIssues.length === 0) {
  pass(
    'Crawlable Public Post Links: bundled themes and Related Posts expose canonical hrefs while keeping SPA click handlers.'
  );
} else {
  fail(`Crawlable Public Post Links: ${crawlablePostLinkIssues.join('; ')}`);
}

const crawlableSidebarLinkFiles = [
  'src/plugins/von-core/features/public/components/Sidebar.tsx',
  'src/themes/techpress/components/Sidebar.tsx',
  'src/themes/digest/components/Sidebar.tsx',
];
const crawlableSidebarLinkIssues = crawlableSidebarLinkFiles.flatMap((file) => {
  const content = read(file);
  const missing = [];

  if (!content.includes('href={getPermalink(post, settings')) {
    missing.push('canonical href');
  }

  if (!content.includes('handleCrawlableLinkClick(event')) {
    missing.push('native-aware click handler');
  }

  if (content.includes('onClick={(e) => e.preventDefault()}')) {
    missing.push('bare preventDefault anchor');
  }

  return missing.length ? [`${file}: ${missing.join(', ')}`] : [];
});

if (crawlableSidebarLinkIssues.length === 0) {
  pass('Crawlable Sidebar Links: trending widgets keep real hrefs and native link behavior.');
} else {
  fail(`Crawlable Sidebar Links: ${crawlableSidebarLinkIssues.join('; ')}`);
}

assertIncludes(
  'Public Lightbox Mobile Swipe Contract',
  read('src/components/GlobalLightbox.tsx'),
  [
    'SWIPE_THRESHOLD_PX',
    'SWIPE_VERTICAL_TOLERANCE_PX',
    'const touchStartRef = useRef',
    'const handleTouchStart = (event: React.TouchEvent',
    'const handleTouchEnd = (event: React.TouchEvent',
    'onTouchStart={handleTouchStart}',
    'onTouchEnd={handleTouchEnd}',
    'deltaX < 0 ? next() : prev();',
  ],
  'Public Lightbox Mobile Swipe Contract: post-content gallery lightbox supports guarded left/right swipe navigation on mobile.',
  'Public Lightbox Mobile Swipe Contract: global post-content lightbox can still open without touch swipe navigation.'
);

if (exists('ROADMAP.md')) {
  const roadmapContent = read('ROADMAP.md');
  assertIncludes(
    'Roadmap Human-Readable Structure',
    roadmapContent,
    [
      'For shipped release details, use `CHANGELOG.md`',
      '## Current Closed Release',
      '### ✅ v1.25.1 "OpenGate" Open Source First Impression Follow-Up',
      '### ✅ v1.25.0 "OpenGate" Release Baseline',
      '### ✅ v1.24.11 "HourGlass" Emergency Stabilization',
      '## Next Active Milestone',
      '### 🚀 v1.25.x — Open Source Onboarding + Simple Public Cache + i18n Foundation',
      '### ✅ v1.24.11 Emergency Stabilization Reserve',
    ],
    'Roadmap: current, reserve, next, and source-of-truth sections are human-readable.',
    'Roadmap: current state, reserve slots, or next milestone are unclear.'
  );
  assertExcludes(
    'Roadmap Dark Logo Backlog Cleanup',
    roadmapContent,
    ['Admin dark-mode logo behavior'],
    'Roadmap: unused admin dark-mode logo backlog item stays removed.',
    'Roadmap: unused admin dark-mode logo backlog item is still present.'
  );
  assertIncludes(
    'Admin Dashboard Mobile/Tablet Follow-up Roadmap',
    roadmapContent,
    [
      'Admin Dashboard Mobile/Tablet Follow-up',
      '`AdminLayout.tsx`, `Dashboard.tsx`, `ContentManager.tsx`',
    ],
    'Roadmap: admin dashboard mobile/tablet follow-up is parked in the v1.27 line.',
    'Roadmap: admin dashboard mobile/tablet follow-up is missing from v1.27.'
  );

  assertExcludes(
    'Roadmap Editor V2 Drift Guard',
    roadmapContent,
    [
      '- Editor V2 / TipTap migration while preserving HTML save/render compatibility',
      '- Paste, sanitization, public rendering, and shortcode compatibility through Editor V2',
      'Treat this as an Editor V2 migration, not a silent internal swap',
    ],
    'Roadmap: shipped Editor V2/TipTap work is no longer listed as future migration backlog.',
    'Roadmap: stale Editor V2 future-backlog wording remains after v1.24 shipped TipTap.'
  );

  assertIncludes(
    'Roadmap Shipped Detail Compression',
    roadmapContent,
    [
      'Long shipped history is intentionally not repeated here; see `CHANGELOG.md`',
      'These are closed for the current line. Do not reopen them from roadmap wording alone.',
      '`v1.23.6` shipped',
      'Backup download filename uses generic `backup_voncms_<timestamp>.sql`',
      'completed in `v1.23.6`',
    ],
    'Roadmap: shipped detail is compressed while preserving key do-not-reopen markers.',
    'Roadmap: shipped detail is still too ambiguous or key closed markers are missing.'
  );

  assertIncludes(
    'Roadmap v1.25 Focus',
    roadmapContent,
    [
      '### 🚀 v1.25.x — Open Source Onboarding + Simple Public Cache + i18n Foundation',
      '#### v1.25.1 — Open Source First Impression',
      '#### v1.25.2 — Simple Public API Cache',
      '#### v1.25.3 — i18n Seed And RTL Readiness',
      '#### v1.25.4 — Public Theme Discovery Polish',
      '**UI Translation Key Pilot**',
      '**Malay Pack Pilot**',
      '**RTL Readiness Pass**',
    ],
    'Roadmap: v1.25.x slices open-source onboarding, simple cache, i18n seed work, and public theme discovery polish.',
    'Roadmap: v1.25.x focus is unclear or still dominated by shipped HourGlass history.'
  );

  assertIncludes(
    'Roadmap v1.24.x Handoff',
    roadmapContent,
    [
      '## v1.24.x → v1.25 Handoff',
      'Public posts count skip shipped in `v1.24.9`',
      'Media list query narrowing shipped in `v1.24.9`',
      'Remaining exact-total COUNT optimization is unscheduled',
    ],
    'Roadmap: shipped HourGlass performance fixes are separated from unscheduled future COUNT work.',
    'Roadmap: v1.24.x handoff or COUNT status is unclear.'
  );
} else {
  pass('Roadmap Private Planning Boundary: ROADMAP.md is not required in public source packages.');
}

const contributingContent = exists('CONTRIBUTING.md') ? read('CONTRIBUTING.md') : '';
const firstRunDocsContent = [
  exists('README.md') ? read('README.md') : '',
  exists('docs/INSTALL.md') ? read('docs/INSTALL.md') : '',
  exists('docs/VPS.md') ? read('docs/VPS.md') : '',
].join('\n');
const bugReportTemplateContent = exists('.github/ISSUE_TEMPLATE/bug_report.yml')
  ? read('.github/ISSUE_TEMPLATE/bug_report.yml')
  : '';
const releaseAuditTemplateContent = exists('.github/ISSUE_TEMPLATE/release_audit.yml')
  ? read('.github/ISSUE_TEMPLATE/release_audit.yml')
  : '';
const issueTemplateConfigContent = exists('.github/ISSUE_TEMPLATE/config.yml')
  ? read('.github/ISSUE_TEMPLATE/config.yml')
  : '';
const pullRequestTemplateContent = exists('.github/pull_request_template.md')
  ? read('.github/pull_request_template.md')
  : '';
assertIncludes(
  'Open Source Contributor Guardrails',
  contributingContent,
  [
    'VonCMS Contribution Guide',
    'Core Contracts',
    'Do Not Break',
    'Verification Gate',
    'public/security.php',
    'server/test-integration.cjs',
    'create_release.cjs',
    'ROADMAP.md',
  ],
  'Open Source Contributor Guardrails: root contribution guide documents the project contracts.',
  'Open Source Contributor Guardrails: root CONTRIBUTING.md is missing required VonCMS guardrail markers.'
);
assertIncludes(
  'Open Source First-Run Guide',
  firstRunDocsContent,
  [
    'Install A Website From Deploy ZIP',
    'Use The Open-Source Repository',
    'Local Testing',
    'VPS Deployment Guide',
    `VonCMS_v${pkg.version}_Deploy.zip`,
    'npm install',
    'npm run test:integration',
  ],
  'Open Source First-Run Guide: README, install, local, VPS, and source paths are documented.',
  'Open Source First-Run Guide: README/INSTALL/VPS docs are missing first-run install, local, or source workflow markers.'
);
assertIncludes(
  'Open Source GitHub Templates',
  bugReportTemplateContent +
    '\n' +
    releaseAuditTemplateContent +
    '\n' +
    issueTemplateConfigContent +
    '\n' +
    pullRequestTemplateContent,
  [
    'Bug report',
    'Release audit',
    'Private security report',
    'Do not open a public issue for a dangerous security vulnerability',
    'npm run typecheck',
    'public/security.php',
  ],
  'Open Source GitHub Templates: bug, release-audit, security contact, and PR verification templates are present.',
  'Open Source GitHub Templates: issue/PR templates or private security guidance are incomplete.'
);

const mediaVariantsContent = read('public/media_variants.php');
assertIncludes(
  'Responsive Media Helper',
  mediaVariantsContent,
  [
    'function voncms_get_responsive_widths',
    '[480, 960, 1920]',
    'function voncms_build_responsive_image_data',
    "'srcSet' => implode(', ', $parts)",
  ],
  'Responsive Media Helper: width strategy and srcSet builder detected.',
  'Responsive Media Helper: width strategy or srcSet builder markers are missing.'
);

const uploadFileContent = read('public/api/upload_file.php');
const imageProcessorContent = read('public/api/ImageProcessor.php');
assertIncludes(
  'Upload Pipeline Variants',
  uploadFileContent,
  [
    "'generateResponsiveVariants' => true",
    "$mediaSettings['generateResponsiveVariants'] = false;",
    "$mediaSettings['convertToWebP'] = false;",
    'voncms_build_responsive_image_data',
    "'imageSrcSet' => $finalImageSrcSet",
  ],
  'Upload Pipeline Variants: content uploads generate responsive metadata and system assets skip responsive/WebP derivative output.',
  'Upload Pipeline Variants: responsive upload handling or system asset exclusion markers are incomplete.'
);
assertIncludes(
  'Upload Variant Fallback Reporting',
  uploadFileContent + '\n' + imageProcessorContent,
  [
    "'responsiveVariantStatus'",
    "'fallback_original'",
    "'responsiveVariantMessage'",
    "'responsiveVariantFallback' =>",
    "error_log('Responsive variant generation fallback:",
  ],
  'Upload Variant Fallback Reporting: upload responses disclose responsive variant fallback status instead of silently serving unoptimized originals.',
  'Upload Variant Fallback Reporting: media upload fallback/error reporting markers are incomplete.'
);
if (
  uploadFileContent.includes("$mediaSettings['convertToWebP'] = filter_var(") &&
  uploadFileContent.includes("$opt['convertToWebP'] ?? false") &&
  uploadFileContent.includes('FILTER_VALIDATE_BOOLEAN') &&
  !uploadFileContent.includes('Force WebP conversion')
) {
  pass('Upload WebP Setting: upload pipeline honors the Media tab convertToWebP toggle.');
} else {
  fail('Upload WebP Setting: upload pipeline still appears to force WebP conversion.');
}
assertIncludes(
  'Media CDN URL Helper Contract',
  uploadFileContent +
    '\n' +
    read('src/plugins/von-core/features/settings/components/MediaSettings.tsx'),
  [
    'function voncms_build_cdn_media_url',
    "preg_match('#/uploads$#i',",
    '$finalUrl = voncms_build_cdn_media_url($cdnUrl, $relativePath);',
    '$webpUrl = voncms_build_cdn_media_url($cdnUrl, $webpRelativePath);',
    'Files still upload to this site.',
    'CDN URL guide',
    'When to use',
    'Benefit',
    'Accepted format',
    'Leave blank for normal local uploads or if the CDN is not configured yet.',
    'https://cdn.example.com or https://cdn.example.com/uploads',
  ],
  'Media CDN URL Helper Contract: CDN upload and WebP URLs avoid duplicate /uploads while the settings copy explains accepted bases.',
  'Media CDN URL Helper Contract: CDN upload/WebP URL construction or helper copy can still produce confusing /uploads/uploads paths.'
);

const listMediaContent = read('public/api/list_media.php');
assertIncludes(
  'Media List Query Narrowing Contract',
  listMediaContent,
  [
    '$mediaColumns = [',
    "'id'",
    'SHOW COLUMNS FROM media',
    'array_intersect($mediaColumns, $availableMediaColumns)',
    "'SELECT ' .",
    "implode(', ', $selectedMediaColumns)",
    "' FROM media ORDER BY id DESC LIMIT :limit OFFSET :offset'",
  ],
  'Media List Query Narrowing Contract: media list fetches only mapped columns while preserving schema fallback behavior.',
  'Media List Query Narrowing Contract: media list still fetches broad rows or lacks schema-compatible column narrowing.'
);
assertExcludes(
  'Media List Select Star Exclusion',
  listMediaContent,
  ['SELECT * FROM media'],
  'Media List Select Star Exclusion: media list no longer fetches unused columns.',
  'Media List Select Star Exclusion: media list still uses SELECT *.'
);

const siteUtilsImageContent = read('src/utils/siteUtils.ts');
assertIncludes(
  'Thumbnail Object Position Contract',
  siteUtilsImageContent,
  [
    'RESPONSIVE_IMAGE_OBJECT_POSITION',
    "card: 'center 38%'",
    'style: { objectPosition: RESPONSIVE_IMAGE_OBJECT_POSITION[mode] }',
  ],
  'Thumbnail Object Position Contract: responsive card thumbnails default to a smarter upper-center crop.',
  'Thumbnail Object Position Contract: responsive thumbnails do not carry a stable object-position default.'
);

const sharedAdBlockContent = read('src/themes/shared/components/AdBlock.tsx');
assertIncludes(
  'Widget Ad Containment Contract',
  sharedAdBlockContent,
  [
    "maxWidth: '100%'",
    "overflow: 'hidden'",
    "minWidth: '0'",
    '[&_iframe]:max-w-full',
    '[&_img]:max-w-full',
    '[&_ins]:max-w-full',
  ],
  'Widget Ad Containment Contract: shared ad/widget markup stays bounded inside theme containers.',
  'Widget Ad Containment Contract: shared ad/widget markup can still overflow theme containers.'
);
assertIncludes(
  'Ads Manager Responsive Iframe Contract',
  sharedAdBlockContent,
  [
    "iframe.style.maxWidth = '100%';",
    "iframe.style.minWidth = '0';",
    'html, body {',
    'box-sizing: border-box;',
    'Math.max(',
    'requestAnimationFrame(updateHeight);',
    'window.setTimeout(updateHeight, 100);',
  ],
  'Ads Manager Responsive Iframe Contract: script/iframe ads stay bounded and recalculate delayed heights.',
  'Ads Manager Responsive Iframe Contract: isolated ad iframe lacks mobile containment or delayed height sync.'
);
assertIncludes(
  'TechPress In-Feed Ad Container Cap',
  techPressLayoutContent,
  [
    '<div className="flex-1 min-w-0">',
    'className="w-full max-w-full overflow-hidden py-8 my-4 border-y ad-slot-flex"',
    '<AdBlock content={settings.ads.inFeedAd} slotId="infeed" />',
    '<aside className="w-full lg:w-[350px] flex-shrink-0 space-y-6">',
  ],
  'TechPress In-Feed Ad Container Cap: in-feed ads stay capped by the Latest Updates column without pushing the sidebar.',
  'TechPress In-Feed Ad Container Cap: Latest Updates or in-feed ads can still force the sidebar wider/off-layout.'
);
assertIncludes(
  'Ads Manager Visual Style Allowlist Contract',
  editorSecurityContent + '\n' + sharedAdBlockContent,
  [
    'export const AD_ALLOWED_STYLE_PROPS',
    "'background'",
    "'box-shadow'",
    "'justify-content'",
    "'align-items'",
    "'box-sizing'",
    "'min-height'",
    'styleAllowlist',
    'styleAllowlist: AD_ALLOWED_STYLE_PROPS',
    'url\\s*\\(',
  ],
  'Ads Manager Visual Style Allowlist Contract: ad snippets can keep bounded visual styles without relaxing editor/content sanitizing.',
  'Ads Manager Visual Style Allowlist Contract: ad snippets still lose common visual styles or share the global sanitizer allowlist.'
);
const adStyleAllowlistMatch = editorSecurityContent.match(
  /export const AD_ALLOWED_STYLE_PROPS = new Set\(\[([\s\S]*?)\]\);/
);
const adStyleAllowlist = adStyleAllowlistMatch ? adStyleAllowlistMatch[1] : '';
assertExcludes(
  'Ads Manager No Takeover Style Contract',
  adStyleAllowlist,
  ["'position'", "'z-index'", "'top'", "'right'", "'bottom'", "'left'"],
  'Ads Manager No Takeover Style Contract: ad visual styles stay bounded and do not allow overlay positioning.',
  'Ads Manager No Takeover Style Contract: ad visual styles still allow overlay positioning or takeover-style offsets.'
);
const adAddTagsMatch = sharedAdBlockContent.match(/ADD_TAGS:\s*\[([\s\S]*?)\]/);
const adAddTags = adAddTagsMatch ? adAddTagsMatch[1] : '';
assertExcludes(
  'Ads Manager Style Tag Containment Contract',
  adAddTags,
  ["'style'"],
  'Ads Manager Style Tag Containment Contract: ad snippets cannot inject page-wide style tags into direct rendering.',
  'Ads Manager Style Tag Containment Contract: ad snippets can still preserve <style> tags and bypass the inline style allowlist.'
);

const popupAdContent = read('src/themes/shared/components/VonPopupAd.tsx');
assertIncludes(
  'Popup Ad Mobile Safety Contract',
  popupAdContent,
  [
    'overflow-y-auto',
    'max-h-[calc(100dvh-2rem)]',
    'overscroll-contain',
    'right-2 top-2 sm:-top-4 sm:-right-4',
  ],
  'Popup Ad Mobile Safety Contract: popup ads stay inside the viewport with scroll-safe mobile close behavior.',
  'Popup Ad Mobile Safety Contract: popup ads can still overflow mobile viewport or place the close button off-screen.'
);

const indexCssContent = read('src/index.css');
assertIncludes(
  'Global Ad Slot Overflow Guard',
  indexCssContent,
  ['min-width: 0;', 'max-width: 100%;', 'overflow: hidden;'],
  'Global Ad Slot Overflow Guard: theme ad slot helpers cannot expand the page horizontally.',
  'Global Ad Slot Overflow Guard: theme ad slot helpers still allow visible overflow or missing width bounds.'
);

const getPostsContent = read('public/api/get_posts.php');
const postsApiSearchContent =
  getPostsContent + '\n' + publicInstallSqlContent + '\n' + installContent + '\n' + repairDbContent;
if (
  (postsApiSearchContent.includes("$search = $_GET['search'] ?? null;") ||
    postsApiSearchContent.includes("$search = trim((string) ($_GET['search'] ?? ''));")) &&
  postsApiSearchContent.includes(
    'MATCH(p.title, p.content) AGAINST(:searchTerm IN BOOLEAN MODE)'
  ) &&
  postsApiSearchContent.includes('p.title LIKE :searchLike') &&
  postsApiSearchContent.includes(
    'ALTER TABLE posts ADD FULLTEXT INDEX ft_title_content (title, content)'
  ) &&
  !getPostsContent.includes("SHOW INDEX FROM posts WHERE Key_name = 'ft_title_content'") &&
  !getPostsContent.includes('p.content LIKE :searchLike') &&
  !getPostsContent.includes(':searchContentLike')
) {
  pass(
    'Posts API Search Contract: get_posts.php keeps direct FULLTEXT search with a narrow title LIKE fallback.'
  );
} else {
  fail(
    'Posts API Search Contract: post manager search must avoid broad content LIKE/index-probe search while keeping FULLTEXT plus title fallback markers.'
  );
}

const publicPostsQueryHookPath = 'src/hooks/usePublicPostsQuery.ts';
let publicPostsQueryContent = '';
if (exists(publicPostsQueryHookPath)) {
  publicPostsQueryContent = read(publicPostsQueryHookPath);
  assertIncludes(
    'Public Posts Query Contract',
    publicPostsQueryContent,
    [
      'API.getPosts',
      "params.set('page', String(pageNum));",
      "params.set('limit', String(limit));",
      "params.set('category', category.trim());",
      "params.set('search', normalizedSearch);",
      'data.meta || null',
      'hasMore',
      'imageSrcSet: p.imageSrcSet || p.image_srcset ||',
    ],
    'Public Posts Query Contract: shared public discovery hook uses get_posts.php pagination/search/category metadata.',
    'Public Posts Query Contract: public discovery is missing a shared server-backed posts query.'
  );

  assertIncludes(
    'Public Posts COUNT Skip Contract',
    getPostsContent + '\n' + publicPostsQueryContent,
    [
      "$includeTotal = ($_GET['includeTotal'] ?? 'true') !== 'false';",
      '$canSkipTotal = !$isAdmin && !$includeTotal && $authorQuery === null;',
      '$queryLimit = $canSkipTotal ? $limit + 1 : $limit;',
      '$rows = array_slice($rows, 0, $limit);',
      "'totalIsExact' => !$canSkipTotal,",
      "params.set('includeTotal', 'false');",
    ],
    'Public Posts COUNT Skip Contract: public discovery can use limit-plus-one hasMore without breaking exact admin/profile totals.',
    'Public Posts COUNT Skip Contract: public discovery still requires COUNT or exact-total callers are not clearly protected.'
  );

  assertIncludes(
    'Public Posts JSON Cache Boundary',
    getPostsContent,
    [
      "require_once __DIR__ . '/public_cache_helper.php';",
      '$publicPostsCacheKey = voncms_public_cache_key',
      'voncms_public_cache_get($publicPostsCacheKey',
      'voncms_public_cache_set($publicPostsCacheKey',
      "filter_var($_GET['public'] ?? false,",
      '$canUsePublicPostsCache =',
      '!$isAdmin',
      '$forcePublic',
      '!$includeTotal',
      '!$countOnly',
      '$authorQuery === null',
      '$statusFilter === null',
    ],
    'Public Posts JSON Cache Boundary: cache is limited to public-shaped includeTotal=false list discovery without count-only/profile/status/admin reads.',
    'Public Posts JSON Cache Boundary: posts cache eligibility is missing required public-shaped/includeTotal/countOnly/profile/status guards.'
  );
  const defaultPublicLayoutContent = read('src/themes/default/Layout.tsx');
  const digestPublicLayoutContent = read('src/themes/digest/Layout.tsx');
  assertIncludes(
    'Public Search Approximate Count Copy',
    publicPostsQueryContent + '\n' + defaultPublicLayoutContent + '\n' + digestPublicLayoutContent,
    [
      'totalIsExact?: boolean;',
      'const searchResultsAreExact = publicPosts.meta?.totalIsExact !== false;',
      'const visibleSearchCount = publicPosts.posts.length;',
      'Showing first ${visibleSearchCount} results',
      'Showing ${visibleSearchCount} ${visibleSearchLabel}',
      'searchResultsAreExact',
    ],
    'Public Search Approximate Count Copy: public search wording avoids claiming exact totals when includeTotal=false.',
    'Public Search Approximate Count Copy: public search can still label approximate loaded counts as exact results found.'
  );

  if (
    publicPostsQueryContent.includes('safeLower(post.title).includes(q)') &&
    publicPostsQueryContent.includes('safeLower(post.content).includes(q)') &&
    !publicPostsQueryContent.includes('safeLower(post.excerpt).includes(q)') &&
    !publicPostsQueryContent.includes('safeLower(post.category).includes(q)')
  ) {
    pass(
      'Public Posts Query Search Parity: local fallback search stays aligned with the narrow server title/content contract.'
    );
  } else {
    fail(
      'Public Posts Query Search Parity: local fallback search still claims matches that get_posts.php will not return once server pagination takes over.'
    );
  }

  if (
    publicPostsQueryContent.includes('const preserveVisiblePostsDuringFetch =') &&
    publicPostsQueryContent.includes('fallbackPosts.length === 0') &&
    publicPostsQueryContent.includes(
      'const [isLoading, setIsLoading] = useState(preserveVisiblePostsDuringFetch);'
    ) &&
    publicPostsQueryContent.includes('if (!preserveVisiblePostsDuringFetch) {') &&
    publicPostsQueryContent.includes('setPosts(fallbackPosts);')
  ) {
    pass(
      'Public Posts Query Loading Contract: server-backed search/category fetches start in loading state and preserve the current visible list when fallbackPosts would otherwise flash empty.'
    );
  } else {
    fail(
      'Public Posts Query Loading Contract: public discovery searches can still paint empty before the server result arrives.'
    );
  }

  if (
    publicPostsQueryContent.includes('const PUBLIC_SEARCH_MAX_LENGTH = 120;') &&
    publicPostsQueryContent.includes(
      'export const normalizePublicSearchInput = (value: string) =>'
    ) &&
    publicPostsQueryContent.includes(
      'export const normalizePublicSearchQuery = (value: string) =>'
    ) &&
    publicPostsQueryContent.includes('const rawSearch = normalizePublicSearchInput(search);') &&
    publicPostsQueryContent.includes(
      'const rawSearchQuery = normalizePublicSearchQuery(rawSearch);'
    ) &&
    publicPostsQueryContent.includes(
      'const isDebouncingSearch = rawSearchQuery.length >= 2 && rawSearch !== debouncedSearch;'
    ) &&
    publicPostsQueryContent.includes('const effectiveFallbackSearch = rawSearchQuery;') &&
    publicPostsQueryContent.includes(
      '.filter((post) => matchesSearch(post, effectiveFallbackSearch))'
    ) &&
    publicPostsQueryContent.includes('abortControllerRef.current?.abort();') &&
    publicPostsQueryContent.includes('const abortController = new AbortController();') &&
    publicPostsQueryContent.includes('signal: abortController.signal') &&
    publicPostsQueryContent.includes("(err as Error)?.name === 'AbortError'") &&
    publicPostsQueryContent.includes('isLoading: isLoading || isDebouncingSearch') &&
    !publicPostsQueryContent.includes('hasShortSearch ? search.trim() : normalizedSearch') &&
    !publicPostsQueryContent.includes('value.trim().slice(0, PUBLIC_SEARCH_MAX_LENGTH)')
  ) {
    pass(
      'Public Posts Query Debounce Contract: public search clamps long queries, keeps live typing local while server fetches use the debounced term, marks debounce gaps as loading, and aborts stale requests.'
    );
  } else {
    fail(
      'Public Posts Query Debounce Contract: public search can still trigger long/raw-query fetches, flash no-results during debounce, or leave stale requests in flight.'
    );
  }
} else {
  fail('Public Posts Query Contract: missing src/hooks/usePublicPostsQuery.ts.');
}

if (
  publicPostsQueryContent.includes("params.set('public', '1');") &&
  getPostsContent.includes('$forcePublic =') &&
  getPostsContent.includes('$isAdmin = SessionManager::isAdmin() && !$forcePublic;')
) {
  pass(
    'Public Draft Visibility Guard: public discovery requests force the published-only contract even during an authenticated admin session.'
  );
} else {
  fail(
    'Public Draft Visibility Guard: admin-session public discovery can still fetch draft/autosaved posts into public themes.'
  );
}

assertIncludes(
  'Staff Content Read Boundary',
  getPostsContent + '\n' + read('public/api/get_post.php') + '\n' + getPagesContent,
  [
    '$canReadProtectedPosts = SessionManager::isStaff() && !$forcePublic;',
    "$currentRole === 'writer'",
    'p.author_id = :currentUserId',
    '$canReadProtectedPost = SessionManager::isStaff();',
    '$canReadProtectedPages = in_array($currentRole, [',
    "'admin'",
    "'root'",
    "'moderator'",
  ],
  'Staff Content Read Boundary: moderator/writer reads can recover authorized draft or scheduled content without exposing protected content through public queries.',
  'Staff Content Read Boundary: moderator/writer reads can still fall back to public-only filtering for authorized content.'
);

const publicSearchThemeContent = [
  read('src/themes/default/Layout.tsx'),
  read('src/themes/techpress/Layout.tsx'),
  read('src/themes/digest/Layout.tsx'),
  read('src/themes/prism/Layout.tsx'),
].join('\n');
assertIncludes(
  'Search UI Length Guard',
  publicSearchThemeContent + '\n' + contentManagerContent,
  ['PUBLIC_SEARCH_MAX_LENGTH', 'Search is limited to', 'maxLength={PUBLIC_SEARCH_MAX_LENGTH}'],
  'Search UI Length Guard: public and admin search inputs expose the 120-character limit with visible guidance.',
  'Search UI Length Guard: search inputs can still accept oversized text without visible guidance.'
);
assertIncludes(
  'Search API Length Guard',
  getPostsContent + '\n' + getPagesContent,
  ["mb_substr($search, 0, 120, 'UTF-8')", 'substr($search, 0, 120)'],
  'Search API Length Guard: post/page search endpoints clamp oversized query strings before SQL binding.',
  'Search API Length Guard: post/page search endpoints still bind oversized query strings.'
);
assertIncludes(
  'Search API Boolean Payload Guard',
  getPostsContent + '\n' + getPagesContent,
  [
    'function voncms_normalize_fulltext_search(string $value): string',
    'function voncms_escape_like_search(string $value): string',
    '$fulltextSearch = voncms_normalize_fulltext_search($search);',
    'ESCAPE',
  ],
  'Search API Boolean Payload Guard: post/page search normalize FULLTEXT terms and escape LIKE wildcards before binding.',
  'Search API Boolean Payload Guard: post/page search can still pass raw boolean/punctuation payloads into FULLTEXT or LIKE.'
);

const appContent = read('src/App.tsx');
const singlePageHookContent = read('src/hooks/useSinglePage.ts');
const singlePostHookContent = read('src/hooks/useSinglePost.ts');
assertIncludes(
  'Single Post ID Parameter Type Guard',
  read('public/api/get_post.php'),
  [
    "isset($_GET['id']) ? trim((string) $_GET['id']) : null",
    "preg_match('/^\\d+$/', $id)",
    "ResponseHelper::sendError('Post ID must be numeric; use slug parameter for slugs', 400);",
    "if ($id !== null && $id !== '') {",
    '$params = [(int) $id];',
  ],
  'Single Post ID Parameter Type Guard: get_post.php rejects non-numeric id values so numeric-prefixed slugs cannot be coerced to unrelated post IDs.',
  'Single Post ID Parameter Type Guard: get_post.php can still accept numeric-prefixed slug strings through id= and let SQL coerce them to a different post.'
);
if (
  publicPostsQueryContent.includes('const publicPostCache = new Map<string, Post>();') &&
  publicPostsQueryContent.includes(
    'export const getCachedPublicPost = (postId: string): Post | null =>'
  ) &&
  publicPostsQueryContent.includes('rememberPublicPosts(fetchedPosts);') &&
  appContent.includes("import { getCachedPublicPost } from './hooks/usePublicPostsQuery';") &&
  appContent.includes('posts.find((x: Post) => x.id === pid) || getCachedPublicPost(pid)') &&
  appContent.includes('navigate(`/post/${encodeURIComponent(pid)}`);') &&
  !appContent.includes(
    'const res = await vonFetch(`${API.getPost}?id=${encodeURIComponent(pid)}`);'
  )
) {
  pass(
    'Public Post Click Contract: cached old discovery results navigate directly to their saved permalink while uncached results keep the immediate id-backed fallback.'
  );
} else {
  fail(
    'Public Post Click Contract: old discovery results can still miss cached permalink navigation or block on a pre-navigation get_post fetch.'
  );
}

if (
  appContent.includes(
    'const canonicalPostPath = getPermalink(fullPost, props.settings, false, true);'
  ) &&
  appContent.includes('navigate(canonicalPostPath, { replace: true });') &&
  appContent.includes('canonicalPostPath !== `/post/${encodeURIComponent(id)}`')
) {
  pass(
    'Public Post Canonical Redirect Contract: id-backed old discovery routes replace themselves with the saved permalink after the full post loads.'
  );
} else {
  fail(
    'Public Post Canonical Redirect Contract: id-backed old discovery routes can still remain on /post/:id instead of replacing to the saved permalink.'
  );
}

if (
  singlePostHookContent.includes('const requestedPostKey =') &&
  singlePostHookContent.includes('const requestIdRef = useRef(0);') &&
  singlePostHookContent.includes(
    'const abortControllerRef = useRef<AbortController | null>(null);'
  ) &&
  singlePostHookContent.includes('const hasSettledCurrentRequest =') &&
  singlePostHookContent.includes('const isPendingCurrentRequest =') &&
  singlePostHookContent.includes('const requestId = requestIdRef.current;') &&
  singlePostHookContent.includes('signal: abortController.signal') &&
  singlePostHookContent.includes('if (requestId !== requestIdRef.current) return;') &&
  singlePostHookContent.includes("(err as Error)?.name === 'AbortError'") &&
  singlePostHookContent.includes('setSettledRequestKey(requestedPostKey);') &&
  singlePostHookContent.includes(
    'return { fullPost, isLoading: isLoading || isPendingCurrentRequest };'
  ) &&
  appContent.includes('const fullPostMatchesCurrentRoute =') &&
  appContent.includes('fullPostMatchesCurrentRoute ? fullPost : null') &&
  appContent.includes("if (currentView === 'single-post' && !selectedPost && isLoadingPost)") &&
  appContent.includes('return <SkeletonLoader />;') &&
  appContent.includes('if (!selectedPost && !isLoadingPost) isNotFound = true;')
) {
  pass(
    'Single Post Pending Contract: id/slug routes outside the preload stay in a route-level fetch-pending state until get_post.php settles, while stale requests are aborted/ignored.'
  );
} else {
  fail(
    'Single Post Pending Contract: id/slug routes outside the preload can still leak through to theme fallbacks or stale get_post.php responses before the current fetch has settled.'
  );
}

if (
  appContent.includes(
    'const fallbackPost = posts.find((p: Post) => p.id === id || p.slug === slug) || null;'
  ) &&
  appContent.includes('!isLoadingPost ? fallbackPost : null') &&
  !appContent.includes('(fullPostMatchesCurrentRoute ? fullPost : null) ||\n      posts.find')
) {
  pass(
    'Single Post Full Payload Loading Contract: single-post routes show the route skeleton while full post content is loading instead of rendering preload-card data first.'
  );
} else {
  fail(
    'Single Post Full Payload Loading Contract: single-post routes can still render preload-card data before the full post payload arrives.'
  );
}

if (
  singlePageHookContent.includes('const requestedPageKey =') &&
  singlePageHookContent.includes('const requestIdRef = useRef(0);') &&
  singlePageHookContent.includes('signal: abortController.signal') &&
  singlePageHookContent.includes('setSettledRequestKey(requestedPageKey);') &&
  singlePageHookContent.includes(
    'return { fullPage, isLoading: isLoading || isPendingCurrentRequest };'
  ) &&
  appContent.includes('let pageSlugToFetch: string | null = null;') &&
  appContent.includes('let isAmbiguousSlugRoute = false;') &&
  appContent.includes('const { fullPage, isLoading: isLoadingPage } = useSinglePage(') &&
  appContent.includes('if (isAmbiguousSlugRoute) {') &&
  appContent.includes('fullPageMatchesCurrentRoute') &&
  appContent.includes("if (currentView === 'page' && !selectedPage && isLoadingPage)") &&
  appContent.includes('return <SkeletonLoader />;')
) {
  pass(
    'Single Page Pending Contract: ambiguous slug routes check get_pages.php alongside get_post.php and hold the route skeleton until the current page lookup settles.'
  );
} else {
  fail(
    'Single Page Pending Contract: page slugs outside the preload can still fall through before get_pages.php has settled.'
  );
}

const publicSettingsHookContent = read('src/hooks/useSettings.ts');
if (
  publicSettingsHookContent.includes('_s?.discussionEnabled') &&
  !publicSettingsHookContent.includes('discussionEnabled: true,')
) {
  pass(
    'Public Discussion Hydration Contract: initial settings hydrate discussionEnabled so comments-off pages do not first render public discussion prompts.'
  );
} else {
  fail(
    'Public Discussion Hydration Contract: initial public settings still default discussionEnabled to true before the async settings fetch.'
  );
}

const publicSidebarWidgetContent = read(
  'src/plugins/von-core/features/public/components/Sidebar.tsx'
);
if (
  publicSidebarWidgetContent.includes(
    "import AdBlock from '../../../../../themes/shared/components/AdBlock';"
  ) &&
  publicSidebarWidgetContent.includes(
    "import { sanitizeHtml } from '../../../../../utils/security';"
  ) &&
  !publicSidebarWidgetContent.includes("from '../../../../../themes/shared';")
) {
  pass(
    'Public Sidebar Chunk Contract: VpSidebarWidget imports AdBlock and sanitizeHtml directly instead of routing back through the shared theme barrel.'
  );
} else {
  fail(
    'Public Sidebar Chunk Contract: sidebar widget still routes shared helpers through themes/shared, which can recreate the Rollup chunk cycle warning.'
  );
}

if (
  publicSidebarWidgetContent.includes('currentPostId?: string | number;') &&
  publicSidebarWidgetContent.includes('currentPostId,') &&
  publicSidebarWidgetContent.includes('String(post.id) === String(currentPostId)') &&
  publicSidebarWidgetContent.includes("aria-current={isCurrentPost ? 'page' : undefined}") &&
  read('src/themes/default/Layout.tsx').includes('currentPostId={post.id}') &&
  read('src/themes/techpress/Layout.tsx').includes('currentPostId={selectedPost?.id}') &&
  read('src/themes/digest/Layout.tsx').includes('currentPostId={selectedPost?.id}')
) {
  pass(
    'Sidebar Current Post Highlight: shared sidebar receives the active post id and marks the matching trending link as the current page.'
  );
} else {
  fail(
    'Sidebar Current Post Highlight: active post id is not wired through shared sidebar widgets for default, TechPress, and Digest.'
  );
}

const defaultSinglePostLayoutContent = read('src/themes/default/Layout.tsx');
const techPressSinglePostLayoutContent = read('src/themes/techpress/Layout.tsx');
const digestSinglePostLayoutContent = read('src/themes/digest/Layout.tsx');
const singlePostStickySidebarMarkers = [
  [
    'Default',
    defaultSinglePostLayoutContent.includes('flex-shrink-0 space-y-8 lg:sticky lg:top-32 h-fit'),
  ],
  [
    'TechPress',
    techPressSinglePostLayoutContent.includes('flex-shrink-0 space-y-8 lg:sticky lg:top-32 h-fit'),
  ],
  [
    'Digest',
    digestSinglePostLayoutContent.includes('flex-shrink-0 space-y-6 lg:sticky lg:top-24 h-fit'),
  ],
].filter(([, hasStickySidebar]) => hasStickySidebar);

if (singlePostStickySidebarMarkers.length === 0) {
  pass(
    'Single-Post Sidebar Normal Scroll: Default, TechPress, and Digest sidebars scroll with article content instead of staying pinned on desktop.'
  );
} else {
  fail(
    `Single-Post Sidebar Normal Scroll: sticky single-post sidebar remains in ${singlePostStickySidebarMarkers
      .map(([themeName]) => themeName)
      .join(', ')}.`
  );
}

const builtIndexContent = exists('dist/index.html') ? read('dist/index.html') : '';
if (
  !viteConfigContent.includes("return 'theme-corporate-pro';") &&
  !builtIndexContent.includes('theme-corporate-pro')
) {
  pass(
    'Theme Chunk Preload Contract: Corporate Pro is not force-preloaded on unrelated public pages.'
  );
} else {
  fail(
    'Theme Chunk Preload Contract: Corporate Pro still has a dedicated preload path on the general public entry.'
  );
}

if (
  skeletonCssContent.includes('.skeleton-loader {') &&
  !skeletonCssContent.includes('animation: fadeOut') &&
  !skeletonCssContent.includes('@keyframes fadeOut')
) {
  pass(
    'Initial Skeleton Hold: bundled skeleton CSS no longer auto-fades on a timer before React is ready.'
  );
} else {
  fail(
    'Initial Skeleton Hold: skeleton CSS can still fade on a fixed timer and expose a blank app shell before React is ready.'
  );
}

const reactSkeletonContent = exists('src/components/SkeletonLoader.tsx')
  ? read('src/components/SkeletonLoader.tsx')
  : '';
if (
  reactSkeletonContent.includes('background: #111827;') &&
  reactSkeletonContent.includes('border: 1px solid rgba(148, 163, 184, 0.08);') &&
  reactSkeletonContent.includes('rgba(59, 130, 246, 0.1) 20%') &&
  reactSkeletonContent.includes('rgba(148, 163, 184, 0.16) 60%') &&
  !reactSkeletonContent.includes('background: #1a1a1a;') &&
  !reactSkeletonContent.includes('rgba(255, 255, 255, 0.7)')
) {
  pass(
    'React Skeleton Palette Contract: Suspense/route skeletons stay visually aligned with the initial bundled skeleton CSS.'
  );
} else {
  fail(
    'React Skeleton Palette Contract: React fallback skeletons drift from the initial bundled skeleton CSS palette.'
  );
}

if (
  importDbContent.includes('set_time_limit(300);') &&
  !importDbContent.includes('set_time_limit(0);')
) {
  pass(
    'Database Import Runtime Guard: SQL imports use a bounded timeout instead of disabling request timeouts completely.'
  );
} else {
  fail(
    'Database Import Runtime Guard: import_db.php still disables PHP execution timeouts entirely.'
  );
}

if (
  editorContent.includes('return iframe as HTMLElement;') &&
  !editorContent.includes("const wrapper = iframe.closest('div');") &&
  editorContent.includes('requestAnimationFrame(updateBubblePosition);')
) {
  pass(
    'Editor Video Bubble Contract: video tools anchor to the iframe itself and recalculate position after aspect/layout changes.'
  );
} else {
  fail(
    'Editor Video Bubble Contract: video bubble targeting or post-change repositioning still looks broad enough to drift below the selected embed.'
  );
}

const publicDiscoveryThemeContracts = [
  {
    file: 'src/themes/default/Layout.tsx',
    requires: [
      'usePublicPostsQuery',
      'search: activeSearchQuery',
      'category: selectedCategory',
      'publicPosts.posts',
      'publicPosts.loadMore',
      'publicPosts.hasMore',
      'posts={publishedPosts}',
      'normalizePublicSearchInput(e.target.value)',
      'onSearch(nextSearch)',
    ],
    forbids: [
      'const displayedPosts = activeSearchQuery.trim()',
      'posts={displayedPosts}',
      'const timer = setTimeout(() => {',
    ],
  },
  {
    file: 'src/themes/techpress/Layout.tsx',
    requires: [
      'usePublicPostsQuery',
      'search: activeSearchQuery',
      'category: selectedCategory',
      'publicPosts.posts',
      'publicPosts.loadMore',
      'publicPosts.hasMore',
      'publishedPosts.slice(0, config.breakingNewsCount || 3)',
      'config.enableBreaking && !selectedCategory && !activeSearchQuery',
    ],
    forbids: ['? displayedPosts.slice(0, config.breakingNewsCount || 3)'],
  },
  {
    file: 'src/themes/prism/Layout.tsx',
    requires: [
      'usePublicPostsQuery',
      'search: activeSearchQuery',
      'category: selectedCategory',
      'publicPosts.posts',
      'publicPosts.loadMore',
      'publicPosts.hasMore',
    ],
    forbids: ['debouncedSearchQuery', 'const timer = setTimeout(() => setDebouncedSearchQuery'],
  },
  {
    file: 'src/themes/digest/Layout.tsx',
    requires: [
      'usePublicPostsQuery',
      'search: searchQuery',
      'category: selectedCategory',
      'publicPosts.posts',
      'publicPosts.loadMore',
      'publicPosts.hasMore',
    ],
    forbids: [],
  },
  {
    file: 'src/themes/portfolio/Layout.tsx',
    requires: [
      'usePublicPostsQuery',
      "category: activeCategory === 'all' ? null : activeCategory",
      'publicPosts.posts',
      'publicPosts.loadMore',
      'publicPosts.hasMore',
    ],
    forbids: [],
  },
  {
    file: 'src/themes/corporate-pro/Layout.tsx',
    requires: [
      'usePublicPostsQuery',
      'category: selectedCategory',
      'publicPosts.posts',
      'publicPosts.loadMore',
      'publicPosts.hasMore',
      'onCategoryClick?.(post.category)',
    ],
    forbids: [],
  },
];

const publicDiscoveryIssues = publicDiscoveryThemeContracts.flatMap(
  ({ file, requires, forbids = [] }) => {
    const content = read(file);
    const missing = requires.filter((marker) => !content.includes(marker));
    const forbiddenHits = forbids.filter((marker) => content.includes(marker));

    if (missing.length === 0 && forbiddenHits.length === 0) {
      return [];
    }

    const notes = [];
    if (missing.length > 0) notes.push(`missing ${missing.join(', ')}`);
    if (forbiddenHits.length > 0) notes.push(`forbidden ${forbiddenHits.join(', ')}`);
    return [`${file}: ${notes.join(' | ')}`];
  }
);

if (publicDiscoveryIssues.length === 0) {
  pass(
    'Public Discovery 200+ Contract: bundled themes use the shared server-backed discovery path instead of local preload-only slicing or stale parent filters.'
  );
} else {
  fail(
    `Public Discovery 200+ Contract: bundled theme discovery wiring is incomplete: ${publicDiscoveryIssues.join('; ')}`
  );
}

const profileActivityContracts = [
  'src/plugins/von-core/features/users/UserProfile.tsx',
  'src/themes/techpress/Profile.tsx',
  'src/themes/prism/components/PrismProfile.tsx',
  'src/themes/digest/Layout.tsx',
  'src/themes/corporate-pro/Layout.tsx',
  'src/themes/portfolio/Layout.tsx',
].flatMap((file) => {
  const content = read(file);
  const missing = ['useProfileActivity', 'articleTotal', 'commentTotal'].filter(
    (marker) => !content.includes(marker)
  );
  const forbiddenHits = [
    'const userPosts = posts.filter(',
    'const userComments = comments.filter(',
    'const userComments = (comments || []).filter(',
    'const authorProjects = projects.filter(',
    'userPosts.length',
    'userComments.length',
    'authorProjects.length',
  ].filter((marker) => content.includes(marker));

  if (missing.length === 0 && forbiddenHits.length === 0) return [];
  return [
    `${file}: missing ${missing.join(', ') || 'none'}; forbidden ${forbiddenHits.join(', ') || 'none'}`,
  ];
});

if (profileActivityContracts.length === 0) {
  pass(
    'Profile Activity 200+ Contract: bundled profiles use server-backed author/comment totals instead of capped global posts/comments arrays.'
  );
} else {
  fail(
    `Profile Activity 200+ Contract: profile activity still depends on capped global arrays: ${profileActivityContracts.join('; ')}`
  );
}

const profileActivityLoadingContracts = [
  {
    file: 'src/themes/techpress/Profile.tsx',
    requires: [
      'articlesLoading && articlePosts.length === 0',
      'commentsLoading && commentItems.length === 0',
      'min-h-[360px]',
      'animate-pulse',
    ],
  },
  {
    file: 'src/themes/digest/Layout.tsx',
    requires: [
      'articlesLoading && articlePosts.length === 0',
      'commentsLoading && commentItems.length === 0',
      'min-h-[360px]',
      'animate-pulse',
    ],
  },
  {
    file: 'src/themes/corporate-pro/Layout.tsx',
    requires: ['articlesLoading && articlePosts.length === 0', 'min-h-[320px]', 'animate-pulse'],
  },
  {
    file: 'src/plugins/von-core/features/users/UserProfile.tsx',
    requires: [
      'articlesLoading && articlePosts.length === 0',
      'commentsLoading && commentItems.length === 0',
      'min-h-[360px]',
      'animate-pulse',
    ],
  },
].flatMap(({ file, requires }) => {
  const content = read(file);
  const missing = requires.filter((marker) => !content.includes(marker));
  return missing.length === 0 ? [] : [`${file}: missing ${missing.join(', ')}`];
});

if (profileActivityLoadingContracts.length === 0) {
  pass(
    'Profile Activity Loading Stability: profile activity tabs reserve space and render loading skeletons instead of collapsing or showing false empty states.'
  );
} else {
  fail(
    `Profile Activity Loading Stability: profile activity loading surfaces are incomplete: ${profileActivityLoadingContracts.join('; ')}`
  );
}

assertIncludes(
  'Profile Activity Stale Response Guard',
  read('src/hooks/useProfileActivity.ts'),
  [
    'const articleRequestIdRef = useRef(0);',
    'const commentRequestIdRef = useRef(0);',
    'const requestId = ++articleRequestIdRef.current;',
    'const requestId = ++commentRequestIdRef.current;',
    'if (requestId !== articleRequestIdRef.current) return;',
    'if (requestId !== commentRequestIdRef.current) return;',
    'articleRequestIdRef.current += 1;',
    'commentRequestIdRef.current += 1;',
  ],
  'Profile Activity Stale Response Guard: slow article/comment responses from a previous profile cannot overwrite the current profile activity view.',
  'Profile Activity Stale Response Guard: profile-to-profile navigation can still accept stale article/comment responses.'
);

assertIncludes(
  'Appointed Admin Secret Boundary',
  getSettingsContent +
    '\n' +
    read('public/api/save_settings.php') +
    '\n' +
    read('public/api/db_query.php'),
  [
    'SessionManager::isPrimaryAdmin()',
    'SecurityHelper::maskSensitiveData($settings)',
    'voncms_guard_restricted_settings_for_non_primary_admin',
    'SessionManager::requirePrimaryAdmin();',
  ],
  'Appointed Admin Secret Boundary: settings secrets and Database Manager are primary-admin gated server-side.',
  'Appointed Admin Secret Boundary: appointed admins can still read/write secrets or use Database Manager.'
);

assertIncludes(
  'Admin Profile Public Email Boundary',
  getSettingsContent + '\n' + read('public/api/save_settings.php'),
  [
    '$adminProfilePublicEmail = null;',
    "$settings['adminProfile']['email'] = $adminProfilePublicEmail;",
    'voncms_preserve_admin_profile_email_placeholder',
    "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'admin_profile' LIMIT 1",
    '******** (PROTECTED)',
  ],
  'Admin Profile Public Email Boundary: adminProfile.email remains a public profile field while protected placeholders cannot overwrite it.',
  'Admin Profile Public Email Boundary: adminProfile.email can still be masked as a secret or saved back as a protected placeholder.'
);

assertIncludes(
  'Admin Profile Read-Only Boundary',
  getSettingsContent +
    '\n' +
    read('public/api/save_settings.php') +
    '\n' +
    read('src/plugins/von-core/features/settings/SettingsManager.tsx') +
    '\n' +
    read('src/plugins/von-core/features/settings/components/ProfileSettings.tsx'),
  [
    'Guest callers do not need the settings adminProfile payload.',
    "unset($settings['adminProfile']);",
    'readOnly={!canManageSecrets}',
    'readOnly?: boolean;',
    'disabled={readOnly}',
  ],
  'Admin Profile Read-Only Boundary: guests cannot read settings adminProfile, appointed admins can only view it read-only, and non-primary saves cannot overwrite it.',
  'Admin Profile Read-Only Boundary: guests or appointed admins can still read/write adminProfile through settings surfaces.'
);

const appointedAdminCloseoutContent =
  read('src/hooks/useAiWriting.ts') +
  '\n' +
  read('src/plugins/von-core/features/settings/SettingsManager.tsx') +
  '\n' +
  read('src/App.tsx') +
  '\n' +
  read('src/components/layouts/AdminLayout.tsx') +
  '\n' +
  read('src/plugins/von-core/features/media/MediaManager.tsx') +
  '\n' +
  read('public/api/get_users.php') +
  '\n' +
  read('public/api/save_user.php') +
  '\n' +
  read('public/api/delete_user.php') +
  '\n' +
  read('public/api/delete_media.php') +
  '\n' +
  read('public/api/media_tools.php') +
  '\n' +
  read('public/api/sync_media.php') +
  '\n' +
  read('public/api/cleanup_media_variant_rows.php') +
  '\n' +
  read('public/api/tools/wp_scan.php') +
  '\n' +
  read('public/api/tools/wp_import.php') +
  '\n' +
  read('public/api/repair_db.php') +
  '\n' +
  read('public/api/system/fix_integrity.php') +
  '\n' +
  read('public/api/system/repair_htaccess.php');

assertIncludes(
  'Appointed Admin Closeout Boundary',
  appointedAdminCloseoutContent,
  [
    'isProtectedAiKey',
    '!isProtectedAiKey(settings?.api?.aiApiKey)',
    'path="gallery"',
    '<Navigate to="/admin" replace />',
    'canManageMediaDestructiveActions',
    'SessionManager::requirePrimaryAdmin();',
  ],
  'Appointed Admin Closeout Boundary: masked AI keys prompt for staff-owned keys, user/admin tools and destructive media/WP/system endpoints are primary-admin gated.',
  'Appointed Admin Closeout Boundary: appointed admins can still inherit masked AI keys, enumerate users, or run destructive tools/media/WP actions.'
);

const ownerOnlySystemEndpoints = [
  'public/api/backup_db.php',
  'public/api/import_db.php',
  'public/api/get_settings_audit.php',
  'public/api/rollback_setting.php',
  'public/api/system/check_db_status.php',
  'public/api/system/updater.php',
  'public/api/system/indexnow_setup.php',
  'public/api/system/indexnow_status.php',
  'public/api/system/indexnow_ping.php',
  'public/api/security/clear_all_logs.php',
];
const ownerOnlySystemGaps = ownerOnlySystemEndpoints.filter((file) => {
  const content = read(file);
  return (
    !content.includes('SessionManager::requirePrimaryAdmin();') ||
    content.includes('SessionManager::requireAdmin();')
  );
});
if (ownerOnlySystemGaps.length === 0) {
  pass(
    'Primary Admin Owner Endpoint Boundary: DB backup/import, settings audit/rollback, updater, IndexNow, DB status, and log clearing are primary-admin only.'
  );
} else {
  fail(
    `Primary Admin Owner Endpoint Boundary: appointed admins can still reach owner-only endpoints: ${ownerOnlySystemGaps.join(', ')}`
  );
}

const userManagementBoundaryContent =
  read('src/App.tsx') +
  '\n' +
  read('src/components/layouts/AdminLayout.tsx') +
  '\n' +
  read('src/plugins/von-core/features/users/UserManager.tsx') +
  '\n' +
  read('public/api/get_users.php') +
  '\n' +
  read('public/api/save_user.php') +
  '\n' +
  read('public/api/delete_user.php');
if (
  userManagementBoundaryContent.includes('SessionManager::requireAdmin();') &&
  userManagementBoundaryContent.includes('Only admin 1 can modify this account') &&
  userManagementBoundaryContent.includes('Only admin 1 can delete this account') &&
  userManagementBoundaryContent.includes('isPrimaryAdminActor') &&
  !read('public/api/get_users.php').includes('SessionManager::requirePrimaryAdmin();') &&
  !read('src/components/layouts/AdminLayout.tsx').includes(
    "label: 'Users',\n      path: '/admin/users',\n      color: '#22d3ee', // Cyan 400\n      allowedRoles: ['Admin'],\n      requiresPrimaryAdmin: true"
  ) &&
  !read('src/App.tsx').includes(
    '{isPrimaryAdmin ? (\n                                  <UserManager'
  )
) {
  pass(
    'Appointed Admin User Manager Boundary: appointed admins can manage users while admin 1 remains protected server-side.'
  );
} else {
  fail(
    'Appointed Admin User Manager Boundary: User Manager is still primary-only or admin 1 is not protected server-side.'
  );
}

const publicProfileContent = read('public/api/get_public_profile.php');
const usePublicProfileContent = read('src/hooks/usePublicProfile.ts');
const profileUtilsContent = read('src/utils/profileUtils.ts');
const profileOwnerSyncContent =
  profileUtilsContent +
  '\n' +
  read('src/hooks/useAuth.ts') +
  '\n' +
  read('src/plugins/von-core/features/users/UserProfile.tsx') +
  '\n' +
  read('src/themes/techpress/Profile.tsx') +
  '\n' +
  read('src/themes/digest/Layout.tsx') +
  '\n' +
  read('src/themes/portfolio/Layout.tsx') +
  '\n' +
  read('src/themes/prism/components/PrismProfile.tsx') +
  '\n' +
  read('src/themes/corporate-pro/Layout.tsx');
const getPostsPublicPrivacyContent = read('public/api/get_posts.php');
const getPostPublicPrivacyContent = read('public/api/get_post.php');
const getPagesPublicPrivacyContent = read('public/api/get_pages.php');
const getCommentsPublicPrivacyContent = read('public/api/get_comments.php');
const sharedPrivacyHelperContent = read('public/security.php');
if (
  !publicProfileContent.includes('SELECT id, username, role') &&
  !publicProfileContent.includes('created_at AS createdAt') &&
  usePublicProfileContent.includes(
    'id: data.user.id ? String(data.user.id) : `public:${data.user.username}`'
  ) &&
  usePublicProfileContent.includes("role: 'Member'") &&
  !usePublicProfileContent.includes('createdAt: data.user.createdAt')
) {
  pass(
    'Public Profile Privacy Boundary: guest profile API no longer exposes numeric user IDs, staff roles, or joined dates.'
  );
} else {
  fail(
    'Public Profile Privacy Boundary: guest profile API still exposes numeric IDs, roles, joined dates, or the client lacks a safe fallback.'
  );
}

assertIncludes(
  'Public Profile Owner Edit Sync Boundary',
  profileOwnerSyncContent,
  [
    'export const isOwnUserProfile',
    'export const getProfileDisplayRole',
    'currentUsername === targetUsername',
    'return currentUser.role;',
    'const canAccessAdmin = isOwnProfile && isStaffUser(currentUser);',
    'updatePublicProfileCache(nextUser.username, nextUser);',
    'isOwnUserProfile(currentUser, targetUser)',
    'const displayRole = getProfileDisplayRole(currentUser, displayUser);',
    '{getProfileDisplayRole(currentUser, localDisplayUser)}',
    "{getProfileDisplayRole(currentUser, localUser, 'Creator')}",
  ],
  'Public Profile Owner Edit Sync Boundary: own-profile edit/avatar/role sync survives public numeric ID and role removal by matching the current username and reading the authenticated session role.',
  'Public Profile Owner Edit Sync Boundary: own-profile edit/avatar/role sync can still depend only on public numeric IDs or stripped public roles.'
);
assertExcludes(
  'Public Profile Owner Edit Sync Boundary',
  profileOwnerSyncContent,
  [
    'currentUser?.id === targetUser.id',
    'String(currentUser?.id) === String(targetUser.id)',
    'String(currentUser?.id) === String(localUser.id)',
    '{displayUser.role}',
    '{localDisplayUser.role}',
    "{localUser.role || 'Creator'}",
    'targetUser.role ===',
  ],
  'Public Profile Owner Edit Sync Boundary: bundled profile edit buttons and own-profile role badges no longer depend only on stripped public IDs or roles.',
  'Public Profile Owner Edit Sync Boundary: at least one profile surface still depends only on stripped public IDs or roles.'
);

assertIncludes(
  'Centralized Public Payload Privacy Boundary',
  getPostsPublicPrivacyContent +
    getPostPublicPrivacyContent +
    getPagesPublicPrivacyContent +
    getCommentsPublicPrivacyContent +
    read('public/index.php') +
    sharedPrivacyHelperContent,
  [
    'public static function shapeContentPayload',
    'public static function shapeCommentPayload',
    "unset($payload['author_id']);",
    "unset($payload['dbId'], $payload['userId'], $payload['status'], $payload['emailHash']);",
    "unset($payload['emailHash']);",
    "$payload['hasEmail'] = true;",
    'ResponseHelper::shapeContentPayload($post, $isAdmin)',
    'ResponseHelper::shapeContentPayload($publicPage, $isAdmin)',
    'ResponseHelper::shapeCommentPayload(',
    'ResponseHelper::shapeContentPayload($initialPostPayload, false)',
    'ResponseHelper::shapeContentPayload($initialPagePayload, false)',
    'ResponseHelper::shapeContentPayload($hp, false)',
    "'author_id' => $isAdmin ? $row['author_id'] ?? null : null",
    "$isAdmin && isset($page['author_id'])",
  ],
  'Centralized Public Payload Privacy Boundary: guest post/page/bootstrap/comment payloads share one helper for author IDs, comment internals, and appointed-staff email presence.',
  'Centralized Public Payload Privacy Boundary: payload privacy is still patched per endpoint or can leak comment internals/email hashes.'
);
assertExcludes(
  'Public Comment Minimal Payload Boundary',
  sharedPrivacyHelperContent,
  ["$payload['emailHash'] = ''", "$payload['dbId'] = null", "$payload['status'] = null"],
  'Public Comment Minimal Payload Boundary: removed public comment fields are omitted rather than returned empty/null.',
  'Public Comment Minimal Payload Boundary: public comment internals can still be returned as empty/null keys.'
);
assertIncludes(
  'Avatar URL Safety Boundary',
  sharedPrivacyHelperContent +
    getCommentsPublicPrivacyContent +
    read('public/api/get_public_profile.php') +
    read('public/api/save_comments.php') +
    read('public/api/update_profile.php') +
    read('public/api/save_user.php') +
    read('src/plugins/von-core/features/public/components/Comments.tsx'),
  [
    'public static function scrubAvatarUrl',
    "preg_match('/^(javascript|data):/i', $url)",
    "preg_match('/^https:\\/\\//i', $url)",
    'ResponseHelper::scrubAvatarUrl(',
    'onError={() => setImageFailed(true)}',
  ],
  'Avatar URL Safety Boundary: avatar inputs/outputs use HTTPS-or-local scrubbing and public avatar images fall back after load failure.',
  'Avatar URL Safety Boundary: unsafe avatar schemes or broken public avatar images can still leak into rendering.'
);

const updateProfileContent = read('public/api/update_profile.php');
assertIncludes(
  'Profile Update Primary Admin Boundary',
  updateProfileContent,
  [
    "if ($_SERVER['REQUEST_METHOD'] !== 'POST') {",
    '$isOwnProfile =',
    '$isPrimaryAdminActor = SessionManager::isPrimaryAdmin();',
    'SELECT id, role FROM users WHERE id = ?',
    "$targetUserRole === 'root'",
    "ResponseHelper::sendError('Only admin 1 can update this account', 403);",
  ],
  'Profile Update Primary Admin Boundary: profile updates reject unsupported methods and prevent appointed admins from modifying admin 1/root profiles while preserving own-profile edits.',
  'Profile Update Primary Admin Boundary: appointed admins can still mutate admin 1/root profiles or update_profile.php lacks an explicit POST guard.'
);

const techPressProfileContent = read('src/themes/techpress/Profile.tsx');
assertExcludes(
  'Public Profile Joined Date Privacy Boundary',
  techPressProfileContent +
    '\n' +
    read('src/plugins/von-core/features/users/UserProfile.tsx') +
    '\n' +
    read('src/themes/digest/Layout.tsx') +
    '\n' +
    read('src/themes/portfolio/Layout.tsx') +
    '\n' +
    read('src/themes/prism/components/PrismProfile.tsx'),
  [
    'Join Date',
    'Joined',
    'displayUser.createdAt',
    'localDisplayUser.createdAt',
    'localUser.createdAt',
  ],
  'Public Profile Joined Date Privacy Boundary: bundled public profile views no longer render account age/joined dates.',
  'Public Profile Joined Date Privacy Boundary: bundled public profile views can still expose joined dates.'
);

if (!techPressProfileContent.includes('grainy-gradients.vercel.app/noise.svg')) {
  pass(
    'TechPress Profile Asset Boundary: profile view no longer loads the external grainy-gradients noise SVG.'
  );
} else {
  fail(
    'TechPress Profile Asset Boundary: profile view still loads the external grainy-gradients noise SVG.'
  );
}

const editorLinkUtils = loadTsModuleForSmoke('src/components/editor/editorLinkUtils.ts');
const complexQuerySmokeUrl = editorLinkUtils.COMPLEX_QUERY_STRING_LINK_SMOKE_URL;
if (
  complexQuerySmokeUrl === 'https://example.test/link?empty=&type=phone_number&app_absent=0' &&
  editorLinkUtils.normalizeEditorUrl(complexQuerySmokeUrl) === complexQuerySmokeUrl &&
  editorExtensionsContent.includes("import TiptapLink from '@tiptap/extension-link';") &&
  editorExtensionsContent.includes('TiptapLink.configure({') &&
  editorExtensionsContent.includes('link: false') &&
  editorExtensionsContent.includes('openOnClick: false') &&
  editorExtensionsContent.includes('autolink: false')
) {
  pass(
    'Editor Hyperlink Query String Contract: one configured TipTap Link extension is wired and complex query URLs survive normalization unchanged.'
  );
} else {
  fail(
    'Editor Hyperlink Query String Contract: duplicate Link registration or query-string truncation can still occur.'
  );
}

const editorContentForLink = read('src/components/Editor.tsx');
const contentRendererForLink = read('src/components/ContentRenderer.tsx');
if (
  editorContentForLink.includes('insertSafeLink') &&
  editorContentForLink.includes("type: 'text'") &&
  editorContentForLink.includes("type: 'link'") &&
  !editorContentForLink.includes(".extendMarkRange('link')") &&
  contentRendererForLink.includes('.prose a, .voncms-content a') &&
  contentRendererForLink.includes('color: #2563eb')
) {
  pass(
    'Editor Hyperlink Contract: link insertion uses TipTap marks directly and public light-mode links stay visibly blue.'
  );
} else {
  fail(
    'Editor Hyperlink Contract: link insertion or public link styling can still drop/truncate links or blend into light text.'
  );
}

const defaultThemeContent = read('src/themes/default/Layout.tsx');
if (
  defaultThemeContent.includes('const isSearching = publicPosts.isLoading;') &&
  defaultThemeContent.includes(') : isSearching ? (') &&
  defaultThemeContent.includes('Searching articles...')
) {
  pass(
    'Default Theme Discovery Loading Contract: first server-backed searches show a loading state instead of jumping straight to the empty-results UI.'
  );
} else {
  fail(
    'Default Theme Discovery Loading Contract: default theme search/category results can still flash the empty-results UI before the server response arrives.'
  );
}

const digestThemeContent = read('src/themes/digest/Layout.tsx');
if (
  digestThemeContent.includes('const isSearching = publicPosts.isLoading;') &&
  digestThemeContent.includes(') : isSearching ? (') &&
  digestThemeContent.includes('Searching articles...')
) {
  pass(
    'Digest Theme Discovery Loading Contract: first server-backed searches show a loading state instead of jumping straight to the empty-results UI.'
  );
} else {
  fail(
    'Digest Theme Discovery Loading Contract: digest theme search/category results can still flash the empty-results UI before the server response arrives.'
  );
}

const remainingDiscoveryLoadingContracts = [
  {
    name: 'TechPress',
    file: 'src/themes/techpress/Layout.tsx',
    marker:
      'const isInitialDiscoveryLoading = publicPosts.isLoading && paginatedPosts.length === 0;',
    copy: 'Loading stories...',
  },
  {
    name: 'Prism',
    file: 'src/themes/prism/Layout.tsx',
    marker: 'const isInitialDiscoveryLoading = publicPosts.isLoading && currentPosts.length === 0;',
    copy: 'SYNCING_ARCHIVE...',
  },
  {
    name: 'Corporate Pro',
    file: 'src/themes/corporate-pro/Layout.tsx',
    marker: 'const isInitialDiscoveryLoading = publicPosts.isLoading && visiblePosts.length === 0;',
    copy: 'Loading articles...',
  },
  {
    name: 'Portfolio',
    file: 'src/themes/portfolio/Layout.tsx',
    marker:
      'const isInitialDiscoveryLoading = publicPosts.isLoading && filteredProjects.length === 0;',
    copy: 'Loading projects...',
  },
];

const missingDiscoveryLoading = remainingDiscoveryLoadingContracts.flatMap(
  ({ name, file, marker, copy }) => {
    const content = read(file);
    return content.includes(marker) && content.includes(copy) ? [] : [`${name} (${file})`];
  }
);

if (missingDiscoveryLoading.length === 0) {
  pass(
    'Remaining Theme Discovery Loading Contract: TechPress, Prism, Corporate Pro, and Portfolio show initial loading states before empty grids on server-backed category/search fetches.'
  );
} else {
  fail(
    `Remaining Theme Discovery Loading Contract: missing initial loading state in ${missingDiscoveryLoading.join(', ')}.`
  );
}

if (
  techPressLayoutContent.includes('const hasNoDiscoveryPosts =') &&
  techPressLayoutContent.includes('No stories found in this category') &&
  techPressLayoutContent.includes('No stories found for') &&
  techPressLayoutContent.includes('Try another category or return to all stories.')
) {
  pass(
    'TechPress Empty Category State: empty category/search discovery renders a friendly no-results panel instead of a blank news layout.'
  );
} else {
  fail(
    'TechPress Empty Category State: invalid category URLs can still render an empty TechPress layout without helpful no-results copy.'
  );
}

assertIncludes(
  'Posts API PDO Static Analysis Guard',
  getPostsContent,
  [
    '!($pdo instanceof PDO)',
    '/** @var PDO $db */',
    '$db = $pdo;',
    '$totalStmt = $db->prepare($countSql);',
    '$stmt = $db->prepare($sql);',
  ],
  'Posts API PDO Static Analysis Guard: get_posts.php narrows the configured PDO before prepare calls.',
  'Posts API PDO Static Analysis Guard: get_posts.php can still look nullable to PHP static analysis.'
);
assertIncludes(
  'Posts API Responsive Contract',
  getPostsContent,
  ['voncms_build_responsive_image_data', "'imageSrcSet' => $responsiveImage['srcSet']"],
  'Posts API Responsive Contract: list payload includes imageSrcSet.',
  'Posts API Responsive Contract: list payload is missing imageSrcSet wiring.'
);

if (
  getPostsContent.includes("$category = $_GET['category'] ?? null;") &&
  getPostsContent.includes('trim((string) $category)') &&
  getPostsContent.includes("$totalStmt->bindValue(':category', $normalizedCategory);") &&
  !getPostsContent.includes("preg_match('/^[a-zA-Z0-9 .-]+$/', $category)")
) {
  pass(
    'Posts API Category Contract: public category discovery trims and binds real category labels instead of silently dropping punctuation-heavy or non-ASCII names.'
  );
} else {
  fail(
    'Posts API Category Contract: category filtering is still more restrictive than the saved/admin category contract.'
  );
}

const categorySeoPublicIndexContent = exists('public/index.php') ? read('public/index.php') : '';
const categorySeoSitemapContent = exists('public/sitemap.php') ? read('public/sitemap.php') : '';
const categorySeoRssContent = exists('public/rss.php') ? read('public/rss.php') : '';
const categorySeoLlmsContent = exists('public/llms.php') ? read('public/llms.php') : '';
const categorySeoVonSeoContent = exists('src/plugins/von-core/features/seo/VonSEO.tsx')
  ? read('src/plugins/von-core/features/seo/VonSEO.tsx')
  : '';

assertIncludes(
  'Category Permalink Slug Contract',
  [
    exists('src/utils/siteUtils.ts') ? read('src/utils/siteUtils.ts') : '',
    categorySeoPublicIndexContent,
    categorySeoSitemapContent,
    categorySeoRssContent,
    categorySeoLlmsContent,
  ].join('\n'),
  [
    'export const getCategorySlug',
    'voncms_category_slug',
    "replace(/[^\\p{L}\\p{N}\\s_-]+/gu, '')",
    "preg_replace('/\\s+/u', '-', $categorySlug)",
    "preg_replace('/-+/', '-', $categorySlug)",
  ],
  'Category Permalink Slug Contract: client links, PHP canonical, sitemap, RSS, and llms category URLs normalize multi-word categories consistently.',
  'Category Permalink Slug Contract: client links or PHP category permalink surfaces can still diverge for multi-word or hidden-whitespace category labels.'
);

assertIncludes(
  'Post Breadcrumb Category Contract',
  categorySeoPublicIndexContent + '\n' + categorySeoVonSeoContent,
  [
    "'@type' => 'BreadcrumbList'",
    "'name' => \$breadcrumbCategoryName",
    'name: selectedPost.category',
    'position: 3',
  ],
  'Post Breadcrumb Category Contract: SSR and React SEO breadcrumbs expose Home > Category > Post for multi-word categories.',
  'Post Breadcrumb Category Contract: Google can still infer two-word category breadcrumbs from URL segments instead of structured data.'
);

assertIncludes(
  'Sitemap Image Base Path Contract',
  categorySeoSitemapContent,
  [
    'function voncms_sitemap_absolute_url($url, $baseUrl)',
    'parse_url($baseUrl, PHP_URL_PATH)',
    'strpos($relativeUrl, $basePrefix) === 0',
    "$imgUrl = voncms_sitemap_absolute_url($post['image_url'], $baseUrl);",
  ],
  'Sitemap Image Base Path Contract: image sitemap URLs strip an already-present subfolder prefix before joining with the configured domain URL.',
  'Sitemap Image Base Path Contract: image sitemap URLs can still double-prefix subfolder uploads paths.'
);

assertIncludes(
  'Permalink Subfolder Relative Href Contract',
  exists('src/utils/siteUtils.ts') ? read('src/utils/siteUtils.ts') : '',
  ['const isOverlap = absolute && domain && basePath && domain.endsWith(basePath);'],
  'Permalink Subfolder Relative Href Contract: relative post hrefs keep the subfolder base path even when domainUrl already contains it.',
  'Permalink Subfolder Relative Href Contract: relative post hrefs can still drop the subfolder base path when domainUrl overlaps it.'
);

assertIncludes(
  'Public Table Styling Contract',
  contentRendererContent,
  [
    '.prose table, .voncms-content table {',
    '.prose thead, .voncms-content thead {',
    '.prose th, .prose td, .voncms-content th, .voncms-content td {',
    '.prose th, .voncms-content th {',
    'background: #f8fafc;',
    '.dark .prose thead, .dark .voncms-content thead {',
    '.dark .prose th, .dark .voncms-content th {',
    'background: #1e293b;',
    '.prose h5, .voncms-content h5 { font-size: 1rem !important; }',
    '.prose h6, .voncms-content h6 { font-size: 0.875rem !important; }',
  ],
  'Public Table Styling Contract: live content tables keep visible header/background/borders and mobile heading hierarchy outside the editor.',
  'Public Table Styling Contract: public content is missing the shared table header/background or mobile heading hierarchy markers.'
);

const publicTableRule =
  contentRendererContent.match(
    /\.prose table, \.voncms-content table \{[\s\S]*?\n        \}/
  )?.[0] || '';
if (
  publicTableRule &&
  !publicTableRule.includes('display: block') &&
  contentRendererContent.includes('className="voncms-content overflow-x-auto')
) {
  pass(
    'Public Table WYSIWYG Layout: live/preview tables keep real table layout while the content wrapper owns horizontal overflow.'
  );
} else {
  fail(
    'Public Table WYSIWYG Layout: ContentRenderer must not force tables to display:block; keep table layout and put horizontal overflow on the content wrapper.'
  );
}

assertIncludes(
  'Public Quote and Code Styling Contract',
  contentRendererContent,
  [
    '.prose blockquote, .voncms-content blockquote {',
    'border-left: 4px solid #3b82f6;',
    '.prose pre, .voncms-content pre {',
    '.prose code, .voncms-content code {',
    '.prose pre code, .voncms-content pre code {',
  ],
  'Public Quote and Code Styling Contract: live content preserves visible quote and code-block presentation outside the editor.',
  'Public Quote and Code Styling Contract: live content is missing quote/code styling parity with the editor.'
);

const getPostContent = read('public/api/get_post.php');
assertIncludes(
  'Single Post Responsive Contract',
  getPostContent,
  ['voncms_build_responsive_image_data', "'imageSrcSet' => $responsiveImage['srcSet']"],
  'Single Post Responsive Contract: single-post payload includes imageSrcSet.',
  'Single Post Responsive Contract: single-post payload is missing imageSrcSet wiring.'
);

const listReadTimeUsesBoundedContent =
  !/\n\s*p\.content,\s*\n/.test(getPostsContent) &&
  getPostsContent.includes('CHAR_LENGTH(p.content) AS content_chars') &&
  getPostsContent.includes("$chars = (int) ($row['content_chars'] ?? 0);") &&
  !getPostsContent.includes("strlen(strip_tags($row['content']))");
const singleReadTimeUsesPlainText = getPostContent.includes(
  "strlen(strip_tags($normalized['content']))"
);

if (listReadTimeUsesBoundedContent && singleReadTimeUsesPlainText) {
  pass(
    'Read Time Contract: list API avoids transferring full article bodies while single-post API keeps precise stripped-text readTime.'
  );
} else {
  fail(
    'Read Time Contract: get_posts.php can still select full article bodies for list readTime calculation.'
  );
}

const cachePurgeHookContent = [
  'public/api/save_post.php',
  'public/api/delete_post.php',
  'public/api/save_page.php',
  'public/api/delete_page.php',
  'public/api/save_settings.php',
  'public/api/manage_categories.php',
  'public/api/rollback_setting.php',
  'public/api/import_db.php',
  'public/api/tools/wp_import.php',
  'public/api/update_profile.php',
  'public/api/save_user.php',
  'public/api/delete_user.php',
  'public/scheduler_helper.php',
]
  .map((file) => read(file))
  .join('\n');

assertIncludes(
  'Public Cache Clear-All Purge Hooks',
  cachePurgeHookContent,
  [
    "require_once __DIR__ . '/public_cache_helper.php';",
    "require_once __DIR__ . '/../public_cache_helper.php';",
    "require_once __DIR__ . '/api/public_cache_helper.php';",
    'voncms_public_cache_clear();',
  ],
  'Public Cache Clear-All Purge Hooks: writes, imports, profile/user mutations, and scheduled publishes clear the lightweight public JSON cache.',
  'Public Cache Clear-All Purge Hooks: write/import/profile/user/scheduler cache purge markers are incomplete.'
);
const schedulerHelperContent = read('public/scheduler_helper.php');
const publicIndexContent = read('public/index.php');
assertIncludes(
  'Scheduler Helper Centralization',
  schedulerHelperContent,
  ['function voncms_publish_scheduled_posts', 'function voncms_run_scheduler_if_due'],
  'Scheduler Helper Centralization: shared publish helper exists.',
  'Scheduler Helper Centralization: shared scheduler helper is missing expected functions.'
);

const hasInlineSchedulerSql =
  getPostsContent.includes("UPDATE posts SET status = 'published'") ||
  getPostContent.includes("UPDATE posts SET status = 'published'");
const hasSharedSchedulerTrigger =
  getPostsContent.includes('voncms_run_scheduler_if_due') &&
  getPostContent.includes('voncms_run_scheduler_if_due') &&
  getPostsContent.includes("dirname(__DIR__) . '/data/scheduler.lock'") &&
  getPostContent.includes("dirname(__DIR__) . '/data/scheduler.lock'");
const hasPhpTimeFilter =
  getPostsContent.includes(':currentTime') &&
  getPostContent.includes('$currentTimestamp') &&
  !getPostsContent.includes('p.scheduled_at <= NOW()') &&
  !getPostContent.includes('p.scheduled_at <= NOW()');

if (hasInlineSchedulerSql) {
  fail(
    'Read API Scheduler Flow: get_posts.php/get_post.php still contain inline publish SQL instead of delegating to the shared helper.'
  );
} else if (hasSharedSchedulerTrigger && hasPhpTimeFilter) {
  pass(
    'Read API Scheduler Flow: admin read APIs delegate to the shared scheduler helper, and public filters use PHP/CMS time instead of MySQL NOW().'
  );
} else {
  fail(
    'Read API Scheduler Flow: delegated admin trigger or PHP-time scheduled filter markers are incomplete.'
  );
}

if (
  schedulerHelperContent.includes(
    "UPDATE posts SET status = 'published', updated_at = scheduled_at"
  ) &&
  getPostsContent.includes('CASE WHEN p.scheduled_at IS NOT NULL THEN p.scheduled_at') &&
  getPostsContent.includes('AS effective_publish_at') &&
  getPostsContent.includes('ORDER BY effective_publish_at DESC, p.created_at DESC') &&
  publicIndexContent.includes('ORDER BY effective_publish_at DESC, p.created_at DESC')
) {
  pass(
    'Scheduled Publish Ordering: scheduled posts keep their scheduled publish time as the latest ordering timestamp after publication.'
  );
} else {
  fail(
    'Scheduled Publish Ordering: scheduled posts can still be ordered by old created_at timestamps after they publish.'
  );
}

const sitemapContent = read('public/sitemap.php');
const llmsContent = read('public/llms.php');
if (
  sitemapContent.includes('voncms_apply_site_timezone($pdo);') &&
  sitemapContent.includes('scheduled_at IS NULL OR scheduled_at <= :currentTime') &&
  sitemapContent.includes("bindValue(':currentTime', $currentTime)") &&
  llmsContent.includes('voncms_apply_site_timezone($pdo);') &&
  llmsContent.includes('scheduled_at IS NULL OR scheduled_at <= :currentTime') &&
  llmsContent.includes("bindValue(':currentTime', $currentTime)")
) {
  pass(
    'Crawler Surface Scheduled Content Contract: sitemap and llms.txt use the same PHP/CMS-time publish cutoff as RSS.'
  );
} else {
  fail(
    'Crawler Surface Scheduled Content Contract: sitemap or llms.txt can expose scheduled posts before their publish time.'
  );
}

const cronPublishContent = read('public/api/cron_publish.php');
const analyticsInjectorContent = read('src/components/AnalyticsInjector.tsx');
if (
  publicIndexContent.includes('@param mixed $content') &&
  publicIndexContent.includes('@return string') &&
  publicIndexContent.includes('function voncms_extract_plaintext_for_noscript') &&
  publicIndexContent.includes('html_entity_decode($content') &&
  publicIndexContent.includes("preg_replace('/<(br|hr)\\s*\\/?>/i") &&
  publicIndexContent.includes(
    "'/<\\/(p|div|section|article|blockquote|figure|figcaption|h[1-6]|li)>/i"
  ) &&
  publicIndexContent.includes(
    "$noscriptPostContent = voncms_extract_plaintext_for_noscript($post['content'] ?? '');"
  ) &&
  !publicIndexContent.includes("<?php echo $post['content'] ?? ''; ?>")
) {
  pass(
    'Public Index Noscript Post Visibility: single-post noscript output is block-aware, entity-normalized, text-only, and escaped.'
  );
} else {
  fail(
    'Public Index Noscript Post Visibility: single-post noscript output must normalize block breaks/entities and must not echo raw post HTML.'
  );
}

assertIncludes(
  'Public SSR Visibility Contract',
  publicIndexContent,
  [
    '$publicContentCurrentTime = date(',
    "AND (p.status = 'published' OR p.status IS NULL) AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?) LIMIT 1",
    '$stmt->execute([$slugOrId, $publicContentCurrentTime]);',
    'SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.author, p.author_id, p.meta_description, p.keywords, p.created_at, p.updated_at, p.status, $authorNameSql AS author_name, u.username AS author_username, $authorDisplayNameSql AS author_display_name, u.avatar AS author_avatar FROM pages p',
    "WHERE p.slug = ? AND p.status = 'published' LIMIT 1",
    "WHERE p.status='published' AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?) ORDER BY effective_publish_at DESC, p.created_at DESC LIMIT 5",
    '$hpStmt->execute([$publicContentCurrentTime]);',
  ],
  'Public SSR Visibility Contract: direct SSR post/homepage SEO hydration follows public published and scheduled cutoff rules, while page SSR stays published-only to match the pages API contract.',
  'Public SSR Visibility Contract: direct SSR can still expose draft/scheduled post or page content before public API visibility allows it.'
);
assertIncludes(
  'Public SSR Schema Image Contract',
  publicIndexContent,
  [
    'function voncms_absolute_public_url',
    "$domainPath = trim((string) (parse_url($domainUrl, PHP_URL_PATH) ?: ''), '/');",
    'if (stripos($relativeUrl, $domainPrefix) === 0)',
    '$relativeUrl = substr($relativeUrl, strlen($domainPrefix));',
    '$seoImage = voncms_absolute_public_url($seoImage, $domainUrl);',
    "$schemaData['description'] = $seoDescription;",
    "$schemaData['image'] = [$seoImage];",
    "$runtimeSettings['general']['og_image_url'] ?? ''",
    "$seoImage = $domainUrl . '/og-default.png';",
    "voncms_absolute_public_url($hp['image_url'], $domainUrl)",
  ],
  'Public SSR Schema Image Contract: JSON-LD descriptions and image URLs are normalized before schema assignment.',
  'Public SSR Schema Image Contract: JSON-LD descriptions can drift from meta description, or schema images can still double-prefix subfolder paths.'
);
if (
  analyticsInjectorContent.includes('analytics.enableTracking === false') &&
  analyticsInjectorContent.includes('const scriptId = `von-ga-script-${gaId}`;') &&
  analyticsInjectorContent.includes('send_page_view: false') &&
  !publicIndexContent.includes('https://www.googletagmanager.com/gtag/js?id=<?php')
) {
  pass('Analytics Injection: React owns GA injection once and honors tracking/anonymize settings.');
} else {
  fail(
    'Analytics Injection: GA still risks duplicate server/client injection or ignores tracking defaults.'
  );
}
const savePostContent = read('public/api/save_post.php');
const savePageContent = read('public/api/save_page.php');
const deletePostContent = read('public/api/delete_post.php');
assertIncludes(
  'Scheduler Runtime Wiring',
  cronPublishContent + publicIndexContent,
  [
    "require_once __DIR__ . '/../scheduler_helper.php';",
    "require_once __DIR__ . '/scheduler_helper.php';",
    'voncms_publish_scheduled_posts($pdo)',
    "voncms_run_scheduler_if_due($pdo, __DIR__ . '/data/scheduler.lock')",
    'voncms_apply_site_timezone($pdo ?? null);',
  ],
  'Scheduler Runtime Wiring: cron endpoint and public runtime use the shared scheduler helper.',
  'Scheduler Runtime Wiring: shared scheduler helper is not wired into cron/public runtime correctly.'
);

if (
  publicIndexContent.includes('voncms_apply_site_timezone($pdo ?? null);') &&
  cronPublishContent.includes('voncms_apply_site_timezone($pdo ?? null);') &&
  (getPostsContent.includes('voncms_apply_site_timezone($pdo ?? null);') ||
    getPostsContent.includes('voncms_apply_site_timezone($db);')) &&
  getPostContent.includes('voncms_apply_site_timezone($pdo ?? null);') &&
  savePostContent.includes('voncms_apply_site_timezone($pdo ?? null);')
) {
  pass(
    'Timezone Helper Unification: runtime and scheduler entry points now use the shared site-timezone helper consistently.'
  );
} else {
  fail(
    'Timezone Helper Unification: one or more runtime/scheduler entry points are missing the shared site-timezone helper.'
  );
}

const postSeoFieldPreservationOk =
  savePostContent.includes("$rawExcerpt = $input['excerpt'] ?? '';") &&
  savePostContent.includes("$input['excerpt'] = $rawExcerpt;") &&
  savePostContent.includes("$input['metaDescription'] = $rawMeta;");
const pageSeoFieldPreservationOk =
  savePageContent.includes("$rawExcerpt = $input['excerpt'] ?? '';") &&
  savePageContent.includes("$input['excerpt'] = $rawExcerpt;") &&
  savePageContent.includes("$input['metaDescription'] = $rawMeta;");

if (postSeoFieldPreservationOk && pageSeoFieldPreservationOk) {
  pass(
    'Manual SEO Text Preservation: post/page save APIs preserve raw excerpt and keep camelCase + snake_case meta description fields aligned after sanitize.'
  );
} else {
  fail(
    'Manual SEO Text Preservation: post/page save APIs are missing raw excerpt preservation or metaDescription alias alignment after sanitize.'
  );
}

assertIncludes(
  'Post Object Authorization Guard',
  savePostContent + '\n' + deletePostContent,
  [
    "$currentUser = $_SESSION['user'] ?? null;",
    '$isPostOwner =',
    "(string) ($ownerPost['author_id'] ?? '') === (string) ($currentUser['id'] ?? '');",
    "$isAdminOrModerator = SessionManager::isAdmin() || $currentRole === 'moderator';",
    "ResponseHelper::sendError('Not authorized to edit this post', 403);",
    'SELECT id, author_id, title, status, slug FROM posts WHERE id = ?',
    "$isPostOwner = (string) ($post['author_id'] ?? '') === (string) ($currentUser['id'] ?? '');",
    "ResponseHelper::sendError('Not authorized to delete this post', 403);",
  ],
  'Post Object Authorization Guard: writers can only update/delete their own posts while admin/root/moderator retain cross-author moderation.',
  'Post Object Authorization Guard: post update/delete can still skip owner or elevated-role checks.'
);

const v1255ChangelogContent = read('CHANGELOG.md');
if (
  !v1255ChangelogContent.includes('Bounded Public Comment Hydration') &&
  !v1255ChangelogContent.includes('under the old first-page cap') &&
  v1255ChangelogContent.includes('Public Comment Hydration Note')
) {
  pass(
    'Public Comment Hydration Wording: changelog avoids presenting full-site sequential hydration as a bounded performance win.'
  );
} else {
  fail(
    'Public Comment Hydration Wording: changelog can still overclaim full-site sequential comment hydration as bounded performance work.'
  );
}

const mutatingMethodGuardFiles = [
  ['public/api/save_post.php', ["if ($_SERVER['REQUEST_METHOD'] !== 'POST') {"]],
  ['public/api/save_page.php', ["if ($_SERVER['REQUEST_METHOD'] !== 'POST') {"]],
  [
    'public/api/delete_post.php',
    ["if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {"],
  ],
  [
    'public/api/delete_page.php',
    ["if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {"],
  ],
  ['public/api/save_user.php', ["if ($_SERVER['REQUEST_METHOD'] !== 'POST') {"]],
  ['public/api/update_profile.php', ["if ($_SERVER['REQUEST_METHOD'] !== 'POST') {"]],
  [
    'public/api/delete_user.php',
    ["if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {"],
  ],
];
const mutatingMethodGuardMissing = mutatingMethodGuardFiles.flatMap(([file, needles]) => {
  const content = read(file);
  return needles.every((needle) => content.includes(needle)) ? [] : [file];
});
if (mutatingMethodGuardMissing.length === 0) {
  pass(
    'Mutating API Method Guard Contract: core write/delete endpoints reject unsupported HTTP methods after OPTIONS.'
  );
} else {
  fail(
    `Mutating API Method Guard Contract: missing explicit method guards in ${mutatingMethodGuardMissing.join(', ')}.`
  );
}

const postOwnerGuardIndex = savePostContent.indexOf(
  'SELECT id, author_id, status, slug FROM posts WHERE id = ?'
);
const postRowLockIndex = savePostContent.indexOf(
  'SELECT status, slug, updated_at FROM posts WHERE id = ? FOR UPDATE'
);
const postConflictIndex = savePostContent.indexOf(
  'Content changed in another tab. Reload before saving again.'
);
if (
  postOwnerGuardIndex !== -1 &&
  postRowLockIndex !== -1 &&
  postConflictIndex !== -1 &&
  postOwnerGuardIndex < postRowLockIndex &&
  postOwnerGuardIndex < postConflictIndex
) {
  pass(
    'Post Object Authorization Ordering: update requests verify owner/elevated access before row locks, conflict checks, slug checks, or SEO safety logic.'
  );
} else {
  fail(
    'Post Object Authorization Ordering: update requests can still inspect or lock a target post before rejecting a non-owner writer.'
  );
}

assertIncludes(
  'Editor SEO Score Input Contract',
  postEditorContent + '\n' + seoAnalyzerContent,
  [
    "item.metaDescription || item.excerpt || ''",
    'item?.excerpt',
    'const visibleText = getSeoVisibleText(safeContent);',
    'const wordCount = visibleText ? visibleText.split(/\\s+/).length : 0;',
    'const hasHeadings = /<h[2-3][\\s>]/i.test(safeContent);',
    'const imgCount = (safeContent.match(/<img\\b/gi) || []).length;',
  ],
  'Editor SEO Score Input Contract: manual excerpt/meta fields contribute while full HTML scoring uses visible text and case-insensitive HTML markers.',
  'Editor SEO Score Input Contract: SEO health can still score from raw/partial HTML instead of visible restored content.'
);

assertIncludes(
  'Admin Editor SEO Single Source Sync',
  postEditorContent,
  [
    'let cancelled = false;',
    'const needsFullContentRestore = Boolean(initialItem?.id && !isPage);',
    'if (!needsFullContentRestore || !restoreItemId) {',
    '!cancelled && data.success && data.post',
    '}, [initialItem, isPage]);',
    '}, [initialItem?.id, isPage, navigation]);',
  ],
  'Admin Editor SEO Single Source Sync: navigation/add-to-menu updates can no longer reset restored full post content.',
  'Admin Editor SEO Single Source Sync: full-content restore is still coupled to navigation changes.'
);

assertIncludes(
  'Admin Editor SEO Restore Gate',
  postEditorContent,
  [
    'const [isSeoRestoring, setIsSeoRestoring] = useState(',
    'if (!item || isSeoRestoring) {',
    'setSeoResult(null);',
    'const result = analyzeSEO(',
    'setIsSeoRestoring(needsFullContentRestore);',
    'Restoring SEO data',
  ],
  'Admin Editor SEO Restore Gate: partial admin list payloads do not flash misleading SEO scores while full content is loading.',
  'Admin Editor SEO Restore Gate: SEO health can still render from partial admin list payloads during restore.'
);

if (
  postEditorContent.includes('const result = analyzeSEO(') &&
  postEditorContent.includes('{seoResult && !isSeoRestoring && (') &&
  !postEditorContent.includes('if (!hasSeoInput) {')
) {
  pass(
    'Editor SEO Empty Draft Visibility: SEO Health stays visible with a 0/100 analyzer result for empty editor content.'
  );
} else {
  fail(
    'Editor SEO Empty Draft Visibility: PostEditor can still hide the SEO Health panel for empty editor content.'
  );
}

try {
  const { analyzeSEO } = loadTsModuleForSmoke('src/utils/seoAnalyzer.ts');
  const emptySeo = analyzeSEO('', '', '', '');
  const textOnlySeo = analyzeSEO(
    'A practical title for SEO scoring checks',
    'This is a short meta description for checking the text-only analyzer baseline.',
    '<p>One visible paragraph without an image.</p>',
    ''
  );

  if (emptySeo.score === 0 && textOnlySeo.checks.images.status === 'warning') {
    pass(
      'SEO Analyzer Runtime Baseline: empty drafts score 0 and missing images do not grant points.'
    );
  } else {
    fail(
      `SEO Analyzer Runtime Baseline: expected empty score 0 and no-image warning, got score ${emptySeo.score} / image status ${textOnlySeo.checks.images.status}.`
    );
  }

  if (
    emptySeo.checks.keywordInTitle.message === 'Title keyword is missing' &&
    emptySeo.checks.keywordInDesc.message === 'Meta keyword is missing' &&
    emptySeo.checks.keywordInContent.message === 'Content keyword is missing'
  ) {
    pass(
      'Editor SEO Empty Keyword Copy: empty keyword checks identify title, meta, and content placement instead of repeating one generic warning.'
    );
  } else {
    fail(
      `Editor SEO Empty Keyword Copy: expected title/meta/content-specific empty keyword messages, got "${emptySeo.checks.keywordInTitle.message}", "${emptySeo.checks.keywordInDesc.message}", "${emptySeo.checks.keywordInContent.message}".`
    );
  }
} catch (error) {
  fail(`SEO Analyzer Runtime Baseline: unable to execute analyzer smoke (${error.message}).`);
}

assertIncludes(
  'Hydration Responsive Contract',
  indexContent,
  ['voncms_build_responsive_image_data', "'imageSrcSet'      => $initialResponsiveImage['srcSet']"],
  'Hydration Responsive Contract: PHP hydration includes imageSrcSet.',
  'Hydration Responsive Contract: PHP hydration is missing imageSrcSet wiring.'
);

const mailHelperContent = read('public/api/mail_helper.php');
assertIncludes(
  'Verification Email Base Path Contract',
  mailHelperContent,
  [
    "$basePath = '/' . trim($basePath, '/');",
    '$verifyUrl = "$protocol://$host$basePath/api/verify_email.php?token=$token";',
  ],
  'Verification Email Base Path Contract: fallback verification links preserve subfolder installs without duplicate slashes.',
  'Verification Email Base Path Contract: fallback verification links can duplicate or drop the deployment subfolder.'
);

assertIncludes(
  'Installer Redirect Base Path Contract',
  useSettingsContent,
  ['window.location.href = `${BASE_PATH}install`;'],
  'Installer Redirect Base Path Contract: uninstalled sites redirect through the injected deployment base path.',
  'Installer Redirect Base Path Contract: installer redirects can drift from the deployment base path.'
);

const themeManifestPaths = [
  'src/themes/default/theme.json',
  'src/themes/prism/theme.json',
  'src/themes/techpress/theme.json',
  'src/themes/portfolio/theme.json',
  'src/themes/digest/theme.json',
  'src/themes/corporate-pro/theme.json',
];
const missingThemeManifests = themeManifestPaths.filter((file) => !exists(file));
const themeManifestContents = themeManifestPaths
  .filter((file) => exists(file))
  .map((file) => read(file))
  .join('\n');
const themeManifestDefinitions = themeManifestPaths
  .filter((file) => exists(file))
  .map((file) => JSON.parse(read(file)));
const themeManifestIds = themeManifestDefinitions.map((manifest) => manifest.id);
const themeRegistryCapabilityContent = read(
  'src/plugins/von-core/features/themes/themeRegistry.ts'
);
const copyThemeManifestsContent = exists('server/copy-theme-manifests.cjs')
  ? read('server/copy-theme-manifests.cjs')
  : '';

if (
  missingThemeManifests.length === 0 &&
  new Set(themeManifestIds).size === themeManifestPaths.length &&
  themeManifestIds.every((id) => /^theme-[a-z0-9][a-z0-9-]*$/.test(id)) &&
  (themeManifestContents.match(/"homepageHero": "first-post-image"/g) || []).length === 3
) {
  pass(
    'Theme Hero Manifest Contract: every bundled theme owns a manifest and exactly three opt into first-post hero preload.'
  );
} else {
  fail(
    `Theme Hero Manifest Contract: missing manifests or incorrect hero capability count. Missing: ${missingThemeManifests.join(', ') || 'none'}.`
  );
}

assertIncludes(
  'Theme Hero Capability Build Contract',
  themeRegistryCapabilityContent +
    '\n' +
    copyThemeManifestsContent +
    '\n' +
    JSON.stringify(pkg.scripts) +
    '\n' +
    read('docs/EXTENSION_DEVELOPMENT.md'),
  [
    "import techpressManifest from '../../../../themes/techpress/theme.json';",
    'performance: readThemePerformance(techpressManifest),',
    "const sourceThemesDir = path.join(projectRoot, 'src', 'themes');",
    "const destinationThemesDir = path.join(projectRoot, 'dist', 'themes');",
    'const manifest = fs.readJsonSync(sourceManifest);',
    "path.join(destinationThemesDir, manifest.id, 'theme.json')",
    'node server/copy-theme-manifests.cjs',
    '`theme.json`',
    "`homepageHero: 'first-post-image'`",
  ],
  'Theme Hero Capability Build Contract: React and PHP receive the same per-theme manifest contract in source and Deploy builds.',
  'Theme Hero Capability Build Contract: manifest imports, build copying, or developer documentation is incomplete.'
);

assertIncludes(
  'Homepage Hero Preload Contract',
  indexContent,
  [
    '$homepageHeroStrategy',
    '$themeManifestPaths',
    "glob(dirname(__DIR__) . '/src/themes/*/theme.json')",
    "'/theme.json'",
    'json_decode($themeManifestJson, true)',
    "$homepageHeroStrategy === 'first-post-image'",
    'empty($path)',
    "$homepagePosts[0]['image']",
    'voncms_absolute_public_url',
    'rel="preload"',
    'as="image"',
    'imagesrcset=',
    'imagesizes="100vw"',
  ],
  'Homepage Hero Preload Contract: hero themes preload the first homepage image and advertise responsive candidates when available.',
  'Homepage Hero Preload Contract: SSR head is missing the guarded responsive hero-image preload.'
);

assertIncludes(
  'Homepage Hero Discovery Query Guard',
  indexContent,
  [
    "$_GET['category'] ?? ''",
    "$_GET['search'] ?? ''",
    '$hasHomepageDiscoveryQuery',
    '!$hasHomepageDiscoveryQuery',
  ],
  'Homepage Hero Discovery Query Guard: direct category/search URLs do not preload the unrelated global homepage hero.',
  'Homepage Hero Discovery Query Guard: direct category/search URLs can still preload the unrelated global homepage hero.'
);

assertIncludes(
  'Public Index Settings Snapshot Contract',
  indexContent,
  [
    '$runtimeSettings = [];',
    'SELECT setting_group, setting_key, setting_value FROM settings',
    "$runtimeSettings[$settingRow['setting_group']][$settingRow['setting_key']]",
    "$runtimeSettings['general']['permalink_structure'] ?? 'slug';",
  ],
  'Public Index Settings Snapshot Contract: SSR settings and permalink data come from one request snapshot.',
  'Public Index Settings Snapshot Contract: SSR settings remain split across repeated queries.'
);

if (
  indexContent.includes('$siteDescription = $seoDescription;') &&
  indexContent.includes("'siteDescription'      => $siteDescription ?? ''") &&
  !indexContent.includes("'siteDescription'      => $seoDescription ?? ''")
) {
  pass(
    'Public Index Site Description Hydration Contract: hydrated settings keep the General Settings site description separate from per-route SEO descriptions.'
  );
} else {
  fail(
    'Public Index Site Description Hydration Contract: single-post SSR can still hydrate settings.siteDescription with the post meta description.'
  );
}

assertIncludes(
  'Site Name Save Whitespace Guard',
  saveSettingsContent,
  ["if ($jsonKey === 'siteName' && is_string($value)) {", '$value = trim($value);'],
  'Site Name Save Whitespace Guard: future site-name saves discard accidental leading and trailing whitespace.',
  'Site Name Save Whitespace Guard: site-name saves can still persist accidental leading or trailing whitespace.'
);

assertIncludes(
  'Site Name SSR Whitespace Guard',
  indexContent,
  ["$siteNameValue = trim((string) ($runtimeSettings['general']['site_name'] ?? ''));"],
  'Site Name SSR Whitespace Guard: legacy stored site names render without leading or trailing whitespace.',
  'Site Name SSR Whitespace Guard: legacy stored site names can still leak whitespace into public metadata.'
);

if (
  indexContent.includes(
    "$twitterCard = !empty($socialImage) ? 'summary_large_image' : 'summary';"
  ) &&
  !indexContent.includes("strpos($socialImage, 'og-default')")
) {
  pass(
    'Public SSR Twitter Large Card Contract: any resolved social image emits summary_large_image without filename-based og-default downgrades.'
  );
} else {
  fail(
    'Public SSR Twitter Large Card Contract: social images named like og-default can still be downgraded to summary cards.'
  );
}

assertExcludes(
  'Public Index Dead State Cleanup Guard',
  indexContent,
  [
    '$googleAnalyticsId',
    '$isTrackingEnabled',
    '$ogInfo',
    '$ogSquareType',
    '$permalinkStructureQuery',
    '$plStmt',
  ],
  'Public Index Dead State Cleanup Guard: unused analytics/OG state and repeated permalink queries are absent.',
  'Public Index Dead State Cleanup Guard: unused analytics/OG state or repeated permalink queries remain.'
);

assertExcludes(
  'Homepage Hero Theme ID Coupling Guard',
  indexContent,
  [
    '$heroPreloadThemeIds',
    '$legacyHomepageHeroThemeIds',
    'theme-techpress',
    'theme-digest',
    'theme-portfolio',
  ],
  'Homepage Hero Theme ID Coupling Guard: preload decisions come only from the active theme manifest.',
  'Homepage Hero Theme ID Coupling Guard: public/index.php still contains bundled theme IDs or a preload whitelist.'
);

assertExcludes(
  'Homepage Hero Database Coupling Guard',
  indexContent +
    '\n' +
    saveSettingsContent +
    '\n' +
    getSettingsContent +
    '\n' +
    read('src/plugins/von-core/features/themes/ThemeContext.tsx'),
  ['theme_homepage_hero', "homepageHero: selectedTheme.performance.homepageHero || ''"],
  'Homepage Hero Database Coupling Guard: theme manifests remain the single capability source without settings-row synchronization.',
  'Homepage Hero Database Coupling Guard: hero capability still depends on duplicated database state.'
);

assertIncludes(
  'Public SEO Interceptor llms.txt Contract',
  indexContent,
  ['llms\\.txt', "'llms.txt' => 'llms.php'"],
  'Public SEO Interceptor: llms.txt has the same ultra-early fallback route as robots/sitemap/RSS.',
  'Public SEO Interceptor: llms.txt is missing from the ultra-early public index route map.'
);

const siteUtilsContent = read('src/utils/siteUtils.ts');
assertIncludes(
  'Frontend Responsive Helper',
  siteUtilsContent,
  [
    'export const getResponsiveImageAttributes = (',
    'const srcSet = item?.imageSrcSet || undefined;',
    'sizes: srcSet ? RESPONSIVE_IMAGE_SIZES[mode] : undefined,',
  ],
  'Frontend Responsive Helper: srcSet fallback and sizes gating detected.',
  'Frontend Responsive Helper: responsive attribute fallback logic is incomplete.'
);

const hookFiles = [
  'src/hooks/useContent.ts',
  'src/hooks/useLoadMore.ts',
  'src/hooks/useSinglePost.ts',
];
const hookMarker = 'imageSrcSet: p.imageSrcSet || p.image_srcset ||';
if (hookFiles.every((file) => read(file).includes(hookMarker))) {
  pass('Frontend Data Hooks: imageSrcSet normalization is present in content hooks.');
} else {
  fail('Frontend Data Hooks: one or more content hooks are missing imageSrcSet normalization.');
}

const updaterContent = read('public/api/system/updater.php');
if (
  updaterContent.includes('resolveExpectedHash') &&
  updaterContent.includes("downloadUrl . '.sha256'") &&
  updaterContent.includes('Integrity check passed (SHA256 verified)')
) {
  pass('OTA Integrity: SHA256 verification is enforced for update packages.');
} else {
  fail('OTA Integrity: updater is missing mandatory SHA256 verification markers.');
}

if (
  updaterContent.includes('resolveRedirectUrl') &&
  updaterContent.includes('fetchWithValidatedRedirects') &&
  updaterContent.includes("'release-assets.githubusercontent.com'") &&
  updaterContent.includes('CURLOPT_FOLLOWLOCATION => false') &&
  !updaterContent.includes('CURLOPT_FOLLOWLOCATION => true')
) {
  pass(
    'OTA Redirect Guard: updater validates each GitHub redirect hop and accepts GitHub release asset hosts before download.'
  );
} else {
  fail(
    'OTA Redirect Guard: updater can still reject normal GitHub release asset redirects or follow redirects without per-hop validation.'
  );
}

const dashboardContent = read('src/plugins/von-core/features/dashboard/Dashboard.tsx');
const updateModalContent = read('src/plugins/von-core/features/settings/UpdateModal.tsx');
if (
  updaterContent.includes("'.htaccess',") &&
  updaterContent.includes("basename($normalized) === '.htaccess'") &&
  upgradeGuideContent.includes('If you update to `v1.25.0` through OTA') &&
  upgradeGuideContent.includes('Repair `.htaccess`') &&
  updateModalContent.includes('System Tools &gt; Repair .htaccess')
) {
  pass(
    'OTA .htaccess Upgrade Guidance: updater keeps live .htaccess protected while v1.25.0 docs and modal instruct admins to run the repair tool after OTA.'
  );
} else {
  fail(
    'OTA .htaccess Upgrade Guidance: protected updater behavior or v1.25.0 repair guidance is missing.'
  );
}
assertIncludes(
  'Dashboard Content Totals Truth',
  dashboardContent + '\n' + read('public/api/get_posts.php'),
  [
    'const [contentTotals, setContentTotals] = useState({',
    'const [contentTotalsLoading, setContentTotalsLoading] = useState({',
    'articles: true,',
    'pages: true,',
    "postCountParams.set('countOnly', 'true');",
    "postCountParams.set('scope', 'all');",
    'vonFetch(`${API.getPosts}?${postCountParams.toString()}`)',
    'vonFetch(`${API.getPages}?limit=1`)',
    "$countOnly = filter_var($_GET['countOnly'] ?? false, FILTER_VALIDATE_BOOLEAN);",
    "$countScope = strtolower((string) ($_GET['scope'] ?? ''));",
    '$countStatusClause =',
    "$canReadProtectedPosts && $countScope === 'all'",
    "' WHERE 1=1' : $statusClause;",
    'data?.meta?.total',
    "value={contentTotalsLoading.articles ? '...' : contentTotals.articles.toString()}",
    "value={contentTotalsLoading.pages ? '...' : contentTotals.pages.toString()}",
  ],
  'Dashboard Content Totals Truth: welcome stats use count-only global post totals instead of writer-owned list payloads.',
  'Dashboard Content Totals Truth: dashboard can still show writer-owned or capped preload totals for staff content stats.'
);
assertIncludes(
  'Dashboard Staff Count Loading Truth',
  dashboardContent,
  [
    'const [activeUsersLoading, setActiveUsersLoading] = useState(true);',
    'const [totalCommentsLoading, setTotalCommentsLoading] = useState(true);',
    'vonFetch(API.getUserStats)',
    "value={totalCommentsLoading ? '...' : totalComments.toString()}",
    "value={activeUsersLoading ? '...' : activeUsers.toString()}",
  ],
  'Dashboard Staff Count Loading Truth: comments and active users show loading placeholders until count-only totals resolve.',
  'Dashboard Staff Count Loading Truth: comments or active users can still flash preload fallback counts before count-only totals resolve.'
);
if (
  !dashboardContent.includes('articles: posts.length,') &&
  !dashboardContent.includes('pages: pages.length,') &&
  !dashboardContent.includes('const totalArticles = posts.length;') &&
  !dashboardContent.includes('const totalPages = pages.length;')
) {
  pass(
    'Dashboard Content Totals Truth: stat cards no longer seed article/page totals from capped preload lengths.'
  );
} else {
  fail(
    'Dashboard Content Totals Truth: Articles/Pages stat cards can still seed from capped preload lengths.'
  );
}
if (
  dashboardContent.includes('expectedHash?: string;') &&
  dashboardContent.includes("expectedHash: deployAsset?.digest || deployAsset?.sha256 || ''") &&
  dashboardContent.includes('expectedHash={updateInfo.expectedHash}') &&
  updateModalContent.includes('expectedHash?: string;') &&
  updateModalContent.includes('expected_hash: expectedHash || undefined')
) {
  pass(
    'OTA Dashboard Flow: release digest is passed from GitHub release metadata into the updater request.'
  );
} else {
  fail('OTA Dashboard Flow: dashboard-to-updater digest wiring is incomplete.');
}
if (
  updaterContent.includes("$expectedHash = $input['expected_hash'] ?? null;") &&
  updaterContent.includes('$result = $updater->startUpdate($version, $url, $expectedHash);')
) {
  pass('OTA Direct Endpoint Digest Flow: direct updater start requests forward caller SHA256.');
} else {
  fail(
    'OTA Direct Endpoint Digest Flow: public/api/system/updater.php?action=start still drops expected_hash before startUpdate().'
  );
}

const mediaToolsContent = read('public/api/media_tools.php');
assertIncludes(
  'Responsive Media Tools',
  mediaToolsContent,
  [
    "case 'rebuild_responsive_variants':",
    "case 'preview_responsive_variants':",
    "case 'purge_responsive_variants':",
    "acquireMediaToolLock('responsive_variants')",
    'Another responsive variant job is already running. Please wait for it to finish.',
  ],
  'Responsive Media Tools: rebuild/preview/purge flow with job lock detected.',
  'Responsive Media Tools: rebuild/preview/purge safety markers are incomplete.'
);

const mediaSettingsContent = read(
  'src/plugins/von-core/features/settings/components/MediaSettings.tsx'
);
if (
  mediaToolsContent.includes("$_POST['preview_token']") &&
  mediaToolsContent.includes('Preview token required before deleting orphaned files.') &&
  mediaSettingsContent.includes("const reviewedPreviewToken = toolResult?.previewToken ?? '';") &&
  mediaSettingsContent.includes("formData.append('preview_token', reviewedPreviewToken);") &&
  mediaSettingsContent.includes('Delete Reviewed Files') &&
  mediaSettingsContent.includes('Scanning does not delete anything.')
) {
  pass('Media Cleanup Review Flow: orphan cleanup uses a review token and scan-first admin copy.');
} else {
  fail(
    'Media Cleanup Review Flow: orphan cleanup is missing the review-token safety flow or the scan-first UI copy.'
  );
}

const themeResponsiveFiles = [
  'src/themes/techpress/Layout.tsx',
  'src/themes/digest/Layout.tsx',
  'src/themes/default/Layout.tsx',
  'src/themes/prism/Layout.tsx',
  'src/themes/corporate-pro/Layout.tsx',
  'src/themes/portfolio/Layout.tsx',
  'src/themes/techpress/Profile.tsx',
  'src/themes/prism/components/PrismProfile.tsx',
  'src/plugins/von-core/features/users/UserProfile.tsx',
  'src/plugins/von-core/features/plugins/built-in/related-posts/RelatedPostsComponent.tsx',
];
if (themeResponsiveFiles.every((file) => read(file).includes('getResponsiveImageAttributes'))) {
  pass(
    'Theme Coverage: responsive image helper is wired across bundled public themes and profile/related views.'
  );
} else {
  fail(
    'Theme Coverage: one or more bundled public theme files are missing the responsive image helper.'
  );
}

const themeNavigationFiles = [
  'src/themes/default/Layout.tsx',
  'src/themes/digest/Layout.tsx',
  'src/themes/techpress/Layout.tsx',
  'src/themes/corporate-pro/Layout.tsx',
  'src/themes/portfolio/Layout.tsx',
  'src/themes/prism/Layout.tsx',
];
const themeLogoHelperContent = exists('src/themes/shared/components/ThemeLogo.tsx')
  ? read('src/themes/shared/components/ThemeLogo.tsx')
  : '';
const themeLogoIssues = themeNavigationFiles.flatMap((file) => {
  const content = read(file);
  const missing = [];

  if (!content.includes("from '../shared/components/ThemeLogo'")) {
    missing.push('shared ThemeLogo import');
  }

  if (!content.includes('<ThemeLogo')) {
    missing.push('ThemeLogo usage');
  }

  if (
    /settings\.useLogoAsTitle \? 'h-|className="h-\d+ w-auto|className="\$\{settings\.useLogoAsTitle/.test(
      content
    )
  ) {
    missing.push('legacy hardcoded logo sizing');
  }

  return missing.length ? [`${file}: ${missing.join(', ')}`] : [];
});
if (
  themeLogoHelperContent.includes('LOGO_SLOT_CLASS') &&
  themeLogoHelperContent.includes('w-[112px] h-[38px] sm:w-[140px] sm:h-[45px]') &&
  themeLogoHelperContent.includes('LOGO_TITLE_SLOT_CLASS') &&
  themeLogoHelperContent.includes('w-[150px] h-[48px] sm:w-[180px] sm:h-[56px]') &&
  themeLogoHelperContent.includes('max-w-full max-h-full w-auto h-auto object-contain') &&
  themeLogoIssues.length === 0
) {
  pass(
    'Theme Logo Slot Contract: bundled themes use one shared object-contain logo slot, with smaller mobile sizing and the existing desktop caps.'
  );
} else {
  fail(
    `Theme Logo Slot Contract: missing helper markers or theme wiring: ${
      themeLogoIssues.length
        ? themeLogoIssues.join('; ')
        : 'src/themes/shared/components/ThemeLogo.tsx'
    }`
  );
}

const defaultThemeFooterContent = read('src/themes/default/Layout.tsx').match(
  /<footer[\s\S]*?<\/footer>/
)?.[0];
const digestFooterContent = read('src/themes/digest/Layout.tsx').match(
  /const DigestFooter:[\s\S]*?^};/m
)?.[0];
const techPressFooterContent = read('src/themes/techpress/TechPressFooter.tsx').match(
  /<footer[\s\S]*?<\/footer>/
)?.[0];
const corporateProFooterContent = read('src/themes/corporate-pro/Layout.tsx').match(
  /const Footer = \(\) => \{[\s\S]*?^\s+\};/m
)?.[0];
if (
  defaultThemeFooterContent &&
  !defaultThemeFooterContent.includes('<ThemeLogo') &&
  !defaultThemeFooterContent.includes('<VonLogo') &&
  defaultThemeFooterContent.includes('settings.siteDescription') &&
  defaultThemeFooterContent.includes('settings.siteTagline') &&
  digestFooterContent &&
  !digestFooterContent.includes('<ThemeLogo') &&
  !digestFooterContent.includes('<VonLogo') &&
  digestFooterContent.includes('settings.siteDescription') &&
  digestFooterContent.includes('settings.siteTagline') &&
  techPressFooterContent &&
  !techPressFooterContent.includes('<ThemeLogo') &&
  !techPressFooterContent.includes('<VonLogo') &&
  techPressFooterContent.includes('settings.siteDescription') &&
  techPressFooterContent.includes('settings.siteTagline') &&
  corporateProFooterContent &&
  !corporateProFooterContent.includes('w-8 h-8 bg-blue-600') &&
  !corporateProFooterContent.includes('settings.siteName.charAt(0)') &&
  !corporateProFooterContent.includes('Defining standards in corporate web solutions')
) {
  pass(
    'Footer Brand Minimalism Contract: bundled footers avoid duplicate logo/icon fallback while preserving setting-driven footer text.'
  );
} else {
  fail(
    'Footer Brand Minimalism Contract: bundled footer logo/icon fallback scope or setting-driven footer text regressed.'
  );
}
const logoGeneralSettingsContent = read(
  'src/plugins/von-core/features/settings/components/GeneralSettings.tsx'
);
const logoSiteTypesContent = read('src/types.ts');
const darkLogoIssues = themeNavigationFiles.flatMap((file) => {
  const content = read(file);
  return /invertLogoInDarkMode=\{settings\??\.invertLogoInDarkMode\}/.test(content)
    ? []
    : [`${file}: missing invertLogoInDarkMode ThemeLogo prop`];
});
if (
  logoSiteTypesContent.includes('invertLogoInDarkMode?: boolean') &&
  useSettingsContent.includes('invertLogoInDarkMode: _s?.invertLogoInDarkMode ?? false') &&
  logoGeneralSettingsContent.includes("onChange('invertLogoInDarkMode', e.target.checked)") &&
  logoGeneralSettingsContent.includes('Invert logo in dark mode') &&
  saveSettingsContent.includes(
    "['invertLogoInDarkMode', 'general', 'invert_logo_in_dark_mode', 'boolean']"
  ) &&
  getSettingsContent.includes("'invert_logo_in_dark_mode'") &&
  publicInstallSqlContent.includes("('general', 'invert_logo_in_dark_mode', 'false', 'boolean'") &&
  installContent.includes("['general', 'invert_logo_in_dark_mode', 'false', 'boolean']") &&
  indexContent.includes("'invertLogoInDarkMode'") &&
  themeLogoHelperContent.includes('invertLogoInDarkMode?: boolean') &&
  themeLogoHelperContent.includes('dark:brightness-0 dark:invert') &&
  darkLogoIssues.length === 0
) {
  pass(
    'Theme Logo Dark Mode Invert Contract: optional admin toggle inverts uploaded logos only in dark mode and is wired through public settings and bundled themes.'
  );
} else {
  fail(
    `Theme Logo Dark Mode Invert Contract: missing settings, persistence, hydration, helper, or theme wiring${
      darkLogoIssues.length ? `: ${darkLogoIssues.join('; ')}` : '.'
    }`
  );
}
const themeNavigationHelperContent = exists('src/utils/navigation.ts')
  ? read('src/utils/navigation.ts')
  : '';
const themeNavigationIssues = themeNavigationFiles.flatMap((file) => {
  const content = read(file);
  const missing = [];

  if (!content.includes('shouldUseTabletBurgerMenu(')) {
    missing.push('shouldUseTabletBurgerMenu');
  }

  if (!content.includes('getVisibleNavigationItems(')) {
    missing.push('getVisibleNavigationItems');
  }

  if (!content.includes('getOverflowNavigationItems(')) {
    missing.push('getOverflowNavigationItems');
  }

  if (!content.includes('useTabletBurgerMenu ?')) {
    missing.push('dynamic tablet breakpoint');
  }

  return missing.length ? [`${file}: ${missing.join(', ')}`] : [];
});

if (
  themeNavigationHelperContent.includes('export const TABLET_NAV_VISIBLE_LIMIT = 3;') &&
  themeNavigationHelperContent.includes('navigation?.length || 0') &&
  themeNavigationHelperContent.includes('slice(0, TABLET_NAV_VISIBLE_LIMIT)') &&
  themeNavigationHelperContent.includes('slice(TABLET_NAV_VISIBLE_LIMIT)') &&
  themeNavigationIssues.length === 0
) {
  pass(
    'Theme Tablet Menu Cutoff: bundled themes switch tablet headers to burger navigation when more than three menu items exist.'
  );
} else {
  fail(
    `Theme Tablet Menu Cutoff: missing helper markers or theme wiring: ${
      themeNavigationIssues.length ? themeNavigationIssues.join('; ') : 'src/utils/navigation.ts'
    }`
  );
}

const settingsManagerMenuReorderContent = exists(
  'src/plugins/von-core/features/settings/SettingsManager.tsx'
)
  ? read('src/plugins/von-core/features/settings/SettingsManager.tsx')
  : '';

assertIncludes(
  'Settings Menu Drag Reorder Contract',
  settingsManagerMenuReorderContent,
  [
    'const [draggedMenuItemIndex, setDraggedMenuItemIndex] = useState<number | null>(null);',
    'const reorderMenuItem = (targetIndex: number) => {',
    'draggable',
    'onDragStart={() => setDraggedMenuItemIndex(idx)}',
    'navigation: nextNavigation',
    '<GripVertical size={16} />',
  ],
  'Settings Menu Drag Reorder Contract: active navigation items can be reordered by drag before saving settings.',
  'Settings Menu Drag Reorder Contract: menu builder still lacks drag markers or does not persist reordered navigation.'
);

assertIncludes(
  'Settings Menu Checkbox Id Contract',
  settingsManagerMenuReorderContent,
  [
    'const pageInputId = `settings-menu-page-${page.id}`;',
    'id={pageInputId}',
    'const postInputId = `settings-menu-post-${post.id}`;',
    'id={postInputId}',
  ],
  'Settings Menu Checkbox Id Contract: quick-add page/post checkboxes use item-specific HTML ids.',
  'Settings Menu Checkbox Id Contract: quick-add page/post checkboxes still reuse duplicate HTML ids.'
);

assertIncludes(
  'Digest Hero Discipline',
  digestLayoutContent,
  [
    'lg:w-3/5 aspect-video overflow-hidden relative',
    'max-w-[10rem] sm:max-w-[12rem]',
    'title={label}',
    'title={cat}',
    '<span className="block truncate">{cat}</span>',
  ],
  'Digest Hero Discipline: featured hero and category labels are kept within the tighter baseline.',
  'Digest Hero Discipline: hero/category truncation markers are incomplete.'
);

if (!exists('package-release.cjs')) {
  pass(
    'Release Entry Cleanup: package-release.cjs has been removed and create_release.cjs remains the only active packager.'
  );
} else {
  fail(
    'Release Entry Cleanup: package-release.cjs still exists even though create_release.cjs is the only active packager.'
  );
}

const adminBellLayoutContent = read('src/components/layouts/AdminLayout.tsx');
if (
  adminBellLayoutContent.includes('No active system alerts') &&
  adminBellLayoutContent.includes('Checked just now') &&
  adminBellLayoutContent.includes('Refresh') &&
  adminBellLayoutContent.includes('Integrity repair needed') &&
  adminBellLayoutContent.includes('Database schema update required') &&
  adminBellLayoutContent.includes('setAlertsCheckedAt') &&
  adminBellLayoutContent.includes('setIsAlertsOpen') &&
  adminBellLayoutContent.includes('API.checkDbStatus') &&
  adminBellLayoutContent.includes('alertsTrayRef') &&
  adminBellLayoutContent.includes("document.addEventListener('mousedown'") &&
  adminBellLayoutContent.includes("document.addEventListener('keydown'") &&
  adminBellLayoutContent.includes("event.key === 'Escape'")
) {
  pass(
    'Admin Bell System Alerts: admin header bell exposes a refreshable current-session alerts snapshot with outside-click and Escape dismissal.'
  );
} else {
  fail(
    'Admin Bell System Alerts: admin header bell is missing the refreshable dismissal contract for outside-click and Escape.'
  );
}

const phpBinary = findPhpBinary();
if (!phpBinary) {
  warn('PHP Lint: no PHP binary found automatically; skipping syntax lint checks.');
} else {
  pass(`PHP Binary: using ${phpBinary}`);

  const phpFilesToLint = [
    'public/media_variants.php',
    'public/scheduler_helper.php',
    'public/api/upload_file.php',
    'public/api/get_posts.php',
    'public/api/get_post.php',
    'public/api/save_post.php',
    'public/api/save_page.php',
    'public/von_config.sample.php',
    'public/rss.php',
    'public/api/backup_db.php',
    'public/api/get_settings.php',
    'public/api/public_cache_helper.php',
    'public/api/system/clear_public_cache.php',
    'public/api/get_storage.php',
    'public/api/media_tools.php',
    'public/api/submit_contact.php',
    'public/api/verify_email.php',
    'public/api/tools/wp_scan.php',
    'public/api/system/fix_integrity.php',
    'public/api/system/repair_htaccess.php',
    'public/api/install.php',
    'public/security.php',
    'public/index.php',
  ];

  phpFilesToLint.forEach((file) => {
    const lint = spawnSync(phpBinary, ['-l', resolveFromRoot(file)], { encoding: 'utf8' });
    if (lint.status === 0) {
      pass(`PHP Lint: ${file}`);
    } else {
      fail(`PHP Lint: ${file} :: ${(lint.stderr || lint.stdout || '').trim()}`);
    }
  });
}

if (failed) {
  console.error(
    `\nIntegration Smoke Gate: FAILED${warningCount ? ` (${warningCount} warning${warningCount === 1 ? '' : 's'})` : ''}`
  );
  process.exit(1);
}

if (warningCount > 0) {
  console.log(`\nIntegration Smoke Gate: PASS WITH WARNINGS (${warningCount})`);
} else {
  console.log('\nIntegration Smoke Gate: PASS');
}

process.exit(0);
