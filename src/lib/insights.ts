import type { CaseRow } from './types';

// Pure analytics functions — no store imports, no side effects, no filesystem access.

export function passRate(rows: CaseRow[]): number {
  let numerator = 0;
  let denominator = 0;
  for (const row of rows) {
    if (row.finalVerdict !== null) {
      denominator += 1;
      if (row.finalVerdict === 1) {
        numerator += 1;
      }
    }
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

export function avgConfidence(rows: CaseRow[], stageFileName: string): number | null {
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const stage = row.stages.find((s) => s.fileName === stageFileName);
    if (stage && stage.score !== null) {
      sum += stage.score;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

export function lowConfidenceCount(
  rows: CaseRow[],
  stageFileName: string,
  threshold: number
): number {
  let count = 0;
  for (const row of rows) {
    const stage = row.stages.find((s) => s.fileName === stageFileName);
    if (stage && stage.score !== null && stage.score < threshold) {
      count += 1;
    }
  }
  return count;
}

export function errorCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.hasErrors).length;
}

export function amountMismatchCount(rows: CaseRow[]): number {
  return rows.filter((row) => row.amountMismatch).length;
}

export function failedByLowConfidenceCount(rows: CaseRow[]): number {
  // Count cases where extracted and calculated amounts match BUT verdict is still 0 (failed)
  // This indicates the system failed the case despite amounts being correct - likely a confidence issue
  return rows.filter((row) => 
    row.finalVerdict === 0 && 
    row.extractedAmount !== null && 
    row.calculatedAmount !== null &&
    row.extractedAmount === row.calculatedAmount
  ).length;
}

export function knockedOffBillIssuesCount(rows: CaseRow[]): number {
  // Count cases where knocked_off_bill(s) has data
  const count = rows.filter((row) => row.knockedOffBillIssue).length;
  
  // Debug logging
  console.log('=== Knocked Off Bills Debug ===');
  console.log('Total rows:', rows.length);
  console.log('Rows with knockedOffBillIssue=true:', count);
  
  // Check what's actually in the data
  let hasFieldCount = 0;
  let emptyArrayCount = 0;
  let nonEmptyArrayCount = 0;
  
  rows.forEach(r => {
    if (r.finalRaw && typeof r.finalRaw === 'object') {
      const raw = r.finalRaw as any;
      if ('knocked_off_bills' in raw || 'knocked_off_bill' in raw) {
        hasFieldCount++;
        const value = raw.knocked_off_bills || raw.knocked_off_bill;
        if (Array.isArray(value)) {
          if (value.length === 0) {
            emptyArrayCount++;
          } else {
            nonEmptyArrayCount++;
            if (nonEmptyArrayCount <= 3) {
              console.log(`  Sample: ${r.caseId}, array length: ${value.length}, flag: ${r.knockedOffBillIssue}`);
            }
          }
        } else {
          console.log(`  Non-array value in ${r.caseId}:`, typeof value);
        }
      }
    }
  });
  
  console.log('Files with knocked_off_bill(s) field:', hasFieldCount);
  console.log('  - Empty arrays []:', emptyArrayCount);
  console.log('  - Non-empty arrays (with data):', nonEmptyArrayCount);
  console.log('Counted (knockedOffBillIssue=true):', count);
  
  return count;
}

export function knockedOffBillTotalLineItems(rows: CaseRow[]): number {
  // Sum up all the line items/issues across all knocked_off_bills
  const total = rows.reduce((sum, row) => sum + row.knockedOffBillCount, 0);
  
  // Debug: Show every single case with knocked_off_bills
  console.log('=== Total Line Items Debug ===');
  console.log('Total line items across all cases:', total);
  
  const casesWithItems = rows.filter(r => r.knockedOffBillCount > 0);
  console.log(`Cases with knocked_off_bills: ${casesWithItems.length}`);
  
  if (casesWithItems.length > 0) {
    console.log('ALL cases with knocked_off_bills:');
    casesWithItems.forEach(r => {
      console.log(`  - ${r.caseId}: ${r.knockedOffBillCount} items`);
    });
    
    // Verify the sum
    const verifySum = casesWithItems.reduce((sum, r) => sum + r.knockedOffBillCount, 0);
    console.log(`Sum verification: ${verifySum} (should equal ${total})`);
  }
  
  return total;
}

export function totalTokens(rows: CaseRow[]): number {
  // Sum up all tokens across all cases
  const total = rows.reduce((sum, row) => sum + (row.tokenCount || 0), 0);
  
  // Debug logging
  console.log('=== Total Tokens Debug ===');
  console.log('Total rows:', rows.length);
  console.log('Total tokens:', total);
  
  // Check what's in the data
  const casesWithTokens = rows.filter(r => r.tokenCount !== null && r.tokenCount > 0);
  console.log(`Cases with token count: ${casesWithTokens.length}`);
  
  if (casesWithTokens.length > 0) {
    console.log('Sample cases with tokens (first 5):');
    casesWithTokens.slice(0, 5).forEach(r => {
      console.log(`  - ${r.caseId}: ${r.tokenCount} tokens`);
    });
  }
  
  // Check if any have null
  const nullCount = rows.filter(r => r.tokenCount === null).length;
  console.log(`Cases with null tokenCount: ${nullCount}`);
  
  // Check if field exists in raw data
  const hasFieldInRaw = rows.filter(r => {
    if (r.finalRaw && typeof r.finalRaw === 'object') {
      const raw = r.finalRaw as any;
      return 'total_tokens' in raw;
    }
    return false;
  }).length;
  console.log(`Cases with "total_tokens" in finalRaw: ${hasFieldInRaw}`);
  
  // Sample the first case to see structure
  if (rows.length > 0 && rows[0].finalRaw) {
    const firstRaw = rows[0].finalRaw as any;
    console.log('First case JSON keys:', Object.keys(firstRaw));
    console.log('Looking for "total_tokens" at root level...');
    if ('total_tokens' in firstRaw) {
      console.log('Found! Value:', firstRaw.total_tokens);
    } else {
      console.log('NOT found at root. Check if it\'s nested elsewhere.');
    }
  }
  
  return total;
}

export function stageInsights(
  rows: CaseRow[],
  stageFiles: string[],
  threshold: number
): { fileName: string; avg: number | null; lowCount: number }[] {
  return stageFiles
    .map((fileName) => ({
      fileName,
      avg: avgConfidence(rows, fileName),
      lowCount: lowConfidenceCount(rows, fileName, threshold),
    }))
    .sort((a, b) => b.lowCount - a.lowCount);
}
