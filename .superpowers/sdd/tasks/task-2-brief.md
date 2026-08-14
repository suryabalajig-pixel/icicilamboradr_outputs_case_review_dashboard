# Task 2: Implement core type definitions and utility libraries

Project root: `C:\Users\Admin\projects-copy\ICICI-DASH\case-review-dashboard`
(a Vite + React 18 + TypeScript app, already scaffolded — `npm install` already run)

## 2.1 Create `src/lib/types.ts`

Define these TypeScript interfaces EXACTLY as follows (copy verbatim, this is the contract every later task depends on):

```ts
// Persisted user configuration
export interface SettingsConfig {
  finalVerdict: {
    file: string;            // default: "consolidated_final.json"
    valueKeyPath: string;    // default: "bill_summary.case_verdict"
  };
  stageDefaults: {
    labelKeyPath: string;    // default: "stage"
    valueKeyPath: string;    // default: "score"
  };
  stageOverrides: Record<string, {
    labelKeyPath?: string;
    valueKeyPath?: string;
  }>;
  lowConfidenceThreshold: number;   // default: 0.70
  highConfidenceThreshold: number;  // default: 0.85
  excludedStageFiles: string[];     // default: ["summary.json"]
}

// One parsed stage JSON file for a single case
export interface StageResult {
  fileName: string;      // e.g. "categorisation.json"
  label: string;         // resolved from labelKeyPath (e.g. "categorisation")
  score: number | null;  // resolved from valueKeyPath (e.g. 0.938)
  raw: unknown;          // full parsed JSON blob for the modal
}

// One row in the case table — one case folder
export interface CaseRow {
  caseId: string;              // folder name
  finalVerdict: 0 | 1 | null;  // resolved from finalVerdict.valueKeyPath
  finalRaw: unknown;           // full consolidated_final.json blob
  stages: StageResult[];       // one entry per non-excluded stage file
  hasErrors: boolean;          // true if any file is missing, unparsable, or key absent
  errorDetails: string[];      // human-readable error descriptions per field
}

// Active filter state (one entry per column)
export interface FilterState {
  caseIdText: string;
  finalVerdict: 'all' | 0 | 1;
  stages: Record<string, {
    min: number | null;
    max: number | null;
    lowConfOnly: boolean;
  }>;
  hasErrorsOnly: boolean;
}

// Global Zustand store shape (implemented in Task 3 — define the interface here so
// later tasks can import it; DO NOT implement the store itself in this task)
export interface AppStore {
  allCaseRows: CaseRow[];
  stageColumns: string[];
  loadingProgress: { done: number; total: number } | null;

  settings: SettingsConfig;
  updateSettings: (patch: Partial<SettingsConfig>) => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;
  settingsPanelOpen: boolean;
  toggleSettingsPanel: () => void;
  modalState: { caseId: string; fileName: string; json: unknown } | null;
  openModal: (caseId: string, fileName: string, json: unknown) => void;
  closeModal: () => void;

  filters: FilterState;
  setFilter: (update: Partial<FilterState>) => void;
  clearFilter: (key: keyof FilterState) => void;
  clearAllFilters: () => void;

  filteredRows: CaseRow[];

  insightsScope: 'filtered' | 'all';
  setInsightsScope: (scope: 'filtered' | 'all') => void;

  loadDirectory: (handle: FileSystemDirectoryHandle) => Promise<void>;
  rederiveCaseRows: () => void;
}
```

Also export a `DEFAULT_SETTINGS` constant:

```ts
export const DEFAULT_SETTINGS: SettingsConfig = {
  finalVerdict: {
    file: 'consolidated_final.json',
    valueKeyPath: 'bill_summary.case_verdict',
  },
  stageDefaults: {
    labelKeyPath: 'stage',
    valueKeyPath: 'score',
  },
  stageOverrides: {},
  lowConfidenceThreshold: 0.70,
  highConfidenceThreshold: 0.85,
  excludedStageFiles: ['summary.json'],
};
```

_Requirements: 6.2, 6.3, 6.4, 6.6_

## 2.2 Implement `src/lib/jsonPath.ts` — `getByPath` utility

```ts
// Resolves a dot-notation path through a nested object.
// Returns undefined if any segment is missing.
// Supports array index notation: "charges[0].amount"
export function getByPath(obj: unknown, path: string): unknown
```

Behavior:
- Dot-notation traversal with array-index notation support (e.g. `charges[0].amount`).
- Returns `undefined` (never throws) when any path segment is absent, when an intermediate value is `null`/`undefined`/a primitive that can't be indexed, or when the path string is empty.
- Examples:
  - `getByPath({ bill_summary: { case_verdict: 0 } }, "bill_summary.case_verdict")` → `0`
  - `getByPath({ stage: "categorisation", score: 0.938 }, "stage")` → `"categorisation"`
  - `getByPath({}, "missing.key")` → `undefined`
  - `getByPath({ charges: [{ amount: 10 }] }, "charges[0].amount")` → `10`

_Requirements: 1.10, 6.2, 6.3, 6.4_

## 2.4 Implement `src/lib/fsWalk.ts` — File System Access API helpers

```ts
// List all immediate sub-directories of a handle
export async function listSubdirectories(
  handle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle[]>

// List all *.json file handles in a directory, excluding specified names
export async function listJsonFiles(
  dirHandle: FileSystemDirectoryHandle,
  exclude: string[]
): Promise<FileSystemFileHandle[]>

// Read and parse a single JSON file handle
export async function readJsonFile(fileHandle: FileSystemFileHandle): Promise<unknown>
```

- `listSubdirectories`: iterate `handle.values()` (or `entries()`), return only entries where `kind === 'directory'`.
- `listJsonFiles`: iterate `dirHandle.values()`, return only entries where `kind === 'file'` and `name.endsWith('.json')` and `!exclude.includes(name)`.
- `readJsonFile`: call `fileHandle.getFile()`, then `.text()`, then `JSON.parse(text)`. Let `JSON.parse` throw on failure — do NOT catch inside this function; the caller (Task 4's `useDirectoryLoader`) is responsible for catching and marking `hasErrors`.
- The ambient FileSystemDirectoryHandle/FileSystemFileHandle types are already declared in `src/vite-env.d.ts` — do not redeclare them.

_Requirements: 1.3, 1.4, 1.9_

## 2.5 Implement `src/lib/insights.ts` — pure analytics functions

Import `CaseRow` from `./types`.

```ts
export function passRate(rows: CaseRow[]): number
// Returns: (count where finalVerdict === 1) / (count where finalVerdict !== null)
// Returns 0 if denominator is 0

export function avgConfidence(rows: CaseRow[], stageFileName: string): number | null
// Returns mean of StageResult.score where score !== null for the given stage
// (match StageResult by fileName === stageFileName within row.stages)
// Returns null if no valid scores exist

export function lowConfidenceCount(
  rows: CaseRow[],
  stageFileName: string,
  threshold: number
): number
// Returns count of rows where StageResult.score !== null && score < threshold for that stage

export function errorCount(rows: CaseRow[]): number
// Returns count of rows where hasErrors === true

export function stageInsights(
  rows: CaseRow[],
  stageFiles: string[],
  threshold: number
): { fileName: string; avg: number | null; lowCount: number }[]
// Returns one entry per fileName in stageFiles, using avgConfidence and lowConfidenceCount
// above, sorted by lowCount descending
```

These are pure functions — no store imports, no side effects, no filesystem access.

_Requirements: 5.1_

---

## Notes for the implementer

- Skip subtasks 2.3 and 2.6 (optional property tests, marked `[ ]*` in the plan) — they are deferred for this MVP pass per the plan's own note: "Tasks marked with `*` are optional and can be skipped for a faster MVP." Do not write fast-check property tests for this task.
- Do still write ordinary unit tests (Vitest) for `getByPath`, `fsWalk` helpers (with mocked handles), and the `insights.ts` functions — plain example-based tests, not property-based. Vitest is not yet installed; add it (`vitest`, `@testing-library/react` if needed later, but for this task just `vitest` is enough) as a devDependency and add a `"test": "vitest run"` script to `package.json` if one doesn't exist.
- Run `npx tsc -b --noEmit` (or `npm run build`) to confirm no type errors before committing.
