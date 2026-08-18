import { beforeEach, describe, expect, it } from 'vitest';
import {
  matchesCaseIdFilter,
  matchesHasErrorsFilter,
  matchesStageFilter,
  matchesVerdictFilter,
  useAppStore,
} from './appStore';
import { DEFAULT_SETTINGS } from '../lib/types';
import type { CaseRow, SettingsConfig, StageResult } from '../lib/types';

function makeStage(fileName: string, score: number | null, raw: unknown = null): StageResult {
  return { fileName, label: fileName, score, issueCount: 0, highSeverityCount: 0, raw: raw ?? { score } };
}

function makeRow(overrides: Partial<CaseRow> = {}): CaseRow {
  return {
    caseId: 'case1',
    finalVerdict: null,
    overallConfidence: null,
    extractedAmount: null,
    calculatedAmount: null,
    amountMismatch: false,
    nonPayableAmount: null,
    nonPayableCount: null,
    failCause: null,
    failCauseDetails: [],
    minJudgeScore: null,
    avgJudgeScore: null,
    judgeApprovedAgentCount: null,
    judgeFailedAgentCount: null,
    judgeOverrideFlagCount: null,
    billTypeMatchCounts: { vectorSearch: 0, llmSelect: 0 },
    tokenSummary: { totalTokensIn: null, totalTokensOut: null, overallTotalTokens: null },
    finalRaw: { bill_summary: { case_verdict: 1 } },
    stages: [],
    hasErrors: false,
    errorDetails: [],
    isNotWorking: false,
    ...overrides,
  };
}

// ============================================================
// Filter predicate helpers
// ============================================================

describe('matchesCaseIdFilter', () => {
  it('matches everything when text is empty', () => {
    expect(matchesCaseIdFilter(makeRow({ caseId: 'CASE-123' }), '')).toBe(true);
  });

  it('matches case-insensitive substrings', () => {
    expect(matchesCaseIdFilter(makeRow({ caseId: 'CASE-123' }), 'case-1')).toBe(true);
    expect(matchesCaseIdFilter(makeRow({ caseId: 'CASE-123' }), 'case-9')).toBe(false);
  });
});

describe('matchesVerdictFilter', () => {
  it('matches everything when v is "all"', () => {
    expect(matchesVerdictFilter(makeRow({ finalVerdict: null }), 'all')).toBe(true);
  });

  it('matches exact verdict', () => {
    expect(matchesVerdictFilter(makeRow({ finalVerdict: 1 }), 1)).toBe(true);
    expect(matchesVerdictFilter(makeRow({ finalVerdict: 0 }), 1)).toBe(false);
    expect(matchesVerdictFilter(makeRow({ finalVerdict: null }), 0)).toBe(false);
  });
});

describe('matchesHasErrorsFilter', () => {
  it('matches everything when hasErrorsOnly is false', () => {
    expect(matchesHasErrorsFilter(makeRow({ hasErrors: false }), false)).toBe(true);
    expect(matchesHasErrorsFilter(makeRow({ hasErrors: true }), false)).toBe(true);
  });

  it('requires hasErrors === true when hasErrorsOnly is true', () => {
    expect(matchesHasErrorsFilter(makeRow({ hasErrors: true }), true)).toBe(true);
    expect(matchesHasErrorsFilter(makeRow({ hasErrors: false }), true)).toBe(false);
  });
});

describe('matchesStageFilter', () => {
  const threshold = 0.7;

  it('treats a missing stage entry as a null score', () => {
    const row = makeRow({ stages: [] });
    expect(
      matchesStageFilter(row, 'categorisation.json', { min: 0.5, max: null, lowConfOnly: false }, threshold)
    ).toBe(false);
  });

  it('matches everything when min, max are null and lowConfOnly is false', () => {
    const row = makeRow({ stages: [makeStage('categorisation.json', null)] });
    expect(
      matchesStageFilter(row, 'categorisation.json', { min: null, max: null, lowConfOnly: false }, threshold)
    ).toBe(true);
  });

  it('lowConfOnly requires a non-null score below the threshold', () => {
    const lowRow = makeRow({ stages: [makeStage('categorisation.json', 0.5)] });
    const highRow = makeRow({ stages: [makeStage('categorisation.json', 0.9)] });
    const nullRow = makeRow({ stages: [makeStage('categorisation.json', null)] });

    expect(
      matchesStageFilter(lowRow, 'categorisation.json', { min: null, max: null, lowConfOnly: true }, threshold)
    ).toBe(true);
    expect(
      matchesStageFilter(highRow, 'categorisation.json', { min: null, max: null, lowConfOnly: true }, threshold)
    ).toBe(false);
    expect(
      matchesStageFilter(nullRow, 'categorisation.json', { min: null, max: null, lowConfOnly: true }, threshold)
    ).toBe(false);
  });

  it('applies min/max range and excludes null scores when a range is active', () => {
    const row = makeRow({ stages: [makeStage('categorisation.json', 0.8)] });
    const nullRow = makeRow({ stages: [makeStage('categorisation.json', null)] });

    expect(
      matchesStageFilter(row, 'categorisation.json', { min: 0.7, max: 0.9, lowConfOnly: false }, threshold)
    ).toBe(true);
    expect(
      matchesStageFilter(row, 'categorisation.json', { min: 0.85, max: null, lowConfOnly: false }, threshold)
    ).toBe(false);
    expect(
      matchesStageFilter(row, 'categorisation.json', { min: null, max: 0.75, lowConfOnly: false }, threshold)
    ).toBe(false);
    expect(
      matchesStageFilter(nullRow, 'categorisation.json', { min: 0.5, max: null, lowConfOnly: false }, threshold)
    ).toBe(false);
  });
});

// ============================================================
// Store actions
// ============================================================

function resetStore() {
  useAppStore.setState({
    allCaseRows: [],
    stageColumns: [],
    loadingProgress: null,
    excludedCasesCount: 0,
    settings: DEFAULT_SETTINGS,
    sidebarOpen: false,
    settingsPanelOpen: false,
    modalState: null,
    filters: { caseIdText: '', finalVerdict: 'all', stages: {}, hasErrorsOnly: false, amountMismatchOnly: false, amountMatchFilter: 'all', hideNotWorking: true, notWorkingOnly: false },
    filteredRows: [],
    insightsScope: 'filtered',
  });
}

describe('rederiveCaseRows', () => {
  beforeEach(resetStore);

  it('recomputes finalVerdict, stage label/score, hasErrors, and stageColumns from current settings', () => {
    const rows: CaseRow[] = [
      {
        caseId: 'case1',
        finalVerdict: null,
        overallConfidence: null,
        extractedAmount: null,
        calculatedAmount: null,
        amountMismatch: false,
        nonPayableAmount: null,
        nonPayableCount: null,
        failCause: null,
        failCauseDetails: [],
        minJudgeScore: null,
        avgJudgeScore: null,
        judgeApprovedAgentCount: null,
        judgeFailedAgentCount: null,
        judgeOverrideFlagCount: null,
        billTypeMatchCounts: { vectorSearch: 0, llmSelect: 0 },
        tokenSummary: { totalTokensIn: null, totalTokensOut: null, overallTotalTokens: null },
        finalRaw: { bill_summary: { case_verdict: 1 } },
        stages: [
          { fileName: 'categorisation.json', label: '', score: null, issueCount: 0, highSeverityCount: 0, raw: { stage: 'cat', score: 0.9 } },
        ],
        hasErrors: true,
        errorDetails: ['stale'],
        isNotWorking: false,
      },
    ];

    useAppStore.setState({ allCaseRows: rows });
    useAppStore.getState().rederiveCaseRows();

    const state = useAppStore.getState();
    expect(state.allCaseRows[0].finalVerdict).toBe(1);
    expect(state.allCaseRows[0].stages[0].label).toBe('cat');
    expect(state.allCaseRows[0].stages[0].score).toBe(0.9);
    expect(state.allCaseRows[0].hasErrors).toBe(false);
    expect(state.stageColumns).toEqual(['categorisation.json']);
    expect(state.filteredRows).toHaveLength(1);
  });

  it('marks hasErrors true and coerces finalVerdict to null when the configured path fails to resolve', () => {
    const rows: CaseRow[] = [
      {
        caseId: 'case1',
        finalVerdict: 1,
        overallConfidence: null,
        extractedAmount: null,
        calculatedAmount: null,
        amountMismatch: false,
        nonPayableAmount: null,
        nonPayableCount: null,
        failCause: null,
        failCauseDetails: [],
        minJudgeScore: null,
        avgJudgeScore: null,
        judgeApprovedAgentCount: null,
        judgeFailedAgentCount: null,
        judgeOverrideFlagCount: null,
        billTypeMatchCounts: { vectorSearch: 0, llmSelect: 0 },
        tokenSummary: { totalTokensIn: null, totalTokensOut: null, overallTotalTokens: null },
        finalRaw: { bill_summary: {} }, // case_verdict missing
        stages: [
          { fileName: 'categorisation.json', label: 'x', score: 0.9, issueCount: 0, highSeverityCount: 0, raw: {} }, // score missing too
        ],
        hasErrors: false,
        errorDetails: [],
        isNotWorking: false,
      },
    ];

    useAppStore.setState({ allCaseRows: rows });
    useAppStore.getState().rederiveCaseRows();

    const row = useAppStore.getState().allCaseRows[0];
    expect(row.finalVerdict).toBeNull();
    expect(row.stages[0].score).toBeNull();
    expect(row.stages[0].label).toBe('categorisation.json'); // falls back to fileName
    expect(row.hasErrors).toBe(true);
    expect(row.errorDetails.length).toBeGreaterThan(0);
  });

  it('respects stageOverrides for label/value key paths over stageDefaults', () => {
    const settings: SettingsConfig = {
      ...DEFAULT_SETTINGS,
      stageOverrides: {
        'extraction.json': { valueKeyPath: 'confidence' },
      },
    };
    const rows: CaseRow[] = [
      {
        caseId: 'case1',
        finalVerdict: null,
        overallConfidence: null,
        extractedAmount: null,
        calculatedAmount: null,
        amountMismatch: false,
        nonPayableAmount: null,
        nonPayableCount: null,
        failCause: null,
        failCauseDetails: [],
        minJudgeScore: null,
        avgJudgeScore: null,
        judgeApprovedAgentCount: null,
        judgeFailedAgentCount: null,
        judgeOverrideFlagCount: null,
        billTypeMatchCounts: { vectorSearch: 0, llmSelect: 0 },
        tokenSummary: { totalTokensIn: null, totalTokensOut: null, overallTotalTokens: null },
        finalRaw: { bill_summary: { case_verdict: 0 } },
        stages: [
          { fileName: 'extraction.json', label: '', score: null, issueCount: 0, highSeverityCount: 0, raw: { stage: 'extraction', confidence: 0.55 } },
        ],
        hasErrors: false,
        errorDetails: [],
        isNotWorking: false,
      },
    ];

    useAppStore.setState({ allCaseRows: rows, settings });
    useAppStore.getState().rederiveCaseRows();

    expect(useAppStore.getState().allCaseRows[0].stages[0].score).toBe(0.55);
  });
});

describe('setFilter / clearFilter / clearAllFilters', () => {
  beforeEach(resetStore);

  it('setFilter shallow-merges at the top level and replaces filters.stages wholesale', () => {
    useAppStore.getState().setFilter({ caseIdText: 'abc' });
    expect(useAppStore.getState().filters.caseIdText).toBe('abc');
    expect(useAppStore.getState().filters.finalVerdict).toBe('all');

    useAppStore.getState().setFilter({ stages: { 'categorisation.json': { min: 0.5, max: null, lowConfOnly: false } } });
    expect(useAppStore.getState().filters.stages).toEqual({
      'categorisation.json': { min: 0.5, max: null, lowConfOnly: false },
    });

    // A subsequent setFilter with a different stages map REPLACES, not merges.
    useAppStore.getState().setFilter({ stages: { 'extraction.json': { min: null, max: 0.9, lowConfOnly: false } } });
    expect(useAppStore.getState().filters.stages).toEqual({
      'extraction.json': { min: null, max: 0.9, lowConfOnly: false },
    });
  });

  it('setFilter recomputes filteredRows', () => {
    const rows: CaseRow[] = [makeRow({ caseId: 'alpha' }), makeRow({ caseId: 'beta' })];
    useAppStore.setState({ allCaseRows: rows, filteredRows: rows });

    useAppStore.getState().setFilter({ caseIdText: 'alp' });
    expect(useAppStore.getState().filteredRows.map((r) => r.caseId)).toEqual(['alpha']);
  });

  it('clearFilter resets a single key to its default', () => {
    useAppStore.getState().setFilter({ caseIdText: 'abc', hasErrorsOnly: true });
    useAppStore.getState().clearFilter('caseIdText');

    const filters = useAppStore.getState().filters;
    expect(filters.caseIdText).toBe('');
    expect(filters.hasErrorsOnly).toBe(true); // untouched
  });

  it('clearAllFilters resets the entire filters object', () => {
    useAppStore.getState().setFilter({
      caseIdText: 'abc',
      finalVerdict: 1,
      hasErrorsOnly: true,
      stages: { 'x.json': { min: 1, max: 2, lowConfOnly: true } },
    });
    useAppStore.getState().clearAllFilters();

    expect(useAppStore.getState().filters).toEqual({
      caseIdText: '',
      finalVerdict: 'all',
      stages: {},
      hasErrorsOnly: false,
      amountMismatchOnly: false,
      amountMatchFilter: 'all',
      hideNotWorking: true,
      notWorkingOnly: false,
    });
  });
});

describe('updateSettings', () => {
  beforeEach(resetStore);

  it('shallow-merges the patch into settings and recomputes filteredRows, without rederiving rows', () => {
    const rows: CaseRow[] = [
      makeRow({
        caseId: 'case1',
        stages: [makeStage('categorisation.json', 0.5)],
      }),
    ];
    useAppStore.setState({
      allCaseRows: rows,
      filteredRows: rows,
      filters: {
        caseIdText: '',
        finalVerdict: 'all',
        stages: { 'categorisation.json': { min: null, max: null, lowConfOnly: true } },
        hasErrorsOnly: false,
        amountMismatchOnly: false,
        amountMatchFilter: 'all',
        hideNotWorking: true,
        notWorkingOnly: false,
      },
    });

    // Score 0.5 is below default threshold 0.70, so it currently matches lowConfOnly.
    expect(useAppStore.getState().filteredRows).toHaveLength(1);

    // Lowering the threshold below 0.5 should exclude the row without touching allCaseRows.
    useAppStore.getState().updateSettings({ lowConfidenceThreshold: 0.3 });

    expect(useAppStore.getState().settings.lowConfidenceThreshold).toBe(0.3);
    expect(useAppStore.getState().filteredRows).toHaveLength(0);
    expect(useAppStore.getState().allCaseRows[0].stages[0].score).toBe(0.5); // unchanged — no rederive
  });
});

describe('openModal / closeModal', () => {
  beforeEach(resetStore);

  it('openModal sets modalState and closeModal clears it', () => {
    useAppStore.getState().openModal('case1', 'categorisation.json', { a: 1 });
    expect(useAppStore.getState().modalState).toEqual({
      caseId: 'case1',
      fileName: 'categorisation.json',
      json: { a: 1 },
    });

    useAppStore.getState().closeModal();
    expect(useAppStore.getState().modalState).toBeNull();
  });
});

describe('toggleSidebar / toggleSettingsPanel / setInsightsScope', () => {
  beforeEach(resetStore);

  it('toggles booleans and sets scope', () => {
    expect(useAppStore.getState().sidebarOpen).toBe(false);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(true);

    expect(useAppStore.getState().settingsPanelOpen).toBe(false);
    useAppStore.getState().toggleSettingsPanel();
    expect(useAppStore.getState().settingsPanelOpen).toBe(true);

    useAppStore.getState().setInsightsScope('all');
    expect(useAppStore.getState().insightsScope).toBe('all');
  });
});

describe('loadDirectory', () => {
  beforeEach(resetStore);

  it('sets loadingProgress back to null and does not touch allCaseRows when the loader rejects', async () => {
    const fakeHandle = {} as FileSystemDirectoryHandle;
    // The placeholder loadCaseRows always throws — this exercises the
    // error-handling branch without needing Task 4's real implementation.
    await useAppStore.getState().loadDirectory(fakeHandle);

    expect(useAppStore.getState().loadingProgress).toBeNull();
    expect(useAppStore.getState().allCaseRows).toEqual([]);
  });
});
