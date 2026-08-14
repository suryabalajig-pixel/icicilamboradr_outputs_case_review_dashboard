# Tasks 12, 13: SettingsPanel, and wiring App.tsx/main.tsx

Project root: `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard`

Read first: `src/store/appStore.ts` (Zustand hook — confirm export name), `src/lib/types.ts`, `src/hooks/usePersistedSettings.ts`, `src/lib/dirHandleStore.ts`, `src/components/AppShell.tsx` (currently renders a PLACEHOLDER `SettingsPanel` that returns `null` — you will replace `src/components/SettingsPanel.tsx` entirely and AppShell's import of it should keep working unmodified), `src/components/FolderPicker.tsx`, `src/components/CaseTable.tsx`, `src/components/InsightsBar.tsx`, `src/components/JsonDetailModal.tsx`.

## Task 12: `src/components/SettingsPanel.tsx`

Replace the placeholder file entirely (same path, same default export/component name so `AppShell.tsx`'s existing import keeps working — check what AppShell currently imports and match it).

- `position: fixed` right-side slide-over, `w-[400px]`, full height, `bg-card` background, `border-l border-border`, high z-index so it overlays without dimming/blocking the rest of the page (no backdrop overlay — this is explicitly non-blocking per Req 6.1). Visible only when `store.settingsPanelOpen` is true; otherwise render `null` (or translate off-screen — either is fine, `null` is simplest). Close button (`X` icon or "×") calling `store.toggleSettingsPanel()`.
- Local component state holds a DRAFT copy of `store.settings` (initialize from it when the panel opens/mounts) so edits don't commit to the store until "Save" is clicked. Use `useState` seeded from `store.settings`, and re-seed it when `settingsPanelOpen` transitions from false→true (so reopening shows current saved settings, not stale edits) — a `useEffect` keyed on `settingsPanelOpen` works.

**Section 1 — Final Verdict:** text input bound to draft `finalVerdict.valueKeyPath`. Live preview below it: resolve `getByPath(allCaseRows[0]?.finalRaw, draftValueKeyPath)` (import `getByPath` from `../lib/jsonPath`, read `allCaseRows` from the store) and display the result (or "no cases loaded yet" / "path not found" as appropriate) so the reviewer can verify correctness before saving.

**Section 2 — Stage Defaults:** text inputs for draft `stageDefaults.labelKeyPath` and `stageDefaults.valueKeyPath`.

**Section 3 — Per-Stage Overrides:** one collapsible row per entry in `store.stageColumns` (the discovered stage filenames), initially collapsed (use local `useState<Record<string, boolean>>` for expand/collapse, or a `<details>` element which gives you free collapse behavior). Each row: the stage filename as the row header/label, and when expanded, two optional text inputs (labelKeyPath override, valueKeyPath override) bound to `draft.stageOverrides[fileName]?.labelKeyPath` / `?.valueKeyPath` (empty string means "no override, use default" — when saving, omit empty-string overrides from the saved `stageOverrides` map entirely rather than storing empty strings, so `stageDefaults` cleanly applies as fallback).

**Section 4 — Thresholds:** numeric inputs (`type="number"`, `min={0}`, `max={1}`, `step={0.01}`) for draft `lowConfidenceThreshold` and `highConfidenceThreshold`.

**Section 5 — Excluded Stage Files:** chip input (a text field + "Add" button/Enter-to-add, rendering each entry in `draft.excludedStageFiles` as a removable chip with an "×") pre-filled with the current draft list (which defaults to `["summary.json"]` from `DEFAULT_SETTINGS`).

**Footer actions:**
- **Save**: calls `store.updateSettings(draft)` then `store.rederiveCaseRows()`, in that order (so rederive picks up the new settings) — also persist to `localStorage` key `crd_settings` directly (`localStorage.setItem('crd_settings', JSON.stringify(draft))`, wrapped in try/catch) so the change survives a reload even though `usePersistedSettings` (Task 4) isn't wired into this specific save path — this component may write directly to that key for simplicity, no need to route through the `usePersistedSettings` hook itself here.
- **Export Config**: builds a `Blob` from `JSON.stringify(draft, null, 2)`, creates an object URL, and triggers a download named `dashboard-config.json` (create an `<a>` element, set `href`/`download`, `.click()`, then revoke the URL).
- **Import Config**: a hidden `<input type="file" accept=".json,application/json">` triggered by a visible "Import Config" button; on file select, read it via `FileReader`/`.text()`, `JSON.parse`, merge over `DEFAULT_SETTINGS` (`{ ...DEFAULT_SETTINGS, ...parsed }`) defensively in case the imported file is missing fields, set it as the new draft AND immediately call `store.updateSettings(merged)` + `store.rederiveCaseRows()` (import should apply immediately per Req 6.11, not require a separate Save click) + persist to localStorage same as Save.

_Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12_

## Task 13: Wire `App.tsx` and `main.tsx`

`main.tsx`: should already just mount `<App />` via `ReactDOM.createRoot` on `#root` — verify it does, leave as-is unless something is actually broken.

`App.tsx`: replace the current scaffold placeholder content entirely.

- On mount (`useEffect`, once): 
  1. Call `usePersistedSettings()` (from `../hooks/usePersistedSettings`) to get `[persistedSettings, updatePersistedSettings]`, and call `store.updateSettings(persistedSettings)` once on initial mount to seed the store from localStorage (the store itself defaults to `DEFAULT_SETTINGS`; this hook may have loaded a saved override — reconcile them once at startup). Note: `usePersistedSettings` already handles the localStorage read/fallback internally; you're just pushing its initial value into the store.
  2. Call `loadDirHandle()` (from `../lib/dirHandleStore`) — if it resolves to a handle, call `queryDirHandlePermission(handle)`; store the `{ handle, permission }` result in local `App` state so `FolderPicker` can offer "Reload last folder" (FolderPicker from Task 7 already implements this check internally via the same two functions — confirm by reading `FolderPicker.tsx`; if it already does its own mount-time check, you do NOT need to duplicate that logic in App.tsx, just make sure App.tsx doesn't fight it. Read FolderPicker.tsx first to decide whether this App-level step is redundant.).
- Render `<AppShell rootFolderName={...} onChangeFolder={...} onReselectFolder={...} onRefresh={...}>` wrapping the main content, passing through whatever props `AppShell` actually declared in Task 7 (read `AppShell.tsx`'s prop types first) — wire real behavior: `onReselectFolder`/`onChangeFolder` should re-invoke the folder picker flow (can literally call the same `showDirectoryPicker()` + `store.loadDirectory()` sequence used in `FolderPicker`), `onRefresh` should re-run `store.loadDirectory(currentHandle)` using the last-loaded handle (keep it in App state or read it back via `loadDirHandle()`).
- Inside AppShell's children, render:
  - `<FolderPicker />` when `store.allCaseRows.length === 0 && store.loadingProgress === null`.
  - A loading progress indicator ("Parsing {done} / {total} cases…") when `store.loadingProgress !== null`.
  - Otherwise (cases loaded), render `<DashboardView />` — a small inline component/JSX block containing `<InsightsBar />` stacked above `<CaseTable />`.
- Render `<JsonDetailModal />` at the top level (outside/alongside AppShell's children, since it portals to `document.body` anyway — placement in the tree doesn't matter much, but keep it simple, e.g. as a sibling of `<AppShell>`).
- `SettingsPanel` is already rendered INSIDE `AppShell` (per Task 7's implementation) — do not render it again in App.tsx.

_Requirements: 1.1, 1.6, 2.1, 8.2, 8.4_

---

## Notes for the implementer

- This is the integration task — after this, the app should be usable end-to-end (modulo needing an actual Chromium browser + real folder to fully test the FS Access API path, which you can't do in this environment). Focus on making sure all the pieces wire together with correct prop names/types and the build passes.
- Move fast, MVP push. Reasonable judgment calls on ambiguity, noted in your report.
- No new tests required for this integration pass.
- Run `npm run build` before committing — it MUST be green, this is the main signal of correct wiring (TypeScript will catch prop-mismatch errors between AppShell/FolderPicker/etc. and how App.tsx calls them).
- Also run `npm run dev` briefly (start it in the background, curl `http://localhost:5173` or whatever port Vite reports to confirm it serves an HTML response without a build error, then stop it) as a basic smoke check — you don't need to interact with the File System Access API (that requires a real browser + user gesture), just confirm the dev server boots and serves the page without a runtime error page.
- Write your report to `.superpowers/sdd/tasks/task-12-13-report.md`. Commit directly on the current branch.
- Report contract: Status / commit hash(es) / one-line build summary / concerns.
