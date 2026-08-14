# Amount Fields Feature - All Changes Restored

## ✅ Changes Successfully Applied

All changes for the amount fields feature have been restored and verified. The build is successful.

---

## 📋 Summary of Changes

### 1. **Data Types Updated** (`src/lib/types.ts`)

#### CaseRow Interface
```typescript
export interface CaseRow {
  caseId: string;
  finalVerdict: 0 | 1 | null;
  extractedAmount: number | null;        // ✅ NEW
  calculatedAmount: number | null;       // ✅ NEW
  amountMismatch: boolean;               // ✅ NEW
  finalRaw: unknown;
  stages: StageResult[];
  hasErrors: boolean;
  errorDetails: string[];
}
```

#### SettingsConfig Interface
```typescript
export interface SettingsConfig {
  finalVerdict: { ... };
  amounts: {                              // ✅ NEW SECTION
    extractedAmountKeyPath: string;
    calculatedAmountKeyPath: string;
  };
  stageDefaults: { ... };
  // ... rest of config
}
```

#### FilterState Interface
```typescript
export interface FilterState {
  caseIdText: string;
  finalVerdict: 'all' | 0 | 1;
  amountMismatchOnly: boolean;           // ✅ NEW
  stages: Record<string, { ... }>;
  hasErrorsOnly: boolean;
}
```

#### Default Settings
```typescript
export const DEFAULT_SETTINGS: SettingsConfig = {
  finalVerdict: { ... },
  amounts: {                              // ✅ NEW
    extractedAmountKeyPath: 'bill_summary.extracted_amount',
    calculatedAmountKeyPath: 'bill_summary.calculated_amount',
  },
  // ... rest
};
```

---

### 2. **Data Loading Updated** (`src/hooks/useDirectoryLoader.ts`)

#### parseCaseFolder Function
- ✅ Extracts `extractedAmount` from JSON using configured key path
- ✅ Extracts `calculatedAmount` from JSON using configured key path
- ✅ Calculates `amountMismatch` (both amounts must be non-null and different)
- ✅ Returns all amount fields in CaseRow

```typescript
// Extract amounts
let extractedAmount: number | null = null;
let calculatedAmount: number | null = null;

if (finalFileReadOk && finalRaw !== null) {
  const extractedResolved = getByPath(finalRaw, settings.amounts.extractedAmountKeyPath);
  if (extractedResolved !== undefined) {
    extractedAmount = typeof extractedResolved === 'number' ? extractedResolved : null;
  }
  
  const calculatedResolved = getByPath(finalRaw, settings.amounts.calculatedAmountKeyPath);
  if (calculatedResolved !== undefined) {
    calculatedAmount = typeof calculatedResolved === 'number' ? calculatedResolved : null;
  }
}

// Calculate mismatch
const amountMismatch = 
  extractedAmount !== null && 
  calculatedAmount !== null && 
  extractedAmount !== calculatedAmount;
```

---

### 3. **Store Logic Updated** (`src/store/appStore.ts`)

#### New Filter Function
```typescript
export function matchesAmountMismatchFilter(
  row: CaseRow, 
  amountMismatchOnly: boolean
): boolean {
  if (!amountMismatchOnly) return true;
  return row.amountMismatch === true;
}
```

#### Updated applyAllFilters
- ✅ Includes `matchesAmountMismatchFilter` in filter pipeline

#### Updated rederiveRow Function
- ✅ Re-extracts amounts when settings change
- ✅ Recalculates mismatch status
- ✅ Returns updated amount fields

#### Updated DEFAULT_FILTERS
```typescript
const DEFAULT_FILTERS: FilterState = {
  caseIdText: '',
  finalVerdict: 'all',
  stages: {},
  hasErrorsOnly: false,
  amountMismatchOnly: false,  // ✅ NEW
};
```

---

### 4. **Insights Updated** (`src/lib/insights.ts`)

#### New Function
```typescript
export function amountMismatchCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.amountMismatch).length;
}
```

---

### 5. **UI Components Updated**

#### CaseTable Component (`src/components/CaseTable.tsx`)

**New Helper Components:**
```typescript
function AmountCell({ amount }: { amount: number | null }) {
  if (amount === null) {
    return <span className="text-textMuted">—</span>;
  }
  return <span className="font-mono">${amount.toFixed(2)}</span>;
}

function MismatchBadge({ mismatch }: { mismatch: boolean }) {
  if (!mismatch) {
    return <span className="text-xs text-textMuted">✓</span>;
  }
  return (
    <span className="inline-flex items-center rounded-lg bg-amber-100 px-2 py-0.5 text-caption font-semibold text-amber-800">
      ⚠ Mismatch
    </span>
  );
}
```

**New Columns (added after Final Verdict, before stages):**
1. ✅ **Extracted Amount** - displays `$XXX.XX` or `—`
2. ✅ **Calculated Amount** - displays `$XXX.XX` or `—`
3. ✅ **Amount Status** - displays ✓ or ⚠ Mismatch badge with filter

**Updated hasActiveFilter:**
- ✅ Now includes `filters.amountMismatchOnly` check

---

#### ColumnFilterHeader Component (`src/components/ColumnFilterHeader.tsx`)

**New Filter Component:**
```typescript
function AmountMismatchFilter({
  value,
  setFilter,
  clearFilter,
}: {
  value: boolean;
  setFilter: (u: { amountMismatchOnly: boolean }) => void;
  clearFilter: (k: 'amountMismatchOnly') => void;
}) {
  // Toggle between "All" and "Mismatch"
  // Shows active filter badge when enabled
}
```

**Updated Router:**
- ✅ Handles `columnId === 'amountMismatch'` case
- ✅ Routes to AmountMismatchFilter component

---

#### InsightsBar Component (`src/components/InsightsBar.tsx`)

**New Import:**
```typescript
import { passRate, errorCount, stageInsights, amountMismatchCount } from '../lib/insights';
```

**New Insight Card:**
```typescript
<InsightCard
  label="Amount Mismatches"
  value={mismatches}
  valueClassName={mismatches > 0 ? 'text-amber-600' : ''}
  onClick={() => setFilter({ amountMismatchOnly: true })}
/>
```

**Features:**
- ✅ Shows count of cases with amount mismatches
- ✅ Amber/yellow text when mismatches exist
- ✅ Clickable to filter to mismatch cases only
- ✅ Positioned after Pass Rate, before stage insights

---

#### SettingsPanel Component (`src/components/SettingsPanel.tsx`)

**New Section (added after Final Verdict section):**
```typescript
{/* Section 1.5: Amount Fields */}
<section className="mb-6">
  <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
    Amount Fields
  </h3>
  <label className="mb-1 block text-caption text-textMuted">
    Extracted Amount Key Path
  </label>
  <input
    type="text"
    value={draft.amounts.extractedAmountKeyPath}
    onChange={(e) => setDraft({
      ...draft,
      amounts: { ...draft.amounts, extractedAmountKeyPath: e.target.value },
    })}
    className="mb-2 w-full rounded border border-border px-2 py-1 text-body"
  />
  <label className="mb-1 block text-caption text-textMuted">
    Calculated Amount Key Path
  </label>
  <input
    type="text"
    value={draft.amounts.calculatedAmountKeyPath}
    onChange={(e) => setDraft({
      ...draft,
      amounts: { ...draft.amounts, calculatedAmountKeyPath: e.target.value },
    })}
    className="w-full rounded border border-border px-2 py-1 text-body"
  />
</section>
```

**Features:**
- ✅ Configurable key paths for both amounts
- ✅ Settings persist to localStorage
- ✅ Export/Import includes amount configuration
- ✅ Changes apply after clicking "Save"

---

### 6. **Test Files Updated**

#### insights.test.ts
- ✅ Updated `makeRow()` helper to include amount fields

#### appStore.test.ts
- ✅ Updated `makeRow()` helper to include amount fields
- ✅ Updated `resetStore()` to include `amountMismatchOnly: false`
- ✅ Updated all inline CaseRow objects with amount fields
- ✅ Updated filter expectations to include `amountMismatchOnly`

---

## 🎯 Features Working

### Data Parsing
- [x] Extracts `extractedAmount` from configured JSON path
- [x] Extracts `calculatedAmount` from configured JSON path
- [x] Detects mismatches (both non-null and different)
- [x] Handles missing data gracefully (displays as `—`)

### Display
- [x] Three new table columns with proper formatting
- [x] Currency formatting (`$XXX.XX`)
- [x] Mismatch badge with amber styling
- [x] Check mark for matching amounts
- [x] Sortable columns

### Filtering
- [x] Amount Status column filter (All / Mismatch)
- [x] Filter state persists
- [x] Clear individual filter
- [x] Clear all filters includes mismatch filter
- [x] Filter badge shows active state

### Insights
- [x] Amount Mismatches count card
- [x] Clickable to apply filter
- [x] Amber highlighting when > 0
- [x] Works in both "Filtered" and "All Cases" modes

### Configuration
- [x] Settings panel with Amount Fields section
- [x] Configurable key paths
- [x] Settings persist to localStorage
- [x] Export/Import configuration
- [x] Re-derive data when settings change

---

## 📊 Example Data Format

```json
{
  "case_number": "CASE-12345",
  "bill_summary": {
    "case_verdict": 1,
    "extracted_amount": 1500.00,
    "calculated_amount": 1200.00
  }
}
```

**Result:**
- `extractedAmount`: 1500.00 → displays as "$1500.00"
- `calculatedAmount`: 1200.00 → displays as "$1200.00"
- `amountMismatch`: true → displays "⚠ Mismatch" badge

---

## ✅ Build Status

```
✓ TypeScript compilation successful
✓ All type errors resolved
✓ Vite build successful
✓ Bundle size: 308.14 kB (gzip: 91.93 kB)
```

---

## 🚀 Usage

1. **Load Data**: Select case folder containing `consolidated_final.json` files
2. **View Amounts**: Check new columns: Extracted Amount, Calculated Amount, Amount Status
3. **Filter Mismatches**: 
   - Click "Amount Mismatches" insight card, OR
   - Use Amount Status column filter → select "Mismatch"
4. **Configure**: 
   - Open Settings (gear icon)
   - Scroll to "Amount Fields" section
   - Update key paths if your JSON structure differs
   - Click "Save"

---

## 📝 Notes

- All changes have been restored and verified
- Build is successful with no errors
- All test fixtures updated
- Feature is ready for use
- Documentation file created: `AMOUNT_FIELDS_UPDATE.md`
