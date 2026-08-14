import type { SettingsConfig } from '../lib/types';
import { useAppStore } from '../store/appStore';

export type BadgeVariant = 'high' | 'medium' | 'low' | 'neutral' | 'pass' | 'fail';

export function scoreToVariant(
  score: number | null | undefined,
  settings: Pick<SettingsConfig, 'highConfidenceThreshold' | 'lowConfidenceThreshold'>
): BadgeVariant {
  if (score === null || score === undefined) return 'neutral';
  if (score >= settings.highConfidenceThreshold) return 'high';
  if (score >= settings.lowConfidenceThreshold) return 'medium';
  return 'low';
}

export function verdictToVariant(verdict: 0 | 1 | null | undefined): BadgeVariant {
  if (verdict === null || verdict === undefined) return 'neutral';
  return verdict === 1 ? 'pass' : 'fail';
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  high: 'bg-highBg text-highText',
  medium: 'bg-mediumBg text-mediumText',
  low: 'bg-lowBg text-lowText',
  neutral: 'bg-neutralBg text-neutralText',
  pass: 'bg-highBg text-highText',
  fail: 'bg-lowBg text-lowText',
};

interface ConfidenceBadgeProps {
  score?: number | null;
  verdict?: 0 | 1 | null;
  onClick?: () => void;
}

export default function ConfidenceBadge({ score, verdict, onClick }: ConfidenceBadgeProps) {
  const settings = useAppStore((s) => s.settings);

  const isVerdict = verdict !== undefined;
  const variant = isVerdict ? verdictToVariant(verdict) : scoreToVariant(score, settings);

  const label =
    isVerdict
      ? verdict === null ? '—' : String(verdict)
      : score === null || score === undefined ? '—' : score.toFixed(2);

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-caption font-mono font-semibold shadow-sm ring-1 ring-inset ring-black/5 transition-transform ${
        VARIANT_CLASSES[variant]
      } ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
    >
      {label}
    </span>
  );
}
