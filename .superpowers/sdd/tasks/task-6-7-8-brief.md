# Tasks 6, 7, 8: ConfidenceBadge, AppShell, FolderPicker, ColumnFilterHeader

Project root: `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard`

Read `src/store/appStore.ts`, `src/lib/types.ts` first — all components below read from the Zustand store via `useAppStore` (default export or named export — check the actual export name in appStore.ts and use it consistently).

## Task 6: `src/components/ConfidenceBadge.tsx`

```tsx
interface ConfidenceBadgeProps {
  score?: number | null;
  verdict?: 0 | 1 | null;
  onClick?: () => void;
}
```

- `scoreToVariant(score, settings)`: score===null → 'neutral'; score>=highConfidenceThreshold → 'high'; score>=lowConfidenceThreshold → 'medium'; else 'low'.
- `verdictToVariant(verdict)`: null → 'neutral'; 1 → 'pass'; 0 → 'fail'.
- Read thresholds from `useAppStore(s => s.settings)`.
- Render a rounded pill using Tailwind custom tokens already defined in `tailwind.config.ts` (`highBg`/`highText`, `mediumBg`/`mediumText`, `lowBg`/`lowText`, `neutralBg`/`neutralText`). Since these color tokens use Tailwind's extended `colors` (not raw hex arbitrary values), classes like `bg-highBg text-highText` work directly — no `safelist` needed since they're not arbitrary-value classes.
- Score variant: show numeric score (e.g. "0.94") in monospace (`font-mono` class already defined in index.css, or Tailwind's `font-mono` from `fontFamily.mono`). Verdict variant: show "Pass"/"Fail"/"—" (for null) text, no monospace needed.
- `onClick` prop, if provided, makes the pill clickable (cursor-pointer, calls onClick on click).

## Task 7: `src/components/AppShell.tsx` and `src/components/FolderPicker.tsx`

**AppShell** — `{ children: React.ReactNode }`. Two-column flex layout: collapsible left sidebar + main content area (render `children` inside main).
- Sidebar width: 240px expanded, 56px collapsed (icon rail). Read `sidebarOpen` from store; toggle button calls `store.toggleSidebar()`.
- Persist collapse state to `localStorage` key `crd_sidebar` (boolean) — read on mount to initialize, write on every toggle. Default to collapsed (`sidebarOpen: false`, already the store default from Task 3) if no stored value.
- Sidebar contents (in order): root folder name/breadcrumb (read from a prop or store — for now accept an optional `rootFolderName?: string` prop, App.tsx will supply it in Task 13), "Change folder" button (accept an optional `onChangeFolder?: () => void` prop), nav links "Table" / "Insights" (plain anchor-style buttons, no real routing needed yet — just visually present, can be non-functional stubs or use simple local state to toggle a view — keep minimal), Settings entry pinned to bottom (button calling `store.toggleSettingsPanel()`).
- Also render "Re-select folder" and "Refresh" buttons that are ALWAYS visible regardless of sidebar collapse state (Req 1.11) — put them in a small top bar or always-visible sidebar footer. Accept optional `onReselectFolder?: () => void` and `onRefresh?: () => void` props for these (App.tsx wires real behavior in Task 13; stub to no-op if not provided).
- Use `lucide-react` icons: `FolderOpen`, `RefreshCw`, `Settings`, `ChevronRight` (or similar) at 16-18px.
- Apply the Notion palette: bg `#FFFFFF` (bg-bg), sidebar `bg-surface`, borders `border-border`, text `text-textPrimary`/`text-textMuted`.
- Render `<SettingsPanel />` here (import it — Task 12 will implement it; if it doesn't exist yet when you run this, create a minimal placeholder `src/components/SettingsPanel.tsx` that renders `null` for now, clearly commented "placeholder — Task 12 replaces this").

**FolderPicker** — no props. Centered card, "Select Case Folder" primary button + one-line helper text.
- On click: call `window.showDirectoryPicker()`, then `store.loadDirectory(handle)` (async — await it, or fire and let the store handle async internally; either is fine since `loadDirectory` is async).
- Catch rejection (user cancels picker → `AbortError`, just no-op/return silently; permission denied → show an inline error message below the button, don't crash).
- If a stored directory handle exists (check via `loadDirHandle()` + `queryDirHandlePermission()` from `src/lib/dirHandleStore.ts`, both already implemented in Task 4), show a "Reload last folder" secondary link ABOVE the primary button. Clicking it: if permission is `'granted'` or `'prompt'`, call `store.loadDirectory(handle)` directly (requesting permission via `handle.requestPermission({mode:'read'})` first if state is `'prompt'`); if `'denied'` or no handle, don't show the link at all.
- Run this permission check once on mount (`useEffect`).

## Task 8: `src/components/ColumnFilterHeader.tsx`

```tsx
interface ColumnFilterHeaderProps {
  columnId: string; // "caseId" | "finalVerdict" | a stage fileName
}
```

Reads `filters` and dispatches `store.setFilter`/`store.clearFilter` per the contract documented in `appStore.ts` (setFilter does a top-level shallow merge; the `stages` key REPLACES the whole map wholesale — so when updating one stage's filter, spread the existing `filters.stages` and override just that one key: `store.setFilter({ stages: { ...filters.stages, [columnId]: newStageFilterValue } })`).

- `columnId === 'caseId'`: debounced (150ms, use a simple `useEffect`+`setTimeout` or a small custom debounce) case-insensitive text input bound to `filters.caseIdText`. Calls `store.setFilter({ caseIdText: value })` after debounce.
- `columnId === 'finalVerdict'`: three-button toggle (All / Pass / Fail) calling `store.setFilter({ finalVerdict: 'all' | 1 | 0 })`.
- Otherwise (stage column): numeric min/max inputs + "Low conf only" checkbox/toggle, all writing into `filters.stages[columnId]` per the replace-wholesale pattern above. Read the current stage filter as `filters.stages[columnId] ?? { min: null, max: null, lowConfOnly: false }`.
- Render an active filter chip (blue-outlined pill, `border-accent text-accent`, with an "×" button calling `store.clearFilter(...)` — note `clearFilter` takes a `keyof FilterState`, i.e. `'caseIdText'`, `'finalVerdict'`, or `'stages'` — for a single stage's filter chip's "×", you'll need to clear just that one stage's entry: since `clearFilter('stages')` resets ALL stage filters to `{}`, and there's no per-stage clear action in the store, implement the per-stage "×" by calling `store.setFilter({ stages: { ...filters.stages, [columnId]: { min: null, max: null, lowConfOnly: false } } })` directly instead of `clearFilter`) shown beneath the header when that column's filter is active (i.e., `caseIdText !== ''`, `finalVerdict !== 'all'`, or the stage entry has any non-default value).
- Filter icon (`lucide-react` `Filter`) turns `text-accent` (`#2383E2`) when that column's filter is active, otherwise `text-textMuted`, visible on hover otherwise.

---

## Notes for the implementer

- No dedicated property/unit tests are required for these three purely-presentational-with-store-wiring components in this pass — focus on correctness and getting `npm run build` green. If you have time, a couple of quick Vitest + React Testing Library smoke tests are a bonus but not required (React Testing Library is NOT yet installed — skip component render tests rather than adding a new heavy dependency right now; pure-logic helpers like `scoreToVariant`/`verdictToVariant` CAN be unit tested without RTL if you export them).
- Move fast: reasonable defaults for anything unspecified. Don't over-engineer routing/navigation — the Table/Insights nav links can just be inert or toggle a trivial local view state; real view-switching isn't in scope for this task.
- Run `npm run build` before committing; it must be green (this requires Task 4's build-fix to have landed already — if `npm run build` still fails due to an unrelated pre-existing issue from another in-flight task, note it in your report but don't attempt to fix files outside your scope).
- Commit when done. Write a brief report to `.superpowers/sdd/tasks/task-6-7-8-report.md` and return the short status contract (Status/commit hash/test summary/concerns).
