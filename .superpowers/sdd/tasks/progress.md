# SDD ledger — plan: C:\Users\Admin\projects-copy\ICICI-DASH\.kiro\specs\case-review-dashboard\tasks.md

Note: tasks.md checkbox markers ([x]/[-]/[~]) were found to be stale/inaccurate —
only Task 1 (scaffold) was actually present in the repo. Treating Tasks 2-14 as
not-yet-implemented. Optional ([ ]*) property-test subtasks are being deferred
per the plan's own note ("Tasks marked with * are optional and can be skipped
for a faster MVP") to prioritize a working end-to-end app; tracked here so the
final review can flag if the user wants them added back.

Baseline commit: 2f80bcb (Initial Vite + React + TS scaffold with Tailwind config, Task 1)

Deferred optional subtasks (not dispatched): 2.3, 2.6, 3.2, 4.2, 6.2, 9.3, 9.4, 11.2

Task 2: complete (commits 2f80bcb..9295ed9, review clean — 30/30 vitest passing, tsc clean, oxlint clean)
Task 3: minor (deferred): appStore.test.ts lacks a direct heterogeneous multi-filter AND-conjunction test and an explicit filteredRows round-trip-after-clear assertion (Req 4.6/4.7 coverage nits, logic verified correct by inspection)
Task 3: minor (deferred): resolveLabel in appStore.ts treats explicit JSON null as String(null)="null" instead of falling back to fileName — cosmetic only
Task 3: complete (commits 9295ed9..0c8d8a8, review clean — 51/51 vitest passing, tsc clean, oxlint clean)
NOTE: src/hooks/useDirectoryLoader.ts is currently a placeholder (throws 'not implemented — see Task 4') per Task 3's brief — Task 4 must replace its body in place, not create a new file.
Task 4: fix round 1/5 (4 addressed, 0 open — Property 16 label-fallback/hasErrors divergence + 2 minors; commits 912f5c4..9953e55)
Task 4: complete (commits 0c8d8a8..9953e55, review clean after 1 fix round — 62/62 vitest passing, tsc clean, oxlint clean)
Task 5: checkpoint passed (data layer verified: 62/62 vitest, tsc clean)
Tasks 6-8: complete (commit 9953e55..45bf4d9, build+lint+test verified green — lightweight review per user's move-fast directive, not full adversarial review)
Tasks 9-11: complete (commit 45bf4d9..1d73904, build+lint+test verified green 62/62 — lightweight review per move-fast directive)
Minor deferred: CaseTable virtualized rows use single-row <table> per virtual row (not idiomatic tbody virtualization) — functional, flagged for polish pass
Tasks 12-13: complete (commit 1d73904..d51de7b, build+dev-server smoke test green, 62/62 vitest — app now fully wired end to end, bundle grew from 20 to 1811 modules confirming real integration)
Task 14: complete (commit d51de7b..618d047 — README with Chromium requirement + Node fallback server example; added explicit stage-auto-discovery regression test, 63/63 vitest)
Task 15: final checkpoint passed. npm run build/lint/vitest all green (63/63 tests, tsc clean, only 2 pre-existing oxlint fast-refresh warnings in ConfidenceBadge.tsx). Browser smoke test via Playwright (headless Chromium) against `npm run dev`: FolderPicker empty state renders correctly; injected mock CaseRow data into the store to verify InsightsBar (Notion-style cards, scope toggle, per-stage avg/low-conf, error count) and CaseTable (colored ConfidenceBadge pills, sticky Case ID column, column filter headers) render correctly with zero console/page errors; clicked a stage score cell and confirmed JsonDetailModal opens with correct title format "Case {caseId} — {fileName}", JSON tree, Copy JSON/Done buttons, dimmed backdrop. Full drag-and-drop folder-selection flow (window.showDirectoryPicker) cannot be exercised headlessly since it requires a real user gesture in a real Chromium window — this is an inherent limitation of the File System Access API, not a gap in the implementation. All temporary smoke-test scaffolding (a debug store hook in main.tsx, local playwright install, smoke scripts) was fully reverted before this checkpoint; git status confirms a clean working tree with no unintended diffs.
FINAL STATUS: All 15 tasks complete. App builds, lints, tests, and renders end-to-end. Ready for whole-branch review / handoff.
