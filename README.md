# Mathogram

**Little sums. Lovely discoveries.** A bright, touch-first pixel-animal game for early learners, in English and Czech. Solve a sum, check the answer, and one colored pixel appears automatically. No accounts, ads, trackers, external assets, penalties, timers, or sound.

Eleven original animals are available from the start: Sunny fish (28 pixels), Berry butterfly (32), Honey bee (36), Pebble snail (40), Mossy turtle (44), Ginger cat (48), Daffodil duck (50), Clover bunny (54), Amber fox (58), Twilight owl (61), and Biscuit pup (63). The five intermediate drawings keep gaps between available puzzle lengths to at most four pixels. The first four puzzles stay within 10; later puzzles introduce the second ten. Background squares never give away the unfinished silhouette.

## Run locally

Use **Node 24 LTS**, at least **24.14.1** within the 24.x line, and npm. `.nvmrc` records the reproducible baseline. The lockfile is included. TypeScript 6 is intentional: the maintained TypeScript ESLint parser currently supports TypeScript below 6.1. jsdom 29 supports this Node baseline; jsdom 30 requires a newer Node patch.

```powershell
npm ci
npm run dev
```

Open the printed URL at **`/mathogram/`**. Development intentionally does not register a service worker. For the actual installable/offline build:

```powershell
npm run build
npm run preview
```

Open **http://127.0.0.1:4173/mathogram/**. HTTPS is required when not on localhost. Nothing in these commands publishes the site.

## Play

Pick any animal. The answer to the equation is the column number. Enter up to two digits on the built-in keypad or a physical keyboard and press **Check / Ověřit** or Enter. Backspace works in either mode. Wrong answers (including out-of-range numbers) move the exercise to the back of the remaining queue without revealing a pixel. After brief feedback, the answer clears and another exercise appears; the missed exercise comes back later. Correct answers save immediately, reveal exactly one coordinate, then release a short duplicate-submission guard.

In **Settings / Nastavení** (the gear button), disable **Show row hints / Zobrazovat nápovědu řádku** to hide both the active-row highlight and the equation's row letter, including screen-reader row hints. Permanent grid coordinates remain visible. Hints default to on, including for existing saves; your choice is remembered across puzzles, reloads and collection resets.

If only one pixel remains when an answer is wrong, a previously solved exercise becomes a clearly labeled practice round. Practice has no row hint, never adds another pixel, and returns to the final exercise when answered correctly. A wrong practice answer moves to another practice exercise. Neither missed exercises nor practice rounds cost progress. Exercise order and practice state are saved immediately, so reopening continues from the deferred exercise rather than permitting an immediate repeat.

Return to **My animals / Moje zvířátka** at any point to resume later with the same equations. Completed animals have a discovery badge and can be replayed without losing it. Restarting an unfinished picture or resetting the collection requires confirmation.

The header language switch works during a puzzle without changing its queue. On first use, Czech is chosen if the browser's preferred languages include Czech; otherwise English is used. The saved choice takes precedence thereafter. **Settings** contains language, row hints, local-data controls, deferred app updates, and collection reset. The separate **Help / Nápověda** question-mark button contains game instructions, installation guidance, and offline-play advice.

## Architecture and arithmetic

| Location                                        | Responsibility                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src\domain\arithmetic.ts`                      | Exhaustive finite enumeration and independent validity checks                      |
| `src\domain\puzzle.ts`                          | Typed content and runtime validation                                               |
| `src\domain\game.ts`                            | Stable shuffled attempts, equation selection, pure guarded transitions             |
| `src\content\animals.ts`                        | Original coordinate-based animal artwork, palettes, and content versions           |
| `src\App.tsx`, `src\components\`, `src\styles\` | Gallery, game, keypad, live feedback, completion, modal help and responsive layout |
| `src\i18n\`                                     | Typed English/Czech messages and first-use language detection                      |
| `src\storage\progress.ts`                       | Versioned local progress, field-level validation and isolated recovery             |
| `src\pwa\usePwa.ts`, `vite.config.ts`           | Consent-driven worker lifecycle and Workbox-generated precaching                   |
| `public\icons\`, `scripts\generate-icons.mjs`   | Locally generated original PNG/SVG app icons                                       |
| `tests\e2e\`, `tests\fixtures\`                 | Built-artifact browser and real service-worker acceptance                          |

There is no backend, router, global state library, canvas game surface, or remote content.

For `a op b = c`, all values are integers, `a` is 0–20, `b` is 0–10, and `c` is 1–20. Both `a` and `c` must share at least one **closed** interval, `[0,10]` or `[10,20]`. Starting or landing on a ten is allowed; crossing through it is not. Introductory puzzles additionally require every value to be at most 10.

Allowed: `12+5`, `8+2`, `10-3`, `13-3`, `20-5`, `10+10`, `20-0`. Forbidden: `7+8`, `12-5`, `0+20`, and every zero answer.

Candidate selection favors nonzero operands, alternating operations, and less-used expressions when valid alternatives exist. It never retries randomly until something works. Injected randomness makes tests reproducible. Each attempt persists its exact pixel/equation pairs; deferral reorders only unsolved entries, preserving the solved prefix. A different displayed expression is preferred for the next exercise when available. Final-pixel practice references an already solved entry. Transitions check the expected current pixel ID, so stale submissions cannot skip an equation.

### Changing content or translations

Define a puzzle with a unique stable ID, positive integer content version, palette and rectangular dimensions at most 20×20. Rows and columns are **one-based**; pixel IDs are `row:column`, and only target pixels belong in `pixels`. Palette values are hex colors. Every target column must have a valid equation, and coordinates must be unique. `validatePuzzle` is run when bundled content loads.

Keep small puzzles recognizable at phone size and review the full original sprite, not only its data. Bump a puzzle's `version` whenever its artwork, target coordinates, dimensions, or arithmetic mode change; this safely invalidates only that saved attempt. Independent attempts, valid language and discovery badges remain. Do not reuse removed IDs for different animals.

Add English keys in `src\i18n\en.ts` and corresponding Czech keys in `cs.ts`; TypeScript enforces completeness. Check both visual length and screen-reader language. Regenerate icons with `npm run icons` if their original source drawing changes.

## Local data and recovery

Only **`mathogram.progress`** is written in localStorage. Its version-1 envelope contains language, the row hint preference, attempts (including content versions, exact equations, solved prefix and optional final-pixel practice reference), and completion badges. Earlier version-1 saves without the hint preference are loaded with hints enabled and retain their progress. Runtime validation rejects invalid arithmetic, stale content, unknown coordinates, duplicate queue entries, skipped pixels, invalid practice references and malformed shapes. Recovery salvages independently valid fields and shows a localized notice; unexpected programming errors are not swallowed.

Every correct answer, deferral, practice transition, fresh attempt, reset and preference change is saved synchronously, before animation. Quota/security failures show a persistent warning and allow in-memory play without claiming it was saved. Update acceptance is blocked if that save fails. No unload event is required, and neither reset action calls `localStorage.clear()` or deletes any origin-wide cache.

Progress is **not permanent or synchronized**. Browser/device cleanup can remove it. Home Screen and browser contexts may not share the same storage. Optional persistent-storage permission is requested only from Settings; denial is normal and reported. Back up nothing to a server: there is no server.

## Offline installation and updates

Vite, the manifest ID/start URL/scope, icons and service worker all use **`/mathogram/`**. `vite-plugin-pwa` generates the complete Workbox precache, including both languages and all eleven puzzles. There are no runtime API requests or external font/CDN dependencies.

Wait for **Ready for offline play / Připraveno na hraní offline** before disconnecting. This confirmation follows successful worker installation/caching, not merely a request to register. An active installed worker also confirms a prior successful cache. The first-ever visit cannot work offline; browser eviction can later remove cached files.

On iPhone/iPad (target **iOS/iPadOS 17+**), open the site in Safari, tap **Share → Add to Home Screen**, enable **Open as Web App** if shown, then Add. Install instructions are hidden when standalone is detected. This is a native-like Home Screen web app, **not an App Store app**.

Updates install in a waiting worker. **Later** leaves the current game alone; the update remains accessible in Settings. **Save & update** first saves progress, then sends Workbox's `SKIP_WAITING` message and reloads after the worker takes control. Another tab accepting an update does not trigger an unsolicited reload here. Registration, caching, messaging, and activation-timeout failures are surfaced. Workbox cache names and navigation fallback are scoped to Mathogram; obsolete-cache cleanup does not sweep other projects' storage.

If changing the hosting path, change `base`, manifest ID/start URL/scope, and navigation fallback/allowlist together, then update and rerun the subpath acceptance tests.

## Quality commands

Install browser binaries once before browser acceptance:

```powershell
npx playwright install chromium webkit
npm run validate
```

Linux CI uses `npx playwright install --with-deps chromium webkit`.

| Command                                     | Purpose                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run format:check` / `npm run format`   | Check/apply Prettier formatting                                           |
| `npm run lint`                              | ESLint, TypeScript and React hooks rules                                  |
| `npm run typecheck`                         | Strict TypeScript, including tests/configuration                          |
| `npm test`                                  | All domain, content, storage, component and lifecycle tests               |
| `npm test -- src\domain\arithmetic.test.ts` | Focused exhaustive arithmetic test                                        |
| `npm run test:coverage`                     | Coverage with per-domain/storage gates, not a cosmetic global target      |
| `npm run build`                             | Type-check and build the production PWA into `dist`                       |
| `npm run test:e2e`                          | Chromium/WebKit against the existing production artifact at `/mathogram/` |
| `npm run validate`                          | Formatting → lint → types → coverage → build → browser acceptance         |

Domain and storage require at least **95% line / 90% branch coverage**. Arithmetic tests enumerate the bounded operand/operator/result space with an independent crossing-ten oracle and explicit boundaries. Tests also cover content shape, all target columns, stale/repeated submissions, completed attempts, replay, recovery, quota/security failures, translation, keyboard/keypad, and immediate saves.

Browser tests play a complete introductory puzzle, a later column above 10, deferred retries, final-pixel practice, resume/replay/restart, Czech detection and reset isolation. They check row hint settings and offline persistence, narrow phone, portrait/landscape phone, iPad and split-view dimensions, 44px touch controls, focus trapping, no horizontal overflow, reduced motion, local-only requests, manifest/icon sizes, and axe WCAG A/AA findings.

Actual service-worker offline and update tests run in **Chromium**, separately from the WebKit interaction tests. The loopback-only server on port 4174 serves the production artifact plus a controlled new HTML precache revision to prove waiting activation and updated cold-offline shell loading. It is test infrastructure and never ships in `dist`. Ports 4173 and 4174 must be free; tests refuse to reuse an unknown server. Failed browser runs retain traces/screenshots; inspect `playwright-report` or `npx playwright show-report`.

### Physical-device and release acceptance

**Not performed: physical iPhone/iPad Safari or Home Screen acceptance.** No real devices were available to this implementation session. Playwright WebKit and desktop viewport emulation are not replacements.

Before release, record actual device model, OS version, browser/Home Screen context, date, and pass/fail for installation and icon, standalone launch, safe areas/Home indicator, touch keypad, VoiceOver announcements/focus, pinch zoom, portrait/landscape/split view, background/foreground resume, and cold offline reopening after readiness. Exercise data cleanup, update acceptance/deferment, and storage denial where practical. The implementation intentionally avoids orientation locking and uses scrolling rather than clipping the keypad on short screens.

Physical-device acceptance remains outstanding independently of automated browser checks and deployment.

## GitHub Pages delivery

The production URL is **https://davidmarek.github.io/mathogram/**. The protected publishing branch is explicitly `main`.

`.github\workflows\pages.yml` runs only for `main` pushes or manual dispatches. Both jobs independently require the exact repository, `refs/heads/main`, and **both the original actor and the rerun actor to be `davidmarek`**. Pull requests, fork contributions, schedules, issue comments, tags and other branches do not trigger this workflow. A manual dispatch publishes only when its `deploy` boolean is selected. The deploy job consumes the already-tested artifact; it does not rebuild.

The workflow has no default token permissions. Validation gets only `contents: read`, no persisted checkout credentials, and no Pages/OIDC write token. Only the dependent deployment job has `pages: write` and `id-token: write` and uses the `github-pages` environment. Workflow concurrency serializes releases without cancelling one mid-flight, with bounded job timeouts. All actions are pinned to full commit revisions, including the upload action used by the pinned Pages composite action. Failure artifacts expire after seven days, deployment artifacts after one day. Configure Pages uses `enablement: false`; it will not silently enable Pages.

### Repository security settings

Maintain the server-side controls alongside the workflow:

- Actions use a selected allowlist of the six official action repositories in the production workflow, plus the preview actions listed below, with full-SHA pinning required. Transitive action dependencies must also remain allowlisted and pinned.
- Default workflow tokens are read-only and cannot approve pull requests. Require workflow approval for **all outside collaborators**, including contributors whose previous workflows were approved.
- Restrict updates to `main` to the repository owner, and prohibit force pushes and deletion without bypass. Restrict the `github-pages` environment to the **branch** `main`, not a matching tag.
- Keep repository write/admin access limited to trusted maintainers. CODEOWNERS requests the owner's review; it is not itself an authorization boundary.

Fork PRs intentionally receive **no preview builds or deployments** from the checked-in preview workflow. Same-repository PRs run validation, but deployment requires the owner's environment approval. Dependabot runs cannot access the regular Actions deployment secret and are not supported for deployment directly. Review the entire change, including workflow and dependency lifecycle scripts, before approving execution, deployment, or merging. A merge by the owner is a trust decision and can execute the merged code with read-only build permissions. Dependabot proposes weekly dependency updates; review action revisions and update the server-side allowlist if a new action repository is introduced.

These restrictions keep production publishing owner-controlled. Preview CI deliberately permits same-repository PR execution; the outside-collaborator approval policy remains necessary because PRs can modify their own workflows. These controls cannot prevent people from reading public workflows, running copies in their own forks, GitHub processing incoming events, a compromised upstream dependency executing during an authorized build, or a compromised owner account changing controls. No self-hosted runner is used. Only the preview environment holds an Azure deployment secret.

Pages must be configured to use **GitHub Actions**. After each release, check the HTTPS start URL, refresh, assets, manifest/icons/worker, browser console and offline reopening. Renaming the owner/repository or publishing branch requires updating workflow gates, repository rules, environment policies and hosting paths together.

## Azure PR previews (not production)

`.github/workflows/azure-preview.yml` uses Azure Static Web Apps' native PR environments. Opening, reopening, or updating a same-repository PR targeting `main` validates its exact head commit with `npm run validate`. A fresh deployment job downloads that run's artifact, waits for environment approval, and publishes static files with **both app and API builds disabled**. It does not check out or execute PR code. The Azure token is referenced only by the upload/close actions, and validation uses no shared dependency cache.

Production stays at **https://davidmarek.github.io/mathogram/** with its existing workflow unchanged. Azure hosts the tested artifact under **`/mathogram/`**, including the manifest and service worker, and redirects its root there. No application path changes or second build are needed. The PR comment and workflow environment link identify the preview; the comment includes the tested head SHA. Separate Azure origins isolate preview saves and offline caches from GitHub Pages. Previews are public; `noindex` headers discourage indexing but do not restrict access.

### One-time setup

1. In Azure Portal, create a **Static Web App** in a dedicated resource group, for example `mathogram-previews`, using the **Free** plan and deployment source **Other**. Do not connect GitHub through the portal or configure production/custom domains. The Free plan allows three preview environments; close unused PR previews before exceeding that quota.
2. In GitHub **Settings → Environments**, create **`azure-preview`**. Configure **`davidmarek` as a required reviewer** before adding its secret. Allow self-review if the owner also initiates PRs; disable administrator bypass where available. If required-reviewer protection is unavailable, do not enable this workflow with a deployment secret until an equivalent approval gate is in place.
3. Restrict that environment to selected branches: **`refs/pull/*/merge`** for PR runs and **`main`** for merged-PR cleanup. Leave the production **`github-pages`** environment restricted to `main`.
4. In Azure, select **Manage deployment token**. Store it only as an **environment secret** named **`AZURE_STATIC_WEB_APPS_API_TOKEN`** in `azure-preview`, not as a repository secret or Dependabot secret. Never paste it into a PR, chat, or source file. This token can deploy to the entire dedicated Azure app; it is not a preview-only credential.
5. In GitHub **Settings → Actions → General**, retain read-only default tokens and approval for **all outside collaborators**. Add **`Azure/static-web-apps-deploy`**, **`actions/download-artifact`**, and **`actions/github-script`** to the existing allowed actions, using the full revisions pinned in the preview workflow. The Azure wrapper is pinned, but its upstream Dockerfile uses a mutable Microsoft deployment-client image; review that supply-chain dependency as part of enabling it.
6. Merge the workflow after review. Open or update a same-repository PR, wait for validation, inspect the exact commit and workflow changes, then approve the `azure-preview` deployment. Verify the posted `/mathogram/` URL, assets, installation, offline play, and local-save isolation. No live Azure deployment is established merely by adding this workflow.

### Approval, updates, and cleanup

Required environment review is the authorization boundary: a PR can change workflow YAML, so inspect it before approving any job that could receive the token. Keep write access limited to trusted maintainers. Fork PRs are deliberately skipped rather than using `pull_request_target` to execute outside code with elevated privileges. To preview an external or Dependabot change, first review it and bring the approved changes onto a maintainer-controlled branch with a new same-repository PR; do not expose the token to an untrusted workflow.

Each new commit starts validation again and requires a new deployment approval. The deployment rechecks that the PR is open at the validated SHA after the approval wait, rejecting stale runs. Upload and cleanup share a per-PR concurrency group without cancelling active deployments. If the PR closes during an upload, its cleanup waits for that upload.

Closing or merging a PR requests deletion of its native Azure preview environment, without building or checking out code. **Approve the cleanup job in `azure-preview` too.** If approval is withheld or cleanup fails, remove the preview through the Azure app's **Environments** page to reclaim quota. Old PR comments may still link to a removed preview. A reopened PR receives a new preview after validation and approval; old cleanup runs recheck that it is still closed before deleting anything.
