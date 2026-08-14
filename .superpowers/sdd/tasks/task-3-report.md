# Task 3 Implementation Report — Zustand Store

## Summary

Implemented `src/store/appStore.ts`, the full Zustand store per the `AppStore` interface
defined in `src/lib/types.ts` (Task 2), along with the module-level filter predicate
helpers, derived-state recomputation helpers, and all specified actions.

Also created a placeholder `src/hooks/useDirectoryLoader.ts` (option (a) from the brief's
notes) so `tsc -b` and the test suite stay green ahead of Task 4.

## Files created

- `src/store/appStore.ts` — the store, exported filter helpers (`matchesCaseIdFilter`,
  `matchesVerdictFilter`, `matchesHasErrorsFilter`, `matchesStageFilter`,
  `applyAllFilters`), and internal helpers (`deriveStageColumns`, `rederiveRow`,
  `resolveScore`, `resolveLabel`).
- `src/store/appStore.test.ts` — Vitest unit tests.
- `src/hooks/useDirectoryLoader.ts` — **placeholder only**, see below.

## Design decisions / judgment calls

1. **Filter helpers exported, not just module-private.** The brief says "write these as
   module-level helper functions in the same file, not inline" but doesn't explicitly say
   whether to export them. I exported them (a) so the brief's own required unit tests for
   `matchesCaseIdFilter` etc. can import and test them directly, and (b) `applyAllFilters`
   is exported too since it's referenced by name in the brief's pseudocode and is useful
   to test/reuse. This doesn't change any behavior, just visibility.

2. **`hasErrors` / `errorDetails` recomputation in `rederiveCaseRows`.** The brief says
   hasErrors is true "if the finalVerdict resolution failed OR any stage's score/label
   resolution failed (any `getByPath` returned `undefined` for a configured path)". I
   implemented this by having `rederiveRow` collect human-readable `errorDetails` strings
   for each failure (mirroring the existing `CaseRow.errorDetails: string[]` field
   semantics from Task 2's types) and setting `hasErrors = errorDetails.length > 0`. This
   also means `errorDetails` gets refreshed (not appended to previous errorDetails) on
   every rederive, which seems correct since `rederiveCaseRows` is meant to recompute
   these fields fresh from raw blobs each time.

3. **Label resolution fallback and stringification.** Brief note: "stringify or default to
   `stage.fileName` if resolution fails." I implemented: if `getByPath` returns
   `undefined`, use `stage.fileName` as fallback AND mark it as a failure (contributing to
   `hasErrors`); if it resolves to a non-string value (e.g. a number), `String()` it
   without marking failure (since the path *did* resolve — that's not an "error" case per
   the brief's failure definition, which is specifically about `undefined`/unresolved
   paths).

4. **Score resolution:** "must be a `number`, else `null`" — I check `typeof === 'number'`.
   If the raw resolved value exists but isn't a number (e.g. a string), score becomes
   `null` but this is NOT counted as a `hasErrors` failure, since the brief's `hasErrors`
   definition is specifically "resolution failed" (i.e., `getByPath` returned
   `undefined`), not "resolved to the wrong type." This mirrors the finalVerdict coercion
   rule stated in the brief, which only treats `undefined` (unresolved) as an error, while
   "resolved to something other than exactly 0 or 1" silently becomes `null` without being
   flagged as an error itself, in the finalVerdict case. I chose to apply the same standard
   consistently to stage scores. This is a judgment call — the brief is not 100%
   unambiguous on this point — but it is the most consistent reading of the stated rules.

5. **`clearFilter` implementation:** used a `DEFAULT_FILTERS` constant object as the
   source of "default value per key" so `clearFilter(key)` is just
   `{ ...filters, [key]: DEFAULT_FILTERS[key] }`. Since `FilterState.stages` is an object,
   I make sure `DEFAULT_FILTERS.stages` is a fresh `{}` each time `clearAllFilters`/store
   init runs (spread into a new object) to avoid any accidental shared-reference mutation
   across calls, though nothing in this store ever mutates `stages` in place, so this is
   defensive rather than strictly required.

6. **`setFilter` stages-replacement contract:** implemented and documented exactly as
   specified — top-level shallow merge only; `update.stages`, if present, replaces
   `filters.stages` wholesale. Documented with a comment block directly above the action
   in `appStore.ts`, including an example of how callers (Task 8) should spread the
   existing map themselves.

7. **`loadDirectory` progress reporting:** Set `loadingProgress` to `{ done: 0, total: 0 }`
   immediately when the action starts (before we know the real total), then let the
   `onProgress` callback from `loadCaseRows` update it as ingestion proceeds. This gives
   the UI something non-null to render immediately (e.g. a spinner) rather than waiting
   for the loader to report its first real progress tick. Not explicitly specified in the
   brief, but consistent with "Sets `loadingProgress` appropriately during the load."

## The Task 4 dependency (placeholder file)

Per the brief's explicit guidance, I created `src/hooks/useDirectoryLoader.ts` as a
**placeholder only** — option (a) from the brief's implementer notes:

```ts
export async function loadCaseRows(
  handle: FileSystemDirectoryHandle,
  settings: SettingsConfig,
  onProgress: (done: number, total: number) => void
): Promise<CaseRow[]> {
  ...
  throw new Error('not implemented — see Task 4');
}
```

This file has a large header comment explicitly telling Task 4's implementer to
**replace** this file's body with the real ingestion logic, not import around it or move
it. `appStore.ts`'s `loadDirectory` action imports `loadCaseRows` from this exact path and
calls it inside a try/catch — on rejection (which is what happens right now, always,
since the stub always throws), it logs to console via `console.error` and resets
`loadingProgress` to `null` without touching `allCaseRows`, matching the brief's error
semantics.

Because this placeholder exists, `npm run build` (`tsc -b && vite build`) is GREEN right
now, and all tests pass, including a store test (`loadDirectory` describe block) that
exercises the reject-path behavior against the always-throwing stub. When Task 4 lands
and replaces this file with a real implementation, no changes to `appStore.ts` should be
needed — the import and call signature already match the contract described in the brief.

## Tests

`src/store/appStore.test.ts` covers:
- All four filter predicate helpers (`matchesCaseIdFilter`, `matchesVerdictFilter`,
  `matchesHasErrorsFilter`, `matchesStageFilter`), including the "missing stage entry
  treated as null score", "empty filter matches everything", "lowConfOnly excludes null
  scores", and "range filter excludes null scores when any constraint is active" cases
  called out explicitly in the brief.
- `rederiveCaseRows`: correct recomputation of `finalVerdict`/label/score/hasErrors from
  raw blobs under current settings (no filesystem mocks needed, per the brief's guidance);
  failure path (missing keys → `null`/fallback label + `hasErrors: true`); and
  `stageOverrides` taking precedence over `stageDefaults`.
- `setFilter`/`clearFilter`/`clearAllFilters`, including the "stages replaces wholesale,
  does not merge nested keys" contract.
- `updateSettings`: merges the patch, recomputes `filteredRows` using the new threshold,
  and explicitly asserts it does NOT rederive `allCaseRows` (per the brief: rederive is a
  separate explicit call from SettingsPanel's Save button, Task 12).
- `openModal`/`closeModal`, `toggleSidebar`/`toggleSettingsPanel`/`setInsightsScope`.
- `loadDirectory`'s error path against the placeholder loader (always rejects → logs and
  resets `loadingProgress` to `null` without mutating `allCaseRows`).

Skipped per the brief: subtask 3.2 (property-based tests for filter logic) — explicitly
marked optional/deferred for this MVP pass.

## Verification run before commit

```
npm run build     → PASS (tsc -b + vite build, no errors)
npx vitest run     → PASS (4 test files, 51 tests total — 3 pre-existing files from
                      Task 2 + this task's new appStore.test.ts)
npm run lint        → PASS (oxlint, exit 0, no output)
```

## Known/expected state after this commit

- `src/hooks/useDirectoryLoader.ts` is a placeholder that always throws. This is
  intentional and matches the brief's explicit instructions. Task 4 must replace its body.
- `loadDirectory` cannot be exercised end-to-end (with real data) until Task 4 lands; only
  its error-handling branch is currently testable, which the test suite does exercise.
- `updateSettings` intentionally does not call `rederiveCaseRows()` — this is by design per
  the brief, wired up explicitly in Task 12's SettingsPanel Save button.
