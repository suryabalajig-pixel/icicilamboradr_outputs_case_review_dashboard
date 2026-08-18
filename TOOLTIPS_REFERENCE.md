# InsightsBar Tooltips Reference

All data point cards in the InsightsBar now show helpful definitions when you hover over them.

---

## GROUP 1: Summary

### Total Cases
**Tooltip:** "Total number of cases loaded from the selected folder. Includes both passed and failed cases."

### Passed
**Tooltip:** "Cases where finalVerdict = 1 (approved). Click to filter and see only passed cases."

### Failed
**Tooltip:** "Cases where finalVerdict = 0 (rejected). Click to filter and see only failed cases."

### Parse Errors
**Tooltip:** "Cases with missing or unparsable JSON files. Check errorDetails in table for specifics."

---

## GROUP 2: Why Failed

### Amount Mismatch
**Tooltip:** "Failed cases where extracted amount differs from calculated amount by more than ₹5. Indicates extraction errors."

### Low Conf <70%
**Tooltip:** "Failed cases where amounts match but overall confidence is below 70%. Model uncertain about result."
*(Threshold percentage adjusts based on settings)*

### Agent Blocked
**Tooltip:** "Failed cases blocked by adjudication agents (document_checker, admin, or financial) despite passing other checks."

---

## GROUP 3: Knocked

### Total With Knocked
**Tooltip:** "Total cases (passed + failed) with non-payable deductions. Amount knocked/disallowed by financial agent."

### Passed With Knocked
**Tooltip:** "Passed cases that had some charges disallowed. Case approved despite deductions being applied."

### Failed With Knocked
**Tooltip:** "Failed cases with non-payable deductions. Case rejected and had charges knocked/disallowed."

---

## GROUP 4: Judge Override

### Passed With Flags
**Tooltip:** "Passed cases with judge override flags. Flags: judge.status=pass/fail or judge.score<0.70. Needs review."

### Judge Fail Flag
**Tooltip:** "Passed cases where judge explicitly failed an agent (judge.status=fail). Critical contradiction - needs investigation."

### Judge Approved
**Tooltip:** "Cases with explicit judge approval (judge.status=pass). Rare - indicates manual override or special handling."

### Low Judge Score
**Tooltip:** "Passed cases where minimum judge score across agents is below 75%. Judge had low confidence despite approval."

---

## GROUP 5: Pipeline Stages

### Stage Cards (Categorisation, Extraction, etc.)
**Tooltip:** "Average confidence score for [Stage Name] stage. Low count shows cases below 70% threshold."
*(Stage name and threshold adjust dynamically)*

---

## Usage

1. **Hover** over any card to see the tooltip
2. **Click** on cards with filter capability to drill down
3. **Active filters** show "Click to clear this filter" instead of the tooltip

---

## Technical Notes

- Tooltips use the native HTML `title` attribute for maximum compatibility
- Maximum 3 lines per tooltip as requested
- Tooltips are hidden when a card is in active filter state (shows clear message instead)
- All metrics are clickable where filtering makes sense

---

## Future Enhancement Ideas

If you want richer tooltips in the future, consider:
- Custom tooltip component with HTML formatting
- Show example case numbers
- Display trend arrows (up/down from previous load)
- Include actionable recommendations

For now, the native tooltips provide clear, concise definitions without extra dependencies.
