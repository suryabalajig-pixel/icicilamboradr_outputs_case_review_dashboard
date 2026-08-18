import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export default function ExcludedCasesModal() {
  const excludedCasesOpen = useAppStore((s) => s.excludedCasesOpen);
  const excludedCases = useAppStore((s) => s.excludedCases);
  const setExcludedCasesOpen = useAppStore((s) => s.setExcludedCasesOpen);
  const openModal = useAppStore((s) => s.openModal);

  useEffect(() => {
    if (!excludedCasesOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExcludedCasesOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [excludedCasesOpen, setExcludedCasesOpen]);

  if (!excludedCasesOpen) return null;

  const close = () => setExcludedCasesOpen(false);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45"
      onClick={close}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-[720px] flex-col rounded-md bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-heading font-semibold text-textPrimary">
            Not Working — {excludedCases.length} case{excludedCases.length === 1 ? '' : 's'}
          </h2>
          <button
            onClick={close}
            aria-label="Close"
            className="text-textMuted hover:text-textPrimary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          {excludedCases.length === 0 ? (
            <p className="text-body text-textMuted">No excluded cases.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {excludedCases.map((c) => (
                <div
                  key={c.caseId}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-mono text-body font-semibold text-textPrimary">
                      {c.caseId}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {c.reasons.length > 0 ? (
                        c.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded bg-red-100 px-1.5 py-0.5 text-caption font-medium text-red-700"
                          >
                            {reason}
                          </span>
                        ))
                      ) : (
                        <span className="text-caption text-textMuted">no reason recorded</span>
                      )}
                    </div>
                  </div>
                  {c.row.finalRaw !== null && (
                    <button
                      type="button"
                      onClick={() => openModal(c.caseId, 'consolidated_final.json', c.row.finalRaw)}
                      className="shrink-0 rounded border border-border px-3 py-1 text-caption text-textPrimary hover:bg-rowHover"
                    >
                      View
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={close}
            className="rounded bg-accent px-3 py-1.5 text-body text-white hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}