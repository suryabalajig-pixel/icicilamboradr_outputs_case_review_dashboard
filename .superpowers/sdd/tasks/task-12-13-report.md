# Task 12 & 13 Report — SettingsPanel + App.tsx/main.tsx wiring

## Summary

Implemented the final integration pass for the Case Review Dashboard.

### Task 12 — `src/components/SettingsPanel.tsx`

Replaced the placeholder with a full slide-over settings panel:

- `position: fixed`, right-anchored, `w-[400px]`, full height, `bg-card`,
  `border-l border-border`, `z-[60]` (no backdrop — non-blocking per Req 6.1).
  Renders `null` when `store.settingsPanelOpen` is false.
- Draft state (`useState<SettingsConfig>`) seeded from `store.settings`,
  re-seeded via a `useEffect` keyed on `settingsPanelOpen` transitioning to
  `true`.
- Section 1 (Final Verdict): text input for `finalVerdict.valueKeyPath` with
  a live preview resolved via `getByPath(allCaseRows[0]?.finalRaw, ...)`,
  showing `"no cases loaded yet"` / `"path not found"` / the JSON-stringified
  resolved value.
- Section 2 (Stage Defaults): text inputs for `stageDefaults.labelKeyPath` /
  `valueKeyPath`.
- Section 3 (Per-Stage Overrides): one collapsible row per entry in
  `store.stageColumns`, using local `useState<Record<string, boolean>>` for
  expand/collapse (plain divs + a toggle button rather than `<details>`, for
  easier styling control). Empty-string overrides are stripped from the
  saved `stageOverrides[fileName]` object (and the whole key is deleted if
  both fields end up empty), so `stageDefaults` cleanly falls back per the
  brief.
- Section 4 (Thresholds): numeric inputs, `min={0} max={1} step={0.01}`.
- Section 5 (Excluded Stage Files): chip list + text input + "Add" button,
  Enter-to-add, "×" to remove, no duplicate entries.
- Footer: **Save** (`updateSettings(draft)` → `rederiveCaseRows()` →
  `localStorage.setItem('crd_settings', ...)` in a try/catch), **Export
  Config** (Blob → object URL → temporary `<a download>` → revoke),
  **Import Config** (hidden file input behind a styled `<label>`, reads via
  `file.text()` + `JSON.parse`, merges over `DEFAULT_SETTINGS`, applies
  immediately: sets draft, calls `updateSettings` + `rederiveCaseRows`, and
  persists to localStorage — with a visible error message on parse
  failure).

### Task 13 — `App.tsx` / `main.tsx`

- `main.tsx`: verified it already just mounts `<App />` via
  `createRoot(...).render(<StrictMode><App /></StrictMode>)` — left
  unchanged.
- `App.tsx`: replaced the Vite scaffold placeholder entirely.
  - On mount (`useEffect`, once): calls `usePersistedSettings()` and pushes
    the loaded value into the store via `store.updateSettings(...)`; also
    calls `loadDirHandle()` + `queryDirHandlePermission()` to recall the
    last-used directory handle, storing it in a `useRef` (not `useState`,
    since it's an imperative handle only used by `onRefresh`/`onReselect`,
    not rendered) and capturing `handle.name` into local state for
    `rootFolderName`.
  - Renders `<AppShell rootFolderName={...} onChangeFolder={pickFolder} onReselectFolder={pickFolder} onRefresh={handleRefresh}>` — `onChangeFolder` and
    `onReselectFolder` both point at the same `pickFolder` function (invokes
    `showDirectoryPicker()` + `store.loadDirectory()`), since AppShell
    exposes both as conceptually-identical actions and the brief didn't
    distinguish a separate behavior for them.
  - Inside AppShell's children: `<FolderPicker />` when no rows loaded and
    not currently loading; a `"Parsing {done} / {total} cases…"` indicator
    while `loadingProgress !== null`; otherwise `<DashboardView />` (inline
    component rendering `<InsightsBar />` above `<CaseTable />`, matching
    AppShell's flex-column/overflow-auto shell).
  - `<JsonDetailModal />` rendered as a sibling of `<AppShell>` (it portals
    to `document.body` regardless of tree position).
  - Did **not** render `SettingsPanel` in `App.tsx` — confirmed it's already
    rendered inside `AppShell.tsx` (Task 7's implementation).

## Deviations / judgment calls

1. **Per-stage override rows use styled `<div>` + button toggles instead of
   `<details>`** — gives full control over the closed/open chevron
   indicator (▸/▾) and styling consistent with the rest of the panel; the
   brief explicitly allowed either approach.
2. **`onChangeFolder` and `onReselectFolder` both wired to the same
   `pickFolder` handler** — AppShell's sidebar has two separate buttons
   ("Change folder" and "Re-select folder") but the brief's description of
   both behaviors is identical (re-invoke the picker flow), so no
   distinction was introduced.
3. **Last directory handle kept in a `useRef`, not `useState`** — it's never
   rendered directly (only `handle.name` is, via a separate `rootFolderName`
   state), so a ref avoids an unnecessary re-render on every mount-time
   handle recall.
4. Confirmed `FolderPicker.tsx` already performs its own independent
   mount-time `loadDirHandle()` / `queryDirHandlePermission()` check for its
   "Reload last folder" link — App.tsx's own recall logic does not
   interfere with it; they run independently and both derive from the same
   IndexedDB-backed handle store.

## Verification

- `npm run build` (`tsc -b && vite build`) — **green**, no TypeScript or
  build errors. Output: `dist/index.html`, `dist/assets/index-*.css`,
  `dist/assets/index-*.js` (303.96 kB / 91.20 kB gzip).
- `npm run dev` — started in background, `curl -s -o /dev/null -w '%{http_code}'
  http://localhost:5173` returned `200`, and the served HTML included the
  expected Vite/React dev scaffold (`<div id="root">`, `/src/main.tsx`
  module script) with no runtime error overlay. Dev server process was then
  stopped.

## Files changed

- `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard\src\components\SettingsPanel.tsx` (full rewrite)
- `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard\src\App.tsx` (full rewrite)
- `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard\.superpowers\sdd\tasks\task-12-13-report.md` (this report)
