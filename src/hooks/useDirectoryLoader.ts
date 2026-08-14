import { listJsonFiles, listSubdirectories, readJsonFile } from '../lib/fsWalk';
import { getByPath } from '../lib/jsonPath';
import type { CaseRow, SettingsConfig, StageResult } from '../lib/types';

// Number of case folders processed concurrently per batch. Matches the
// design doc's performance section: batched (not one giant Promise.all over
// everything, and not fully serial).
const BATCH_SIZE = 10;

// Resolves the finalVerdict for a single case folder from its parsed
// consolidated_final.json blob (or null if that file was missing/unparsable).
function resolveFinalVerdict(
  finalRaw: unknown,
  valueKeyPath: string
): { finalVerdict: number | null; failed: boolean } {
  const resolved = getByPath(finalRaw, valueKeyPath);
  if (resolved === undefined) {
    return { finalVerdict: null, failed: true };
  }
  const finalVerdict: number | null = typeof resolved === 'number' ? resolved : null;
  return { finalVerdict, failed: false };
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
