import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getByPath } from '../lib/jsonPath';
import { DEFAULT_SETTINGS } from '../lib/types';
import type { SettingsConfig } from '../lib/types';

const STORAGE_KEY = 'crd_settings';

function persistToLocalStorage(settings: SettingsConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore write failures (e.g. private mode)
  }
}

export default function SettingsPanel() {
  const settingsPanelOpen = useAppStore((s) => s.settingsPanelOpen);
  const toggleSettingsPanel = useAppStore((s) => s.toggleSettingsPanel);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const rederiveCaseRows = useAppStore((s) => s.rederiveCaseRows);
  const stageColumns = useAppStore((s) => s.stageColumns);
  const allCaseRows = useAppStore((s) => s.allCaseRows);

  const [draft, setDraft] = useState<SettingsConfig>(settings);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [excludeInput, setExcludeInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Re-seed draft from the store's current settings whenever the panel
  // transitions from closed -> open, so reopening shows the latest saved
  // settings rather than stale edits from a previous open.
  useEffect(() => {
    if (settingsPanelOpen) {
      setDraft(settings);
      setImportError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsPanelOpen]);

  if (!settingsPanelOpen) return null;

  const handleSave = () => {
    updateSettings(draft);
    rederiveCaseRows();
    persistToLocalStorage(draft);
  };

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const merged: SettingsConfig = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        finalVerdict: { ...DEFAULT_SETTINGS.finalVerdict, ...parsed.finalVerdict },
        overallConfidence: { ...DEFAULT_SETTINGS.overallConfidence, ...parsed.overallConfidence },
        amounts: { ...DEFAULT_SETTINGS.amounts, ...parsed.amounts },
        stageDefaults: { ...DEFAULT_SETTINGS.stageDefaults, ...parsed.stageDefaults },
      };
      setDraft(merged);
      updateSettings(merged);
      rederiveCaseRows();
      persistToLocalStorage(merged);
      setImportError(null);
    } catch (err) {
      console.error('Import config failed:', err);
      setImportError('Could not import config file — invalid JSON.');
    }
  };

  const previewValue = (() => {
    if (allCaseRows.length === 0) return 'no cases loaded yet';
    const resolved = getByPath(allCaseRows[0]?.finalRaw, draft.finalVerdict.valueKeyPath);
    if (resolved === undefined) return 'path not found';
    return JSON.stringify(resolved);
  })();

  const addExcludedFile = () => {
    const value = excludeInput.trim();
    if (value === '' || draft.excludedStageFiles.includes(value)) {
      setExcludeInput('');
      return;
    }
    setDraft({ ...draft, excludedStageFiles: [...draft.excludedStageFiles, value] });
    setExcludeInput('');
  };

  const removeExcludedFile = (fileName: string) => {
    setDraft({
      ...draft,
      excludedStageFiles: draft.excludedStageFiles.filter((f) => f !== fileName),
    });
  };

  const setStageOverride = (
    fileName: string,
    field: 'labelKeyPath' | 'valueKeyPath',
    value: string
  ) => {
    const existing = draft.stageOverrides[fileName] ?? {};
    const next = { ...existing, [field]: value };
    // Drop empty-string fields entirely so empty means "no override".
    if (next.labelKeyPath === '') delete next.labelKeyPath;
    if (next.valueKeyPath === '') delete next.valueKeyPath;

    const nextOverrides = { ...draft.stageOverrides };
    if (Object.keys(next).length === 0) {
      delete nextOverrides[fileName];
    } else {
      nextOverrides[fileName] = next;
    }
    setDraft({ ...draft, stageOverrides: nextOverrides });
  };

  return (
    <div className="fixed right-0 top-0 z-[60] flex h-full w-[400px] flex-col border-l border-border bg-card shadow-[-4px_0_16px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-heading font-semibold text-textPrimary">Settings</h2>
        <button
          onClick={toggleSettingsPanel}
          aria-label="Close settings"
          className="text-textMuted hover:text-textPrimary"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 text-body text-textPrimary">
        {/* Section 1: Final Verdict */}
        <section className="mb-6">
          <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
            Final Verdict
          </h3>
          <label className="mb-1 block text-caption text-textMuted">Value key path</label>
          <input
            type="text"
            value={draft.finalVerdict.valueKeyPath}
            onChange={(e) =>
              setDraft({
                ...draft,
                finalVerdict: { ...draft.finalVerdict, valueKeyPath: e.target.value },
              })
            }
            className="mb-2 w-full rounded border border-border px-2 py-1 text-body"
          />
          <p className="text-caption text-textMuted">
            Preview: <span className="font-mono">{previewValue}</span>
          </p>
        </section>

        {/* Section 1.5: Amount Fields */}
        <section className="mb-6">
          <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
            Amount Fields
          </h3>
          <label className="mb-1 block text-caption text-textMuted">Extracted Amount Key Path</label>
          <input
            type="text"
            value={draft.amounts.extractedAmountKeyPath}
            onChange={(e) =>
              setDraft({
                ...draft,
                amounts: { ...draft.amounts, extractedAmountKeyPath: e.target.value },
              })
            }
            className="mb-2 w-full rounded border border-border px-2 py-1 text-body"
          />
          <label className="mb-1 block text-caption text-textMuted">Calculated Amount Key Path</label>
          <input
            type="text"
            value={draft.amounts.calculatedAmountKeyPath}
            onChange={(e) =>
              setDraft({
                ...draft,
                amounts: { ...draft.amounts, calculatedAmountKeyPath: e.target.value },
              })
            }
            className="w-full rounded border border-border px-2 py-1 text-body"
          />
        </section>

        {/* Section 1.6: Overall Confidence */}
        <section className="mb-6">
          <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
            Overall Confidence
          </h3>
          <label className="mb-1 block text-caption text-textMuted">Overall Confidence Key Path</label>
          <input
            type="text"
            value={draft.overallConfidence.keyPath}
            onChange={(e) =>
              setDraft({
                ...draft,
                overallConfidence: { keyPath: e.target.value },
              })
            }
            className="w-full rounded border border-border px-2 py-1 text-body"
          />
          <p className="mt-1 text-caption text-textMuted">
            Used to calculate "Failed by Low Confidence" metric
          </p>
        </section>

        {/* Section 2: Stage Defaults */}
        <section className="mb-6">
          <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
            Stage Defaults
          </h3>
          <label className="mb-1 block text-caption text-textMuted">Label key path</label>
          <input
            type="text"
            value={draft.stageDefaults.labelKeyPath}
            onChange={(e) =>
              setDraft({
                ...draft,
                stageDefaults: { ...draft.stageDefaults, labelKeyPath: e.target.value },
              })
            }
            className="mb-2 w-full rounded border border-border px-2 py-1 text-body"
          />
          <label className="mb-1 block text-caption text-textMuted">Value key path</label>
          <input
            type="text"
            value={draft.stageDefaults.valueKeyPath}
            onChange={(e) =>
              setDraft({
                ...draft,
                stageDefaults: { ...draft.stageDefaults, valueKeyPath: e.target.value },
              })
            }
            className="w-full rounded border border-border px-2 py-1 text-body"
          />
        </section>

        {/* Section 3: Per-Stage Overrides */}
        <section className="mb-6">
          <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
            Per-Stage Overrides
          </h3>
          {stageColumns.length === 0 && (
            <p className="text-caption text-textMuted">No stage files discovered yet.</p>
          )}
          <div className="flex flex-col gap-1">
            {stageColumns.map((fileName) => {
              const isOpen = expanded[fileName] ?? false;
              const override = draft.stageOverrides[fileName];
              return (
                <div key={fileName} className="rounded border border-border">
                  <button
                    onClick={() => setExpanded({ ...expanded, [fileName]: !isOpen })}
                    className="flex w-full items-center justify-between px-2 py-1.5 text-left text-body hover:bg-rowHover"
                  >
                    <span className="font-mono text-caption">{fileName}</span>
                    <span className="text-textMuted">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-2 py-2">
                      <label className="mb-1 block text-caption text-textMuted">
                        Label key path override
                      </label>
                      <input
                        type="text"
                        value={override?.labelKeyPath ?? ''}
                        onChange={(e) =>
                          setStageOverride(fileName, 'labelKeyPath', e.target.value)
                        }
                        className="mb-2 w-full rounded border border-border px-2 py-1 text-body"
                      />
                      <label className="mb-1 block text-caption text-textMuted">
                        Value key path override
                      </label>
                      <input
                        type="text"
                        value={override?.valueKeyPath ?? ''}
                        onChange={(e) =>
                          setStageOverride(fileName, 'valueKeyPath', e.target.value)
                        }
                        className="w-full rounded border border-border px-2 py-1 text-body"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: Thresholds */}
        <section className="mb-6">
          <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
            Thresholds
          </h3>
          <label className="mb-1 block text-caption text-textMuted">
            Low confidence threshold
          </label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={draft.lowConfidenceThreshold}
            onChange={(e) =>
              setDraft({ ...draft, lowConfidenceThreshold: Number(e.target.value) })
            }
            className="mb-2 w-full rounded border border-border px-2 py-1 text-body"
          />
          <label className="mb-1 block text-caption text-textMuted">
            High confidence threshold
          </label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={draft.highConfidenceThreshold}
            onChange={(e) =>
              setDraft({ ...draft, highConfidenceThreshold: Number(e.target.value) })
            }
            className="w-full rounded border border-border px-2 py-1 text-body"
          />
        </section>

        {/* Section 5: Excluded Stage Files */}
        <section className="mb-6">
          <h3 className="mb-2 text-caption font-semibold uppercase text-textMuted">
            Excluded Stage Files
          </h3>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {draft.excludedStageFiles.map((fileName) => (
              <span
                key={fileName}
                className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-caption text-textPrimary"
              >
                {fileName}
                <button
                  onClick={() => removeExcludedFile(fileName)}
                  aria-label={`Remove ${fileName}`}
                  className="text-textMuted hover:text-textPrimary"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExcludedFile();
                }
              }}
              placeholder="e.g. debug.json"
              className="flex-1 rounded border border-border px-2 py-1 text-body"
            />
            <button
              onClick={addExcludedFile}
              className="rounded border border-border px-3 py-1 text-body text-textPrimary hover:bg-rowHover"
            >
              Add
            </button>
          </div>
        </section>

        {importError && <p className="mb-4 text-caption text-lowText">{importError}</p>}
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
        <button
          onClick={handleSave}
          className="w-full rounded bg-accent px-3 py-1.5 text-body font-medium text-white hover:opacity-90"
        >
          Save
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleExportConfig}
            className="flex-1 rounded border border-border px-3 py-1.5 text-body text-textPrimary hover:bg-rowHover"
          >
            Export Config
          </button>
          <label className="flex-1 cursor-pointer rounded border border-border px-3 py-1.5 text-center text-body text-textPrimary hover:bg-rowHover">
            Import Config
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportConfig}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
