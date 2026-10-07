# source-map-js patch — 2026-10-07

The reviewed [GHSA-68fv-2mgg-jv7q advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
affects source-map-js versions `>=1.0.0 <1.2.2`: extreme indexed source-map
section offsets can block the event loop. The installed/locked 1.2.1 dependency
was present through PostCSS 8.5.23 and Tailwind's existing Node tooling.

Only the `node_modules/source-map-js` lock entry changes, to the official npm
1.2.2 release, including its resolved URL and integrity. `package.json`, other
lock entries and runtime/security settings are unchanged. No blanket audit fix,
override or major upgrade was applied. `npm ls source-map-js --all` confirms
1.2.2 at both paths. Source inspection did not identify an application endpoint
that parses user-supplied source maps; this repairs an affected toolchain
dependency without claiming a demonstrated production exploit.

The [audit snapshot](SOURCE_MAP_AUDIT_2026-10-07.json) retains the target finding
and before/after registry totals. Before: 64 findings (35 high, 24 moderate,
5 low). After: 27 (18 high, 7 moderate, 2 low); zero critical in either snapshot.
The target advisory and its dependent-package cascades are absent after the
patch. These totals are npm's dependency-tree report, not a count of distinct
exploitable application bugs. Other advisories remain for separate assessment.

The patch was installed with scripts disabled and validated with the listening
window change: 199 passing unit tests, 11 existing Supabase-gated skips,
successful lint/type checks/production build and 39 passing production browser
regressions with zero retries. Lint retains six existing warnings. No new
credentials, RLS changes or production jobs were introduced.
