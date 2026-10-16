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
      ({ code, linkCode, textCode, pluginCode, appOverlayCss }) => {
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
        };
      },
      { code, linkCode, textCode, pluginCode, appOverlayCss }
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
