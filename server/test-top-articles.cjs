// Focused component behavior without a browser, server or database.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src/plugins/von-core/features/dashboard/TopArticles.tsx'),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const state = [];
let cursor = 0;
let previousDeps;
let cleanup;
let effect;
const requests = [];
const fakeHooks = {
  useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [
      state[index],
      (value) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      },
    ];
  },
  useEffect(callback, deps) {
    if (!previousDeps || deps.some((value, index) => value !== previousDeps[index])) {
      cleanup?.();
      previousDeps = deps;
      effect = callback;
    }
  },
};
const exportsObject = {};
vm.runInNewContext(compiled, {
  exports: exportsObject,
  AbortController,
  require(id) {
    if (id === 'react') return fakeHooks;
    if (id === 'react/jsx-runtime') return require(id);
    if (id.includes('site.config')) return { API: { trackVisit: '/zangetsu/api/track_visit.php' } };
    if (id.endsWith('/utils/api'))
      return {
        vonFetch: (url, options) =>
          new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
      };
    throw new Error('Unexpected import ' + id);
  },
});
function render(days) {
  cursor = 0;
  const element = exportsObject.default({ days });
  if (effect) {
    const run = effect;
    effect = null;
    cleanup = run();
  }
  return renderToStaticMarkup(element);
}
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function response(title, url = '/zangetsu/tech-ai/article') {
  return {
    ok: true,
    json: async () => ({
      success: true,
      articleViews: {
        since: '2026-10-09',
        timeZone: 'Asia/Kuala_Lumpur',
        articles: [{ id: '1', title, category: 'Tech AI', views: 25, url }],
      },
    }),
  };
}
(async () => {
  assert.match(render(7), /Loading article views/);
  assert.equal(requests[0].url, '/zangetsu/api/track_visit.php?report=articles&days=7');
  render(30);
  assert.equal(requests[0].options.signal.aborted, true);
  requests[1].resolve(response('<img src=x onerror=alert(1)>'));
  await settle();
  const html = render(30);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /href="\/zangetsu\/tech-ai\/article"/);
  assert.match(html, /noopener noreferrer/);
  assert.match(html, /2026-10-09/);
  requests[0].resolve(response('STALE RESULT'));
  await settle();
  assert.doesNotMatch(render(30), /STALE RESULT/);
  render(7);
  requests[2].resolve({
    ok: false,
    json: async () => ({
      success: false,
      error: 'Run Database Repair to enable daily article views.',
    }),
  });
  await settle();
  const failed = render(7);
  assert.match(failed, /Database Repair/);
  assert.match(failed, /Try again/);
  assert.doesNotMatch(failed, /No article views recorded/);
  assert.doesNotMatch(failed, /Article views could not be loaded/);
  render(30);
  requests[3].resolve(response('UNSAFE LINK', '//evil.invalid/'));
  await settle();
  assert.doesNotMatch(render(30), /evil.invalid|UNSAFE LINK/);
  render(7);
  requests[4].resolve({
    ok: false,
    json: async () => ({ success: false, message: '<b>Legacy error message</b>' }),
  });
  await settle();
  const legacyError = render(7);
  assert.match(legacyError, /&lt;b&gt;Legacy error message&lt;\/b&gt;/);
  assert.doesNotMatch(legacyError, /<b>/);
  render(30);
  requests[5].resolve({
    ok: false,
    json: async () => ({ success: false, error: { unexpected: true } }),
  });
  await settle();
  assert.match(render(30), /Article views could not be loaded\. Please try again\./);
  cleanup?.();
  console.log(
    'PASS Top Articles UI: period races, abort, loading, errors, escaped titles, safe URLs and activation note.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
