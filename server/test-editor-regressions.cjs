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

(async () => {
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
    'PASS Editor Regressions Runtime: 15 URL cases, actual DOM-sync/image-selection handlers, 8 deferred actual-save-handler cases, and 4 actual-wrapper local/API post/page recovery cases preserve newer typing, editor identity and server metadata.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
