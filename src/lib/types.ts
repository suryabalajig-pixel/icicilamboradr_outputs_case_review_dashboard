// Persisted user configuration
export interface SettingsConfig {
  finalVerdict: {
    file: string;            // default: "consolidated_final.json"
    valueKeyPath: string;    // default: "bill_summary.case_verdict"
  };
  overallConfidence: {
    keyPath: string;         // default: "bill_summary.overall_confidence"
  };
  amounts: {
    extractedAmountKeyPath: string;  // default: "bill_summary.extracted_amount"
    calculatedAmountKeyPath: string; // default: "bill_summary.calculated_amount"
  };
  knockedOffBill: {
    keyPath: string;         // default: "knocked_off_bill"
  };
  tokens: {
    keyPath: string;         // default: "total_tokens"
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

export interface BillTypeMatchCounts {
  vectorSearch: number;
  llmSelect: number;
}

export interface TokenSummary {
  totalTokensIn: number | null;
  totalTokensOut: number | null;
  overallTotalTokens: number | null;
}

// One row in the case table — one case folder
export interface CaseRow {
  caseId: string;              // folder name
  finalVerdict: 0 | 1 | null;  // resolved from finalVerdict.valueKeyPath
  overallConfidence: number | null; // overall confidence score for the case
  extractedAmount: number | null; // extracted amount from the claim
  calculatedAmount: number | null; // calculated/approved amount
  amountMismatch: boolean;     // true if extractedAmount !== calculatedAmount (both must be non-null)
  knockedOffBillIssue: boolean; // true if knocked_off_bill has issues (not "ok")
  knockedOffBillCount: number; // count of items in knocked_off_bills array
  billTypeMatchCounts: BillTypeMatchCounts; // count of bill_type matches by matching method
  tokenSummary: TokenSummary; // tokens in/out and overall total from stage_confidence
  tokenCount: number | null;   // total tokens used for this case
  finalRaw: unknown;           // full consolidated_final.json blob
  stages: StageResult[];       // one entry per non-excluded stage file
  hasErrors: boolean;          // true if any file is missing, unparsable, or key absent
  errorDetails: string[];      // human-readable error descriptions per field
}

// Active filter state (one entry per column)
export interface FilterState {
  caseIdText: string;
  finalVerdict: 'all' | 0 | 1;
  amountMismatchOnly: boolean;
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

export const DEFAULT_SETTINGS: SettingsConfig = {
  finalVerdict: {
    file: 'consolidated_final.json',
    valueKeyPath: 'bill_summary.case_verdict',
  },
  overallConfidence: {
    keyPath: 'bill_summary.overall_confidence',
  },
  amounts: {
    extractedAmountKeyPath: 'bill_summary.extracted_amount',
    calculatedAmountKeyPath: 'bill_summary.calculated_amount',
  },
  knockedOffBill: {
    keyPath: 'knocked_off_bills',
  },
  tokens: {
    keyPath: 'total_tokens',
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
