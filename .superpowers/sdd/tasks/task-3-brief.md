# Task 3: Implement Zustand store

Project root: `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard`

## 3.1 Create `src/store/appStore.ts` — full Zustand store

Import types from `../lib/types` (`SettingsConfig`, `StageResult`, `CaseRow`, `FilterState`, `AppStore`, `DEFAULT_SETTINGS`).

The store must implement the `AppStore` interface exactly as defined in `src/lib/types.ts` (already implemented in Task 2 — read it, don't redefine it). Use `zustand`'s `create`.

**State slices:**
- `allCaseRows: CaseRow[]` — starts `[]`
- `stageColumns: string[]` — derived (see below)
- `loadingProgress: { done: number; total: number } | null` — starts `null`
- `settings: SettingsConfig` — starts as `DEFAULT_SETTINGS` (Task 4 will wire in localStorage-persisted settings via `usePersistedSettings`; for this task just default it in the store)
- `sidebarOpen: boolean` — starts `false` (collapsed by default per Req 2.1; Task 7 handles the actual persisted-to-localStorage version, this store field is just runtime toggle state)
- `settingsPanelOpen: boolean` — starts `false`
- `modalState: { caseId: string; fileName: string; json: unknown } | null` — starts `null`
- `filters: FilterState` — starts as:
  ```ts
  {
    caseIdText: '',
    finalVerdict: 'all',
    stages: {},
    hasErrorsOnly: false,
  }
  ```
- `insightsScope: 'filtered' | 'all'` — starts `'filtered'`

**Derived computations (implemented as store getters recomputed on relevant state changes, NOT React hooks/selectors — the derivation logic lives inside the store's `set`/action functions or is computed via a helper function called after every mutation that affects it):**

`stageColumns`: sorted union of all distinct `StageResult.fileName` values across every row in `allCaseRows`. Recompute (and store into state) whenever `allCaseRows` changes (i.e. inside `loadDirectory`'s final commit and inside `rederiveCaseRows`).

`filteredRows`: recomputed synchronously (store it as actual state, e.g. `filteredRows: CaseRow[]`, not a lazy getter — TanStack Table and other consumers read `useAppStore(s => s.filteredRows)` directly) using AND logic across all active filter predicates, applied to `allCaseRows`:

```ts
function applyAllFilters(rows: CaseRow[], filters: FilterState, settings: SettingsConfig): CaseRow[] {
  return rows.filter(row =>
    matchesCaseIdFilter(row, filters.caseIdText) &&
    matchesVerdictFilter(row, filters.finalVerdict) &&
    matchesHasErrorsFilter(row, filters.hasErrorsOnly) &&
    Object.entries(filters.stages).every(([fileName, stageFilter]) =>
      matchesStageFilter(row, fileName, stageFilter, settings.lowConfidenceThreshold)
    )
  );
}
```

Filter predicate semantics (write these as module-level helper functions in the same file, not inline):
- `matchesCaseIdFilter(row, text)`: if `text` is empty string, matches everything; else case-insensitive substring match — `row.caseId.toLowerCase().includes(text.toLowerCase())`.
- `matchesVerdictFilter(row, v)`: if `v === 'all'`, matches everything; else `row.finalVerdict === v`.
- `matchesHasErrorsFilter(row, hasErrorsOnly)`: if `hasErrorsOnly` is `false`, matches everything; else `row.hasErrors === true`.
- `matchesStageFilter(row, fileName, stageFilter, lowConfidenceThreshold)`: find `row.stages.find(s => s.fileName === fileName)`. If no such stage entry exists on the row, treat its score as `null`.
  - If `stageFilter.lowConfOnly` is true: score must be non-null and `score < lowConfidenceThreshold`.
  - Else, apply min/max range: if `stageFilter.min !== null`, require `score !== null && score >= stageFilter.min`. If `stageFilter.max !== null`, require `score !== null && score <= stageFilter.max`. If both min and max are null and lowConfOnly is false, this stage's filter entry matches everything (this covers the "filter opened but no values entered yet" case — an empty filter for a stage should not exclude rows). Null scores are excluded whenever ANY range constraint (min, max, or lowConfOnly) is active for that stage — per design Property 10.

Recompute `filteredRows` and write it into state every time `allCaseRows`, `filters`, or `settings` changes (settings changes affect `lowConfidenceThreshold` used by the stage filter).

**Actions to implement:**

- `loadDirectory(handle: FileSystemDirectoryHandle): Promise<void>` — for THIS task, just wire the action to delegate to a function you will import from `../hooks/useDirectoryLoader` (Task 4 implements the actual ingestion logic and will export a plain async function, e.g. `loadCaseRows(handle, settings, onProgress)`, that this store action calls). Since Task 4 doesn't exist yet, implement `loadDirectory` as a store action that:
  1. Sets `loadingProgress` appropriately during the load
  2. Calls out to the (not-yet-existing) loader — import from `'../hooks/useDirectoryLoader'` a function named `loadCaseRows` with this signature: `loadCaseRows(handle: FileSystemDirectoryHandle, settings: SettingsConfig, onProgress: (done: number, total: number) => void): Promise<CaseRow[]>`. This import will fail to resolve until Task 4 is implemented — that's expected and fine; document this dependency clearly in a comment and in your report. Do NOT stub out or fake the hook file yourself; leave the import in place for Task 4 to satisfy.
  3. On completion: sets `allCaseRows` to the result, recomputes `stageColumns` and `filteredRows`, sets `loadingProgress` to `null`.
  4. Errors from the loader should not crash the store — if `loadCaseRows` rejects (e.g., total ingestion failure), log to console and reset `loadingProgress` to `null` without setting `allCaseRows`.

- `rederiveCaseRows(): void` — re-applies `getByPath` (from `../lib/jsonPath`) to the already-parsed `raw`/`finalRaw` blobs on every row in `allCaseRows`, using the CURRENT `settings` in the store, producing a new `allCaseRows` array. This must NOT perform any filesystem I/O or call anything from `fsWalk.ts`. Recompute per row:
  - `finalVerdict`: `getByPath(row.finalRaw, settings.finalVerdict.valueKeyPath)` — coerce to `0 | 1 | null` (if the resolved value is exactly `0` or `1`, use it; otherwise `null`). If `undefined`, set `hasErrors: true`.
  - For each `StageResult` in `row.stages`: resolve `labelKeyPath`/`valueKeyPath` using `settings.stageOverrides[stage.fileName]` if present, else `settings.stageDefaults`. Recompute `label = getByPath(stage.raw, labelKeyPath)` (stringify or default to `stage.fileName` if resolution fails — see note below) and `score = getByPath(stage.raw, valueKeyPath)` (must be a `number`, else `null`).
  - Recompute `hasErrors` for the row: true if the finalVerdict resolution failed OR any stage's score/label resolution failed (any `getByPath` returned `undefined` for a configured path).
  - After rederiving all rows, recompute `stageColumns` and `filteredRows` and commit the new state.

- `openModal(caseId, fileName, json)`: sets `modalState = { caseId, fileName, json }`.
- `closeModal()`: sets `modalState = null`.
- `setFilter(update: Partial<FilterState>)`: shallow-merges `update` into `filters` (for the `stages` key, if `update.stages` is provided, merge it — see note below on merging nested stage filters), then recomputes `filteredRows`.
  - Note on `stages` merging: `FilterState.stages` is `Record<string, {min, max, lowConfOnly}>`. `setFilter` callers will pass the FULL desired `filters.stages` map when updating a single stage's filter (i.e., callers are responsible for spreading in the existing map and updating one key) OR they may pass a partial patch for one stage's key. To keep this simple and unambiguous: `setFilter` does a **shallow merge at the top level only** — `update.stages`, if present, REPLACES the entire `filters.stages` value (callers must pass the complete stages map they want). Document this contract clearly with a comment above `setFilter` so Task 8 (ColumnFilterHeader) implements it correctly.
- `clearFilter(key: keyof FilterState)`: resets that one filter key back to its default value (`caseIdText: ''`, `finalVerdict: 'all'`, `stages: {}`, `hasErrorsOnly: false`), then recomputes `filteredRows`.
- `clearAllFilters()`: resets the entire `filters` object to defaults, then recomputes `filteredRows`.
- `toggleSidebar()`: flips `sidebarOpen`.
- `toggleSettingsPanel()`: flips `settingsPanelOpen`.
- `setInsightsScope(scope)`: sets `insightsScope`.
- `updateSettings(patch: Partial<SettingsConfig>)`: shallow-merges `patch` into `settings`. Note: this action does NOT automatically call `rederiveCaseRows()` — the design says the SettingsPanel's "Save" button explicitly calls `store.rederiveCaseRows()` after `updateSettings` (Task 12 will wire this). Just merge the patch and recompute `filteredRows` (since `settings.lowConfidenceThreshold` affects stage filter matching).

_Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 4.6, 6.9_

---

## Notes for the implementer

- Skip subtask 3.2 (optional property tests for filter logic, marked `[ ]*`) — deferred for this MVP pass.
- DO write ordinary Vitest unit tests for the filter predicate helpers (`matchesCaseIdFilter`, `matchesVerdictFilter`, `matchesHasErrorsFilter`, `matchesStageFilter`) and for `rederiveCaseRows` (construct a fake `allCaseRows` with raw blobs, change settings, call `rederiveCaseRows`, assert the derived fields update correctly without needing any filesystem mocks). You can test store actions by importing `useAppStore` and calling `useAppStore.getState().someAction(...)` then reading `useAppStore.getState()`.
- Because `loadDirectory` imports `loadCaseRows` from `../hooks/useDirectoryLoader`, which doesn't exist until Task 4, `npm run build` (which runs `tsc -b`) WILL fail on this missing module after this task, until Task 4 lands. This is expected — note it explicitly in your report so the controller knows not to be alarmed. To keep your OWN task's tests runnable in isolation before Task 4 exists, you have two choices: (a) create a minimal placeholder file `src/hooks/useDirectoryLoader.ts` that exports a `loadCaseRows` stub throwing `Error('not implemented')` with the correct type signature (this lets `tsc -b` and your tests pass, and Task 4's implementer will overwrite this file with the real implementation), or (b) skip type-checking `loadDirectory` specifically. Prefer option (a) — create the placeholder file with just the exported function signature and a `throw new Error('not implemented — see Task 4')` body, so the whole project keeps building green after your commit. Document this placeholder clearly in your report and with a comment in the file so Task 4's implementer knows to replace it, not import around it.
- Run `npm run build` and `npx vitest run` before committing; both should be green (using the placeholder from the note above).
