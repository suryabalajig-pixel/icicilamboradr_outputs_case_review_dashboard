import { listJsonFiles, listSubdirectories, readJsonFile } from '../lib/fsWalk';
import { getByPath } from '../lib/jsonPath';
import { countBillTypeMatchingMethods } from '../lib/billTypeMatching';
import { extractTokenSummary } from '../lib/tokenSummary';
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
    return { fileName, label: fileName, score: null, raw: null };
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

  return { fileName, label, score, raw };
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
  let knockedOffBillIssue: boolean = false;
  let knockedOffBillCount: number = 0;
  let billTypeMatchCounts = { vectorSearch: 0, llmSelect: 0 };
  let tokenSummary = { totalTokensIn: null, totalTokensOut: null, overallTotalTokens: null };
  let tokenCount: number | null = null;
  
  if (finalFileReadOk && finalRaw !== null) {
    billTypeMatchCounts = countBillTypeMatchingMethods(finalRaw);
    tokenSummary = extractTokenSummary(finalRaw);

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

    // Extract token count
    const tokenResolved = getByPath(finalRaw, settings.tokens.keyPath);
    if (tokenResolved !== undefined) {
      tokenCount = typeof tokenResolved === 'number' ? tokenResolved : null;
    }
    
    // Debug token extraction (sample cases)
    if (Math.random() < 0.05) {
      console.log(`[${caseFolder.name}] Token path: "${settings.tokens.keyPath}"`);
      console.log(`[${caseFolder.name}] Token value found:`, tokenResolved);
      console.log(`[${caseFolder.name}] Token count set to:`, tokenCount);
    }

    // Extract knocked_off_bill - flag as present if it has any value
    // Also count the number of items in the array
    const knockedOffResolved = getByPath(finalRaw, settings.knockedOffBill.keyPath);
    
    // Debug: Log what we find (for first few cases)
    if (caseFolder.name.includes('case') || Math.random() < 0.05) {
      console.log(`[${caseFolder.name}] Checking path: "${settings.knockedOffBill.keyPath}"`);
      console.log(`[${caseFolder.name}] Found:`, knockedOffResolved ? (Array.isArray(knockedOffResolved) ? `Array with ${knockedOffResolved.length} items` : typeof knockedOffResolved) : 'undefined/null');
    }
    
    if (knockedOffResolved !== undefined && knockedOffResolved !== null) {
      // If it's an array, check if it has items and count them
      if (Array.isArray(knockedOffResolved)) {
        knockedOffBillCount = knockedOffResolved.length;
        knockedOffBillIssue = knockedOffResolved.length > 0;
      } 
      // If it's a string, check if it's not empty
      else if (typeof knockedOffResolved === 'string') {
        const knockedOffStr = knockedOffResolved.trim();
        knockedOffBillIssue = knockedOffStr !== '';
        knockedOffBillCount = knockedOffStr !== '' ? 1 : 0;
      }
      // If it's an object with properties, it has data
      else if (typeof knockedOffResolved === 'object') {
        knockedOffBillCount = Object.keys(knockedOffResolved).length;
        knockedOffBillIssue = knockedOffBillCount > 0;
      }
      // Any other value (number, boolean, etc.) means it has data
      else {
        knockedOffBillIssue = true;
        knockedOffBillCount = 1;
      }
    }
  }

  // Calculate mismatch with tolerance of 5
  // If difference > 5, it's a mismatch (false)
  // If difference <= 5, amounts are considered matching (true)
  const amountMismatch = 
    extractedAmount !== null && 
    calculatedAmount !== null && 
    Math.abs(extractedAmount - calculatedAmount) > 5;

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
    knockedOffBillIssue,
    knockedOffBillCount,
    billTypeMatchCounts,
    tokenSummary,
    tokenCount,
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
            knockedOffBillIssue: false,
            knockedOffBillCount: 0,
            billTypeMatchCounts: { vectorSearch: 0, llmSelect: 0 },
            tokenSummary: { totalTokensIn: null, totalTokensOut: null, overallTotalTokens: null },
            tokenCount: null,
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
