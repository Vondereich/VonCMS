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

PHP 8.2+ with `dom`, `mbstring` and `pdo_sqlite` is required by the isolated fixtures.
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
