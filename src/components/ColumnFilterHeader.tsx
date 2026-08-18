import { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface ColumnFilterHeaderProps {
  columnId: string; // "caseId" | "finalVerdict" | a stage fileName
}

const DEFAULT_STAGE_FILTER = { min: null as number | null, max: null as number | null, lowConfOnly: false };

export default function ColumnFilterHeader({ columnId }: ColumnFilterHeaderProps) {
  const filters = useAppStore((s) => s.filters);
  const setFilter = useAppStore((s) => s.setFilter);
  const clearFilter = useAppStore((s) => s.clearFilter);

  if (columnId === 'caseId') {
    return <CaseIdFilter value={filters.caseIdText} setFilter={setFilter} clearFilter={clearFilter} />;
  }

  if (columnId === 'finalVerdict') {
    return (
      <VerdictFilter
        value={filters.finalVerdict}
        setFilter={setFilter}
        clearFilter={clearFilter}
      />
    );
  }

  if (columnId === 'amountMismatch') {
    return (
      <AmountMismatchFilter
        value={filters.amountMismatchOnly}
        setFilter={setFilter}
        clearFilter={clearFilter}
      />
    );
  }

  const stageFilter = filters.stages[columnId] ?? DEFAULT_STAGE_FILTER;
  return (
    <StageFilter
      columnId={columnId}
      stageFilter={stageFilter}
      allStages={filters.stages}
      setFilter={setFilter}
    />
  );
}

function CaseIdFilter({
  value,
  setFilter,
  clearFilter,
}: {
  value: string;
  setFilter: (u: { caseIdText: string }) => void;
  clearFilter: (k: 'caseIdText') => void;
}) {
  const [text, setText] = useState(value);

  // Keep local text in sync if the store value changes externally (e.g. clear all).
  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (text !== value) setFilter({ caseIdText: text });
    }, 150);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const isActive = value !== '';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter case ID..."
          className="w-full rounded border border-border bg-card px-2 py-1 text-body text-textPrimary outline-none focus:border-accent"
        />
        <Filter size={14} className={isActive ? 'text-accent' : 'text-textMuted'} />
      </div>
      {isActive && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-accent px-2 py-0.5 text-caption text-accent">
          "{value}"
          <button onClick={() => clearFilter('caseIdText')} aria-label="Clear case ID filter">
            ×
          </button>
        </span>
      )}
    </div>
  );
}

function VerdictFilter({
  value,
  setFilter,
  clearFilter,
}: {
  value: 'all' | 0 | 1;
  setFilter: (u: { finalVerdict: 'all' | 0 | 1 }) => void;
  clearFilter: (k: 'finalVerdict') => void;
}) {
  const isActive = value !== 'all';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex gap-1">
          {(['all', 1, 0] as const).map((opt) => (
            <button
              key={String(opt)}
              onClick={() => setFilter({ finalVerdict: opt })}
              className={`rounded px-2 py-0.5 text-caption ${
                value === opt ? 'bg-accent text-white' : 'bg-surface text-textMuted hover:bg-rowHover'
              }`}
            >
              {opt === 'all' ? 'All' : opt === 1 ? 'Pass' : 'Fail'}
            </button>
          ))}
        </div>
        <Filter size={14} className={isActive ? 'text-accent' : 'text-textMuted'} />
      </div>
      {isActive && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-accent px-2 py-0.5 text-caption text-accent">
          {value === 1 ? 'Pass' : 'Fail'}
          <button onClick={() => clearFilter('finalVerdict')} aria-label="Clear verdict filter">
            ×
          </button>
        </span>
      )}
    </div>
  );
}

function AmountMismatchFilter({
  value,
  setFilter,
  clearFilter,
}: {
  value: boolean;
  setFilter: (u: { amountMismatchOnly: boolean }) => void;
  clearFilter: (k: 'amountMismatchOnly') => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex gap-1">
          {[false, true].map((opt) => (
            <button
              key={String(opt)}
              onClick={() => setFilter({ amountMismatchOnly: opt })}
              className={`rounded px-2 py-0.5 text-caption ${
                value === opt ? 'bg-accent text-white' : 'bg-surface text-textMuted hover:bg-rowHover'
              }`}
            >
              {opt ? 'Mismatch' : 'All'}
            </button>
          ))}
        </div>
        <Filter size={14} className={value ? 'text-accent' : 'text-textMuted'} />
      </div>
      {value && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-accent px-2 py-0.5 text-caption text-accent">
          Mismatch only
          <button onClick={() => clearFilter('amountMismatchOnly')} aria-label="Clear mismatch filter">
            ×
          </button>
        </span>
      )}
    </div>
  );
}

type StageFilterValue = { min: number | null; max: number | null; lowConfOnly: boolean };

function StageFilter({
  columnId,
  stageFilter,
  allStages,
  setFilter,
}: {
  columnId: string;
  stageFilter: StageFilterValue;
  allStages: Record<string, StageFilterValue>;
  setFilter: (u: { stages: Record<string, StageFilterValue> }) => void;
}) {
  const updateStage = (patch: Partial<StageFilterValue>) => {
    setFilter({ stages: { ...allStages, [columnId]: { ...stageFilter, ...patch } } });
  };

  const clearStage = () => {
    setFilter({ stages: { ...allStages, [columnId]: { ...DEFAULT_STAGE_FILTER } } });
  };

  const isActive =
    stageFilter.min !== null || stageFilter.max !== null || stageFilter.lowConfOnly;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <input
          type="number"
          placeholder="Min"
          value={stageFilter.min ?? ''}
          onChange={(e) =>
            updateStage({ min: e.target.value === '' ? null : Number(e.target.value) })
          }
          className="w-16 rounded border border-border bg-card px-1.5 py-1 text-body text-textPrimary outline-none focus:border-accent"
        />
        <input
          type="number"
          placeholder="Max"
          value={stageFilter.max ?? ''}
          onChange={(e) =>
            updateStage({ max: e.target.value === '' ? null : Number(e.target.value) })
          }
          className="w-16 rounded border border-border bg-card px-1.5 py-1 text-body text-textPrimary outline-none focus:border-accent"
        />
        <label className="flex items-center gap-1 text-caption text-textMuted">
          <input
            type="checkbox"
            checked={stageFilter.lowConfOnly}
            onChange={(e) => updateStage({ lowConfOnly: e.target.checked })}
          />
          Low conf only
        </label>
        <Filter size={14} className={isActive ? 'text-accent' : 'text-textMuted'} />
      </div>
      {isActive && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-accent px-2 py-0.5 text-caption text-accent">
          {stageFilter.lowConfOnly
            ? 'Low conf only'
            : `${stageFilter.min ?? ''}–${stageFilter.max ?? ''}`}
          <button onClick={clearStage} aria-label={`Clear ${columnId} filter`}>
            ×
          </button>
        </span>
      )}
    </div>
  );
}
