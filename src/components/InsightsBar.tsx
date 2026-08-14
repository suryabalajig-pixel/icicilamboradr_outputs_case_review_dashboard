import { useAppStore } from '../store/appStore';
import { passRate, errorCount, stageInsights } from '../lib/insights';

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

  // Count cases where "consolidation.json" stage score is less than 0.9
  const consolidationLowCount = rows.reduce((count, row) => {
    const stage = row.stages.find((s) => s.fileName === 'consolidation.json');
    if (stage && stage.score !== null && stage.score < 0.9) {
      return count + 1;
    }
    return count;
  }, 0);


   const classification_LowCount = rows.reduce((count, row) => {
    const stage = row.stages.find((s) => s.fileName === 'classification.json');
    if (stage && stage.score !== null && stage.score < 0.9) {
      return count + 1;
    }
    return count;
  }, 0);

  const bill_type_resolution_LowCount = rows.reduce((count, row) => {
    const stage = row.stages.find((s) => s.fileName === 'bill_type_resolution.json');
    if (stage && stage.score !== null && stage.score < 0.9) {
      return count + 1;
    }
    return count;
  }, 0);

  const categorisation_LowCount = rows.reduce((count, row) => {
    const stage = row.stages.find((s) => s.fileName === 'categorisation.json');
    if (stage && stage.score !== null && stage.score < 0.9) {
      return count + 1;
    }
    return count;
  }, 0);

 

  const extraction_LowCount = rows.reduce((count, row) => {
    const stage = row.stages.find((s) => s.fileName === 'extraction.json');
    if (stage && stage.score !== null && stage.score < 0.9) {
      return count + 1;
    }
    return count;
  }, 0);

   const sequencing_LowCount = rows.reduce((count, row) => {
    const stage = row.stages.find((s) => s.fileName === 'sequencing.json');
    if (stage && stage.score !== null && stage.score < 0.9) {
      return count + 1;
    }
    return count;
  }, 0);

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
        <InsightCard
          label="Consolidation < 0.9"
          value={consolidationLowCount}
          valueClassName={consolidationLowCount > 0 ? 'text-lowText' : ''}
        />
      
        <InsightCard
          label="bill_type_resolution < 0.9"
          value={bill_type_resolution_LowCount}
          valueClassName={bill_type_resolution_LowCount > 0 ? 'text-lowText' : ''}
        />
        <InsightCard
          label="categorisation < 0.9"
          value={categorisation_LowCount}
          valueClassName={categorisation_LowCount > 0 ? 'text-lowText' : ''}
        />
        <InsightCard
          label="classification < 0.9"
          value={classification_LowCount}
          valueClassName={classification_LowCount > 0 ? 'text-lowText' : ''}
        />
        <InsightCard
          label="extraction < 0.9"
          value={extraction_LowCount}
          valueClassName={extraction_LowCount > 0 ? 'text-lowText' : ''}
        />
        <InsightCard
          label="sequencing < 0.9"
          value={sequencing_LowCount}
          valueClassName={sequencing_LowCount > 0 ? 'text-lowText' : ''}
        />
      </div>
    </div>
  );
}
