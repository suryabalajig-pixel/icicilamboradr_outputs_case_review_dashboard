import { useMemo, useRef, useState } from 'react';
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

function AmountCell({ amount }: { amount: number | null }) {
  if (amount === null) {
    return <span className="text-textMuted">—</span>;
  }
  return <span className="font-mono">{amount.toFixed(2)}</span>;
}

function BillTypeMatchCell({
  counts,
}: {
  counts: CaseRow['billTypeMatchCounts'];
}) {
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

function MismatchBadge({ 
  mismatch, 
  extractedAmount, 
  calculatedAmount 
}: { 
  mismatch: boolean; 
  extractedAmount: number | null;
  calculatedAmount: number | null;
}) {
  if (!mismatch) {
    return <span className="text-xs font-mono text-textPrimary">true</span>;
  }
  
  const handleClick = () => {
    if (extractedAmount !== null && calculatedAmount !== null) {
      const difference = Math.abs(extractedAmount - calculatedAmount);
      alert(`Amount Difference: $${difference.toFixed(2)}\n\nExtracted: $${extractedAmount.toFixed(2)}\nCalculated: $${calculatedAmount.toFixed(2)}`);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="text-xs font-mono text-red-600 hover:text-red-800 hover:underline cursor-pointer"
      title="Click to see amount difference"
    >
      false
    </button>
  );
}

export default function CaseTable() {
  const filteredRows = useAppStore((s) => s.filteredRows);
  const allCaseRows = useAppStore((s) => s.allCaseRows);
  const stageColumns = useAppStore((s) => s.stageColumns);
  const settings = useAppStore((s) => s.settings);
  const filters = useAppStore((s) => s.filters);
  const openModal = useAppStore((s) => s.openModal);
  const clearAllFilters = useAppStore((s) => s.clearAllFilters);

  const [sorting, setSorting] = useState<SortingState>([]);

  const stageLabel = (fileName: string): string => {
    for (const row of allCaseRows) {
      const stage = row.stages.find((s) => s.fileName === fileName);
      if (stage) return stage.label;
    }
    return fileName;
  };

  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor('caseId', {
        id: 'caseId',
        size: 180,
        header: () => (
          <div className="flex flex-col gap-1">
            <span>Case ID</span>
            <ColumnFilterHeader columnId="caseId" />
          </div>
        ),
        cell: (info) => <span className="font-mono">{info.getValue()}</span>,
      }),
      columnHelper.accessor('finalVerdict', {
        id: 'finalVerdict',
        size: 150,
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
      columnHelper.accessor('extractedAmount', {
        id: 'extractedAmount',
        size: 150,
        header: () => <span>Extracted Amount</span>,
        cell: (info) => <AmountCell amount={info.getValue()} />,
      }),
      columnHelper.accessor('calculatedAmount', {
        id: 'calculatedAmount',
        size: 150,
        header: () => <span>Calculated Amount</span>,
        cell: (info) => <AmountCell amount={info.getValue()} />,
      }),
      columnHelper.accessor('amountMismatch', {
        id: 'amountMismatch',
        size: 140,
        header: () => (
          <div className="flex flex-col gap-1">
            <span>Amount Status</span>
            <ColumnFilterHeader columnId="amountMismatch" />
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <MismatchBadge 
              mismatch={info.getValue()} 
              extractedAmount={row.extractedAmount}
              calculatedAmount={row.calculatedAmount}
            />
          );
        },
      }),
      columnHelper.accessor('knockedOffBillCount', {
        id: 'knockedOffBillCount',
        size: 150,
        header: () => <span>Knocked Off Bills</span>,
        cell: (info) => {
          const count = info.getValue();
          if (count === 0) {
            return <span className="text-textMuted">—</span>;
          }
          return <span className="font-semibold text-orange-600">{count} items</span>;
        },
      }),
      columnHelper.accessor('billTypeMatchCounts', {
        id: 'billTypeMatchCounts',
        size: 150,
        header: () => <span>Bill Type Match</span>,
        cell: (info) => <BillTypeMatchCell counts={info.getValue()} />,
        sortingFn: (a, b) => {
          const aCounts = a.original.billTypeMatchCounts;
          const bCounts = b.original.billTypeMatchCounts;
          const aTotal = aCounts.vectorSearch + aCounts.llmSelect;
          const bTotal = bCounts.vectorSearch + bCounts.llmSelect;
          return aTotal - bTotal;
        },
      }),
      columnHelper.accessor('tokenSummary', {
        id: 'tokenSummary',
        size: 170,
        header: () => <span>Token Summary</span>,
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
          size: 150,
          header: () => (
            <div className="flex flex-col gap-1">
              <span>{stageLabel(fileName)}</span>
              <ColumnFilterHeader columnId={fileName} />
            </div>
          ),
          cell: (info) => {
            const row = info.row.original;
            const stage = row.stages.find((s) => s.fileName === fileName);
            if (!stage) return <MissingDataBadge />;
            return (
              <ConfidenceBadge
                score={stage.score}
                onClick={() => openModal(row.caseId, fileName, stage.raw)}
              />
            );
          },
        })
      ),
    ];
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageColumns, allCaseRows, settings.finalVerdict.file]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      columnPinning: { left: ['caseId'] },
    },
    onSortingChange: setSorting,
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
    Object.keys(filters.stages).length > 0;

  const renderRow = (rowIndex: number, style?: React.CSSProperties) => {
    const row = rows[rowIndex];
    return (
      <tr key={row.id} className="h-11 hover:bg-rowHover" style={style}>
        {row.getVisibleCells().map((cell) => {
          const isPinned = cell.column.id === 'caseId';
          return (
            <td
              key={cell.id}
              className={`px-3 text-body text-textPrimary ${
                isPinned ? 'sticky left-0 z-10 bg-card' : ''
              }`}
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
      <div ref={containerRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-surface">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isPinned = header.column.id === 'caseId';
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 text-left align-top text-caption font-semibold text-textMuted ${
                        isPinned ? 'sticky left-0 z-20 bg-surface' : ''
                      } ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
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
                  <table className="w-full border-collapse">
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
