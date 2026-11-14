// Maintained routing boundary regression. Browser mode runs the actual App with
// synthetic API responses; it never connects to an installed CMS or writes records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const ts = require('typescript');
const { matchRoutes } = require('react-router');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const baseline = process.env.VONCMS_ROUTING_BASELINE;
const app = baseline ? fs.readFileSync(baseline, 'utf8') : read('src/App.tsx');
const slug = 'routing-public-article';
const headline = 'Public routing fixture article';
const articleVisible =
  '[...document.querySelectorAll("h1")].some(h=>h.innerText.includes(' +
  JSON.stringify(headline) +
  '))';
const reserved = [
  'admin',
  'api',
  'login',
  'install',
  'register',
  'reset-password',
  'assets',
  'data',
  'core',
  'uploads',
  'temp_update',
  'profile',
];
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const ast = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const attr = (node, name) =>
  node.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(ast) === name);
const publicPaths = [
  ...app.match(/const publicRoutes = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g),
].map((m) => m[1]);
let topRoutes;
function findRoutes(node) {
  if (
    ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(ast) === 'Routes' &&
    node.children.some(
      (child) =>
        ts.isJsxSelfClosingElement(child) && attr(child, 'path')?.initializer?.text === '/admin/*'
    )
  )
    topRoutes = node;
  ts.forEachChild(node, findRoutes);
}
findRoutes(ast);
assert.ok(topRoutes, 'The actual App route tree is required');
const routes = [];
for (const child of topRoutes.children) {
  if (ts.isJsxSelfClosingElement(child) && child.tagName.getText(ast) === 'Route') {
    const route = attr(child, 'path')?.initializer;
    if (route && ts.isStringLiteral(route)) routes.push({ path: route.text });
  } else if (ts.isJsxExpression(child) && child.getText(ast).includes('publicRoutes.map')) {
    routes.push(...publicPaths.map((route) => ({ path: route })));
  }
}
for (const base of ['/', '/blog']) {
  for (const prefix of ['admin', 'ADMIN', '%61dmin']) {
    for (const tail of [slug, 'business/' + slug, '2026/11/' + slug]) {
      const url = (base === '/' ? '' : base) + '/' + prefix + '/' + tail;
      check(
        matchRoutes(routes, url, base)?.at(-1).route.path === '/admin/*',
        'Reserved admin namespace lost to a public permalink: ' + url
      );
    }
  }
}
const utils = read('src/utils/siteUtils.ts');
const start = utils.indexOf('const SYSTEM_ROUTE_PREFIXES');
const end = utils.indexOf('export const getPermalink', start);
check(start !== -1 && end > start, 'Public route policy must be present');
const policy = vm.runInNewContext(
  ts.transpileModule(
    utils
      .slice(start, end)
      .replace('export const isPublicContentPath', 'const isPublicContentPath') +
      '\nisPublicContentPath;',
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
  ).outputText
);
for (const key of reserved) {
  for (const tail of [slug, 'business/' + slug, '2026/11/' + slug]) {
    if (key === 'profile' && tail === slug) continue;
    check(!policy('/' + key + '/' + tail), 'Public namespace accepted ' + key + '/' + tail);
  }
}
for (const route of [
  '/rss',
  '/feed',
  '/robots.txt',
  '/sitemap.xml',
  '/%61pi/' + slug,
  '/%2561dmin/' + slug,
  '/assets%2fadmin/' + slug,
  '/admin\\business/' + slug,
  '/business//' + slug,
  '/business/%00',
  '/business/%xx',
  '/2026/13/' + slug,
  '/2026/00/' + slug,
  '/2026/02/29/' + slug,
  '/2026/04/31/' + slug,
  '/2026/11/00/' + slug,
  '/not-a-year/not-a-month/' + slug,
])
  check(!policy(route), 'Malformed/system route accepted: ' + route);
for (const route of [
  '/',
  '/' + slug,
  '/business/' + slug,
  '/administrator/' + slug,
  '/admin-news/' + slug,
  '/docs/' + slug,
  '/fonts/' + slug,
  '/rss/' + slug,
  '/feed/' + slug,
  '/teknologi/' + slug,
  '/%E6%96%B0%E9%97%BB/' + slug,
  '/profile/public-user',
  '/post/701',
  '/blog/' + slug,
  '/2026/11/' + slug,
  '/2024/02/29/' + slug,
  '/2026/11/14/' + slug,
])
  check(policy(route), 'Legitimate public route rejected: ' + route);

async function browser() {
  const chromePath =
    process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (!fs.existsSync(chromePath)) throw new Error('NOT_RUN: set CHROME_BIN');
  const { createServer } = await import('vite');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-public-routing-'));
  let server, chrome, socket, send;
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const exceptions = [];
  const fixture = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import App from '/src/App.tsx';
    import '/src/index.css';
    window.__qaFetches=[];
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(input,options={})=>{
      const u=new URL(typeof input==='string'?input:input.url,location.href);
      if(!u.pathname.includes('/api/')&&!u.pathname.endsWith('/api.php'))return nativeFetch(input,options);
      const endpoint=u.pathname.split('/').pop();
      window.__qaFetches.push({path:u.pathname,method:options.method||'GET'});
      const reply=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
      const post={id:'701',slug:'${slug}',title:'${headline}',content:'<p>Public fixture body.</p>',excerpt:'Public fixture',category:'Business',status:'published',author:'QA',author_id:1,created_at:'2026-11-14 10:00:00',updated_at:'2026-11-14 10:00:00'};
      const params=new URLSearchParams(location.search);
      const role=params.get('actor')||'Guest';
      const user=role==='Guest'?null:{id:({Root:'1',Admin:'2',Moderator:'3',Writer:'4',Member:'9'})[role],username:'fixture-user',role,email_verified:1,avatar:''};
      if(endpoint==='check_auth.php')return reply({success:true,authenticated:!!user,user,csrf_token:'fixture-only'});
      if(endpoint==='get_settings.php')return reply({...window.__INITIAL_SETTINGS__,_settingsScope:['Root','Admin'].includes(role)?'admin':'public'});
      if(endpoint==='api.php')return reply({success:true,csrf_token:'fixture-only',installed:true});
      if(endpoint==='get_post.php')return reply({success:true,post});
      if(endpoint==='get_posts.php')return reply({success:true,posts:[post],meta:{total:1,page:1,totalPages:1,hasMore:false,limit:6}});
      if(endpoint==='get_pages.php')return reply({success:true,pages:[],meta:{total:0,totalPages:1,hasMore:false}});
      if(endpoint==='get_public_profile.php')return reply({success:true,user:{username:'public-user',bio:'Public QA profile'}});
      if(endpoint==='get_comments.php')return reply({success:true,comments:[],meta:{total:0,hasMore:false}});
      if(endpoint==='get_users.php')return reply({success:true,users:[],meta:{total:0}});
      if(endpoint==='get_storage.php')return reply({success:true,totalSize:0,used:0});
      if(endpoint==='get_user_stats.php')return reply({success:true,stats:{}});
      if(endpoint==='check_db_status.php')return reply({success:true,needsRepair:false,details:[]});
      if(endpoint==='get_analytics.php')return reply({success:true,data:[],summary:{}});
      if(endpoint==='track_monolithic.php')return reply({success:true});
      if(endpoint==='account.php')return reply({success:true,user});
      if(endpoint==='get_update.php'||endpoint==='check_update.php')return reply({success:true,updateAvailable:false});
      if((options.method||'GET')!=='GET')throw Error('Unexpected mutation '+endpoint);
      return reply({success:true,data:[],meta:{total:0},installed:true});
    };
    createRoot(document.getElementById('root')).render(React.createElement(App));
  `;
  try {
    server = await createServer({
      root,
      cacheDir: path.join(temp, 'vite-cache'),
      server: { host: '127.0.0.1', port: 0, proxy: {} },
      plugins: [
        {
          name: 'public-routing-regression',
          enforce: 'pre',
          resolveId(id) {
            if (id === '/__routing-fixture.js') return '\0routing-fixture';
          },
          load(id) {
            if (id === '\0routing-fixture') return fixture;
          },
          transform(code, id) {
            if (!id.replaceAll('\\', '/').endsWith('/src/App.tsx')) return;
            // Model production's basename condition; keep the actual App route ancestry.
            return (baseline ? app : code).replace("import.meta.env['PROD']", 'true');
          },
          configureServer(vite) {
            vite.middlewares.use(async (req, res, next) => {
              if (
                /^\/(?:src\/|@|node_modules\/|__routing-fixture|package\.json|metadata\.json)/.test(
                  req.url || ''
                )
              )
                return next();
              const url = new URL(req.url, 'http://fixture');
              const base = url.pathname.startsWith('/blog/') ? '/blog/' : '/';
              const settings = {
                siteName: 'Routing QA',
                domainUrl: 'http://127.0.0.1',
                activeThemeId: 'theme-default',
                activePlugins: [],
                customPlugins: [],
                categories: ['Business'],
                navigation: [],
                sidebarLayout: [],
                postsPerPage: 6,
                timeZone: 'UTC',
                registrationEnabled: true,
                discussionEnabled: false,
                permalinkStructure: 'category',
                analytics: { cookieConsent: false, measurementMode: 'strict' },
                theme: { primaryColor: '#123456' },
              };
              const missing = url.searchParams.get('boot404') === '1';
              const html = await vite.transformIndexHtml(
                req.url,
                '<!doctype html><html><head><meta name="voncms-tracking" content="excluded"><meta name="robots" content="noindex, follow"></head><body><div id="root"></div><script>window.VON_BASE=' +
                  JSON.stringify(base) +
                  ';window.__INITIAL_SETTINGS__=' +
                  JSON.stringify(settings) +
                  ';window.__INITIAL_SETTINGS_READY__=true;window.__INITIAL_DATA__=[];window.__INITIAL_STATE__=' +
                  JSON.stringify(missing ? { status: 'not_found', slug } : undefined) +
                  ';</script><script type="module" src="/__routing-fixture.js"></script></body></html>'
              );
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            });
          },
        },
      ],
    });
    await server.listen();
    const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
    const moduleProbe = await fetch(origin + '/src/components/layouts/AdminLayout.tsx');
    check(moduleProbe.ok, 'Fixture must serve the real admin module: ' + moduleProbe.status);
    check(
      /javascript/.test(moduleProbe.headers.get('content-type') || ''),
      'Fixture module MIME: ' +
        moduleProbe.headers.get('content-type') +
        ' ' +
        (await moduleProbe.text()).slice(0, 120)
    );
    chrome = spawn(
      chromePath,
      [
        '--headless=new',
        '--no-first-run',
        '--disable-background-networking',
        '--remote-debugging-port=0',
        '--user-data-dir=' + path.join(temp, 'profile'),
        'about:blank',
      ],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
    );
    const endpoint = await new Promise((resolve, reject) => {
      let text = '';
      const timer = setTimeout(() => reject(new Error('Chrome startup timeout')), 15000);
      chrome.stderr.on('data', (b) => {
        text += b;
        const m = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
      chrome.once('error', reject);
    });
    const tabs = await fetch('http://127.0.0.1:' + new URL(endpoint).port + '/json/list').then(
      (r) => r.json()
    );
    socket = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });
    let sequence = 0,
      documentLoads = 0;
    const pending = new Map(),
      requests = new Map();
    send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++sequence,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error('CDP ' + method + ' timeout'));
          }, 20000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    socket.onmessage = (event) => {
      const m = JSON.parse(event.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        clearTimeout(p.timer);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
      if (m.method === 'Page.loadEventFired') documentLoads++;
      if (m.method === 'Network.requestWillBeSent')
        requests.set(m.params.requestId, m.params.request.url);
      if (
        m.method === 'Network.loadingFailed' &&
        requests.get(m.params.requestId)?.startsWith(origin + '/')
      )
        console.error(
          'Fixture module request failed: ' +
            requests.get(m.params.requestId) +
            ' ' +
            m.params.errorText
        );
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400)
        console.error(
          'Fixture module HTTP ' + m.params.response.status + ': ' + m.params.response.url
        );
      if (m.method === 'Runtime.exceptionThrown')
        exceptions.push(
          m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text
        );
      if (
        m.method === 'Log.entryAdded' &&
        m.params.entry.level === 'error' &&
        !m.params.entry.text.includes('ERR_BLOCKED_BY_CLIENT')
      )
        console.error('Browser log: ' + m.params.entry.text);
      if (
        m.method === 'Network.responseReceived' &&
        m.params.type === 'Script' &&
        !/javascript/.test(m.params.response.mimeType)
      )
        console.error(
          'Non-JS script response: ' +
            JSON.stringify({ url: m.params.response.url, mime: m.params.response.mimeType })
        );
      if (m.method === 'Fetch.requestPaused') {
        const allowed = m.params.request.url.startsWith(origin + '/');
        void send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
          requestId: m.params.requestId,
          ...(!allowed ? { errorReason: 'BlockedByClient' } : {}),
        }).catch(() => {});
      }
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Log.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails)
        throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    const wait = async (expression) => {
      const until = Date.now() + 20000;
      while (Date.now() < until) {
        if (await evaluate(expression)) return;
        await pause(80);
      }
      throw new Error(
        'Browser condition failed: ' +
          expression +
          '; ' +
          (await evaluate('document.body.innerText.slice(0,600)'))
      );
    };
    const navigate = async (url) => {
      const previousLoad = documentLoads;
      await send('Page.navigate', { url: origin + url });
      const until = Date.now() + 20000;
      while (documentLoads <= previousLoad && Date.now() < until) await pause(60);
      check(documentLoads > previousLoad, 'New fixture document did not finish loading');
      await wait('!!window.__qaFetches');
    };
    for (const base of ['', '/blog']) {
      for (const actor of ['Guest', 'Root', 'Admin', 'Moderator', 'Writer', 'Member']) {
        const query = '?actor=' + actor;
        await navigate(base + '/admin/business/' + slug + query);
        const staff = ['Root', 'Admin', 'Moderator', 'Writer'].includes(actor);
        await wait(
          staff
            ? "document.body.innerText.includes('Admin page not found')"
            : actor === 'Guest'
              ? "!!document.querySelector('input[type=password]')"
              : "document.body.innerText.includes('Routing QA')"
        );
        check(!(await evaluate(articleVisible)), 'Actor escaped admin routing ' + actor);
      }
      await navigate(base + '/business/' + slug);
      await wait(articleVisible);
      for (const key of [
        'login',
        'install',
        'register',
        'reset-password',
        'assets',
        'api',
        'profile',
      ]) {
        const tail = key === 'profile' ? 'business/' + slug : slug;
        await evaluate(
          'history.pushState({usr:null,key:"routing-qa",idx:1},"",' +
            JSON.stringify(base + '/' + key + '/' + tail) +
            ');window.dispatchEvent(new PopStateEvent("popstate",{state:history.state}));'
        );
        await wait('document.body.innerText.includes("This Page Isn\'t Available")');
        check(!(await evaluate(articleVisible)), 'Stale public body at ' + key);
        await send('Page.reload', { ignoreCache: true });
        await wait('document.body.innerText.includes("This Page Isn\'t Available")');
        check(!(await evaluate(articleVisible)), 'Reload public body at ' + key);
        await evaluate(
          'history.pushState({usr:null,key:"routing-back",idx:2},"",' +
            JSON.stringify(base + '/business/' + slug) +
            ');window.dispatchEvent(new PopStateEvent("popstate",{state:history.state}));'
        );
        await wait(articleVisible);
        check(true, 'Public recovery');
      }
      await evaluate('history.back()');
      await wait('document.body.innerText.includes("This Page Isn\'t Available")');
      check(
        !(await evaluate(articleVisible)),
        'Browser Back retained a public article under a system path'
      );
      await evaluate('history.forward()');
      await wait(articleVisible);
      check(true, 'Browser Forward recovered the legitimate article');
      await navigate(base + '/install/business/' + slug + '?boot404=1');
      await wait('document.body.innerText.includes("This Page Isn\'t Available")');
      await evaluate(
        'history.pushState({usr:null,key:"date-recovery",idx:1},"",' +
          JSON.stringify(base + '/2026/11/' + slug) +
          ');window.dispatchEvent(new PopStateEvent("popstate",{state:history.state}));'
      );
      await wait(articleVisible);
      check(true, 'Original 404 state must not poison a new valid route');
    }
    check(exceptions.length === 0, 'Unexpected browser exception: ' + exceptions.join('\n'));
  } finally {
    if (send) await send('Browser.close').catch(() => {});
    if (chrome && chrome.exitCode === null)
      await Promise.race([new Promise((r) => chrome.once('exit', r)), pause(3000)]);
    if (chrome && chrome.exitCode === null) {
      chrome.kill();
      await pause(1000);
    }
    if (socket) socket.close();
    if (server) await server.close();
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('voncms-public-routing-'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function apache() {
  const binary = process.env.HTTPD_BIN;
  const php = process.env.PHP_BIN;
  if (!binary || !fs.existsSync(binary) || !php)
    throw new Error('NOT_RUN: set HTTPD_BIN and PHP_BIN');
  const filename = (p) => p.replaceAll('\\', '/');
  const serverRoot = path.resolve(path.dirname(binary), '..');
  const write = (name, value) => {
    const destination = path.join(temp, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, value);
    return destination;
  };
  const repair = read('public/api/system/repair_htaccess.php').match(
    /function getHtaccessContent\(\$prefix\)[\s\S]*?^}/m
  )?.[0];
  const installer = read('public/api/install.php').match(
    /\$htaccessContent = <<<EOT\r?\n[\s\S]*?\r?\n[ \t]*EOT;/
  )?.[0];
  assert.ok(repair && installer, 'Actual installer/repair templates are required');
  const render = (code) => {
    const r = spawnSync(php, ['-r', code], { encoding: 'utf8', windowsHide: true });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    return r.stdout;
  };
  const deploy = process.env.VONCMS_ROUTING_APACHE_BASELINE
    ? fs.readFileSync(process.env.VONCMS_ROUTING_APACHE_BASELINE, 'utf8')
    : read('public/.htaccess');
  const variants = new Map([
    ['deploy', { rules: deploy }],
    ['source', { rules: read('.htaccess'), child: deploy }],
    ['installed', { rules: render(installer + ' echo $htaccessContent;') }],
    ['repaired', { rules: render(repair + " echo getHtaccessContent('');") }],
    [
      'source-repaired',
      {
        rules: render(repair + " echo getHtaccessContent('public/');"),
        child: render(repair + " echo getHtaccessContent('');"),
      },
    ],
  ]);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-routing-apache-'));
  let apacheProcess;
  try {
    for (const [name, variant] of variants) {
      write(name + '/.htaccess', variant.rules);
      const pub = name + (variant.child ? '/public' : '');
      if (variant.child) write(pub + '/.htaccess', variant.child);
      for (const file of [
        'api/fixture.php',
        'api/system/fixture.php',
        'api/mail_helper.php',
        'index.php',
        'uploads/fixture.png',
      ])
        write(pub + '/' + file, 'ROUTING_FIXTURE');
    }
    const port = await new Promise((resolve, reject) => {
      const socket = net.createServer();
      socket.once('error', reject);
      socket.listen(0, '127.0.0.1', () => {
        const port = socket.address().port;
        socket.close(() => resolve(port));
      });
    });
    const moduleNames = new Set([
      'authz_core_module',
      'authz_host_module',
      'access_compat_module',
      'dir_module',
      'mime_module',
      'rewrite_module',
      'headers_module',
      'env_module',
      'setenvif_module',
      'filter_module',
      'deflate_module',
      'log_config_module',
      'alias_module',
    ]);
    const modules = fs
      .readFileSync(path.join(serverRoot, 'conf/httpd.conf'), 'utf8')
      .split(/\r?\n/)
      .filter(
        (line) =>
          /^\s*LoadModule\s+(\S+)/.test(line) &&
          moduleNames.has(line.match(/^\s*LoadModule\s+(\S+)/)[1])
      );
    const aliases = [
      ['blog', 'deploy'],
      ...[...variants.keys()].filter((n) => n !== 'deploy').map((n) => [n, n]),
    ]
      .map(([url, dir]) => 'Alias /' + url + '/ "' + filename(path.join(temp, dir)) + '/"')
      .join('\n');
    const config = write(
      'httpd.conf',
      [
        'ServerRoot "' + filename(serverRoot) + '"',
        ...modules,
        'Listen 127.0.0.1:' + port,
        'ServerName 127.0.0.1',
        'PidFile "' + filename(path.join(temp, 'httpd.pid')) + '"',
        'ErrorLog "' + filename(path.join(temp, 'error.log')) + '"',
        'TypesConfig "' + filename(path.join(serverRoot, 'conf/mime.types')) + '"',
        'DocumentRoot "' + filename(path.join(temp, 'deploy')) + '"',
        aliases,
        '<Directory "' + filename(temp) + '">',
        'AllowOverride All',
        'Require all granted',
        'Options FollowSymLinks',
        '</Directory>',
      ].join('\n')
    );
    const syntax = spawnSync(binary, ['-t', '-f', config], { encoding: 'utf8', windowsHide: true });
    assert.equal(syntax.status, 0, syntax.stderr);
    apacheProcess = spawn(binary, ['-X', '-f', config], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let output = '';
    apacheProcess.stderr.on('data', (b) => (output += b));
    const origin = 'http://127.0.0.1:' + port;
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (apacheProcess.exitCode !== null) throw new Error('QA Apache exited: ' + output);
      try {
        await fetch(origin + '/api/fixture.php');
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    check(ready, 'Isolated Apache did not start');
    for (const prefix of ['', '/blog', '/source', '/installed', '/repaired', '/source-repaired']) {
      for (const [tail, expected] of [
        ['/api/fixture.php', 200],
        ['/api/system/fixture.php', 200],
        ['/api/missing', 404],
        ['/api/missing/deep/path', 404],
        ['/api/system/missing.php', 404],
        ['/api/fixture.php/extra', 404],
        ['/api/mail_helper.php', 403],
        ['/uploads/fixture.png', 200],
        ['/uploads/missing', 404],
        ['/core/missing', 403],
        ['/temp_update/missing', 403],
      ]) {
        const effectiveTail =
          prefix.includes('source') && tail === '/uploads/fixture.png' ? '/public' + tail : tail;
        const response = await fetch(origin + prefix + effectiveTail, { redirect: 'manual' });
        const body = await response.text();
        check(
          response.status === expected,
          prefix + tail + ' expected ' + expected + ', got ' + response.status
        );
        if (expected === 200)
          check(body === 'ROUTING_FIXTURE', 'Valid file changed: ' + prefix + tail);
      }
      if (prefix.includes('source')) {
        const response = await fetch(origin + prefix + '/public/api/missing/deep/path');
        check(response.status === 404, 'Direct Source public path missing API must be 404');
      }
    }
    check(
      !fs.readFileSync(path.join(temp, 'error.log'), 'utf8').includes('AH00124'),
      'Missing API caused an Apache internal redirect loop'
    );
  } finally {
    if (apacheProcess && apacheProcess.exitCode === null) {
      apacheProcess.kill();
      await new Promise((r) => apacheProcess.once('exit', r));
    }
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('voncms-routing-apache-'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

(async () => {
  if (process.argv.includes('--browser')) await browser();
  if (process.argv.includes('--apache')) await apache();
  console.log(
    'PASS Public routing: ' +
      checks +
      ' checks' +
      (process.argv.includes('--browser')
        ? ' (actual App, synthetic API, real Chrome)'
        : process.argv.includes('--apache')
          ? ' (actual Apache and generated templates, route policy)'
          : ' (actual route tree and policy)')
  );
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = /NOT_RUN:/.test(error.message) ? 2 : 1;
});
