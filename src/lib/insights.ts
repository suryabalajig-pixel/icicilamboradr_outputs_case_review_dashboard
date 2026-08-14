import type { CaseRow } from './types';

// Pure analytics functions — no store imports, no side effects, no filesystem access.

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
  threshold: number
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

export function stageInsights(
  rows: CaseRow[],
  stageFiles: string[],
  threshold: number
): { fileName: string; avg: number | null; lowCount: number }[] {
  return stageFiles
    .map((fileName) => ({
      fileName,
      avg: avgConfidence(rows, fileName),
      lowCount: lowConfidenceCount(rows, fileName, threshold),
    }))
    .sort((a, b) => b.lowCount - a.lowCount);
}
