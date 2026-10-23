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
function load(file, mocks = {}) {
  const result = { exports: {} };
  compile(read(file), {
    module: result,
    exports: result.exports,
    URL,
    require(name) {
      if (name in mocks) return mocks[name];
      return load(path.posix.join(path.posix.dirname(file), name) + '.ts');
    },
  });
  return result.exports;
}
function handler(file, name, scope) {
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
      for (const error of [new Error(reason), { status: 409 }, null]) {
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
        assert.equal(
          scope.reason,
          error?.status === 409 ? helpers.SAVE_CONFLICT_MESSAGE : error?.message || ''
        );
        assert.equal(scope.contentRef.current, original.content);
        assert.equal(scope.initialItemRef.current, original);
        assert.equal(scope.saved, undefined);
        assert.equal(scope.isSavingRef.current, false);
        assert.ok(cleared.includes(41), 'an old success timer must not erase this failure');
        if (isAutoSave && error?.status !== 409) assert.equal(notices.length, 0);
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
        React: { createElement: (type, props) => ({ type, props }) },
        PostEditor: 'actual-editor',
        Navigate: 'navigate',
        useNavigate: () => noop,
        useSearchParams: () => [new URLSearchParams(query)],
        createEmptyEditorItem: () => ({ id: '', title: '', content: '', status: 'draft' }),
        vonFetch: (url) => new Promise((resolve) => pending.push({ url, resolve })),
        API: { getPages: '/get_pages.php', getPost: '/get_post.php' },
        window: { scrollTo: noop },
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

(async () => {
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
    `PASS Editor Regressions Runtime: 12 actual save-failure/retry cases plus escaped wrapping status markup; 5 Contact receipt/validation-message handler cases; ${autoFillCases} editor-only Auto Fill formatter/button cases; ${publicationCases} rendered publication cells across 3 locales plus schedule/draft/fallback controls; 15 URL cases, actual DOM-sync/image-selection handlers, 8 deferred actual-save-handler cases, and 4 actual-wrapper local/API post/page recovery cases preserve newer typing, editor identity and server metadata.`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
