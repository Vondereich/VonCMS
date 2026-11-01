# Development Health Check

Run from the Source checkout after dependencies are installed:

```powershell
npm run check:health
npm run check:health -- --full
node server/health-check.cjs --json
```

If PHP is not on PATH, set its actual executable first. For example:

```powershell
$env:PHP_BIN = 'C:\path\to\php.exe'
npm run check:health
```

PHP 8.2+ with `dom`, `mbstring` and `pdo_sqlite` is required by the isolated fixtures. Full media checks also require GD, EXIF and fileinfo; SMTP/URL and archive checks require curl and zip. PHP 8.3+ is recommended.
The command uses existing project dependencies; it does not install or update them.
No AI service, API key or AI tokens are used by the script.

## What runs

- Quick: version alignment, fixture prerequisites, four source/build PHP inputs, editor regressions, SEO/slug regressions and security-boundary fixtures.
- `--full`: the maintained integration suite, TypeScript check and public PHP lint, instead of repeating the quick suites separately. This is not the full release gate.
- Both: a SHA-256 over Git-listed working-tree inputs, including non-ignored untracked files, checked before and after execution. Deleted tracked files are represented; symlinks/submodules are not followed. This is not a build, ZIP or installed-site fingerprint.

The SEO tests require existing `dist` PHP inputs to match `public`. Missing/stale inputs produce incomplete coverage, not an automatic rebuild. Four matching files do not prove that all bundled JavaScript is current.

## Meaning of results

- `LULUS` / `PASS`: that named check completed with expected evidence.
- `GAGAL` / `FAIL`: a check failed; inspect its direct command. It may be a test or environment problem, not necessarily a CMS vulnerability.
- `BELUM DIUJI` / `NOT_RUN`: coverage was unavailable, timed out, warned or had missing prerequisites. It is never counted as passing.
- Overall exit codes: `0` scoped pass, `1` failed check, `2` incomplete coverage. JSON uses `PASS_SCOPED`, `FAIL` or `INCOMPLETE`.

For direct diagnostics, run the named maintained file under `server/`, `npm run typecheck`, or `npm run lint:php`. The coordinator intentionally does not print raw child output, environment values, credentials or response bodies. It writes its report to the console only.

## Safety and limits

No CMS configuration/database, website, network, build, ZIP, Git index or repair is targeted. Existing suites create and clean their own disposable local fixtures. Set `PHP_BIN` explicitly to select a known runtime. Tests execute local checkout code; this is not a sandbox for untrusted changes.

No installed-site HTTP or real-browser checks run. Real authenticated saves, uploads, mail, MySQL races, production performance, hosting, install/OTA and package parity remain separate checks. The existing fixtures include extracted code, controlled DOM/SQL and source contracts, not every complete user journey.

This detects regressions covered by maintained tests and inconsistent inputs. It is not autonomous anomaly monitoring, a whole-repository vulnerability scanner or proof that no major issue exists. Unknown bugs need new regression cases or appropriate runtime verification.

Test the coordinator itself with:

```powershell
node --test server/test-health-check.cjs
```

## Isolated admin navigation browser check

Run `npm run test:admin-navigation` separately. It starts a loopback-only Vite fixture and a disposable headless Chromium profile, tests the actual navigation and Extensions components plus the editor wrapper with a minimal input probe, then removes the browser profile and stops both processes. No installed CMS, credentials, saves, uploads or mail are used.

Set `CHROME_BIN` if Chrome is not at the default Windows location. Missing Chromium returns `NOT_RUN` (exit 2), not PASS. This check covers root/subfolder links, roles, dirty-navigation cancel/accept, fresh Create identity, Extensions history, keyboard/focus, phone/tablet layout and dark mode. The full TipTap editor, authenticated APIs and installed-site upgrade remain separate checks. Optional `ADMIN_NAV_SCREENSHOT_DIR` retains three fixture screenshots; without it no reports or images are written.

The navigation fixture also samples the actual computed sidebar colors for all three admin palettes in light/dark mode. It checks lighter hover feedback, a distinct open-parent tint and solid current destination, and at least 4.5:1 text contrast for the sampled navigation labels. This is bounded fixture coverage, not an accessibility certification of the whole dashboard.

Run `npm run test:editor-navigation` for the same isolated browser driver with the real PostEditor/TipTap and content-save hook instead of the minimal input probe. It defers fixture HTTP responses across Create, post-to-page navigation and unmount, checks success/rejection and autosave controls, and verifies same-URL drawer cancellation/acceptance at phone/tablet widths. Successful old saves must retain their own collection updates without redirecting or clearing dirty protection in the new editor. This mode blocks external requests; its saves are dummy responses, not authenticated PHP/MySQL or installed-site persistence.

Run `npm run test:ads-workspace` for the same driver with the real Settings and Ads components, fixture settings and a disabled Save callback. It checks code-field height, phone stacking, native vertical resizing, exact code input and independent switches/frequency. No installed settings or ad-provider scripts are accessed. Optional screenshots use the same directory variable; this mode retains one desktop image.

## Isolated MySQL backup check

With a local MySQL fixture server available, run `php server/integration/maintenance-boundaries.php --backup-mysql` after setting `VONCMS_TEST_MYSQL_DSN` to `mysql:host=127.0.0.1;port=3306;charset=utf8mb4`. Optional test credentials use `VONCMS_TEST_MYSQL_USER` and `VONCMS_TEST_MYSQL_PASSWORD`; no installed configuration is read. The fixture creates uniquely named `voncms_backup_qa_` schemas, executes the real Backup controller with stubbed session/CSRF transport, restores its generated SQL into a second owned schema and compares row bytes. It checks a greater-than-5MB download, empty tables, Unicode, quotes, zero/null values, unbuffered table reads, controlled count/row failures, connection reuse and unchanged source rows. Both schemas and fixture files are removed afterward. A missing MySQL server is not a pass. The ordinary integration gate checks cursor source contracts but does not claim this optional MySQL execution ran.

## Isolated Calendar checks

Optional `node server/test-calendar.cjs --mysql` uses only an explicitly loopback fixture server (`VONCMS_TEST_MYSQL_DSN=mysql:host=127.0.0.1;port=3306;charset=utf8mb4` by default), with the standard local fixture account or `VONCMS_TEST_MYSQL_USER` / `VONCMS_TEST_MYSQL_PASSWORD`. It creates a unique `voncms_calendar_qa_` schema, tests actual MySQL definitions/index repair and independent concurrent writers, then drops only its owned schema. Do not point test credentials at production. `npm run test:calendar-browser -- --mysql` uses the same isolated MySQL storage behind the browser fixture. No installed CMS database is selected.

Run `npm run test:calendar` for the real endpoint/service with disposable SQLite persistence, the real role-capability map and fixture session/CSRF transport. It checks publication projections, event CRUD, validation, versions, idempotency, audit rollback and unchanged content. Table definitions come from the real schema owner with SQLite-only DDL adaptations; single-argument MySQL COALESCE is adapted to its equivalent value. It does not prove MySQL locking or real PHP authentication/session transport.

Run `npm run test:calendar-browser` for actual Calendar components connected through loopback Vite to that PHP/SQLite fixture. It exercises save/reopen/update/delete, rejection feedback, month/year navigation and Today, every type/author filter, publication links, failed reads/retry, failed Load more/retry beyond 200 records, tablet/phone drawers and delayed-response ownership. The pagination case directly seeds only owned fixture storage; event CRUD uses the real endpoint. Rendered controls are measured for at least 4.5:1 text contrast after transitions settle, across all three admin palettes in light/dark mode, including forms and delete confirmation. No installed CMS/database or credentials are used. PHP 8.2+ with pdo_sqlite/mbstring and Chromium are required; missing prerequisites are NOT_RUN, not PASS. Optional screenshots use `ADMIN_NAV_SCREENSHOT_DIR`; owned profiles and database fixtures are removed afterwards. Optional MySQL checks are described above; real PHP session transport, the complete installed-site repair flow and production canary remain separate boundaries.
