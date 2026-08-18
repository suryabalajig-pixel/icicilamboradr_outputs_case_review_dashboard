import { create } from 'zustand';
import { getByPath } from '../lib/jsonPath';
import { countBillTypeMatchingMethods } from '../lib/billTypeMatching';
import { extractTokenSummary } from '../lib/tokenSummary';
import type {
  AppStore,
  BillTypeMatchCounts,
  CaseRow,
  ExcludedCase,
  FilterState,
  SettingsConfig,
  StageResult,
  TokenSummary,
} from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';
import { loadCaseRows } from '../hooks/useDirectoryLoader';
import { saveDirHandle } from '../lib/dirHandleStore';

// ============================================================
// Filter predicate helpers (module-level, pure functions)
// ============================================================

export function matchesCaseIdFilter(row: CaseRow, text: string): boolean {
  if (text === '') return true;
  return row.caseId.toLowerCase().includes(text.toLowerCase());
}

export function matchesVerdictFilter(row: CaseRow, v: FilterState['finalVerdict']): boolean {
  if (v === 'all') return true;
  return row.finalVerdict === v;
}

export function matchesHasErrorsFilter(row: CaseRow, hasErrorsOnly: boolean): boolean {
  if (!hasErrorsOnly) return true;
  return row.hasErrors === true;
}

export function matchesAmountMismatchFilter(row: CaseRow, amountMismatchOnly: boolean): boolean {
  if (!amountMismatchOnly) return true;
  return row.amountMismatch === true;
}

export function matchesAmountMatchFilter(
  row: CaseRow,
  amountMatchFilter: FilterState['amountMatchFilter']
): boolean {
  if (amountMatchFilter === 'all') return true;
  if (amountMatchFilter === 'match')    return row.amountMismatch === false;
  if (amountMatchFilter === 'mismatch') return row.amountMismatch === true;
  return true;
}

export function matchesNotWorkingFilter(
  row: CaseRow,
  hideNotWorking: boolean,
  notWorkingOnly: boolean
): boolean {
  if (notWorkingOnly) return row.isNotWorking === true;   // show ONLY not-working
  if (hideNotWorking) return row.isNotWorking === false;  // hide not-working (default)
  return true;                                            // show all
}

export function matchesStageFilter(
  row: CaseRow,
  fileName: string,
  stageFilter: { min: number | null; max: number | null; lowConfOnly: boolean },
  lowConfidenceThreshold: number
): boolean {
  const stage = row.stages.find((s) => s.fileName === fileName);
  const score = stage ? stage.score : null;

  if (stageFilter.lowConfOnly) {
    return score !== null && score < lowConfidenceThreshold;
  }

  if (stageFilter.min === null && stageFilter.max === null) {
    // No range constraint active for this stage — matches everything,
    // including rows with a null score (an empty filter must not exclude rows).
    return true;
  }

  if (stageFilter.min !== null && !(score !== null && score >= stageFilter.min)) {
    return false;
  }
  if (stageFilter.max !== null && !(score !== null && score <= stageFilter.max)) {
    return false;
  }
  return true;
}

export function applyAllFilters(
  rows: CaseRow[],
  filters: FilterState,
  settings: SettingsConfig
): CaseRow[] {
  return rows.filter(
    (row) =>
      matchesCaseIdFilter(row, filters.caseIdText) &&
      matchesVerdictFilter(row, filters.finalVerdict) &&
      matchesHasErrorsFilter(row, filters.hasErrorsOnly) &&
      matchesAmountMismatchFilter(row, filters.amountMismatchOnly) &&
      matchesAmountMatchFilter(row, filters.amountMatchFilter) &&
      matchesNotWorkingFilter(row, filters.hideNotWorking, filters.notWorkingOnly) &&
      Object.entries(filters.stages).every(([fileName, stageFilter]) =>
        matchesStageFilter(row, fileName, stageFilter, settings.lowConfidenceThreshold)
      )
  );
}

// Sorted union of all distinct StageResult.fileName values across every row.
function deriveStageColumns(rows: CaseRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    for (const stage of row.stages) {
      names.add(stage.fileName);
    }
  }
  return Array.from(names).sort();
}

const DEFAULT_FILTERS: FilterState = {
  caseIdText: '',
  finalVerdict: 'all',
  stages: {},
  hasErrorsOnly: false,
  amountMismatchOnly: false,
  amountMatchFilter: 'all',
  hideNotWorking: true,    // hide not-working cases by default
  notWorkingOnly: false,   // not in "show only not-working" mode by default
};

// Resolves a value at `path` on `raw`, coercing it to a number or null.
function resolveScore(raw: unknown, path: string): { score: number | null; failed: boolean } {
  const resolved = getByPath(raw, path);
  if (resolved === undefined) {
    return { score: null, failed: true };
  }
  return { score: typeof resolved === 'number' ? resolved : null, failed: false };
}

// Resolves a label at `path` on `raw`. Falls back to `fallback` (the stage's
// fileName) if the path fails to resolve; stringifies non-string results.
function resolveLabel(
  raw: unknown,
  path: string,
  fallback: string
): { label: string; failed: boolean } {
  const resolved = getByPath(raw, path);
  if (resolved === undefined) {
    return { label: fallback, failed: true };
  }
  return { label: typeof resolved === 'string' ? resolved : String(resolved), failed: false };
}

// Recomputes finalVerdict, stages[].label/score, and hasErrors for a single
// row from its already-parsed raw/finalRaw blobs, using the given settings.
// Pure — no filesystem I/O.
function rederiveRow(row: CaseRow, settings: SettingsConfig): CaseRow {
  const errorDetails: string[] = [];

  const finalVerdictResolved = getByPath(row.finalRaw, settings.finalVerdict.valueKeyPath);
  const finalVerdict: 0 | 1 | null =
    finalVerdictResolved === 0 || finalVerdictResolved === 1 ? finalVerdictResolved : null;
  if (finalVerdictResolved === undefined) {
    errorDetails.push(
      `Could not resolve finalVerdict at path "${settings.finalVerdict.valueKeyPath}"`
    );
  }

  // Re-extract amounts using updated settings
  let extractedAmount: number | null = null;
  let calculatedAmount: number | null = null;
  let overallConfidence: number | null = null;
  let billTypeMatchCounts: BillTypeMatchCounts = { vectorSearch: 0, llmSelect: 0 };
  let tokenSummary: TokenSummary = {
    totalTokensIn: null,
    totalTokensOut: null,
    overallTotalTokens: null,
  };
  
  if (row.finalRaw !== null) {
    billTypeMatchCounts = countBillTypeMatchingMethods(row.finalRaw);
    tokenSummary = extractTokenSummary(row.finalRaw);

    const extractedResolved = getByPath(row.finalRaw, settings.amounts.extractedAmountKeyPath);
    if (extractedResolved !== undefined) {
      extractedAmount = typeof extractedResolved === 'number' ? extractedResolved : null;
    }
    
    const calculatedResolved = getByPath(row.finalRaw, settings.amounts.calculatedAmountKeyPath);
    if (calculatedResolved !== undefined) {
      calculatedAmount = typeof calculatedResolved === 'number' ? calculatedResolved : null;
    }

    // Re-extract overall confidence
    const confidenceResolved = getByPath(row.finalRaw, settings.overallConfidence.keyPath);
    if (confidenceResolved !== undefined) {
      overallConfidence = typeof confidenceResolved === 'number' ? confidenceResolved : null;
    }
  }

  // Calculate mismatch: differ by more than the configured tolerance
  // (default ₹5). Differences ≤ tolerance are treated as matching (rounding
  // artefacts in OCR / extraction are common at this scale).
  const amountMismatch =
    extractedAmount !== null &&
    calculatedAmount !== null &&
    Math.abs(extractedAmount - calculatedAmount) > settings.amounts.tolerance;

  const stages: StageResult[] = row.stages.map((stage) => {
    const override = settings.stageOverrides[stage.fileName];
    const labelKeyPath = override?.labelKeyPath ?? settings.stageDefaults.labelKeyPath;
    const valueKeyPath = override?.valueKeyPath ?? settings.stageDefaults.valueKeyPath;

    const { label, failed: labelFailed } = resolveLabel(stage.raw, labelKeyPath, stage.fileName);
    const { score, failed: scoreFailed } = resolveScore(stage.raw, valueKeyPath);

    if (labelFailed) {
      errorDetails.push(`Could not resolve label for "${stage.fileName}" at path "${labelKeyPath}"`);
    }
    if (scoreFailed) {
      errorDetails.push(`Could not resolve score for "${stage.fileName}" at path "${valueKeyPath}"`);
    }

    // Re-derive issue counts from raw blob so they stay consistent with the
    // loader's logic — issueCount/highSeverityCount are pure reads from
    // raw.issues[], not settings-dependent, so re-reading keeps them correct
    // even when rederiveRow is called after a settings change.
    let issueCount = 0;
    let highSeverityCount = 0;
    if (stage.raw !== null && typeof stage.raw === 'object') {
      const issuesRaw = (stage.raw as Record<string, unknown>)['issues'];
      if (Array.isArray(issuesRaw)) {
        issueCount = issuesRaw.length;
        highSeverityCount = issuesRaw.filter(
          (issue) =>
            typeof issue === 'object' &&
            issue !== null &&
            (issue as Record<string, unknown>)['severity'] === 'high',
        ).length;
      }
    }

    return { ...stage, label, score, issueCount, highSeverityCount };
  });

  const hasErrors = errorDetails.length > 0;

  // Re-detect isNotWorking from the re-derived stages and amounts.
  const extractionStage = stages.find((s) => s.fileName === 'extraction.json');
  const billTypeStage   = stages.find((s) => s.fileName === 'bill_type_resolution.json');
  const isNotWorking =
    finalVerdict === null ||
    calculatedAmount === null ||
    calculatedAmount === 0 ||
    extractionStage === undefined ||
    billTypeStage === undefined;

  return {
    ...row,
    finalVerdict,
    overallConfidence,
    extractedAmount,
    calculatedAmount,
    amountMismatch,
    nonPayableAmount: row.nonPayableAmount,
    nonPayableCount: row.nonPayableCount,
    failCause: row.failCause,
    failCauseDetails: row.failCauseDetails,
    minJudgeScore: row.minJudgeScore,
    avgJudgeScore: row.avgJudgeScore,
    judgeApprovedAgentCount: row.judgeApprovedAgentCount,
    judgeFailedAgentCount: row.judgeFailedAgentCount,
    judgeOverrideFlagCount: row.judgeOverrideFlagCount,
    billTypeMatchCounts,
    tokenSummary,
    stages,
    hasErrors,
    errorDetails,
    isNotWorking,
  };
}

// Builds human-readable reasons why a case is flagged as not-working.
function buildNotWorkingReasons(row: CaseRow): string[] {
  const reasons: string[] = [];
  if (row.finalVerdict === null)      reasons.push('No final verdict (case not counted in pass/fail)');
  if (row.calculatedAmount === null)  reasons.push('Calculated amount is missing');
  if (row.calculatedAmount === 0)     reasons.push('Calculated amount is zero');
  if (!row.stages.find(s => s.fileName === 'extraction.json'))
    reasons.push('Missing extraction stage');
  if (!row.stages.find(s => s.fileName === 'bill_type_resolution.json'))
    reasons.push('Missing bill_type_resolution stage');
  if (reasons.length === 0) reasons.push('Unknown reason');
  return reasons;
}

export const useAppStore = create<AppStore>((set, get) => ({
  allCaseRows: [],
  stageColumns: [],
  loadingProgress: null,
  excludedCasesCount: 0,
  excludedCases: [],
  excludedCasesOpen: false,

  settings: DEFAULT_SETTINGS,

  sidebarOpen: false,
  settingsPanelOpen: false,
  modalState: null,

  filters: { ...DEFAULT_FILTERS, stages: {} },

  filteredRows: [],

  insightsScope: 'filtered',

  async loadDirectory(handle) {
    set({ loadingProgress: { done: 0, total: 0 } });
    try {
      const { settings } = get();
      const allRows = await loadCaseRows(handle, settings, (done, total) => {
        set({ loadingProgress: { done, total } });
      });

      // Build the excluded-cases list from isNotWorking flag set by the loader.
      // All rows are kept in allCaseRows — the filter hides them by default.
      const excludedCases: ExcludedCase[] = allRows
        .filter(row => row.isNotWorking)
        .map(row => ({
          caseId: row.caseId,
          reasons: buildNotWorkingReasons(row),
          row,
        }));

      const stageColumns = deriveStageColumns(allRows);
      const filteredRows = applyAllFilters(allRows, get().filters, settings);
      set({
        allCaseRows: allRows,
        stageColumns,
        filteredRows,
        excludedCasesCount: excludedCases.length,
        excludedCases,
        loadingProgress: null,
      });
      saveDirHandle(handle).catch((err) => {
        console.warn('saveDirHandle failed:', err);
      });
    } catch (err) {
      console.error('loadDirectory failed:', err);
      set({ loadingProgress: null });
    }
  },

  rederiveCaseRows() {
    const { allCaseRows, settings, filters } = get();
    const rederived = allCaseRows.map((row) => rederiveRow(row, settings));
    const stageColumns = deriveStageColumns(rederived);
    const filteredRows = applyAllFilters(rederived, filters, settings);
    set({ allCaseRows: rederived, stageColumns, filteredRows });
  },

  openModal(caseId, fileName, json) {
    set({ modalState: { caseId, fileName, json } });
  },

  closeModal() {
    set({ modalState: null });
  },

  setExcludedCasesOpen(open) {
    set({ excludedCasesOpen: open });
  },

  // Contract: shallow merge at the TOP LEVEL ONLY. If `update.stages` is
  // present, it REPLACES the entire `filters.stages` map — it is not merged
  // key-by-key. Callers that want to update a single stage's filter must
  // spread the existing `filters.stages` map themselves and pass the full
  // desired map, e.g.:
  //   setFilter({ stages: { ...get().filters.stages, [fileName]: newStageFilter } })
  // This keeps the merge semantics simple and unambiguous for Task 8
  // (ColumnFilterHeader).
  setFilter(update) {
    const { filters, allCaseRows, settings } = get();
    const nextFilters: FilterState = { ...filters, ...update };
    const filteredRows = applyAllFilters(allCaseRows, nextFilters, settings);
    set({ filters: nextFilters, filteredRows });
  },

  clearFilter(key) {
    const { filters, allCaseRows, settings } = get();
    const nextFilters: FilterState = { ...filters, [key]: DEFAULT_FILTERS[key] };
    const filteredRows = applyAllFilters(allCaseRows, nextFilters, settings);
    set({ filters: nextFilters, filteredRows });
  },

  clearAllFilters() {
    const { allCaseRows, settings } = get();
    const nextFilters: FilterState = { ...DEFAULT_FILTERS, stages: {} };
    const filteredRows = applyAllFilters(allCaseRows, nextFilters, settings);
    set({ filters: nextFilters, filteredRows });
  },

  toggleSidebar() {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  toggleSettingsPanel() {
    set((state) => ({ settingsPanelOpen: !state.settingsPanelOpen }));
  },

  setInsightsScope(scope) {
    set({ insightsScope: scope });
  },

  // Note: does NOT call rederiveCaseRows() automatically. Per the design,
  // the SettingsPanel's "Save" button explicitly calls
  // store.rederiveCaseRows() after updateSettings (see Task 12).
  updateSettings(patch) {
    const { settings, allCaseRows, filters } = get();
    const nextSettings: SettingsConfig = { ...settings, ...patch };
    const filteredRows = applyAllFilters(allCaseRows, filters, nextSettings);
    set({ settings: nextSettings, filteredRows });
  },
}));
