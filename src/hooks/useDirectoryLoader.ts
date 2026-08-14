import { listJsonFiles, listSubdirectories, readJsonFile } from '../lib/fsWalk';
import { getByPath } from '../lib/jsonPath';
import type { CaseRow, SettingsConfig, StageResult } from '../lib/types';
// Number of case folders processed concurrently per batch. Matches the
// design doc's performance section: batched (not one giant Promise.all over
// everything, and not fully serial).
const BATCH_SIZE = 10;

// Resolves the finalVerdict for a single case folder from its parsed
// consolidated_final.json blob (or null if that file was missing/unparsable).
// Matches appStore.ts's rederiveRow EXACTLY: `failed` (and thus hasErrors) is
// only true when getByPath itself returns undefined (path didn't resolve at
// all). A resolved-but-not-0/1 value is coerced to null WITHOUT being
// flagged as an error — Property 16 requires this loader and rederiveRow to
// agree bit-for-bit on the same raw blob + settings.
function resolveFinalVerdict(
  finalRaw: unknown,
  valueKeyPath: string
): { finalVerdict: 0 | 1 | null; failed: boolean } {
  const resolved = getByPath(finalRaw, valueKeyPath);
  const finalVerdict: 0 | 1 | null = resolved === 0 || resolved === 1 ? resolved : null;
  return { finalVerdict, failed: resolved === undefined };
}

// Resolves a stage's label/valueKeyPath the same way appStore.ts's
// rederiveCaseRows does: settings.stageOverrides[fileName] takes precedence
// over settings.stageDefaults.
function resolveStageKeyPaths(
  fileName: string,
  settings: SettingsConfig
): { labelKeyPath: string; valueKeyPath: string } {
  const override = settings.stageOverrides[fileName];
  return {
    labelKeyPath: override?.labelKeyPath ?? settings.stageDefaults.labelKeyPath,
    valueKeyPath: override?.valueKeyPath ?? settings.stageDefaults.valueKeyPath,
  };
}

// Parses a single stage JSON file handle into a StageResult, absorbing any
// read/parse failure into a null-score StageResult rather than throwing.
async function parseStageFile(
  fileHandle: FileSystemFileHandle,
  settings: SettingsConfig,
  errorDetails: string[]
): Promise<StageResult> {
  const fileName = fileHandle.name;

  let raw: unknown = null;
  try {
    raw = await readJsonFile(fileHandle);
  } catch {
    errorDetails.push(`Stage file "${fileName}" could not be read or parsed`);
    // Read/parse failure fallback: label = the full fileName (per the
    // algorithm's "label = handle.name (fallback)").
    return { fileName, label: fileName, score: null, issueCount: 0, highSeverityCount: 0, raw: null };
  }

  const { labelKeyPath, valueKeyPath } = resolveStageKeyPaths(fileName, settings);

  // Matches appStore.ts's resolveLabel/resolveScore EXACTLY (Property 16:
  // this loader and rederiveRow must agree on the same raw blob + settings):
  // `failed` (and thus hasErrors) is only true when getByPath itself returns
  // undefined. A resolved-but-wrong-type value is coerced silently, with no
  // error pushed.
  const labelResolved = getByPath(raw, labelKeyPath);
  let label: string;
  if (labelResolved === undefined) {
    // Fallback is the full fileName WITH ".json", same as appStore.ts's
    // resolveLabel(stage.raw, labelKeyPath, stage.fileName).
    label = fileName;
    errorDetails.push(`Could not resolve label for "${fileName}" at path "${labelKeyPath}"`);
  } else {
    label = typeof labelResolved === 'string' ? labelResolved : String(labelResolved);
  }

  const valueResolved = getByPath(raw, valueKeyPath);
  let score: number | null;
  if (valueResolved === undefined) {
    score = null;
    errorDetails.push(`Could not resolve score for "${fileName}" at path "${valueKeyPath}"`);
  } else {
    score = typeof valueResolved === 'number' ? valueResolved : null;
  }

  // Read issues[] array directly from the raw blob.
  // Each element is expected to have a `severity` string field.
  // We default to 0 for both counts when the field is absent or not an array.
  let issueCount = 0;
  let highSeverityCount = 0;
  const issuesRaw = (raw as Record<string, unknown>)['issues'];
  if (Array.isArray(issuesRaw)) {
    issueCount = issuesRaw.length;
    highSeverityCount = issuesRaw.filter(
      (issue): issue is Record<string, unknown> =>
        typeof issue === 'object' &&
        issue !== null &&
        (issue as Record<string, unknown>)['severity'] === 'high',
    ).length;
  }

  return { fileName, label, score, issueCount, highSeverityCount, raw };
}

// Parses one case folder into a CaseRow. Absorbs ALL internal errors — never
// throws — so a single bad case folder can never reject the whole batch.
async function parseCaseFolder(
  caseFolder: FileSystemDirectoryHandle,
  settings: SettingsConfig
): Promise<CaseRow> {
  const errorDetails: string[] = [];

  // --- consolidated_final.json ---
  let finalRaw: unknown = null;
  let finalFileReadOk = false;
  try {
    const finalFileHandle = await caseFolder.getFileHandle(settings.finalVerdict.file);
    finalRaw = await readJsonFile(finalFileHandle);
    finalFileReadOk = true;
  } catch {
    finalRaw = null;
    finalFileReadOk = false;
    errorDetails.push(`"${settings.finalVerdict.file}" not found or unparsable`);
  }

  // Resolve caseId from consolidated_final.json "case_number" key,
  // falling back to the folder name if unavailable.
  let caseId: string = caseFolder.name;
  if (finalRaw !== null && typeof finalRaw === 'object') {
    const caseNumber = (finalRaw as Record<string, unknown>)['case_number'];
    if (caseNumber !== undefined && caseNumber !== null) {
      caseId = String(caseNumber);
    }
  }

  const { finalVerdict, failed: finalVerdictFailed } = resolveFinalVerdict(
    finalRaw,
    settings.finalVerdict.valueKeyPath
  );
  if (finalVerdictFailed && finalFileReadOk) {
    errorDetails.push(
      `Could not resolve finalVerdict at path "${settings.finalVerdict.valueKeyPath}"`
    );
  }

  // --- Extract amounts ---
  let extractedAmount: number | null = null;
  let calculatedAmount: number | null = null;
  let overallConfidence: number | null = null;
  
  if (finalFileReadOk && finalRaw !== null) {
    const extractedResolved = getByPath(finalRaw, settings.amounts.extractedAmountKeyPath);
    if (extractedResolved !== undefined) {
      extractedAmount = typeof extractedResolved === 'number' ? extractedResolved : null;
    }
    
    const calculatedResolved = getByPath(finalRaw, settings.amounts.calculatedAmountKeyPath);
    if (calculatedResolved !== undefined) {
      calculatedAmount = typeof calculatedResolved === 'number' ? calculatedResolved : null;
    }

    // Extract overall confidence
    const confidenceResolved = getByPath(finalRaw, settings.overallConfidence.keyPath);
    if (confidenceResolved !== undefined) {
      overallConfidence = typeof confidenceResolved === 'number' ? confidenceResolved : null;
    }
  }

  // Calculate mismatch: both amounts must be non-null and differ by more than
  // the allowed margin of 5. Differences ≤ 5 are treated as matching (rounding
  // artefacts in OCR / extraction are common at this scale).
  const amountMismatch =
    extractedAmount !== null &&
    calculatedAmount !== null &&
    Math.abs(extractedAmount - calculatedAmount) > 5;

  // --- adjudication.json → financial agent → non_payable_total (knocked)
  //                        → all agents     → judge scores / statuses ----
  // Both data points come from adjudication.json so we read it once here.
  let nonPayableAmount: number | null = null;
  let minJudgeScore: number | null = null;
  let avgJudgeScore: number | null = null;
  let judgeApprovedAgentCount: number | null = null;
  let judgeFailedAgentCount: number | null = null;
  let judgeOverrideFlagCount: number | null = null;
  try {
    const adjFileHandle = await caseFolder.getFileHandle('adjudication.json');
    const adjRaw = await readJsonFile(adjFileHandle);
    if (
      adjRaw !== null &&
      typeof adjRaw === 'object' &&
      Array.isArray((adjRaw as Record<string, unknown>)['agents'])
    ) {
      const agents = (adjRaw as Record<string, unknown>)['agents'] as unknown[];

      // financial agent → non_payable_total
      const finAgent = agents.find(
        (a) =>
          typeof a === 'object' &&
          a !== null &&
          (a as Record<string, unknown>)['agent'] === 'financial',
      );
      if (finAgent !== undefined) {
        const nonPayResolved = getByPath(finAgent, 'report.totals.non_payable_total');
        if (typeof nonPayResolved === 'number') {
          nonPayableAmount = nonPayResolved;
        }
      }

      // all agents → judge.score + judge.status
      const judgeScores: number[] = [];
      let approvedCount = 0;
      let failedCount = 0;
      let overrideFlagCount = 0;
      for (const agent of agents) {
        if (typeof agent !== 'object' || agent === null) continue;
        const judgeObj = (agent as Record<string, unknown>)['judge'];
        if (typeof judgeObj !== 'object' || judgeObj === null) continue;
        const judgeMap = judgeObj as Record<string, unknown>;
        const score = typeof judgeMap['score'] === 'number' ? (judgeMap['score'] as number) : null;
        if (score !== null) judgeScores.push(score);
        if (judgeMap['status'] === 'pass') { approvedCount++; overrideFlagCount++; }
        if (judgeMap['status'] === 'fail')  { failedCount++;   overrideFlagCount++; }
        // Very low judge confidence (< 0.70) regardless of status is also a flag
        if (score !== null && score < 0.70) overrideFlagCount++;
      }
      if (judgeScores.length > 0) {
        minJudgeScore = Math.min(...judgeScores);
        avgJudgeScore = judgeScores.reduce((s, v) => s + v, 0) / judgeScores.length;
      }
      judgeApprovedAgentCount  = approvedCount;
      judgeFailedAgentCount    = failedCount;
      judgeOverrideFlagCount   = overrideFlagCount;
    }
  } catch {
    // adjudication.json absent or unreadable — all fields stay null.
  }

  // --- stage_confidence/ ---
  let stages: StageResult[] = [];
  let stageDirHandle: FileSystemDirectoryHandle | null = null;
  try {
    stageDirHandle = await caseFolder.getDirectoryHandle('stage_confidence');
  } catch {
    stageDirHandle = null;
    errorDetails.push('stage_confidence/ directory not found');
  }
  if (stageDirHandle !== null) {
    try {
      const stageFileHandles = await listJsonFiles(stageDirHandle, settings.excludedStageFiles);
      stages = await Promise.all(
        stageFileHandles.map((fh) => parseStageFile(fh, settings, errorDetails))
      );
    } catch {
      // Guard listJsonFiles itself: if enumerating the directory fails
      // mid-parse, don't let that discard the already-resolved
      // finalVerdict/finalRaw for this case — just report no stages.
      stages = [];
      errorDetails.push('stage_confidence/ directory could not be listed');
    }
  }

  return {
    caseId,
    finalVerdict,
    overallConfidence,
    extractedAmount,
    calculatedAmount,
    amountMismatch,
    nonPayableAmount,
    minJudgeScore,
    avgJudgeScore,
    judgeApprovedAgentCount,
    judgeFailedAgentCount,
    judgeOverrideFlagCount,
    finalRaw,
    stages,
    hasErrors: errorDetails.length > 0,
    errorDetails,
  };
}

export async function loadCaseRows(
  handle: FileSystemDirectoryHandle,
  settings: SettingsConfig,
  onProgress: (done: number, total: number) => void
): Promise<CaseRow[]> {
  const caseFolders = await listSubdirectories(handle);
  const total = caseFolders.length;
  onProgress(0, total);

  const rows: CaseRow[] = [];
  let done = 0;

  for (let i = 0; i < caseFolders.length; i += BATCH_SIZE) {
    const batch = caseFolders.slice(i, i + BATCH_SIZE);
    const batchRows = await Promise.all(
      batch.map(async (caseFolder) => {
        try {
          return await parseCaseFolder(caseFolder, settings);
        } catch (err) {
          // Absolute last resort — parseCaseFolder should never throw, but
          // guarantee no per-case failure can ever escape loadCaseRows.
          return {
            caseId: caseFolder.name,
            finalVerdict: null,
            overallConfidence: null,
            extractedAmount: null,
            calculatedAmount: null,
            amountMismatch: false,
            nonPayableAmount: null,
            minJudgeScore: null,
            avgJudgeScore: null,
            judgeApprovedAgentCount: null,
            judgeFailedAgentCount: null,
            judgeOverrideFlagCount: null,
            finalRaw: null,
            stages: [],
            hasErrors: true,
            errorDetails: [`Unexpected error while parsing case folder: ${String(err)}`],
          } satisfies CaseRow;
        }
      })
    );
    rows.push(...batchRows);
    done += batch.length;
    onProgress(done, total);
  }

  return rows;
}
