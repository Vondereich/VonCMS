// Focused PHP + real DOM/React checks. Browser dependencies may be supplied externally.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const php = process.argv[2] || 'php';
const phpResult = spawnSync(php, [path.join(__dirname, 'integration/security-hardening.php')], {
  encoding: 'utf8',
});
if (phpResult.status !== 0) throw new Error(phpResult.stderr || phpResult.stdout);
console.log(phpResult.stdout.trim());

// Actual multipart uploads through PHP CGI, with isolated auth/DB stubs and real GD/filesystem.
function uploadChecks() {
  const os = require('node:os');
  const resolvedPhp = spawnSync(php, ['-r', 'echo PHP_BINARY;'], { encoding: 'utf8' });
  assert.equal(resolvedPhp.status, 0, resolvedPhp.stderr);
  const cgi = path.join(
    path.dirname(resolvedPhp.stdout.trim()),
    process.platform === 'win32' ? 'php-cgi.exe' : 'php-cgi'
  );
  if (!fs.existsSync(cgi)) {
    console.log('WARN Media multipart/runtime-path checks NOT_RUN: PHP CGI is unavailable.');
    return;
  }
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'von-media-upload-'));
  try {
    const site = path.join(fixture, 'site');
    const api = path.join(site, 'api');
    fs.mkdirSync(api, { recursive: true });
    fs.mkdirSync(path.join(site, 'data'));
    fs.mkdirSync(path.join(fixture, 'php-tmp'));
    for (const file of ['upload_file.php', 'ImageProcessor.php'])
      fs.copyFileSync(path.join(root, 'public/api', file), path.join(api, file));
    fs.copyFileSync(
      path.join(root, 'public/media_variants.php'),
      path.join(site, 'media_variants.php')
    );
    fs.writeFileSync(
      path.join(site, 'security.php'),
      `<?php
class ResponseHelper {
  static function sendError($error, $status=500) { http_response_code($status); echo json_encode(['success'=>false,'error'=>$error instanceof Throwable?'QA database failed':$error]); exit; }
  static function scrubUrl($url) { return $url; }
}
class SessionManager { static function requireValidSession() {} }
class CSRFProtection { static function requireToken() {} }
function sendApiHeaders($methods) { header('Content-Type: application/json'); }
$_SESSION=['user'=>['id'=>1,'role'=>'admin']];
`
    );
    fs.writeFileSync(
      path.join(api, 'role_capability_helper.php'),
      '<?php function voncms_role_has_capability($role,$cap) { return true; }'
    );
    fs.writeFileSync(
      path.join(site, 'von_config.php'),
      `<?php
class QaStatement {
  function rowCount() { return 1; }
  function execute($values) {
    if (getenv('QA_DB_FAIL')) throw new RuntimeException('QA insert failure');
    file_put_contents(__DIR__.'/data/last-row.json',json_encode($values));
    return true;
  }
}
class QaDatabase {
  function query($sql) { return new QaStatement; }
  function prepare($sql) { return new QaStatement; }
  function lastInsertId() { return '17'; }
}
$pdo=new QaDatabase;
`
    );
    const image = path.join(fixture, 'sample.png');
    const generated = spawnSync(
      php,
      ['-r', '$im=imagecreatetruecolor(1000,500); imagepng($im,$argv[1]);', image],
      { encoding: 'utf8' }
    );
    assert.equal(generated.status, 0, generated.stderr);
    const png = fs.readFileSync(image);
    const settingsPath = path.join(site, 'data/site_settings.json');
    let cases = 0;
    function upload(
      settings,
      scriptName,
      fields = {},
      failure = false,
      filename = 'test.png',
      bytes = png
    ) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings));
      const boundary = 'VonCMSMediaFixtureBoundary';
      const body = Buffer.concat([
        ...Object.entries(fields).map(([name, value]) =>
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
          )
        ),
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const run = spawnSync(
        cgi,
        ['-d', 'display_errors=0', '-d', `upload_tmp_dir=${path.join(fixture, 'php-tmp')}`],
        {
          cwd: fixture,
          input: body,
          encoding: 'utf8',
          env: {
            ...process.env,
            REDIRECT_STATUS: '1',
            REQUEST_METHOD: 'POST',
            CONTENT_TYPE: `multipart/form-data; boundary=${boundary}`,
            CONTENT_LENGTH: String(body.length),
            SCRIPT_FILENAME: path.join(api, 'upload_file.php'),
            SCRIPT_NAME: scriptName,
            SERVER_PROTOCOL: 'HTTP/1.1',
            QA_DB_FAIL: failure ? '1' : '',
          },
        }
      );
      assert.equal(run.status, 0, run.stderr);
      const split = run.stdout.search(/\r?\n\r?\n/);
      assert.ok(split >= 0, run.stdout);
      const payload = JSON.parse(run.stdout.slice(split).trim());
      assert.equal(
        payload.success,
        !failure && bytes === png && /\.png$/i.test(filename),
        JSON.stringify(payload)
      );
      assert.equal(
        fs.readdirSync(path.join(fixture, 'php-tmp')).length,
        0,
        'PHP upload temp file leaked'
      );
      cases++;
      return payload;
    }
    const flat = {
      media: {
        storage: { folderStructure: 'flat' },
        optimization: { enabled: true, convertToWebP: true },
      },
    };
    for (const base of ['', '/zangetsu']) {
      for (const fields of [
        {},
        { context: 'system', systemImageType: 'logo' },
        { folderStructure: 'flat' },
      ]) {
        const result = upload(flat, base + '/api/upload_file.php', fields);
        assert.ok(
          !result.path.includes('/'),
          'omitted editor/system folder must honor configured Flat'
        );
        assert.equal(result.url, base + '/uploads/' + result.filename);
        const stored = path.join(site, 'uploads', result.path);
        assert.ok(fs.existsSync(stored));
        assert.equal(
          JSON.parse(fs.readFileSync(path.join(site, 'data/last-row.json'))).filepath,
          'uploads/' + result.path
        );
        if (fields.context === 'system') {
          assert.equal(result.extension, 'png');
          assert.equal(result.imageSrcSet, null);
        } else {
          assert.equal(result.extension, 'webp');
          assert.ok(result.imageSrcSet.includes('_480w.webp'));
          assert.ok(
            !fs.existsSync(stored.replace(/\.webp$/, '.png')),
            'converted original must not be duplicated'
          );
        }
      }
      for (const [settings, fields] of [
        [{}, {}],
        [flat, { folderStructure: 'year_month' }],
      ]) {
        const result = upload(settings, base + '/api/upload_file.php', fields);
        assert.match(result.path, /^\d{4}\/\d{2}\/[^/]+$/);
        assert.equal(result.url, base + '/uploads/' + result.path);
        assert.ok(fs.existsSync(path.join(site, 'uploads', result.path)));
      }
    }
    for (const filename of [
      'gambar café 中文 😀.png',
      'foto & #100% (final).png',
      '../../outside.png',
      '..\\outside.png',
      'image.php.png',
      'UPPER.PNG',
    ]) {
      const result = upload(flat, '/zangetsu/api/upload_file.php', {}, false, filename);
      assert.match(result.filename, /^[A-Za-z0-9_-]+\.webp$/);
      assert.equal(result.path, result.filename);
      assert.equal(result.url, '/zangetsu/uploads/' + result.filename);
      assert.ok(fs.existsSync(path.join(site, 'uploads', result.filename)));
    }
    const before = fs.readdirSync(path.join(site, 'uploads'), { recursive: true }).sort();
    upload(flat, '/api/upload_file.php', {}, true);
    upload(
      flat,
      '/api/upload_file.php',
      {},
      false,
      'fake.png',
      Buffer.from('<?php echo "not an image";')
    );
    upload(flat, '/api/upload_file.php', {}, false, 'image.png.php');
    assert.deepEqual(
      fs.readdirSync(path.join(site, 'uploads'), { recursive: true }).sort(),
      before,
      'failed uploads left image files or variants'
    );
    assert.ok(fs.existsSync(path.join(site, 'data/generated_media_variants.php')));
    assert.ok(!fs.readdirSync(path.join(site, 'data')).some((file) => file.includes('.tmp.')));
    // A local directory link must not make Sync index or Rebuild write outside uploads.
    const outside = path.join(fixture, 'outside');
    fs.mkdirSync(outside);
    fs.copyFileSync(image, path.join(outside, 'outside.png'));
    let linksAvailable = true;
    const directoryLink = (target, link) => {
      try {
        fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
      } catch (error) {
        if (!['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) throw error;
        linksAvailable = false;
      }
    };
    directoryLink(outside, path.join(site, 'uploads/linked'));
    const registered = path.join(site, 'uploads/purge-linked');
    fs.mkdirSync(registered);
    fs.copyFileSync(image, path.join(registered, 'source.png'));
    fs.copyFileSync(image, path.join(registered, 'source_480w.png'));
    const record = spawnSync(
      php,
      [
        '-r',
        "require $argv[1]; if(!voncms_record_generated_media_variants($argv[2].'/purge-linked/source.png',[$argv[2].'/purge-linked/source_480w.png'],$argv[2])) exit(2);",
        path.join(site, 'media_variants.php'),
        path.join(site, 'uploads'),
      ],
      { encoding: 'utf8' }
    );
    assert.equal(record.status, 0, record.stderr);
    const moved = path.join(fixture, 'outside-registered');
    fs.renameSync(registered, moved);
    directoryLink(moved, registered);
    const changed = path.join(site, 'uploads/changed');
    fs.mkdirSync(changed);
    fs.copyFileSync(image, path.join(changed, 'source.png'));
    fs.copyFileSync(image, path.join(changed, 'source_480w.png'));
    const changedRecord = spawnSync(
      php,
      [
        '-r',
        "require $argv[1]; if(!voncms_record_generated_media_variants($argv[2].'/changed/source.png',[$argv[2].'/changed/source_480w.png'],$argv[2])) exit(2);",
        path.join(site, 'media_variants.php'),
        path.join(site, 'uploads'),
      ],
      { encoding: 'utf8' }
    );
    assert.equal(changedRecord.status, 0, changedRecord.stderr);
    fs.appendFileSync(path.join(changed, 'source_480w.png'), 'CHANGED AFTER REGISTRATION');
    for (const file of ['sync_media.php', 'media_tools.php', 'media_library_filter_helper.php'])
      fs.copyFileSync(path.join(root, 'public/api', file), path.join(api, file));
    const pathProbe = path.join(api, 'qa-paths.php');
    fs.writeFileSync(
      pathProbe,
      `<?php
require __DIR__.'/../security.php';
require __DIR__.'/media_library_filter_helper.php';
require __DIR__.'/ImageProcessor.php';
// Execute the actual destination-skip branch with a controlled link predicate.
// Real OS file-symlink creation requires privileges on Windows; this is not OS-link proof.
$processor=file_get_contents(__DIR__.'/ImageProcessor.php');
eval('namespace VariantLinkProbe; use \\GdImage; function is_link($path) { return str_ends_with($path,"source_480w.png"); } '.substr($processor,strpos($processor,'class ImageProcessor')));
$probeSource=__DIR__.'/../uploads/changed/source.png';
$probeVariant=__DIR__.'/../uploads/changed/source_480w.png';
$beforeHash=sha1_file($probeVariant);
$probe=new \\VariantLinkProbe\\ImageProcessor;
if($probe->generateResponsiveVariants($probeSource,[480])!==[] || sha1_file($probeVariant)!==$beforeHash) throw new RuntimeException('Variant file-link branch overwrote its destination');
$sync=file_get_contents(__DIR__.'/sync_media.php');
eval(substr($sync,strpos($sync,'function scanAndSync('),strpos($sync,"\ntry {",strpos($sync,'function scanAndSync('))-strpos($sync,'function scanAndSync(')));
$tools=file_get_contents(__DIR__.'/media_tools.php');
eval(substr($tools,strpos($tools,'function formatMediaToolBytes(')));
$pdo=new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE media(id INTEGER PRIMARY KEY,filename TEXT,filepath TEXT,filetype TEXT,filesize INT,uploaded_by INT,uploaded_at TEXT)');
$pdo->exec('CREATE TABLE posts(image_url TEXT)');
$synced=$skipped=$skippedVariants=0; $errors=[];
$uploads=str_replace('\\\\','/',realpath(__DIR__.'/../uploads'));
scanAndSync($uploads,$uploads,$pdo,['png','webp'],1,$synced,$skipped,$skippedVariants,$errors);
foreach($pdo->query('SELECT filepath FROM media')->fetchAll(PDO::FETCH_COLUMN) as $path) {
  if($argv[3]==='1' && str_contains($path,'linked/')) throw new RuntimeException('Sync indexed an outside image through a directory link');
}
if($synced<1 || $errors) throw new RuntimeException('Ordinary upload sync failed');
$pdo->exec("INSERT INTO posts VALUES ('/uploads/linked/outside.png')");
ob_start(); rebuildResponsiveVariants(); $response=json_decode(ob_get_clean(),true);
if(!$response['success']) throw new RuntimeException('Rebuild fixture failed');
if(count(glob($argv[1].'/*'))!==1) throw new RuntimeException('Rebuild wrote outside uploads through a directory link');
ob_start(); purgeResponsiveVariants(); $purge=json_decode(ob_get_clean(),true);
if(!$purge['success'] || ($argv[3]==='1' && $purge['stats']['failedCount']<1) || $purge['stats']['deletedCount']<1) throw new RuntimeException('Purge did not distinguish outside links from ordinary registered variants');
if(!is_file($argv[2].'/source_480w.png') || !is_file($argv[2].'/source.png')) throw new RuntimeException('Purge deleted an outside linked file');
if(!is_file(__DIR__.'/../uploads/changed/source_480w.png')) throw new RuntimeException('Purge deleted a variant whose content hash changed');
echo 'PASS changed-hash preservation and actual variant-skip branch (link predicate simulated), real SQLite/GD.';
if($argv[3]==='1') echo "\nPASS Sync/Rebuild/Purge OS directory-link containment.";
`
    );
    if (!linksAvailable)
      console.log(
        'WARN Media OS directory-link checks NOT_RUN: filesystem link creation unavailable.'
      );
    const pathRun = spawnSync(php, [pathProbe, outside, moved, linksAvailable ? '1' : '0'], {
      encoding: 'utf8',
    });
    assert.equal(pathRun.status, 0, pathRun.stderr || pathRun.stdout);
    console.log(pathRun.stdout);
    console.log(
      `PASS ${cases} actual PHP CGI multipart cases: root/subfolder, Flat/default/override, Unicode/special filenames, GD/WebP/variants, system assets, rejected content/extensions and DB-failure cleanup (auth/DB stubbed).`
    );
  } finally {
    assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith('von-media-upload-'));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}
uploadChecks();
const compile = (source, fileName = 'fixture.ts') =>
  ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

// Render the actual six JSX title nodes, not a reimplementation of their escaping.
let titleCount = 0;
for (const file of [
  'src/plugins/von-core/features/content/ContentManager.tsx',
  'src/plugins/von-core/features/settings/SettingsManager.tsx',
  'src/plugins/von-core/features/users/UserProfile.tsx',
  'src/plugins/von-core/features/public/components/Sidebar.tsx',
]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (
      ts.isJsxElement(node) &&
      node.children.some(
        (child) =>
          ts.isJsxExpression(child) &&
          child.expression &&
          /^decodeEntities\((?:item|page|post)\.title\)$/.test(child.expression.getText(ast))
      )
    ) {
      const snippet = node.getText(ast);
      const context = {
        React,
        isCurrentPost: false,
        decodeEntities: (text) => text,
        item: { title: '<form><input name="password"></form>' },
        page: { title: '<iframe src="https://evil.test"></iframe>' },
        post: { title: '<img src=x onerror=alert(1)>' },
      };
      vm.runInNewContext(
        compile('globalThis.component = () => (' + snippet + ');', 'fixture.tsx'),
        context
      );
      const html = renderToStaticMarkup(React.createElement(context.component));
      assert(!/<(?:form|iframe|input|img)\b/i.test(html));
      assert(html.includes('&lt;'));
      titleCount++;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert(!/sanitizeHtml\((?:item|page|post)\.title\)/.test(source));
}
assert.equal(titleCount, 6);
console.log('PASS six actual title render nodes escape markup.');

async function browserChecks() {
  const deps = process.argv[3];
  if (!deps) {
    console.log('SKIP real DOM checks: supply browser dependency directory as third argument.');
    return;
  }
  const { chromium } = require(require.resolve('playwright', { paths: [deps] }));
  const storedProbe = spawnSync(
    php,
    [
      '-r',
      `require $argv[1] . '/public/api/content_embed_helper.php';
$cases = [
  '<a href="java&#x73;cript:alert(1)">Unsafe</a>',
  '<a href="javascript&#58;alert(1)">Unsafe</a>',
  '<a href="java&Tab;script&colon;alert(1)">Unsafe</a>',
  '<a href=java&#x73;cript:alert(1)>Unsafe</a>',
  '<a href="java&amp;#x73;cript:alert(1)">Literal entity</a>',
  '<a href="java&#x73;cript:alert(1)" href="https://example.test">Duplicate</a>',
  '<img src="data:text/html,bad" onerror="alert(1)">',
  '<svg><a xlink:href="java&#x73;cript:alert(1)">SVG URL</a></svg>',
  '<p>Before</p></div><a href="java&#x73;cript:alert(1)">Malformed</a>',
  '<a href="https://example.test/story?a=1&amp;b=2">Good</a>',
];
$good = array_pop($cases);
foreach (['svg', 'math'] as $foreign) {
  foreach (['script', 'style', 'xmp', 'noscript', 'title', 'textarea', 'noembed', 'noframes', 'plaintext'] as $rawTag) {
    $cases[] = '<' . $foreign . '><' . $rawTag . '><p><a href="java&#x73;cript:alert(1)">Link</a><img src=x onerror=alert(1)></p></' . $rawTag . '></' . $foreign . '>';
  }
}
$cases[] = '<!--><a href="java&#x73;cript:alert(1)">Comment</a><img src=x onerror=alert(1)>-->';
$cases[] = $good;
echo json_encode(array_map(static fn($html) => voncms_sanitize_content_attributes(voncms_sanitize_content_iframes($html)), $cases), JSON_THROW_ON_ERROR);`,
      root,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(storedProbe.status, 0, storedProbe.stderr || storedProbe.stdout);
  const storedHtml = JSON.parse(storedProbe.stdout);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => route.abort());
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: path.join(root, 'node_modules/dompurify/dist/purify.min.js') });
    const code = compile(fs.readFileSync(path.join(root, 'src/utils/security.ts'), 'utf8'));
    const linkCode = compile(
      fs.readFileSync(path.join(root, 'src/components/editor/editorLinkUtils.ts'), 'utf8')
    );
    const textCode = compile(fs.readFileSync(path.join(root, 'src/utils/textUtils.ts'), 'utf8'));
    const pluginFile = 'src/plugins/von-core/features/plugins/registry.tsx';
    const pluginSource = fs.readFileSync(path.join(root, pluginFile), 'utf8');
    const pluginAst = ts.createSourceFile(
      pluginFile,
      pluginSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    let pluginSanitizer;
    function findPluginSanitizer(node) {
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText(pluginAst) === 'sanitizeCustomPluginHtml'
      )
        pluginSanitizer = node.initializer.getText(pluginAst);
      ts.forEachChild(node, findPluginSanitizer);
    }
    findPluginSanitizer(pluginAst);
    assert(pluginSanitizer, 'Actual custom plugin sanitizer not found.');
    const pluginCode = compile('exports.sanitizeCustomPluginHtml = ' + pluginSanitizer + ';');
    const appOverlayCss = fs
      .readFileSync(path.join(root, 'src/index.css'), 'utf8')
      .match(/\.admin-modal-layer\s*\{[^}]*\}/)?.[0];
    assert(appOverlayCss, 'Actual application overlay CSS not found.');
    const result = await page.evaluate(
      ({ code, linkCode, textCode, pluginCode, appOverlayCss, storedHtml }) => {
        const links = {};
        new Function('exports', linkCode)(links);
        function load(code) {
          const exports = {};
          new Function('require', 'exports', code)(
            (name) =>
              name === 'dompurify'
                ? { __esModule: true, default: window.DOMPurify }
                : name.includes('editorLinkUtils')
                  ? links
                  : { BASE_PATH: '' },
            exports
          );
          return exports;
        }
        const security = load(code);
        const text = load(textCode);
        const plugin = {};
        new Function('exports', 'sanitizeHtml', 'normalizeSiteUrl', pluginCode)(
          plugin,
          security.sanitizeHtml,
          (href) => href
        );
        const bad = security.sanitizeHtml(
          '<form action="https://evil.test"><input name="password"><button>Send</button></form><iframe src="https://evil.test"></iframe><p>Keep article</p>'
        );
        const good = security.sanitizeHtml(
          '<iframe src="https://www.youtube.com/embed/abc"></iframe><a href="https://example.test" target="_blank" rel="sponsored">Link</a>'
        );
        const ad = security.sanitizeHtml(
          '<iframe src="https://ads.example.test/banner"></iframe>',
          { ADD_TAGS: ['iframe'], sandboxedAdContent: true }
        );
        const afterAd = security.sanitizeHtml(
          '<iframe src="https://ads.example.test/banner"></iframe>'
        );
        const decoded = text.decodeEntities(
          'Title &amp; &#x1F600; &lt;img src=x onerror=alert(1)&gt;'
        );
        const fixture = document.createElement('section');
        fixture.innerHTML =
          '<style>' +
          appOverlayCss +
          '</style><header id="css-outside">Outside article</header><article></article>';
        document.body.appendChild(fixture);
        const article = fixture.querySelector('article');
        const outside = fixture.querySelector('header');
        const cssCases = [
          '<style>#css-outside{display:none!important}</style>',
          '<StYlE media="all">@import url("https://evil.test/hide.css");#css-outside{display:none!important}</StYlE>',
          '<svg><style>#css-outside{display:none!important}</style></svg>',
          '<math><mtext><style>#css-outside{display:none!important}</style></mtext></math>',
          '<link rel="stylesheet" href="https://evil.test/hide.css">',
          '<div class="admin-modal-layer">Overlay</div>',
          '<div class="voncms-noscript">Global theme trigger</div>',
        ];
        const cssResults = cssCases.map((payload) => {
          article.innerHTML = security.sanitizeHtml('<p>Keep article</p>' + payload);
          return {
            activeStyles: article.querySelectorAll('style,link[rel="stylesheet"]').length,
            sourceClasses: article.querySelectorAll('[class]').length,
            outsideDisplay: getComputedStyle(outside).display,
            hasArticle: article.textContent.includes('Keep article'),
            fixedChildren: [...article.querySelectorAll('*')].filter(
              (element) => getComputedStyle(element).position === 'fixed'
            ).length,
          };
        });
        const formatting = security.sanitizeHtml(
          '<h2 id="section">Section</h2><a href="#section">Jump</a><p style="text-align: center">Aligned</p>' +
            '<img src="https://example.test/image.webp" alt="Photo" style="width:50%;margin-left:auto;margin-right:auto">' +
            '<table><tbody><tr><td colspan="2" style="text-align:right">Cell</td></tr></tbody></table>'
        );
        article.innerHTML = formatting;
        const safeFormatting = {
          anchor:
            article.querySelector('h2')?.id === 'section' &&
            article.querySelector('a')?.getAttribute('href') === '#section',
          alignment: article.querySelector('p')?.style.textAlign === 'center',
          image: article.querySelector('img')?.style.width === '50%',
          table:
            article.querySelector('td')?.colSpan === 2 &&
            article.querySelector('td')?.style.textAlign === 'right',
        };
        const pluginHtml = plugin.sanitizeCustomPluginHtml(
          '<p>Plugin</p><style>.plugin-card{color:red}</style><div class="plugin-card" id="plugin-card">Card</div>' +
            '<form><input name="password"></form><iframe src="https://evil.test"></iframe>'
        );
        const adStyles = security.sanitizeHtml(
          '<p>Ad</p><style>.ad-card{color:red}</style><div class="ad-card">Ad</div>',
          {
            FORCE_BODY: true,
            sandboxedAdContent: true,
          }
        );
        const afterExceptions = security.sanitizeHtml(
          '<p>Article</p><style>body{display:none}</style><div class="admin-modal-layer">Body</div>'
        );
        // Parse the actual PHP output with Chrome's HTML parser, without DOMPurify.
        const storedResults = storedHtml.map((html) => {
          const parsed = document.createElement('div');
          parsed.innerHTML = html;
          const attributes = [...parsed.querySelectorAll('*')].flatMap((node) =>
            [...node.attributes].map((attribute) => ({
              name: attribute.name,
              value: attribute.value,
            }))
          );
          return {
            active: attributes.some(
              ({ name, value }) =>
                /^on/i.test(name) ||
                (['href', 'src', 'xlink:href'].includes(name) &&
                  /^(?:javascript|vbscript|data):/i.test(value.replace(/[\x00-\x20]/g, '')))
            ),
            href: parsed.querySelector('a')?.getAttribute('href'),
          };
        });
        fixture.remove();
        return {
          bad,
          good,
          ad,
          afterAd,
          decoded,
          cssResults,
          safeFormatting,
          pluginHtml,
          adStyles,
          afterExceptions,
          storedResults,
        };
      },
      { code, linkCode, textCode, pluginCode, appOverlayCss, storedHtml }
    );
    assert(!/<(?:form|input|button|iframe)\b/i.test(result.bad));
    assert(result.bad.includes('Keep article'));
    assert(
      result.good.includes('youtube.com/embed/abc') &&
        result.good.includes('allowfullscreen') &&
        result.good.includes('noopener noreferrer sponsored')
    );
    assert(result.ad.includes('ads.example.test') && !result.afterAd.includes('<iframe'));
    assert.equal(result.decoded, 'Title & 😀 <img src=x onerror=alert(1)>');
    result.cssResults.forEach((entry, index) => {
      assert.equal(entry.activeStyles, 0, 'Article stylesheet survived CSS case ' + index);
      assert.equal(entry.sourceClasses, 0, 'Article application class survived CSS case ' + index);
      assert.notEqual(entry.outsideDisplay, 'none', 'Article CSS hid outside UI in case ' + index);
      assert.equal(
        entry.fixedChildren,
        0,
        'Article activated application overlay in case ' + index
      );
      assert(entry.hasArticle, 'Article text lost in CSS case ' + index);
    });
    assert(
      Object.values(result.safeFormatting).every(Boolean),
      'Ordinary article formatting or anchors regressed.'
    );
    assert(
      result.pluginHtml.includes('<style>') && result.pluginHtml.includes('class="plugin-card"')
    );
    assert(
      !/<(?:form|input|iframe)\b/i.test(result.pluginHtml),
      'Trusted plugin styles loosened form/iframe policy.'
    );
    assert(result.adStyles.includes('<style>') && result.adStyles.includes('class="ad-card"'));
    assert(
      !/<style\b|class=/i.test(result.afterExceptions),
      'Trusted stylesheet exception leaked into ordinary article.'
    );
    assert.deepEqual(
      result.storedResults
        .map((entry, index) => ({ ...entry, index }))
        .filter((entry) => entry.active),
      [],
      'PHP-sanitized URL/event attributes became active when parsed by Chrome.'
    );
    assert.equal(
      result.storedResults.at(-1).href,
      'https://example.test/story?a=1&b=2',
      'PHP attribute filtering changed an ordinary HTTPS link.'
    );
    console.log(
      `PASS ${result.storedResults.length} PHP-stored HTML cases remain safe under Chrome HTML parsing without DOMPurify.`
    );
    console.log(
      'PASS real DOM sanitizer: seven CSS/import variants cannot hide outside UI or activate application overlays; article formatting/anchors, trusted plugin styles, isolated ads and form/iframe policies remain intact.'
    );
  } finally {
    await browser.close();
  }
}
browserChecks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
