# Why "Failed by Low Confidence" Shows 0

## Common Reasons

### 1. ✅ **Feature is Working - Just No Matching Cases**

The "Failed by Low Confidence" count will be **0** if:
- No cases have `finalVerdict === 0` (no failed cases)
- All failed cases have `overallConfidence >= 0.70` (confident failures)
- All failed cases have `overallConfidence === null` (missing confidence data)

**This is EXPECTED if your data doesn't match the criteria!**

---

### 2. 🔍 **Missing Overall Confidence Field**

The dashboard looks for overall confidence at this JSON path (default):
```
bill_summary.overall_confidence
```

**Check your consolidated_final.json files:**

#### Example of CORRECT data structure:
```json
{
  "case_number": "CASE-12345",
  "bill_summary": {
    "case_verdict": 0,
    "overall_confidence": 0.65,      ← MUST HAVE THIS
    "extracted_amount": 1500.00,
    "calculated_amount": 1200.00
  }
}
```

#### Example of MISSING overall_confidence:
```json
{
  "case_number": "CASE-12345",
  "bill_summary": {
    "case_verdict": 0,
    "extracted_amount": 1500.00,
    "calculated_amount": 1200.00
  }
  // ⚠️ No overall_confidence field!
}
```

---

### 3. ⚙️ **Wrong JSON Path Configuration**

If your data structure is different, you need to update the settings:

**Example: If your data looks like this:**
```json
{
  "confidence": {
    "overall": 0.65
  },
  "verdict": 0
}
```

**You need to configure:**
1. Open Settings (gear icon)
2. Go to "Overall Confidence" section
3. Change key path from `bill_summary.overall_confidence` to `confidence.overall`
4. Click "Save"

---

### 4. 🔄 **Need to Restart Dev Server**

If you just added the feature:
1. **Stop the dev server** (Ctrl+C in terminal)
2. **Run:** `npm run dev`
3. **Refresh the browser** (Ctrl+Shift+R or Cmd+Shift+R)

---

## How to Debug

### Step 1: Check Your Data
Open one of your `consolidated_final.json` files and verify:
- [ ] Does it have a `case_verdict` field?
- [ ] Does it have an `overall_confidence` field?
- [ ] What is the path to `overall_confidence`?

### Step 2: Open Browser Console
1. Open Dashboard in browser
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Look for any errors

### Step 3: Check Settings
1. Click gear icon (Settings)
2. Scroll to "Overall Confidence" section
3. Verify the key path matches your data structure
4. Click "Save" if you made changes

### Step 4: Verify Card is Visible
The card should appear between "Pass Rate" and "Amount Mismatches":

```
┌─────────────┬─────────────┬────────────────────────────┬──────────────────┐
│ Total Cases │  Pass Rate  │ Failed by Low Confidence   │ Amount Mismatches│
└─────────────┴─────────────┴────────────────────────────┴──────────────────┘
```

If you see the card but it shows "0", that's correct! It means:
- The feature is working
- Your data just doesn't have cases matching the criteria

---

## Test with Sample Data

Create a test file to verify the feature works:

### Create: `test-case/consolidated_final.json`
```json
{
  "case_number": "TEST-001",
  "bill_summary": {
    "case_verdict": 0,
    "overall_confidence": 0.55,
    "extracted_amount": 1000,
    "calculated_amount": 1000
  }
}
```

### Create: `test-case/stage_confidence/`
(empty folder is fine)

### Load this folder in dashboard
1. Click "Select Case Folder"
2. Choose the folder containing `test-case`
3. Check "Failed by Low Confidence" - should show **1**

---

## Understanding the Logic

```typescript
// A case is counted ONLY if ALL of these are true:
row.finalVerdict === 0              // Case failed
row.overallConfidence !== null      // Confidence exists
row.overallConfidence < 0.70        // Below threshold
```

### Examples:

| Verdict | Overall Confidence | Counted? | Why |
|---------|-------------------|----------|-----|
| 0 (fail) | 0.55 | ✅ YES | Failed + low confidence |
| 0 (fail) | 0.85 | ❌ NO | Failed but HIGH confidence |
| 1 (pass) | 0.55 | ❌ NO | Passed (not a failure) |
| 0 (fail) | null | ❌ NO | Missing confidence data |

---

## Quick Checklist

- [ ] Dashboard is running (dev server or after build)
- [ ] Browser is refreshed
- [ ] Card is visible in Insights Bar
- [ ] Data files have `case_verdict` field
- [ ] Data files have `overall_confidence` field (or equivalent)
- [ ] Settings key path matches data structure
- [ ] Some cases have `finalVerdict === 0`
- [ ] Those failed cases have `overallConfidence < 0.70`

---

## If Card is Missing Entirely

If you don't see the "Failed by Low Confidence" card at all:

1. **Clear browser cache:**
   - Chrome: Ctrl+Shift+Delete → Clear cached images and files
   - Or use Incognito/Private window

2. **Rebuild and restart:**
   ```bash
   npm run build
   npm run dev
   ```

3. **Check browser console for errors:**
   - F12 → Console tab
   - Look for red error messages

---

## Still Not Working?

### Check if overallConfidence is being loaded:

Add this **temporary** debug code to `InsightsBar.tsx`:

```typescript
// Add after line: const failedLowConf = failedByLowConfidenceCount(...)

console.log('=== DEBUG: Failed by Low Confidence ===');
console.log('Total rows:', rows.length);
console.log('Failed cases:', rows.filter(r => r.finalVerdict === 0).length);
console.log('Cases with confidence:', rows.filter(r => r.overallConfidence !== null).length);
console.log('Failed + low conf:', failedLowConf);
console.log('Sample row:', rows[0]);
```

Then check the browser console (F12) to see what's being logged.

---

## Expected Behavior

### If count is 0:
✅ **This is CORRECT** if:
- No cases failed, OR
- All failed cases have high confidence (≥0.70), OR
- No cases have overall_confidence data

### If count is > 0:
✅ Text should be **red** (text-lowText class)
✅ Number should match cases where verdict=0 AND confidence<0.70

---

## Configuration Screenshot Location

Settings → Overall Confidence section should show:
```
┌────────────────────────────────────────┐
│ OVERALL CONFIDENCE                     │
│                                        │
│ Overall Confidence Key Path            │
│ ┌────────────────────────────────────┐ │
│ │ bill_summary.overall_confidence    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Used to calculate "Failed by Low      │
│ Confidence" metric                     │
└────────────────────────────────────────┘
```

If you don't see this section, the changes haven't been applied yet.
