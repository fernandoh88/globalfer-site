# Globalfer Security Audit

## Migration onto verified GitHub history — 2026-09-21

This section records the migration-completion snapshot, before the authorized commit and publication pass. The dependency audit and original verification sections below retain the history of the earlier work in the isolated OneDrive directory; their unborn-branch remarks describe that source only. Consult this branch's Git history for subsequent commits.

| Item | Verified result |
|---|---|
| Clean checkout | `C:\github\globalfer-secure` |
| Remote | `https://github.com/fernandoh88/globalfer-site.git` |
| Remote default branch | main |
| Main/base commit | `c5809a285b91df58dec8d026110c02242434aa30` |
| Working branch | security-hardening, created from origin/main |
| Preserved history | c5809a2 → 92cde2d → 29fc146; three real commits |
| Commits/pushes/merges/deployments in this migration | None |
| Original directory | Preserved; no source files or old Git metadata imported wholesale |

The destination did not exist before cloning. The clone initially had a clean main matching origin/main. No root commit was invented, no main content changed, and no history was rewritten. The old staged snapshot was not imported. At migration completion, only the two authorized runtime-log removals described below were staged; code/configuration changes were unstaged and new files untracked.

### Approved transfer and comparison

The working contents of these 13 files were copied individually and byte-verified before migration-specific adjustments:

```text
package.json
package-lock.json
server/index.js
server/app.js
tests/nodemailer.test.js
tests/server.test.js
src/components/Contact.jsx
vite.config.js
.gitignore
README.md
.github/dependabot.yml
.github/workflows/deploy.yml
SECURITY-AUDIT.md
```

No .git, .env files, node_modules, dist, logs, temporary review files or other source files were copied. The .env.example in this clone comes from real main and was retained unchanged.

Comparison found **no additional security-related changed/untracked source files outside the approved list**. The source .env.example differs from the remote example but was not transferred; current and historical examples were checked for credentials. Other nonapproved text differences were only line endings/BOM, and the real repository versions were retained.

Adjustments made only in this clone after copying:

- Expanded .gitignore for build/, coverage/, general logs, editor directories and OS metadata, keeping .env.example trackable.
- Preserved real main's existing `/globalfer-site/` Vite base instead of importing the source directory's stale `/GlobalferWebsite/` base. The security-related host/port/strictPort settings remain. This avoids a deployment regression and does not guess a new production URL.
- Updated README and this report with real history, current verification, deployment requirements and safe reproduction instructions.
- Removed generated runtime logs from the index with `git rm --cached -- server-error.log server-output.log`; both files remain on disk and are now ignored.

### Runtime-log and secret review

Both log paths were tracked in real main. All reachable versions in the three-commit history were inspected without printing their contents:

| Information category | server-error.log | server-output.log |
|---|---|---|
| File content | Empty | One startup-status line |
| SMTP usernames/passwords, tokens, credentials | None detected | None detected |
| Environment-variable values/names | None detected | None detected |
| Email addresses or quote payloads | None detected | None detected |
| Stack traces or filesystem paths | None detected | None detected |
| Internal operational details | None | Local HTTP startup endpoint only |

Historical and current .env.example SMTP credential fields are placeholders; an original quote-recipient email is an identity/configuration value, not an authentication secret. Neither the logs nor examples matched actual configured secret values compared privately in memory. No evidence requiring credential rotation was found in these inspected historical paths. History remains intact, including the old log objects.

The reviewed application changes contain no suspected actual credentials; credential-looking test strings are fake fixtures. Secret scans report only path/line/type if a real suspect is found, never values. The clone contains no real .env file.

### Fresh-clone verification

Verification ran with Node **24.15.0** and npm **11.12.1** in this clone, using the copied lockfile without dependency regeneration:

| Command/check | Result |
|---|---|
| `npm ci` | Pass; 168 packages installed |
| `node --check server/index.js` | Pass |
| `node --check server/app.js` | Pass |
| `npm audit` | Pass; 0 vulnerabilities |
| `npm audit --omit=dev` | Pass; 0 vulnerabilities |
| `npm test` | Pass; 146 passed, 0 failed, 0 skipped |
| `npm run build` | Pass; Vite 6.4.3, 1,595 modules |
| Build after retaining main's Pages base | Pass; generated asset references use /globalfer-site/assets/ |
| `npm ls nodemailer vite express` | Nodemailer 9.1.1, Vite 6.4.3, Express 4.22.3 |

The API and mail-composition tests inject SMTP fakes or use an in-memory stream transport with a socket guard. No real SMTP connection or email delivery occurred. All required verification results match the earlier reviewed state. Different output asset hashes/sizes are expected from the retained real-main files and corrected repository base.

### Production configuration still required

The workflow currently supplies **no VITE_API_URL**. Contact.jsx constructs `${import.meta.env.VITE_API_URL || ''}/api/orcamento`. Without an explicit separately hosted API origin, a default Pages build posts to `https://fernandoh88.github.io/api/orcamento`, where Express does not run. Static build success therefore does not establish working production email submission.

Real main's `/globalfer-site/` base has been retained. For default project Pages the frontend address is `https://fernandoh88.github.io/globalfer-site/`; actual live Pages/custom-domain settings were not queried. No backend URL was invented or deployed. README contains a proposed build-step mapping from the future GitHub Actions repository variable `VITE_API_URL` into the build environment; that recommendation has **not** been applied to the workflow or GitHub settings.

For default Pages, the backend requires `FRONTEND_URL=https://fernandoh88.github.io`, with no repository path or trailing slash. For custom-domain hosting use its exact origin instead. Before deployment verify HTTPS, the proxy trust configuration, shared/aggregate mail quotas and HSTS coverage as detailed below.

The workflow retains Node 20. All locked packages with declared Node engines admit that runtime; packages without declarations make no engine guarantee. Node 20 reached end of life on 2026-04-30, so switching CI to a maintained LTS release is an operational follow-up, not an incompatibility forced by these dependency upgrades. Production's actual Node runtime remains unknown. See the [official Node schedule](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json).

### Review state and commit plan at migration completion

This branch is ready for human code review on real history. It is not deployed and should not be treated as production-ready until the API/origin/proxy settings are confirmed. At migration completion, only generated log removals were staged; the obsolete initial application snapshot was not imported into the index.

The migration review proposed these groups for the subsequent authorized commit pass:

1. Dependency remediation: package.json/package-lock.json (keep manifest and lock changes together).
2. API hardening: server/index.js and server/app.js together.
3. Security regression tests: both tests; the npm test script may be grouped here by reviewing its package.json hunk.
4. Contact behavior and development configuration: Contact.jsx and the Vite development-server settings, preserving the existing production base.
5. Security automation/documentation: workflow permissions, Dependabot, README and this report.
6. Generated-artifact hygiene: .gitignore and the two runtime-log removals.

During migration, no blanket staging, commit, push, merge, reset, clean, history rewrite or deployment was performed.


## Architecture summary

Globalfer is a React 18/Vite single-page frontend (`src/`) with an Express 4 server (`server/index.js` bootstrap, `server/app.js` application). The server serves `dist/` and exposes `GET /api/health` plus `POST /api/orcamento`, which validates quote data and sends email through Nodemailer/SMTP. Configuration is supplied by environment variables. There is no database, authentication, admin area, upload flow, payment integration, or external API in this checkout. GitHub Actions builds and deploys the static frontend to GitHub Pages.

## Findings

### [SEC-001] Missing baseline HTTP security headers
Severity: Medium

Location: `server/index.js` (Express setup)

Description: The server did not set security headers such as content-type sniffing protection, frame protection, referrer policy, or HSTS.

Risk: Browser-based attacks and information leakage are easier if the service is deployed publicly.

Evidence: No header middleware or equivalent response-header configuration was present.

Remediation: Add conservative headers that do not require a frontend rewrite; enable HSTS only for HTTPS deployments.

### [SEC-002] Quote endpoint lacks abuse/rate limiting
Severity: Medium

Location: `server/index.js:POST /api/orcamento`

Description: Any caller can repeatedly trigger SMTP work and email delivery.

Risk: Mail abuse, provider quota exhaustion, and denial of service.

Evidence: The route had validation and a body-size limit but no request-frequency control.

Remediation: Add an in-memory per-IP limiter suitable for a single instance and use a shared store at scale.

### [SEC-003] Validation permits unbounded individual strings and does not reject malformed bodies
Severity: Medium

Location: `server/index.js:validateQuote`

Description: Names, phone numbers, cities, messages, product names, and measurements were trimmed but had no maximum lengths/type enforcement.

Risk: Excessive memory/mail payloads and operational abuse; malformed JSON values could produce confusing errors.

Evidence: `sanitize()` coerced arbitrary values with `String()`.

Remediation: Require a plain object, enforce field length limits, and reject invalid item shapes while preserving the existing form.

### [SEC-004] Dependency vulnerabilities reported by npm audit
Severity: High

Location: `package-lock.json`

Description: `npm audit --omit=dev` reported 4 high and 3 moderate advisories, including Nodemailer and Vite transitive/direct dependencies.

Risk: Depending on exploitability and deployment exposure, crafted requests or build/development activity could cause denial of service, path traversal, or SMTP-related issues.

Evidence: Audit output identified vulnerable ranges for `nodemailer`, `vite`, `nanoid`, `postcss`, `body-parser`, and `qs`.

Remediation: Upgrade in a separately reviewed dependency change; major upgrades (Nodemailer 10/Vite 8) may require compatibility testing. No force upgrade was applied in the first hardening pass; the follow-up below resolves all reported advisories with smaller compatible release choices.

### [SEC-005] Production error response distinguishes SMTP authentication failures
Severity: Low

Location: `server/index.js` SMTP error handler

Description: Clients receive a provider-specific authentication failure message.

Risk: Leaks operational configuration details and gives attackers a useful signal.

Evidence: The `EAUTH` branch returned SMTP/Gmail setup guidance.

Remediation: Return one generic error to clients. The follow-up below also restricts logs to fixed categories, without raw provider details.

## Inventory

| Method | Path | Auth | Validation | Rate limited | Data/concern |
|---|---|---|---|---|---|
| GET | `/api/health` | No | None | No | Health status only |
| POST | `/api/orcamento` | No | Server-side quote validation | Yes (after fix) | Sends SMTP email; public form abuse risk |

## Summary

| ID | Severity | Vulnerability | Location | Status |
|---|---|---|---|---|
| SEC-001 | Medium | Missing security headers | server/index.js | Fixed |
| SEC-002 | Medium | No abuse rate limit | server/index.js | Fixed |
| SEC-003 | Medium | Weak/unbounded input validation | server/index.js | Fixed |
| SEC-004 | High | Vulnerable dependency ranges | package-lock.json | Fixed; see Dependency Remediation |
| SEC-005 | Low | SMTP detail in client errors | server/index.js | Fixed |

No secrets were printed. `.env` is ignored and not tracked in this checkout; rotate SMTP credentials if they were ever committed elsewhere or exposed in Git history.

## Dependency Remediation

Original dependency review on 2026-09-21 took place in the OneDrive source's unborn `security-hardening` branch. That source had no commits; its pre-existing index was preserved. This section records that earlier review. The migration section above describes the current clone on real GitHub history. No `npm audit fix --force` was used.

### Audit counts and scope

Counts below are npm's affected-package counts, including propagated findings, not counts of distinct exploitable bugs. The initial full audit contained **30 individual advisories across 12 affected packages**. Each advisory was read via the GitHub Advisory API, including its trigger conditions and patched versions; all are assessed below against Globalfer's actual use.

| Audit | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| BEFORE `npm audit --omit=dev` (reproduces previous audit) | 0 | 4 | 3 | 0 | 7 |
| BEFORE `npm audit` (including development) | 2 | 5 | 4 | 1 | 12 |
| AFTER `npm audit --omit=dev` | 0 | 0 | 0 | 0 | 0 |
| AFTER `npm audit` | 0 | 0 | 0 | 0 | 0 |

**Remaining advisories: none reported by either audit at verification time.** This establishes resolution of known npm advisories, not proof that the application has no vulnerabilities. Vite was moved to `devDependencies` because production Express serves prebuilt `dist/`; the full development-inclusive audit is also clean, so this move does not conceal unresolved findings.

### Dependency versions and compatibility

“Current” means the exact original lockfile version, not the older caret minimum in package.json. “Fixed/installed” is the exact selected final lockfile version; the next table records each advisory's first patched version. Severity is npm's package-level maximum and may be propagated.

| Package | Current | Fixed/installed | Severity | Direct/Transitive | Introduced By | Breaking Risk |
|---|---|---|---|---|---|---|
| @babel/core | 7.29.0 | 7.29.7 | low | Transitive | @vitejs/plugin-react → Babel | Patch; trusted compilation behavior |
| baseline-browser-mapping | 2.10.27 | 2.11.25 | moderate | Transitive | @vitejs/plugin-react → Babel → browserslist | Minor; invalid arguments now throw |
| body-parser | 1.20.5 | 1.20.8 | moderate | Transitive | express | Patch; rejects invalid parser limits |
| browserslist | 4.28.2 | 4.29.0 | high | Transitive | @vitejs/plugin-react → Babel | Minor; query cache/statistics fixes |
| concurrently | 9.2.1 | 9.2.4 | critical | Direct | Root developer scripts → shell-quote | Patch; fixed script commands retained |
| esbuild | 0.21.5 | 0.25.12 | moderate | Transitive | vite | 0.x minor changes via Vite major; native platform binaries |
| nanoid | 3.3.12 | 3.3.19 | high | Transitive | vite → postcss | Patch; no app generator API use |
| nodemailer | 6.10.1 | 9.1.1 | high | Direct | Root SMTP dependency | Major 6 → 9; reviewed below |
| postcss | 8.5.13 | 8.5.28 | high | Transitive | vite | Patch; stricter source-map access |
| qs | 6.15.1, 6.14.2 | 6.16.0 | moderate | Transitive | express and express → body-parser | Minor; nested duplicate removed |
| shell-quote | 1.8.3 | 1.9.0 | critical | Transitive | concurrently | Minor; invalid operators rejected |
| vite | 5.4.21 | 6.4.3 | high | Direct | Root build tool | Major 5 → 6; reviewed below |
| express | 4.22.1 | 4.22.3 | No direct advisory | Direct | Root API dependency | Patch; stays on Express 4 |

React and react-dom remain **18.3.1**, @vitejs/plugin-react remains **4.7.0**, and lucide-react remains **0.468.0**. No application library was replaced, no dependency overrides were added, and tests use Node's built-in test runner. The Node compatibility declaration now matches Vite's supported major lines and raises the Node 18 floor to 18.13 for mock.method/test cleanup APIs; tests use `node --test` discovery rather than shell globs, which older Windows runtimes do not expand. Use a supported LTS runtime in production, not the legacy compatibility minimum. See the [Node test API](https://nodejs.org/download/release/v18.20.3/docs/api/test.html#mockmethodobject-methodname-implementation-options) and [Node release status](https://nodejs.org/en/about/previous-releases).

The major upgrades were explained and checked before installation:

- **Vite 5.4.21 → 6.4.3:** the listed Vite fixes have no Vite 5 backport; 6.4.3 also admits patched esbuild 0.25.x. This is the smallest Vite major covering all reported advisories; the audit's automatic suggestion of Vite 8.3.0 was unnecessary. Reviewed the [Vite 6 migration guide](https://v6.vite.dev/guide/migration): custom resolution conditions, Sass APIs, TS/YAML PostCSS configuration, library CSS names, custom glob patterns and SSR/internal APIs are not used. Globalfer uses an ESM config, standard React plugin, ordinary CSS modules and a simple /api proxy. The installed React plugin's peer range supports Vite 6. No vite.config.js rewrite was needed; build and browser smoke tests pass.
- **Nodemailer 6.10.1 → 9.1.1:** versions through 9.1.0 are affected by at least one reported advisory. Reviewed the [upstream changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md): v7 replaces legacy SES integration; v8 renames NoAuth to ENOAUTH; v9 validates HTTPS certificates for remote content/token fetching and changes URL handling. Globalfer uses SMTP host/port/user/password and await sendMail with generated text/HTML, no SES, OAuth2, remote attachments, plugins or NoAuth branch. Those API changes need no application adaptation. Certificate checks were not weakened. Version 10's additional Node 20 minimum and module/TypeScript migration were avoided. The installed mail composer is exercised with an in-memory stream transport.
- **Express stays on 4:** no Express 5 route-pattern migration is required.
- **Tooling transitives:** compatible patch/minor releases resolve Babel, Browserslist, PostCSS, Nano ID and shell-quote findings. esbuild's pre-1.0 minor upgrade is carried by Vite's supported dependency range; all platform binary entries track 0.25.12.

Installation groups and lockfile review:

1. `npm install express@^4.22.3 nodemailer@^9.1.1`: Express/Nodemailer, qs 6.16.0 and side-channel patch changed; inspected exact lockfile version differences.
2. `npm install --save-dev vite@^6.4.3`: Vite/esbuild and matching optional platform binaries changed; tinyglobby/fdir/picomatch were added by Vite. Inspected version changes and dev classification.
3. `npm install --save-dev concurrently@^9.2.4`: removes its exact vulnerable shell-quote pin. Then `npm update body-parser @babel/core baseline-browser-mapping browserslist postcss nanoid` and `npm install`: compatible transitives refreshed; duplicate body-parser/qs 6.15.1 removed in favor of qs 6.16.0. Audits became clean.
4. Added the `npm test` script, ran `npm install` again, and verified reproducibility with `npm ci`.

Other lockfile version changes introduced by these dependency groups:

| Package | Before | After |
|---|---|---|
| @babel/code-frame | 7.29.0 | 7.29.7 |
| @babel/compat-data | 7.29.3 | 7.29.7 |
| @babel/generator | 7.29.1 | 7.29.8 |
| @babel/helper-compilation-targets | 7.28.6 | 7.29.7 |
| @babel/helper-globals | 7.28.0 | 7.29.7 |
| @babel/helper-module-imports | 7.28.6 | 7.29.7 |
| @babel/helper-module-transforms | 7.28.6 | 7.29.7 |
| @babel/helper-string-parser | 7.27.1 | 7.29.7 |
| @babel/helper-validator-identifier | 7.28.5 | 7.29.7 |
| @babel/helper-validator-option | 7.27.1 | 7.29.7 |
| @babel/helpers | 7.29.2 | 7.29.7 |
| @babel/parser | 7.29.3 | 7.29.9 |
| @babel/template | 7.28.6 | 7.29.7 |
| @babel/traverse | 7.29.0 | 7.29.8 |
| @babel/types | 7.29.0 | 7.29.8 |
| caniuse-lite | 1.0.30001791 | 1.0.30001810 |
| electron-to-chromium | 1.5.349 | 1.5.433 |
| node-releases | 2.0.38 | 2.0.56 |
| side-channel | 1.1.0 | 1.1.1 |
| update-browserslist-db | 1.2.3 | 1.3.3 |

New transitive packages: fdir **6.5.0**, picomatch **4.0.7**, tinyglobby **0.2.17**. Existing @esbuild platform packages changed **0.21.5 → 0.25.12**; netbsd-arm64, openbsd-arm64 and openharmony-arm64 platform packages were added at **0.25.12**. Rollup remains **4.60.2**. Platform entries for non-Windows systems remain in the portable lockfile.

### Individual advisory assessment

Installed version, direct/transitive relationship, top-level introducer and compatibility risk are given in the preceding package table and apply to each row below. Affected ranges here are the npm audit ranges relevant to the originally installed release line; the linked advisories include other release lines. “Not reached” is an assessment of current code/configuration, not a reason to leave a vulnerable package installed.

| Package / advisory | Vulnerable range | First fixed on relevant line | Severity | Trigger and relevance to Globalfer |
|---|---|---|---|---|
| @babel/core: [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | `<=7.29.0` | 7.29.6 | low | Source-map file read while compiling attacker-controlled JS. Build tooling only; quote input is never compiled. Trusted repository sources still need review. |
| baseline-browser-mapping: [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | `>=2.0.0 <2.11.0` | 2.11.0 | moderate | Invalid browser-mapping arguments terminate the process. Build-only fixed configuration; no visitor-controlled mapping arguments. |
| body-parser: [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) | `<1.20.6` | 1.20.6 | low | Invalid parser limit silently removes body cap. JSON parser is reachable, but the existing literal 120kb was valid; new literal 64kb is tested. |
| browserslist: [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | `<=4.28.6` | 4.28.7 | high | Unbounded distinct-query cache. Build-time browser queries only; no request-controlled queries or persistent web-facing Browserslist service. |
| browserslist: [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | `<=4.28.6` | 4.28.7 | high | Malformed custom browser statistics can crash/write prototypes. No user-supplied statistics; build workspace must remain trusted. |
| esbuild: [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | `<=0.24.2` | 0.25.0 | moderate | esbuild serve CORS reads. Vite invokes transform/build, not esbuild's standalone serve API; not reached through production Express. |
| nanoid: [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | `<3.3.16` | 3.3.16 | high | Negative size hangs non-secure ID generation. PostCSS dependency only; no visitor-supplied generator sizes. UI uses crypto.randomUUID. |
| nanoid: [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | `<3.3.18` | 3.3.18 | high | Zero size hangs custom ID generators. No visitor-controlled size or custom generator; same build-only PostCSS path. |
| nodemailer: [GHSA-mm7p-fcc7-pg87](https://github.com/advisories/GHSA-mm7p-fcc7-pg87) | `<7.0.7` | 7.0.7 | moderate | Quoted address misrouting. Address parsing runs, but all address headers come from trusted configuration, never quote fields. |
| nodemailer: [GHSA-c7w3-x93f-qmm8](https://github.com/advisories/GHSA-c7w3-x93f-qmm8) | `<8.0.4` | 8.0.4 | low | SMTP injection through envelope.size. Application never supplies a custom envelope or size; incoming extra fields now rejected. |
| nodemailer: [GHSA-vvjj-xcjg-gr5g](https://github.com/advisories/GHSA-vvjj-xcjg-gr5g) | `<=8.0.4` | 8.0.5 | moderate | CRLF in transport EHLO name. Application does not accept or set the transport name option from requests; unrelated to quote name/subject. |
| nodemailer: [GHSA-268h-hp4c-crq3](https://github.com/advisories/GHSA-268h-hp4c-crq3) | `<=8.0.8` | 8.0.9 | moderate | List-header comment injection. No list message option, mailing-list feature, or visitor-controlled header object. |
| nodemailer: [GHSA-wqvq-jvpq-h66f](https://github.com/advisories/GHSA-wqvq-jvpq-h66f) | `<=8.0.8` | 8.0.9 | moderate | JSON transport/content normalization bypasses file/URL restrictions. Production uses SMTP with generated string bodies, no content objects, attachments or attachDataUrls. |
| nodemailer: [GHSA-r7g4-qg5f-qqm2](https://github.com/advisories/GHSA-r7g4-qg5f-qqm2) | `<=8.0.7` | 8.0.8 | moderate | OAuth2 HTTPS certificate validation. This app uses configured SMTP user/password, no OAuth token fetching or remote content. |
| nodemailer: [GHSA-rcmh-qjqh-p98v](https://github.com/advisories/GHSA-rcmh-qjqh-p98v) | `>=3.0.0 <=7.0.10` | 7.0.11 | high | Recursive address parsing DoS. Only trusted configured addresses reach the parser; quote text/name is not an address. |
| nodemailer: [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f) | `<=9.0.0` | 9.0.1 | high | Raw-message file read/SSRF bypass. No raw message option; whitelist prevents forwarding arbitrary request properties to sendMail. |
| nodemailer: [GHSA-8m3c-c648-2xjj](https://github.com/advisories/GHSA-8m3c-c648-2xjj) | `<=9.1.0` | 9.1.1 | moderate | Legacy resolveContent access-policy bypass. No custom Nodemailer plugins or calls to that API; generated string bodies only. |
| nodemailer: [GHSA-wmmp-3585-3rmp](https://github.com/advisories/GHSA-wmmp-3585-3rmp) | `<9.1.0` | 9.1.0 | moderate | IDN recipient-domain validation mismatch. No visitor-supplied recipients/domain allow-list; configured destination remains trusted. |
| nodemailer: [GHSA-2x7j-588g-ccc2](https://github.com/advisories/GHSA-2x7j-588g-ccc2) | `<9.1.0` | 9.1.0 | high | Quadratic address-list parsing DoS. No attacker address lists; recipients come from configuration. The payload cap also bounds visitor text. |
| nodemailer: [GHSA-cc9r-2j5m-2m83](https://github.com/advisories/GHSA-cc9r-2j5m-2m83) | `>=6.9.16 <9.1.0` | 9.1.0 | moderate | Comment-based recipient-domain mismatch. No raw visitor address or domain validation path; destination never read from request. |
| postcss: [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | `<=8.5.22` | 8.5.23 | moderate | Previous-map file disclosure without from option. Build-only CSS processing; no visitor CSS is accepted or compiled. |
| postcss: [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | `<=8.5.17` | 8.5.18 | high | Previous-map traversal/disclosure. Same trusted CSS build path; not reachable from quote submissions. |
| qs: [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26) | `>=6.11.1 <=6.15.1` | 6.15.2 | moderate | Comma-array stringify crash. Express parses queries; app never calls qs.stringify with these options. |
| qs: [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) | `>=6.14.2 <=6.15.3` | 6.16.0 | moderate | Bracket-key array-limit bypass with comma:true. Express query parsing is reachable but comma mode is not enabled; no URL-encoded body parser. |
| qs: [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | `>=2.2.5 <6.16.0` | 6.16.0 | moderate | Attacker constructor.isBuffer crashes stringify. No parse-to-stringify round trip or qs.stringify use in application. |
| shell-quote: [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p) | `>=1.1.0 <=1.8.3` | 1.8.4 | critical | Shell injection through crafted object operators. concurrently runs fixed developer commands, never form input; no public command-execution endpoint. |
| shell-quote: [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv) | `<=1.8.4` | 1.9.0 | high | Quadratic token parsing DoS. Fixed, short developer script commands only; no attacker-controlled command strings. |
| vite: [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) | `<=6.4.1` | 6.4.2 | moderate | Vite development source-map traversal. Not production Express; network exposure is not configured, but unsafe dev-server exposure would make it relevant. |
| vite: [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) | `<=6.4.2` | 6.4.3 | moderate | Windows editor middleware UNC/NTLM disclosure. Relevant to this Windows development environment if a malicious page reaches the running middleware; not production Express. |
| vite: [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) | `<=6.4.2` | 6.4.3 | high | Windows dev-server deny-list bypass. Relevant if Vite is exposed; this checkout uses default local binding. No production Vite server. |

`concurrently` has no separate advisory in this audit: its critical finding propagates from shell-quote. `body-parser`'s moderate aggregate includes qs; its own invalid-limit advisory is low. Vite's aggregate also includes esbuild. These are not extra independent advisories.

### API hardening and mail safety

The prior remediation still coerced non-string input and logged raw Error objects. The follow-up separates `server/app.js` (exported createApp factory) from `server/index.js` (dotenv loading and listener) so tests import the app without starting a server or loading real SMTP credentials.

- Required name, phone, city and 1–30 product items must have the expected types; message is optional. Unknown top-level/item fields, arrays/objects in string fields, empty required values and overlong raw strings are rejected. Limits: name/city/product 120, phone 40, message 2,000, measurements 1,000 characters.
- There is **no email input in the actual form/API schema**. Malformed and overlong submitted email fields are tested as unsupported input (400), rather than inventing a new email feature. No user email becomes Reply-To.
- Name is the only visitor value used in a header (subject); raw CR, LF and CRLF are rejected before trimming. From/Reply-To come from SMTP configuration and To from QUOTE_EMAIL_TO (existing trusted fallback retained). Visitor from/to/cc/bcc/replyTo/subject and other extra fields are rejected; no request object is spread into sendMail.
- Text/HTML bodies are assembled explicitly; all user text is HTML-escaped. Body newlines remain legitimate body content and cannot add recipients or headers. File/URL content access is disabled in the mail transport.
- SMTP failure responses use one generic 500 message for authentication, connection, timeout and other failures. Logs contain only fixed categories such as `[mail] delivery_failed`; no provider Error object, message, code, stack, hostname or credentials are logged.
- Explicit SMTP DNS/connect/greeting timeouts are 10 seconds each, socket inactivity timeout 20 seconds. These bound individual stages, not a promised end-to-end deadline.
- API errors use JSON; malformed input returns 400, oversized JSON 413, unsupported content type/encoding 415, forbidden Origin 403 and rate limit 429. The final error middleware also covers static-file/framework failures.

### Rate limiting, proxy deployment and abuse

POST /api/orcamento allows **8 attempts per socket-derived client IP per 15 minutes**, with Retry-After. The limiter runs before origin/type/body processing, so invalid requests count. GET /api/health remains exempt. Expired entries are removed on quote requests; the map is bounded at 10,000 entries and new clients fail closed when full, rather than evicting active quotas.

`trust proxy` is explicitly **false**; spoofed X-Forwarded-For, X-Real-IP and Forwarded headers cannot change the quota key. Behind a reverse proxy this deliberately groups callers under the proxy's IP until deployment-specific trust is configured.

Before a production proxy change, identify the actual proxy addresses and paths. For a **single trusted proxy on the same host**, with the application reachable only from that proxy, replace the false setting with `app.set('trust proxy', 'loopback')`. For remote proxies use their exact IPs/CIDRs, not all private addresses. Block direct backend ingress and make the proxy overwrite forwarded client/protocol/host headers. Do not use `true` or a hop count unless every ingress path is verified; variable path lengths can permit spoofing. Retest quotas with different clients through the real proxy. See [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/).

Eight requests per window is conservative for this low-volume quote form, but allows bursts and can inconvenience shared-NAT clients. It is **not sufficient against distributed bots, rotating IPv6 addresses, restarts or multiple application instances**. Fixed recipients prevent arbitrary-victim email bombing but the company's mailbox and SMTP quota remain abuse targets. CORS/Origin checks are not authentication: non-browser callers can omit/forge Origin.

For public production: enforce a provider/day-wide mail budget and monitoring, edge request/body/time limits, and a shared quota store before scaling to multiple processes. Consider per-IP cooldown and a honeypot as low-friction additions if spam appears; honeypots are bypassable. Consider server-verified CAPTCHA/Turnstile only if observed abuse justifies its privacy/accessibility/operational cost. No CAPTCHA or new external API was added.

### Request size, CORS and headers

JSON parsing is confined to the quote POST with `express.json({ limit: '64kb', strict: true, inflate: false })`. Maximum ordinary ASCII field content is 30 × (120 + 1,000) + 120 + 40 + 120 + 2,000 = **35,880 characters**, plus JSON syntax. A 64 KiB serialized UTF-8 budget accommodates this and ordinary Portuguese text while bounding parser work. The independent byte limit means every field cannot be filled with maximum multibyte/escaped characters simultaneously; this is explicitly tested as 413. Compressed bodies are rejected instead of inflated.

CORS access is granted only to exact FRONTEND_URL. A mismatching browser Origin cannot send a quote; no-Origin non-browser requests remain allowed. Set FRONTEND_URL to the frontend's **origin only**, e.g. https://example.com, not a path/trailing slash. Production same-origin form submissions also need that value configured correctly. Vite development now binds to 127.0.0.1:5173 with strictPort, matching the existing default/example origin; automatic localhost/alternate-port selection would otherwise cause valid proxied submissions to fail the origin check. The actual Vite-to-Express proxy was exercised with mocked SMTP.

All tested API success/failure responses retain X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy; X-Powered-By is absent. HSTS is emitted only for NODE_ENV=production. Production must use HTTPS, and includeSubDomains assumes all covered subdomains support HTTPS. Headers on GitHub Pages/CDN responses are controlled by that hosting layer, not Express.

### Frontend and repository configuration review

Contact.jsx captures the form before await, preventing React's cleared event.currentTarget from breaking a successful reset. It retains entered data on failures, displays fixed status-appropriate Portuguese text for validation/rate/network/provider/invalid-JSON responses, and never renders arbitrary server errors as HTML. Input maxlength values match backend limits. No dangerouslySetInnerHTML or other application HTML sink receives quote input.

Searched source, compiled dist, public text assets and configuration for SMTP, PASSWORD, SECRET, TOKEN and API_KEY without printing values. Compared actual configured SMTP credential/host strings against source and compiled assets in memory: **no secret matches**. Keyword-only hits in the bundle are React internals and normal password-input handling; workflow id-token is a permission, and .env.example contains documented placeholders. No sensitive VITE_* key was found. VITE_API_URL and VITE_BASE_PATH are public configuration; never place secrets in VITE_* variables. .gitignore now covers .env.* while keeping .env.example trackable. No .env contents were changed or printed.

Added weekly npm Dependabot configuration in .github/dependabot.yml. It is prepared locally; it must reach the default branch through human review before GitHub applies it. No remote Dependabot settings or alerts were inspected because this task did not use an authenticated GitHub service.

GitHub Actions now defaults to no permissions: build gets contents:read/pages:read, deploy gets pages:write/id-token:write. Existing triggers, action versions, build/deployment steps and Node 20 configuration remain unchanged. This matches [configure-pages default behavior](https://github.com/actions/configure-pages/blob/v5/action.yml) and [deploy-pages permissions](https://github.com/actions/deploy-pages/tree/v4#security-considerations). GitHub Pages deploys static files only; the SMTP API still needs a separate HTTPS backend with correct VITE_API_URL/FRONTEND_URL. If serving the frontend directly from Express at /, build with VITE_BASE_PATH=/ instead of the GitHub Pages prefix. A later runtime-maintenance change should move CI from the retained, now end-of-life Node 20 line to a [supported Node release](https://nodejs.org/en/about/previous-releases); local verification here uses Node **24.15.0** and npm **11.12.1**.

### Tests and final verification

Automated API tests use injected fake SMTP factories plus a guard against real Nodemailer transport creation. The separate Nodemailer compatibility test forces the built-in stream transport and forbids socket creation while generating mail. Tests do not load .env, connect to a provider, or send real email.

Coverage: successful normalized quote and maximum-size legitimate form; missing/empty/wrong/long fields; arrays/nested/unknown/reserved keys; unsupported malformed/long emails; malformed/empty/oversized UTF-8 JSON; content types and compression; CR/LF injection and fixed recipients; HTML escaping; successful/failed SMTP with redaction; limit exhaustion/reset and invalid-attempt accounting; health exemption; forged forwarding headers; CORS/preflight; production-only HSTS and all baseline headers; framework URL errors.

Ten isolated headless Chrome checks passed against the compiled frontend: maxlength, asynchronous success/reset, 400, 413, non-JSON 429, non-JSON 500, network failure, non-JSON 200, unexpected JSON 200 and absence of uncaught errors. Failed submissions preserve entered/product data and re-enable submit. Fetch was mocked against a static-only local server, with no backend or SMTP interaction. This was an ad hoc browser smoke check, not an added npm browser-test dependency.

| Command / check | Result |
|---|---|
| Initial `npm audit` | Exit 1; 12 affected packages, counts above |
| Initial `npm audit --omit=dev` | Exit 1; 7 affected packages, counts above |
| Initial `npm run build` before upgrades | Pass in original OneDrive checkout; prior access failure not reproduced |
| Grouped npm installs/update listed above | Pass; final install reports zero vulnerabilities |
| `npm ci` | Pass; 168 packages installed from lockfile, zero vulnerabilities |
| `node --check server/index.js` | Pass |
| `node --check server/app.js` | Pass |
| Final `npm audit` | Pass; zero vulnerabilities |
| Final `npm audit --omit=dev` | Pass; zero vulnerabilities |
| `npm test` (also run with `-- --test-reporter=dot`) | Pass; 146 tests, 0 failures, 0 skipped: 144 API + 2 in-memory Nodemailer MIME tests |
| Final `npm run build` | Pass; Vite 6.4.3, 1,595 modules, built in original OneDrive checkout |
| Headless Chrome frontend smoke | Pass; 10 checks, mocked fetch |
| Vite development/proxy smoke | Pass; page, JSX transform, quote POST 200, mismatching Origin 403 and health 200; mocked SMTP |
| Source/config/bundle secret checks | Pass; no actual credential values in frontend |
| `git diff --check` | Pass; only ordinary Windows LF/CRLF conversion notices |

No environmental workaround or disabled security protection was needed. The earlier OneDrive/esbuild access error cannot be attributed to a cause from this successful run. Vite config changes align the development origin and do not work around a build failure. The first ad hoc proxy harness closed Vite before dependency scanning completed and emitted shutdown errors; rerunning after awaiting scanning/JSX transformation passed cleanly. The first browser harness also had a local favicon response bug, fixed before its successful run; neither was an application failure.

### Reproduce verification in the clean checkout

Run these checks from `security-hardening` in `C:\github\globalfer-secure`. For a fresh checkout, use the published `security-hardening` branch once available; GitHub's `main` does not contain these changes before merge. Do not copy the old directory's .git metadata or reuse its obsolete index.

```powershell
Set-Location -LiteralPath 'C:\github\globalfer-secure'
if ((git branch --show-current).Trim() -ne 'security-hardening') {
    throw 'Unexpected branch; stop.'
}
git status --short --branch
node --version
npm --version
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
node --check server/index.js
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap syntax check failed' }
node --check server/app.js
if ($LASTEXITCODE -ne 0) { throw 'App syntax check failed' }
npm audit
if ($LASTEXITCODE -ne 0) { throw 'Full audit failed' }
npm audit --omit=dev
if ($LASTEXITCODE -ne 0) { throw 'Production audit failed' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed; inspect the exact error' }
```

Use a supported Node runtime; Node 24.15.0 was tested. No SMTP configuration is required for these tests or the static build.

### Review readiness and manual actions

**Ready for human code review; not deployed.** No audited dependency vulnerabilities remain. Real SMTP delivery and provider authentication were intentionally not exercised. Before production, verify HTTPS/HSTS coverage, the separately hosted API and public frontend URL, exact proxy trust/ingress behavior, aggregate mail quotas/monitoring and the hosting-layer headers. Review the retained older Vite/Nodemailer release lines through Dependabot as upstream support evolves. No unrequested real email test is required to review this branch.

Changes in the original remediation pass: package.json, package-lock.json, server/index.js, new server/app.js, src/components/Contact.jsx, vite.config.js, README.md, .gitignore, .github/workflows/deploy.yml, new .github/dependabot.yml, new tests/server.test.js, new tests/nodemailer.test.js and this report. During that pass, existing unrelated staged files were left untouched.

Historical commit suggestions from the original remediation review (no commits were created during that pass):

1. `fix(deps): resolve runtime and build dependency advisories`
2. `fix(security): validate quote requests and isolate mail delivery`
3. `test(security): cover quote API and in-memory mail composition`
4. `fix(contact): handle asynchronous form submission safely`
5. `chore(security): configure dependency updates and document verification`

The original source checkout had no initial commit and an obsolete staged application snapshot. It remains untouched. Use the current clone and the migration-specific commit plan above; do not commit from that source index.

Historical note about the original source only: temporary audit files were removed during the earlier remediation, but removal of its empty `.security-review` directory was blocked. That directory was not copied to this clone, and no cleanup was attempted in the source during migration.
