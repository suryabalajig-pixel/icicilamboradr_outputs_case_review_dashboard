# Task 9, 10, 11 Report

## Status: DONE

## Summary
Implemented `CaseTable.tsx`, `InsightsBar.tsx`, `JsonDetailModal.tsx` per brief. `npm run build` passes (tsc -b + vite build, green).

## Judgment calls / notes
- CaseTable virtualization: used a hybrid approach — `useVirtualizer` computes offsets, but each virtual row is rendered as its own single-row `<table>` inside an absolutely-positioned wrapper div, since native `<tbody>`/`<tr>` don't support `position: absolute` cleanly for virtualization. This keeps column widths consistent because column `size` is applied via inline `style` on both header and body cells regardless of path (virtual/non-virtual share `renderRow`).
- Sticky pinned `caseId` column: implemented via `sticky left-0 z-10 bg-card` (cells) / `z-20 bg-surface` (header), rather than relying on TanStack's pinning offsets, since there's only one pinned column at position 0.
- InsightsBar: combined avg-confidence and low-conf-count into a single card per stage (`"0.82 avg · 3 low"`) rather than two separate cards, per the brief's "or combined into the same card" allowance.
- Stage label lookup for both CaseTable headers and InsightsBar cards uses `allCaseRows` (not `filteredRows`) so labels stay stable when the filtered set is empty, per the brief's instruction for Task 9 (applied same logic to Task 10 for consistency).
- JsonDetailModal: cast `json` (typed `unknown` in `modalState`) to `object` with `?? {}` fallback to satisfy `react-json-view-lite`'s `Object | any[]` prop type — a type-safety compromise since the modal's json is opaque at this layer by design.
- No new unit tests added, per brief's deferral note.

## Concerns
- None blocking. CaseTable's virtualized rendering path (nested single-row tables) is functional but not the most idiomatic virtualization pattern for `<table>` semantics; acceptable for MVP per brief's "reasonable judgment calls" allowance. Recommend a follow-up pass with browser testing (>100 rows) if strict accessibility/table semantics matter later.
