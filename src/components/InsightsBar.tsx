import { useAppStore } from '../store/appStore';
import { passRate, errorCount, stageInsights, amountMismatchCount, failedByLowConfidenceCount, knockedOffBillIssuesCount, knockedOffBillTotalLineItems, totalTokens } from '../lib/insights';

function InsightCard({
  label,
  value,
  onClick,
  valueClassName,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
  valueClassName?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex min-w-[140px] flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <span className="text-caption uppercase text-textMuted">{label}</span>
      <span className={`text-heading font-semibold text-textPrimary ${valueClassName ?? ''}`}>
        {value}
      </span>
    </div>
  );
}

export default function InsightsBar() {
  const allCaseRows = useAppStore((s) => s.allCaseRows);
  const filteredRows = useAppStore((s) => s.filteredRows);
  const stageColumns = useAppStore((s) => s.stageColumns);
  const settings = useAppStore((s) => s.settings);
  const insightsScope = useAppStore((s) => s.insightsScope);
  const setInsightsScope = useAppStore((s) => s.setInsightsScope);
  const setFilter = useAppStore((s) => s.setFilter);

  const rows = insightsScope === 'all' ? allCaseRows : filteredRows;

  const stageLabel = (fileName: string): string => {
    for (const row of allCaseRows) {
      const stage = row.stages.find((s) => s.fileName === fileName);
      if (stage) return stage.label;
    }
    return fileName;
  };

  const perStage = stageInsights(rows, stageColumns, settings.lowConfidenceThreshold);
  const errors = errorCount(rows);
  const mismatches = amountMismatchCount(rows);
  const failedLowConf = failedByLowConfidenceCount(rows);
  const knockedOffIssues = knockedOffBillIssuesCount(rows);
  const knockedOffTotalItems = knockedOffBillTotalLineItems(rows);
  const totalTokensCount = totalTokens(rows);

  // Debug logging
  if (rows.length > 0) {
    console.log('=== Failed by Low Confidence (Amounts Match but Failed) ===');
    console.log('Total rows:', rows.length);
    console.log('Failed cases (verdict=0):', rows.filter(r => r.finalVerdict === 0).length);
    console.log('Cases with both amounts:', rows.filter(r => r.extractedAmount !== null && r.calculatedAmount !== null).length);
    console.log('Failed despite amounts matching:', failedLowConf);
    
    const problematicCases = rows.filter(r => 
      r.finalVerdict === 0 && 
      r.extractedAmount !== null && 
      r.calculatedAmount !== null &&
      r.extractedAmount === r.calculatedAmount
    ).slice(0, 5);
    
    console.log('Sample problematic cases:', problematicCases.map(r => ({
      caseId: r.caseId,
      verdict: r.finalVerdict,
      extractedAmount: r.extractedAmount,
      calculatedAmount: r.calculatedAmount,
      match: r.extractedAmount === r.calculatedAmount
    })));
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setInsightsScope('filtered')}
          className={`rounded-full px-3 py-1 text-caption font-medium transition-colors ${
            insightsScope === 'filtered'
              ? 'bg-accent text-white shadow-sm'
              : 'bg-card text-textMuted hover:bg-rowHover'
          }`}
        >
          Filtered
        </button>
        <button
          onClick={() => setInsightsScope('all')}
          className={`rounded-full px-3 py-1 text-caption font-medium transition-colors ${
            insightsScope === 'all'
              ? 'bg-accent text-white shadow-sm'
              : 'bg-card text-textMuted hover:bg-rowHover'
          }`}
        >
          All Cases
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <InsightCard label="Total Cases" value={rows.length} />
        <InsightCard label="Pass Rate" value={`${(passRate(rows) * 100).toFixed(0)}%`} />
        <InsightCard
          label="Failed by Low Confidence"
          value={failedLowConf}
          valueClassName={failedLowConf > 0 ? 'text-lowText' : ''}
        />
        <InsightCard
          label="Knocked Off Bill Present"
          value={knockedOffIssues}
          valueClassName={knockedOffIssues > 0 ? 'text-blue-600' : ''}
        />
        <InsightCard
          label="Total Line Items"
          value={knockedOffTotalItems}
          valueClassName={knockedOffTotalItems > 0 ? 'text-orange-600' : ''}
        />
        <InsightCard
          label="Total Tokens"
          value={totalTokensCount.toLocaleString()}
          valueClassName={totalTokensCount > 0 ? 'text-purple-600' : ''}
        />
        <InsightCard
          label="Amount Mismatches"
          value={mismatches}
          valueClassName={mismatches > 0 ? 'text-amber-600' : ''}
          onClick={() => setFilter({ amountMismatchOnly: true })}
        />
        {perStage.map((s) => (
          <InsightCard
            key={s.fileName}
            label={stageLabel(s.fileName)}
            value={`${s.avg === null ? '—' : s.avg.toFixed(2)} avg · ${s.lowCount} low`}
          />
        ))}
        <InsightCard
          label="Errors"
          value={errors}
          valueClassName={errors > 0 ? 'text-lowText' : ''}
          onClick={() => setFilter({ hasErrorsOnly: true })}
        />
      </div>
    </div>
  );
}
