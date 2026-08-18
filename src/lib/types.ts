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
  stageDefaults: {
    labelKeyPath: string;    // default: "stage"
    valueKeyPath: string;    // default: "score"
  };
  stageOverrides: Record<string, {
    labelKeyPath?: string;
    valueKeyPath?: string;
  }>;
  lowConfidenceThreshold: number;   // default: 0.90 — cases below this are flagged as low-confidence fails
  highConfidenceThreshold: number;  // default: 0.95
  excludedStageFiles: string[];     // default: ["summary.json"]
}

// One parsed stage JSON file for a single case
export interface StageResult {
  fileName: string;           // e.g. "categorisation.json"
  label: string;              // resolved from labelKeyPath (e.g. "categorisation")
  score: number | null;       // resolved from valueKeyPath (e.g. 0.938)
  issueCount: number;         // total issues[] array length from the stage JSON
  highSeverityCount: number;  // issues where severity === "high"
  raw: unknown;               // full parsed JSON blob for the modal
}

// Bill-type match counts broken down by matching method
export interface BillTypeMatchCounts {
  vectorSearch: number;  // count of bill_type matches made via vector search
  llmSelect: number;     // count of bill_type matches made via LLM selection
}

// Token usage summary pulled from stage_confidence (in/out + overall total)
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
  // Knocked = charges that were disallowed/deducted by the financial agent.
  // Sourced from adjudication.json → agents[financial].report.totals.
  // null when adjudication.json is absent or the financial agent did not run.
  nonPayableAmount: number | null; // total ₹ value of knocked line items (non_payable_total)
  nonPayableCount: number | null;  // number of knocked line items (non_payable_count)
  // Human-readable reason(s) why a failed case (finalVerdict === 0) failed,
  // mirroring the main pipeline's _case_verdict. Built ONLY from
  // consolidated_final.json fields: amounts_match ("Amount mismatch"/"No printed
  // total"), overall_confidence < threshold ("Low confidence"), and
  // knocked_off_bills non-empty ("Knocked-off bills"). Adjudication agent
  // statuses do NOT affect the verdict. null for non-failed cases.
  failCause: string | null;
  // Judge quality fields — sourced from adjudication.json → agents[*].judge
  // null when adjudication.json is absent.
  minJudgeScore: number | null;           // lowest judge.score across all agents
  avgJudgeScore: number | null;           // average judge.score across all agents
  judgeApprovedAgentCount: number | null; // agents where judge.status === "pass"
  judgeFailedAgentCount: number | null;   // agents where judge.status === "fail"
  // Total number of judge override flags on this case:
  //   +1 per agent with judge.status === "fail"
  //   +1 per agent with judge.status === "pass" (explicit approval, rare)
  //   +1 per agent with judge.score < 0.70 (very low confidence)
  // null when adjudication.json is absent.
  judgeOverrideFlagCount: number | null;
  billTypeMatchCounts: BillTypeMatchCounts; // bill_type matches by method (from finalRaw)
  tokenSummary: TokenSummary;              // token usage in/out + overall (from finalRaw)
  finalRaw: unknown;           // full consolidated_final.json blob
  stages: StageResult[];       // one entry per non-excluded stage file
  hasErrors: boolean;          // true if any file is missing, unparsable, or key absent
  errorDetails: string[];      // human-readable error descriptions per field
  isNotWorking: boolean;       // true if calculated_amount=0 or extraction/bill_type_resolution missing
}

// Active filter state (one entry per column)
export interface FilterState {
  caseIdText: string;
  finalVerdict: 'all' | 0 | 1;
  amountMismatchOnly: boolean;
  amountMatchFilter: 'all' | 'match' | 'mismatch'; // 'match'=true pills, 'mismatch'=false pills
  stages: Record<string, {
    min: number | null;
    max: number | null;
    lowConfOnly: boolean;
  }>;
  hasErrorsOnly: boolean;
  hideNotWorking: boolean;      // if true, hide cases with isNotWorking=true
  notWorkingOnly: boolean;      // if true, show ONLY cases with isNotWorking=true
}

// Global Zustand store shape (implemented in Task 3 — define the interface here so
// later tasks can import it; DO NOT implement the store itself in this task)
export interface AppStore {
  allCaseRows: CaseRow[];
  stageColumns: string[];
  loadingProgress: { done: number; total: number } | null;
  excludedCasesCount: number; // Count of cases filtered out due to missing extraction data

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
  stageDefaults: {
    labelKeyPath: 'stage',
    valueKeyPath: 'score',
  },
  stageOverrides: {},
  lowConfidenceThreshold: 0.90,
  highConfidenceThreshold: 0.95,
  excludedStageFiles: ['summary.json'],
};
