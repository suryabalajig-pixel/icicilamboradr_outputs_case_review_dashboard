import { describe, expect, it } from 'vitest';
import { loadCaseRows } from './useDirectoryLoader';
import { DEFAULT_SETTINGS } from '../lib/types';
import type { SettingsConfig } from '../lib/types';

// Minimal mocks for the File System Access API handles — plain JS objects
// implementing just the methods loadCaseRows actually touches.

type Entry = FileSystemFileHandle | FileSystemDirectoryHandle;

function makeFileHandle(name: string, contents: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    async getFile() {
      return { text: async () => contents } as unknown as File;
    },
  } as unknown as FileSystemFileHandle;
}

function makeDirHandle(
  name: string,
  entries: Entry[],
  options: { missingNames?: string[] } = {}
): FileSystemDirectoryHandle {
  const byName = new Map(entries.map((e) => [e.name, e]));
  const missing = new Set(options.missingNames ?? []);

  return {
    kind: 'directory',
    name,
    async *values() {
      for (const entry of entries) {
        yield entry;
      }
    },
    async *entries() {
      for (const entry of entries) {
        yield [entry.name, entry] as [string, Entry];
      }
    },
    async getFileHandle(fileName: string) {
      if (missing.has(fileName)) {
        const err = new Error('NotFoundError');
        err.name = 'NotFoundError';
        throw err;
      }
      const found = byName.get(fileName);
      if (!found || found.kind !== 'file') {
        const err = new Error('NotFoundError');
        err.name = 'NotFoundError';
        throw err;
      }
      return found as FileSystemFileHandle;
    },
    async getDirectoryHandle(dirName: string) {
      if (missing.has(dirName)) {
        const err = new Error('NotFoundError');
        err.name = 'NotFoundError';
        throw err;
      }
      const found = byName.get(dirName);
      if (!found || found.kind !== 'directory') {
        const err = new Error('NotFoundError');
        err.name = 'NotFoundError';
        throw err;
      }
      return found as FileSystemDirectoryHandle;
    },
  } as unknown as FileSystemDirectoryHandle;
}

function finalJson(verdict: unknown) {
  return JSON.stringify({ bill_summary: { case_verdict: verdict } });
}

function stageJson(stage: string, score: unknown) {
  return JSON.stringify({ stage, score });
}

describe('loadCaseRows', () => {
  it('happy path: N valid case subfolders produce N CaseRows', async () => {
    const case1 = makeDirHandle('case1', [
      makeFileHandle('consolidated_final.json', finalJson(1)),
      makeDirHandle('stage_confidence', [
        makeFileHandle('categorisation.json', stageJson('categorisation', 0.9)),
        makeFileHandle('extraction.json', stageJson('extraction', 0.5)),
        makeFileHandle('summary.json', stageJson('summary', 0.1)), // excluded by default settings
      ]),
    ]);
    const case2 = makeDirHandle('case2', [
      makeFileHandle('consolidated_final.json', finalJson(0)),
      makeDirHandle('stage_confidence', [
        makeFileHandle('categorisation.json', stageJson('categorisation', 0.7)),
      ]),
    ]);
    const root = makeDirHandle('root', [case1, case2]);

    const progressCalls: Array<[number, number]> = [];
    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, (done, total) => {
      progressCalls.push([done, total]);
    });

    expect(rows).toHaveLength(2);

    const row1 = rows.find((r) => r.caseId === 'case1')!;
    expect(row1.finalVerdict).toBe(1);
    expect(row1.hasErrors).toBe(false);
    expect(row1.stages.map((s) => s.fileName).sort()).toEqual([
      'categorisation.json',
      'extraction.json',
    ]);
    const cat = row1.stages.find((s) => s.fileName === 'categorisation.json')!;
    expect(cat.label).toBe('categorisation');
    expect(cat.score).toBe(0.9);

    const row2 = rows.find((r) => r.caseId === 'case2')!;
    expect(row2.finalVerdict).toBe(0);
    expect(row2.hasErrors).toBe(false);
    expect(row2.stages).toHaveLength(1);

    // Progress: starts at (0, total), ends at (total, total), non-decreasing.
    expect(progressCalls[0]).toEqual([0, 2]);
    expect(progressCalls[progressCalls.length - 1]).toEqual([2, 2]);
    for (let i = 1; i < progressCalls.length; i++) {
      expect(progressCalls[i][0]).toBeGreaterThanOrEqual(progressCalls[i - 1][0]);
    }
  });

  it('marks hasErrors and finalVerdict null when consolidated_final.json is missing', async () => {
    const case1 = makeDirHandle(
      'case1',
      [
        makeDirHandle('stage_confidence', [
          makeFileHandle('categorisation.json', stageJson('categorisation', 0.9)),
        ]),
      ],
      { missingNames: ['consolidated_final.json'] }
    );
    const root = makeDirHandle('root', [case1]);

    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, () => {});

    expect(rows).toHaveLength(1);
    expect(rows[0].finalVerdict).toBeNull();
    expect(rows[0].hasErrors).toBe(true);
    expect(rows[0].errorDetails.some((d) => d.includes('consolidated_final.json'))).toBe(true);
  });

  it('marks hasErrors true and stages: [] when stage_confidence/ is missing', async () => {
    const case1 = makeDirHandle(
      'case1',
      [makeFileHandle('consolidated_final.json', finalJson(1))],
      { missingNames: ['stage_confidence'] }
    );
    const root = makeDirHandle('root', [case1]);

    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, () => {});

    expect(rows).toHaveLength(1);
    expect(rows[0].finalVerdict).toBe(1);
    expect(rows[0].stages).toEqual([]);
    expect(rows[0].hasErrors).toBe(true);
    expect(rows[0].errorDetails.some((d) => d.includes('stage_confidence'))).toBe(true);
  });

  it('produces a null-score StageResult with fileName/label fallback when a stage file fails to parse', async () => {
    const case1 = makeDirHandle('case1', [
      makeFileHandle('consolidated_final.json', finalJson(1)),
      makeDirHandle('stage_confidence', [
        makeFileHandle('broken.json', '{not valid json'),
      ]),
    ]);
    const root = makeDirHandle('root', [case1]);

    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, () => {});

    expect(rows).toHaveLength(1);
    expect(rows[0].stages).toHaveLength(1);
    expect(rows[0].stages[0]).toMatchObject({
      fileName: 'broken.json',
      label: 'broken.json',
      score: null,
      raw: null,
    });
    expect(rows[0].hasErrors).toBe(true);
  });

  it('marks hasErrors true and coerces to null when a configured getByPath resolves to undefined', async () => {
    const case1 = makeDirHandle('case1', [
      makeFileHandle('consolidated_final.json', JSON.stringify({ bill_summary: {} })), // case_verdict missing
      makeDirHandle('stage_confidence', [
        makeFileHandle('categorisation.json', JSON.stringify({ stage: 'categorisation' })), // score missing
      ]),
    ]);
    const root = makeDirHandle('root', [case1]);

    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, () => {});

    expect(rows).toHaveLength(1);
    expect(rows[0].finalVerdict).toBeNull();
    expect(rows[0].hasErrors).toBe(true);
    expect(rows[0].stages[0].score).toBeNull();
    expect(rows[0].stages[0].label).toBe('categorisation'); // label path resolved fine
  });

  it('treats a resolved-but-wrong-type score/verdict as null WITHOUT marking hasErrors (matches appStore.ts rederiveRow)', async () => {
    // The configured paths resolve to defined values that just aren't the
    // expected type (score should be a number, finalVerdict should be 0/1).
    // Per appStore.ts's resolveScore/rederiveRow, only `undefined` counts as
    // a failure — a wrong-type-but-defined value is silently coerced to null
    // with no error, and the label fallback (when it *does* trigger) must
    // still be the full fileName WITH ".json".
    const case1 = makeDirHandle('case1', [
      makeFileHandle(
        'consolidated_final.json',
        JSON.stringify({ bill_summary: { case_verdict: 'yes' } }) // wrong type, not 0/1
      ),
      makeDirHandle('stage_confidence', [
        makeFileHandle(
          'categorisation.json',
          JSON.stringify({ stage: 'categorisation', score: 'high' }) // wrong type, not a number
        ),
      ]),
    ]);
    const root = makeDirHandle('root', [case1]);

    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, () => {});

    expect(rows).toHaveLength(1);
    expect(rows[0].finalVerdict).toBeNull();
    expect(rows[0].stages[0].score).toBeNull();
    expect(rows[0].stages[0].label).toBe('categorisation'); // label path still resolved fine
    expect(rows[0].hasErrors).toBe(false); // wrong-type-but-defined is NOT an error
    expect(rows[0].errorDetails).toEqual([]);
  });

  it('falls back to the full fileName WITH ".json" when labelKeyPath resolves to undefined (matches appStore.ts resolveLabel)', async () => {
    const case1 = makeDirHandle('case1', [
      makeFileHandle('consolidated_final.json', finalJson(1)),
      makeDirHandle('stage_confidence', [
        // "stage" key (the default labelKeyPath) is absent entirely.
        makeFileHandle('categorisation.json', JSON.stringify({ score: 0.9 })),
      ]),
    ]);
    const root = makeDirHandle('root', [case1]);

    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, () => {});

    expect(rows[0].stages[0].label).toBe('categorisation.json'); // WITH extension
    expect(rows[0].stages[0].score).toBe(0.9);
    expect(rows[0].hasErrors).toBe(true); // undefined path IS an error
  });

  it('respects stageOverrides over stageDefaults for label/value key paths', async () => {
    const settings: SettingsConfig = {
      ...DEFAULT_SETTINGS,
      stageOverrides: {
        'extraction.json': { valueKeyPath: 'confidence' },
      },
    };
    const case1 = makeDirHandle('case1', [
      makeFileHandle('consolidated_final.json', finalJson(1)),
      makeDirHandle('stage_confidence', [
        makeFileHandle(
          'extraction.json',
          JSON.stringify({ stage: 'extraction', confidence: 0.55 })
        ),
      ]),
    ]);
    const root = makeDirHandle('root', [case1]);

    const rows = await loadCaseRows(root, settings, () => {});

    expect(rows[0].stages[0].score).toBe(0.55);
    expect(rows[0].hasErrors).toBe(false);
  });

  it('excludes files listed in settings.excludedStageFiles', async () => {
    const case1 = makeDirHandle('case1', [
      makeFileHandle('consolidated_final.json', finalJson(1)),
      makeDirHandle('stage_confidence', [
        makeFileHandle('summary.json', stageJson('summary', 0.99)),
      ]),
    ]);
    const root = makeDirHandle('root', [case1]);

    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, () => {});

    expect(rows[0].stages).toEqual([]);
  });

  it('never throws even when a case folder is thoroughly broken', async () => {
    const brokenCase = makeDirHandle(
      'broken-case',
      [],
      { missingNames: ['consolidated_final.json', 'stage_confidence'] }
    );
    const root = makeDirHandle('root', [brokenCase]);

    await expect(loadCaseRows(root, DEFAULT_SETTINGS, () => {})).resolves.toHaveLength(1);
  });

  it('processes case folders in batches of 10, calling onProgress per batch', async () => {
    const cases = Array.from({ length: 25 }, (_, i) =>
      makeDirHandle(`case${i}`, [makeFileHandle('consolidated_final.json', finalJson(1))], {
        missingNames: ['stage_confidence'],
      })
    );
    const root = makeDirHandle('root', cases);

    const progressCalls: Array<[number, number]> = [];
    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, (done, total) => {
      progressCalls.push([done, total]);
    });

    expect(rows).toHaveLength(25);
    // 25 items in batches of 10 -> progress after 10, 20, 25 (plus the initial 0).
    expect(progressCalls).toEqual([
      [0, 25],
      [10, 25],
      [20, 25],
      [25, 25],
    ]);
  });

  it('auto-discovers a newly added stage_confidence/*.json file with no code changes (Req 9.6)', async () => {
    // Simulates adding a brand-new "sentiment.json" stage file that the app has
    // never seen before — loadCaseRows has no hardcoded stage file list, so it
    // must appear as a StageResult purely from being present on disk.
    const caseFolder = makeDirHandle('case1', [
      makeFileHandle('consolidated_final.json', finalJson(1)),
      makeDirHandle('stage_confidence', [
        makeFileHandle('categorisation.json', stageJson('categorisation', 0.9)),
        makeFileHandle('sentiment.json', stageJson('sentiment', 0.72)),
      ]),
    ]);
    const root = makeDirHandle('root', [caseFolder]);

    const rows = await loadCaseRows(root, DEFAULT_SETTINGS, () => {});

    const fileNames = rows[0].stages.map((s) => s.fileName).sort();
    expect(fileNames).toEqual(['categorisation.json', 'sentiment.json']);

    const sentiment = rows[0].stages.find((s) => s.fileName === 'sentiment.json');
    expect(sentiment?.score).toBe(0.72);
    expect(sentiment?.label).toBe('sentiment');

    // stageColumns in the store is a sorted union of every row's stage fileNames —
    // confirm the raw data this derivation depends on is present with no filtering
    // beyond excludedStageFiles, so the new file becomes a column automatically.
    const allStageFileNames = new Set(rows.flatMap((r) => r.stages.map((s) => s.fileName)));
    expect(allStageFileNames.has('sentiment.json')).toBe(true);
  });
});
