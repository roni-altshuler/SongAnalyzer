# Security dependency updates — 2026-10-05

## Scope and selection

- Next: 16.0.7 → **16.3.6**; eslint-config-next: 16.0.3 → **16.3.6**. React remains 19.2.1. This covers [the AVIF advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [App Router Server Action DoS](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) and the other Next advisories previously reported by npm audit. No Server Action declarations were found in app/lib, but other Server Component advisories also applied to the old version range.
- **16.3.6**, rather than the AVIF minimum 16.3.3, also covers [the newer next/og advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). The current OG/Twitter routes use Edge and do not meet its Node runtime condition. Selecting the patched version avoids introducing that affected range. Next resolves sharp **0.35.5**, which exceeds [the libheif fix](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c); runtime inspection shows libheif 1.23.5.
- Vitest: 4.0.18 → **4.1.11**, including matching @vitest/mocker. This covers [the conditional UI issue](https://github.com/advisories/GHSA-5xrq-8626-4rwp) and [mock redirect traversal](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). Configured use is Node `vitest run`, without UI, browser mode, API host exposure or standalone mocker plugin use; those exposure conditions were not found. The update is still compatible within major 4.
- Pin development Vite **7.3.5** (was locked at 7.3.1), covering [the source-map traversal](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) and [alternate-path file denial bypass](https://github.com/advisories/GHSA-fx2h-pf6j-xcff). Vitest 4.1.11 and @vitejs/plugin-react 5.1.4 both accept Vite 7. Staying on major 7 avoids an unnecessary Vite 8 migration and preserves the CI Node 20.19 requirement.

All locked HTTPS package downloads resolve to `registry.npmjs.org`. Exact framework/test-tool pins keep this change reproducible. Other direct dependency declarations, application code, UI, forecasts, credentials and deployment settings are unchanged. Required transitive and deduplicated packages are recorded in the lock diff.

Local validation used Node 24.19.0, npm 11.9.0 and Python 3.12.14. Browser checks used system Chromium with a temporary executable-path override; the repository audit/E2E assertions were retained. Screenshots were inspected and agent-browser confirmed meaningful home content, no framework overlay and no uncaught page errors. This is local verification; GitHub CI on its configured Node 20 remains a separate check.

## Validation

- Clean `npm ci --no-audit --no-fund`: passed.
- `npm test`: **142 passed, 11 skipped**, 19 passing test files and one gated file.
- `npm run lint`, `npm run typecheck`, default Turbopack `npm run build`: passed, without source/config workarounds.
- All **8 existing Playwright smoke tests** passed against the freshly started production build: home/nav, keyword lyrics analysis, audio deep-link/keyboard focus, fake-mic degraded Identify, Discover empty state, component showcase, Atlas HTTP 200 and invalid share HTTP 404. The temporary test config selected system Chromium and reused the production server; it did not change assertions.

## Isolation

Based on main `541e364cd777ca0f4df3a40a67264e63d13ddf5e`. Only package manifests/lock and this evidence are changed. Existing workbench/analysis UI work is preserved. This draft is for independent review, with no merge or production deployment performed by the agent.

## Audit snapshot and limitations

`npm audit --json --registry=https://registry.npmjs.org` was run before and after. This is a registry snapshot, not a compromise assessment or a claim that every remaining package is safe. The complete final result is in [security-audit-2026-10-05.json](security-audit-2026-10-05.json).

| Snapshot | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before | 2 | 32 | 25 | 5 | 64 |
| After | 0 | 18 | 7 | 2 | 27 |

Remaining findings include production nanoid and node-vibrant → Jimp → file-type, plus development parser/glob/esbuild dependencies. These are recorded in the audit snapshot; their reachability and upgrades need separate review. No blanket audit fix, forced major update or dependency override was applied. All Next, sharp, Vitest, @vitest/mocker and Vite advisory entries are absent from the final snapshot.

11 unit tests remain skipped by their existing gates (including the local Supabase RLS suite). No Supabase instance or provider credentials were configured. Real persistence/auth, populated Atlas data, real microphone input, provider-backed analysis and real share images were not verified. An additional request to both OG/Twitter image endpoints with a bogus slug returned HTTP 500: those routes call the Supabase helper without the share page's missing-config fallback. Source inspection shows that pre-existing path; the share document itself passed its expected HTTP 404 check. This security dependency change leaves that separate fail-soft repair for follow-up.

Lint exits successfully with 12 warnings. Build reports the existing middleware/Edge convention deprecations. The first upgraded build saw stale `.next/dev/types` from the old framework; a clean generated directory resolved it. A first browser run encountered a lingering old-version server after an npm parent stopped. The final run used a fresh port and an explicitly logged **Next 16.3.6** server; all eight tests passed there.


Raw local logs, audit inputs, browser harnesses and screenshots are retained in `/workspace/security-evidence-2026-10-05/` in the saved cloud environment.
