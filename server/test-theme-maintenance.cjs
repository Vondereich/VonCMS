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
function load(file, react = React, mocks = {}, runtime = {}) {
  const module = { exports: {} };
  const proxy = new Proxy(helpers, { get: (object, key) => object[key] ?? Blank });
  const requireMock = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'react') return { __esModule: true, ...react, default: react };
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
    if (name.includes('/utils/') || name.includes('/hooks/')) return proxy;
    return new Proxy({ __esModule: true, default: Blank }, { get: (o, key) => o[key] ?? Blank });
  };
  const code = ts.transpileModule(read(file), {
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

checkSettingsPresentation();
checkAdsManager();
checkSettings()
  .then(checkOtherCustomizers)
  .then(checkNewsletterPagination)
  .then(() => {
    console.log(
      'PASS Theme Maintenance Runtime: global limits, account placeholders, comments, animations, Digest article retention, six independent customizers, legacy appearance migration, public settings projection, and latest-settings draft merge.'
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
