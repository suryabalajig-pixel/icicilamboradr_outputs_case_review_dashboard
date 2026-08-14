// Resolves a dot-notation path through a nested object.
// Returns undefined if any segment is missing.
// Supports array index notation: "charges[0].amount"
export function getByPath(obj: unknown, path: string): unknown {
  if (path === '') return undefined;

  // Split "charges[0].amount" into ["charges", "0", "amount"]
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((segment) => segment.length > 0);

  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
