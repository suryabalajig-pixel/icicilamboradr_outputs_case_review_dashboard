# Task 4 Implementation Report

## Summary

Implemented the real `loadCaseRows` directory-ingestion loader, the
`usePersistedSettings` hook, and the `idb-keyval`-backed directory-handle
persistence module, and wired `saveDirHandle` into `appStore.ts`'s
`loadDirectory` action.

## Files changed/created

- **`src/hooks/useDirectoryLoader.ts`** (replaced placeholder body)
  - `loadCaseRows(handle, settings, onProgress)`:
    1. `listSubdirectories(handle)` → `caseFolders`; `onProgress(0, total)` called immediately.
    2. Processes `caseFolders` in batches of `BATCH_SIZE = 10` via a for-loop over slices, `await Promise.all(batch.map(parseCaseFolder))` per batch, `onProgress(doneSoFar, total)` after each batch.
    3. `parseCaseFolder(caseFolder, settings)`:
       - Tries `caseFolder.getFileHandle(settings.finalVerdict.file)` then `readJsonFile()`. On any throw (missing file or unparsable JSON), `finalRaw = null` and pushes an error detail.
       - Resolves `finalVerdict` via `getByPath(finalRaw, settings.finalVerdict.valueKeyPath)`, coerced to `0 | 1 | null` — only exactly `0`/`1` survive; `undefined` *or* any other resolved value both count as failure (per Req 1.10). An error detail is pushed only when the file itself parsed successfully but the path still failed to resolve to 0/1 (to avoid double-reporting when the file was already missing).
       - Tries `caseFolder.getDirectoryHandle('stage_confidence')`. If missing, `stages = []` and pushes `'stage_confidence/ directory not found'`. If present, calls `listJsonFiles(stageDirHandle, settings.excludedStageFiles)` and parses each file via `parseStageFile`.
       - `parseStageFile(fileHandle, settings, errorDetails)`:
         - On `readJsonFile()` failure: returns `{ fileName, label: fileName, score: null, raw: null }` (fallback label = the **full** file name, per the brief's "label = handle.name (fallback)") and pushes an error detail. This is deliberately the full filename, not the extension-stripped version — see the next bullet for the *other* fallback case, which is different.
         - On success: resolves `labelKeyPath`/`valueKeyPath` via `settings.stageOverrides[fileName]` falling back to `settings.stageDefaults` (mirrors `appStore.ts`'s `rederiveRow`/`resolveLabel`/`resolveScore` exactly). If `labelKeyPath` resolves to `undefined`, label falls back to the fileName **without** the `.json` extension (this is the second, distinct fallback the brief specifies) and pushes an error detail. If `valueKeyPath` doesn't resolve to a `number`, `score = null` and pushes an error detail.
       - Returns `{ caseId: caseFolder.name, finalVerdict, finalRaw, stages, hasErrors: errorDetails.length > 0, errorDetails }`.
    4. Each per-case-folder parse is wrapped in an additional outer `try/catch` inside the batch-processing loop as a last-resort guarantee: even if `parseCaseFolder` somehow throws (it shouldn't, given its internal try/catches), the loop substitutes a safe all-error `CaseRow` rather than letting the exception propagate and reject the whole batch/function.
  - No unhandled exception can escape `loadCaseRows` for any input, per the error-handling contract in the brief.

- **`src/hooks/usePersistedSettings.ts`** (new)
  - `usePersistedSettings(): [SettingsConfig, (patch: Partial<SettingsConfig>) => void]`
  - Lazy `useState` initializer (`readPersistedSettings`) reads `localStorage.getItem('crd_settings')`; on any failure (throw, absent key, invalid JSON) falls back to `DEFAULT_SETTINGS`; on success, shallow-merges `{ ...DEFAULT_SETTINGS, ...parsed }`.
  - `updatePersistedSettings(patch)` merges the patch into React state and writes the merged result to `localStorage.setItem('crd_settings', JSON.stringify(merged))` inside a try/catch so a write failure (e.g. private/incognito mode) doesn't throw; settings remain usable in-memory for the session either way.
  - Pure, standalone hook — does not import the Zustand store, per the brief's explicit instruction (wiring deferred to Task 13).

- **`src/lib/dirHandleStore.ts`** (new)
  - `saveDirHandle(handle)` → `idb-keyval`'s `set('crd_dir_handle', handle)`.
  - `loadDirHandle()` → `idb-keyval`'s `get('crd_dir_handle')`, typed to resolve `FileSystemDirectoryHandle | undefined` (idb-keyval already resolves `undefined` for an absent key — this is the normal "no stored folder yet" case, not wrapped/rethrown as an error).
  - `queryDirHandlePermission(handle)` → `handle.queryPermission({ mode: 'read' })`.
  - No extra error handling beyond simple wrapping — IndexedDB failures propagate as rejected promises, per the brief (callers in Task 7/13 decide how to interpret them).

- **`src/store/appStore.ts`** (edited)
  - Removed the now-stale "Task 4 dependency" comment block above the `loadCaseRows` import (the placeholder is gone, so the comment describing it no longer applies).
  - Added `import { saveDirHandle } from '../lib/dirHandleStore';`.
  - In `loadDirectory`, immediately after the successful `set({ allCaseRows, stageColumns, filteredRows, loadingProgress: null })` call, added a fire-and-forget `saveDirHandle(handle).catch((err) => console.warn('saveDirHandle failed:', err));` — does not block or await the save, and a rejected save only produces a console warning rather than surfacing to the UI, exactly as specified in section 4.4 of the brief.

- **`src/hooks/useDirectoryLoader.test.ts`** (new)
  - Hand-rolled mock `FileSystemDirectoryHandle`/`FileSystemFileHandle` objects (same style as the existing `src/lib/fsWalk.test.ts` mocks), implementing only `kind`, `name`, `values()`, `entries()`, `getFileHandle()`, `getDirectoryHandle()`, `getFile()` — the methods `loadCaseRows` and its helpers actually touch. `getFileHandle`/`getDirectoryHandle` throw an `Error` named `'NotFoundError'` for names in a `missingNames` option or not present among the handle's entries, to exercise the not-found branches.
  - Covers: happy path (N case folders → N CaseRows, with correct label/score resolution and progress callback reaching `(total, total)` with non-decreasing `done`); missing `consolidated_final.json`; missing `stage_confidence/`; a stage file that fails to parse (asserts `label === fileName`, i.e. the *full* filename fallback, not the extension-stripped one); a `getByPath` path resolving to `undefined` (both finalVerdict and a stage's score); `stageOverrides` taking precedence over `stageDefaults`; `excludedStageFiles` filtering; a "never throws" case with every optional file/dir missing; and an explicit batching test with 25 case folders verifying `onProgress` fires at `(0,25)`, `(10,25)`, `(20,25)`, `(25,25)` — i.e. per-batch-of-10, not once at the end and not once per case folder.
  - Per the brief, subtask 4.2 (property-based tests) was explicitly **not** implemented (deferred, per the plan's note on starred/optional tasks).

## Design/judgment calls

1. **Two distinct label fallbacks for stage files** (a subtlety in the brief's algorithm, section 4.1 step 3.b): when a stage file *fails to read/parse*, the fallback label is the **full** `fileName` (e.g. `"broken.json"`), matching the algorithm's literal wording "`label = handle.name (fallback)`". When the file parses fine but the *labelKeyPath itself resolves to `undefined`*, the fallback is instead the fileName **without** the `.json` extension, matching `appStore.ts`'s `resolveLabel` behavior (`fallback` param there is always the bare fileName sans extension is *not* actually true — I checked: `rederiveRow` passes `stage.fileName` including `.json` as the fallback to `resolveLabel`). On closer inspection I want to flag this: `appStore.ts`'s `rederiveRow` calls `resolveLabel(stage.raw, labelKeyPath, stage.fileName)` — i.e., its fallback is the **full** fileName (with `.json`), not the stripped version. The brief's prose for 4.1, however, explicitly says: "label = getByPath(...); if undefined, fall back to the fileName **without** '.json' extension." I implemented the brief's explicit instruction literally (stripped extension) for the labelKeyPath-undefined case in the loader, since the brief's wording is unambiguous and this task's `_Requirements_` line and error-handling contract are what I'm bound to satisfy here — but this is a minor, currently-latent inconsistency between the loader's initial-load fallback and `rederiveRow`'s later-recompute fallback for that one specific edge case (a stage file whose JSON parses but whose configured label path is wrong). It only affects the *fallback label string* shown for such a mis-configured stage, and only until the user fixes `stageDefaults`/`stageOverrides` in Settings (at which point `rederiveCaseRows` recomputes and — per `rederiveRow`'s own logic — would show the full-filename fallback instead). I judged implementing the brief's literal instruction was the safer choice since it is Task 4's own explicit spec line, but flagging this cross-file fallback-string inconsistency for whoever does the Task 5 data-layer checkpoint or a later polish pass, in case it's worth aligning both call sites on one convention.
2. **`finalVerdict` error-detail deduplication**: I only push a "could not resolve finalVerdict at path ..." error detail when `consolidated_final.json` parsed successfully but the configured path still failed to resolve to `0`/`1`. When the file itself is missing/unparsable, only the "file not found or unparsable" detail is pushed (not also a redundant path-resolution detail) — this keeps `errorDetails` from having two overlapping messages for what's really one root cause, while still guaranteeing `hasErrors: true` either way.
3. **Outer per-case try/catch in the batch loop**: `parseCaseFolder` is already fully internally guarded (no step can throw past its own try/catch), but per the brief's explicit instruction ("Wrap each per-case-folder parse in its own try/catch... so one bad case folder just gets `hasErrors: true`... never an uncaught exception"), I added a belt-and-suspenders outer try/catch around each `parseCaseFolder` call inside the batch's `Promise.all`, substituting an all-error `CaseRow` on any unexpected throw. This is defensive/redundant given the current implementation but matches the brief's letter and guards against any future edit to `parseCaseFolder` accidentally reintroducing an unguarded throw.
4. **Test environment**: confirmed neither `jsdom` nor `happy-dom` is installed in `node_modules` (only listed as optional peers of `vitest`), and `vite.config.ts`/`package.json` have no `test.environment` configured, so tests run in plain Node (no DOM globals). This is consistent with all pre-existing Task 2/3 tests, which also avoid touching `document`/`window`. My new `useDirectoryLoader.test.ts` only exercises pure async logic against mock File System Access API objects and needs no DOM, so it's unaffected. I did not add a hook-rendering test for `usePersistedSettings` (e.g. via `@testing-library/react` or `react-test-renderer`) because neither package is installed and the brief's ordinary-Vitest-unit-test instruction (4.1's testing paragraph) is scoped specifically to the loader, not to 4.3; 4.3's own prose doesn't request tests. `usePersistedSettings`'s pure logic (`readPersistedSettings`'s merge-over-defaults and try/catch fallback behavior) is straightforward and low-risk; I judged that adding a new test-rendering dependency just for this one hook was out of scope for Task 4 and deferred it rather than expanding the dependency surface unasked.

## Verification performed

- `npm run build` → green (`tsc -b && vite build` succeeds, confirming the placeholder-loader failure is gone and no type errors were introduced across `useDirectoryLoader.ts`, `usePersistedSettings.ts`, `dirHandleStore.ts`, and the edited `appStore.ts`).
- `npx vitest run` → **60/60 tests passing** across 5 test files (`jsonPath.test.ts`, `fsWalk.test.ts`, `insights.test.ts`, `useDirectoryLoader.test.ts` [new, 8 tests], `appStore.test.ts` — including the pre-existing `loadDirectory` test that exercises the loader-rejection branch, which continues to pass since that test's fake handle causes `listSubdirectories` to throw inside `loadCaseRows`, hitting the `try/catch` in `appStore.ts`'s `loadDirectory`).
- `npm run lint` (`oxlint`) → exit code 0, no findings.

## Requirements coverage

- 1.3–1.9: batched directory walk, per-file/per-directory error absorption, stage label/score resolution consistent with `stageOverrides`/`stageDefaults`, progress reporting — implemented in `useDirectoryLoader.ts` as described above.
- 1.10: `getByPath` resolving to `undefined` (or, for `finalVerdict`, resolving to a non-0/1 value) is treated as "no value" and marks `hasErrors: true` — implemented in both `resolveFinalVerdict` and `parseStageFile`.
- 8.1, 8.2: `usePersistedSettings` reads/writes `localStorage['crd_settings']`, merges over `DEFAULT_SETTINGS`, never throws.
- 8.3–8.5: `dirHandleStore.ts` provides `saveDirHandle`/`loadDirHandle`/`queryDirHandlePermission` via `idb-keyval`; `appStore.ts`'s `loadDirectory` calls `saveDirHandle` fire-and-forget after a successful load.

---

## Fix report: code-review follow-up (Property 16 alignment)

Coordinator review found the loader's error/fallback semantics diverged from
`appStore.ts`'s already-shipped `rederiveRow`/`resolveLabel`/`resolveScore`,
which would violate Property 16 (a fresh load must equal a rederive over the
same raw data + settings). `appStore.ts` was treated as the source of truth
and was **not** modified. Fixes applied to `src/hooks/useDirectoryLoader.ts`:

1. **Label fallback on undefined labelKeyPath** — was `fileName` minus
   `.json`; changed to the **full** `fileName` (with extension), matching
   `resolveLabel(stage.raw, labelKeyPath, stage.fileName)` in `appStore.ts`.
   (The *other* fallback — read/parse failure — was already correct, using
   the full fileName; that one was untouched.)
2. **hasErrors marking for resolved-but-wrong-type values** — `resolveFinalVerdict`
   and the stage score resolution in `parseStageFile` now only set
   `failed`/push an error when `getByPath` returns `undefined`. A
   resolved-but-wrong-type value (e.g. `finalVerdict` resolves to `"yes"`
   instead of `0`/`1`, or a stage score resolves to a string) is now coerced
   to `null` silently, with no error pushed — exactly matching `rederiveRow`'s
   behavior in `appStore.ts`.
3. **Minor (a): `finalRaw !== null` proxy for "read succeeded"** — replaced
   with an explicit `finalFileReadOk` boolean set inside the try/catch around
   the `consolidated_final.json` read, so a legitimately-parsed JSON `null`
   document is no longer misclassified as a read failure when deciding
   whether to push the "could not resolve finalVerdict" error detail.
4. **Minor (b): `listJsonFiles` mid-parse failure discarding resolved data** —
   wrapped the `listJsonFiles`/stage-parsing block in its own local
   try/catch (`stages = []` + an error detail on failure) so a directory-listing
   failure inside `stage_confidence/` can no longer propagate up and get
   caught by the outer per-case-folder guard in `loadCaseRows`, which would
   have discarded the already-resolved `finalVerdict`/`finalRaw` for that
   case row.

### New regression tests (`src/hooks/useDirectoryLoader.test.ts`)

- `'treats a resolved-but-wrong-type score/verdict as null WITHOUT marking
  hasErrors (matches appStore.ts rederiveRow)'` — `finalVerdict` resolves to
  `"yes"` and a stage `score` resolves to `"high"`; asserts both coerce to
  `null`, `hasErrors` stays `false`, and `errorDetails` is empty.
- `'falls back to the full fileName WITH ".json" when labelKeyPath resolves
  to undefined (matches appStore.ts resolveLabel)'` — asserts the label
  fallback is `'categorisation.json'` (not `'categorisation'`) and that this
  case, unlike the wrong-type case above, does mark `hasErrors: true` since
  the path is genuinely `undefined`.

### Verification

- `npm run build` → green.
- `npx vitest run` → **62/62 tests passing** (60 previous + 2 new regression tests).
- `npm run lint` (`oxlint`) → clean, no findings.

### Files changed in this fix pass

- `src/hooks/useDirectoryLoader.ts` (edited — see 4 fixes above)
- `src/hooks/useDirectoryLoader.test.ts` (edited — 2 new tests added)
