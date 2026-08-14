# Troubleshooting: "Failed by Low Confidence" Shows 0

## ✅ Build Successful - Feature is Added!

The feature has been successfully built and deployed. If you see **0** in the "Failed by Low Confidence" card, this is one of these situations:

---

## Situation 1: ✅ **Working Correctly - No Matching Cases**

**The count is 0 because:**
- Your data doesn't have any failed cases with low confidence
- All failed cases have confidence ≥ 0.70 (high confidence failures)
- Your cases don't have overall_confidence data in the JSON

**This is EXPECTED and CORRECT behavior!**

---

## Situation 2: 🔍 **Missing Data in JSON Files**

### Check Your Data Structure

Open one of your `consolidated_final.json` files:

**✅ CORRECT (will count):**
```json
{
  "case_number": "CASE-12345",
  "bill_summary": {
    "case_verdict": 0,
    "overall_confidence": 0.65,    ← REQUIRED FIELD
    "extracted_amount": 1500.00,
    "calculated_amount": 1200.00
  }
}
```

**❌ MISSING (will show 0):**
```json
{
  "case_number": "CASE-12345",
  "bill_summary": {
    "case_verdict": 0,
    // ⚠️ No overall_confidence field!
    "extracted_amount": 1500.00,
    "calculated_amount": 1200.00
  }
}
```

---

## How to Debug

### Step 1: Open Browser Console

1. **Open your dashboard in the browser**
2. **Press F12** (Developer Tools)
3. **Go to Console tab**
4. **Load your case folder**
5. **Look for debug output:**

```
=== Failed by Low Confidence Debug ===
Total rows: 100
Threshold: 0.7
Failed cases (verdict=0): 25
Cases with overallConfidence: 80
Failed LOW confidence count: 15
Sample rows: [...]
```

### Interpreting the Debug Output:

| Output | Meaning |
|--------|---------|
| `Total rows: 100` | Successfully loaded 100 cases |
| `Failed cases: 25` | 25 cases have verdict=0 |
| `Cases with overallConfidence: 80` | 80 cases have confidence data |
| `Failed LOW confidence count: 15` | **Final answer: 15 cases match criteria** |

### If you see:
- `Cases with overallConfidence: 0` → **Your JSON files don't have the field**
- `Failed cases: 0` → **All your cases passed (verdict=1)**
- `Failed LOW confidence count: 0` → **All failed cases have high confidence**

---

## Step 2: Check Sample Data in Console

The debug log also shows sample rows. Look for:

```javascript
Sample rows: [
  {
    caseId: "CASE-001",
    verdict: 0,
    overallConf: 0.65,
    counts: true    ← This case WILL be counted
  },
  {
    caseId: "CASE-002",
    verdict: 0,
    overallConf: 0.85,
    counts: false   ← This case won't be counted (high confidence)
  },
  {
    caseId: "CASE-003",
    verdict: 0,
    overallConf: null,
    counts: false   ← This case won't be counted (missing data)
  }
]
```

---

## Step 3: Fix Data Path (If Needed)

If your JSON structure is different:

### Example: Your data looks like:
```json
{
  "metadata": {
    "confidence_score": 0.65
  },
  "result": {
    "verdict": 0
  }
}
```

### Solution:
1. **Open Settings** (gear icon)
2. **Go to "Overall Confidence" section**
3. **Change key path** from:
   - `bill_summary.overall_confidence`
   - to: `metadata.confidence_score`
4. **Click "Save"**
5. **Reload your case folder**

---

## Step 4: Restart Dev Server

If you're running the dev server:

```bash
# Stop the server (Ctrl+C)

# Rebuild
npm run build

# Start dev server
npm run dev
```

Then refresh browser: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)

---

## Step 5: Clear Browser Cache

Sometimes browsers cache the old code:

**Chrome/Edge:**
1. Press `Ctrl+Shift+Delete`
2. Select "Cached images and files"
3. Click "Clear data"

**Or use Incognito/Private browsing**

---

## Verify Feature is Loaded

### The Card Should Be Visible:

```
Insights Bar:
┌─────────────┬─────────────┬────────────────────────────┬──────────────────┐
│ Total Cases │  Pass Rate  │ Failed by Low Confidence   │ Amount Mismatches│
│     100     │     75%     │           15               │        8         │
└─────────────┴─────────────┴────────────────────────────┴──────────────────┘
                                      ↑
                              Should see this card
```

- **If card is missing:** Feature not loaded, need to rebuild/restart
- **If card shows 0:** Working correctly, just no matching cases

---

## Settings Should Include:

**Open Settings → Scroll down:**

You should see a new section:

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

**If you don't see this section:**
- Build hasn't been applied
- Need to rebuild: `npm run build`
- Need to restart dev server

---

## Understanding the Count Logic

A case is counted **ONLY** if **ALL** of these are true:

```typescript
✅ finalVerdict === 0           (Case must be failed)
✅ overallConfidence !== null   (Must have confidence data)
✅ overallConfidence < 0.70     (Must be below threshold)
```

### Real Examples:

**Case 1: Will Be Counted ✅**
```json
{
  "bill_summary": {
    "case_verdict": 0,              ← Failed
    "overall_confidence": 0.55      ← Below 0.70
  }
}
```
**Result:** Counted in "Failed by Low Confidence"

---

**Case 2: Will NOT Be Counted ❌ (High Confidence)**
```json
{
  "bill_summary": {
    "case_verdict": 0,              ← Failed
    "overall_confidence": 0.88      ← Above 0.70
  }
}
```
**Result:** Not counted (confident failure)

---

**Case 3: Will NOT Be Counted ❌ (Missing Data)**
```json
{
  "bill_summary": {
    "case_verdict": 0               ← Failed
    // No overall_confidence field
  }
}
```
**Result:** Not counted (no confidence data)

---

**Case 4: Will NOT Be Counted ❌ (Passed)**
```json
{
  "bill_summary": {
    "case_verdict": 1,              ← Passed
    "overall_confidence": 0.55      ← Low confidence
  }
}
```
**Result:** Not counted (not a failure)

---

## Test with Known Data

### Create a test case to verify:

**File:** `test-folder/test-case/consolidated_final.json`
```json
{
  "case_number": "TEST-LOWCONF-001",
  "bill_summary": {
    "case_verdict": 0,
    "overall_confidence": 0.55,
    "extracted_amount": 1000,
    "calculated_amount": 1000
  }
}
```

**File:** `test-folder/test-case/stage_confidence/.gitkeep`
(Empty folder is fine)

**Load this folder:**
1. Click "Select Case Folder"
2. Choose `test-folder`
3. Check "Failed by Low Confidence"
4. **Should show: 1** ✅

---

## Common Scenarios

### Scenario A: All Zeros
```
Total Cases: 100
Pass Rate: 75%
Failed by Low Confidence: 0
```

**Meaning:**
- 75 cases passed
- 25 cases failed
- All 25 failures had confidence ≥ 0.70 (or missing data)
- **This is normal!** Your model is confident in its decisions

---

### Scenario B: Some Low Confidence Failures
```
Total Cases: 100
Pass Rate: 70%
Failed by Low Confidence: 18
```

**Meaning:**
- 70 cases passed
- 30 cases failed
- 18 of the failures had confidence < 0.70
- 12 of the failures had confidence ≥ 0.70
- **Action:** Review those 18 uncertain failures

---

### Scenario C: Many Low Confidence Failures
```
Total Cases: 100
Pass Rate: 60%
Failed by Low Confidence: 35
```

**Meaning:**
- 40 cases failed
- 35 of them had low confidence
- **Red flag!** Model is uncertain about most failures
- **Action:** May need model retraining or threshold adjustment

---

## Still Need Help?

**Share this debug output:**

1. Open browser console (F12)
2. Load your case folder
3. Copy the debug output:
```
=== Failed by Low Confidence Debug ===
Total rows: ...
Threshold: ...
Failed cases (verdict=0): ...
Cases with overallConfidence: ...
Failed LOW confidence count: ...
Sample rows: ...
```

This will show exactly what the dashboard is seeing!

---

## Quick Checklist

- [ ] Rebuilt project: `npm run build`
- [ ] Restarted dev server (if using `npm run dev`)
- [ ] Refreshed browser (Ctrl+Shift+R)
- [ ] Cleared browser cache
- [ ] Checked browser console (F12) for debug output
- [ ] Verified "Failed by Low Confidence" card is visible
- [ ] Checked Settings has "Overall Confidence" section
- [ ] Verified JSON files have `overall_confidence` field
- [ ] Checked debug output in console
- [ ] Some cases have `finalVerdict === 0`
- [ ] Some failed cases have `overallConfidence < 0.70`

---

## Summary

✅ **Feature is working if:**
- Card is visible in Insights Bar
- Console shows debug output
- Settings has "Overall Confidence" section

📊 **Count is 0 because:**
- No cases match all 3 criteria (failed + has confidence + low confidence)
- This is **expected and correct** if your data doesn't match!

🔍 **Check console debug output** to see exactly what the dashboard found!
