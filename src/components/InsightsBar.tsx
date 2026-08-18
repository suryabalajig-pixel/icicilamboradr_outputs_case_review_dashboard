import { useAppStore } from '../store/appStore';
import {
  passCount,
  failCount,
  failedByAmountMismatchCount,
  failedByLowConfidenceCount,
  failedWithKnockedCount,
  passedWithKnockedCount,
  withKnockedCount,
  errorCount,
  stageInsights,
} from '../lib/insights';

// ─── InsightCard ──────────────────────────────────────────────────────────────

interface InsightCardProps {
  label: string;
  value: string | number;
  sub?: string;
  flag?: string;
  active?: boolean;         // true = card is the currently active filter
  onClick?: () => void;
  variant?: 'default' | 'pass' | 'fail' | 'warn' | 'muted';
  tooltip?: string;          // hover tooltip text
}

function InsightCard({ label, value, sub, flag, active, onClick, variant = 'default', tooltip }: InsightCardProps) {
  const valueColor: Record<string, string> = {
    default: 'text-textPrimary',
    pass:    'text-green-600',
    fail:    'text-red-600',
    warn:    'text-amber-600',
    muted:   'text-textMuted',
  };

  return (
    <div
      onClick={onClick}
      title={tooltip || (active ? 'Click to clear this filter' : undefined)}
      className={[
        'flex min-w-[140px] flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        onClick ? 'cursor-pointer' : '',
        active
          ? 'border-accent ring-2 ring-accent/30 bg-accent/5'
          : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted leading-tight">
          {label}
        </span>
        {active && (
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-accent">
            active ✕
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold leading-none ${valueColor[variant]}`}>{value}</span>
        {flag && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            🚩 {flag}
          </span>
        )}
      </div>
      {sub && <span className="text-[11px] leading-tight text-textMuted">{sub}</span>}
    </div>
  );
}// ─── GroupLabel ───────────────────────────────────────────────────────────────
// Vertical label that sits between a divider and its group of cards.

interface GroupLabelProps {
  label: string;
  variant?: 'default' | 'fail' | 'warn';
}

function GroupLabel({ label, variant = 'default' }: GroupLabelProps) {
  const color: Record<string, string> = {
    default: 'text-textMuted',
    fail:    'text-red-500',
    warn:    'text-amber-500',
  };
  return (
    <div className={`flex items-center pr-2 text-[9px] font-bold uppercase tracking-widest ${color[variant]}`}
      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', minWidth: '18px' }}
    >
      {label}
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="mx-2 self-stretch border-l border-border" />;
}

// ─── InsightsBar ──────────────────────────────────────────────────────────────

export default function InsightsBar() {
  const allCaseRows      = useAppStore((s) => s.allCaseRows);
  const filteredRows     = useAppStore((s) => s.filteredRows);
  const stageColumns     = useAppStore((s) => s.stageColumns);
  const settings         = useAppStore((s) => s.settings);
  const insightsScope    = useAppStore((s) => s.insightsScope);
  const setInsightsScope = useAppStore((s) => s.setInsightsScope);
  const filters          = useAppStore((s) => s.filters);
  const setFilter        = useAppStore((s) => s.setFilter);
  const clearAllFilters  = useAppStore((s) => s.clearAllFilters);
  const excludedCasesCount = useAppStore((s) => s.excludedCasesCount);

  // Always compute metrics against allCaseRows so card values don't collapse
  // to zero when a filter is active. But exclude not-working cases from all
  // summary metrics — they have no valid verdict and would inflate the totals.
  const workingRows = allCaseRows.filter(r => !r.isNotWorking);
  const metricRows  = workingRows;
  const threshold   = settings.lowConfidenceThreshold;

  // ── Verdict counts (only working cases) ─────────────────────────────
  const total       = workingRows.length;
  const passed      = passCount(workingRows);
  const failed      = failCount(workingRows);
  const passRatePct = total === 0 ? '—' : `${((passed / total) * 100).toFixed(0)}% pass rate`;

  // ── Fail-reason breakdown ───────────────────────────────────────────
  const failAmtMismatch = failedByAmountMismatchCount(metricRows);
  const failLowConf     = failedByLowConfidenceCount(metricRows, threshold);

  // ── Knocked ─────────────────────────────────────────────────────────
  const totalWithKnocked   = withKnockedCount(metricRows);
  const passWithKnocked    = passedWithKnockedCount(metricRows);
  const failWithKnocked    = failedWithKnockedCount(metricRows);

  // ── Stage pipeline ──────────────────────────────────────────────────
  const perStage = stageInsights(metricRows, stageColumns, threshold);
  const stageLabel = (fileName: string): string => {
    for (const row of allCaseRows) {
      const stage = row.stages.find((s) => s.fileName === fileName);
      if (stage) return stage.label;
    }
    return fileName.replace('.json', '');
  };

  // ── Errors ──────────────────────────────────────────────────────────
  const errors = errorCount(metricRows);

  // ── Active filter state — drives the active/toggle logic ────────────
  const isVerdictPass    = filters.finalVerdict === 1;
  const isVerdictFail    = filters.finalVerdict === 0;
  const isAmtMismatch    = filters.amountMismatchOnly === true;
  const isErrorsOnly     = filters.hasErrorsOnly === true;
  const isNotWorkingOnly = filters.notWorkingOnly === true;
  const hasAnyFilter     = isVerdictPass || isVerdictFail || isAmtMismatch || isErrorsOnly || isNotWorkingOnly;

  // Toggle helpers — clicking an already-active filter clears all filters.
  const toggleVerdict = (v: 0 | 1) => {
    if (filters.finalVerdict === v) {
      clearAllFilters();
    } else {
      setFilter({ finalVerdict: v, amountMismatchOnly: false, hasErrorsOnly: false, notWorkingOnly: false, hideNotWorking: true });
    }
  };

  const toggleAmtMismatch = () => {
    if (isAmtMismatch) {
      clearAllFilters();
    } else {
      setFilter({ finalVerdict: 0, amountMismatchOnly: true, hasErrorsOnly: false, notWorkingOnly: false, hideNotWorking: true });
    }
  };

  const toggleErrors = () => {
    if (isErrorsOnly) {
      clearAllFilters();
    } else {
      setFilter({ hasErrorsOnly: true, finalVerdict: 'all', amountMismatchOnly: false, notWorkingOnly: false, hideNotWorking: true });
    }
  };

  // Clicking "Not Working" shows ONLY the not-working cases.
  // Clicking again returns to the normal view (not-working hidden).
  const toggleNotWorking = () => {
    if (isNotWorkingOnly) {
      clearAllFilters();
    } else {
      setFilter({
        notWorkingOnly: true,
        hideNotWorking: false,
        finalVerdict: 'all',
        amountMismatchOnly: false,
        hasErrorsOnly: false,
      });
    }
  };

  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-0 border-b border-border bg-surface">

      {/* ── Toolbar: scope toggle + active filter indicator ─────────── */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-textMuted">
          Scope
        </span>
        {(['filtered', 'all'] as const).map((scope) => (
          <button
            key={scope}
            onClick={() => setInsightsScope(scope)}
            className={`rounded-full px-3 py-0.5 text-caption font-medium transition-colors ${
              insightsScope === scope
                ? 'bg-accent text-white shadow-sm'
                : 'bg-card text-textMuted hover:bg-rowHover'
            }`}
          >
            {scope === 'all'
              ? `All Cases (${allCaseRows.length})`
              : `Filtered (${filteredRows.length})`}
          </button>
        ))}
        {hasAnyFilter && (
          <button
            onClick={clearAllFilters}
            className="ml-auto rounded-full border border-accent px-3 py-0.5 text-caption font-medium text-accent hover:bg-accent hover:text-white transition-colors"
          >
            Clear filter ✕
          </button>
        )}
      </div>

      {/* ── Single scrollable row of all cards ───────────────────────── */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-stretch gap-0 px-4 py-3">

          {/* ── GROUP 1: Summary ──────────────────────────────────────── */}
          <GroupLabel label="Summary" />
          <InsightCard 
            label="Total Cases" 
            value={total} 
            variant="muted"
            tooltip="Working cases only (not-working cases excluded).&#10;Every case here has a valid verdict, amount, and pipeline stages.&#10;Total Cases = Passed + Failed."
          />
          {excludedCasesCount > 0 && (
            <InsightCard
              label="Not Working"
              value={excludedCasesCount}
              sub={isNotWorkingOnly ? 'showing only these' : 'click to inspect'}
              variant="fail"
              active={isNotWorkingOnly}
              onClick={toggleNotWorking}
              tooltip="Cases not counted in pass/fail total — no verdict, zero/missing amount, or missing extraction/bill_type_resolution stage.&#10;Click to show ONLY these problem cases in the table.&#10;Click again to return to normal view."
            />
          )}
          <InsightCard
            label="Passed"
            value={passed}
            sub={passRatePct}
            variant={passed > 0 ? 'pass' : 'muted'}
            active={isVerdictPass}
            onClick={() => toggleVerdict(1)}
            tooltip="Cases where final verdict is 1 (approved).&#10;These cases passed all validation checks.&#10;Click to filter and view only passed cases."
          />
          <InsightCard
            label="Failed"
            value={failed}
            sub={total > 0 ? `${((failed / total) * 100).toFixed(0)}% failure rate` : undefined}
            variant={failed > 0 ? 'fail' : 'muted'}
            active={isVerdictFail && !isAmtMismatch}
            onClick={() => toggleVerdict(0)}
            tooltip="Cases where final verdict is 0 (rejected).&#10;Failed due to amount mismatch, low confidence, or agent block.&#10;Click to filter and view only failed cases."
          />
          {errors > 0 && (
            <InsightCard
              label="Parse Errors"
              value={errors}
              sub="missing / unreadable"
              variant="fail"
              active={isErrorsOnly}
              onClick={toggleErrors}
              tooltip="Cases with missing or corrupted JSON files.&#10;These files couldn't be read or parsed properly.&#10;Click to filter and view cases with errors."
            />
          )}

          <Divider />

          {/* ── GROUP 2: Why Failed ───────────────────────────────────── */}
          <GroupLabel label="Failure Cause" variant="fail" />
          <InsightCard
            label="Amount Mismatch"
            value={failAmtMismatch}
            sub="extracted ≠ calculated"
            variant={failAmtMismatch > 0 ? 'warn' : 'muted'}
            active={isAmtMismatch}
            onClick={toggleAmtMismatch}
            tooltip="Failed cases where extracted amount doesn't match calculated.&#10;The system found a different total than expected.&#10;Click to filter and view only these mismatches."
          />
          <InsightCard
            label={`Low Confidence (<${(threshold * 100).toFixed(0)}%)`}
            value={failLowConf}
            sub="amounts match, but confidence score low"
            variant={failLowConf > 0 ? 'fail' : 'muted'}
            active={isVerdictFail && !isAmtMismatch && !isErrorsOnly}
            onClick={() => toggleVerdict(0)}
            tooltip={`Failed because confidence score is below ${(threshold * 100).toFixed(0)}%.&#10;Amounts matched but system wasn't confident enough.&#10;Click to view all failed cases.`}
          />

          <Divider />

          {/* ── GROUP 3: Knocked ──────────────────────────────────────── */}
          <GroupLabel label="Knocked Off" variant="warn" />
          <InsightCard
            label="Cases With Knocked off Charges"
            value={totalWithKnocked}
            variant={totalWithKnocked > 0 ? 'warn' : 'muted'}
            tooltip="Cases where some charges were marked non-payable.&#10;'Knocked' means financial agent deducted certain items.&#10;Includes both passed and failed cases with deductions."
          />
          <InsightCard
            label="Passed With Knocked Off"
            value={passWithKnocked}
            sub="verdict=1 having knocked off charges"
            variant={passWithKnocked > 0 ? 'pass' : 'muted'}
            active={isVerdictPass}
            onClick={() => toggleVerdict(1)}
            tooltip="Cases approved despite having non-payable deductions.&#10;Some charges were knocked off but case still passed.&#10;Click to filter and view all passed cases."
          />
          <InsightCard
            label="Failed With Knocked Off"
            value={failWithKnocked}
            sub="verdict=0 having knocked off charges"
            variant={failWithKnocked > 0 ? 'fail' : 'muted'}
            active={isVerdictFail && !isAmtMismatch}
            onClick={() => toggleVerdict(0)}
            tooltip="Failed cases with non-payable deductions.&#10;Some charges were knocked off and the case failed.&#10;Click to filter and view all failed cases."
          />

          <Divider />

          {/* ── GROUP 5: Pipeline Stages ──────────────────────────────── */}
          {perStage.length > 0 && (
            <>
              <Divider />
              <GroupLabel label="Judges" />
              {perStage.map((s) => (
                <InsightCard
                  key={s.fileName}  
                  label={stageLabel(s.fileName)}
                  value={s.avg === null ? '—' : s.avg.toFixed(2)}
                  sub={s.lowCount > 0 ? `${s.lowCount} low` : 'all good'}
                  variant={s.lowCount > 0 ? 'warn' : 'muted'}
                  tooltip={`Average confidence score for this processing stage.&#10;Shows how confident the system was during ${stageLabel(s.fileName)}.&#10;Higher scores mean better quality extraction.`}
                />
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
