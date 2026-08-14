import type { BillTypeMatchCounts } from './types';

const EMPTY_COUNTS: BillTypeMatchCounts = {
  vectorSearch: 0,
  llmSelect: 0,
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function methodFromValue(value: string): keyof BillTypeMatchCounts | null {
  const normalized = normalizeToken(value);
  if (
    normalized === 'vector_search' ||
    normalized === 'vectorsearch' ||
    normalized === 'vector' ||
    normalized.startsWith('vector_')
  ) {
    return 'vectorSearch';
  }
  if (
    normalized === 'llm_select' ||
    normalized === 'llmselect' ||
    normalized === 'llm' ||
    normalized.startsWith('llm_')
  ) {
    return 'llmSelect';
  }
  return null;
}

function countMethod(counts: BillTypeMatchCounts, value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const method = methodFromValue(value);
  if (!method) return false;
  counts[method] += 1;
  return true;
}

function countCharges(raw: unknown, counts: BillTypeMatchCounts): boolean {
  if (raw === null || typeof raw !== 'object') return false;
  const charges = (raw as Record<string, unknown>).charges;
  if (!Array.isArray(charges)) return false;

  for (const charge of charges) {
    if (charge === null || typeof charge !== 'object') continue;
    const chargeRecord = charge as Record<string, unknown>;
    const matchInfo = chargeRecord.match_info;

    if (matchInfo !== null && typeof matchInfo === 'object') {
      const method = (matchInfo as Record<string, unknown>).method;
      if (countMethod(counts, method)) continue;
    }

    countMethod(counts, chargeRecord.bill_type_match);
  }

  return true;
}

function hasBillTypeContext(path: string[], parentKeys: string[]): boolean {
  return [...path, ...parentKeys].some((part) => normalizeToken(part).includes('bill_type'));
}

function hasMatchingMethodContext(key: string, path: string[]): boolean {
  const normalizedKey = normalizeToken(key);
  const normalizedPath = normalizeToken(path.join('.'));
  return (
    normalizedKey.includes('method') ||
    normalizedKey.includes('source') ||
    normalizedKey.includes('matched_by') ||
    normalizedKey.includes('selected_by') ||
    normalizedKey.includes('selection') ||
    normalizedKey.includes('retrieval') ||
    normalizedPath.includes('match')
  );
}

export function countBillTypeMatchingMethods(raw: unknown): BillTypeMatchCounts {
  const counts: BillTypeMatchCounts = { ...EMPTY_COUNTS };

  if (countCharges(raw, counts)) {
    return counts;
  }

  function walk(value: unknown, path: string[], parentKeys: string[]) {
    if (typeof value === 'string') {
      const method = methodFromValue(value);
      if (
        method &&
        hasBillTypeContext(path, parentKeys) &&
        hasMatchingMethodContext(path[path.length - 1] ?? '', path)
      ) {
        counts[method] += 1;
      }
      return;
    }

    if (value === null || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, path, parentKeys);
      }
      return;
    }

    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue);
    for (const [key, child] of Object.entries(objectValue)) {
      walk(child, [...path, key], keys);
    }
  }

  walk(raw, [], []);
  return counts;
}
