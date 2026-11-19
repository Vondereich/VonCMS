const assert = require('node:assert/strict');

const walk = (node, match) => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => walk(child, match));
  return [...(match(node) ? [node] : []), ...walk(node.props?.children, match)];
};
const text = (node) =>
  typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : Array.isArray(node)
      ? node.map(text).join('')
      : text(node?.props?.children ?? '');

// Real components/Hooks, simulated React lifecycle and transport; never an installed site.
function harness(React) {
  const slots = [];
  let cursor = 0,
    dirty = false,
    effects = [],
    render,
    value;
  const effect = (callback, deps = []) => {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || deps.some((entry, i) => !Object.is(entry, previous.deps[i]))) {
      slots[index] = { deps };
      effects.push(() => {
        previous?.cleanup?.();
        slots[index].cleanup = callback();
      });
    }
  };
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [
        slots[index].value,
        (next) => {
          const resolved = typeof next === 'function' ? next(slots[index].value) : next;
          if (!Object.is(resolved, slots[index].value)) {
            slots[index].value = resolved;
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
    useEffect: effect,
    useLayoutEffect: effect,
    useMemo: (callback) => callback(),
    useCallback: (callback) => callback,
    useEffectEvent: (callback) => callback,
  };
  const draw = (callback = render) => {
    render = callback;
    let attempts = 0;
    do {
      assert.ok(attempts++ < 20, 'Lifecycle must settle');
      cursor = 0;
      dirty = false;
      effects = [];
      value = render();
      effects.forEach((callback) => callback());
    } while (dirty);
    return value;
  };
  return {
    hooks,
    draw,
    get value() {
      return value;
    },
    async flush() {
      for (let i = 0; i < 6; i++) {
        await new Promise(setImmediate);
        if (dirty) draw();
      }
      return value;
    },
    unmount() {
      slots.forEach((slot) => slot.cleanup?.());
    },
  };
}

module.exports = async function checkMaintenance({
  load,
  React,
  shared,
  settings,
  renderToStaticMarkup,
}) {
  const dates = load('src/utils/dateFormat.ts');
  const schedule = load(
    'src/plugins/von-core/features/plugins/built-in/promo-bar/schedule.ts',
    React,
    {
      '../../../../../../utils/dateFormat': dates,
    }
  );
  for (const zone of ['UTC', 'Asia/Kuala_Lumpur', 'America/New_York']) {
    const normalized = schedule.normalizeCampaignSchedule(
      { startsAt: '2099-12-31T09:00', endsAt: '2099-12-31T10:00' },
      zone
    );
    assert.match(normalized.startsAt, /Z$/);
    assert.equal(schedule.campaignDateTimeInput(normalized.startsAt, zone), '2099-12-31T09:00:00');
    assert.ok(Date.parse(normalized.endsAt) > Date.parse(normalized.startsAt));
  }
  for (const raw of ['31/12/2099 09:00', '2099-02-31T09:00', '2099-12-31T25:00', 'garbage']) {
    assert.throws(() => schedule.normalizeCampaignSchedule({ startsAt: raw }, 'UTC'));
  }
  assert.throws(() =>
    schedule.normalizeCampaignSchedule({ startsAt: '2026-03-08T02:30' }, 'America/New_York')
  );
  assert.throws(() =>
    schedule.normalizeCampaignSchedule({
      startsAt: '2099-12-31T10:00Z',
      endsAt: '2099-12-31T09:00Z',
    })
  );
  assert.equal(schedule.normalizeCampaignSchedule({ startsAt: '', endsAt: '' }).startsAt, '');

  class Clock extends Date {
    static now() {
      return Date.parse('2026-11-19T10:05:00Z');
    }
  }
  const sidebar = load(
    'src/plugins/von-core/features/public/components/Sidebar.tsx',
    React,
    {
      '../../../../../utils/siteUtils': { ...dates },
    },
    { Date: Clock },
    '\nexport { formatSidebarFreshness };'
  );
  assert.equal(
    sidebar.formatSidebarFreshness('2026-11-19 10:00:00', { timeZone: 'UTC' }),
    '5 min ago'
  );
  assert.equal(
    sidebar.formatSidebarFreshness('2026-11-19 18:00:00', { timeZone: 'Asia/Kuala_Lumpur' }),
    '5 min ago'
  );
  assert.equal(
    sidebar.formatSidebarFreshness('2026-11-19T10:00:00Z', { timeZone: 'Asia/Kuala_Lumpur' }),
    '5 min ago'
  );

  const comment = {
    id: 'c-1',
    dbId: '1',
    postId: '42',
    content: 'Existing comment',
    username: 'QA',
    replies: [],
  };
  const user = { id: '2', username: 'QA', role: 'Member' };
  let mode = 429,
    auth = 0;
  const csrf = [],
    requests = [];
  const h = harness(React);
  const comments = load(
    'src/hooks/useComments.ts',
    h.hooks,
    {
      '../config/site.config': { API: { saveComments: 'fixture-comments' } },
      '../utils/security': { setCsrfToken: (token) => csrf.push(token) },
      '../utils/api': {
        vonFetch: async (_url, options) => {
          requests.push(JSON.parse(options.body));
          if (mode === 'network') throw new Error('Controlled transport failure');
          return {
            status: mode,
            json: async () => ({
              success: mode === 200,
              id: mode === 200 ? 'c-9' : undefined,
              error: 'QA failure',
            }),
          };
        },
      },
    },
    { console: { ...console, error() {} } }
  ).useComments;
  const draw = () => h.draw(() => comments([comment]));
  for (mode of [429, 403, 401, 'network']) {
    await assert.rejects(draw().handleAddComment('42', 'Keep this draft', user, () => auth++));
    assert.equal(draw().comments.length, 1);
    await assert.rejects(draw().handleReplyComment('c-1', 'Keep this reply', user, () => auth++));
    assert.equal(draw().comments[0].replies.length, 0);
  }
  assert.equal(auth, 2);
  assert.deepEqual(csrf, ['', '']);
  assert.ok(requests.every((request) => request.requireAuth === true));
  mode = 200;
  await draw().handleAddComment('42', 'Working comment', user, () => auth++);
  assert.equal(draw().comments.at(-1).id, 'c-9');
  await assert.rejects(draw().handleReplyComment('missing', 'Keep text', user, () => auth++));

  const ui = harness(React);
  const errors = [];
  let fail = true,
    release;
  const Comments = load(
    'src/plugins/von-core/features/public/components/Comments.tsx',
    ui.hooks,
    {
      'react-hot-toast': {
        __esModule: true,
        default: { error: (message) => errors.push(message) },
      },
    },
    { console: { ...console, error() {} } }
  ).VpComments;
  const props = {
    comments: [comment],
    user,
    settings,
    onLogin() {},
    onLikeComment() {},
    onAddComment: async () => {
      if (fail) throw new Error('Server rejected comment');
      if (release !== undefined)
        await new Promise((resolve) => {
          release = resolve;
        });
    },
    onReplyComment: async () => {
      throw new Error('Server rejected reply');
    },
  };
  const uiDraw = () => ui.draw(() => Comments(props));
  const textarea = () => walk(uiDraw(), (node) => node.type === 'textarea')[0];
  textarea().props.onChange({ target: { value: 'Original draft' } });
  await walk(uiDraw(), (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(textarea().props.value, 'Original draft');
  const draftError = errors.at(-1);
  fail = false;
  release = () => {};
  const saving = walk(uiDraw(), (node) => node.type === 'form')[0].props.onSubmit({
    preventDefault() {},
  });
  textarea().props.onChange({ target: { value: 'New text typed while saving' } });
  release();
  await saving;
  assert.equal(textarea().props.value, 'New text typed while saving');
  assert.equal(draftError, 'Server rejected comment');
  walk(
    uiDraw(),
    (node) => node.type === 'button' && text(node).trim() === 'Reply'
  )[0].props.onClick();
  let replyBox = walk(
    uiDraw(),
    (node) => node.type === 'input' && node.props['aria-label'] === 'Reply'
  )[0];
  replyBox.props.onChange({ target: { value: 'Reply draft' } });
  const replyButton = walk(
    uiDraw(),
    (node) =>
      node.type === 'button' &&
      typeof node.props.onClick === 'function' &&
      text(node).trim() === 'Send'
  )[0];
  await replyButton.props.onClick();
  replyBox = walk(
    uiDraw(),
    (node) => node.type === 'input' && node.props['aria-label'] === 'Reply'
  )[0];
  assert.equal(replyBox.props.value, 'Reply draft');
  assert.equal(errors.at(-1), 'Server rejected reply');

  const manager = harness(React),
    menuCalls = [];
  let menuFails = true;
  const fixtureSettings = { ...settings, _settingsScope: 'admin', _canManageSecrets: true };
  const Manager = load(
    'src/plugins/von-core/features/settings/SettingsManager.tsx',
    manager.hooks,
    {
      '../../../../config/site.config': {
        API: { settings: 'settings', getPosts: 'posts', getPages: 'pages' },
      },
      '../../../../utils/api': {
        vonFetch: async (url, options) => {
          menuCalls.push({ url, options });
          if (url === 'settings') return { ok: true, json: async () => fixtureSettings };
          return {
            ok: !menuFails,
            json: async () =>
              url.startsWith('posts')
                ? { posts: [{ id: '1', title: 'QA menu article' }] }
                : { pages: [{ id: '2', title: 'QA menu Page' }] },
          };
        },
      },
    },
    { AbortController }
  ).default;
  const managerDraw = () =>
    manager.draw(() => Manager({ settings: fixtureSettings, notify() {}, onUpdate() {} }));
  managerDraw();
  await manager.flush();
  assert.equal(menuCalls.length, 1, 'General Settings must not fetch menu lists');
  walk(
    managerDraw(),
    (node) => node.type === 'button' && text(node).trim() === 'Menu'
  )[0].props.onClick();
  managerDraw();
  await manager.flush();
  assert.match(text(managerDraw()), /Menu content could not be loaded/);
  menuFails = false;
  walk(
    managerDraw(),
    (node) => node.type === 'button' && text(node) === 'Retry'
  )[0].props.onClick();
  managerDraw();
  await manager.flush();
  assert.match(text(managerDraw()), /QA menu article/);
  assert.match(text(managerDraw()), /QA menu Page/);
  assert.ok(menuCalls.some(({ url }) => url === 'pages?limit=200&view=menu'));
  assert.ok(menuCalls.some(({ url }) => url === 'posts?limit=20&includeTotal=false'));
  manager.unmount();

  const inbox = harness(React),
    inboxCalls = [];
  let inboxFails = true;
  const Inbox = load(
    'src/pages/admin/contact/ContactSubmissions.tsx',
    inbox.hooks,
    {
      '../../../config/site.config': { API: { contactSubmissions: 'leads' } },
      '../../../utils/api': {
        vonFetch: async (url) => {
          inboxCalls.push(url);
          return {
            ok: !inboxFails,
            json: async () =>
              inboxFails
                ? { success: false, error: 'QA inbox failure' }
                : {
                    success: true,
                    submissions: [
                      {
                        id: 1,
                        form_name: 'QA Form',
                        created_at: '2026-11-19 12:00:00',
                        data: '{"message":"<img src=x onerror=alert(1)>"}',
                      },
                    ],
                    pagination: { total: 21, pages: 2 },
                  },
          };
        },
      },
    },
    { AbortController }
  ).default;
  const inboxDraw = () => inbox.draw(() => Inbox({ onBack() {} }));
  inboxDraw();
  await inbox.flush();
  assert.match(text(inboxDraw()), /QA inbox failure/);
  inboxFails = false;
  walk(inboxDraw(), (node) => node.type === 'button' && text(node) === 'Retry')[0].props.onClick();
  inboxDraw();
  await inbox.flush();
  const markup = renderToStaticMarkup(inboxDraw());
  assert.match(markup, /QA Form/);
  assert.match(markup, /&lt;img/);
  assert.doesNotMatch(markup, /<img\b/);
  walk(inboxDraw(), (node) => node.type === 'button' && text(node) === 'Next')[0].props.onClick();
  inboxDraw();
  await inbox.flush();
  assert.equal(inboxCalls.at(-1), 'leads?page=2&limit=20');
  inbox.unmount();

  const Google = load(
    'src/plugins/von-core/features/settings/components/GoogleSettings.tsx',
    React,
    {
      '../../../../../utils/pluginRuntime': load('src/utils/pluginRuntime.ts'),
    }
  ).GoogleSettings;
  const googleMarkup = (active, enableTracking = true) =>
    renderToStaticMarkup(
      React.createElement(Google, {
        settings: {
          ...settings,
          _canManageSecrets: true,
          activePlugins: active ? ['vp_analytics'] : [],
          analytics: { googleAnalyticsId: 'G-QA123', enableTracking },
        },
        onChange() {},
      })
    );
  assert.match(googleMarkup(false), /PLUGIN INACTIVE/);
  assert.match(googleMarkup(false), /Activate VonAnalytics/);
  assert.match(googleMarkup(true, false), /TRACKING DISABLED/);
  assert.doesNotMatch(googleMarkup(true), /PLUGIN INACTIVE|TRACKING DISABLED/);

  const Home = load(
    'src/themes/default/Layout.tsx',
    React,
    {
      '../shared': new Proxy(
        {
          ...shared,
          usePublicPostsQuery: () => ({ posts: [], total: 0, isLoading: false, hasMore: false }),
        },
        { get: (target, key) => target[key] ?? (() => null) }
      ),
    },
    {},
    '\nexport { HomeView };'
  ).HomeView;
  for (const [activeSearchQuery, selectedCategory, expected] of [
    ['', null, /No articles published yet/],
    ['', 'News', /No articles in this category yet/],
    ['absent', null, /No results found for/],
  ]) {
    const markup = renderToStaticMarkup(
      React.createElement(Home, {
        posts: [],
        settings,
        activeSearchQuery,
        selectedCategory,
        onSearch() {},
        onClearSearch() {},
        onViewPost() {},
        onViewProfile() {},
      })
    );
    assert.match(markup, expected);
    assert.doesNotMatch(markup, /No results found for &quot;&quot;/);
  }
  console.log(
    'PASS Maintenance UI: site-clock ages, schedule validation, failed/stale comment drafts, Menu lazy loading/retry, Contact inbox paging/escaping, GA4 plugin status and real empty states. React/request simulation only.'
  );
};
