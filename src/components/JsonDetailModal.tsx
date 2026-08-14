import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { JsonView, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { useAppStore } from '../store/appStore';

export default function JsonDetailModal() {
  const modalState = useAppStore((s) => s.modalState);
  const closeModal = useAppStore((s) => s.closeModal);

  useEffect(() => {
    if (!modalState) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modalState, closeModal]);

  if (!modalState) return null;

  const { caseId, fileName, json } = modalState;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45"
      onClick={() => closeModal()}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-[720px] flex-col rounded-md bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-heading font-semibold text-textPrimary">
            Case {caseId} — {fileName}
          </h2>
          <button
            onClick={() => closeModal()}
            aria-label="Close"
            className="text-textMuted hover:text-textPrimary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          <JsonView
            data={(json ?? {}) as object}
            style={defaultStyles}
            shouldExpandNode={(level) => level < 2}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(json, null, 2))}
            className="rounded border border-border px-3 py-1.5 text-body text-textPrimary hover:bg-rowHover"
          >
            Copy JSON
          </button>
          <button
            onClick={() => closeModal()}
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
