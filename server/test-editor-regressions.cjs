const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const noop = () => {};
function compile(code, scope, fileName = 'fixture.ts') {
  const js = ts.transpileModule(code, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
  vm.runInNewContext(js, scope);
}
function load(file, mocks = {}, runtime = {}) {
  const result = { exports: {} };
  compile(read(file), {
    module: result,
    exports: result.exports,
    URL,
    ...runtime,
    require(name) {
      if (name in mocks) return mocks[name];
      return load(path.posix.join(path.posix.dirname(file), name) + '.ts');
    },
  });
  return result.exports;
}
const { getErrorMessage } = load('src/utils/api.ts', { './security': { getCsrfToken: noop } });
for (const [error, expected] of [
  [new Error('Actual error'), 'Actual error'],
  [{ message: 'API error' }, 'API error'],
  [null, 'Fallback'],
  [{ message: 42 }, 'Fallback'],
  [{ message: '' }, 'Fallback'],
]) {
  assert.equal(getErrorMessage(error, 'Fallback'), expected);
}

function handler(file, name, scope) {
  scope.getErrorMessage ??= getErrorMessage;
  const ast = ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
      initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(initializer, `missing actual ${name} handler`);
  compile(`globalThis.actualHandler = ${initializer.getText(ast)};`, scope, file);
  return scope.actualHandler;
}
const helpers = load('src/components/editor/postEditorSaveHelpers.ts', {
  '../../utils/security': { htmlToPlainText: (text) => text || '' },
});

// Editor-only formatting: controlled plain text here; actual sanitizer/browser coverage is separate.
const textHelpersFile = 'src/components/editor/postEditorTextHelpers.ts';
const textMocks = {
  '../../utils/security': { htmlToPlainText: (text) => text || '' },
  '../../utils/textUtils': { decodeEntities: (text) => text },
};
const textHelpers = load(textHelpersFile, textMocks);
assert.equal(
  typeof textHelpers.getPostEditorAutofillText,
  'function',
  'missing editor-only Auto Fill formatter'
);
const fallbackTextModule = { exports: {} };
compile(read(textHelpersFile), {
  module: fallbackTextModule,
  exports: fallbackTextModule.exports,
  Intl: {},
  require(name) {
    return name in textMocks
      ? textMocks[name]
      : load(path.posix.join(path.posix.dirname(textHelpersFile), name) + '.ts');
  },
});
let autoFillCases = 0;
const autoFillSamples = [
  ['Ringkasan tanpa noktah', 160, 'Ringkasan tanpa noktah.'],
  ['Ayat pertama lengkap. ' + 'Sambungan panjang '.repeat(30), 160, 'Ayat pertama lengkap.'],
  [
    'Dr. Ali berkata suhu 3.14 darjah. ' + 'Sambungan '.repeat(40),
    160,
    'Dr. Ali berkata suhu 3.14 darjah.',
  ],
  ['Dia berkata “Baik.”', 160, 'Dia berkata “Baik.”'],
  ['Soalan ini betul?', 160, 'Soalan ini betul?'],
  ['Sumber vitamin C. ' + 'Sambungan panjang '.repeat(30), 160, 'Sumber vitamin C.'],
  ['问候世界。这是后续段落。'.repeat(30), 160, '问候世界。这是后续段落。'.repeat(13)],
  ['Tunggu...', 160, 'Tunggu.'],
  ['Tunggu…', 160, 'Tunggu.'],
  ['Satu dua tiga', 14, 'Satu dua tiga.'],
  ['Satu dua tiga', 13, 'Satu dua.'],
  ['0', 160, '0.'],
  ['   ', 160, ''],
  ['https://example.test/' + 'x'.repeat(220), 160, ''],
  ['x'.repeat(220), 200, ''],
];
for (const formatter of [
  textHelpers.getPostEditorAutofillText,
  fallbackTextModule.exports.getPostEditorAutofillText,
]) {
  for (const [input, limit, expected] of autoFillSamples) {
    const output = formatter(input, limit);
    assert.equal(output, expected, `Auto Fill ${limit}: ${input}`);
    assert.ok(output.length <= limit, 'native textarea UTF-16 limit must hold');
    assert.doesNotMatch(output, /\.{2,}|…/, 'Auto Fill must not append an ellipsis');
    autoFillCases++;
  }
  for (const limit of [160, 200]) {
    const output = formatter('😀 berita '.repeat(80), limit);
    assert.ok(output.length <= limit && output.endsWith('.'));
    assert.ok(!output.includes('\uFFFD') && !/[\uD800-\uDBFF]\.$/.test(output));
    assert.doesNotMatch(output, /\.{2,}|…/);
    autoFillCases++;
  }
  for (const input of [
    'Penjelasan Sdn. Bhd. berkembang di sini tanpa noktah ' + 'lanjutan '.repeat(30),
    'Lihat pautan https://example.test/a?x=1! kemudian ada lagi ' + 'kata '.repeat(30),
  ]) {
    const output = formatter(input, 160);
    assert.ok(output.includes(input.startsWith('Penjelasan') ? 'berkembang' : 'kemudian'));
    assert.ok(output.length <= 160 && output.endsWith('.'));
    assert.doesNotMatch(output, /\.{2,}|…/);
    autoFillCases++;
  }
}
assert.match(textHelpers.getPostEditorCleanText('Existing summary '.repeat(30), 160), /\.\.\.$/);
assert.equal(textHelpers.getPostEditorCleanText('Manual summary...'), 'Manual summary...');
function autoFillButton(file, marker, scope) {
  const ast = ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let click;
  const visit = (node) => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(ast) === 'onClick' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression?.getText(ast).includes(marker)
    )
      click = node.initializer.expression;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(click, 'missing actual Auto Fill button: ' + marker);
  compile(`globalThis.actualAutoFill = ${click.getText(ast)};`, scope, file);
  return scope.actualAutoFill;
}
for (const isPage of [false, true]) {
  for (const field of ['excerpt', 'metaDescription']) {
    for (const content of ['Ayat lengkap. ' + 'Sambungan '.repeat(50), 'x'.repeat(230), '']) {
      let item = {
        id: '88',
        title: isPage ? 'Page' : 'Post',
        content,
        excerpt: 'Manual excerpt...',
        metaDescription: 'Manual meta...',
        keywords: 'sains, teknologi',
      };
      const original = { ...item },
        notices = [];
      const scope = {
        item,
        EXCERPT_RECOMMENDED_MAX_LENGTH: 200,
        getPostEditorCleanText: textHelpers.getPostEditorCleanText,
        getPostEditorAutofillText: textHelpers.getPostEditorAutofillText,
        setItem: (update) => {
          item = update(item);
        },
        notify: { info: (message) => notices.push(message) },
      };
      const file =
        field === 'excerpt'
          ? 'src/components/PostEditor.tsx'
          : 'src/components/editor/PostEditorSeoPanel.tsx';
      const click = autoFillButton(
        file,
        field === 'excerpt' ? 'EXCERPT_RECOMMENDED_MAX_LENGTH' : 'metaDescription: description',
        scope
      );
      assert.deepEqual(item, original, 'manual text must not change before the button is clicked');
      click();
      if (content.startsWith('Ayat')) {
        assert.equal(item[field], 'Ayat lengkap.');
        assert.equal(
          item[field === 'excerpt' ? 'metaDescription' : 'excerpt'],
          original[field === 'excerpt' ? 'metaDescription' : 'excerpt']
        );
      } else {
        assert.deepEqual(item, original, 'no suggestion must preserve existing manual fields');
        assert.equal(notices.length, 1);
      }
      assert.equal(item.content, original.content);
      assert.equal(item.keywords, original.keywords);
      autoFillCases++;
    }
  }
}

// Render the actual desktop publication cell with the real formatter/selection helpers.
// Locale is controlled here; browser overflow/layout remains a separate visual check.
const contentManagerFile = 'src/plugins/von-core/features/content/ContentManager.tsx';
const contentManagerAst = ts.createSourceFile(
  contentManagerFile,
  read(contentManagerFile),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
let publishCell;
function findPublishCell(node) {
  if (
    ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(contentManagerAst) === 'td' &&
    node.getText(contentManagerAst).includes('const publishDateTime =')
  )
    publishCell = node;
  ts.forEachChild(node, findPublishCell);
}
findPublishCell(contentManagerAst);
assert.ok(publishCell, 'missing actual desktop publication cell');
let publicationCases = 0;
for (const locale of ['en-US', 'en-GB', 'ms-MY']) {
  class LocaleDate extends Date {
    toLocaleDateString(_locale, options) {
      return super.toLocaleDateString(locale, options);
    }
    toLocaleTimeString(_locale, options) {
      return super.toLocaleTimeString(locale, options);
    }
  }
  const scope = { Date: LocaleDate, React: require('react') };
  for (const name of ['formatDateTime', 'formatCompactDateTime', 'getPublishDateTime'])
    scope[name] = handler(contentManagerFile, name, scope);
  compile(
    `globalThis.renderPublication = (item => ${publishCell.getText(contentManagerAst)});`,
    scope,
    contentManagerFile
  );
  const { renderToStaticMarkup } = require('react-dom/server');
  for (const time of ['02:27', '13:17', '08:16', '12:40', '22:39', '13:00', '14:00']) {
    const timestamp = `2026-10-21 ${time}:00`;
    const selected = scope.formatCompactDateTime(timestamp);
    const html = renderToStaticMarkup(
      scope.renderPublication({ status: 'published', published_at: timestamp })
    );
    const date = new LocaleDate(timestamp.replace(' ', 'T'));
    assert.equal(
      selected.time,
      date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    );
    assert.equal(
      selected.date,
      date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    );
    if (locale === 'en-US')
      assert.match(selected.time, /[AP]M$/, '12-hour day period must remain visible');
    assert.ok(html.includes(`<span class="block">${selected.date}</span>`));
    assert.ok(html.includes(`<span class="block tabular-nums">${selected.time}</span>`));
    assert.ok(html.includes(`title="Publish at ${scope.formatDateTime(timestamp)}"`));
    assert.ok(html.includes('aria-label="Publish at '));
    assert.doesNotMatch(html, /truncate|text-overflow|\.\.\.|…/);
    publicationCases++;
  }
  const scheduled = {
    status: 'scheduled',
    scheduled_at: '2026-12-01 14:00:00',
    published_at: '2026-10-01 01:00:00',
  };
  assert.equal(scope.getPublishDateTime(scheduled), scheduled.scheduled_at);
  assert.ok(
    renderToStaticMarkup(scope.renderPublication(scheduled)).includes(
      scope.formatCompactDateTime(scheduled.scheduled_at).time
    )
  );
  for (const status of ['draft', 'pending_review'])
    assert.match(renderToStaticMarkup(scope.renderPublication({ status })), />-<\/td>$/);
  for (const value of [undefined, '', 'invalid-date']) {
    const parts = scope.formatCompactDateTime(value);
    assert.equal(parts.date, value || '-');
    assert.equal(parts.time, '');
  }
}
const links = load('src/components/editor/editorLinkUtils.ts');
for (const input of [
  'https://',
  'http://',
  'https://#only',
  'https://?query',
  'https://bad host',
  'javascript:alert(1)',
  '//evil.test',
  '/\\evil.test',
]) {
  assert.equal(links.normalizeEditorUrl(input), '');
}
for (const input of [
  'https://example.test/a?empty=&x=2#end',
  'http://localhost:5186/test',
  '/zangetsu/0001',
  '#anchor',
  'mailto:qa@example.test',
  'tel:+60123456789',
]) {
  assert.equal(links.normalizeEditorUrl(input), input);
}
assert.equal(links.normalizeEditorUrl('example.test/path'), 'https://example.test/path');

// Run the real raw-DOM sync handler. The clone has one authored break and two view-only nodes.
let removed = 0;
let serialized;
const contentClone = {
  querySelectorAll(selector) {
    assert.equal(selector, 'br.ProseMirror-trailingBreak, img.ProseMirror-separator');
    return [{ remove: () => removed++ }, { remove: () => removed++ }];
  },
  get innerHTML() {
    return removed === 2 ? '<p>A<br>B</p><p></p>' : '<p>A<br>B</p><p><br></p>';
  },
};
const sync = handler('src/components/Editor.tsx', 'syncEditorFromDom', {
  editor: { commands: { setContent: (html) => (serialized = html) } },
  getEditorRoot: () => ({ cloneNode: () => contentClone }),
  getCurrentEditorHtml: () => '',
  sanitizeEditorHtml: (html) => html,
  queueChange: (html) => assert.equal(html, serialized),
});
sync();
assert.equal(
  serialized,
  '<p>A<br>B</p><p></p>',
  'authored BR must survive; only view placeholders are stripped'
);

class Element {
  constructor(image) {
    this.image = image;
  }
  matches() {
    return false;
  }
  querySelector() {
    return this.image;
  }
  getAttribute(name) {
    return name === 'data-id' ? '1682' : 'same-image.png';
  }
}
const first = new Element();
const second = new Element();
let positionedNode = new Element(second);
let selected;
const refresh = handler('src/components/Editor.tsx', 'refreshSelectedImage', {
  HTMLElement: Element,
  requestAnimationFrame: (fn) => fn(),
  editor: {
    view: {
      nodeDOM: (pos) => {
        assert.equal(pos, 17);
        return positionedNode;
      },
    },
  },
  getEditorRoot: () => ({ querySelectorAll: () => [first, second] }),
  setSelectedImage: (image) => (selected = image),
  onImageClickInternal: (image) => (selected = image),
});
refresh(second, 17);
assert.equal(
  selected,
  second,
  'refresh must keep the selected duplicate, not the first ID/src match'
);
positionedNode = null;
refresh(second, 17);
assert.equal(selected, null, 'a missing positioned image must not select another duplicate');
let refreshedPosition;
const chain = { setNodeSelection: () => chain, updateAttributes: () => chain, run: noop };
handler('src/components/Editor.tsx', 'updateSelectedImageAttributes', {
  editor: { chain: () => chain },
  findLegacyImageMatch: () => ({ pos: 17, attrs: {} }),
  refreshSelectedImage: (_, pos) => (refreshedPosition = pos),
  setSelectedImage: noop,
})(second, () => ({ alt: 'Second' }));
assert.equal(refreshedPosition, 17);

async function saveCase(isPage, isAutoSave, edited) {
  const original = {
    id: '87',
    title: 'Before',
    content: 'BEFORE REQUEST',
    status: 'draft',
    slug: 'before',
    updated_at: 'old',
  };
  let resolve;
  const requests = [];
  const scope = {
    ...helpers,
    item: original,
    initialItem: original,
    state: original,
    isPage,
    normalizedRoleIsReviewer: false,
    itemRef: { current: original },
    initialItemRef: { current: original },
    contentRef: { current: original.content },
    isSavingRef: { current: false },
    addToMenuRef: { current: false },
    initialAddToMenuRef: { current: false },
    saveStatusResetRef: { current: null },
    mountedRef: { current: true },
    onSave(item) {
      requests.push(item);
      return new Promise((done) => (resolve = done));
    },
    setItem(updater) {
      scope.state = updater(scope.state);
    },
    setIsSaving: noop,
    setSaveStatus: (value) => (scope.status = value),
    setSaveError: noop,
    onDirtyChange: (value) => (scope.dirty = value),
    loadAuditLogs: async () => {},
    setLastSaved: noop,
    htmlToPlainText: (value) => value,
    sanitizeEditorHtml: (value) => value,
    trimTrailingHtml: (value) => value,
    notify: { loading: noop, success: noop, dismiss: noop, error: noop },
    window: { clearTimeout: noop, setTimeout: () => 1 },
    console,
  };
  const save = handler('src/components/PostEditor.tsx', 'handleSave', scope);
  const pending = save(undefined, isAutoSave);
  assert.equal(requests[0].content, 'BEFORE REQUEST');
  if (edited) {
    scope.contentRef.current = 'TYPED WHILE SAVING';
    scope.state = {
      ...original,
      title: 'New title',
      excerpt: 'New excerpt',
      slug: 'new-slug',
      content: scope.contentRef.current,
    };
    scope.itemRef.current = scope.state;
    scope.addToMenuRef.current = true;
  }
  resolve({ id: '87', status: 'draft', updated_at: 'server-version-2' });
  await pending;
  assert.equal(scope.state.content, edited ? 'TYPED WHILE SAVING' : original.content);
  assert.equal(scope.contentRef.current, scope.state.content);
  assert.equal(scope.state.title, edited ? 'New title' : 'Before');
  assert.equal(scope.state.updated_at, 'server-version-2');
  assert.equal(
    scope.initialItemRef.current.content,
    original.content,
    'baseline must describe the persisted snapshot, not unsaved typing'
  );
  assert.equal(scope.dirty, edited);
  assert.equal(scope.status, edited ? 'idle' : 'saved');
  assert.equal(scope.isSavingRef.current, false);
  if (edited) {
    const candidate = helpers.buildAutoSaveCandidate(
      scope.itemRef.current,
      scope.initialItemRef.current,
      scope.contentRef.current
    );
    assert.equal(candidate.isChanged, true);
    assert.equal(candidate.currentItem.content, 'TYPED WHILE SAVING');
  }
}
async function checkSaveErrors() {
  const reason = 'Upload the image through the Media Library before saving.';
  assert.equal(helpers.buildSaveStatusLabel('error', null, 60, reason), `Save failed: ${reason}`);
  assert.equal(helpers.buildSaveStatusLabel('error', null, 60, ''), 'Save failed. Try again.');
  for (const isPage of [false, true]) {
    for (const isAutoSave of [false, true]) {
      for (const { error, expectedReason, conflict } of [
        { error: new Error(reason), expectedReason: reason, conflict: false },
        { error: { status: 409 }, expectedReason: helpers.SAVE_CONFLICT_MESSAGE, conflict: true },
        {
          error: { message: 'Content changed in another tab. Reload before saving again.' },
          expectedReason: helpers.SAVE_CONFLICT_MESSAGE,
          conflict: true,
        },
        { error: { status: '409', message: 123 }, expectedReason: '', conflict: false },
        { error: null, expectedReason: '', conflict: false },
      ]) {
        const original = { id: '87', title: 'Draft', content: 'UNSAVED TEXT', status: 'draft' };
        const notices = [];
        const cleared = [];
        let rejectSave = true;
        const scope = {
          ...helpers,
          item: original,
          initialItem: original,
          isPage,
          normalizedRoleIsReviewer: false,
          itemRef: { current: original },
          initialItemRef: { current: original },
          contentRef: { current: original.content },
          isSavingRef: { current: false },
          addToMenuRef: { current: false },
          initialAddToMenuRef: { current: false },
          saveStatusResetRef: { current: 41 },
          mountedRef: { current: true },
          onSave: async () => {
            if (rejectSave) throw error;
            return { ...original, updated_at: 'retry-saved' };
          },
          setItem: noop,
          setIsSaving: noop,
          setSaveStatus: (value) => (scope.status = value),
          setSaveError: (value) => (scope.reason = value),
          setLastSaved: () => (scope.saved = true),
          onDirtyChange: noop,
          loadAuditLogs: async () => {},
          htmlToPlainText: (value) => value,
          sanitizeEditorHtml: (value) => value,
          trimTrailingHtml: (value) => value,
          notify: { loading: noop, dismiss: noop, success: noop, error: (v) => notices.push(v) },
          window: { clearTimeout: (id) => cleared.push(id), setTimeout: () => 42 },
          console: { error: noop },
        };
        const save = handler('src/components/PostEditor.tsx', 'handleSave', scope);
        assert.equal(await save(undefined, isAutoSave), null);
        assert.equal(scope.status, 'error');
        assert.equal(scope.reason, expectedReason);
        assert.equal(scope.contentRef.current, original.content);
        assert.equal(scope.initialItemRef.current, original);
        assert.equal(scope.saved, undefined);
        assert.equal(scope.isSavingRef.current, false);
        assert.ok(cleared.includes(41), 'an old success timer must not erase this failure');
        if (isAutoSave && !conflict) assert.equal(notices.length, 0);
        if (conflict) assert.ok(notices.includes(helpers.SAVE_CONFLICT_MESSAGE));
        rejectSave = false;
        await save(undefined, isAutoSave);
        assert.equal(scope.reason, '');
        assert.equal(scope.status, 'saved');
      }
    }
  }
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const ast = ts.createSourceFile(
    'PostEditor.tsx',
    read('src/components/PostEditor.tsx'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let statusNode;
  function visit(node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(ast) === 'p' &&
      node.getText(ast).includes('{saveStatusLabel}')
    )
      statusNode = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(statusNode);
  const scope = {
    React,
    saveStatus: 'error',
    saveStatusClassName: 'text-xs',
    saveStatusLabel: '<img src=x onerror=bad()>',
  };
  compile(`globalThis.markup = ${statusNode.getText(ast)};`, scope, 'fixture.tsx');
  const html = renderToStaticMarkup(scope.markup);
  assert.ok(html.includes('role="alert"'));
  assert.ok(!html.includes('truncate'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
}
async function checkWrapperRecovery() {
  for (const isPage of [false, true]) {
    for (const local of [false, true]) {
      const original = { id: '87', title: 'Before', content: 'BEFORE REQUEST', status: 'draft' };
      const slots = [];
      const pending = [];
      let cursor = 0;
      let effects = [];
      let dirty = false;
      let query = `type=${isPage ? 'page' : 'post'}&id=87`;
      const same = (a, b) =>
        a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
      const hooks = {
        useState(initial) {
          const i = cursor++;
          if (!(i in slots)) slots[i] = { value: initial };
          return [
            slots[i].value,
            (next) => {
              const value = typeof next === 'function' ? next(slots[i].value) : next;
              if (!Object.is(value, slots[i].value)) {
                slots[i].value = value;
                dirty = true;
              }
            },
          ];
        },
        useRef(initial) {
          const i = cursor++;
          if (!(i in slots)) slots[i] = { current: initial };
          return slots[i];
        },
        useMemo(fn, deps) {
          const i = cursor++;
          if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps };
          return slots[i].value;
        },
        useEffect(effect, deps) {
          const i = cursor++;
          const previous = slots[i];
          if (!previous || !same(previous.deps, deps))
            effects.push(() => {
              previous?.cleanup?.();
              slots[i] = { deps, cleanup: effect() };
            });
        },
      };
      const props = {
        editingItem: null,
        isPage,
        user: { role: 'admin', username: 'QA' },
        posts: !isPage && local ? [original] : [],
        pages: isPage && local ? [original] : [],
        navigation: [],
        settings: {},
        handleSaveContent: noop,
        handleUpdateSettings: noop,
      };
      const Wrapper = handler('src/App.tsx', 'PostEditorWrapper', {
        ...hooks,
        useLayoutEffect: hooks.useEffect,
        React: {
          createElement: (type, props) => ({ type, props }),
          useCallback: (callback, deps) => hooks.useMemo(() => callback, deps),
        },
        PostEditor: 'actual-editor',
        Navigate: 'navigate',
        useNavigate: () => noop,
        useSearchParams: () => [new URLSearchParams(query)],
        useLocation: () => ({ state: null }),
        createEmptyEditorItem: () => ({ id: '', title: '', content: '', status: 'draft' }),
        vonFetch: (url) => new Promise((resolve) => pending.push({ url, resolve })),
        API: { getPages: '/get_pages.php', getPost: '/get_post.php' },
        window: { scrollTo: noop, addEventListener: noop, removeEventListener: noop },
        document: { addEventListener: noop, removeEventListener: noop },
        console,
      });
      const draw = () => {
        let output;
        let turns = 0;
        do {
          assert.ok(turns++ < 20, 'actual wrapper recovery must settle');
          cursor = 0;
          effects = [];
          dirty = false;
          output = Wrapper(props);
          effects.forEach((fn) => fn());
        } while (dirty);
        return output;
      };
      let tree = draw();
      if (!local) {
        assert.equal(tree, null);
        assert.equal(pending.length, 1);
        pending[0].resolve({
          json: async () => ({ success: true, post: original, pages: [original] }),
        });
        for (let i = 0; i < 8; i++) await Promise.resolve();
        tree = draw();
      }
      const seed = tree.props.initialItem;
      const complete = tree.props.initialItemIsComplete;
      assert.equal(seed.content, original.content);
      const saved = { ...original, updated_at: 'server-v2' };
      if (isPage) props.pages = [saved];
      else props.posts = [saved];
      tree = draw();
      assert.equal(
        tree.props.initialItem,
        seed,
        'same-item collection updates after autosave must not reset the active editor seed'
      );
      assert.equal(
        tree.props.initialItemIsComplete,
        complete,
        'collection updates must not restart a completed full-content restore'
      );
      assert.equal(
        pending.length,
        local ? 0 : 1,
        'saved collection refresh must not refetch the active draft'
      );

      const next = { ...original, id: '88', content: 'NEXT ITEM' };
      props.posts = [next];
      props.pages = [next];
      query = `type=${isPage ? 'page' : 'post'}&id=88`;
      tree = draw();
      assert.equal(tree.props.initialItem, next, 'a different ID must still initialize normally');
      const otherType = { ...next, content: 'OTHER TYPE SAME ID' };
      if (isPage) props.posts = [otherType];
      else props.pages = [otherType];
      query = `type=${isPage ? 'post' : 'page'}&id=88`;
      tree = draw();
      assert.equal(tree.props.initialItem, otherType, 'post/page identity must not collide');
      const activeQuery = query;
      const activeSeed = tree.props.initialItem;
      const previousRequests = pending.length;
      query = `type=${isPage ? 'post' : 'page'}&id=999`;
      assert.equal(draw(), null, 'an unlisted item starts an API recovery');
      assert.equal(pending.length, previousRequests + 1);
      const cancelledRequest = pending.at(-1);
      query = activeQuery;
      tree = draw();
      assert.ok(tree, 'Back during replacement recovery must not leave an empty editor');
      assert.equal(tree.props.initialItem, activeSeed);
      const lateItem = { ...original, id: '999', content: 'CANCELLED RECOVERY' };
      cancelledRequest.resolve({
        json: async () => ({ success: true, post: lateItem, pages: [lateItem] }),
      });
      for (let i = 0; i < 8; i++) await Promise.resolve();
      assert.equal(
        draw().props.initialItem,
        activeSeed,
        'cancelled recovery must not replace the returned editor'
      );
      query = `type=${isPage ? 'post' : 'page'}`;
      tree = draw();
      assert.equal(tree.props.initialItem.id, '', 'new-item URLs must clear recovered ownership');
    }
  }
}

async function checkContactReceipts() {
  for (const result of [
    { success: true, message: 'Your message has been received. Please do not send it again.' },
    { success: true, message: 'Configured sent message' },
    { success: true },
    { success: false, message: 'Try again later' },
  ]) {
    let view,
      message,
      cleared = false,
      submitted;
    const form = {
      id: 'qa',
      messages: { success: 'Legacy sent message', error: 'Configured error' },
    };
    const submit = handler('src/components/ContactFormRenderer.tsx', 'handleSubmit', {
      form,
      antiBotChallenge: { field: 'qa-trap', token: 'fixture-only' },
      formData: { message: 'Literal x<y &amp;' },
      honeypot: '',
      API: { submitContact: '/qa/contact' },
      vonFetch: async (_url, request) => {
        submitted = JSON.parse(request.body);
        return { json: async () => result };
      },
      setViewState: (next) => {
        view = next;
      },
      setMessage: (next) => {
        message = next;
      },
      setFormData: () => {
        cleared = true;
      },
    });
    await submit({ preventDefault() {} });
    assert.equal(view, result.success ? 'success' : 'error');
    assert.equal(
      message,
      result.message || (result.success ? form.messages.success : form.messages.error)
    );
    assert.equal(cleared, result.success);
    assert.equal(submitted.data.message, 'Literal x<y &amp;');
  }
  let notice;
  const save = handler('src/pages/admin/ContactManager.tsx', 'handleSave', {
    currentForm: { id: 'qa' },
    setLoading() {},
    API: { saveContactForm: '/qa/save' },
    getAuthHeader: () => '',
    vonFetch: async () => ({
      json: async () => ({ success: false, error: 'Invalid recipient QA' }),
    }),
    toast: {
      error: (text) => {
        notice = text;
      },
    },
  });
  await save();
  assert.equal(notice, 'Invalid recipient QA');
}

async function checkInstallerErrors() {
  for (const result of [
    { success: false, error: 'Installation requires the PHP DOM extension.' },
    { success: false, message: 'Existing installer validation message' },
    { success: false },
  ]) {
    let shownError;
    let loading;
    const install = handler(
      'src/plugins/von-core/features/setup/InstallWizard.tsx',
      'handleInstall',
      {
        formData: { adminPass: 'Qa1!Password', setupKey: 'fixture-only' },
        adminPassConfirm: 'Qa1!Password',
        validatePassword: () => [],
        setPasswordErrors: noop,
        setError: (message) => {
          shownError = message;
        },
        setLoading: (value) => {
          loading = value;
        },
        setInstallWarnings: noop,
        API: { install: '/qa/install' },
        vonFetch: async () => ({ json: async () => result }),
        setStep: () => {
          throw new Error('Failed installation must not advance.');
        },
      }
    );
    await install({ preventDefault: noop });
    assert.equal(shownError, result.message || result.error || 'Installation failed.');
    assert.equal(loading, false);
  }
  console.log(
    'PASS Installer error handlers: API error/message and fallback remain visible without advancing setup.'
  );
}

// Source-extracted callbacks exercise the real owners without a CMS account or filesystem writes.
function actualEffect(file, marker, scope) {
  const source = read(file);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === 'useEffect' &&
      node.arguments[0]?.getText(ast).includes(marker)
    )
      callback = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback, `missing effect: ${marker}`);
  compile(`globalThis.actualEffect = ${callback.getText(ast)};`, scope, file);
  return scope.actualEffect;
}

function checkLightboxSwipes() {
  const file = 'src/components/GlobalLightbox.tsx';
  for (const [x, y, count, expected] of [
    [-100, 0, 2, 'next'],
    [100, 0, 2, 'prev'],
    [10, 0, 2, 'none'],
    [-100, 100, 2, 'none'],
    [-100, 0, 1, 'none'],
  ]) {
    let called = 'none';
    const scope = {
      touchStartRef: { current: { x: 0, y: 0 } },
      gallery: Array(count),
      SWIPE_THRESHOLD_PX: handler(file, 'SWIPE_THRESHOLD_PX', {}),
      SWIPE_VERTICAL_TOLERANCE_PX: handler(file, 'SWIPE_VERTICAL_TOLERANCE_PX', {}),
      next: () => {
        called = 'next';
      },
      prev: () => {
        called = 'prev';
      },
    };
    handler(file, 'handleTouchEnd', scope)({ changedTouches: [{ clientX: x, clientY: y }] });
    assert.equal(called, expected);
    assert.equal(scope.touchStartRef.current, null);
  }
}

function checkTypedContracts() {
  const fixture = path.join(root, 'src', '__quality_type_fixture__.ts');
  const source = `
import type { SiteSettings, SettingsFieldChange, SqlResult, PluginDefinition } from './types';
import type { AISummaryConfig } from './plugins/von-core/features/plugins/built-in/ai-summary/types';
declare const change: SettingsFieldChange<SiteSettings>;
change('postsPerPage', 20);
change('registrationEnabled', false);
// @ts-expect-error Numeric settings must reject text.
change('postsPerPage', 'twenty');
// @ts-expect-error Unknown settings keys must be rejected.
change('notASetting', true);
declare const ads: SettingsFieldChange<SiteSettings['ads']>;
ads('popupEnabled', true);
// @ts-expect-error An ad flag must not accept the string false.
ads('popupEnabled', 'false');
declare const summary: PluginDefinition<AISummaryConfig>;
summary.render('post_after', { enabled: true, maxBullets: 5, extractMethod: 'hybrid', showLabel: true, labelText: 'Summary', position: 'top' });
// @ts-expect-error Plugin locations are bounded.
summary.render('unknown_slot');
// @ts-expect-error SQL table cells are scalars/null, not arbitrary objects.
const invalidSql: SqlResult = { success: true, data: [[{ unsafe: true }]] };
`;
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const host = ts.createCompilerHost(parsed.options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (file) => (path.resolve(file) === fixture ? source : readFile(file));
  host.fileExists = (file) => path.resolve(file) === fixture || fileExists(file);
  const program = ts.createProgram(
    [...parsed.fileNames, fixture],
    { ...parsed.options, noEmit: true },
    host
  );
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file && path.resolve(diagnostic.file.fileName) === fixture);
  assert.equal(
    errors.length,
    0,
    errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n')
  );
  console.log(
    'PASS Type Contracts: Settings keys/values, plugin slots and SQL cell shapes reject invalid calls. Compiler fixture is memory-only.'
  );
}

async function checkPublicRouteEffects() {
  for (const kind of ['Post', 'Page']) {
    const slots = [];
    let cursor = 0,
      pending = [],
      dirty = false;
    const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
    const hooks = {
      useState(initial) {
        const index = cursor++;
        const slot = (slots[index] ||= {
          value: typeof initial === 'function' ? initial() : initial,
        });
        return [
          slot.value,
          (next) => {
            const value = typeof next === 'function' ? next(slot.value) : next;
            if (!Object.is(value, slot.value)) {
              slot.value = value;
              dirty = true;
            }
          },
        ];
      },
      useRef(initial) {
        return (slots[cursor++] ||= { current: initial });
      },
      useEffectEvent(callback) {
        const index = cursor++;
        const slot = (slots[index] ||= { event: true, committed: callback });
        slot.pending = callback;
        slot.invoke ||= (...args) => slot.committed(...args);
        return slot.invoke;
      },
      useEffect(callback, deps) {
        const index = cursor++;
        const slot = (slots[index] ||= {});
        if (!same(slot.deps, deps)) {
          slot.deps = deps;
          pending.push(() => {
            slot.cleanup?.();
            slot.cleanup = callback();
          });
        }
      },
    };
    const requests = [];
    const runtimeWindow = {};
    const module = load(
      `src/hooks/useSingle${kind}.ts`,
      {
        react: hooks,
        '../config/site.config': { API: { getPost: '/fixture/post', getPages: '/fixture/pages' } },
        '../utils/api': {
          vonFetch: (url, options) =>
            new Promise((resolve) => requests.push({ url, signal: options.signal, resolve })),
        },
      },
      { window: runtimeWindow, AbortController, console: { error: noop } }
    );
    let args = ['42', null, true];
    const draw = () => {
      let result,
        renders = 0;
      do {
        dirty = false;
        cursor = 0;
        pending = [];
        result = module[`useSingle${kind}`](...args);
        slots
          .filter((slot) => slot?.event)
          .forEach((slot) => {
            slot.committed = slot.pending;
          });
        pending.forEach((effect) => effect());
        assert(++renders < 15, 'Public route effects must settle without a render/request loop');
      } while (dirty);
      return result;
    };
    const settle = async (request, id) => {
      const record = { id, title: `Record ${id}`, slug: `record-${id}`, status: 'published' };
      request.resolve({
        ok: true,
        json: async () =>
          kind === 'Post' ? { success: true, post: record } : { success: true, pages: [record] },
      });
      for (let tick = 0; tick < 6; tick++) await Promise.resolve();
      return draw();
    };
    assert.equal(draw().isLoading, true);
    assert.equal(requests.length, 1);
    args = ['43', null, true];
    draw();
    assert.equal(requests[0].signal.aborted, true, 'The previous route must be aborted');
    const stale = await settle(requests[0], '42');
    assert.notEqual(stale[`full${kind}`]?.id, '42', 'A late response must not adopt the old route');
    const current = await settle(requests[1], '43');
    assert.equal(current[`full${kind}`].id, '43');
    assert.equal(current.isLoading, false);
    draw();
    assert.equal(requests.length, 2, 'Adopting a response must not refetch it');
    args = ['43', null, false];
    assert.equal(draw()[`full${kind}`], null);
    args = ['43', null, true];
    draw();
    assert.equal(requests.length, 3, 'Re-entering after disable must resolve fresh content');
    await settle(requests[2], '43');
    assert.equal(draw()[`full${kind}`].id, '43');
    slots.forEach((slot) => slot.cleanup?.());
  }
  console.log(
    'PASS Public Route Effect Ownership: actual post/page hooks abort old routes, reject late responses, settle without repeated fetches and refresh after re-entry. Committed Effect Events use a controlled Hook fixture, not an installed site.'
  );
}

async function checkLatestAutosave() {
  const file = 'src/components/PostEditor.tsx';
  const calls = [];
  let timer, nextSave;
  const useEffectEvent = (callback) => {
    nextSave = callback;
    return (...args) => nextSave(...args);
  };
  const page = { id: 'qa-page', title: 'QA', content: 'Changed', status: 'draft' };
  const first = {
    useEffectEvent,
    handleSave: async () => calls.push('old settings'),
    getAutoSaveCandidate: () => ({
      currentItem: page,
      isChanged: true,
      hasMeaningfulData: true,
      canAutoSave: true,
    }),
    refreshAutoSaveCountdown: () => 0,
    scheduleNextAutoSave: noop,
    isSavingRef: { current: false },
    setInterval: (callback) => {
      timer = callback;
      return 1;
    },
    clearInterval: noop,
    document: { addEventListener: noop, removeEventListener: noop, visibilityState: 'visible' },
  };
  first.autoSaveLatest = handler(file, 'autoSaveLatest', first);
  const cleanup = actualEffect(file, 'setInterval', first)();
  await timer();
  // Re-render commits a fresh save callback; the original timer stays mounted.
  handler(file, 'autoSaveLatest', {
    useEffectEvent,
    handleSave: async () => calls.push('latest settings'),
  });
  await timer();
  assert.deepEqual(calls, ['old settings', 'latest settings']);
  first.isSavingRef.current = true;
  await timer();
  assert.equal(calls.length, 2, 'in-flight saves must not overlap');
  cleanup();
}

async function checkMediaDraftOwnership() {
  const file = 'src/plugins/von-core/features/media/MediaManager.tsx';
  const item = { id: 'qa-image', altText: 'Original', caption: '', description: '' };
  let draft = { id: '', alt: '', caption: '', desc: '' };
  const scope = {
    selectedItems: new Set(),
    lightboxIndex: 0,
    media: [item],
    setEditMeta: (update) => {
      draft = typeof update === 'function' ? update(draft) : update;
    },
  };
  const sync = actualEffect(file, 'setEditMeta', scope);
  sync();
  assert.equal(draft.id, item.id, 'no checkbox selection must still open the lightbox draft');
  draft = { ...draft, alt: 'Submitted' };
  let resolveSave, savedBody;
  const save = handler(file, 'handleUpdateMeta', {
    editMeta: draft,
    setMetaLoading: noop,
    setSaveSuccess: noop,
    setTimeout: noop,
    API: { updateMedia: '/fixture/update' },
    toast: { success: noop, error: noop },
    console,
    vonFetch: async (_url, options) => {
      savedBody = JSON.parse(options.body);
      return new Promise((resolve) => {
        resolveSave = resolve;
      });
    },
    setMedia: (update) => {
      scope.media = update(scope.media);
    },
  });
  const pending = save();
  draft = { ...draft, alt: 'Newer typing' };
  resolveSave({ json: async () => ({ success: true }) });
  await pending;
  sync();
  assert.equal(savedBody.alt_text, 'Submitted');
  assert.equal(scope.media[0].altText, 'Submitted');
  assert.equal(draft.id, item.id);
  assert.equal(draft.alt, 'Newer typing', 'save reconciliation must not clear later edits');
  // Same-size result list with a new identity must initialize a different draft.
  scope.media = [{ ...item, id: 'other-image', altText: 'Other' }];
  sync();
  assert.equal(draft.id, 'other-image');
  assert.equal(draft.alt, 'Other');
  scope.lightboxIndex = null;
  sync();
  assert.equal(draft.id, '', 'closing an unselected lightbox clears ownership');
}

async function checkSecurityRefreshQuery() {
  const file = 'src/plugins/von-core/features/security/SecurityDashboard.tsx';
  const requests = [];
  const pending = [];
  const shared = {
    fetchInFlightRef: { current: false },
    pendingFetchRef: { current: null },
    statsFetchedAtRef: { current: 0 },
    setRefreshing: noop,
    setLoading: noop,
    setLogs: noop,
    setTotalPages: noop,
    setTotalItems: noop,
    setStats: noop,
    API: { securityLogs: '/fixture/logs' },
    SECURITY_STATS_TTL_MS: 60000,
    URLSearchParams,
    console,
    toast: { error: noop },
    vonFetch: (url) => {
      requests.push(new URL(url, 'https://fixture.invalid'));
      return new Promise((resolve) => pending.push(resolve));
    },
  };
  function render(page, filterType, filterSeverity, searchQuery) {
    const scope = { ...shared, page, filterType, filterSeverity, searchQuery };
    const fetch = handler(file, 'fetchData', scope);
    scope.fetchData = fetch;
    return fetch;
  }
  const oldFetch = render(1, '', '', '');
  const inFlight = oldFetch();
  const currentFetch = render(2, 'login_failed', 'high', 'query');
  await currentFetch(false, {
    page: 2,
    filterType: 'login_failed',
    filterSeverity: 'high',
    searchQuery: 'query',
  });
  await currentFetch(true, { includeStats: true });
  const success = {
    json: async () => ({
      success: true,
      logs: [],
      pagination: { total_pages: 2, total_items: 40 },
    }),
  };
  pending.shift()(success);
  await inFlight;
  assert.equal(requests.length, 2, 'queued requests must coalesce');
  const query = requests[1].searchParams;
  assert.equal(query.get('page'), '2');
  assert.equal(query.get('event_type'), 'login_failed');
  assert.equal(query.get('severity'), 'high');
  assert.equal(query.get('search'), 'query');
  assert.equal(query.get('include_stats'), '1');
  pending.shift()(success);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(shared.fetchInFlightRef.current, false);
}

async function checkLocalJsonFailure() {
  const file = 'server/themes-api.cjs';
  const source = read(file);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const routes = new Map();
  const helpers = [];
  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      ['sanitizeString', 'sanitizeRecursive', 'readJsonStore'].includes(node.name?.text)
    )
      helpers.push(node.getText(ast));
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some((d) =>
        ['HTML_ESCAPE_MAP', 'isRecordList', 'isContentStore'].includes(d.name.getText(ast))
      )
    )
      helpers.push(node.getText(ast));
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === 'app.post' &&
      ts.isStringLiteral(node.arguments[0])
    )
      routes.set(node.arguments[0].text, node.arguments.at(-1).getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let cases = 0;
  for (const route of ['/api/save_post', '/api/save_page', '/api/save_content', '/api/save_user']) {
    for (const scenario of ['valid', 'malformed', 'wrong-shape', 'read-error', 'missing']) {
      const original = route.endsWith('user')
        ? [{ id: 'kept', username: 'Keep' }]
        : { posts: [{ id: 'kept' }], pages: [{ id: 'kept-page' }], extra: 'preserved' };
      const raw =
        scenario === 'malformed'
          ? '{broken'
          : scenario === 'wrong-shape'
            ? 'null'
            : JSON.stringify(original);
      let writes = 0,
        result,
        status = 200;
      const scope = {
        PROJECT_ROOT: '/fixture',
        path,
        console: { error: noop },
        fs: {
          existsSync: () => scenario !== 'missing',
          readFileSync: () => {
            if (scenario === 'read-error' || scenario === 'missing')
              throw Object.assign(new Error('fixture read failed'), {
                code: scenario === 'missing' ? 'ENOENT' : 'EACCES',
              });
            return raw;
          },
          writeFileSync: (_file, data) => {
            writes++;
            result = JSON.parse(data);
          },
        },
        fse: { ensureDir: async () => {}, copy: async () => {} },
      };
      vm.runInNewContext(helpers.join('\n') + '\nglobalThis.save = ' + routes.get(route), scope);
      const body = route.endsWith('content')
        ? { posts: [{ id: 'new' }] }
        : { id: 'new', title: 'New', username: 'New' };
      const response = {
        status: (value) => {
          status = value;
          return response;
        },
        json: (value) => value,
      };
      await scope.save({ body }, response);
      const refused = ['malformed', 'wrong-shape', 'read-error'].includes(scenario);
      assert.equal(status, refused ? 500 : 200, `${route}: ${scenario}`);
      assert.equal(writes, refused ? 0 : 1, 'existing unreadable data must never be overwritten');
      if (scenario === 'valid') {
        if (route.endsWith('user')) assert.ok(result.some((row) => row.id === 'kept'));
        else {
          assert.equal(result.extra, 'preserved');
          assert.ok(result.pages.some((row) => row.id === 'kept-page'));
          if (!route.endsWith('content')) assert.ok(result.posts.some((row) => row.id === 'kept'));
        }
      }
      cases++;
    }
  }
  assert.equal(cases, 20);
}

async function checkExtensionLifecycle() {
  const file = 'src/plugins/von-core/features/extensions/ExtensionsManager.tsx';
  const createFixture = (activeThemeId = 'theme-prism') => {
    const initial = {
      activeThemeId,
      activePlugins: ['vp_promo_bar', 'vp_ai_summary'],
      pluginConfig: {
        pluginStatus: { vp_promo_bar: 'active', vp_ai_summary: 'active' },
        vp_promo_bar: { text: 'Saved sponsor text' },
      },
      theme: { prism: { fontSize: 'lg' } },
      seo: { title: 'Unrelated SEO setting' },
      api: { aiApiKey: '******** (PROTECTED)' },
    };
    const state = {
      result: true,
      confirm: true,
      writes: [],
      switches: [],
      notices: [],
      dialogs: [],
    };
    const scope = {
      THEME_DEFAULT: { id: 'theme-default', name: 'Default' },
      availableThemes: ['theme-default', 'theme-prism', 'theme-digest'].map((id) => ({
        id,
        name: id,
        extendedConfig: { colors: { primary: '#123456' } },
      })),
      activeTheme: { id: activeThemeId },
      settingsSnapshotRef: { current: initial },
      extensionMutationInFlight: { current: false },
      setMutatingExtensionId: noop,
      pluginItems: [{ id: 'vp_promo_bar', name: 'Promo Bar', type: 'plugin', status: 'active' }],
      setPluginItems: (update) => {
        scope.pluginItems = update(scope.pluginItems);
      },
      setTheme: (id) => {
        state.switches.push(id);
        scope.activeTheme = { id };
      },
      window: {
        confirm: (message) => {
          state.dialogs.push(message);
          return state.confirm;
        },
      },
      toast: { success: (message) => state.notices.push(message), error: noop },
      onUpdateSettings: async (next, options) => {
        assert.equal(options.optimistic, false);
        state.writes.push(next);
        return state.pending ? await state.pending : state.result;
      },
    };
    scope.persistSettings = handler(file, 'persistSettings', scope);
    const refresh = () => {
      scope.settings = scope.settingsSnapshotRef.current;
      scope.themeItems = handler(file, 'themeItems', scope);
      scope.allItems = [...scope.themeItems, ...scope.pluginItems];
    };
    const run = async (name, id) => {
      await handler(file, name, scope)(id);
      refresh();
    };
    refresh();
    return { initial, state, scope, refresh, run };
  };
  const status = (fixture, id) => fixture.scope.themeItems.find((theme) => theme.id === id).status;
  let cases = 0;
  for (const active of [true, false]) {
    for (const accepted of [true, false]) {
      const fixture = createFixture(active ? 'theme-prism' : 'theme-default');
      const { initial, state, scope, run } = fixture;
      state.result = accepted;
      await run('handleUninstall', 'theme-prism');
      const saved = scope.settingsSnapshotRef.current;
      assert.equal(state.writes.length, 1);
      assert.equal(saved.theme, initial.theme, 'uninstall must retain theme customization');
      assert.equal(saved.api, initial.api);
      assert.equal(saved.seo, initial.seo);
      assert.equal(saved.pluginConfig.vp_promo_bar, initial.pluginConfig.vp_promo_bar);
      assert.equal(Array.from(saved.activePlugins).join(','), initial.activePlugins.join(','));
      assert.equal(
        saved.activeThemeId,
        active && accepted ? 'theme-default' : initial.activeThemeId
      );
      assert.equal(state.switches.length, active && accepted ? 1 : 0);
      assert.equal(
        status(fixture, 'theme-prism'),
        accepted ? 'not_installed' : active ? 'active' : 'inactive'
      );
      assert.equal(state.notices.length, accepted ? 1 : 0);
      assert.match(state.dialogs[0], /Saved settings will be kept/);
      if (accepted) {
        await run('handleActivateTheme', 'theme-prism');
        assert.equal(state.writes.length, 1, 'uninstalled themes require installation first');
        state.result = false;
        await run('handleInstall', 'theme-prism');
        assert.equal(status(fixture, 'theme-prism'), 'not_installed');
        state.result = true;
        await run('handleInstall', 'theme-prism');
        assert.equal(status(fixture, 'theme-prism'), 'inactive');
        state.result = false;
        await run('handleActivateTheme', 'theme-prism');
        assert.equal(scope.settingsSnapshotRef.current.activeThemeId, 'theme-default');
        state.result = true;
        await run('handleActivateTheme', 'theme-prism');
        assert.equal(status(fixture, 'theme-prism'), 'active');
        assert.equal(scope.settingsSnapshotRef.current.theme, initial.theme);
      }
      cases++;
    }
  }
  const plugin = createFixture();
  await plugin.run('handleUninstall', 'vp_promo_bar');
  assert.equal(
    plugin.scope.settingsSnapshotRef.current.activePlugins.includes('vp_promo_bar'),
    false
  );
  assert.equal(
    plugin.scope.settingsSnapshotRef.current.activePlugins.includes('vp_ai_summary'),
    true
  );
  await plugin.run('handleInstall', 'vp_promo_bar');
  assert.equal(
    plugin.scope.settingsSnapshotRef.current.pluginConfig.pluginStatus.vp_promo_bar,
    'inactive'
  );
  assert.equal(
    plugin.scope.settingsSnapshotRef.current.pluginConfig.vp_promo_bar,
    plugin.initial.pluginConfig.vp_promo_bar
  );
  assert.equal(plugin.scope.settingsSnapshotRef.current.activeThemeId, 'theme-prism');
  cases++;
  for (const selected of ['theme-default', 'theme-prism']) {
    const fixture = createFixture(selected);
    await fixture.run('handleUninstall', 'theme-default');
    await fixture.run('handleUninstall', 'unknown-extension');
    await fixture.run('handleInstall', 'unknown-extension');
    fixture.state.confirm = false;
    await fixture.run('handleUninstall', 'vp_promo_bar');
    assert.equal(fixture.state.writes.length, 0);
    assert.equal(fixture.scope.settingsSnapshotRef.current, fixture.initial);
    cases++;
  }
  const legacy = createFixture();
  legacy.initial.pluginConfig.pluginStatus['theme-prism'] = 'not_installed';
  legacy.initial.pluginConfig.pluginStatus['theme-default'] = 'not_installed';
  legacy.initial.pluginConfig.pluginStatus['theme-digest'] = 'not_installed';
  legacy.refresh();
  assert.equal(status(legacy, 'theme-prism'), 'active');
  assert.equal(status(legacy, 'theme-default'), 'inactive');
  assert.equal(status(legacy, 'theme-digest'), 'not_installed');
  cases++;
  const pending = createFixture();
  let release;
  pending.state.pending = new Promise((resolve) => {
    release = resolve;
  });
  const uninstall = pending.run('handleUninstall', 'theme-prism');
  await Promise.resolve();
  assert.equal(pending.scope.extensionMutationInFlight.current, true);
  assert.equal(
    pending.state.switches.length,
    0,
    'theme must not switch before save acknowledgement'
  );
  await pending.run('handleUninstall', 'vp_promo_bar');
  assert.equal(pending.state.writes.length, 1, 'overlapping lifecycle writes must be refused');
  release(true);
  await uninstall;
  assert.equal(status(pending, 'theme-prism'), 'not_installed');
  assert.equal(pending.scope.extensionMutationInFlight.current, false);
  cases++;
  console.log(
    `PASS Extension lifecycle: ${cases} actual handler/projection groups cover retained settings, fallback, reinstall/activation, rejected/cancelled saves, legacy markers and pending-write ownership. Persistence is stubbed; no installed data changed.`
  );
}

async function checkSavedAiReadiness() {
  const { createSettingsPatch } = load('src/utils/settingsDraft.ts');
  let cases = 0;
  for (const optimistic of [true, false]) {
    for (const scenario of ['new-key', 'clear-key', 'expired-key', 'unreadable-key', 'model']) {
      const available = ['new-key', 'model'].includes(scenario);
      const previous = {
        _settingsScope: 'admin',
        api: { aiApiKey: '', aiModel: 'gemini-3.6-flash' },
        aiAssistant: { sharedAvailable: !available, model: 'gemini-3.6-flash' },
      };
      const next = {
        ...previous,
        api: {
          aiApiKey: scenario === 'clear-key' ? '' : 'qa-dummy-key',
          aiModel: 'gemini-3.8-flash',
        },
      };
      const scope = {
        useCallback: (callback) => callback,
        settingsRef: { current: previous },
        setSettings: noop,
        createSettingsPatch,
        API: { saveSettings: '/fixture/save_settings.php' },
        getAuthHeader: () => '',
        toast: { error: noop },
        console: { error: noop },
        loadSettings: async () => assert.fail('Save must not need another settings read'),
        vonFetch: async () => ({
          ok: true,
          json: async () => ({
            success: true,
            apiCredential: {
              aiApiKey: scenario === 'clear-key' ? '' : '******** (PROTECTED)',
              aiKeyStorage: scenario === 'unreadable-key' ? 'unavailable' : 'encrypted',
            },
            aiAssistant: { sharedAvailable: available, model: 'gemini-3.8-flash' },
          }),
        }),
      };
      const save = handler('src/hooks/useSettings.ts', 'handleUpdateSettings', scope);
      assert.equal(await save(next, { optimistic }), true);
      const saved = scope.settingsRef.current;
      assert.equal(saved.aiAssistant.sharedAvailable, available, scenario);
      assert.equal(saved.aiAssistant.model, 'gemini-3.8-flash', scenario);
      assert.ok(
        !JSON.stringify(saved).includes('qa-dummy-key'),
        'saved client state retains no key'
      );
      let prompts = 0;
      let requests = 0;
      const { useAiWriting } = load(
        'src/hooks/useAiWriting.ts',
        {
          react: {
            useCallback: (callback) => callback,
            useRef: (value) => ({ current: value }),
            useState: (value) => [value, noop],
          },
          '../config/site.config': { API: { aiGenerate: '/fixture/ai_generate.php' } },
          '../utils/api': {
            vonFetch: async (_url, request) => {
              requests++;
              assert.equal(request.headers['x-gemini-key'], undefined);
              return {};
            },
          },
          '../utils/security': { sanitizeEditorHtml: (value) => value },
          '../utils/toast': { __esModule: true, default: { error: noop, success: noop } },
        },
        {
          prompt: () => {
            prompts++;
            return '';
          },
        }
      );
      const ai = useAiWriting({ settings: saved, parseJsonResponse: async () => ({}) });
      await ai.onGenerate({ title: 'Fixture topic', content: '' });
      assert.equal(prompts, available ? 0 : 1, scenario);
      assert.equal(requests, available ? 1 : 0, scenario);
      cases++;
    }
  }
  console.log(
    `PASS AI Settings Save: ${cases} actual save/editor-handler cases; no reload, provider request or live key.`
  );
}

(async () => {
  await checkExtensionLifecycle();
  await checkSavedAiReadiness();
  checkTypedContracts();
  checkLightboxSwipes();
  await checkPublicRouteEffects();
  await checkLatestAutosave();
  await checkMediaDraftOwnership();
  await checkSecurityRefreshQuery();
  await checkLocalJsonFailure();
  console.log(
    'PASS Lint-discovered regressions: latest autosave callback, lightbox draft ownership, queued Security query, and 20 local JSON save/failure cases. No live data or files changed.'
  );
  await checkInstallerErrors();
  await checkContactReceipts();
  await checkSaveErrors();
  for (const isPage of [false, true])
    for (const isAutoSave of [false, true])
      for (const edited of [false, true]) await saveCase(isPage, isAutoSave, edited);
  await checkWrapperRecovery();
  const sent = { id: '', title: 'Draft', content: '<p>Text</p><p></p>', status: 'draft', slug: '' };
  const saved = { ...sent, id: '88', content: '<p>Text</p>', slug: 'draft', updated_at: 'v2' };
  assert.equal(
    helpers.mergeSavedEditorChanges(sent, saved, sent, sent.content).content,
    saved.content
  );
  const newer = helpers.mergeSavedEditorChanges(sent, saved, { ...sent, title: 'New' }, 'New body');
  assert.equal(newer.id, '88');
  assert.equal(newer.slug, 'draft');
  assert.equal(newer.content, 'New body');
  console.log(
    `PASS Editor Regressions Runtime: 20 actual save-failure/retry cases plus escaped wrapping status markup; 5 Contact receipt/validation-message handler cases; ${autoFillCases} editor-only Auto Fill formatter/button cases; ${publicationCases} rendered publication cells across 3 locales plus schedule/draft/fallback controls; 15 URL cases, actual DOM-sync/image-selection handlers, 8 deferred actual-save-handler cases, and 4 actual-wrapper local/API post/page recovery cases preserve newer typing, editor identity and server metadata.`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
