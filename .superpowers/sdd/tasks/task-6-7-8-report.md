# Tasks 6, 7, 8 Report

## Implemented
- `src/components/ConfidenceBadge.tsx` — exports `scoreToVariant`, `verdictToVariant`, and default `ConfidenceBadge` component. Reads thresholds from `useAppStore(s => s.settings)`. Uses `highBg/highText`, `mediumBg/mediumText`, `lowBg/lowText`, `neutralBg/neutralText` tokens. Score variant renders monospace fixed-2-decimal; verdict variant renders Pass/Fail/—.
- `src/components/AppShell.tsx` — collapsible sidebar (240px/56px), persists to `localStorage['crd_sidebar']`, reads/toggles `sidebarOpen` via store. Sidebar contains root folder name (prop), Change folder button, Table/Insights nav (trivial local state toggle, no real routing per brief), and a footer with always-visible Re-select folder / Refresh / Settings buttons (Settings calls `store.toggleSettingsPanel()`). Renders `<SettingsPanel />`.
- `src/components/SettingsPanel.tsx` — placeholder returning `null`, clearly commented as a Task 12 stand-in.
- `src/components/FolderPicker.tsx` — centered card with primary "Select Case Folder" button (`window.showDirectoryPicker()` → `store.loadDirectory(handle)`), catches `AbortError` silently, shows inline error otherwise. On mount, checks `loadDirHandle()` + `queryDirHandlePermission()`; shows "Reload last folder" link above the primary button only when permission is `granted`/`prompt` (requests permission if `prompt`), hidden entirely if `denied` or no handle.
- `src/components/ColumnFilterHeader.tsx` — dispatches on `columnId`:
  - `caseId`: 150ms debounced text input, active-filter chip with clear button.
  - `finalVerdict`: All/Pass/Fail toggle buttons, active-filter chip.
  - stage columns: min/max numeric inputs + "Low conf only" checkbox, using the documented `stages` wholesale-replace pattern (`setFilter({ stages: { ...filters.stages, [columnId]: ... } })`); per-stage "×" resets that one entry to defaults directly (no `clearFilter('stages')` since that would wipe all stages).
  - Filter icon (`lucide-react` `Filter`) turns `text-accent` when that column's filter is active, `text-textMuted` otherwise.

## Verification
- `npm run build` (tsc -b && vite build) — green, no errors.
- No RTL smoke tests added per brief guidance (RTL not installed, not required this pass). Pure helpers (`scoreToVariant`/`verdictToVariant`) are exported for future unit testing but no test file was added in this pass.

## Concerns
- None blocking. `AppShell`'s Table/Insights nav is intentionally a no-op local-state toggle per brief scope — real routing/view switching is out of scope until later tasks.
- `SettingsPanel` is a stub; Task 12 will replace it.
