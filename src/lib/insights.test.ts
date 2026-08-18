import { describe, expect, it } from 'vitest';
import {
  avgConfidence,
  errorCount,
  lowConfidenceCount,
  passRate,
  stageInsights,
} from './insights';
import type { CaseRow, StageResult } from './types';

function makeStage(fileName: string, score: number | null): StageResult {
  return { fileName, label: fileName, score, issueCount: 0, highSeverityCount: 0, raw: null };
}

function makeRow(overrides: Partial<CaseRow>): CaseRow {
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
    finalRaw: null,
    stages: [],
    hasErrors: false,
    errorDetails: [],
    isNotWorking: false,
    ...overrides,
  };
}

describe('passRate', () => {
  it('computes the ratio of verdict 1 over non-null verdicts', () => {
    const rows = [
      makeRow({ finalVerdict: 1 }),
      makeRow({ finalVerdict: 1 }),
      makeRow({ finalVerdict: 0 }),
      makeRow({ finalVerdict: null }),
    ];
    expect(passRate(rows)).toBeCloseTo(2 / 3);
  });

  it('returns 0 when there are no rows', () => {
    expect(passRate([])).toBe(0);
  });

  it('returns 0 when every verdict is null', () => {
    expect(passRate([makeRow({ finalVerdict: null }), makeRow({ finalVerdict: null })])).toBe(0);
  });
});

describe('avgConfidence', () => {
  it('averages scores for the matching stage file, ignoring nulls', () => {
    const rows = [
      makeRow({ stages: [makeStage('categorisation.json', 0.8)] }),
      makeRow({ stages: [makeStage('categorisation.json', 0.6)] }),
      makeRow({ stages: [makeStage('categorisation.json', null)] }),
      makeRow({ stages: [makeStage('other.json', 0.9)] }),
    ];
    expect(avgConfidence(rows, 'categorisation.json')).toBeCloseTo(0.7);
  });

  it('returns null when there are no valid scores for that stage', () => {
    const rows = [makeRow({ stages: [makeStage('categorisation.json', null)] })];
    expect(avgConfidence(rows, 'categorisation.json')).toBeNull();
  });

  it('returns null when no row has that stage at all', () => {
    const rows = [makeRow({ stages: [makeStage('other.json', 0.5)] })];
    expect(avgConfidence(rows, 'categorisation.json')).toBeNull();
  });
});

describe('lowConfidenceCount', () => {
  it('counts rows below the threshold for the given stage', () => {
    const rows = [
      makeRow({ stages: [makeStage('categorisation.json', 0.5)] }),
      makeRow({ stages: [makeStage('categorisation.json', 0.9)] }),
      makeRow({ stages: [makeStage('categorisation.json', null)] }),
      makeRow({ stages: [makeStage('categorisation.json', 0.69)] }),
    ];
    expect(lowConfidenceCount(rows, 'categorisation.json', 0.7)).toBe(2);
  });

  it('returns 0 when no rows are below the threshold', () => {
    const rows = [makeRow({ stages: [makeStage('categorisation.json', 0.9)] })];
    expect(lowConfidenceCount(rows, 'categorisation.json', 0.7)).toBe(0);
  });
});

describe('errorCount', () => {
  it('counts rows with hasErrors true', () => {
    const rows = [
      makeRow({ hasErrors: true }),
      makeRow({ hasErrors: false }),
      makeRow({ hasErrors: true }),
    ];
    expect(errorCount(rows)).toBe(2);
  });

  it('returns 0 when no rows have errors', () => {
    expect(errorCount([makeRow({ hasErrors: false })])).toBe(0);
  });
});

describe('stageInsights', () => {
  it('returns one entry per stage file, sorted by lowCount descending', () => {
    const rows = [
      makeRow({
        stages: [makeStage('categorisation.json', 0.9), makeStage('extraction.json', 0.3)],
      }),
      makeRow({
        stages: [makeStage('categorisation.json', 0.95), makeStage('extraction.json', 0.4)],
      }),
      makeRow({
        stages: [makeStage('categorisation.json', 0.85), makeStage('extraction.json', 0.6)],
      }),
    ];

    const result = stageInsights(rows, ['categorisation.json', 'extraction.json'], 0.7);

    expect(result).toEqual([
      { fileName: 'extraction.json', avg: (0.3 + 0.4 + 0.6) / 3, lowCount: 3 },
      { fileName: 'categorisation.json', avg: (0.9 + 0.95 + 0.85) / 3, lowCount: 0 },
    ]);
  });

  it('returns avg null for a stage file with no valid scores', () => {
    const rows = [makeRow({ stages: [makeStage('categorisation.json', null)] })];
    const result = stageInsights(rows, ['categorisation.json'], 0.7);
    expect(result).toEqual([{ fileName: 'categorisation.json', avg: null, lowCount: 0 }]);
  });
});
