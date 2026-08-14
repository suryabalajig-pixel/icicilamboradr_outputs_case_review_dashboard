# Task 4: Implement useDirectoryLoader hook and persistence layer

Project root: `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard`

## 4.1 Implement `src/hooks/useDirectoryLoader.ts`

**IMPORTANT:** This file currently exists as a PLACEHOLDER created in Task 3, exporting a stub `loadCaseRows` that throws `Error('not implemented — see Task 4')`. You must REPLACE the body of this file with the real implementation, keeping the same exported function name and signature so `src/store/appStore.ts` (which already imports and calls it) continues to work unmodified:

```ts
export async function loadCaseRows(
  handle: FileSystemDirectoryHandle,
  settings: SettingsConfig,
  onProgress: (done: number, total: number) => void
): Promise<CaseRow[]>
```

Read `src/store/appStore.ts` first to see exactly how `loadCaseRows` is called from the `loadDirectory` action, so your signature and behavior match what the store already expects.

**Algorithm** (from the design doc):

```
1. Enumerate immediate children of `handle` using listSubdirectories() from ../lib/fsWalk → caseFolders[] (FileSystemDirectoryHandle[], caseId = handle.name)
2. Call onProgress(0, caseFolders.length) immediately
3. Process caseFolders in batches of 10 (Promise.all per batch):
   For each caseFolder:
     a. Try to get the file handle for "consolidated_final.json" directly in caseFolder (use caseFolder.getFileHandle("consolidated_final.json") — this can throw NotFoundError)
        - If found: readJsonFile() it → finalRaw. If getFileHandle or readJsonFile (JSON parse) throws, treat as missing/unparsable: finalRaw = null, mark error.
        - Resolve finalVerdict = getByPath(finalRaw, settings.finalVerdict.valueKeyPath); if undefined, treat as null and mark error. Coerce to `0 | 1 | null`: only exactly 0 or 1 count, otherwise null (and if the getByPath result was defined but not 0/1, still mark hasErrors since the configured path resolved to something unusable — treat this the same as "resolves to no value" per Req 1.10).
     b. Try to get the subdirectory handle for "stage_confidence" (caseFolder.getDirectoryHandle("stage_confidence") — can throw NotFoundError).
        - If the directory itself is missing: no stage results for this case, mark hasErrors: true, push an error detail string like "stage_confidence/ directory not found".
        - If found: use listJsonFiles(stageDirHandle, settings.excludedStageFiles) from ../lib/fsWalk to get the included stage file handles.
        - For each stage file handle: try to readJsonFile() it.
          - If read/parse fails: push a StageResult with fileName = handle.name, label = handle.name (fallback), score = null, raw = null; mark hasErrors: true; push an error detail.
          - If it succeeds: resolve labelKeyPath/valueKeyPath the same way appStore.ts's rederiveCaseRows does — check settings.stageOverrides[fileName] first, else settings.stageDefaults. label = getByPath(raw, labelKeyPath) (string; if undefined, fall back to the fileName without ".json" extension and mark hasErrors: true). score = getByPath(raw, valueKeyPath) (must be a number; if undefined or not a number, score = null and mark hasErrors: true).
          - Construct StageResult { fileName, label, score, raw }.
     c. Construct the CaseRow: { caseId: caseFolder.name, finalVerdict, finalRaw, stages: StageResult[], hasErrors, errorDetails: string[] }.
     d. Absorb ALL errors per-row — never let a single case folder's failure reject the whole batch or throw out of this function. Wrap each per-case-folder parse in its own try/catch (or ensure every internal step is individually guarded) so one bad case folder just gets hasErrors: true and reasonable defaults, never an uncaught exception.
4. After each batch completes: call onProgress(doneSoFar, caseFolders.length) where doneSoFar accumulates by batch.length.
5. Return the full CaseRow[] array once all batches are done.
```

**Concurrency:** Use `BATCH_SIZE = 10`. Process with a for-loop over batches of the caseFolders array, `await Promise.all(batch.map(parseCaseFolder))` per batch — this matches the design doc's performance section exactly (batched, not one giant `Promise.all` over everything, and not fully serial).

**Error handling contract (from design.md, must hold exactly):**
- `consolidated_final.json` not found → `hasErrors: true`, `finalVerdict: null`
- `stage_confidence/` directory not found → `hasErrors: true`, no stage results (`stages: []`)
- Individual stage file unreadable/unparsable → that `StageResult.score = null`, `hasErrors: true` (the StageResult entry still exists in the array with fileName/label fallback, per the algorithm above — this is necessary for Property 2, "the set of StageResult entries SHALL equal exactly the set of *.json files present minus excluded filenames," which must hold regardless of parse success)
- `getByPath` returns `undefined` for any configured path → `hasErrors: true`, value treated as `null`
- No unhandled exceptions escape `loadCaseRows` under any input.

_Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

Do NOT implement subtask 4.2 (optional property tests) — deferred per the plan's note on starred/optional tasks. DO write ordinary Vitest unit tests using mock `FileSystemDirectoryHandle`/`FileSystemFileHandle` objects (plain JS objects implementing just the methods used: `getFileHandle`, `getDirectoryHandle`, `values()`/`entries()`, `getFile()`, `.name`, `.kind`) covering: a folder with N valid case subfolders producing N CaseRows: happy path; a case folder missing `consolidated_final.json`; a case folder missing `stage_confidence/`; a stage file that fails to parse; a `getByPath` path that resolves to `undefined`. Also verify progress callback is invoked with increasing `done` values that reach `total` at the end.

## 4.3 Implement `src/hooks/usePersistedSettings.ts`

```ts
export function usePersistedSettings(): [SettingsConfig, (patch: Partial<SettingsConfig>) => void]
```

- On mount, read `localStorage.getItem('crd_settings')`. If present and valid JSON, `JSON.parse` it and shallow-merge over `DEFAULT_SETTINGS` (so newly-added default fields in a future app version aren't lost by an old stored config missing them) — use `{ ...DEFAULT_SETTINGS, ...parsed }`.
- If `localStorage` throws (e.g. private/incognito mode denies storage access) or the key is absent or JSON parsing fails, fall back to `DEFAULT_SETTINGS` — never let this hook throw or crash the app.
- Returns `[settings, updatePersistedSettings]` where `updatePersistedSettings(patch)` merges the patch into the in-memory settings state (React `useState`) AND writes the merged result back to `localStorage.setItem('crd_settings', JSON.stringify(merged))`, wrapped in try/catch so a write failure (private mode) doesn't throw — settings continue working in-memory for the session per design.md's error table.
- This is a standalone hook — it does not need to talk to the Zustand store directly in this task. Task 13 (wiring App.tsx) will be responsible for connecting this hook's initial value into `store.settings` on mount and calling `store.updateSettings` when persisted settings change, OR alternatively you may find it cleaner for this hook to just be the single source of truth used directly inside App.tsx later. Implement it as a pure, testable React hook exactly matching the signature above; do not import the Zustand store from this file.

_Requirements: 8.1, 8.2_

## 4.4 Implement directory handle persistence via `idb-keyval`

Do this as a small module, e.g. `src/lib/dirHandleStore.ts` (choose this exact path so Task 13 can predictably import it), exporting:

```ts
export async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void>
// set('crd_dir_handle', handle) via idb-keyval

export async function loadDirHandle(): Promise<FileSystemDirectoryHandle | undefined>
// get('crd_dir_handle') via idb-keyval

export async function queryDirHandlePermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState>
// handle.queryPermission({ mode: 'read' })
```

Wrap `idb-keyval` calls (`get`, `set` from `'idb-keyval'`) simply — no need for elaborate error handling beyond letting IndexedDB failures propagate as rejected promises (callers in Task 7/13 will decide how to handle "no stored handle" vs. an actual error — for this task just expose clean async wrappers). `loadDirHandle` returning `undefined` (idb-keyval's `get` resolves to `undefined` when the key is absent) is the normal "no stored folder yet" case, not an error.

Also wire `saveDirHandle` to be called automatically after a successful load: inside `src/store/appStore.ts`'s `loadDirectory` action (which you may edit), after `allCaseRows` is successfully set (i.e., `loadCaseRows` resolved without throwing), call `saveDirHandle(handle)` — fire-and-forget is fine (don't block the load on it, but do log a console warning if it rejects).

_Requirements: 8.3, 8.4, 8.5_

---

## Notes for the implementer

- `idb-keyval` is already installed (see `package.json`).
- Read `src/lib/fsWalk.ts`, `src/lib/jsonPath.ts`, and `src/lib/types.ts` (all from Task 2) before starting — you will use `listSubdirectories`, `listJsonFiles`, `readJsonFile`, `getByPath`, and the `CaseRow`/`StageResult`/`SettingsConfig` types directly.
- Read `src/store/appStore.ts` (Task 3) closely, especially the `rederiveCaseRows` action's label/score resolution logic (`resolveLabel`/`resolveScore` helpers) — your loader's stage resolution logic in 4.1 should produce results consistent with what `rederiveCaseRows` would later recompute from the same raw blobs, since both must agree on how `stageOverrides` vs `stageDefaults` are chosen.
- After this task, `npm run build` should go fully green (no more placeholder-loader failure) — this is your signal that Task 3's temporary placeholder has been correctly replaced.
- Run `npm run build` and `npx vitest run` before committing; both should be green.
