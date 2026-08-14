import { useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/types';
import type { SettingsConfig } from '../lib/types';

const STORAGE_KEY = 'crd_settings';

// Reads and parses the persisted settings from localStorage, shallow-merging
// over DEFAULT_SETTINGS so newly-added default fields in a future app
// version aren't lost by an old stored config missing them. Never throws —
// falls back to DEFAULT_SETTINGS on any failure (missing key, invalid JSON,
// or localStorage access denied e.g. in private/incognito mode).
function readPersistedSettings(): SettingsConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function usePersistedSettings(): [
  SettingsConfig,
  (patch: Partial<SettingsConfig>) => void,
] {
  const [settings, setSettings] = useState<SettingsConfig>(readPersistedSettings);

  function updatePersistedSettings(patch: Partial<SettingsConfig>) {
    setSettings((current) => {
      const merged = { ...current, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Write failure (e.g. private mode) — settings continue working
        // in-memory for the session per design.md's error table.
      }
      return merged;
    });
  }

  return [settings, updatePersistedSettings];
}
