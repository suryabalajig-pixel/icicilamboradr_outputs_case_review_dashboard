import { create } from 'zustand';
import { getByPath } from '../lib/jsonPath';
import type {
  AppStore,
  CaseRow,
  FilterState,
  SettingsConfig,
  StageResult,
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
  const finalVerdict: number | null =
    typeof finalVerdictResolved === 'number' ? finalVerdictResolved : null;
  if (finalVerdictResolved === undefined) {
    errorDetails.push(
      `Could not resolve finalVerdict at path "${settings.finalVerdict.valueKeyPath}"`
    );
  }

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

    return { ...stage, label, score };
  });

  const hasErrors = errorDetails.length > 0;

  return {
    ...row,
    finalVerdict,
    stages,
    hasErrors,
    errorDetails,
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  allCaseRows: [],
  stageColumns: [],
  loadingProgress: null,

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
      const rows = await loadCaseRows(handle, settings, (done, total) => {
        set({ loadingProgress: { done, total } });
      });
      const stageColumns = deriveStageColumns(rows);
      const filteredRows = applyAllFilters(rows, get().filters, get().settings);
      set({
        allCaseRows: rows,
        stageColumns,
        filteredRows,
        loadingProgress: null,
      });
      // Fire-and-forget: don't block the load on persisting the handle.
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
