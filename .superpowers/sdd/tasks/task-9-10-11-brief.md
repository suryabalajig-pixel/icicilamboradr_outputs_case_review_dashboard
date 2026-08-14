# Tasks 9, 10, 11: CaseTable, InsightsBar, JsonDetailModal

Project root: `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard`

Read first: `src/store/appStore.ts` (exports the Zustand hook — check its actual name), `src/lib/types.ts`, `src/lib/insights.ts`, `src/components/ConfidenceBadge.tsx`, `src/components/ColumnFilterHeader.tsx` (all already implemented).

`@tanstack/react-table` v8, `@tanstack/react-virtual` v3, `react-json-view-lite` v2 are already installed.

## Task 9: `src/components/CaseTable.tsx`

- Read `filteredRows` and `stageColumns` from the store.
- Build TanStack Table v8 column definitions via `createColumnHelper<CaseRow>()`:
  - `caseId`: pinned left, monospace (`font-mono` class), size ~180.
  - `finalVerdict`: renders `<ConfidenceBadge verdict={row.finalVerdict} onClick={() => store.openModal(row.caseId, settings.finalVerdict.file, row.finalRaw)} />`.
  - One display column per `stageColumns` entry (already alphabetically sorted by the store), size ~150. Cell: find `row.stages.find(s => s.fileName === fileName)`; if found, render `<ConfidenceBadge score={stage.score} onClick={() => store.openModal(row.caseId, fileName, stage.raw)} />`; if not found, render a `MissingDataBadge` sub-component (simple neutral "⚠ missing data" pill).
  - Stage column headers: render `<ColumnFilterHeader columnId={fileName} />` but the HEADER TEXT shown inside/above it must be the resolved stage label, not the raw filename — use the label from ANY row that has that stage (e.g. `allCaseRows.find(...)?.stages.find(s => s.fileName === fileName)?.label ?? fileName`), since `stages[].label` was already resolved by the loader/store using `stageDefaults.labelKeyPath`/`stageOverrides`. Read `allCaseRows` from the store for this lookup (not just `filteredRows`, so the label is stable even when filtered to zero rows).
  - `caseId`/`finalVerdict` column headers: render `<ColumnFilterHeader columnId="caseId" />` / `columnId="finalVerdict"` with a plain text label ("Case ID" / "Final Verdict") above/beside it.
- Sorting: use TanStack's `getSortedRowModel()` and `useState` for `sorting` state; clicking a header cycles none→asc→desc (TanStack's built-in `column.toggleSorting()` behavior when you wire `onClick` on the header to call it — the default TanStack cycle when you call `header.column.getToggleSortingHandler()` on click is none→asc→desc→none, which satisfies "toggle sort order" from Req 3.12; use `header.column.getToggleSortingHandler()`).
- Sticky header row: `position: sticky; top: 0; z-index: 20` (Tailwind: `sticky top-0 z-20`, plus a background color so it's opaque over scrolled rows). Sticky Case ID column: use TanStack `columnPinning` (`{ left: ['caseId'] }`) plus `position: sticky; left: 0; z-index: 10` CSS on that column's cells/header.
- Row height fixed 44px (`h-11` in Tailwind is 44px, or use inline style). Hover background `#F7F6F5` → use `hover:bg-rowHover` (custom token already defined).
- Virtualization: use `useVirtualizer` from `@tanstack/react-virtual` with `overscan: 5`, `estimateSize: () => 44`, over a scrollable container ref. Activate ONLY when `filteredRows.length > 100` — for <=100 rows, render all rows directly without the virtualizer wrapper (simplest correct approach: branch your row-rendering JSX on `filteredRows.length > 100 ? renderVirtualized() : renderAllRows()`, sharing the same row-rendering sub-function for both paths).
- Empty state: when `filteredRows.length === 0` AND any filter is active (check `filters.caseIdText !== '' || filters.finalVerdict !== 'all' || filters.hasErrorsOnly || Object.keys(filters.stages).length > 0`), show centered muted message + "Reset all filters" button calling `store.clearAllFilters()`.
- No shadows, no zebra striping.

_Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.9, 3.10, 3.11, 3.12, 3.13 + virtualization 3.5, 9.3_

## Task 10: `src/components/InsightsBar.tsx`

- Import `passRate`, `avgConfidence`, `lowConfidenceCount`, `errorCount`, `stageInsights` from `src/lib/insights.ts`.
- Read `insightsScope` from store; compute `rows = insightsScope === 'all' ? allCaseRows : filteredRows`.
- Render a horizontal row of cards:
  1. "Total Cases" — `rows.length`.
  2. "Pass Rate" — `(passRate(rows) * 100).toFixed(0) + '%'`.
  3. Per-stage cards using `stageInsights(rows, stageColumns, settings.lowConfidenceThreshold)` (already sorted by lowCount descending) — for each stage in that result, one card showing avg confidence (or "—" if null) and one card (or combined into the same card) showing low-conf count. Use the resolved stage label (same lookup approach as Task 9: find any row's matching StageResult.label) instead of the raw filename for the card title.
  4. "Errors" card — `errorCount(rows)`; red text (`text-lowText` or a literal red via existing token) when > 0; onClick calls `store.setFilter({ hasErrorsOnly: true })`.
- Scope toggle ("Filtered" / "All Cases") in the header row of InsightsBar — two buttons, active one visually indicated (e.g. `bg-accent text-white` or underline), calling `store.setInsightsScope('filtered' | 'all')`.
- Card styling: `border border-border` (1px solid #E9E9E7), `p-4` to `p-5` (16-20px), muted uppercase label (`text-caption uppercase text-textMuted`) above a bold number (`text-heading font-semibold` or similar), no shadows.
- Re-renders automatically since it reads live store state — no special effort needed beyond correct store subscriptions.

_Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

## Task 11: `src/components/JsonDetailModal.tsx`

- Read `modalState` from store; `if (!modalState) return null;`.
- Render via `ReactDOM.createPortal(<...>, document.body)`.
- Backdrop: `fixed inset-0 bg-black/45` (rgba(0,0,0,0.45)), `onClick={() => store.closeModal()}` on the backdrop div only (not the dialog itself — stop propagation on the dialog or attach the click handler only to the backdrop element, not a parent wrapping both).
- Dialog: centered (flex container), `max-w-[720px]`, `rounded-lg` (or custom `rounded-md`/`8px`), `shadow-[0_8px_24px_rgba(0,0,0,0.12)]` (Tailwind arbitrary value syntax), white background.
- Header: exactly `Case {caseId} — {fileName}` as text (use an em dash "—", not a hyphen) + a close "×" button (or `lucide-react` `X` icon) calling `store.closeModal()`.
- Body: `<JsonView data={modalState.json} style={defaultStyles} shouldExpandNode={(level) => level < 2} />` from `react-json-view-lite` — remember to also `import 'react-json-view-lite/dist/index.css'` once (e.g. at the top of this file, or in `main.tsx` — either works, pick one and be consistent). Body must be independently scrollable: give it its own `overflow-y-auto` with a `max-height` (e.g. `max-h-[60vh]`) separate from the dialog's outer scroll.
- Footer: "Copy JSON" button — `navigator.clipboard.writeText(JSON.stringify(modalState.json, null, 2))` — plus "Done" button calling `store.closeModal()`.
- `Escape` key: `useEffect` adding a `keydown` listener on mount that calls `closeModal()` on `Escape`, removed on unmount/when modal closes.

_Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

---

## Notes for the implementer

- Move fast — this is an MVP push. Reasonable judgment calls on anything ambiguous; note them in your report.
- No new unit/property tests required for this task pass (deferred, matching the plan's optional-subtask notes for 9.3/9.4/11.2) — focus on `npm run build` passing and correct behavior.
- Run `npm run build` before committing; it must be green.
- Write your report to `.superpowers/sdd/tasks/task-9-10-11-report.md`. Commit directly on the current branch.
- Report contract: Status / commit hash(es) / one-line build summary / concerns.
