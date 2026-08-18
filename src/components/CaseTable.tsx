import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../store/appStore';
import ConfidenceBadge from './ConfidenceBadge';
import ColumnFilterHeader from './ColumnFilterHeader';
import type { CaseRow } from '../lib/types';

function MissingDataBadge() {
  return (
    <span className="inline-flex items-center rounded-lg bg-neutralBg px-2 py-0.5 text-caption text-neutralText">
      ⚠ missing data
    </span>
  );
}

const columnHelper = createColumnHelper<CaseRow>();

// ─── ConfidencePill ───────────────────────────────────────────────────────────

function ConfidencePill({
  score,
  low,
  high,
}: {
  score: number | null;
  low: number;
  high: number;
}) {
  if (score === null) return <span className="text-textMuted">—</span>;

  const colorClass =
    score >= high
      ? 'bg-green-100 text-green-800'
      : score >= low
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-700';

  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 font-mono text-caption font-semibold ${colorClass}`}>
      {(score * 100).toFixed(1)}%
    </span>
  );
}

// ─── AmountsMatchCell ─────────────────────────────────────────────────────────
// Clicking the true/false pill filters the table to that value.
// A separate ⓘ info button opens the popover showing both amounts.

function AmountsMatchCell({
  amountMismatch,
  extractedAmount,
  calculatedAmount,
  isFiltered,
  onFilterMatch,
  onFilterMismatch,
  onClearFilter,
}: {
  amountMismatch: boolean;
  extractedAmount: number | null;
  calculatedAmount: number | null;
  isFiltered: boolean;
  onFilterMatch: () => void;
  onFilterMismatch: () => void;
  onClearFilter: () => void;
}) {
  const [open, setOpen] = useState(false);

  const match = !amountMismatch;

  const fmt = (v: number | null) =>
    v === null
      ? '—'
      : `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePillClick = () => {
    if (isFiltered) {
      onClearFilter();
    } else if (match) {
      onFilterMatch();
    } else {
      onFilterMismatch();
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* Pill — click to filter / clear filter */}
      <button
        type="button"
        onClick={handlePillClick}
        title={isFiltered ? 'Click to clear filter' : `Click to filter by amounts_match=${match}`}
        className={[
          'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-caption font-semibold transition-all hover:opacity-80 focus:outline-none',
          match ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700',
          isFiltered ? 'ring-2 ring-accent ring-offset-1' : '',
        ].join(' ')}
      >
        {match ? 'true' : 'false'}
        {isFiltered && <span className="ml-1 text-accent">✕</span>}
      </button>

      {/* ⓘ info button — opens amount detail popover */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="View extracted & calculated amounts"
        className="rounded px-0.5 text-[11px] text-textMuted hover:text-textPrimary focus:outline-none"
      >
        ⓘ
      </button>

      {/* Popover */}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 min-w-[220px] rounded-lg border border-border bg-card p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-caption font-semibold text-textPrimary">Amount Details</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-textMuted hover:text-textPrimary"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-caption text-textMuted">Extracted</span>
                <span className="font-mono text-caption font-semibold text-textPrimary">
                  {fmt(extractedAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-caption text-textMuted">Calculated</span>
                <span className="font-mono text-caption font-semibold text-textPrimary">
                  {fmt(calculatedAmount)}
                </span>
              </div>
              {!match && extractedAmount !== null && calculatedAmount !== null && (
                <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-1">
                  <span className="text-caption text-red-600">Difference</span>
                  <span className="font-mono text-caption font-semibold text-red-700">
                    {fmt(Math.abs(extractedAmount - calculatedAmount))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── BillTypeMatchCell ────────────────────────────────────────────────────────

function BillTypeMatchCell({ counts }: { counts: CaseRow['billTypeMatchCounts'] }) {
  const total = counts.vectorSearch + counts.llmSelect;
  if (total === 0) {
    return <span className="text-textMuted">-</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 font-mono text-caption">
      <span>VS: {counts.vectorSearch}</span>
      <span>LLM: {counts.llmSelect}</span>
    </div>
  );
}

// ─── TokenSummaryCell ─────────────────────────────────────────────────────────

function TokenSummaryCell({ summary }: { summary: CaseRow['tokenSummary'] }) {
  if (
    summary.totalTokensIn === null &&
    summary.totalTokensOut === null &&
    summary.overallTotalTokens === null
  ) {
    return <span className="text-textMuted">-</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 font-mono text-caption">
      <span>In: {(summary.totalTokensIn ?? 0).toLocaleString()}</span>
      <span>Out: {(summary.totalTokensOut ?? 0).toLocaleString()}</span>
      <span>Total: {(summary.overallTotalTokens ?? 0).toLocaleString()}</span>
    </div>
  );
}

// ─── StageCell ────────────────────────────────────────────────────────────────

function StageCell({
  score,
  issueCount,
  highSeverityCount,
  onClick,
}: {
  score: number | null;
  issueCount: number;
  highSeverityCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded hover:opacity-80 focus:outline-none"
    >
      {score === null ? (
        <span className="text-textMuted">—</span>
      ) : (
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-caption font-semibold ${
            score >= 0.95
              ? 'bg-green-100 text-green-800'
              : score >= 0.85
                ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-700'
          }`}
        >
          {(score * 100).toFixed(0)}%
        </span>
      )}

      {issueCount > 0 ? (
        <>
          <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-caption text-slate-600">
            {issueCount}<span className="opacity-70">iss</span>
          </span>
          {highSeverityCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-caption font-semibold text-red-700">
              {highSeverityCount}<span className="font-normal opacity-80">H</span>
            </span>
          )}
        </>
      ) : (
        score !== null && <span className="text-caption text-green-600">✓</span>
      )}
    </button>
  );
}

// ─── FailCauseCell ────────────────────────────────────────────────────────────
// Renders each fail cause on its own line. For causes that carry stage-level
// details (e.g. "Low confidence" → which stages scored low), an ⓘ button opens
// a popover listing those stages — mirroring the AmountsMatchCell pattern.

function FailCauseCell({ details }: { details: CaseRow['failCauseDetails'] }) {
  const [openCause, setOpenCause] = useState<string | null>(null);

  if (details.length === 0) {
    return <span className="text-textMuted">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {details.map((d) => (
        <div key={d.label} className="flex items-center gap-1">
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-caption font-medium text-red-700">
            {d.label}
          </span>
          {d.stages.length > 0 && (
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => setOpenCause(openCause === d.label ? null : d.label)}
                title={`View stages with ${d.label.toLowerCase()}`}
                className="rounded px-0.5 text-[11px] text-textMuted hover:text-textPrimary focus:outline-none"
              >
                ⓘ
              </button>
              {openCause === d.label && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setOpenCause(null)} />
                  <div className="absolute left-0 top-full z-40 mt-1 min-w-[180px] rounded-lg border border-border bg-card p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-caption font-semibold text-textPrimary">
                        Low confidence stages
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenCause(null)}
                        className="text-textMuted hover:text-textPrimary"
                      >
                        ✕
                      </button>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {d.stages.map((stage) => (
                        <li
                          key={stage}
                          className="rounded bg-amber-100 px-2 py-0.5 text-caption font-medium text-amber-700"
                        >
                          {stage}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── AmountToleranceSlider ────────────────────────────────────────────────────
// Compact tolerance slider for the amounts_match column header. The thumb
// tracks a local state so dragging stays buttery-smooth; the expensive
// re-derivation (which recomputes every row's amountMismatch) is debounced
// and only fires after the user stops moving for a moment.

function AmountToleranceSlider() {
  const amounts = useAppStore((s) => s.settings.amounts);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const rederiveCaseRows = useAppStore((s) => s.rederiveCaseRows);

  const [value, setValue] = useState(amounts.tolerance);
  const [dragging, setDragging] = useState(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the local thumb in sync when the stored tolerance changes from
  // elsewhere (e.g. Settings panel save).
  useEffect(() => {
    if (!dragging) setValue(amounts.tolerance);
  }, [amounts.tolerance, dragging]);

  // Clear any pending commit when unmounting.
  useEffect(() => () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
  }, []);

  const commit = (next: number) => {
    updateSettings({ amounts: { ...amounts, tolerance: next } });
    rederiveCaseRows();
  };

  const handleChange = (next: number) => {
    setValue(next);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commit(next), 250);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <label className="flex items-center justify-between text-caption text-textMuted">
        <span>Tolerance</span>
        <span className="font-mono">₹{value}</span>
      </label>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => handleChange(Number(e.target.value))}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => {
          setDragging(false);
          if (commitTimer.current) clearTimeout(commitTimer.current);
          commit(value);
        }}
        title="Amount match tolerance — max ₹ difference treated as a match"
        className="w-full accent-accent"
      />
    </div>
  );
}

export default function CaseTable() {
  const filteredRows = useAppStore((s) => s.filteredRows);
  const allCaseRows = useAppStore((s) => s.allCaseRows);
  const stageColumns = useAppStore((s) => s.stageColumns);
  const settings = useAppStore((s) => s.settings);
  const filters = useAppStore((s) => s.filters);
  const setFilter = useAppStore((s) => s.setFilter);
  const openModal = useAppStore((s) => s.openModal);
  const clearAllFilters = useAppStore((s) => s.clearAllFilters);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    tokenSummary: false,
  });

  const stageLabel = (fileName: string): string => {
    for (const row of allCaseRows) {
      const stage = row.stages.find((s) => s.fileName === fileName);
      if (stage) return stage.label;
    }
    return fileName;
  };

  // Average token usage across the visible rows.
  const avgTokens = useMemo(() => {
    const rowsWithIn = filteredRows.filter((r) => r.tokenSummary.totalTokensIn !== null);
    const rowsWithOut = filteredRows.filter((r) => r.tokenSummary.totalTokensOut !== null);
    const rowsWithTotal = filteredRows.filter((r) => r.tokenSummary.overallTotalTokens !== null);

    const avg = (rows: CaseRow[], pick: (r: CaseRow) => number | null): number | null => {
      if (rows.length === 0) return null;
      const sum = rows.reduce((acc, r) => acc + (pick(r) ?? 0), 0);
      return sum / rows.length;
    };

    return {
      in: avg(rowsWithIn, (r) => r.tokenSummary.totalTokensIn),
      out: avg(rowsWithOut, (r) => r.tokenSummary.totalTokensOut),
      total: avg(rowsWithTotal, (r) => r.tokenSummary.overallTotalTokens),
    };
  }, [filteredRows]);

  const columns = useMemo(() => {
    const cols = [
      // ── S.No — pinned, display-only, shows visual row position ───────
      columnHelper.display({
        id: 'sno',
        size: 44,
        header: () => <span className="text-textMuted">#</span>,
        cell: (info) => (
          <span className="font-mono text-caption text-textMuted">
            {info.row.index + 1}
          </span>
        ),
      }),
      columnHelper.accessor('caseId', {
        id: 'caseId',
        size: 200,
        header: () => (
          <div className="flex flex-col gap-1">
            <span>Case ID</span>
            <ColumnFilterHeader columnId="caseId" />
          </div>
        ),
        cell: (info) => (
          <span className="block truncate font-mono" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('finalVerdict', {
        id: 'finalVerdict',
        size: 120,
        header: () => (
          <div className="flex flex-col gap-1">
            <span>Final Verdict</span>
            <ColumnFilterHeader columnId="finalVerdict" />
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <ConfidenceBadge
              verdict={row.finalVerdict}
              onClick={() => openModal(row.caseId, settings.finalVerdict.file, row.finalRaw)}
            />
          );
        },
      }),
      columnHelper.accessor('failCause', {
        id: 'failCause',
        size: 260,
        header: () => <span>Possible Fail Cause</span>,
        cell: (info) => <FailCauseCell details={info.row.original.failCauseDetails} />,
        sortingFn: (a, b) => {
          const va = a.original.failCause ?? '';
          const vb = b.original.failCause ?? '';
          return va.localeCompare(vb);
        },
      }),
      columnHelper.accessor('overallConfidence', {
        id: 'overallConfidence',
        size: 130,
        header: () => <span>Overall Confidence</span>,
        cell: (info) => (
          <ConfidencePill
            score={info.getValue()}
            low={settings.lowConfidenceThreshold}
            high={settings.highConfidenceThreshold}
          />
        ),
        sortingFn: (a, b) => {
          const va = a.original.overallConfidence ?? -1;
          const vb = b.original.overallConfidence ?? -1;
          return va - vb;
        },
      }),
      columnHelper.accessor('amountMismatch', {
        id: 'amountMismatch',
        size: 150,
        header: () => (
          <div className="flex flex-col gap-1">
            <span>amounts_match</span>
            <ColumnFilterHeader columnId="amountMismatch" />
            <AmountToleranceSlider />
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const currentFilter = filters.amountMatchFilter;
          const match = !info.getValue();
          // This cell is "filtered" when the active filter matches its value
          const isFiltered =
            (match && currentFilter === 'match') ||
            (!match && currentFilter === 'mismatch');
          return (
            <AmountsMatchCell
              amountMismatch={info.getValue()}
              extractedAmount={row.extractedAmount}
              calculatedAmount={row.calculatedAmount}
              isFiltered={isFiltered}
              onFilterMatch={() =>
                setFilter({ amountMatchFilter: 'match', amountMismatchOnly: false })
              }
              onFilterMismatch={() =>
                setFilter({ amountMatchFilter: 'mismatch', amountMismatchOnly: false })
              }
              onClearFilter={() => setFilter({ amountMatchFilter: 'all' })}
            />
          );
        },
      }),
      columnHelper.accessor('nonPayableCount', {
        id: 'nonPayableCount',
        size: 150,
        header: () => (
          <div className="flex flex-col gap-1">
            <span>Knocked Line Items</span>
          </div>
        ),
        cell: (info) => {
          const val = info.getValue();
          if (val === null) {
            return <span className="text-textMuted">—</span>;
          }
          if (val === 0) {
            return (
              <span className="inline-flex items-center gap-1 text-caption text-green-700">
                <span>0</span>
                <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold">No knock</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1">
              <span className="font-mono text-body font-semibold text-red-700">{val}</span>
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-caption font-semibold text-red-700">
                Knocked
              </span>
            </span>
          );
        },
        sortingFn: (a, b) => (a.original.nonPayableCount ?? -1) - (b.original.nonPayableCount ?? -1),
      }),
      columnHelper.accessor('billTypeMatchCounts', {
        id: 'billTypeMatchCounts',
        size: 130,
        header: () => <span>Bill Type Match</span>,
        cell: (info) => <BillTypeMatchCell counts={info.getValue()} />,
        sortingFn: (a, b) => {
          const aCounts = a.original.billTypeMatchCounts;
          const bCounts = b.original.billTypeMatchCounts;
          return (
            aCounts.vectorSearch +
            aCounts.llmSelect -
            (bCounts.vectorSearch + bCounts.llmSelect)
          );
        },
      }),
      columnHelper.accessor('tokenSummary', {
        id: 'tokenSummary',
        size: 170,
        header: () => (
          <div className="flex flex-col gap-1">
            <span>Token Count</span>
            <div className="flex flex-col font-mono text-[11px] font-normal leading-tight text-textMuted">
              <span>avg in: {avgTokens.in === null ? '—' : avgTokens.in.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span>avg out: {avgTokens.out === null ? '—' : avgTokens.out.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span>avg total: {avgTokens.total === null ? '—' : avgTokens.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        ),
        cell: (info) => <TokenSummaryCell summary={info.getValue()} />,
        sortingFn: (a, b) => {
          const aTotal = a.original.tokenSummary.overallTotalTokens ?? 0;
          const bTotal = b.original.tokenSummary.overallTotalTokens ?? 0;
          return aTotal - bTotal;
        },
      }),
      ...stageColumns.map((fileName) =>
        columnHelper.display({
          id: fileName,
          size: 180,
          header: () => (
            <div className="flex flex-col gap-1">
              <span className="truncate" title={stageLabel(fileName)}>
                {stageLabel(fileName)}
              </span>
              <ColumnFilterHeader columnId={fileName} />
            </div>
          ),
          cell: (info) => {
            const row = info.row.original;
            const stage = row.stages.find((s) => s.fileName === fileName);
            if (!stage) return <MissingDataBadge />;
            return (
              <StageCell
                score={stage.score}
                issueCount={stage.issueCount}
                highSeverityCount={stage.highSeverityCount}
                onClick={() => openModal(row.caseId, fileName, stage.raw)}
              />
            );
          },
        })
      ),
    ];
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageColumns, allCaseRows, settings.finalVerdict.file, avgTokens]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      columnPinning: { left: ['sno', 'caseId'] },
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  const containerRef = useRef<HTMLDivElement>(null);
  const isVirtual = filteredRows.length > 100;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 44,
    overscan: 5,
  });

  const hasActiveFilter =
    filters.caseIdText !== '' ||
    filters.finalVerdict !== 'all' ||
    filters.hasErrorsOnly ||
    filters.amountMismatchOnly ||
    filters.amountMatchFilter !== 'all' ||
    Object.keys(filters.stages).length > 0;

  const renderRow = (rowIndex: number, style?: React.CSSProperties) => {
    const row = rows[rowIndex];
    return (
      <tr key={row.id} className="h-11 hover:bg-rowHover" style={style}>
        {row.getVisibleCells().map((cell) => {
          const isPinned = cell.column.id === 'caseId' || cell.column.id === 'sno';
          return (
            <td
              key={cell.id}
              className={`border-b border-border px-3 text-body text-textPrimary ${
                isPinned ? 'sticky z-10 bg-card' : ''
              } ${cell.column.id === 'sno' ? 'left-0' : ''} ${cell.column.id === 'caseId' ? 'left-[44px]' : ''}`}
              style={{ width: cell.column.getSize() }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <button
          type="button"
          onClick={() => setColumnVisibility((v) => ({ ...v, tokenSummary: !v.tokenSummary }))}
          className={`rounded-full px-3 py-0.5 text-caption font-medium transition-colors ${
            columnVisibility.tokenSummary
              ? 'bg-accent text-white shadow-sm'
              : 'bg-card text-textMuted hover:bg-rowHover'
          }`}
        >
          Token Count
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto">
        <table className="table-fixed border-collapse" style={{ width: table.getTotalSize() }}>
          <thead className="sticky top-0 z-20 bg-surface">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isPinned = header.column.id === 'caseId' || header.column.id === 'sno';
                  return (
                    <th
                      key={header.id}
                      className={`border-b border-border px-3 py-2 text-left align-top text-caption font-semibold text-textMuted ${
                        isPinned ? 'sticky z-20 bg-surface' : ''
                      } ${header.column.id === 'sno' ? 'left-0' : ''} ${header.column.id === 'caseId' ? 'left-[44px]' : ''} ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          {isVirtual ? (
            <tbody
              style={{
                position: 'relative',
                display: 'block',
                height: `${virtualizer.getTotalSize()}px`,
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <table className="table-fixed border-collapse" style={{ width: table.getTotalSize() }}>
                    <tbody>{renderRow(virtualRow.index)}</tbody>
                  </table>
                </div>
              ))}
            </tbody>
          ) : (
            <tbody>{rows.map((_, i) => renderRow(i))}</tbody>
          )}
        </table>
        {filteredRows.length === 0 && hasActiveFilter && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-body text-textMuted">No cases match the current filters.</p>
            <button
              onClick={clearAllFilters}
              className="rounded bg-accent px-3 py-1.5 text-body text-white hover:opacity-90"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
