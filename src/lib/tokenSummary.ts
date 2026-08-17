import { getByPath } from './jsonPath';
import type { TokenSummary } from './types';

function numberAt(raw: unknown, path: string): number | null {
  const value = getByPath(raw, path);
  return typeof value === 'number' ? value : null;
}

export function extractTokenSummary(raw: unknown): TokenSummary {
  const totalTokensIn = numberAt(raw, 'stage_confidence.total_tokens_in');
  const totalTokensOut = numberAt(raw, 'stage_confidence.total_tokens_out');
  const explicitOverall =
    numberAt(raw, 'stage_confidence.overall_total_tokens') ??
    numberAt(raw, 'stage_confidence.total_tokens') ??
    numberAt(raw, 'overall_total_tokens') ??
    numberAt(raw, 'total_tokens');

  const calculatedOverall =
    totalTokensIn !== null || totalTokensOut !== null
      ? (totalTokensIn ?? 0) + (totalTokensOut ?? 0)
      : null;

  return {
    totalTokensIn,
    totalTokensOut,
    overallTotalTokens: explicitOverall ?? calculatedOverall,
  };
}
