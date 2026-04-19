# Admin Bell System Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead admin bell icon with a small system alerts tray that prechecks system health once per mounted admin session, caches the result, and lets admins refresh it on demand.

**Architecture:** Keep the entire feature inside the admin shell. Reuse `settings._serverInfo?.integrityNeeded` for the integrity signal and maintain one small local DB-status snapshot fetched from `API.checkDbStatus` for the current mounted session. The bell tray should open against cached state, expose a manual `Refresh` action, and use the existing integration smoke test as the regression harness before implementation.

**Tech Stack:** React 19, TypeScript, existing `vonFetch` API helper, existing `server/test-integration.cjs` smoke gate.

**Note:** This workspace is not an active git repository, so commit steps are intentionally omitted. Verification steps are still mandatory.

---

### Task 1: Lock the session-cached bell behavior in the smoke gate

**Files:**
- Modify: `server/test-integration.cjs`
- Test: `npm run test:integration`

- [ ] **Step 1: Write the failing test**

Add a new assertion block after the existing admin-shell checks:

```js
const adminBellLayoutContent = read('src/components/layouts/AdminLayout.tsx');
if (
  adminBellLayoutContent.includes('No active system alerts') &&
  adminBellLayoutContent.includes('Checked just now') &&
  adminBellLayoutContent.includes('Refresh') &&
  adminBellLayoutContent.includes('Integrity repair needed') &&
  adminBellLayoutContent.includes('Database schema update required') &&
  adminBellLayoutContent.includes('setAlertsCheckedAt') &&
  adminBellLayoutContent.includes('API.checkDbStatus')
) {
  pass(
    'Admin Bell System Alerts: admin header bell exposes a refreshable current-session alerts snapshot.'
  );
} else {
  fail(
    'Admin Bell System Alerts: admin header bell is missing the refreshable current-session alerts snapshot contract.'
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration`

Expected: FAIL with `Admin Bell System Alerts: admin header bell is missing the refreshable current-session alerts snapshot contract.`

- [ ] **Step 3: Keep the rest of the smoke gate unchanged**

Do not add any new test helper or abstraction. The new block should stay as one direct string-contract check.

- [ ] **Step 4: Re-run the same test after implementation**

Run: `npm run test:integration`

Expected: PASS for the new admin bell contract.

---

### Task 2: Implement the minimum session-cached bell tray in the admin shell

**Files:**
- Modify: `src/components/layouts/AdminLayout.tsx`
- Reuse: `src/config/site.config.ts`

- [ ] **Step 1: Add minimal local state for the tray**

Add state near the existing header/search state:

```tsx
const [isAlertsOpen, setIsAlertsOpen] = useState(false);
const [dbAlert, setDbAlert] = useState<{ needsRepair: boolean; details: string[] } | null>(null);
const [alertsCheckedAt, setAlertsCheckedAt] = useState<number | null>(null);
const [alertsLoaded, setAlertsLoaded] = useState(false);
const [alertsLoading, setAlertsLoading] = useState(false);
```

- [ ] **Step 2: Derive the existing integrity signal from current props**

Add small derived booleans and list data inside the component:

```tsx
const hasIntegrityAlert = !!settings?._serverInfo?.integrityNeeded;

const alertItems = [
  ...(hasIntegrityAlert
    ? [
        {
          id: 'integrity',
          title: 'Integrity repair needed',
          body: 'Server integrity or rewrite rules need attention before admin tools are fully healthy.',
          actionLabel: 'Open repair tools',
          actionPath: '/admin/settings?tab=tools',
        },
      ]
    : []),
  ...(dbAlert?.needsRepair
    ? [
        {
          id: 'db-repair',
          title: 'Database schema update required',
          body: 'Your database schema is missing required structures for the current release.',
          actionLabel: 'Open repair tools',
          actionPath: '/admin/settings?tab=tools',
        },
      ]
    : []),
];

const hasActiveAlerts = alertItems.length > 0;
```

- [ ] **Step 3: Add one reusable current-session scan function**

Create one small helper so initial load and manual refresh use the same logic:

```tsx
const loadAlertsSnapshot = async () => {
  setAlertsLoading(true);

  try {
    const res = await vonFetch(API.checkDbStatus);
    const data = await res.json();
    if (data.success && data.needs_repair) {
      setDbAlert({ needsRepair: true, details: Array.isArray(data.details) ? data.details : [] });
    } else {
      setDbAlert({ needsRepair: false, details: [] });
    }
  } catch {
    setDbAlert({ needsRepair: false, details: [] });
  } finally {
    setAlertsLoaded(true);
    setAlertsCheckedAt(Date.now());
    setAlertsLoading(false);
  }
};
```

- [ ] **Step 4: Prefetch the DB status once per mounted admin session**

Add an effect that loads the snapshot automatically for admin users:

```tsx
useEffect(() => {
  if (userRole !== 'admin' || alertsLoaded || alertsLoading) return;

  void loadAlertsSnapshot();
}, [userRole, alertsLoaded, alertsLoading]);
```

- [ ] **Step 5: Add a tiny freshness label**

Add a small helper string based on `alertsCheckedAt`:

```tsx
const alertsCheckedLabel =
  alertsCheckedAt === null
    ? 'Checking system status...'
    : Date.now() - alertsCheckedAt < 60_000
      ? 'Checked just now'
      : 'Checked earlier this session';
```

- [ ] **Step 6: Replace the bell trigger and render the tray**

Keep the existing bell location, but add the cached-state tray and refresh action:

```tsx
<div className="relative">
  <button
    onClick={() => setIsAlertsOpen((prev) => !prev)}
    className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
    aria-label="Open system alerts"
  >
    <Bell size={20} />
    {hasActiveAlerts && (
      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>
    )}
  </button>

  {isAlertsOpen && (
    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Alerts</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{alertsCheckedLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAlertsSnapshot()}
          className="text-xs font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="p-3 space-y-3">
        {alertsLoading && !alertsLoaded ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Checking system status...</p>
        ) : hasActiveAlerts ? (
          alertItems.map((alert) => (
            <Link
              key={alert.id}
              to={alert.actionPath}
              onClick={() => setIsAlertsOpen(false)}
              className="block rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{alert.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{alert.body}</p>
              <p className="mt-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
                {alert.actionLabel}
              </p>
            </Link>
          ))
        ) : (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              No active system alerts
            </p>
            <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-300/80">
              {alertsCheckedLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 7: Keep the implementation bounded**

Do not:

- add a new notification abstraction
- add persistent dismiss state
- add new API endpoints
- modify unrelated dashboard modules

---

### Task 3: Verify the final state

**Files:**
- Verify: `src/components/layouts/AdminLayout.tsx`
- Verify: `server/test-integration.cjs`

- [ ] **Step 1: Run the smoke gate**

Run: `npm run test:integration`

Expected: PASS with the new line:

```text
PASS Admin Bell System Alerts: admin header bell exposes a refreshable current-session alerts snapshot.
```

- [ ] **Step 2: Run the type check**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 3: Run the build**

Run: `npm run build`

Expected: PASS

- [ ] **Step 4: Report the exact user-facing behavior**

State clearly that:

- the bell now opens a tray
- the tray prechecks once per mounted admin session
- the clean state reports `No active system alerts`
- the tray shows a small freshness label such as `Checked just now`
- the tray exposes a manual `Refresh` action
- the red dot appears only when alerts are active
- resolved issues disappear after refresh or on a new session snapshot
