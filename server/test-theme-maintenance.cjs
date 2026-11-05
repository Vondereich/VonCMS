const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const noop = () => {};
const Blank = () => null;
const queryCalls = [];
const commentCalls = [];
const posts = Array.from({ length: 13 }, (_, index) => ({
  id: String(index + 1),
  title: `QA article ${index + 1}`,
  slug: `qa-${index + 1}`,
  content: 'QA content',
  excerpt: 'QA excerpt',
  category: 'News',
  author: 'tester',
  status: 'published',
  createdAt: '2026-10-01T00:00:00Z',
  publishedAt: '2026-10-01T00:00:00Z',
}));
const user = { id: '9', username: 'tester', role: 'admin', display_name: 'Tester' };
const settings = {
  siteName: 'QA Site',
  siteDescription: 'QA Description',
  postsPerPage: 13,
  theme: { primaryColor: '#0066cc', portfolio: { animationStyle: 'none' } },
  ads: { adsEnabled: false, popupAd: '' },
  navigation: [],
  sidebarLayout: [],
  activePlugins: [],
  newsletter: { enabled: false },
};
const shared = {
  usePublicPostsQuery: (options) => {
    queryCalls.push(options);
    const visible = options.initialPosts.slice(0, options.limit);
    return { posts: visible, total: visible.length, meta: {}, loadMore: noop };
  },
  useAISummary: () => ({ component: null, position: 'top' }),
  useRelatedPosts: () => null,
  useAdsPopup: () => ({ showPopup: false, closePopup: noop }),
  usePublicProfile: () => ({ targetProfile: user, isLoading: false }),
  useProfileActivity: () => ({ articlePosts: [], commentItems: [] }),
  VpComments: (props) => {
    commentCalls.push(props);
    return null;
  },
  decodeEntities: (value) => value,
  formatDate: () => 'Oct 1, 2026',
  formatDateTime: () => 'Oct 1, 2026',
  getPostPublishTimestamp: (post) => post.publishedAt,
  getResponsiveImageAttributes: () => ({}),
  hasEmbeddedVideoMarkup: () => false,
  hasActiveSidebarContent: () => false,
  PUBLIC_SEARCH_MAX_LENGTH: 200,
  normalizePublicSearchInput: (value) => value,
};
const helpers = {
  ...shared,
  getBasePathPrefix: () => '/zangetsu',
  getPublicHomeHref: () => '/zangetsu/',
  getPublicCategoryHref: (value) => `/zangetsu/?category=${encodeURIComponent(value)}`,
  getPublicProfileHref: (value) => `/zangetsu/profile/${value}`,
  getPermalink: (post) => `/zangetsu/${post.slug}`,
  getSameSiteCategoryNavigation: () => null,
  normalizeSiteUrl: (value) => value,
  getHeaderIdentityState: () => ({ showTitle: true }),
  getVisibleNavigationItems: (items) => items,
  getOverflowNavigationItems: () => [],
  shouldUseTabletBurgerMenu: () => false,
  isSystemPluginActive: () => false,
  getProfileDisplayRole: () => 'Admin',
  isOwnUserProfile: () => true,
  handleCrawlableLinkClick: noop,
};

// Exercise real theme/component code with fixed public data and no network or database writes.
function load(file, react = React, mocks = {}, runtime = {}, extraExports = '', sourceOverride) {
  const module = { exports: {} };
  const proxy = new Proxy(helpers, { get: (object, key) => object[key] ?? Blank });
  const requireMock = (name) => {
    if (Object.hasOwn(mocks, name)) {
      if (name.endsWith('/utils/api'))
        return { getErrorMessage: apiErrorHelpers.getErrorMessage, ...mocks[name] };
      return mocks[name];
    }
    if (name === 'react') {
      // Fixed-render component fixtures supply Hook snapshots without a React dispatcher.
      // Real committed Effect Event behavior is covered by the isolated Chrome fixtures.
      const hooks =
        react === React
          ? react
          : {
              ...react,
              useCallback:
                react.useCallback === React.useCallback
                  ? (callback) => callback
                  : react.useCallback,
              useEffectEvent:
                react.useEffectEvent === React.useEffectEvent
                  ? (callback) => callback
                  : react.useEffectEvent,
            };
      return { __esModule: true, ...hooks, default: hooks };
    }
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'react-hot-toast')
      return { __esModule: true, default: { success: noop, error: noop } };
    if (name === 'react-gravatar') return { __esModule: true, default: Blank };
    if (name === 'lucide-react') return new Proxy({}, { get: () => Blank });
    if (name.endsWith('/shared')) return new Proxy(shared, { get: (o, key) => o[key] ?? Blank });
    if (name.endsWith('settingsDraft')) return load('src/utils/settingsDraft.ts');
    if (name.endsWith('/shared/themeSettings')) return load('src/themes/shared/themeSettings.ts');
    if (name.endsWith('/shared/themeColors')) return load('src/themes/shared/themeColors.ts');
    if (name.endsWith('/corporate-pro/config')) return load('src/themes/corporate-pro/config.ts');
    if (name === '../config' && file.includes('themes/corporate-pro/'))
      return load('src/themes/corporate-pro/config.ts');
    if (name.endsWith('/settings/LayoutPanel'))
      return load('src/themes/corporate-pro/settings/LayoutPanel.tsx');
    if (name.endsWith('/components/PublicNavigationLink'))
      return {
        __esModule: true,
        default: (props) =>
          React.createElement('a', { className: props.className, href: '#' }, props.children),
      };
    if (name.startsWith('./') && file.includes('themes/corporate-pro/')) {
      const candidate = path.posix.join(path.posix.dirname(file), name);
      for (const extension of ['.ts', '.tsx'])
        if (fs.existsSync(path.join(root, candidate + extension)))
          return load(candidate + extension, react);
    }
    if (name.endsWith('site.config')) return { API: {} };
    if (file === 'src/utils/siteUtils.ts' && name === './textUtils') return shared;
    if (name.includes('/utils/') || name.includes('/hooks/')) return proxy;
    return new Proxy({ __esModule: true, default: Blank }, { get: (o, key) => o[key] ?? Blank });
  };
  const code = ts.transpileModule((sourceOverride ?? read(file)) + extraExports, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require: requireMock,
      console,
      window: { location: { href: 'http://localhost/zangetsu/' } },
      ...runtime,
    },
    { filename: file }
  );
  return module.exports;
}

const apiErrorHelpers = load('src/utils/api.ts', React, { './security': { getCsrfToken: noop } });
helpers.getErrorMessage = apiErrorHelpers.getErrorMessage;
helpers.getSavedProfileUpdates = load('src/utils/profileUtils.ts').getSavedProfileUpdates;

const base = {
  posts,
  pages: [],
  user: null,
  comments: [],
  allUsers: [user],
  settings,
  currentView: 'home',
  selectedPost: null,
  selectedProfile: null,
  publicSearchQuery: '',
  onPostClick: noop,
  onPageClick: noop,
  onLogin: noop,
  onLogout: noop,
  onNavigateAdmin: noop,
  onBackToHome: noop,
  onViewProfile: noop,
  onAddComment: noop,
  onLikeComment: noop,
  onReplyComment: noop,
  onCategoryClick: noop,
};
const Portfolio = load('src/themes/portfolio/Layout.tsx').default;
const Digest = load('src/themes/digest/Layout.tsx').default;
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

function checkStickySidebar() {
  const file = 'src/themes/shared/components/StickySidebar.tsx';
  let height = 420;
  let resize;
  let release;
  let disconnected = false;
  const styles = new Map();
  const attributes = new Map();
  const element = {
    getBoundingClientRect: () => ({ height }),
    style: { setProperty: (key, value) => styles.set(key, value) },
    setAttribute: (key, value) => attributes.set(key, value),
  };
  const hooks = {
    ...React,
    useRef: () => ({ current: element }),
    useEffect: (effect) => (release = effect()),
  };
  class Observer {
    constructor(callback) {
      resize = callback;
    }
    observe(target) {
      assert.equal(target, element);
    }
    disconnect() {
      disconnected = true;
    }
  }
  const Component = load(file, hooks, {}, { ResizeObserver: Observer }).default;
  const tree = Component({ className: 'space-y-8', children: 'Keep widgets' });
  assert.equal(tree.type, 'aside');
  assert.equal(tree.props.children, 'Keep widgets');
  assert.ok(tree.props.className.includes('lg:data-[sticky-ready=true]:sticky'));
  assert.ok(tree.props.className.includes('min(6rem,calc(100dvh-'));
  assert.ok(!/overflow-y|fixed|max-h-/.test(tree.props.className));
  assert.equal(styles.get('--voncms-sidebar-height'), '420px');
  assert.equal(attributes.get('data-sticky-ready'), 'true');
  height = 1300.3;
  resize();
  assert.equal(styles.get('--voncms-sidebar-height'), '1301px');
  release();
  assert.equal(disconnected, true);
  attributes.clear();
  load(file, hooks).default({ children: 'Static fallback' });
  assert.equal(attributes.has('data-sticky-ready'), false);
  assert.equal(release, undefined);
  const html = render(load(file).default, { children: 'SSR widgets' });
  assert.ok(html.includes('SSR widgets'));
  assert.ok(!html.includes('data-sticky-ready="true"'));
  for (const [theme, count] of [
    ['default', 1],
    ['digest', 1],
    ['techpress', 2],
  ]) {
    const layout = read(`src/themes/${theme}/Layout.tsx`);
    assert.equal((layout.match(/<StickySidebar\s/g) || []).length, count);
    assert.equal((layout.match(/<\/StickySidebar>/g) || []).length, count);
  }
  console.log(
    'PASS Sticky Sidebar Runtime: shared wrapper measures asynchronous heights, disconnects on unmount, fails static without ResizeObserver and preserves SSR children; desktop-only wiring covers all four existing sidebar locations. Actual scrolling requires browser proof.'
  );
}
checkStickySidebar();

const appearance = load('src/themes/shared/themeSettings.ts');
const themeKeys = Object.values(appearance.THEME_SETTINGS_KEYS);
const legacy = {
  ...settings,
  theme: {
    primaryColor: '#123456',
    fontFamily: 'Georgia, serif',
    borderRadius: '0.75rem',
    default: { navColor: '#171717' },
    portfolio: { accentColor: '#abcdef' },
    digest: { accentColor: '#fedcba', heroStyle: 'overlay' },
    corporatePro: { heroTitle: 'Keep corporate copy' },
    customTheme: { keep: true },
  },
};
const legacyJson = JSON.stringify(legacy);
const edits = {
  default: { primaryColor: '#ff8800', fontFamily: 'system-ui', borderRadius: '1rem' },
  corporatePro: { primaryColor: '#003322' },
  techpress: { primaryColor: '#772233' },
  portfolio: { accentColor: '#445566' },
  digest: { accentColor: '#778899' },
  prism: { colorScheme: 'green' },
};
for (const key of themeKeys) {
  const baseline = legacy.theme[key] || {};
  const next = appearance.buildThemeSettingsUpdate(legacy, key, baseline, {
    ...baseline,
    ...edits[key],
  });
  assert.equal(next.theme.primaryColor, legacy.theme.primaryColor);
  assert.equal(next.theme.fontFamily, legacy.theme.fontFamily);
  assert.equal(next.theme.borderRadius, legacy.theme.borderRadius);
  assert.equal(next.theme.customTheme, legacy.theme.customTheme);
  assert.equal(next.navigation, legacy.navigation);
  assert.equal(next.postsPerPage, legacy.postsPerPage);
  for (const other of themeKeys.filter((candidate) => candidate !== key)) {
    assert.deepEqual(
      appearance.getThemeAppearance(next, other),
      appearance.getThemeAppearance(legacy, other),
      `${key} save changed ${other}`
    );
  }
  for (const [field, value] of Object.entries(edits[key]))
    assert.equal(next.theme[key][field], value);
  assert.equal(next.theme.prism.neonEffects, true);
  assert.equal(next.theme.prism.fontSize, 'md');
  assert.equal(next.theme.digest.heroStyle, 'overlay');
  assert.equal(next.theme.corporatePro.heroTitle, 'Keep corporate copy');
  const color = key === 'prism' ? '#22c55e' : edits[key].primaryColor || edits[key].accentColor;
  assert.equal(appearance.getThemeAppearance(next, key).primaryColor, color);
  assert.deepEqual(
    JSON.parse(JSON.stringify(appearance.initializeThemeAppearance(next))),
    JSON.parse(JSON.stringify(next.theme))
  );
}
assert.equal(JSON.stringify(legacy), legacyJson);
// Missing fields in an existing Prism config are behavior, not permission to enable effects.
for (const prism of [{ colorScheme: 'purple' }, { colorScheme: 'green', neonEffects: false }]) {
  const partial = { ...legacy, theme: { ...legacy.theme, prism } };
  const saved = appearance.buildThemeSettingsUpdate(partial, 'default', partial.theme.default, {
    ...partial.theme.default,
    primaryColor: '#ff8800',
  });
  assert.equal(saved.theme.prism.neonEffects, prism.neonEffects);
  assert.equal(saved.theme.prism.colorScheme, prism.colorScheme);
  assert.equal(saved.theme.prism.fontSize, undefined);
}
const Corporate = load('src/themes/corporate-pro/Layout.tsx').default;
for (const color of ['#ff0000', '#00ff00', '#ffffff', '#000000']) {
  for (const isDarkMode of [true, false]) {
    const selected = {
      ...legacy,
      theme: { ...legacy.theme, corporatePro: { primaryColor: color } },
    };
    const html = render(Corporate, {
      ...base,
      isDarkMode,
      settings: appearance.resolvePublicThemeSettings(selected, 'theme-corporate-pro'),
    });
    assert.ok(html.includes(`--corporate-accent:${color}`));
    assert.ok(html.includes('bg-(--corporate-accent)'));
    assert.ok(html.includes('text-(--corporate-on-accent)'));
    assert.ok(!/(bg|text|ring|shadow)-blue-\d/.test(html));
  }
}
const themeColors = load('src/themes/shared/themeColors.ts');
assert.equal(themeColors.getReadableForeground('#fff'), '#111827');
assert.equal(themeColors.getReadableForeground('#000'), '#ffffff');
assert.equal(themeColors.getReadableForeground('invalid'), '#ffffff');
assert.equal(appearance.resolvePublicThemeSettings(legacy, 'custom-theme'), legacy);
assert.equal(appearance.resolvePublicThemeSettings(legacy, '__proto__'), legacy);
// Each active layout receives its own appearance, not Default's current controls.
for (const [id, key] of Object.entries(appearance.THEME_SETTINGS_KEYS)) {
  const seen = [];
  const PublicSite = load('src/plugins/von-core/features/public/PublicSite.tsx', React, {
    'react-router': { useLocation: () => ({ pathname: '/zangetsu/', search: '' }) },
    '../themes/ThemeContext': { useTheme: () => ({ activeTheme: { id } }) },
    './themeLayoutLoader': {
      resolvePublicThemeId: (value) => value,
      getLoadedPublicThemeLayout: () => (props) => {
        seen.push(props.settings);
        return null;
      },
    },
  }).default;
  render(PublicSite, { ...base, settings: legacy });
  assert.equal(seen.length, 1);
  const resolved = appearance.getThemeAppearance(legacy, key);
  for (const field of ['primaryColor', 'fontFamily', 'borderRadius'])
    assert.equal(seen[0].theme[field], resolved[field], `${id} ${field}`);
  assert.equal(seen[0].postsPerPage, legacy.postsPerPage);
  assert.equal(seen[0].theme.default, legacy.theme.default);
}
assert.equal(JSON.stringify(legacy), legacyJson);

for (const limit of [6, 13, 20, 50]) {
  queryCalls.length = 0;
  render(Portfolio, { ...base, settings: { ...settings, postsPerPage: limit } });
  assert.equal(queryCalls.length, 1);
  assert.equal(queryCalls[0].limit, limit);
}
for (const view of ['home', 'category', 'single-post', 'page', 'profile']) {
  const html = render(Portfolio, {
    ...base,
    currentView: view,
    isAuthLoading: true,
    selectedPost: posts[0],
    selectedProfile: 'tester',
    selectedCategory: view === 'category' ? 'News' : null,
    selectedPage: { id: 'p1', title: 'QA page', slug: 'qa-page', content: 'QA content' },
  });
  assert.ok(html.includes('data-auth-placeholder="true"'), view);
  assert.ok(!/>Login</.test(html), view);
}
assert.ok(/>Login</.test(render(Portfolio, { ...base, isAuthLoading: false })));
commentCalls.length = 0;
render(Portfolio, {
  ...base,
  currentView: 'single-post',
  selectedPost: posts[0],
  onLoadMoreComments: noop,
  hasMoreComments: true,
  commentsLoading: true,
  commentsError: 'QA retry',
});
assert.equal(commentCalls.length, 1);
assert.equal(commentCalls[0].onLoadMoreComments, noop);
assert.equal(commentCalls[0].hasMoreComments, true);
assert.equal(commentCalls[0].commentsLoading, true);
assert.equal(commentCalls[0].commentsError, 'QA retry');
for (const heroStyle of ['fullscreen', 'split', 'minimal']) {
  for (const animationStyle of ['fade', 'slide', 'none']) {
    const html = render(Portfolio, {
      ...base,
      settings: {
        ...settings,
        theme: { ...settings.theme, portfolio: { heroStyle, animationStyle } },
      },
    });
    assert.equal(html.includes('animation-delay:100ms'), animationStyle !== 'none');
    assert.ok(!/class="[^"]*animation-delay:/.test(html));
  }
}
// Simulate three appended pages without resetting each card's absolute index.
const appendedProjects = Array.from({ length: 39 }, (_, index) => ({
  ...posts[index % posts.length],
  id: `appended-${index}`,
}));
const AppendedPortfolio = load('src/themes/portfolio/Layout.tsx', React, {
  '../shared': new Proxy(
    {
      ...shared,
      usePublicPostsQuery: (options) => ({ posts: options.initialPosts, loadMore: noop }),
    },
    { get: (object, key) => object[key] ?? Blank }
  ),
}).default;
for (const animationStyle of ['fade', 'slide', 'none']) {
  const html = render(AppendedPortfolio, {
    ...base,
    posts: appendedProjects,
    settings: {
      ...settings,
      theme: { ...settings.theme, portfolio: { animationStyle } },
    },
  });
  const cards = [...html.matchAll(/<article\b[^>]*>/g)];
  assert.equal(cards.length, appendedProjects.length);
  cards.forEach(([markup], index) => {
    const delay = /animation-delay:(\d+)ms/.exec(markup)?.[1];
    assert.equal(delay, animationStyle === 'none' ? undefined : String(Math.min(index, 2) * 100));
  });
}
for (const showHero of [true, false]) {
  for (const filter of [{}, { selectedCategory: 'News' }, { publicSearchQuery: 'QA article' }]) {
    const html = render(Digest, {
      ...base,
      ...filter,
      settings: {
        ...settings,
        theme: { ...settings.theme, digest: { showHero, showTrending: false } },
      },
    });
    for (const post of posts) assert.ok(html.includes(`${post.title}<`), post.title);
  }
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.map((item) => find(item, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}
async function checkSettings() {
  const values = [];
  let cursor = 0;
  let saved;
  let closed = 0;
  const react = {
    ...React,
    useState: (initial) => {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [
        values[index],
        (next) => {
          values[index] = typeof next === 'function' ? next(values[index]) : next;
        },
      ];
    },
  };
  const Component = load(
    'src/plugins/von-core/features/extensions/components/DefaultThemeSettings.tsx',
    react
  ).DefaultThemeSettings;
  const baseline = {
    ...settings,
    theme: {
      ...settings.theme,
      borderRadius: '0.5rem',
      default: { navColor: '#111111', footerLinks: [] },
    },
  };
  const props = {
    settings: baseline,
    onUpdate: (next) => {
      saved = next;
      return false;
    },
    onClose: () => closed++,
  };
  const draw = (current) => {
    cursor = 0;
    return Component(current);
  };
  let tree = draw(props);
  find(tree, (n) => n.props?.['aria-label'] === 'Border Radius').props.onChange({
    target: { value: '1rem' },
  });
  tree = draw(props);
  find(tree, (n) => n.props?.['aria-label'] === 'Header & Footer').props.onChange({
    target: { value: '#222222' },
  });
  tree = draw(props);
  find(tree, (n) => n.props?.['aria-label'] === 'Accent Color').props.onChange({
    target: { value: '#ff8800' },
  });
  tree = draw(props);
  find(tree, (n) => n.props?.['aria-label'] === 'Font Family').props.onChange({
    target: { value: 'system-ui' },
  });
  const latest = {
    ...baseline,
    siteName: 'New name',
    api: { mapsApiKey: 'new-value' },
    theme: {
      ...baseline.theme,
      primaryColor: '#112233',
      digest: { showHero: false },
      default: {
        ...baseline.theme.default,
        footerLinks: [{ label: 'Contact', url: '/contact' }],
        enableMarquee: false,
      },
    },
  };
  tree = draw({ ...props, settings: latest });
  await find(
    tree,
    (n) => n.type === 'button' && n.props.onClick?.name === 'handleSave'
  ).props.onClick();
  assert.equal(saved.siteName, latest.siteName);
  assert.equal(saved.api, latest.api);
  assert.equal(saved.theme.primaryColor, latest.theme.primaryColor);
  assert.equal(saved.theme.digest.showHero, latest.theme.digest.showHero);
  assert.equal(saved.theme.borderRadius, latest.theme.borderRadius);
  assert.equal(saved.theme.default.borderRadius, '1rem');
  assert.equal(saved.theme.default.primaryColor, '#ff8800');
  assert.equal(saved.theme.default.fontFamily, 'system-ui');
  assert.equal(saved.theme.corporatePro.primaryColor, latest.theme.primaryColor);
  assert.equal(saved.theme.techpress.primaryColor, latest.theme.primaryColor);
  assert.equal(saved.theme.default.navColor, '#222222');
  assert.equal(saved.theme.default.footerLinks, latest.theme.default.footerLinks);
  assert.equal(saved.theme.default.enableMarquee, false);
  assert.equal(closed, 0);
  tree = draw({ ...props, settings: latest, onUpdate: () => true });
  await find(
    tree,
    (n) => n.type === 'button' && n.props.onClick?.name === 'handleSave'
  ).props.onClick();
  assert.equal(closed, 1);
}

async function checkThemeCustomizer(key, file, exportName, change) {
  const values = [];
  let cursor = 0;
  let saved;
  const react = {
    ...React,
    useState: (initial) => {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [
        values[index],
        (next) => {
          values[index] = typeof next === 'function' ? next(values[index]) : next;
        },
      ];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
    useId: () => 'qa-panel',
  };
  const Component = load(file, react)[exportName];
  const props = {
    settings: legacy,
    onUpdate: (next) => {
      saved = next;
      return false;
    },
    onClose: noop,
  };
  const draw = () => {
    cursor = 0;
    return Component(props);
  };
  const initialTree = draw();
  change(initialTree);
  const tree = draw();
  await find(
    tree,
    (node) => node.type === 'button' && node.props.onClick?.name === 'handleSave'
  ).props.onClick();
  assert.ok(saved, key);
  assert.equal(saved.theme.primaryColor, legacy.theme.primaryColor);
  assert.equal(saved.postsPerPage, legacy.postsPerPage);
  for (const other of themeKeys.filter((candidate) => candidate !== key))
    assert.deepEqual(
      appearance.getThemeAppearance(saved, other),
      appearance.getThemeAppearance(legacy, other)
    );
  for (const [field, value] of Object.entries(edits[key]))
    assert.equal(saved.theme[key][field], value);
  assert.equal(saved.theme.digest.heroStyle, 'overlay');
}

const colorChange = (key, label) => (tree) =>
  find(
    tree,
    (node) =>
      node.type === 'input' && node.props.type === 'color' && node.props['aria-label'] === label
  ).props.onChange({ target: { value: edits[key].primaryColor || edits[key].accentColor } });
async function checkOtherCustomizers() {
  const directory = 'src/plugins/von-core/features/extensions/components/';
  for (const [key, name, label] of [
    ['techpress', 'TechPressSettings', 'Primary Color'],
    ['portfolio', 'PortfolioSettings', 'Accent Color'],
    ['digest', 'DigestSettings', 'Accent Color'],
  ])
    await checkThemeCustomizer(key, directory + name + '.tsx', name, colorChange(key, label));
  await checkThemeCustomizer('prism', directory + 'PrismSettings.tsx', 'PrismSettings', (tree) => {
    const text = (node) =>
      typeof node === 'string'
        ? node
        : Array.isArray(node)
          ? node.map(text).join('')
          : text(node?.props?.children || '');
    find(
      tree,
      (node) => node.type === 'button' && text(node).includes('MATRIX_GREEN')
    ).props.onClick();
  });
  await checkThemeCustomizer(
    'corporatePro',
    'src/plugins/von-core/features/settings/components/themes/CorporateProSettings.tsx',
    'CorporateProSettings',
    (tree) => {
      const panel = find(
        tree,
        (node) => typeof node.type === 'function' && node.type.name === 'LayoutPanel'
      );
      const expanded = panel.type(panel.props);
      find(
        expanded,
        (node) => node.type === 'input' && node.props.id === 'corporate-accent'
      ).props.onChange({ target: { value: edits.corporatePro.primaryColor } });
    }
  );
}

function checkAdsManager() {
  const previousAdBlock = shared.AdBlock;
  shared.AdBlock = ({ content, slotId }) =>
    React.createElement('i', { 'data-qa-ad': slotId }, content);
  const ads = {
    adsEnabled: true,
    headerAd: 'QA_HEADER_AD',
    inFeedAd: 'QA_FEED_AD',
    inFeedFrequency: 6,
    popupEnabled: false,
    popupAd: '',
  };
  try {
    for (const id of ['default', 'digest', 'prism', 'techpress', 'portfolio', 'corporate-pro']) {
      const Layout = load(`src/themes/${id}/Layout.tsx`).default;
      const enabled = render(Layout, { ...base, settings: { ...settings, ads } });
      assert.equal((enabled.match(/QA_HEADER_AD/g) || []).length, 1, id);
      assert.ok(enabled.includes('QA_FEED_AD'), `${id} missing in-feed slot`);
      const disabled = render(Layout, {
        ...base,
        settings: { ...settings, ads: { ...ads, adsEnabled: false } },
      });
      assert.doesNotMatch(disabled, /QA_HEADER_AD|QA_FEED_AD/, id);
    }
    for (const interval of [6, 8, 10, 12]) {
      const html = render(Portfolio, {
        ...base,
        settings: { ...settings, ads: { ...ads, inFeedFrequency: interval } },
      });
      assert.equal((html.match(/QA_FEED_AD/g) || []).length, Math.floor(posts.length / interval));
      assert.ok(html.indexOf('QA_HEADER_AD') < html.indexOf('id="projects"'));
    }
    for (const props of [
      { currentView: 'single-post', selectedPost: posts[0] },
      { currentView: 'page', selectedPage: { ...posts[0], title: 'QA page' } },
    ]) {
      const html = render(Portfolio, { ...base, ...props, settings: { ...settings, ads } });
      assert.equal((html.match(/QA_HEADER_AD/g) || []).length, 1);
      assert.doesNotMatch(html, /QA_FEED_AD/);
    }
  } finally {
    if (previousAdBlock === undefined) delete shared.AdBlock;
    else shared.AdBlock = previousAdBlock;
  }

  const adReact = {
    ...React,
    useRef: () => ({ current: null }),
    useMemo: (factory) => factory(),
    useEffect: noop,
  };
  const AdBlock = load('src/themes/shared/components/AdBlock.tsx', adReact, {
    'react-router': { useLocation: () => ({ pathname: '/zangetsu/' }) },
    '../../../utils/security': { sanitizeHtml: (html) => html, AD_ALLOWED_STYLE_PROPS: new Set() },
  }).default;
  for (const content of [
    '<div><style>body{color:red}</style>QA</div>',
    '<svg><STYLE>body{color:red}</STYLE></svg>',
    '<script>window.qa=1</script>',
    '<iframe src="https://example.org"></iframe>',
  ]) {
    const html = render(AdBlock, { content });
    assert.doesNotMatch(html, /<style|<script|<iframe/i, 'isolated markup leaked into parent');
    assert.doesNotMatch(html, /QA/);
  }
  assert.ok(
    render(AdBlock, { content: '<div style="color:red">QA plain banner</div>' }).includes(
      'QA plain banner'
    )
  );

  function popupHarness() {
    let state = false,
      lastDeps,
      pendingEffect,
      cleanup,
      timerId = 0;
    const timers = new Map();
    const hook = load(
      'src/hooks/useAdsPopup.ts',
      {
        ...React,
        useState: () => [
          state,
          (value) => {
            state = value;
          },
        ],
        useCallback: (callback) => callback,
        useEffect: (effect, deps) => {
          if (!lastDeps || deps.some((value, index) => value !== lastDeps[index])) {
            lastDeps = deps;
            pendingEffect = effect;
          }
        },
      },
      {},
      {
        setTimeout: (callback) => {
          timers.set(++timerId, callback);
          return timerId;
        },
        clearTimeout: (id) => timers.delete(id),
      }
    ).useAdsPopup;
    return {
      render(config, view = 'home') {
        const result = hook(config, view);
        if (pendingEffect) {
          cleanup?.();
          const effect = pendingEffect;
          pendingEffect = null;
          cleanup = effect();
        }
        return result;
      },
      fire() {
        const callbacks = [...timers.values()];
        timers.clear();
        callbacks.forEach((callback) => callback());
      },
      pending: () => timers.size,
    };
  }
  const popup = { ...ads, popupEnabled: true, popupAd: 'QA popup' };
  for (const [config, view] of [
    [{ ...popup, adsEnabled: false }, 'home'],
    [{ ...popup, popupEnabled: false }, 'home'],
    [{ ...popup, popupAd: '' }, 'home'],
    [popup, 'single-post'],
  ]) {
    const h = popupHarness();
    h.render(popup);
    h.fire();
    assert.equal(h.render(popup).showPopup, true);
    assert.equal(h.render(config, view).showPopup, false);
    assert.equal(h.render(config, view).showPopup, false);
    assert.equal(h.pending(), 0);
    h.render(popup);
    assert.equal(h.render(popup).showPopup, false);
    h.fire();
    assert.equal(h.render(popup).showPopup, true);
    h.render(popup).closePopup();
    assert.equal(h.render(popup).showPopup, false);
    assert.equal(h.pending(), 0);
  }
  const pending = popupHarness();
  pending.render(popup);
  pending.render({ ...popup, adsEnabled: false });
  pending.fire();
  assert.equal(pending.render({ ...popup, adsEnabled: false }).showPopup, false);
  console.log(
    'PASS Ads Manager Runtime: all theme switches, Portfolio intervals and routes, stylesheet isolation, and popup lifecycle.'
  );
}

function checkSettingsPresentation() {
  const directory = 'src/plugins/von-core/features/settings/components/';
  const stateReact = (tab) => ({
    ...React,
    useState: (initial) => [initial === 'optimization' && tab ? tab : initial, noop],
    useEffect: noop,
  });
  const findInput = (node, id) => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const match = findInput(child, id);
        if (match) return match;
      }
      return null;
    }
    if (node.type === 'input' && node.props.id === id) return node.props;
    return findInput(node.props?.children, id);
  };
  const changes = [];
  const props = { settings, onChange: (key, value) => changes.push({ key, value }) };
  const General = load(`${directory}GeneralSettings.tsx`, stateReact(), {
    '../../../../../utils/siteUtils': {
      resolveHeaderIdentityMode: () => 'logo_and_title',
      DEFAULT_SITE_DATE_FORMAT: 'F j, Y',
      SITE_DATE_FORMAT_OPTIONS: [],
    },
  }).GeneralSettings;
  const generalTree = General(props);
  for (const [id, label, key] of [
    ['generalsettings-569', 'Allow Public Discussion on Posts', 'discussionEnabled'],
    ['generalsettings-580', 'Membership: Anyone can register', 'registrationEnabled'],
  ]) {
    const input = findInput(generalTree, id);
    assert.ok(input, `Missing General switch ${id}`);
    assert.equal(input['aria-label'], label);
    assert.equal(input.checked, true);
    for (const checked of [false, true]) {
      input.onChange({ target: { checked } });
      assert.deepEqual(changes.pop(), { key, value: checked });
    }
  }
  for (const [tab, id, label, section, key] of [
    ['optimization', 'mediasettings-365', 'Enable Image Optimization', 'optimization', 'enabled'],
    ['optimization', 'mediasettings-402', 'Convert to WebP', 'optimization', 'convertToWebP'],
    ['performance', 'mediasettings-511', 'Lazy Load Images', 'performance', 'lazyLoadImages'],
    ['performance', 'mediasettings-530', 'Lazy Load Iframes', 'performance', 'lazyLoadIframes'],
  ]) {
    const Media = load(`${directory}MediaSettings.tsx`, stateReact(tab)).MediaSettings;
    const input = findInput(Media(props), id);
    assert.ok(input, `Missing Media switch ${id}`);
    assert.equal(input['aria-label'], label);
    const sibling = key === 'lazyLoadImages' ? 'lazyLoadIframes' : 'lazyLoadImages';
    for (const checked of [false, true]) {
      input.onChange({ target: { checked } });
      const change = changes.pop();
      assert.equal(change.key, 'media');
      assert.equal(change.value[section][key], checked);
      if (section === 'performance') assert.equal(change.value.performance[sibling], true);
      else assert.equal(change.value.performance.lazyLoadImages, true);
    }
  }
  const Google = load(`${directory}GoogleSettings.tsx`).GoogleSettings;
  const googleSettings = (value, enableTracking = true) => ({
    ...settings,
    seo: { googleSearchConsole: value },
    analytics: { googleAnalyticsId: value, enableTracking },
    ads: { ...settings.ads, adsenseVerification: value },
  });
  for (const value of ['', '   ']) {
    const html = render(Google, { ...props, settings: googleSettings(value) });
    assert.equal((html.match(/NOT CONFIGURED/g) || []).length, 3);
    assert.doesNotMatch(html, /\bVERIFIED\b|\bACTIVE\b/);
  }
  const configured = render(Google, { ...props, settings: googleSettings('QA-ID') });
  assert.equal((configured.match(/CONFIGURED/g) || []).length, 3);
  assert.doesNotMatch(configured, /NOT CONFIGURED|\bVERIFIED\b|\bACTIVE\b/);
  const disabled = render(Google, { ...props, settings: googleSettings('QA-ID', false) });
  assert.match(disabled, /TRACKING DISABLED/);
  assert.equal((disabled.match(/CONFIGURED/g) || []).length, 2);
  assert.match(disabled, /not confirmed Google data delivery/);
  assert.match(disabled, /analytics consent settings/);
  assert.equal(changes.length, 0, 'Rendering must not mutate settings');
  console.log(
    'PASS Settings Presentation: six accessible switches retain handlers; Google configuration and disabled tracking statuses are accurate.'
  );
}

async function checkNewsletterPagination() {
  const slots = [];
  const requests = [];
  const errors = [];
  let cursor = 0;
  let dirty = false;
  let effects = [];
  let tree;
  let stateWrites = 0;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [
        slots[index].value,
        (value) => {
          stateWrites++;
          const next = typeof value === 'function' ? value(slots[index].value) : value;
          if (!Object.is(next, slots[index].value)) {
            slots[index].value = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (
        !previous ||
        dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))
      ) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const Pagination = load('src/components/SmartPagination.tsx').default;
  const Manager = load(
    'src/plugins/von-core/features/newsletter/NewsletterManager.tsx',
    hooks,
    {
      '../../../../components/SmartPagination': { __esModule: true, default: Pagination },
      '../../../../config/site.config': { BASE_PATH: '/zangetsu/' },
      '../../../../utils/api': {
        vonFetch: (url) =>
          new Promise((resolve, reject) => {
            requests.push({ url, resolve: (data) => resolve({ json: async () => data }), reject });
          }),
      },
      'react-hot-toast': { toast: { error: (message) => errors.push(message), success: noop } },
    },
    { URLSearchParams }
  ).default;
  const renderManager = () => {
    let count = 0;
    do {
      assert.ok(count++ < 10, 'Newsletter effects must settle');
      cursor = 0;
      dirty = false;
      effects = [];
      tree = Manager({ settings, onUpdateSettings: noop });
      effects.forEach((effect) => effect());
    } while (dirty);
    return tree;
  };
  const find = (node, predicate) => {
    if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
    if (!node || typeof node !== 'object') return null;
    return predicate(node) ? node : find(node.props?.children, predicate);
  };
  const textOf = (node) =>
    Array.isArray(node)
      ? node.map(textOf).join('')
      : node && typeof node === 'object'
        ? textOf(node.props?.children)
        : String(node ?? '');
  const button = (label) =>
    find(tree, (node) => node.type === 'button' && textOf(node).trim() === label);
  const pagination = () => find(tree, (node) => node.type === Pagination).props;
  const filter = (value) => {
    find(tree, (node) => node.type === 'select').props.onChange({ target: { value } });
    renderManager();
  };
  const search = (value) => {
    find(tree, (node) => node.props?.id === 'search-email').props.onChange({ target: { value } });
    renderManager();
  };
  const enter = () =>
    find(tree, (node) => node.props?.id === 'search-email').props.onKeyDown({ key: 'Enter' });
  const settle = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    renderManager();
  };
  const response = (email, total = 35) => ({
    success: true,
    subscribers: total
      ? [{ id: 1, email, status: 'unsubscribed', source: 'QA', subscribed_at: '2026-10-01' }]
      : [],
    stats: { total: 100, active: 65, unsubscribed: 35 },
    pagination: { total, pages: Math.max(1, Math.ceil(total / 20)) },
  });

  renderManager();
  button('Subscribers').props.onClick();
  renderManager();
  filter('active');
  filter('unsubscribed');
  assert.equal(requests.length, 3);
  requests[1].reject(new Error('Stale filter failure'));
  await settle();
  assert.match(textOf(tree), /Loading\.\.\./, 'A stale failure must not clear newer loading state');
  assert.equal(errors.length, 0, 'Stale failures must not show a misleading toast');
  requests[2].resolve(response('latest-filter@example.test'));
  await settle();
  requests[0].resolve(response('old-filter@example.test', 100));
  await settle();
  assert.match(textOf(tree), /latest-filter@example\.test/);
  assert.doesNotMatch(textOf(tree), /old-filter@example\.test/);
  assert.equal(pagination().totalItems, 35);
  assert.match(textOf(Pagination(pagination())), /Showing 1 to 20 of 35 results/);
  assert.match(
    renderToStaticMarkup(tree),
    />100</,
    'Header statistics must retain the global total'
  );

  button('Refresh').props.onClick();
  pagination().onPageChange(2);
  renderManager();
  requests[4].resolve(response('latest-page@example.test'));
  await settle();
  requests[3].resolve(response('old-refresh@example.test'));
  await settle();
  assert.match(textOf(tree), /latest-page@example\.test/);
  assert.doesNotMatch(textOf(tree), /old-refresh@example\.test/);
  assert.match(textOf(Pagination(pagination())), /Showing 21 to 35 of 35 results/);

  filter('all');
  assert.equal(pagination().currentPage, 1, 'Filter changes must reset the page');
  const filterRequests = requests.slice(5);
  filterRequests.at(-1).resolve(response('reset-page@example.test', 100));
  await settle();
  for (const request of filterRequests.slice(0, -1))
    request.resolve(response('stale-reset@example.test'));
  await settle();
  assert.doesNotMatch(textOf(tree), /stale-reset@example\.test/);
  const beforeSearch = requests.length;
  search('first phrase');
  assert.equal(
    requests.length,
    beforeSearch,
    'Typing on page one must preserve manual search submission'
  );
  enter();
  search('second phrase');
  enter();
  const latestSearch = requests.at(-1);
  assert.equal(
    new URL(latestSearch.url, 'http://localhost').searchParams.get('search'),
    'second phrase'
  );
  latestSearch.resolve(response('latest-search@example.test'));
  await settle();
  requests[beforeSearch].resolve(response('old-search@example.test', 100));
  await settle();
  assert.match(textOf(tree), /latest-search@example\.test/);
  assert.doesNotMatch(textOf(tree), /old-search@example\.test/);
  button('Refresh').props.onClick();
  requests.at(-1).resolve(response('', 0));
  await settle();
  assert.equal(pagination().totalItems, 0, 'An empty filter must not reuse the global count');
  assert.equal(Pagination(pagination()), null);

  button('Refresh').props.onClick();
  const pendingTab = requests.at(-1);
  button('Settings').props.onClick();
  renderManager();
  const beforeTabResponse = stateWrites;
  pendingTab.resolve(response('left-tab@example.test'));
  await settle();
  assert.equal(
    stateWrites,
    beforeTabResponse,
    'Leaving Subscribers must invalidate pending responses'
  );
  button('Subscribers').props.onClick();
  renderManager();
  const pendingUnmount = requests.at(-1);
  slots.forEach((slot) => slot.cleanup?.());
  const beforeUnmountResponse = stateWrites;
  pendingUnmount.reject(new Error('Unmounted request'));
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(stateWrites, beforeUnmountResponse, 'Unmounted requests must not update state');
  assert.equal(errors.length, 0);
  console.log(
    'PASS Newsletter Pagination: latest filter/page/search wins; stale errors/loading, tab/unmount cleanup, filtered counts, empty results, and global statistics are preserved.'
  );
}

function checkPublicPluginHydration() {
  const projected = {
    discussionEnabled: false,
    sidebarLayout: [],
    navigation: [],
    activePlugins: ['vp_related_posts'],
    pluginConfig: { vp_related_posts: { enabled: false, count: 0, titleText: '' } },
  };
  let hydrated;
  const hook = load(
    'src/hooks/useSettings.ts',
    {
      ...React,
      useState: (initial) => {
        if (hydrated === undefined) hydrated = initial;
        return [initial, noop];
      },
      useRef: (initial) => ({ current: initial }),
      useCallback: (callback) => callback,
      useEffect: noop,
    },
    {},
    { window: { __INITIAL_SETTINGS__: projected } }
  );
  hook.useSettings();
  assert.equal(hydrated.discussionEnabled, false);
  assert.deepEqual(Array.from(hydrated.sidebarLayout), []);
  assert.deepEqual(Array.from(hydrated.navigation), []);
  assert.equal(hydrated.pluginConfig.vp_related_posts.enabled, false);
  assert.equal(hydrated.pluginConfig.vp_related_posts.count, 0);
  assert.equal(hydrated.pluginConfig.vp_related_posts.titleText, '');
  const isActive = load('src/utils/pluginRuntime.ts').isSystemPluginActive;
  assert.equal(isActive(hydrated, 'vp_promo_bar'), false);
  assert.equal(isActive(hydrated, 'vp_related_posts'), true);
}

async function checkAdminSettingsReadiness() {
  const slots = [];
  const reads = [];
  const writes = [];
  const errors = [];
  let credentialProjection = null;
  const rotations = [];
  const rotationSessionEvents = [];
  let cursor = 0,
    effects = [],
    dirty = false,
    current;
  const same = (a, b) =>
    a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { value: initial };
      return [
        slots[i].value,
        (next) => {
          slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
          dirty = true;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: callback, deps };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        slots[i] = { deps };
        effects.push(effect);
      }
    },
  };
  const publicState = {
    discussionEnabled: false,
    activePlugins: ['vp_related_posts'],
    pluginConfig: {
      pluginStatus: { vp_related_posts: 'active' },
      vp_related_posts: { enabled: true },
    },
    sidebarLayout: [],
    navigation: [],
  };
  const fullState = {
    ...publicState,
    _settingsScope: 'admin',
    pluginConfig: {
      ...publicState.pluginConfig,
      pluginStatus: {
        vp_related_posts: 'active',
        vp_promo_bar: 'inactive',
        vp_gift_widget: 'inactive',
      },
      vp_promo_bar: { text: 'SAVED_RAYA_TEXT' },
      vp_gift_widget: { targetUrl: 'https://example.test/gift' },
    },
  };
  const hook = load(
    'src/hooks/useSettings.ts',
    hooks,
    {
      '../config/site.config': {
        API: { settings: 'settings', saveSettings: 'save' },
        BASE_PATH: '/zangetsu/',
      },
      '../config/auth.config': { getAuthHeader: () => null },
      '../utils/api': {
        vonFetch: (url, options) => {
          if (url === 'settings') return new Promise((resolve) => reads.push({ resolve }));
          assert.equal(url, 'save');
          writes.push(JSON.parse(options.body));
          if (writes.at(-1)._credentialAction === 'rotate') {
            return new Promise((resolve, reject) => rotations.push({ resolve, reject }));
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, apiCredential: credentialProjection }),
          });
        },
      },
      'react-hot-toast': {
        __esModule: true,
        default: { error: (value) => errors.push(value), success: noop },
      },
    },
    {
      window: {
        __INITIAL_SETTINGS__: publicState,
        addEventListener: noop,
        removeEventListener: noop,
        dispatchEvent: (event) => rotationSessionEvents.push(event.type),
      },
      Event,
      console: { error: noop, warn: noop },
    }
  );
  const draw = () => {
    let count = 0;
    do {
      assert.ok(count++ < 10);
      cursor = 0;
      dirty = false;
      effects = [];
      current = hook.useSettings();
      effects.forEach((effect) => effect());
    } while (dirty);
    return current;
  };
  const response = (data) => ({ ok: true, text: async () => JSON.stringify(data) });
  draw();
  const staleDraft = { ...current.settings, activePlugins: ['vp_related_posts', 'vp_promo_bar'] };
  assert.equal(await current.handleUpdateSettings(staleDraft), false);
  const guest = current.loadSettings();
  const admin = current.loadSettings(true, true);
  draw();
  assert.equal(current.isSettingsLoading, true);
  assert.equal(await current.handleUpdateSettings(staleDraft), false);
  reads[0].resolve(response(publicState));
  await guest;
  for (let i = 0; i < 4; i++) await Promise.resolve();
  assert.equal(reads.length, 2);
  draw();
  assert.equal(current.settings._settingsScope, 'public');
  reads[1].resolve({ ok: false, status: 503 });
  assert.equal(await admin, false);
  draw();
  assert.equal(current.settingsLoadFailed, true);
  assert.equal(await current.handleUpdateSettings(staleDraft), false);
  assert.equal(writes.length, 0);
  const expiredSession = current.loadSettings(true, true);
  reads[2].resolve(response(publicState));
  assert.equal(await expiredSession, false, 'A public response cannot satisfy an admin read');
  draw();
  assert.equal(current.settingsLoadFailed, true);
  assert.equal(current.isSettingsLoading, false);
  assert.equal(await current.handleUpdateSettings(staleDraft), false);
  assert.equal(writes.length, 0);
  const retry = current.loadSettings(true, true);
  draw();
  assert.equal(current.settingsLoadFailed, false);
  reads[3].resolve(response(fullState));
  assert.equal(await retry, true);
  draw();
  assert.equal(current.settings._settingsScope, 'admin');
  assert.equal(
    await current.handleUpdateSettings(staleDraft),
    false,
    'Old public drafts remain unsafe after refresh'
  );
  assert.equal(writes.length, 0);
  const next = {
    ...current.settings,
    activePlugins: ['vp_related_posts', 'vp_promo_bar'],
    pluginConfig: {
      ...current.settings.pluginConfig,
      pluginStatus: { ...current.settings.pluginConfig.pluginStatus, vp_promo_bar: 'active' },
    },
  };
  assert.equal(await current.handleUpdateSettings(next, { optimistic: false }), true);
  assert.equal(writes[0].pluginConfig.vp_promo_bar.text, 'SAVED_RAYA_TEXT');
  assert.equal(writes[0].pluginConfig.vp_gift_widget.targetUrl, 'https://example.test/gift');
  draw();
  assert.equal(
    await current.handleUpdateSettings({ ...current.settings, siteTagline: 'Identity edit' }),
    true
  );
  assert.equal(writes[1].pluginConfig, undefined);
  assert.equal(current.settings.discussionEnabled, false);
  assert.ok(errors.length >= 4);
  credentialProjection = {
    aiApiKey: '******** (PROTECTED)',
    aiKeyStorage: 'encrypted',
    aiKeySavedAt: '2026-10-27T00:00:00Z',
    aiKeyExpiresAt: '',
  };
  assert.equal(
    await current.handleUpdateSettings(
      {
        ...current.settings,
        api: {
          aiApiKey: 'qa-unsaved-plaintext',
          aiModel: 'gemini-3.8-flash',
          encryptStoredAiKey: true,
        },
      },
      { optimistic: false }
    ),
    true
  );
  draw();
  assert.equal(current.settings.api.aiApiKey, '******** (PROTECTED)');
  assert.equal(current.settings.api.aiKeyStorage, 'encrypted');
  assert.equal(current.settings.api.encryptStoredAiKey, undefined);
  assert.ok(!JSON.stringify(current.settings).includes('qa-unsaved-plaintext'));

  const writeCountBeforeRotation = writes.length;
  assert.equal(await current.handleRotateAiEncryptionKey('a'.repeat(64)), false);
  assert.equal(writes.length, writeCountBeforeRotation, 'Non-owner hook cannot request rotation');
  const ownerState = {
    ...current.settings,
    siteName: 'Owner settings fixture',
    _canManageSecrets: true,
    api: { ...current.settings.api, aiKeyRevision: 'a'.repeat(64), aiKeyCanRotate: true },
  };
  const ownerRead = current.loadSettings(true, true);
  reads.at(-1).resolve(response(ownerState));
  await ownerRead;
  draw();
  const pendingRotation = current.handleRotateAiEncryptionKey('a'.repeat(64));
  assert.equal(
    current.settings.api.aiKeyRevision,
    'a'.repeat(64),
    'No optimistic credential change'
  );
  assert.equal(
    await current.handleRotateAiEncryptionKey('a'.repeat(64)),
    false,
    'Duplicate pending request blocked'
  );
  assert.equal(rotations.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(writes.at(-1))), {
    _credentialAction: 'rotate',
    _credentialRevision: 'a'.repeat(64),
  });
  rotations[0].resolve({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      apiCredential: {
        ...credentialProjection,
        aiKeyRevision: 'b'.repeat(64),
        aiKeyRotatedAt: '2026-10-27T01:00:00Z',
        aiKeyCanRotate: true,
      },
    }),
  });
  assert.equal(await pendingRotation, true);
  draw();
  assert.equal(current.settings.api.aiKeyRevision, 'b'.repeat(64));
  assert.equal(current.settings.api.aiApiKey, '******** (PROTECTED)');
  assert.equal(
    current.settings.siteName,
    'Owner settings fixture',
    'Rotation retains unrelated canonical settings'
  );
  const failedRotation = current.handleRotateAiEncryptionKey('b'.repeat(64));
  rotations[1].resolve({
    ok: false,
    status: 503,
    json: async () => ({ error: 'Unconfirmed rotation' }),
  });
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
  reads.at(-1).resolve(
    response({
      ...current.settings,
      api: { ...current.settings.api, aiKeyRevision: 'c'.repeat(64) },
    })
  );
  assert.equal(await failedRotation, false);
  draw();
  assert.equal(
    current.settings.api.aiKeyRevision,
    'c'.repeat(64),
    'Uncertain response reconciles with a fresh server read'
  );
  const deniedRotation = current.handleRotateAiEncryptionKey('c'.repeat(64));
  rotations[2].resolve({
    ok: false,
    status: 401,
    json: async () => ({ error: 'Authentication required' }),
  });
  assert.equal(await deniedRotation, false);
  assert.deepEqual(rotationSessionEvents, ['von:session-expired']);
  const networkRotation = current.handleRotateAiEncryptionKey('c'.repeat(64));
  rotations[3].reject(new Error('Isolated transport failure'));
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
  reads.at(-1).resolve(response(current.settings));
  assert.equal(
    await networkRotation,
    false,
    'Network uncertainty returns a failed acknowledgement'
  );
  draw();
  const lostSessionRotation = current.handleRotateAiEncryptionKey('c'.repeat(64));
  const publicRead = current.loadSettings(true, false);
  reads.at(-1).resolve(response(publicState));
  await publicRead;
  draw();
  const guestRotationState = JSON.stringify(current.settings.api);
  rotations[4].resolve({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      apiCredential: { ...credentialProjection, aiKeyRotatedAt: '2099-01-01T00:00:00Z' },
    }),
  });
  assert.equal(await lostSessionRotation, false);
  draw();
  assert.equal(
    JSON.stringify(current.settings.api),
    guestRotationState,
    'Delayed rotation cannot modify a later guest settings snapshot'
  );

  const Loader = () => null,
    Navigate = () => null;
  const Gate = load('src/components/ProtectedRoute.tsx', React, {
    './PrivateEntryLoader': { __esModule: true, default: Loader },
    'react-router': { Navigate },
  }).default;
  for (const role of ['Root', 'Admin']) {
    const props = {
      user: { ...user, role },
      areSettingsReady: false,
      children: 'PRIVATE_SETTINGS',
    };
    assert.equal(Gate(props).type, Loader);
    const failed = Gate({ ...props, settingsLoadFailed: true, onRetrySettings: noop });
    assert.doesNotMatch(renderToStaticMarkup(failed), /PRIVATE_SETTINGS/);
    assert.match(renderToStaticMarkup(failed), /Try again/);
    assert.equal(Gate({ ...props, areSettingsReady: true }).props.children, 'PRIVATE_SETTINGS');
  }
  assert.equal(Gate({ user: null, areSettingsReady: false, children: 'PRIVATE' }).type, Navigate);
  for (const role of ['Moderator', 'Writer']) {
    assert.equal(
      Gate({ user: { ...user, role }, children: 'STAFF_CONTENT' }).props.children,
      'STAFF_CONTENT'
    );
  }
  console.log(
    'PASS Admin Settings Readiness: pending/failed/retried full reads block partial and stale drafts; saved inactive config, identity-only edits, comments OFF and staff route permissions remain intact.'
  );
}

function checkCategoryFolderAdvisory() {
  const siteUtils = load('src/utils/siteUtils.ts', React, {
    '../config/site.config': { BASE_PATH: '/zangetsu/' },
  });
  for (const folder of [
    'api',
    'assets',
    'backups',
    'core',
    'data',
    'docs',
    'fonts',
    'themes',
    'uploads',
  ]) {
    for (const category of [folder, folder.toUpperCase(), ` _${folder}_ `, `${folder}!`]) {
      assert.equal(siteUtils.getCategoryFolderConflict(category), folder);
    }
  }
  for (const category of [
    undefined,
    null,
    '',
    'News',
    'Core News',
    'database',
    'my-core',
    'temporary_update',
  ]) {
    assert.equal(siteUtils.getCategoryFolderConflict(category), null);
  }
  const PostEditor = load('src/components/PostEditor.tsx', React, {
    '../utils/siteUtils': siteUtils,
    '../utils/contentCapabilities': load('src/utils/contentCapabilities.ts'),
    '../hooks/useDebouncedSearchQuery': {
      useDebouncedSearchQuery: () => ({ query: '', commit: noop }),
    },
    '../hooks/useAiWriting': { useAiWriting: () => ({}) },
    './editor/postEditorSaveHelpers': load('src/components/editor/postEditorSaveHelpers.ts'),
    './editor/postEditorTextHelpers': { getPostEditorCleanText: (value) => value },
  }).default;
  const props = {
    initialItem: { ...posts[0], status: 'draft', category: 'Core' },
    initialItemIsComplete: true,
    isPage: false,
    navigation: [],
    settings,
    userRole: 'Admin',
    onSave: noop,
    onBack: noop,
  };
  for (const permalinkStructure of ['slug', 'category']) {
    const html = render(PostEditor, { ...props, settings: { ...settings, permalinkStructure } });
    assert.match(html, /id="post-category-path-warning" role="status" aria-live="polite"/);
    assert.match(html, /The \/core\/ path is used by a VonCMS folder/);
    assert.match(html, /Category &amp; Name permalinks can conflict/);
    assert.match(html, /aria-describedby="post-category-help post-category-path-warning"/);
    assert.match(html, /saving remains available/);
    assert.doesNotMatch(html, /aria-invalid=/);
    const publishButtons = Array.from(
      html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)
    ).filter(([, , content]) => content === '<span>Publish</span>');
    assert.ok(publishButtons.length > 0);
    for (const [, attributes] of publishButtons) {
      assert.doesNotMatch(attributes, /(?:^|\s)disabled(?:\s|=|$)/);
    }
  }
  for (const category of ['News', '', 'Core News']) {
    const html = render(PostEditor, { ...props, initialItem: { ...props.initialItem, category } });
    assert.doesNotMatch(html, /id="post-category-path-warning"/);
    assert.match(html, /aria-describedby="post-category-help"/);
  }
  assert.doesNotMatch(render(PostEditor, { ...props, isPage: true }), /id="post-category/);
  const post = { ...posts[0], category: 'Core' };
  assert.equal(
    siteUtils.getPermalink(post, { permalinkStructure: 'category' }),
    '/zangetsu/core/qa-1'
  );
  assert.equal(siteUtils.getPermalink(post, { permalinkStructure: 'slug' }), '/zangetsu/qa-1');
  const rootUtils = load('src/utils/siteUtils.ts', React, {
    '../config/site.config': { BASE_PATH: '/' },
  });
  assert.equal(rootUtils.getPermalink(post, { permalinkStructure: 'category' }), '/core/qa-1');
  assert.equal(rootUtils.getCategoryFolderConflict('Core'), 'core');
  console.log(
    'PASS Category Folder Advisory: normalized folder matches, accessible editor warning, ordinary categories/pages, enabled Publish and unchanged root/subfolder permalink behavior.'
  );
}

async function checkPublicProfileArticles() {
  for (const base of ['', '/zangetsu']) {
    const slots = [];
    const requests = [];
    let cursor = 0,
      effects = [],
      dirty = false,
      current;
    let target = { id: '10', username: 'alice' };
    const same = (a, b) =>
      a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
    const hooks = {
      ...React,
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = { value: initial };
        return [
          slots[i].value,
          (next) => {
            slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
            dirty = true;
          },
        ];
      },
      useRef(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = { current: initial };
        return slots[i];
      },
      useCallback(callback, deps) {
        const i = cursor++;
        if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: callback, deps };
        return slots[i].value;
      },
      useEffect(effect, deps) {
        const i = cursor++;
        const previous = slots[i];
        if (!previous || !same(previous.deps, deps)) {
          effects.push(() => {
            previous?.cleanup?.();
            slots[i] = { deps, cleanup: effect() };
          });
        }
      },
    };
    const hook = load(
      'src/hooks/useProfileActivity.ts',
      hooks,
      {
        '../config/site.config': {
          API: {
            getPosts: `${base}/api/get_posts.php`,
            getComments: `${base}/api/get_comments.php`,
          },
        },
        '../utils/api': {
          vonFetch: (url) => new Promise((resolve) => requests.push({ url, resolve })),
        },
      },
      { URLSearchParams }
    );
    const draw = () => {
      let count = 0;
      do {
        assert.ok(count++ < 10, 'Profile activity effects must settle');
        cursor = 0;
        dirty = false;
        effects = [];
        current = hook.useProfileActivity(target, 13);
        effects.forEach((effect) => effect());
      } while (dirty);
      return current;
    };
    const articleRequest = () => requests.filter(({ url }) => url.includes('get_posts.php')).at(-1);
    const checkRequest = (request, author, page) => {
      const url = new URL(request.url, 'https://qa.invalid');
      assert.equal(url.pathname, `${base}/api/get_posts.php`);
      assert.equal(
        url.searchParams.get('public'),
        '1',
        'Public profiles must not inherit staff visibility'
      );
      assert.equal(url.searchParams.get('author'), author);
      assert.equal(url.searchParams.get('page'), String(page));
      assert.equal(url.searchParams.get('limit'), '13');
    };
    const respond = async (request, ids, page = 1, hasMore = false) => {
      request.resolve({
        ok: true,
        json: async () => ({
          posts: ids.map((id) => ({ id, status: 'published', image_url: 'qa.webp' })),
          meta: { page, limit: 13, total: 15, hasMore },
        }),
      });
      for (let i = 0; i < 8; i++) await Promise.resolve();
      return draw();
    };

    draw();
    assert.equal(requests.length, 2, 'Initial profile requests must stay bounded');
    checkRequest(articleRequest(), 'alice', 1);
    await respond(articleRequest(), ['a1', 'a2'], 1, true);
    assert.equal(current.articleTotal, 15);
    const more = current.loadMoreArticles();
    draw();
    checkRequest(articleRequest(), 'alice', 2);
    await respond(articleRequest(), ['a2', 'a3'], 2);
    await more;
    assert.deepEqual(
      Array.from(current.articlePosts, (post) => post.id),
      ['a1', 'a2', 'a3']
    );
    assert.equal(current.articleHasMore, false);
    assert.equal(current.articleTotal, 15);
    assert.equal(current.articlePosts[0].image, 'qa.webp');
    const count = requests.length;
    await current.loadMoreArticles();
    assert.equal(requests.length, count, 'An exhausted list must not request another page');

    target = { id: '20', username: 'bob' };
    draw();
    const stale = articleRequest();
    checkRequest(stale, 'bob', 1);
    target = { id: '30', username: 'carol.name' };
    draw();
    const latest = articleRequest();
    checkRequest(latest, 'carol.name', 1);
    await respond(stale, ['stale']);
    assert.equal(current.articlePosts.length, 0);
    assert.equal(current.articlesLoading, true);
    await respond(latest, ['current']);
    assert.deepEqual(
      Array.from(current.articlePosts, (post) => post.id),
      ['current']
    );
    assert.equal(current.articlesLoading, false);
    const comments = new URL(requests.at(-1).url, 'https://qa.invalid');
    assert.equal(comments.pathname, `${base}/api/get_comments.php`);
    assert.equal(comments.searchParams.get('user_id'), '30');
    assert.equal(comments.searchParams.get('user'), 'carol.name');
  }
  console.log(
    'PASS Public Profile Articles Runtime: explicit public reads, unchanged author/limit/totals, deduplicated Load More and stale-profile guards at root and subfolder API paths.'
  );
}

function checkContentManagerExcerpts() {
  const cases = [
    ['Syarat QA: jika x<y maka teks mesti kekal. Simbol < dan > tamat.', undefined],
    ['literal <strong>text</strong>', undefined],
    ['<img src=x onerror=alert(1)>', undefined],
    ['<script>alert(1)</script>', undefined],
    ['Tom &amp; Jerry', 'Tom & Jerry'],
    ['&lt;b&gt;literal&lt;/b&gt;', '<b>literal</b>'],
    ['&amp;lt;b&amp;gt;', '&lt;b&gt;'],
    ['Teks Melayu, 中文 dan emoji 😀', undefined],
    ['0', undefined],
    ['', undefined],
    [undefined, undefined],
  ];
  for (const type of ['post', 'page']) {
    for (const [excerpt, decoded] of cases) {
      const item = { ...posts[0], excerpt };
      if (excerpt === undefined) delete item.excerpt;
      const original = JSON.stringify(item);
      const calls = [];
      let stateIndex = 0;
      const fixtureReact = {
        ...React,
        useState(initial) {
          const index = stateIndex++;
          if (index === 0) return [[item], noop];
          if (index === 2) return [false, noop];
          return [typeof initial === 'function' ? initial() : initial, noop];
        },
      };
      // Render the real manager, isolating its existing text-decoder contract.
      // React must escape the decoder's output, never parse it again as HTML.
      const Manager = load(
        'src/plugins/von-core/features/content/ContentManager.tsx',
        fixtureReact,
        {
          '../../../../utils/textUtils': {
            decodeEntities(value) {
              calls.push(value);
              return value === item.title ? value : (decoded ?? value ?? '');
            },
          },
          '../../../../utils/contentCapabilities': load('src/utils/contentCapabilities.ts'),
        }
      ).default;
      const output = render(Manager, {
        type,
        posts: [],
        settings,
        onEdit: noop,
        userRole: 'admin',
      });
      const expected = renderToStaticMarkup(
        React.createElement('span', null, decoded ?? excerpt ?? '')
      );
      const escapedText = expected.slice('<span>'.length, -'</span>'.length);
      assert.ok(calls.includes(excerpt ?? ''), `${type}: excerpt must use the shared decoder`);
      assert.ok(output.includes(`mt-1">${escapedText}</p>`), `${type}: excerpt text changed`);
      assert.ok(!output.includes('<script>') && !output.includes('<img src="x"'));
      assert.equal(JSON.stringify(item), original, `${type}: rendering must not mutate saved data`);
    }
  }
  console.log(
    `PASS Content Manager Excerpt Runtime: ${cases.length * 2} post/page renders preserve comparisons, literal markup, decoder output, Unicode and empty values as escaped text without mutating data.`
  );
}

function checkContentManagerActions() {
  const file = 'src/plugins/von-core/features/content/ContentManager.tsx';
  const capabilities = load('src/utils/contentCapabilities.ts');
  const walk = (node, match) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, match));
    return [...(match(node) ? [node] : []), ...walk(node.props?.children, match)];
  };
  let cases = 0;
  for (const basePath of ['/', '/zangetsu/']) {
    const actualSiteUtils = load('src/utils/siteUtils.ts', React, {
      '../config/site.config': { BASE_PATH: basePath },
      './dateFormat': load('src/utils/dateFormat.ts'),
    });
    for (const type of ['post', 'page']) {
      for (const permalink of ['slug', 'category', 'day_name', 'month_name', 'plain']) {
        for (const role of ['admin', 'writer']) {
          const published = { ...posts[0], id: '801', slug: '2026', category: 'Technology' };
          const draft = { ...published, id: '802', slug: 'draft-only', status: 'draft' };
          const future = { ...published, id: '803', slug: 'future-only', status: 'scheduled' };
          const deferred = {
            ...published,
            id: '804',
            slug: 'deferred-only',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          };
          const autoPublished = {
            ...published,
            id: '805',
            slug: 'auto-published',
            scheduledAt: '2000-01-01T00:00:00Z',
          };
          const autoPublishedSql = {
            ...published,
            id: '806',
            slug: 'auto-published-sql',
            scheduled_at: '2000-01-01 00:00:00',
          };
          const malformed = {
            ...published,
            id: '807',
            slug: 'malformed',
            scheduled_at: 'invalid-date',
          };
          const items = [
            published,
            draft,
            future,
            ...(type === 'post' ? [deferred, autoPublished, autoPublishedSql, malformed] : []),
          ];
          const before = JSON.stringify(items);
          let stateIndex = 0;
          let tree;
          const edits = [];
          const deletes = [];
          const navChanges = [];
          const fixtureReact = {
            ...React,
            useState(initial) {
              const index = stateIndex++;
              if (index === 0) return [items, noop];
              if (index === 2) return [false, noop];
              return [typeof initial === 'function' ? initial() : initial, noop];
            },
          };
          const Manager = load(
            file,
            fixtureReact,
            {
              '../../../../utils/siteUtils': actualSiteUtils,
              '../../../../utils/contentCapabilities': capabilities,
              '../../../../utils/textUtils': { decodeEntities: (value) => value || '' },
            },
            {
              confirm: () => {
                throw new Error('Content actions must use the preview, not native confirm');
              },
            }
          ).default;
          const fixtureSettings = {
            ...settings,
            permalinkStructure: permalink,
            timeZone: 'Asia/Kuala_Lumpur',
          };
          const Capture = () => {
            tree = Manager({
              type,
              posts: [],
              settings: fixtureSettings,
              userRole: role,
              onEdit: (...args) => edits.push(args),
              onDelete: (...args) => deletes.push(args),
              onToggleNav: (id) => navChanges.push(id),
              navigation: [{ url: `page:${published.id}` }],
            });
            return tree;
          };
          const output = render(Capture, {});
          const desktopTree = walk(tree, (node) => node.type === 'table')[0];
          const mobileTree = walk(tree, (node) => node.type === 'article');
          for (const layout of [desktopTree, mobileTree]) {
            const live = walk(
              layout,
              (node) => node.type === 'a' && node.props['aria-label']?.startsWith('View live')
            );
            assert.equal(
              live.length,
              type === 'post' ? 3 : 1,
              `${type}/${role}: past auto-publications stay live; drafts, scheduled, future and invalid timestamps do not`
            );
            const expected =
              type === 'post'
                ? actualSiteUtils.getPermalink(published, fixtureSettings)
                : `${basePath}2026`;
            assert.equal(live[0].props.href, expected);
            assert.equal(live[0].props.target, '_blank');
            assert.equal(live[0].props.rel, 'noopener noreferrer');
            const firstRow = Array.isArray(layout)
              ? layout[0]
              : walk(layout, (node) => node.type === 'tr')[1];
            const rowActions = walk(
              firstRow,
              (node) =>
                ['a', 'button'].includes(node.type) &&
                /^(Edit|View|Delete) (post|page):|^View live /.test(node.props['aria-label'] || '')
            );
            assert.equal(
              rowActions.at(-1).props.href,
              expected,
              'View live must be the last action beside Delete'
            );
            const editorLabel = `${role === 'writer' && type === 'post' ? 'View' : 'Edit'} ${type}: ${published.title}`;
            const edit = walk(
              layout,
              (node) => node.type === 'button' && node.props['aria-label'] === editorLabel
            )[0];
            assert.ok(edit, 'existing writer read-only editor label must be preserved');
            edit.props.onClick();
            assert.deepEqual(edits.at(-1), [published.id, type === 'page']);
            const deleteButtons = walk(
              layout,
              (node) =>
                node.type === 'button' && node.props['aria-label']?.startsWith(`Delete ${type}:`)
            );
            assert.equal(
              deleteButtons.length,
              role === 'writer' && type === 'post' ? 1 : items.length
            );
            assert.ok(output.includes('ml-3 border-l border-slate-200 pl-3'));
            if (Array.isArray(layout)) {
              const actions = walk(firstRow, (node) =>
                node.props?.className?.includes('grid-flow-col')
              )[0];
              assert.ok(actions, 'mobile/tablet actions use equal automatic columns');
              assert.ok(output.includes('max-w-90'), 'tablet action group stays bounded');
              assert.ok(
                walk(edit, (node) => node.type === 'span').some(
                  (node) =>
                    node.props.children === (role === 'writer' && type === 'post' ? 'View' : 'Edit')
                ),
                'mobile/tablet editor action must keep its visible role-aware label'
              );
              assert.equal(walk(live[0], (node) => node.type === 'span')[0].props.children, 'Live');
              assert.equal(
                walk(actions, (node) => ['button', 'a'].includes(node.type)).length,
                role === 'writer' && type === 'post' ? 2 : 3,
                'only permitted actions occupy equal slots; no disabled live placeholder'
              );
            }
            const previousDeletes = deletes.length;
            deleteButtons[0].props.onClick();
            assert.equal(
              deletes.length,
              previousDeletes,
              'opening a deletion preview must never delete'
            );
            if (type === 'page') {
              const nav = walk(
                layout,
                (node) =>
                  node.type === 'button' &&
                  (node.props.children === 'Remove Nav' ||
                    node.props['aria-label'] === `Remove from navigation: ${published.title}`)
              )[0];
              assert.ok(nav, 'existing navigation assignment keeps a compact Remove Nav action');
              nav.props.onClick();
              assert.equal(navChanges.at(-1), published.id);
            }
          }
          assert.equal(JSON.stringify(items), before, 'render/actions must not mutate fixtures');
          cases++;
        }
      }
    }
  }
  console.log(
    `PASS Content Manager Actions Runtime: ${cases} root/subfolder, post/page, permalink and role cases in both layouts preserve past auto-publications, future exclusion, safe new-tab links, edit dispatch, Nav dispatch, delete permission and preview opening without mutation. Confirmation is exercised in the dedicated browser fixture.`
  );
}

async function checkIndexNowReadOnly() {
  const file = 'src/plugins/von-core/features/extensions/components/VonSEOSettings.tsx';
  const walk = (node, predicate) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, predicate));
    return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
  };
  const text = (node) => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(text).join('');
    return node && typeof node === 'object' ? text(node.props?.children) : '';
  };
  let cases = 0;
  for (const permission of [false, undefined, 'true', true]) {
    for (const enabled of [false, true]) {
      const canManage = permission === true;
      const values = [];
      const effects = [];
      const requests = [];
      const updates = [];
      const errors = [];
      let closed = 0;
      let hook = 0;
      let setupResult = { success: true, key: 'fixture-key' };
      const status = {
        success: true,
        status: 'ready',
        key_configured: true,
        key_file_exists: true,
        key_preview: 'masked-fixture',
      };
      const mockReact = {
        ...React,
        useState: (initial) => {
          const slot = hook++;
          if (!Object.hasOwn(values, slot))
            values[slot] = slot === 2 ? 'indexnow' : slot === 5 ? status : initial;
          return [values[slot], (value) => (values[slot] = value)];
        },
        useEffect: (effect, dependencies) => effects.push({ effect, dependencies }),
      };
      const { VonSEOSettings } = load(file, mockReact, {
        '../../../../../config/site.config': { BASE_PATH: '/zangetsu/' },
        '../../../../../utils/articleSchema': {
          ARTICLE_SCHEMA_TYPES: ['Article', 'NewsArticle', 'BlogPosting'],
          normalizeArticleSchemaType: (value) => value || 'Article',
        },
        '../../../../../components/admin/AdminModal': {
          __esModule: true,
          default: ({ children }) => React.createElement('section', null, children),
        },
        '../../../../../utils/api': {
          vonFetch: async (url, options) => {
            requests.push({ url, options });
            if (url.endsWith('indexnow_setup.php') && setupResult instanceof Error)
              throw setupResult;
            return {
              ok: true,
              json: async () => (url.endsWith('indexnow_setup.php') ? setupResult : status),
            };
          },
        },
        'react-hot-toast': {
          __esModule: true,
          default: { success: noop, error: (message) => errors.push(message) },
        },
      });
      const renderSettings = () => {
        hook = 0;
        effects.length = 0;
        return VonSEOSettings({
          settings: { ...settings, indexnowEnabled: enabled, _canManageSecrets: permission },
          onUpdate: async (value) => {
            updates.push(value);
            return true;
          },
          onClose: () => closed++,
        });
      };
      const tree = renderSettings();
      const button = (label) =>
        walk(tree, (node) => node.type === 'button' && text(node).trim() === label)[0];
      const panel = walk(tree, (node) => node.type === 'fieldset')[0];
      const toggle = walk(tree, (node) => node.props?.['aria-label'] === 'Enable IndexNow')[0];
      assert.equal(panel.props.disabled, !canManage);
      assert.equal(toggle.props.disabled, !canManage);
      assert.equal(button('Save SEO Settings').props.disabled, !canManage);
      const html = renderToStaticMarkup(tree);
      assert.equal(html.includes('Read-only. Only the Primary Admin'), !canManage);
      if (enabled && !canManage) {
        assert.ok(html.includes('Primary Admin only'));
        assert.ok(!html.includes('masked-fixture'), 'stale protected status must not be exposed');
        assert.ok(!html.includes('Not configured') && !html.includes('Missing'));
      }
      const indexEffect = effects.find((item) => item.dependencies?.[0] === 'indexnow');
      assert.ok(indexEffect, 'exercise the real protected-status effect');
      indexEffect.effect();
      await new Promise(setImmediate);
      assert.equal(requests.length, canManage ? 1 : 0);
      assert.equal(
        requests[0]?.url,
        canManage ? '/zangetsu/api/system/indexnow_status.php' : undefined
      );
      toggle.props.onChange({ target: { checked: !enabled } });
      if (enabled) {
        for (const label of ['Setup IndexNow Key', 'Instant Ping Home']) {
          assert.equal(button(label).props.disabled, !canManage);
          // Invoke handlers directly too: disabled markup alone is not the permission guard.
          await button(label).props.onClick();
        }
      }
      await button('Save SEO Settings').props.onClick();
      if (!canManage) {
        assert.equal(requests.length, 0);
        assert.equal(updates.length, 0);
        assert.equal(closed, 0);
        assert.equal(values[4], false, 'restricted actions must not enter saving state');
        assert.equal(values[6], false);
        assert.equal(values[7], false);
        button('Advanced').props.onClick();
        const advanced = renderSettings();
        const save = walk(
          advanced,
          (node) => node.type === 'button' && text(node).trim() === 'Save SEO Settings'
        )[0];
        assert.equal(save.props.disabled, false, 'other SEO tabs remain editable');
        await save.props.onClick();
        assert.equal(updates.length, 1);
        assert.ok(updates[0].seo);
        assert.equal(closed, 1);
      } else {
        assert.equal(updates[0].indexnowEnabled, !enabled);
        assert.equal(closed, 1);
        if (enabled) {
          assert.ok(
            requests.some(
              (request) =>
                request.url.endsWith('indexnow_setup.php') && request.options.method === 'POST'
            )
          );
          assert.ok(
            requests.some(
              (request) =>
                request.url.endsWith('indexnow_ping.php') && request.options.method === 'POST'
            )
          );
          setupResult = { success: false, error: 'Setup denied fixture' };
          await button('Setup IndexNow Key').props.onClick();
          assert.equal(
            errors.at(-1),
            'Setup denied fixture',
            'API rejection must not fail silently'
          );
          setupResult = new Error('Network fixture');
          await button('Setup IndexNow Key').props.onClick();
          assert.equal(errors.at(-1), 'Failed to generate key');
          assert.equal(values[6], false, 'failed setup releases its loading state');
        }
      }
      cases++;
    }
  }
  console.log(
    `PASS IndexNow Read-Only Runtime: ${cases} owner/appointed/missing/invalid permission and enabled/disabled cases verify frozen controls, guarded handlers/status requests, owner actions, explicit setup errors and unchanged access to other SEO tabs.`
  );
}

async function checkAnalyticsReadOnly() {
  const plain = (value) => JSON.parse(JSON.stringify(value));
  const walk = (node, predicate) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, predicate));
    return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
  };
  const googleFile = 'src/plugins/von-core/features/settings/components/GoogleSettings.tsx';
  const analyticsFile =
    'src/plugins/von-core/features/extensions/components/VonAnalyticsSettings.tsx';
  const Google = load(googleFile).GoogleSettings;
  let cases = 0;
  for (const permission of [false, undefined, 'true', true]) {
    for (const analytics of [
      undefined,
      {
        googleAnalyticsId: 'G-FIXTURE',
        enableTracking: false,
        anonymizeIP: true,
        cookieConsent: false,
      },
    ]) {
      const canManage = permission === true;
      const fixture = {
        ...settings,
        _canManageSecrets: permission,
        analytics,
        seo: { sitemapEnabled: true },
        ads: { adsEnabled: false },
      };
      const before = JSON.stringify(fixture);
      const changes = [];
      const tree = Google({
        settings: fixture,
        onChange: (key, value) => changes.push({ key, value }),
      });
      const input = (id) => walk(tree, (node) => node.props?.id === id)[0];
      const panel = walk(
        tree,
        (node) => node.props?.['aria-label'] === 'Google Analytics settings'
      )[0];
      assert.equal(panel.props.disabled, !canManage);
      assert.equal(input('googlesettings-171'), undefined, 'obsolete GA4 privacy toggle removed');
      assert.ok(renderToStaticMarkup(tree).includes('not a GDPR compliance switch'));
      assert.equal(
        renderToStaticMarkup(tree).includes('Read-only. Only the Primary Admin'),
        !canManage
      );
      for (const [id, key, value] of [
        ['googlesettings-148', 'googleAnalyticsId', 'G-CHANGED'],
        ['googlesettings-161', 'enableTracking', true],
      ]) {
        assert.equal(input(id).props.disabled, !canManage);
        input(id).props.onChange({ target: { value, checked: value } });
        assert.equal(
          changes.length,
          canManage ? 1 : 0,
          'even direct handlers must respect owner permission'
        );
        if (canManage) {
          const change = changes.pop();
          assert.equal(change.key, 'analytics');
          assert.deepEqual(plain(change.value), {
            ...(analytics || { enableTracking: true }),
            [key]: value,
          });
        }
      }
      for (const [id, section, key] of [
        ['googlesettings-92', 'seo', 'googleSearchConsole'],
        ['googlesettings-223', 'ads', 'adsenseVerification'],
      ]) {
        assert.ok(!input(id).props.disabled, 'delegated Google fields must remain editable');
        assert.equal(walk(panel, (node) => node.props?.id === id).length, 0);
        input(id).props.onChange({ target: { value: 'delegated-fixture' } });
        const change = changes.pop();
        assert.equal(change.key, section);
        assert.deepEqual(plain(change.value), { ...fixture[section], [key]: 'delegated-fixture' });
      }

      const values = [];
      let hook = 0;
      let stateWrites = 0;
      let closed = 0;
      let saveOutcome = true;
      const saves = [];
      const errors = [];
      const { VonAnalyticsSettings } = load(
        analyticsFile,
        {
          ...React,
          useState: (initial) => {
            const slot = hook++;
            if (!Object.hasOwn(values, slot)) values[slot] = initial;
            return [
              values[slot],
              (value) => {
                stateWrites++;
                values[slot] = value;
              },
            ];
          },
        },
        {
          '../../../../../components/admin/AdminModal': {
            __esModule: true,
            default: ({ children }) => React.createElement('section', null, children),
          },
          'react-hot-toast': {
            __esModule: true,
            default: { success: noop, error: (message) => errors.push(message) },
          },
        }
      );
      const renderAnalytics = () => {
        hook = 0;
        return VonAnalyticsSettings({
          settings: fixture,
          onUpdate: async (value) => {
            saves.push(value);
            if (saveOutcome instanceof Error) throw saveOutcome;
            return saveOutcome;
          },
          onClose: () => closed++,
        });
      };
      const analyticsTree = renderAnalytics();
      const toggle = walk(analyticsTree, (node) => node.type === 'input')[0];
      const buttons = walk(analyticsTree, (node) => node.type === 'button');
      const save = buttons.at(-1);
      assert.equal(toggle.props.disabled, !canManage);
      assert.equal(save.props.disabled, !canManage);
      assert.equal(
        walk(analyticsTree, (node) => node.type === 'fieldset')[0].props.disabled,
        !canManage
      );
      assert.equal(
        renderToStaticMarkup(analyticsTree).includes('Read-only. Only the Primary Admin'),
        !canManage
      );
      toggle.props.onChange({ target: { checked: true } });
      assert.equal(stateWrites, canManage ? 1 : 0);
      await walk(renderAnalytics(), (node) => node.type === 'button')
        .at(-1)
        .props.onClick();
      if (canManage) {
        assert.equal(saves.length, 1);
        assert.equal(closed, 1);
        assert.deepEqual(plain(saves[0].analytics), {
          ...analytics,
          cookieConsent: true,
          measurementMode: analytics?.measurementMode || 'strict',
        });
        closed = 0;
        for (const failure of [false, new Error('Fixture save failure')]) {
          saveOutcome = failure;
          await save.props.onClick();
          assert.equal(values[1], false, 'failed saves release their loading state');
          assert.equal(closed, 0, 'failed saves keep the modal open');
        }
        assert.equal(errors.at(-1), 'Failed to save settings');
      } else {
        assert.equal(saves.length, 0);
        assert.equal(stateWrites, 0);
        assert.equal(closed, 0);
        assert.equal(values[1], false);
        buttons.find((node) => node.props.children === 'Cancel').props.onClick();
        assert.equal(closed, 1, 'read-only viewers can still close the modal');
      }
      assert.equal(
        JSON.stringify(fixture),
        before,
        'rendering/handlers must not mutate saved settings'
      );
      cases++;
    }
  }
  console.log(
    `PASS Analytics Read-Only Runtime: ${cases} owner/appointed/missing/invalid permission and absent/configured analytics cases verify frozen GA4/consent controls, guarded callbacks/saves, owner save failures and unchanged Search Console/AdSense delegation.`
  );
}

async function checkAiSettingsModels() {
  const current = [
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
  ];
  const legacy = [
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];
  const walk = (node, match) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, match));
    return [...(match(node) ? [node] : []), ...walk(node.props?.children, match)];
  };
  for (const savedModel of [undefined, ...current, ...legacy, 'unknown-model']) {
    const fixture = {
      ...settings,
      _canManageSecrets: true,
      api: { aiProvider: 'gemini', aiApiKey: 'qa-fake-key', aiModel: savedModel },
    };
    const before = JSON.stringify(fixture);
    const slots = [];
    const saves = [];
    let cursor = 0;
    const Manager = load('src/plugins/von-core/features/settings/SettingsManager.tsx', {
      ...React,
      useState(initial) {
        const slot = cursor++;
        if (!(slot in slots)) slots[slot] = slot === 0 ? 'api' : initial;
        return [
          slots[slot],
          (value) => {
            slots[slot] = typeof value === 'function' ? value(slots[slot]) : value;
          },
        ];
      },
      useRef: (value) => ({ current: value }),
      useEffect: noop,
    }).default;
    const draw = () => {
      cursor = 0;
      return Manager({
        settings: fixture,
        notify: noop,
        onUpdate: async (value) => {
          saves.push(JSON.parse(JSON.stringify(value)));
          return true;
        },
      });
    };
    const tree = draw();
    const select = walk(tree, (node) => node.props?.id === 'settingsmanager-655')[0];
    const options = walk(select, (node) => node.type === 'option');
    assert.deepEqual(
      Array.from(
        options.filter((node) => !node.props.disabled),
        (node) => node.props.value
      ),
      current,
      'new selections must not offer legacy models'
    );
    const expected = [...current, ...legacy].includes(savedModel) ? savedModel : current[0];
    assert.equal(select.props.value, expected);
    assert.equal(
      options.filter((node) => node.props.disabled).length,
      legacy.includes(savedModel) ? 1 : 0
    );
    const save = (view) =>
      walk(view, (node) => node.type === 'button' && node.props.onClick?.name === 'save')[0];
    await save(tree).props.onClick();
    assert.equal(
      saves.at(-1).api.aiModel,
      expected,
      'unrelated saves preserve legacy/current models'
    );
    assert.equal(saves.at(-1).api.aiApiKey, 'qa-fake-key');
    select.props.onChange({ target: { value: 'gemini-3.8-flash' } });
    const changed = draw();
    assert.equal(
      walk(changed, (node) => node.props?.id === 'settingsmanager-655')[0].props.value,
      'gemini-3.8-flash'
    );
    await save(changed).props.onClick();
    assert.equal(saves.at(-1).api.aiModel, 'gemini-3.8-flash');
    assert.equal(JSON.stringify(fixture), before, 'model selection must not mutate saved settings');
  }
  console.log(
    'PASS AI Model Settings Runtime: current selections, legacy preservation, default, explicit 3.8 change and unchanged API key. No provider request was made.'
  );
}

async function checkSettingsDraftLifecycle() {
  const merge = load('src/utils/settingsDraft.ts').mergeSettingsDraft;
  const original = {
    api: { aiApiKey: 'masked', aiKeyStorage: 'encrypted', aiKeyRevision: 'old' },
    media: {
      optimization: { enabled: true, compressionLevel: 'medium' },
      storage: { location: 'local' },
    },
    theme: { default: { footerLinks: ['first', 'second'], retired: 'remove me' } },
  };
  const latest = {
    ...original,
    api: { ...original.api, aiKeyStorage: 'unavailable', aiKeyRevision: 'new' },
    media: { ...original.media, storage: { location: 'cdn' } },
    theme: { default: { ...original.theme.default, newField: 'keep me' } },
  };
  const edited = {
    ...original,
    api: { ...original.api, aiApiKey: 'new user input' },
    media: { ...original.media, optimization: { ...original.media.optimization, enabled: false } },
    theme: { default: { footerLinks: [] } },
  };
  const inputSnapshot = JSON.stringify([original, latest, edited]);
  const combined = merge(latest, original, edited);
  assert.equal(combined.api.aiApiKey, 'new user input');
  assert.equal(combined.api.aiKeyStorage, 'unavailable');
  assert.equal(combined.api.aiKeyRevision, 'new');
  assert.equal(combined.media.optimization.enabled, false);
  assert.equal(combined.media.storage.location, 'cdn');
  assert.equal(combined.theme.default.newField, 'keep me');
  assert.equal(combined.theme.default.retired, undefined);
  assert.equal(
    combined.theme.default.footerLinks.length,
    0,
    'Arrays are replaced, not index-merged'
  );
  assert.equal(
    JSON.stringify([original, latest, edited]),
    inputSnapshot,
    'Merge must not mutate its inputs'
  );
  const walk = (node, match) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, match));
    return [...(match(node) ? [node] : []), ...walk(node.props?.children, match)];
  };
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const fixture = {
    ...settings,
    _settingsScope: 'admin',
    _canManageSecrets: true,
    api: { aiProvider: 'gemini', aiModel: 'gemini-3.6-flash' },
  };
  const setup = () => {
    const slots = [],
      reads = [],
      writes = [],
      notifications = [];
    let cursor = 0,
      dirty = false,
      effects = [],
      tree,
      canonical = copy(fixture),
      resolveSave;
    const hooks = {
      ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in slots))
          slots[index] = { value: typeof initial === 'function' ? initial() : initial };
        return [
          slots[index].value,
          (update) => {
            const previous = slots[index].value;
            const next = typeof update === 'function' ? update(previous) : update;
            if (typeof update === 'function') {
              assert.equal(
                JSON.stringify(update(previous)),
                JSON.stringify(next),
                'State updaters must be replay-safe'
              );
            }
            if (!Object.is(previous, next)) {
              slots[index].value = next;
              dirty = true;
            }
          },
        ];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useEffect(effect, deps) {
        const index = cursor++;
        if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
          const previous = slots[index];
          slots[index] = { deps };
          effects.push(() => {
            previous?.cleanup?.();
            slots[index].cleanup = effect();
          });
        }
      },
    };
    const Manager = load('src/plugins/von-core/features/settings/SettingsManager.tsx', hooks, {
      '../../../../config/site.config': { API: { settings: 'fixture-read' } },
      '../../../../utils/api': {
        vonFetch: async () => ({
          ok: true,
          json: () => new Promise((resolve) => reads.push(resolve)),
        }),
      },
    }).default;
    const draw = () => {
      let attempts = 0;
      do {
        assert.ok(attempts++ < 15, 'Settings reconciliation must settle');
        cursor = 0;
        dirty = false;
        effects = [];
        tree = Manager({
          settings: canonical,
          notify: (message) => notifications.push(message),
          onUpdate: (value) => {
            writes.push(copy(value));
            return new Promise((resolve) => {
              resolveSave = resolve;
            });
          },
        });
        effects.forEach((effect) => effect());
      } while (dirty);
      return tree;
    };
    const edit = (key, value) => {
      const form = walk(
        draw(),
        (node) => node.props?.settings && typeof node.props.onChange === 'function'
      )[0];
      form.props.onChange(key, value);
      draw();
    };
    const button = (label) =>
      walk(
        draw(),
        (node) =>
          node.type === 'button' &&
          (label === 'Save' ? node.props.onClick?.name === 'save' : node.props.children === label)
      )[0];
    draw();
    return {
      draw,
      edit,
      button,
      reads,
      writes,
      notifications,
      draft: () => slots[1].value,
      refresh: (value) => {
        canonical = value;
        draw();
      },
      finishSave: (value) => resolveSave(value),
      flush: async () => {
        for (let i = 0; i < 6; i++) await Promise.resolve();
        draw();
      },
    };
  };
  let cases = 0;
  const fields = {
    siteName: 'Edited name',
    postsPerPage: 24,
    siteDescription: 'Edited description',
    timeZone: 'Asia/Kuala_Lumpur',
    dateFormat: 'iso',
    ads: { headerAd: '<!-- edited -->' },
    api: { ...fixture.api, aiModel: 'gemini-3.8-flash' },
    media: { defaultView: 'list' },
    adminProfile: { name: 'Edited profile' },
    categories: ['Edited category'],
    navigation: [{ id: 'edited', label: 'Edited menu', url: 'home', type: 'internal' }],
  };
  for (const [key, value] of Object.entries(fields)) {
    const run = setup();
    await run.flush();
    run.edit(key, value);
    const incoming = { ...fixture, siteTagline: 'Late read' };
    run.reads[0](incoming);
    await run.flush();
    assert.equal(JSON.stringify(run.draft()[key]), JSON.stringify(value), key + ' lost after read');
    assert.equal(run.draft().siteTagline, 'Late read');
    const refreshed = { ...incoming, siteTagline: 'Parent refresh' };
    run.refresh(refreshed);
    assert.equal(
      JSON.stringify(run.draft()[key]),
      JSON.stringify(value),
      key + ' lost after refresh'
    );
    run.button('Cancel').props.onClick();
    run.draw();
    assert.equal(
      JSON.stringify(run.draft()),
      JSON.stringify(refreshed),
      'Cancel must use the accepted baseline'
    );
    cases++;
  }
  let numberSettings = { ...settings, postsPerPage: 6 };
  const General = load(
    'src/plugins/von-core/features/settings/components/GeneralSettings.tsx',
    {
      ...React,
      useState: (initial) => [initial, noop],
      useEffect: noop,
    },
    {
      '../../../../../utils/siteUtils': {
        resolveHeaderIdentityMode: () => 'logo_and_text',
        DEFAULT_SITE_DATE_FORMAT: 'month_day_year_long',
        SITE_DATE_FORMAT_OPTIONS: [],
      },
    }
  ).GeneralSettings;
  const numberInput = () =>
    walk(
      General({
        settings: numberSettings,
        onChange: (key, value) => {
          numberSettings = { ...numberSettings, [key]: value };
        },
      }),
      (node) => node.props?.['aria-label'] === 'Posts Per Page'
    )[0];
  numberInput().props.onChange({ target: { value: '24' } });
  const numberIncoming = { ...settings, postsPerPage: 12 };
  numberSettings = merge(numberIncoming, { ...settings, postsPerPage: 6 }, numberSettings);
  assert.equal(numberInput().props.value, 24, 'An unblurred number must participate in the draft');
  numberSettings = numberIncoming;
  assert.equal(numberInput().props.value, 12, 'Cancel must also reset the visible numeric input');
  numberInput().props.onChange({ target: { value: '' } });
  assert.equal(numberInput().props.value, '', 'Clearing the input remains possible');
  for (const [value, expected] of [
    ['', 6],
    ['0', 6],
    ['51', 50],
    ['24', 24],
  ]) {
    numberInput().props.onBlur({ currentTarget: { value } });
    assert.equal(numberInput().props.value, expected, 'Number bounds remain 6-50');
  }
  for (const success of [false, true]) {
    const run = setup();
    await run.flush();
    run.edit('siteName', 'Submitted title');
    const request = run.button('Save').props.onClick();
    run.draw();
    const optimistic = run.writes[0];
    run.refresh(optimistic);
    if (success) {
      run.edit('siteName', 'Newer unsaved title');
      run.refresh({ ...optimistic, api: { ...optimistic.api, aiApiKey: '******** (PROTECTED)' } });
    } else {
      run.refresh(copy(fixture));
    }
    run.finishSave(success);
    await request;
    run.draw();
    assert.equal(run.draft().siteName, success ? 'Newer unsaved title' : 'Submitted title');
    assert.equal(run.button('Save').props.disabled, false);
    if (success) assert.equal(run.draft().api.aiApiKey, '******** (PROTECTED)');
    // The pre-save read cannot resurrect a stale title after either outcome.
    run.reads[0]({ ...fixture, siteName: 'Stale pre-save read' });
    await run.flush();
    assert.equal(run.draft().siteName, success ? 'Newer unsaved title' : 'Submitted title');
    run.button('Cancel').props.onClick();
    run.draw();
    assert.equal(run.draft().siteName, success ? 'Submitted title' : fixture.siteName);
    cases++;
  }
  for (const action of ['refresh', 'cancel', 'partial']) {
    const run = setup();
    await run.flush();
    run.edit('siteName', 'Keep this draft');
    if (action === 'refresh') run.refresh({ ...fixture, siteTagline: 'Newer canonical' });
    if (action === 'cancel') {
      run.button('Cancel').props.onClick();
      run.draw();
    }
    run.reads[0](
      action === 'partial' ? { _settingsScope: 'public' } : { ...fixture, siteName: 'Stale read' }
    );
    await run.flush();
    assert.equal(run.draft().siteName, action === 'cancel' ? fixture.siteName : 'Keep this draft');
    if (action === 'refresh') assert.equal(run.draft().siteTagline, 'Newer canonical');
    if (action === 'partial') assert.equal(run.notifications.length, 1);
    cases++;
  }
  console.log(
    `PASS Settings Draft Lifecycle Runtime: ${cases} field/read/refresh/save/rollback/Cancel cases preserve drafts, accepted baselines and masked credential projections; state updaters are replay-safe. No installed settings were changed.`
  );
}

function checkDiscussionPostLinks() {
  const collectionReads = [];
  let route = '/admin/discussion';
  const appSource = ts.createSourceFile(
    'src/App.tsx',
    read('src/App.tsx'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const routeLoader = appSource.statements.find(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => declaration.name.getText(appSource) === 'AdminContentRouteLoader'
      )
  );
  assert.ok(routeLoader, 'Actual route collection loader must be available');
  const routeLoaderSource =
    "import React, {useRef,useEffect,useLayoutEffect} from 'react'; import {useLocation} from 'react-router';\n" +
    routeLoader.getText(appSource);
  const Loader = load(
    'src/App.tsx',
    {
      ...React,
      useRef: (value) => ({ current: value }),
      useLayoutEffect: noop,
      useEffect: (effect) => effect(),
    },
    { 'react-router': { useLocation: () => ({ pathname: route }) } },
    {},
    '\nexport { AdminContentRouteLoader as DiscussionLoaderFixture };',
    routeLoaderSource
  ).DiscussionLoaderFixture;
  const loaderProps = {
    user,
    resetContentLoadCoverage: noop,
    loadPosts: async (limit) => {
      collectionReads.push(['posts', limit]);
      return true;
    },
    loadPages: async (limit) => {
      collectionReads.push(['pages', limit]);
      return true;
    },
  };
  Loader(loaderProps);
  assert.equal(collectionReads.length, 0, 'Discussion must not preload 200 article bodies');
  route = '/admin/dashboard';
  Loader(loaderProps);
  route = '/admin/posts';
  Loader(loaderProps);
  route = '/admin/pages';
  Loader(loaderProps);
  assert.equal(
    JSON.stringify(collectionReads),
    JSON.stringify([
      ['posts', 5],
      ['posts', 200],
      ['pages', 200],
    ]),
    'Other admin collection budgets must be unchanged'
  );
  const file = 'src/plugins/von-core/features/discussion/DiscussionManager.tsx';
  let cases = 0;
  for (const base of ['/', '/zangetsu/']) {
    const utils = load(
      'src/utils/siteUtils.ts',
      React,
      { '../config/site.config': { BASE_PATH: base } },
      { URL }
    );
    const Row = load(
      file,
      React,
      { '../../../../utils/siteUtils': utils },
      {},
      '\nexport { CommentRow as DiscussionRowFixture };'
    ).DiscussionRowFixture;
    const prefix = base === '/' ? '' : '/zangetsu';
    for (const [style, path] of [
      ['slug', '/2026'],
      ['post_name', '/2026'],
      ['category', '/technology/2026'],
      ['date', '/2026/10/01/2026'],
      ['day_name', '/2026/10/01/2026'],
      ['month_name', '/2026/10/2026'],
      ['plain', '/post/987654'],
    ]) {
      const actions = [];
      const comment = {
        id: 'c-8',
        postId: '987654',
        username: 'QA',
        content: 'QA comment',
        status: 'pending',
        createdAt: '2026-10-01T12:00:00',
        post: {
          id: '987654',
          title: 'Parent beyond cached posts',
          slug: '2026',
          category: 'Technology',
          createdAt: '2026-10-01T12:00:00',
          isPublic: true,
        },
      };
      const props = {
        comment,
        settings: { ...settings, permalinkStructure: style },
        isDeleting: null,
        updatingStatusId: null,
        getPostTitle: () => 'Stale cached title',
        onStatusChange: (...args) => actions.push(args),
        onDeleteClick: (value) => actions.push(['delete', value.id]),
      };
      const tree = Row(props);
      const link = find(
        tree,
        (node) => node.type === 'a' && node.props.title === 'View article (opens in a new tab)'
      );
      assert.ok(link, 'Published parent must be clickable without the cached posts list');
      assert.equal(link.props.href, prefix + path, style + ' ' + base);
      assert.equal(link.props.target, '_blank');
      assert.equal(link.props.rel, 'noopener noreferrer');
      assert.ok(link.props['aria-label'].includes(comment.post.title));
      assert.ok(!renderToStaticMarkup(tree).includes('Stale cached title'));
      find(
        tree,
        (node) => node.type === 'button' && node.props.title === 'Approve'
      ).props.onClick();
      find(tree, (node) => node.type === 'button' && node.props.title === 'Delete').props.onClick();
      assert.equal(
        JSON.stringify(actions),
        JSON.stringify([
          ['c-8', 'approved'],
          ['delete', 'c-8'],
        ])
      );
      for (const post of [
        null,
        undefined,
        { ...comment.post, isPublic: false },
        { ...comment.post, isPublic: 'true' },
      ]) {
        const unavailable = Row({ ...props, comment: { ...comment, post } });
        assert.equal(
          find(unavailable, (node) => node.type === 'a'),
          undefined,
          'Unavailable/malformed parents must have no misleading link'
        );
      }
      const unsafeText = Row({
        ...props,
        comment: { ...comment, post: { ...comment.post, title: '<img src=x onerror=bad()>' } },
      });
      assert.ok(!renderToStaticMarkup(unsafeText).includes('<img src="x"'));
      assert.ok(renderToStaticMarkup(unsafeText).includes('&lt;img'));
      cases++;
    }
  }
  console.log(
    `PASS Discussion Post Links Runtime: ${cases} root/subfolder permalink cases use authoritative compact parents, retain safe new tabs and moderation handlers, escape titles, and omit unavailable links without article fetches.`
  );
}

async function checkAvatarState() {
  const profileUtils = load('src/utils/profileUtils.ts');
  const original = { display_name: 'Old', bio: 'Old bio', avatar: 'http://qa.invalid/raw.webp' };
  const canonical = { display_name: 'Saved & Name', bio: 'Saved bio', avatar: '' };
  assert.equal(
    JSON.stringify(
      profileUtils.getSavedProfileUpdates(
        { ...canonical, role: 'Root', password: 'ignored' },
        original
      )
    ),
    JSON.stringify(canonical)
  );
  assert.equal(profileUtils.getSavedProfileUpdates({ avatar: null }, original).avatar, '');
  assert.equal(profileUtils.getSavedProfileUpdates([], original).avatar, original.avatar);

  const harness = () => {
    const slots = [];
    let cursor = 0,
      effects = [],
      dirty = false;
    const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
    const hooks = {
      ...React,
      useState(initial) {
        const i = cursor++;
        if (!(i in slots))
          slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        return [
          slots[i].value,
          (next) => {
            slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
            dirty = true;
          },
        ];
      },
      useRef(initial) {
        const i = cursor++;
        return (slots[i] ||= { current: initial });
      },
      useCallback(callback, deps) {
        const i = cursor++;
        if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: callback, deps };
        return slots[i].value;
      },
      useEffect(effect, deps) {
        const i = cursor++;
        if (!slots[i] || !same(slots[i].deps, deps)) {
          slots[i] = { deps };
          effects.push(effect);
        }
      },
    };
    return {
      hooks,
      slots,
      draw(render) {
        let value,
          limit = 0;
        do {
          assert.ok(limit++ < 10);
          cursor = 0;
          effects = [];
          dirty = false;
          value = render();
          effects.forEach((effect) => effect());
        } while (dirty);
        return value;
      },
    };
  };
  for (const base of ['/', '/zangetsu/']) {
    const utils = load(
      'src/utils/siteUtils.ts',
      React,
      { '../config/site.config': { BASE_PATH: base } },
      { URL }
    );
    const imageState = harness();
    const image = load('src/components/SafeImage.tsx', imageState.hooks, {
      '../utils/siteUtils': utils,
    }).SafeImage;
    let src = 'uploads/missing.webp';
    const drawImage = () =>
      imageState.draw(() => image({ src, alt: 'Avatar', fallback: 'Gravatar fallback' }));
    assert.equal(drawImage().props.src, base + 'uploads/missing.webp');
    drawImage().props.onError({});
    assert.equal(drawImage().props.children, 'Gravatar fallback');
    src = 'uploads/replacement.webp';
    assert.equal(
      drawImage().props.src,
      base + 'uploads/replacement.webp',
      'changed failed URL must retry'
    );
    src = 'javascript:bad()';
    assert.equal(drawImage().props.children, 'Gravatar fallback');
    src = '';
    assert.equal(drawImage().props.children, 'Gravatar fallback');
  }
  for (const file of [
    'src/components/layouts/AdminLayout.tsx',
    'src/plugins/von-core/features/users/UserManager.tsx',
    'src/plugins/von-core/features/discussion/DiscussionManager.tsx',
    'src/plugins/von-core/features/public/components/Comments.tsx',
    'src/themes/corporate-pro/Layout.tsx',
    'src/themes/portfolio/Layout.tsx',
  ]) {
    const source = ts.createSourceFile(
      file,
      read(file),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    let sharedSinks = 0;
    const visit = (node) => {
      if (ts.isJsxSelfClosingElement(node)) {
        const src = node.attributes.properties.find((p) => p.name?.text === 'src');
        if (src && /avatar|\burl\b/i.test(src.getText(source))) {
          assert.equal(
            node.tagName.getText(source),
            'SafeImage',
            file + ' must use the shared image lifecycle'
          );
          assert.ok(node.attributes.properties.some((p) => p.name?.text === 'fallback'));
          sharedSinks++;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(sharedSinks > 0, file);
  }
  const target = { ...user, ...original, email: 'private@example.invalid' };
  for (const [file, name] of [
    ['src/hooks/useProfileEditor.ts', null],
    ['src/themes/corporate-pro/Layout.tsx', 'CorporateProfile'],
    ['src/themes/portfolio/Layout.tsx', 'PortfolioProfile'],
    ['src/themes/digest/Layout.tsx', 'DigestProfile'],
    ['src/themes/prism/components/PrismProfile.tsx', 'PrismProfile'],
  ]) {
    const h = harness(),
      published = [],
      requests = [];
    let ok = true,
      hold = false,
      release;
    const transport = {
      vonFetch: async (_url, options) => {
        requests.push(JSON.parse(options.body));
        if (hold)
          return new Promise((resolve) => {
            release = resolve;
          });
        return {
          ok,
          json: async () => ({
            success: ok,
            user: { ...canonical, role: 'Root', password: 'ignored' },
          }),
        };
      },
    };
    const prefix =
      file.includes('corporate-pro') || file.includes('portfolio') || file.includes('digest')
        ? '../../'
        : file.includes('prism')
          ? '../../../'
          : '../';
    const module = load(
      file,
      h.hooks,
      { [prefix + 'utils/api']: transport },
      {},
      name ? `\nexport { ${name} as AvatarProfileFixture };` : ''
    );
    const component = name ? module.AvatarProfileFixture : module.useProfileEditor;
    const props = {
      targetUser: target,
      profileUser: target,
      currentUser: target,
      isOwner: true,
      onUpdateUser: (value) => published.push(value),
      posts: [],
      comments: [],
      projects: [],
      settings,
      colors: {},
      onBack: noop,
      onViewPost: noop,
      onPostClick: noop,
    };
    const draw = () => h.draw(() => component(props));
    let view = draw();
    const save = async () => {
      if (!name) {
        await view.handleSaveProfile();
        return;
      }
      h.slots[0].value = true;
      view = draw();
      const button = find(view, (node) =>
        ['handleSaveProfile', 'handleSave'].includes(node.props?.onClick?.name)
      );
      assert.ok(button, file + ' exposes its real save handler');
      await button.props.onClick();
    };
    await save();
    view = draw();
    assert.equal(requests[0].avatar, original.avatar);
    assert.equal(
      JSON.stringify(published[0]),
      JSON.stringify({ ...canonical, id: target.id }),
      file
    );
    assert.equal(h.slots[3].value, '', file + ' edit form must use the canonical avatar');
    assert.equal(h.slots[1].value, canonical.display_name);
    assert.equal(h.slots[2].value, canonical.bio);
    ok = false;
    await save();
    draw();
    assert.equal(published.length, 1, file + ' failed save must not publish auth state');
    // A response for submitted A must not replace B typed while that request waits.
    ok = true;
    hold = true;
    h.slots[0].value = true;
    h.slots[1].value = 'Submitted A';
    h.slots[2].value = 'Submitted bio A';
    h.slots[3].value = 'https://qa.invalid/avatar-A.webp';
    view = draw();
    const pendingA = save();
    view = draw();
    h.slots[0].value = true;
    h.slots[1].value = 'Unsaved B';
    h.slots[2].value = 'Unsaved bio B';
    h.slots[3].value = 'https://qa.invalid/avatar-B.webp';
    view = draw();
    const requestsWhilePending = requests.length;
    await save();
    assert.equal(requests.length, requestsWhilePending, file + ' must serialize pending saves');
    release({ ok: true, json: async () => ({ success: true, user: canonical }) });
    await pendingA;
    view = draw();
    assert.equal(h.slots[0].value, true, file + ' newer editor must remain open');
    assert.equal(h.slots[1].value, 'Unsaved B', file + ' newer display name was lost');
    assert.equal(h.slots[2].value, 'Unsaved bio B', file + ' newer bio was lost');
    assert.equal(
      h.slots[3].value,
      'https://qa.invalid/avatar-B.webp',
      file + ' newer avatar was lost'
    );
    assert.equal(
      published.at(-1).avatar,
      canonical.avatar,
      'Auth must use the accepted server avatar, not unsaved B'
    );
    hold = false;
    const retryCount = requests.length;
    await save();
    view = draw();
    assert.equal(requests.length, retryCount + 1, file + ' settlement must permit retry');
    if (!name) {
      const publishedBeforeNavigation = published.length;
      hold = true;
      const pendingSave = view.handleSaveProfile();
      props.targetUser = { ...target, id: 'next-profile', avatar: 'https://qa.invalid/next.webp' };
      view = draw();
      release({ ok: true, json: async () => ({ success: true, user: canonical }) });
      await pendingSave;
      view = draw();
      assert.equal(view.displayUser.id, 'next-profile');
      assert.equal(view.editAvatar, 'https://qa.invalid/next.webp');
      assert.equal(
        published.length,
        publishedBeforeNavigation,
        'late profile response must not publish after navigation'
      );
    }
  }

  assert.ok(
    read('src/themes/corporate-pro/Layout.tsx').includes('key={targetProfile.username}'),
    'Corporate profile instances must not be reused for a different profile'
  );

  const h = harness(),
    published = [];
  let ok = true,
    unchanged = false;
  const module = load('src/hooks/useUsers.ts', h.hooks, {
    '../utils/api': {
      vonFetch: async () => ({
        ok,
        json: async () => ({
          success: true,
          unchanged,
          user: { ...target, ...canonical, role: 'Root' },
        }),
      }),
    },
    'react-hot-toast': {
      __esModule: true,
      default: Object.assign(noop, { success: noop, error: noop }),
    },
  });
  const drawUsers = () => h.draw(() => module.useUsers(target, (value) => published.push(value)));
  let list = drawUsers();
  list.setUsers([target]);
  list = drawUsers();
  await list.handleUpdateUserInList(target);
  list = drawUsers();
  assert.equal(list.users[0].avatar, '');
  assert.equal(published[0].avatar, '');
  assert.equal(published[0].id, target.id);
  assert.equal(Object.hasOwn(published[0], 'role'), false);
  assert.equal(Object.hasOwn(published[0], 'password'), false);
  unchanged = true;
  await list.handleUpdateUserInList(target);
  drawUsers();
  assert.equal(published.length, 2, 'canonical no-op must refresh own auth presentation');
  ok = false;
  await drawUsers().handleUpdateUserInList(target);
  drawUsers();
  assert.equal(published.length, 2, 'HTTP failure must not publish a success body');
  ok = true;
  const other = h.draw(() =>
    module.useUsers({ ...target, id: 'different' }, (value) => published.push(value))
  );
  await other.handleUpdateUserInList(target);
  drawUsers();
  assert.equal(published.length, 2, 'editing another account must not replace current avatar');

  const auth = harness(),
    cached = [];
  const authModule = load(
    'src/hooks/useAuth.ts',
    auth.hooks,
    {
      './usePublicProfile': { updatePublicProfileCache: (...args) => cached.push(args) },
      '../utils/api': { vonFetch: async () => ({ ok: false }) },
    },
    {
      setTimeout: () => 1,
      clearTimeout: noop,
      window: { location: {}, addEventListener: noop, removeEventListener: noop },
    }
  );
  const drawAuth = () => auth.draw(() => authModule.useAuth());
  let session = drawAuth();
  session.setUser(target);
  session = drawAuth();
  const delayedUpdate = session.handleUpdateUser;
  delayedUpdate({ ...canonical, id: 'different' });
  session = drawAuth();
  assert.equal(
    session.user.avatar,
    original.avatar,
    'foreign response must not change current user'
  );
  delayedUpdate({ ...canonical, id: target.id });
  session = drawAuth();
  assert.equal(session.user.avatar, '');
  assert.equal(cached.at(-1)[1].avatar, '');
  session.setUser(null);
  drawAuth();
  delayedUpdate({ ...canonical, id: target.id });
  assert.equal(drawAuth().user, null, 'late response must never recreate a logged-out session');
  const publicCacheState = harness();
  const publicProfiles = load('src/hooks/usePublicProfile.ts', {
    ...publicCacheState.hooks,
    useMemo: (fn) => fn(),
  });
  publicProfiles.updatePublicProfileCache(target.username, target);
  const emptyUsers = [];
  const publicProfile = publicCacheState.draw(() =>
    publicProfiles.usePublicProfile(target.username, emptyUsers)
  );
  assert.equal(
    publicProfile.targetProfile.email,
    '',
    'auth cache refresh must not expose a private email'
  );
  assert.equal(
    publicProfile.targetProfile.role,
    'Member',
    'auth cache refresh must not publish a private role'
  );
  console.log(
    'PASS Avatar State Runtime: shared Profile editor and four theme forms adopt canonical/cleared server values; own User Manager updates/no-ops sync presentation, failures/other users/stale logout responses do not; authority fields are not published. Isolated transports only.'
  );
}

async function checkNewsletterSaveResult() {
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
    return predicate(node) ? node : find(node.props?.children, predicate);
  };
  const successes = [],
    errors = [],
    writes = [],
    slots = [];
  let cursor = 0,
    finish,
    fail;
  const Manager = load(
    'src/plugins/von-core/features/newsletter/NewsletterManager.tsx',
    {
      ...React,
      useState(initial) {
        const slot = cursor++;
        if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
        return [
          slots[slot],
          (value) => {
            slots[slot] = typeof value === 'function' ? value(slots[slot]) : value;
          },
        ];
      },
      useRef(initial) {
        const slot = cursor++;
        if (!(slot in slots)) slots[slot] = { current: initial };
        return slots[slot];
      },
      useEffect: noop,
    },
    {
      'react-hot-toast': {
        toast: {
          success: (message) => successes.push(message),
          error: (message) => errors.push(message),
        },
      },
    }
  ).default;
  const draw = () => {
    cursor = 0;
    return Manager({
      settings,
      onUpdateSettings: (value) => {
        writes.push(value);
        return new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        });
      },
    });
  };
  const button = () =>
    find(draw(), (node) => node.type === 'button' && node.props.onClick?.name === 'handleSave');
  for (const outcome of ['reject', 'throw', 'success']) {
    const oldSuccesses = successes.length,
      oldErrors = errors.length,
      oldWrites = writes.length;
    const request = button().props.onClick();
    assert.equal(button().props.disabled, true, 'Newsletter remains busy until Save settles');
    await button().props.onClick();
    assert.equal(writes.length, oldWrites + 1, 'Pending Save must not submit twice');
    assert.equal(successes.length, oldSuccesses, 'Pending Save must not report success');
    if (outcome === 'throw') fail(new Error('Controlled failure'));
    else finish(outcome === 'success');
    await request;
    assert.equal(successes.length, oldSuccesses + (outcome === 'success' ? 1 : 0));
    assert.equal(errors.length, oldErrors + (outcome === 'success' ? 0 : 1));
    assert.equal(button().props.disabled, false, 'Settled Save releases its retry control');
    assert.equal(
      JSON.stringify(slots[1]),
      JSON.stringify(writes.at(-1).newsletter),
      'Failed Save retains the draft'
    );
  }
  console.log(
    'PASS Newsletter Save Result Runtime: pending/duplicate, rejected, exception and successful writes retain drafts and show success only after acceptance. No delivery or installed-site writes.'
  );
}

async function checkAiKeyStorageUi() {
  const walk = (node, match) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, match));
    return [...(match(node) ? [node] : []), ...walk(node.props?.children, match)];
  };
  for (const storage of ['legacy', 'encrypted', 'unavailable']) {
    for (const expired of [false, true]) {
      const fixture = {
        ...settings,
        _canManageSecrets: true,
        api: {
          aiProvider: 'gemini',
          aiModel: 'gemini-3.8-flash',
          aiApiKey: '******** (PROTECTED)',
          aiKeyStorage: storage,
          expireAiKeyAfter30Days: true,
          aiKeySavedAt: '2026-01-01T00:00:00Z',
          aiKeyExpiresAt: expired ? '2000-01-01T00:00:00Z' : '2100-01-01T00:00:00Z',
        },
      };
      const original = JSON.stringify(fixture),
        slots = [],
        saved = [];
      let cursor = 0,
        effects = [];
      const Manager = load('src/plugins/von-core/features/settings/SettingsManager.tsx', {
        ...React,
        useState(initial) {
          const slot = cursor++;
          if (!(slot in slots)) slots[slot] = slot === 0 ? 'api' : initial;
          return [
            slots[slot],
            (value) => {
              slots[slot] = typeof value === 'function' ? value(slots[slot]) : value;
            },
          ];
        },
        useRef: (value) => ({ current: value }),
        useEffect: (effect) => effects.push(effect),
      }).default;
      const draw = () => {
        cursor = 0;
        effects = [];
        return Manager({
          settings: fixture,
          notify: noop,
          onUpdate: async (value) => {
            saved.push(value);
            return true;
          },
        });
      };
      const save = (tree) =>
        walk(tree, (node) => node.type === 'button' && node.props.onClick?.name === 'save')[0];
      draw();
      effects[1](); // Execute the actual props/expiry reconciliation, not the network effect.
      let tree = draw();
      const input = (view) => walk(view, (node) => node.props?.id === 'api-ai-key')[0];
      assert.equal(
        input(tree).props.value,
        '******** (PROTECTED)',
        'expiry must not turn a saved key into an implicit deletion'
      );
      await save(tree).props.onClick();
      assert.equal(saved.at(-1).api.aiApiKey, fixture.api.aiApiKey);
      assert.equal(saved.at(-1).api.aiKeyExpiresAt, fixture.api.aiKeyExpiresAt);
      if (storage === 'legacy') {
        assert.equal(saved.at(-1).api.encryptStoredAiKey, true);
        assert.ok(
          load('src/utils/settingsDraft.ts').createSettingsPatch(fixture, saved.at(-1)).api,
          'migration intent must not be dropped as an unchanged group'
        );
      }
      input(tree).props.onChange({ target: { value: 'qa-explicit-edit' } });
      tree = draw();
      await save(tree).props.onClick();
      assert.equal(saved.at(-1).api.replaceAiKey, true);
      assert.equal(saved.at(-1).api.aiApiKey, 'qa-explicit-edit');
      input(tree).props.onChange({ target: { value: '' } });
      tree = draw();
      await save(tree).props.onClick();
      assert.equal(saved.at(-1).api.aiApiKey, '', 'only explicit clearing removes a key');
      assert.equal(JSON.stringify(fixture), original);
    }
  }
  console.log(
    'PASS AI Key Storage UI Runtime: legacy migration intent reaches the patch, encrypted/unavailable/expired keys stay masked, explicit field edits carry replacement intent, and clearing remains deliberate.'
  );
}

async function checkAiKeyRotationUi() {
  const walk = (node, match) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, match));
    return [...(match(node) ? [node] : []), ...walk(node.props?.children, match)];
  };
  const fixture = {
    ...settings,
    _settingsScope: 'admin',
    _canManageSecrets: true,
    api: {
      aiApiKey: '******** (PROTECTED)',
      aiKeyStorage: 'encrypted',
      aiKeyCanRotate: true,
      aiKeyRevision: 'a'.repeat(64),
    },
  };
  let props = { settings: fixture },
    cursor = 0,
    effects = [],
    confirmation = false,
    confirmations = 0;
  const slots = [],
    calls = [];
  let release;
  const Manager = load(
    'src/plugins/von-core/features/settings/SettingsManager.tsx',
    {
      ...React,
      useState(initial) {
        const slot = cursor++;
        if (!(slot in slots)) slots[slot] = slot === 0 ? 'api' : initial;
        return [
          slots[slot],
          (value) => {
            slots[slot] = typeof value === 'function' ? value(slots[slot]) : value;
          },
        ];
      },
      useRef(value) {
        const slot = cursor++;
        if (!(slot in slots)) slots[slot] = { current: value };
        return slots[slot];
      },
      useEffect(effect) {
        effects.push(effect);
      },
    },
    {},
    {
      window: {
        confirm: () => {
          confirmations++;
          return confirmation;
        },
      },
    }
  ).default;
  const draw = () => {
    cursor = 0;
    effects = [];
    return Manager({
      ...props,
      onUpdate: async () => true,
      notify: noop,
      onRotateEncryptionKey: (revision) => {
        calls.push(revision);
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
  };
  const button = (tree) =>
    walk(
      tree,
      (node) => node.type === 'button' && node.props.onClick?.name === 'rotateEncryptionKey'
    )[0];
  let tree = draw();
  assert.equal(button(tree).props.disabled, false);
  await button(tree).props.onClick();
  assert.equal(calls.length, 0, 'Cancel must not call the server');
  confirmation = true;
  const pending = button(tree).props.onClick();
  assert.deepEqual(calls, [fixture.api.aiKeyRevision]);
  tree = draw();
  assert.equal(button(tree).props.disabled, true, 'Pending rotation must freeze its control');
  assert.equal(tree.type, 'fieldset');
  assert.equal(tree.props.disabled, true, 'All Settings fields stay frozen during rotation');
  await button(tree).props.onClick();
  assert.equal(calls.length, 1, 'Busy handler must not submit twice');
  release(false);
  await pending;
  tree = draw();
  assert.equal(button(tree).props.disabled, false, 'Failure must release busy state');
  const input = walk(tree, (node) => node.props?.id === 'api-ai-key')[0];
  input.props.onChange({ target: { value: 'qa-unsaved-new-key' } });
  tree = draw();
  assert.equal(button(tree).props.disabled, true, 'Unsaved settings must block rotation');
  await button(tree).props.onClick();
  assert.equal(calls.length, 1);
  for (const changed of [
    { ...fixture, _canManageSecrets: false },
    { ...fixture, api: { ...fixture.api, aiKeyStorage: 'legacy' } },
    { ...fixture, api: { ...fixture.api, aiKeyStorage: 'unavailable' } },
    { ...fixture, api: { ...fixture.api, aiKeyCanRotate: false } },
  ]) {
    props = { settings: changed };
    draw();
    effects[1]();
    tree = draw();
    if (changed._canManageSecrets && changed.api.aiKeyStorage === 'encrypted')
      assert.equal(button(tree).props.disabled, true);
    else
      assert.equal(button(tree), undefined, 'Unavailable/non-owner state must not expose rotation');
  }
  assert.equal(confirmations, 2, 'Rejected/busy/dirty actions must not prompt');
  console.log(
    'PASS AI Encryption Rotation UI: owner gating, confirmation/cancel, busy guard, unsaved-draft protection, unavailable/legacy storage and failure recovery. No live Settings were changed.'
  );
}

async function checkNativeCrawlerTracking() {
  const file = 'src/plugins/von-core/features/public/PublicSite.tsx';
  const browserUA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36';
  let cases = 0;
  for (const prefix of ['', '/zangetsu']) {
    for (const mode of ['strict', 'balanced', 'hybrid']) {
      for (const view of ['home', 'category', 'single-post', 'page', 'profile']) {
        for (const marker of [null, 'excluded', 'unrecognized']) {
          const calls = [],
            effects = [];
          const publicLocation = { pathname: `${prefix}/news/qa`, search: '' };
          const hooks = {
            ...React,
            useState: (initial) => [typeof initial === 'function' ? initial() : initial, noop],
            useMemo: (factory) => factory(),
            useEffect: (effect) => effects.push(effect),
          };
          const Component = load(
            file,
            hooks,
            {
              'react-router': { useLocation: () => publicLocation },
              '../themes/ThemeContext': { useTheme: () => ({ activeTheme: { id: 'default' } }) },
              './themeLayoutLoader': {
                resolvePublicThemeId: () => 'default',
                getLoadedPublicThemeLayout: () => Blank,
              },
              '../../../../themes/shared/themeSettings': { resolvePublicThemeSettings: (s) => s },
              '../../../../utils/pluginRuntime': { isSystemPluginActive: () => true },
              '../../../../utils/analyticsConsent': {
                analyticsTrackingAllowed: () => true,
                clearNativeAnalyticsIdentity: noop,
                nativeAnalyticsCookieName: () => 'qa_identity',
              },
              '../../../../config/site.config': {
                API: { trackMonolithic: `${prefix}/api/track_monolithic.php` },
              },
              '../../../../utils/api': {
                vonFetch: async (url, options) => {
                  calls.push({ url, payload: JSON.parse(options.body) });
                  return { json: async () => ({ retry: false }) };
                },
              },
            },
            {
              navigator: { userAgent: browserUA },
              window: { location: publicLocation },
              document: {
                cookie: '',
                referrer: '',
                querySelector: (selector) => {
                  assert.equal(selector, 'meta[name="voncms-tracking"]');
                  return marker === null ? null : { getAttribute: () => marker };
                },
              },
            }
          ).default;
          const props = {
            ...base,
            settings: { ...settings, analytics: { measurementMode: mode } },
            currentView: view,
            selectedPost: view === 'single-post' ? posts[0] : null,
            selectedPage: view === 'page' ? { id: '8', title: 'QA Page' } : null,
          };
          Component(props);
          for (const effect of effects) effect();
          await Promise.resolve();
          assert.equal(
            calls.length,
            marker === 'excluded' ? 0 : 1,
            `${prefix}/${mode}/${view}/${marker}`
          );
          if (calls.length) {
            assert.equal(calls[0].payload.postId, view === 'single-post' ? posts[0].id : undefined);
            assert.equal(calls[0].payload.pageId, view === 'page' ? '8' : undefined);
            assert.equal(calls[0].url, `${prefix}/api/track_monolithic.php`);
          }
          cases++;
        }
      }
    }
  }
  assert.ok(
    read('public/index.php').includes('echo voncms_tracking_document_meta();'),
    'PHP entry must emit its real shared document classification'
  );
  assert.ok(
    read('public/api/analytics_consent_helper.php').includes(
      '<meta name="voncms-tracking" content="excluded">'
    ),
    'Client marker must match the server-emitted fragment'
  );
  console.log(
    `PASS Native Crawler Tracking: ${cases} root/subfolder, five-route and three-mode actual component Effect cases retain crawler-document exclusion after changing to Linux/Chrome, while unmarked ordinary browsers still track. Controlled React/transport simulation, not a live bot.`
  );
}

function checkGoogleTrackingRuntime() {
  const file = 'src/components/AnalyticsInjector.tsx';
  for (const legacyFlag of [undefined, false, true]) {
    const scripts = new Map();
    const browserWindow = {
      location: { href: 'https://qa.test/zangetsu/news/item', pathname: '/zangetsu/news/item' },
    };
    const browserDocument = {
      title: 'QA article',
      getElementById: (id) => scripts.get(id),
      createElement: () => ({}),
      head: { appendChild: (script) => scripts.set(script.id, script) },
    };
    const { AnalyticsInjector } = load(
      file,
      { ...React, useEffect: (effect) => effect() },
      {
        'react-router': { useLocation: () => ({ pathname: '/zangetsu/news/item' }) },
        '../utils/analyticsPrivacy': {
          resolveAnalyticsPageLocation: () => browserWindow.location.href,
        },
        '../utils/analyticsConsent': { analyticsTrackingAllowed: () => true },
      },
      { window: browserWindow, document: browserDocument }
    );
    const analytics = { googleAnalyticsId: 'G-QA', enableTracking: true, anonymizeIP: legacyFlag };
    AnalyticsInjector({ analytics });
    AnalyticsInjector({ analytics });
    assert.equal(scripts.size, 1, 'SPA navigation must not duplicate the Google loader');
    const calls = browserWindow.dataLayer.map((args) => Array.from(args));
    const configs = calls.filter((args) => args[0] === 'config');
    assert.equal(configs.length, 1);
    assert.equal(configs[0][2].send_page_view, false);
    assert.ok(
      !Object.hasOwn(configs[0][2], 'anonymize_ip'),
      'legacy privacy flag must not be presented as GA4 control'
    );
    assert.equal(calls.filter((args) => args[0] === 'event' && args[1] === 'page_view').length, 2);
    AnalyticsInjector({ analytics: { ...analytics, enableTracking: false } });
    assert.equal(
      browserWindow.dataLayer.length,
      calls.length,
      'disabled tracking must not emit another view'
    );
  }
  console.log(
    'PASS Google Tracking Runtime: single loader, manual SPA views, tracking OFF and retired privacy flag behavior; Google delivery was not contacted.'
  );
}

async function checkMediaSettingsRuntime() {
  const walk = (node, match) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, match));
    return [...(match(node) ? [node] : []), ...walk(node.props?.children, match)];
  };
  const text = (node) =>
    typeof node === 'string'
      ? node
      : Array.isArray(node)
        ? node.map(text).join('')
        : text(node?.props?.children || '');
  const fixture = {
    ...settings,
    media: {
      optimization: {
        enabled: true,
        compressionLevel: 'medium',
        convertToWebP: false,
        maxWidth: 1920,
        maxHeight: 1080,
      },
      storage: { location: 'local', folderStructure: 'flat', cdnUrl: 'https://cdn.qa.test' },
      performance: { lazyLoadImages: true, lazyLoadIframes: true },
      defaultView: 'list',
    },
  };
  const before = JSON.stringify(fixture);
  const slots = [],
    changes = [],
    requests = [],
    errors = [];
  let cursor = 0,
    confirmation = false,
    response = { success: false, error: 'Fixture operation failed' };
  const { MediaSettings } = load(
    'src/plugins/von-core/features/settings/components/MediaSettings.tsx',
    {
      ...React,
      useState(initial) {
        const slot = cursor++;
        if (!(slot in slots)) slots[slot] = initial;
        return [
          slots[slot],
          (value) => {
            slots[slot] = typeof value === 'function' ? value(slots[slot]) : value;
          },
        ];
      },
    },
    {
      '../../../../../config/site.config': {
        API: {
          mediaTools: 'media-tools-fixture',
          syncMedia: 'sync-fixture',
          cleanupMediaVariantRows: 'rows-fixture',
        },
      },
      '../../../../../utils/api': {
        vonFetch: async (url, options) => {
          requests.push({ url, options });
          if (response instanceof Error) throw response;
          return { json: async () => response };
        },
      },
      'react-hot-toast': {
        __esModule: true,
        default: { success: noop, error: (value) => errors.push(value) },
      },
    },
    { FormData, window: { confirm: () => confirmation } }
  );
  const draw = () => {
    cursor = 0;
    return MediaSettings({
      settings: fixture,
      onChange: (key, value) => changes.push({ key, value }),
    });
  };
  const changeTab = (tab) => {
    walk(draw(), (node) => node.props?.id === 'media-settings-section')[0].props.onChange({
      target: { value: tab },
    });
    return draw();
  };
  for (const [tab, id, section, key, value] of [
    ['optimization', 'mediasettings-365', 'optimization', 'enabled', false],
    ['optimization', 'mediasettings-402', 'optimization', 'convertToWebP', true],
    ['sizes', 'mediasettings-421', 'optimization', 'maxWidth', 1280],
    ['sizes', 'mediasettings-434', 'optimization', 'maxHeight', 720],
    ['storage', 'mediasettings-459', 'storage', 'location', 'local'],
    ['storage', 'mediasettings-474', 'storage', 'folderStructure', 'year_month'],
    ['storage', 'mediasettings-487', 'storage', 'cdnUrl', 'https://next.qa.test'],
    ['performance', 'mediasettings-511', 'performance', 'lazyLoadImages', false],
    ['performance', 'mediasettings-530', 'performance', 'lazyLoadIframes', false],
  ]) {
    const field = walk(changeTab(tab), (node) => node.props?.id === id)[0];
    field.props.onChange({ target: { value: String(value), checked: value } });
    assert.deepEqual(JSON.parse(JSON.stringify(changes.pop())), {
      key: 'media',
      value: { ...fixture.media, [section]: { ...fixture.media[section], [key]: value } },
    });
  }
  const button = (view, label) =>
    walk(view, (node) => node.type === 'button' && text(node).includes(label))[0];
  button(changeTab('optimization'), 'high').props.onClick();
  assert.equal(changes.pop().value.optimization.compressionLevel, 'high');
  button(changeTab('gallery'), 'Grid View').props.onClick();
  assert.equal(changes.pop().value.defaultView, 'grid');
  button(changeTab('gallery'), 'List View').props.onClick();
  assert.equal(changes.pop().value.defaultView, 'list');
  for (const [label, endpoint, action] of [
    ['Start Media Sync', 'sync-fixture', undefined],
    ['Start Rebuild', 'media-tools-fixture', 'rebuild_responsive_variants'],
    ['Preview Generated Variants Only', 'media-tools-fixture', 'preview_responsive_variants'],
    ['Scan Untracked Files', 'media-tools-fixture', 'cleanup_unused'],
    ['Clean Old Variant Rows', 'rows-fixture', undefined],
  ]) {
    confirmation = true;
    for (const outcome of [
      { success: false, error: 'Fixture operation failed' },
      new Error('Fixture network failed'),
    ]) {
      response = outcome;
      await button(changeTab('tools'), label).props.onClick();
      assert.equal(requests.at(-1).url, endpoint);
      assert.equal(requests.at(-1).options.method, 'POST');
      if (action) assert.equal(requests.at(-1).options.body.get('action'), action);
      assert.ok(
        text(draw()).includes(outcome.error || outcome.message),
        'failure must remain visible'
      );
      assert.equal(
        button(draw(), label).props.disabled,
        false,
        'failure must release the busy state'
      );
    }
  }
  const count = requests.length;
  confirmation = false;
  await button(changeTab('tools'), 'Clean Old Variant Rows').props.onClick();
  assert.equal(requests.length, count, 'cancel must not request a row deletion');
  response = {
    success: true,
    message: 'Review fixture',
    stats: { count: 1, isExecuted: false },
    previewToken: 'qa-review-token',
    orphaned: [{ path: 'qa.webp', size: 12, modified: 'QA' }],
  };
  await button(draw(), 'Scan Untracked Files').props.onClick();
  await button(draw(), 'Delete Reviewed Files').props.onClick();
  assert.equal(requests.length, count + 1, 'cancel must not delete reviewed files');
  confirmation = true;
  response = { success: false, error: 'Review expired; scan again' };
  await button(draw(), 'Delete Reviewed Files').props.onClick();
  assert.equal(requests.at(-1).options.body.get('preview_token'), 'qa-review-token');
  assert.equal(requests.at(-1).options.body.get('execute_cleanup'), 'true');
  assert.ok(text(draw()).includes('Review expired; scan again'));
  assert.equal(
    JSON.stringify(fixture),
    before,
    'controls must not mutate saved media configuration'
  );
  console.log(
    'PASS Media Settings Runtime: six tabs, all settings controls, real handler endpoints, cancelled deletion, reviewed token, API/network failure feedback and released busy states; transport was isolated, no live media was touched.'
  );
}

async function checkRelatedCandidateReliability() {
  const directory = 'src/plugins/von-core/features/plugins/built-in/related-posts/';
  const dates = load('src/utils/dateFormat.ts');
  const matcher = load(directory + 'matcher.ts', React, {
    '../../../../../../utils/dateFormat': dates,
  });
  const pluginRuntime = load('src/utils/pluginRuntime.ts');
  const article = (id, fields = {}) => ({
    ...posts[0],
    id: String(id),
    category: 'Sports',
    views: 0,
    ...fields,
  });
  const current = article('current');
  const localSports = Array.from({ length: 25 }, (_, index) => article(index));
  const localBusiness = localSports.map((post) => ({ ...post, category: 'Business' }));
  const config = { enabled: true, count: 6, orderBy: 'relevance' };
  const response = (values) => ({ ok: true, json: async () => ({ posts: values }) });
  const setup = (base, transport, savedConfig = config, active = true) => {
    const slots = [],
      requests = [];
    let cursor = 0,
      dirty = false,
      effects = [],
      args,
      result;
    const hooks = {
      ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { value: initial };
        return [
          slots[index].value,
          (update) => {
            const next = typeof update === 'function' ? update(slots[index].value) : update;
            if (!Object.is(next, slots[index].value)) {
              slots[index].value = next;
              dirty = true;
            }
          },
        ];
      },
      useEffect(effect, deps) {
        const index = cursor++,
          previous = slots[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
          effects.push(() => {
            previous?.cleanup?.();
            slots[index] = { deps, cleanup: effect() };
          });
        }
      },
    };
    const hook = load(
      'src/hooks/usePlugins.tsx',
      hooks,
      {
        ['../plugins/von-core/features/plugins/built-in/related-posts/matcher']: matcher,
        '../utils/pluginRuntime': pluginRuntime,
        '../config/site.config': { API: { getPosts: `${base}/api/get_posts.php` } },
        '../utils/api': {
          vonFetch: (url, options) => {
            requests.push({ url: new URL(url, 'https://fixture.invalid'), signal: options.signal });
            return transport(requests.at(-1).url, options);
          },
        },
      },
      { URLSearchParams, AbortController }
    );
    const configured = {
      activePlugins: active ? ['vp_related_posts'] : [],
      pluginConfig: { vp_related_posts: savedConfig },
    };
    const draw = (post = args?.[0] || current, candidates = args?.[1] || []) => {
      args = [post, candidates];
      let attempts = 0;
      do {
        assert.ok(attempts++ < 10, 'Related candidate reconciliation must settle');
        cursor = 0;
        dirty = false;
        effects = [];
        result = hook.useRelatedPosts(configured, post, candidates);
        effects.forEach((effect) => effect());
      } while (dirty);
      return result;
    };
    return {
      draw,
      requests,
      get result() {
        return result;
      },
      async flush() {
        await new Promise((resolve) => setImmediate(resolve));
        return draw();
      },
      close() {
        slots.forEach((slot) => slot.cleanup?.());
      },
    };
  };
  let cases = 0;
  for (const base of ['', '/zangetsu']) {
    for (const count of [3, 4, 6, 8]) {
      const fixture = setup(base, async () => response(localSports), { ...config, count });
      fixture.draw(current, localBusiness);
      await fixture.flush();
      assert.equal(
        fixture.requests.length,
        2,
        'Unrelated local rows cannot suppress category retrieval'
      );
      const limit = Math.min(24, Math.max(count * 4, 12));
      assert.ok(
        fixture.requests.every(
          ({ url }) =>
            url.pathname === `${base}/api/get_posts.php` &&
            url.searchParams.get('limit') === String(limit) &&
            url.searchParams.get('public') === '1' &&
            url.searchParams.get('includeTotal') === 'false'
        )
      );
      assert.ok(fixture.result.props.allPosts.every((post) => post.category === 'Sports'));
      fixture.draw();
      assert.equal(fixture.requests.length, 2, 'Unchanged inputs must not refetch');
      fixture.close();
      cases++;
    }
    const complete = setup(base, async () => {
      throw new Error('Unexpected request');
    });
    const completeLocal = localSports.map((post) => ({ ...post, category: ' SPORTS ' }));
    const firstLocalCandidates = complete.draw(current, completeLocal).props.allPosts;
    assert.equal(
      complete.draw(current, completeLocal).props.allPosts,
      firstLocalCandidates,
      'Unrelated renders must retain the candidate array for Random memoization'
    );
    assert.equal(complete.requests.length, 0, 'Complete normalized category coverage stays local');
    complete.close();
    cases++;
    for (const failCategory of [false, true]) {
      for (const failure of ['http', 'network', 'json']) {
        const fixture = setup(base, async (url) => {
          if (url.searchParams.has('category') !== failCategory)
            return response(localSports.slice(0, 6));
          if (failure === 'network') throw new Error('Fixture network failure');
          if (failure === 'json')
            return {
              ok: true,
              json: async () => {
                throw new Error('Fixture JSON failure');
              },
            };
          return { ok: false };
        });
        fixture.draw();
        await fixture.flush();
        assert.equal(
          fixture.result.props.allPosts.length,
          6,
          'Successful companion candidates must survive'
        );
        fixture.close();
        cases++;
      }
    }
    for (const failure of [true, false]) {
      const fixture = setup(base, async () => (failure ? { ok: false } : response([])));
      fixture.draw(current, [
        current,
        article('draft', { status: 'draft' }),
        ...localSports.slice(0, 3),
      ]);
      await fixture.flush();
      if (failure)
        assert.equal(
          Array.from(
            matcher.findRelatedPosts(current, fixture.result.props.allPosts, config),
            (post) => post.id
          ).join(','),
          '0,1,2',
          'Only published non-current local fallback survives total failure'
        );
      else
        assert.equal(
          fixture.result,
          null,
          'An authoritative empty result cannot revive stale local cards'
        );
      fixture.close();
      cases++;
    }
    const missingViews = localSports.map((post) => ({ ...post, views: undefined }));
    const mostViewed = setup(
      base,
      async () => response(localSports.map((post, index) => ({ ...post, views: index + 1 }))),
      { ...config, orderBy: 'views' }
    );
    mostViewed.draw(current, missingViews);
    await mostViewed.flush();
    assert.equal(
      mostViewed.requests.length,
      2,
      'Unknown counters require the existing public candidate fetch'
    );
    assert.equal(
      matcher.findRelatedPosts(current, mostViewed.result.props.allPosts, {
        count: 6,
        orderBy: 'views',
      })[0].id,
      '24'
    );
    mostViewed.close();
    cases++;
    const zeroViews = setup(
      base,
      async () => {
        throw new Error('Unexpected request');
      },
      { ...config, orderBy: 'views' }
    );
    zeroViews.draw(current, localSports);
    assert.equal(zeroViews.requests.length, 0, 'Known zero counters are valid, not missing');
    zeroViews.close();
    cases++;
    const held = [];
    const navigating = setup(
      base,
      (url, options) =>
        new Promise((resolve) => held.push({ url, signal: options.signal, resolve }))
    );
    navigating.draw(article('A', { category: 'A' }));
    navigating.draw(article('B', { category: 'B' }));
    assert.ok(held.slice(0, 2).every((request) => request.signal.aborted));
    held.slice(2).forEach((request) => request.resolve(response([article('B-result')])));
    await navigating.flush();
    held.slice(0, 2).forEach((request) => request.resolve(response([article('A-result')])));
    await navigating.flush();
    assert.equal(
      Array.from(navigating.result.props.allPosts, (post) => post.id).join(','),
      'B-result'
    );
    navigating.close();
    cases++;
    const disabled = setup(
      base,
      async () => {
        throw new Error('Unexpected request');
      },
      config,
      false
    );
    disabled.draw();
    await disabled.flush();
    assert.equal(disabled.result, null);
    assert.equal(disabled.requests.length, 0);
    disabled.close();
    cases++;
  }
  const contentAst = ts.createSourceFile(
    'useContent.ts',
    read('src/hooks/useContent.ts'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let initializer;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(contentAst) === 'getInitialPosts')
      initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(contentAst);
  assert.ok(initializer);
  const context = {
    module: { exports: {} },
    window: { __INITIAL_DATA__: localSports.map((post, index) => ({ ...post, views: index })) },
  };
  vm.runInNewContext(
    ts.transpileModule(`module.exports = ${initializer.getText(contentAst)}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    context
  );
  const hydrated = context.module.exports();
  assert.equal(
    Array.from(hydrated, (post) => post.views).join(','),
    Array.from({ length: 25 }, (_, index) => index).join(','),
    'Real hydration preserves zero/nonzero counters'
  );
  assert.equal(
    matcher.findRelatedPosts(current, hydrated, { count: 6, orderBy: 'views' })[0].id,
    '24'
  );
  console.log(
    `PASS Related Candidate Reliability: ${cases} root/subfolder hook cases cover category coverage, bounded public batches, partial/total failures, authoritative empty data, views, inactive plugins and late navigation; actual hydration preserves counters. Controlled transports/lifecycle, no live requests.`
  );
}

function checkRelatedMemoOwnership() {
  const directory = 'src/plugins/von-core/features/plugins/built-in/related-posts/';
  const dates = load('src/utils/dateFormat.ts');
  const matcher = load(directory + 'matcher.ts', React, {
    '../../../../../../utils/dateFormat': dates,
  });
  let cached,
    calls = 0;
  const hooks = {
    ...React,
    useMemo(factory, deps) {
      if (!cached || deps.some((value, index) => !Object.is(value, cached.deps[index])))
        cached = { value: factory(), deps };
      return cached.value;
    },
  };
  const Component = load(directory + 'RelatedPostsComponent.tsx', hooks, {
    './matcher': {
      findRelatedPosts: (...args) => {
        calls++;
        return matcher.findRelatedPosts(...args);
      },
    },
  }).RelatedPostsComponent;
  const candidates = posts.slice(0, 4).map((post) => ({ ...post }));
  const config = { enabled: true, count: 4, orderBy: 'random', layout: 'grid', showDate: true };
  const currentPost = { ...posts[5] };
  Component({ currentPost, allPosts: candidates, config, settings });
  const original = cached.value.map((post) => post.id).join(',');
  Component({
    currentPost: { ...currentPost, content: 'Unrelated edit' },
    allPosts: candidates,
    config: { ...config, titleText: 'New heading', layout: 'list' },
    settings,
  });
  assert.equal(calls, 1, 'Unrelated UI/config objects must not reshuffle random results');
  assert.equal(cached.value.map((post) => post.id).join(','), original);
  candidates[0].title = 'Updated card title';
  Component({ currentPost, allPosts: candidates, config, settings });
  assert.equal(calls, 2, 'Visible in-place candidate changes must invalidate cards');
  assert.equal(
    cached.value.find((post) => post.id === candidates[0].id)?.title,
    'Updated card title'
  );
  Component({ currentPost, allPosts: candidates, config: { ...config, count: 3 }, settings });
  assert.equal(calls, 3, 'Count changes must refresh the selection');
  assert.equal(cached.value.length, 3);
  Component({
    currentPost: { ...currentPost, category: 'Updated category' },
    allPosts: candidates,
    config,
    settings,
  });
  assert.equal(calls, 4, 'Current-post matching inputs must refresh the selection');
  console.log(
    'PASS Related Memo Ownership: actual random matcher retains order through unrelated renders, refreshes card fields/count/taxonomy and keeps bounded candidates. No live requests.'
  );
}

function checkPortfolioNavigationResolver() {
  const file = 'src/themes/portfolio/Layout.tsx';
  const ast = ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const resolvers = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(ast) === 'handleNavigationItem' &&
      node.initializer
    )
      resolvers.push(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(resolvers.length, 1, 'Portfolio navigation must retain one shared action resolver');
  const code = ts.transpileModule(`module.exports = ${resolvers[0].getText(ast)};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = [];
  const runtime = {
    module: { exports: {} },
    setIsMobileMenuOpen: (value) => calls.push(['menu', value]),
    onBackToHome: () => calls.push(['home']),
    onPageClick: (value) => calls.push(['page', value]),
    onPostClick: (value) => calls.push(['post', value]),
    onCategoryClick: (value) => calls.push(['category', value]),
    pages: [{ id: '91', slug: 'qa-page' }],
    getSameSiteCategoryNavigation: (url) => (url === '/?category=News' ? 'News' : null),
    normalizeSiteUrl: (url) => url,
    window: { location: { href: 'unchanged' } },
  };
  vm.runInNewContext(code, runtime, { filename: file });
  for (const closeMobileMenu of [false, true]) {
    for (const [url, expected] of [
      ['home', ['home']],
      ['page:91', ['page', 'qa-page']],
      ['page:qa-page', ['page', 'qa-page']],
      ['page:unknown', ['page', 'unknown']],
      ['post:17', ['post', '17']],
      ['/?category=News', ['category', 'News']],
      ['https://qa.test/', null],
    ]) {
      calls.length = 0;
      runtime.window.location.href = 'unchanged';
      runtime.module.exports({ url }, closeMobileMenu);
      assert.deepEqual(calls, [
        ...(closeMobileMenu ? [['menu', false]] : []),
        ...(expected ? [expected] : []),
      ]);
      assert.equal(runtime.window.location.href, expected ? 'unchanged' : url);
    }
  }
  console.log(
    'PASS Portfolio Navigation Runtime: 14 desktop/mobile resolver cases preserve home, page ID/slug/fallback, post, category and external delegation. Browser navigation is not exercised.'
  );
}

async function checkDiscoveryRouteFetch() {
  const fixedHooks = {
    ...React,
    useState: (value) => [typeof value === 'function' ? value() : value, noop],
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useCallback: (callback) => callback,
    useEffect: noop,
    useLayoutEffect: noop,
    useEffectEvent: (callback) => callback,
  };
  const captured = [];
  for (const theme of ['prism', 'digest', 'techpress', 'corporate-pro']) {
    const file = `src/themes/${theme}/Layout.tsx`;
    const Component = load(file, fixedHooks).default;
    for (const view of ['home', 'category', 'single-post', 'page', 'profile']) {
      queryCalls.length = 0;
      Component({
        ...base,
        currentView: view,
        selectedPost: posts[0],
        selectedPage: { id: 'p1', title: 'QA page', content: 'QA content' },
        selectedProfile: 'tester',
        selectedCategory: view === 'category' ? 'News' : null,
        isDarkMode: false,
      });
      assert.equal(queryCalls.length, 1, `${theme}/${view} must retain its unconditional Hook`);
      const options = queryCalls[0];
      assert.equal(options.enabled, view === 'home' || view === 'category', `${theme}/${view}`);
      captured.push({ theme, view, options });
    }
  }

  function harness(options, prefix = '') {
    const slots = [],
      effects = [],
      timers = new Map(),
      requests = [],
      held = [];
    let cursor = 0,
      dirty = false,
      result,
      timer = 0,
      hold = false;
    const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
    const memo = (factory, deps) => {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: factory() };
      return slots[i].value;
    };
    const hooks = {
      ...React,
      useState: (initial) => {
        const i = cursor++;
        if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
        return [
          slots[i],
          (next) => {
            const value = typeof next === 'function' ? next(slots[i]) : next;
            if (!Object.is(slots[i], value)) {
              slots[i] = value;
              dirty = true;
            }
          },
        ];
      },
      useRef: (initial) => {
        const i = cursor++;
        if (!(i in slots)) slots[i] = { current: initial };
        return slots[i];
      },
      useMemo: memo,
      useCallback: (callback, deps) => memo(() => callback, deps),
      useEffect: (effect, deps) => {
        const i = cursor++,
          previous = slots[i];
        if (previous && same(previous.deps, deps)) return;
        slots[i] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          slots[i].cleanup = effect();
        });
      },
    };
    const query = new URLSearchParams();
    const response = (url) => ({
      ok: true,
      json: async () => {
        const page = Number(url.searchParams.get('page')),
          limit = Number(url.searchParams.get('limit'));
        return {
          posts: posts.slice((page - 1) * limit, page * limit),
          meta: { page, limit, total: posts.length, hasMore: page * limit < posts.length },
        };
      },
    });
    const hook = load(
      'src/hooks/usePublicPostsQuery.ts',
      hooks,
      {
        'react-router': { useSearchParams: () => [query] },
        '../config/site.config': { API: { getPosts: `${prefix}/api/get_posts.php` } },
        '../utils/siteUtils': { normalizeSiteUrl: (value) => `${prefix}${value}` },
        '../utils/api': {
          vonFetch: async (url, { signal }) => {
            const target = new URL(url, 'https://fixture.invalid');
            requests.push({ url: target, signal });
            return hold
              ? new Promise((resolve) => held.push(() => resolve(response(target))))
              : response(target);
          },
        },
      },
      {
        AbortController,
        URLSearchParams,
        window: {
          setTimeout: (callback) => {
            timers.set(++timer, callback);
            return timer;
          },
          clearTimeout: (id) => timers.delete(id),
        },
      }
    );
    const paint = (next = options) => {
      options = next;
      cursor = 0;
      dirty = false;
      effects.length = 0;
      result = hook.usePublicPostsQuery(options);
      effects.splice(0).forEach((effect) => effect());
    };
    const flush = async () => {
      for (let i = 0; i < 24; i++) {
        await Promise.resolve();
        if (dirty) paint();
      }
      assert.equal(dirty, false, 'Discovery Hook must settle without a render loop');
      return result;
    };
    return {
      paint,
      flush,
      requests,
      get value() {
        return result;
      },
      set hold(value) {
        hold = value;
      },
      searchTick: () => {
        const callbacks = [...timers.values()];
        timers.clear();
        callbacks.forEach((callback) => callback());
      },
      release: () => held.splice(0).forEach((resolve) => resolve()),
    };
  }

  for (const { theme, view, options } of captured) {
    const test = harness(options);
    test.paint();
    await test.flush();
    assert.equal(
      test.requests.length,
      options.enabled ? 1 : 0,
      `${theme}/${view} actual fetch count`
    );
    if (view === 'single-post') {
      const before = { ...options };
      delete before.enabled;
      const control = harness(before);
      control.paint();
      await control.flush();
      assert.equal(
        control.requests.length,
        1,
        `${theme} pre-fix default must reproduce the unused fetch`
      );
    }
  }
  for (const prefix of ['', '/zangetsu']) {
    const initial = { initialPosts: posts, enabled: false, limit: 2, category: null, search: '' };
    const test = harness(initial, prefix);
    test.paint();
    await test.flush();
    assert.equal(test.requests.length, 0);
    test.paint({ ...initial, enabled: true });
    await test.flush();
    assert.equal(test.requests.length, 1);
    assert.equal(test.value.posts.length, 2);
    await test.value.loadMore();
    await test.flush();
    assert.equal(test.requests.length, 2);
    assert.equal(test.value.posts.length, 4);
    assert.equal(test.requests[1].url.searchParams.get('page'), '2');
    test.paint(initial);
    await test.flush();
    assert.equal(test.requests.length, 2);
    test.paint({ ...initial, enabled: true, category: 'News' });
    await test.flush();
    assert.equal(test.requests.at(-1).url.searchParams.get('category'), 'News');
    const previous = test.requests.length;
    test.paint({ ...initial, enabled: true, category: 'News', search: 'QA' });
    await test.flush();
    assert.equal(test.requests.length, previous, 'Search waits for debounce');
    test.searchTick();
    await test.flush();
    assert.equal(test.requests.at(-1).url.searchParams.get('search'), 'QA');
    test.paint(initial);
    await test.flush();
    test.hold = true;
    test.paint({ ...initial, enabled: true });
    await test.flush();
    const inFlight = test.requests.at(-1);
    test.paint(initial);
    await test.flush();
    assert.equal(inFlight.signal.aborted, true, 'Leaving discovery aborts its pending request');
    test.release();
    await test.flush();
    assert.equal(test.value.isLoading, false);
    test.hold = false;
    test.paint({ ...initial, enabled: true });
    await test.flush();
    assert.equal(test.requests.at(-1).url.pathname, `${prefix}/api/get_posts.php`);
    assert.equal(test.value.posts.length, 2);
    assert.equal(test.value.error, null);
  }
  console.log(
    'PASS Theme Discovery Routes: 20 actual layout/Hook cases, four pre-fix counterexamples, root/subfolder return-home, category, debounced search, Load More and pending-request cancellation. React lifecycle simulation; no installed data or requests.'
  );
}

checkRelatedMemoOwnership();
checkPortfolioNavigationResolver();
checkGoogleTrackingRuntime();
checkContentManagerActions();
checkContentManagerExcerpts();
checkCategoryFolderAdvisory();
checkPublicPluginHydration();
checkSettingsPresentation();
checkAdsManager();
checkAdminSettingsReadiness()
  .then(checkNativeCrawlerTracking)
  .then(checkDiscoveryRouteFetch)
  .then(checkRelatedCandidateReliability)
  .then(checkAiSettingsModels)
  .then(checkSettingsDraftLifecycle)
  .then(checkAiKeyStorageUi)
  .then(checkAiKeyRotationUi)
  .then(checkMediaSettingsRuntime)
  .then(checkIndexNowReadOnly)
  .then(checkAnalyticsReadOnly)
  .then(checkPublicProfileArticles)
  .then(checkSettings)
  .then(checkOtherCustomizers)
  .then(checkNewsletterPagination)
  .then(checkNewsletterSaveResult)
  .then(checkAvatarState)
  .then(checkDiscussionPostLinks)
  .then(() => {
    console.log(
      'PASS Theme Maintenance Runtime: global limits, account placeholders, comments, animations, Digest article retention, six independent customizers, legacy appearance migration, public settings projection, and latest-settings draft merge.'
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
