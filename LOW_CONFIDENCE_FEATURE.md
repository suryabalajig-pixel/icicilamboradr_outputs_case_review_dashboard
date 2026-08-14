# Failed by Low Confidence Feature

## ✅ Feature Added Successfully

A new insight metric has been added to track **cases that failed (verdict = 0) due to low overall confidence scores**.

---

## 📊 What This Shows

The **"Failed by Low Confidence"** insight card displays:
- Count of cases where:
  - `finalVerdict === 0` (failed)
  - `overallConfidence < lowConfidenceThreshold` (default: 0.70)
  - `overallConfidence` is not null

This helps identify cases that were rejected specifically because the system's confidence in the decision was below the acceptable threshold.

---

## 🎯 Changes Made

### 1. **Data Model Updated** (`src/lib/types.ts`)

#### CaseRow Interface
```typescript
export interface CaseRow {
  caseId: string;
  finalVerdict: 0 | 1 | null;
  overallConfidence: number | null;    // ✅ NEW FIELD
  extractedAmount: number | null;
  calculatedAmount: number | null;
  amountMismatch: boolean;
  // ... rest
}
```

#### SettingsConfig Interface
```typescript
export interface SettingsConfig {
  finalVerdict: { ... };
  overallConfidence: {                  // ✅ NEW SECTION
    keyPath: string;  // default: "bill_summary.overall_confidence"
  };
  amounts: { ... };
  // ... rest
}
```

#### Default Settings
```typescript
export const DEFAULT_SETTINGS: SettingsConfig = {
  finalVerdict: { ... },
  overallConfidence: {
    keyPath: 'bill_summary.overall_confidence',  // ✅ NEW
  },
  amounts: { ... },
  // ... rest
};
```

---

### 2. **Data Loading** (`src/hooks/useDirectoryLoader.ts`)

#### parseCaseFolder Function
Extracts overall confidence from consolidated_final.json:

```typescript
// Extract overall confidence
let overallConfidence: number | null = null;

if (finalFileReadOk && finalRaw !== null) {
  const confidenceResolved = getByPath(
    finalRaw, 
    settings.overallConfidence.keyPath
  );
  if (confidenceResolved !== undefined) {
    overallConfidence = typeof confidenceResolved === 'number' 
      ? confidenceResolved 
      : null;
  }
}
```

Returns `overallConfidence` as part of CaseRow.

---

### 3. **Store Logic** (`src/store/appStore.ts`)

#### rederiveRow Function
Re-extracts overall confidence when settings change:

```typescript
// Re-extract overall confidence
let overallConfidence: number | null = null;

if (row.finalRaw !== null) {
  const confidenceResolved = getByPath(
    row.finalRaw, 
    settings.overallConfidence.keyPath
  );
  if (confidenceResolved !== undefined) {
    overallConfidence = typeof confidenceResolved === 'number' 
      ? confidenceResolved 
      : null;
  }
}

return {
  ...row,
  finalVerdict,
  overallConfidence,  // ✅ INCLUDED
  // ... rest
};
```

---

### 4. **Insights Function** (`src/lib/insights.ts`)

#### New Function: failedByLowConfidenceCount
```typescript
export function failedByLowConfidenceCount(
  rows: CaseRow[], 
  threshold: number
): number {
  return rows.filter((row) => 
    row.finalVerdict === 0 && 
    row.overallConfidence !== null && 
    row.overallConfidence < threshold
  ).length;
}
```

**Logic:**
- Only counts cases with `finalVerdict === 0` (failed)
- Only counts cases with non-null `overallConfidence`
- Only counts cases where confidence is below threshold

---

### 5. **InsightsBar Component** (`src/components/InsightsBar.tsx`)

#### New Import
```typescript
import { 
  passRate, 
  errorCount, 
  stageInsights, 
  amountMismatchCount, 
  failedByLowConfidenceCount  // ✅ NEW
} from '../lib/insights';
```

#### New Calculation
```typescript
const failedLowConf = failedByLowConfidenceCount(
  rows, 
  settings.lowConfidenceThreshold
);
```

#### New Insight Card
```typescript
<InsightCard
  label="Failed by Low Confidence"
  value={failedLowConf}
  valueClassName={failedLowConf > 0 ? 'text-lowText' : ''}
/>
```

**Features:**
- Positioned after "Pass Rate", before "Amount Mismatches"
- Red text (`text-lowText`) when count > 0
- Non-clickable (informational only)
- Shows in both "Filtered" and "All Cases" modes

---

### 6. **Settings Panel** (`src/components/SettingsPanel.tsx`)

#### New Section: Overall Confidence
```typescript
{/* Section 1.6: Overall Confidence */}
<section className="mb-6">
  <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
    Overall Confidence
  </h3>
  <label className="mb-1 block text-caption text-textMuted">
    Overall Confidence Key Path
  </label>
  <input
    type="text"
    value={draft.overallConfidence.keyPath}
    onChange={(e) =>
      setDraft({
        ...draft,
        overallConfidence: { keyPath: e.target.value },
      })
    }
    className="w-full rounded border border-border px-2 py-1 text-body"
  />
  <p className="mt-1 text-caption text-textMuted">
    Used to calculate "Failed by Low Confidence" metric
  </p>
</section>
```

**Features:**
- Located after "Amount Fields", before "Stage Defaults"
- Configurable JSON key path
- Helpful description text
- Settings persist to localStorage
- Export/Import includes configuration

---

### 7. **Test Files Updated**

#### insights.test.ts & appStore.test.ts
- ✅ Updated `makeRow()` helper to include `overallConfidence: null`
- ✅ Updated all inline CaseRow objects with `overallConfidence` field

---

## 📋 Example Data Format

```json
{
  "case_number": "CASE-12345",
  "bill_summary": {
    "case_verdict": 0,
    "overall_confidence": 0.65,
    "extracted_amount": 1500.00,
    "calculated_amount": 1200.00
  }
}
```

**Analysis:**
- `finalVerdict`: 0 (failed)
- `overallConfidence`: 0.65
- Low confidence threshold: 0.70 (default)
- **Result**: This case WOULD BE COUNTED in "Failed by Low Confidence" (0.65 < 0.70)

---

## 🔍 Use Cases

### 1. **Quality Assurance**
Identify cases that failed due to low system confidence rather than business rule violations.

### 2. **Model Performance**
Track how many failures are attributable to low confidence scores, indicating areas where the model needs improvement.

### 3. **Threshold Tuning**
Compare "Failed by Low Confidence" counts when adjusting the `lowConfidenceThreshold` setting to find optimal values.

### 4. **Root Cause Analysis**
Distinguish between:
- Cases that failed with high confidence (clear violations)
- Cases that failed with low confidence (uncertain decisions)

---

## ⚙️ Configuration

### Default Configuration
```typescript
overallConfidence: {
  keyPath: 'bill_summary.overall_confidence'
}
lowConfidenceThreshold: 0.70
```

### How to Configure

1. **Open Settings Panel** (gear icon in sidebar)
2. **Scroll to "Overall Confidence" section**
3. **Update key path** if your JSON structure differs
   - Example: `confidence.overall`
   - Example: `metadata.confidence_score`
4. **Adjust Low Confidence Threshold** (in "Thresholds" section)
   - Increase threshold to catch more cases
   - Decrease threshold to be more selective
5. **Click "Save"** to apply changes
6. Dashboard recalculates metrics automatically

---

## 📊 Insight Card Display

```
┌─────────────────────────────┐
│ FAILED BY LOW CONFIDENCE    │
│ 12                          │  ← Red text if > 0
└─────────────────────────────┘
```

**Positioning in Insights Bar:**
1. Total Cases
2. Pass Rate
3. **Failed by Low Confidence** ← NEW
4. Amount Mismatches
5. Stage insights (categorisation, extraction, etc.)
6. Errors

---

## ✅ Build Status

```
✓ TypeScript compilation successful
✓ All type errors resolved
✓ Vite build successful
✓ Bundle size: 309.30 kB (gzip: 92.12 kB)
```

---

## 🎯 Summary

| Feature | Status |
|---------|--------|
| Extract overall confidence from JSON | ✅ |
| Store in CaseRow | ✅ |
| Calculate failed low confidence count | ✅ |
| Display in insights bar | ✅ |
| Configurable key path | ✅ |
| Settings persistence | ✅ |
| Test files updated | ✅ |
| Build successful | ✅ |

---

## 📝 Notes

- Cases with `overallConfidence === null` are excluded from the count (missing data)
- Only cases with `finalVerdict === 0` are counted (must be failed)
- Uses the same `lowConfidenceThreshold` as stage confidence metrics (default: 0.70)
- The insight is informational only (not clickable to filter)
- Works in both "Filtered" and "All Cases" insight modes
- Configuration changes require clicking "Save" and trigger re-derivation

---

## 🚀 How to Use

1. **Load case data** with consolidated_final.json containing `overall_confidence`
2. **View insight card** - Shows count of failed cases with low confidence
3. **Interpret results**:
   - **High count** → System is failing many cases due to uncertainty
   - **Low count** → Most failures are confident decisions
   - **Zero** → All failed cases had confidence above threshold
4. **Adjust threshold** in Settings if needed to tune sensitivity
5. **Compare with Pass Rate** to understand failure patterns

---

## Example Scenarios

### Scenario 1: High Failed Low Confidence
```
Total Cases: 100
Pass Rate: 70%
Failed by Low Confidence: 25
```
**Interpretation**: 25 out of 30 failures (83%) were due to low confidence. Model may need retraining.

### Scenario 2: Low Failed Low Confidence
```
Total Cases: 100
Pass Rate: 70%
Failed by Low Confidence: 3
```
**Interpretation**: Only 3 out of 30 failures (10%) were due to low confidence. Most failures were confident decisions based on business rules.

### Scenario 3: No Low Confidence Failures
```
Total Cases: 100
Pass Rate: 85%
Failed by Low Confidence: 0
```
**Interpretation**: All 15 failures had confidence ≥ 0.70. System is confident in its rejection decisions.
