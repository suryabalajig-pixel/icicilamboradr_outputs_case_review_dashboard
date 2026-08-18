import type { CaseRow } from './types';

// Pure analytics functions — no store imports, no side effects, no filesystem access.

// ─── Verdict counts ──────────────────────────────────────────────────────────

export function passCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.finalVerdict === 1).length;
}

export function failCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.finalVerdict === 0).length;
}

export function passRate(rows: CaseRow[]): number {
  let numerator = 0;
  let denominator = 0;
  for (const row of rows) {
    if (row.finalVerdict !== null) {
      denominator += 1;
      if (row.finalVerdict === 1) {
        numerator += 1;
      }
    }
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

// ─── Fail-reason breakdown ───────────────────────────────────────────────────

/**
 * Cases that failed ONLY because extraction amount ≠ calculated amount.
 * verdict=0 AND amountMismatch=true.
 */
export function failedByAmountMismatchCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.finalVerdict === 0 && row.amountMismatch === true).length;
}

/**
 * Cases that failed because overall confidence is below the threshold,
 * but the extracted and calculated amounts DO match (no amount mismatch).
 * verdict=0 AND amountMismatch=false AND overallConfidence < threshold.
 */
export function failedByLowConfidenceCount(rows: CaseRow[], threshold: number): number {
  return rows.filter(
    (row) =>
      row.finalVerdict === 0 &&
      row.amountMismatch === false &&
      row.overallConfidence !== null &&
      row.overallConfidence < threshold,
  ).length;
}

/**
 * Cases that failed but amounts matched AND confidence was at or above threshold.
 * These were blocked by an adjudication agent (document_checker, admin, financial, etc.).
 * verdict=0 AND amountMismatch=false AND (overallConfidence >= threshold OR overallConfidence is null).
 */
export function failedByAgentBlockCount(rows: CaseRow[], threshold: number): number {
  return rows.filter(
    (row) =>
      row.finalVerdict === 0 &&
      row.amountMismatch === false &&
      (row.overallConfidence === null || row.overallConfidence >= threshold),
  ).length;
}

// ─── Stage / confidence helpers ──────────────────────────────────────────────

export function avgConfidence(rows: CaseRow[], stageFileName: string): number | null {
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const stage = row.stages.find((s) => s.fileName === stageFileName);
    if (stage && stage.score !== null) {
      sum += stage.score;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

export function lowConfidenceCount(
  rows: CaseRow[],
  stageFileName: string,
  threshold: number,
): number {
  let count = 0;
  for (const row of rows) {
    const stage = row.stages.find((s) => s.fileName === stageFileName);
    if (stage && stage.score !== null && stage.score < threshold) {
      count += 1;
    }
  }
  return count;
}

export function errorCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.hasErrors).length;
}

export function notWorkingCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.isNotWorking).length;
}

export function amountMismatchCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.amountMismatch).length;
}

// ─── Knocked (non-payable deductions) helpers ─────────────────────────────────

/**
 * "Knocked" = the financial agent marked at least one charge as non-payable
 * (nonPayableAmount > 0).
 *
 * Failed cases WITH knocked deductions — verdict=0 AND nonPayableAmount > 0.
 * Real data: 23 / 48 failed cases have non-payable deductions applied.
 */
export function failedWithKnockedCount(rows: CaseRow[]): number {
  return rows.filter(
    (row) => row.finalVerdict === 0 && row.nonPayableAmount !== null && row.nonPayableAmount > 0,
  ).length;
}

/**
 * Failed cases WITHOUT any knocked deductions — verdict=0 AND nonPayableAmount === 0
 * OR nonPayableAmount is null (adjudication.json absent).
 * Real data: 25 / 48 failed cases have zero non-payable deductions.
 */
export function failedWithoutKnockedCount(rows: CaseRow[]): number {
  return rows.filter(
    (row) =>
      row.finalVerdict === 0 &&
      (row.nonPayableAmount === null || row.nonPayableAmount === 0),
  ).length;
}

/**
 * All cases (pass + fail) that have any knocked deductions (nonPayableAmount > 0).
 * Useful for the InsightsBar total-with-knocked card.
 */
export function withKnockedCount(rows: CaseRow[]): number {
  return rows.filter(
    (row) => row.nonPayableAmount !== null && row.nonPayableAmount > 0,
  ).length;
}

/**
 * Passed cases WITH knocked deductions — verdict=1 AND nonPayableAmount > 0.
 * These cases were approved despite having some charges disallowed.
 * Real data: 8 / 52 passed cases have non-payable deductions applied.
 */
export function passedWithKnockedCount(rows: CaseRow[]): number {
  return rows.filter(
    (row) => row.finalVerdict === 1 && row.nonPayableAmount !== null && row.nonPayableAmount > 0,
  ).length;
}

// ─── Judge override / quality helpers ────────────────────────────────────────

/**
 * Cases where judge explicitly set status="pass" on at least one agent
 * (i.e. judge fully approved that agent's output — not just "revise").
 * These are rare — only 2 instances found in 100 cases (judge.status='pass').
 */
export function passedWithJudgeApprovalCount(rows: CaseRow[]): number {
  return rows.filter(
    (row) =>
      row.finalVerdict === 1 &&
      row.judgeApprovedAgentCount !== null &&
      row.judgeApprovedAgentCount > 0,
  ).length;
}

/**
 * Cases that PASSED (verdict=1) but had at least one agent where the judge
 * explicitly set status="fail" — a direct contradiction (agent was overridden
 * downward but the case still passed through).
 */
export function passedWithJudgeFailFlagCount(rows: CaseRow[]): number {
  return rows.filter(
    (row) =>
      row.finalVerdict === 1 &&
      row.judgeFailedAgentCount !== null &&
      row.judgeFailedAgentCount > 0,
  ).length;
}

/**
 * Cases that PASSED (verdict=1) but the minimum judge score across all agents
 * was below `threshold` — indicating the judge had low confidence in the
 * agent outputs even though the case was approved.
 * Real data: 35 / 52 passed cases have at least one agent with judge.score < 0.75.
 */
export function passedWithLowJudgeScoreCount(rows: CaseRow[], threshold: number): number {
  return rows.filter(
    (row) =>
      row.finalVerdict === 1 &&
      row.minJudgeScore !== null &&
      row.minJudgeScore < threshold,
  ).length;
}

/**
 * Cases that PASSED (verdict=1) AND have at least one judge override flag.
 * A flag is: judge.status="fail", judge.status="pass", or judge.score < 0.70.
 * judgeOverrideFlagCount is the total flags summed across all agents.
 * Real data: 36 / 52 passed cases carry at least one override flag.
 */
export function passedWithAnyJudgeFlagCount(rows: CaseRow[]): number {
  return rows.filter(
    (row) =>
      row.finalVerdict === 1 &&
      row.judgeOverrideFlagCount !== null &&
      row.judgeOverrideFlagCount > 0,
  ).length;
}

/**
 * Total number of judge override flags across all passed cases.
 * Useful as a "flag volume" metric (vs. just counting affected cases).
 */
export function totalJudgeFlagsInPassedCases(rows: CaseRow[]): number {
  return rows
    .filter((row) => row.finalVerdict === 1 && row.judgeOverrideFlagCount !== null)
    .reduce((sum, row) => sum + (row.judgeOverrideFlagCount ?? 0), 0);
}

export function stageInsights(
  rows: CaseRow[],
  stageFiles: string[],
  threshold: number,
): { fileName: string; avg: number | null; lowCount: number }[] {
  return stageFiles
    .map((fileName) => ({
      fileName,
      avg: avgConfidence(rows, fileName),
      lowCount: lowConfidenceCount(rows, fileName, threshold),
    }))
    .sort((a, b) => b.lowCount - a.lowCount);
}
