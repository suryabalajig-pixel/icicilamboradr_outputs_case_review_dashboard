import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { loadDirHandle, queryDirHandlePermission } from '../lib/dirHandleStore';

export default function FolderPicker() {
  const loadDirectory = useAppStore((s) => s.loadDirectory);
  const [error, setError] = useState<string | null>(null);
  const [lastHandle, setLastHandle] = useState<FileSystemDirectoryHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await loadDirHandle();
        if (!handle || cancelled) return;
        const permission = await queryDirHandlePermission(handle);
        if (permission === 'denied') return;
        if (!cancelled) setLastHandle(handle);
      } catch {
        // No stored handle or permission query failed — just don't show the link.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = async () => {
    setError(null);
    try {
      const handle = await window.showDirectoryPicker();
      await loadDirectory(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      console.error('FolderPicker: showDirectoryPicker failed', err);
      setError('Could not access that folder. Please try again.');
    }
  };

  const handleReloadLast = async () => {
    if (!lastHandle) return;
    setError(null);
    try {
      const permission = await queryDirHandlePermission(lastHandle);
      if (permission === 'prompt') {
        const requested = await lastHandle.requestPermission({ mode: 'read' });
        if (requested !== 'granted') {
          setError('Permission was not granted for the last folder.');
          return;
        }
      } else if (permission === 'denied') {
        setError('Permission denied for the last folder.');
        return;
      }
      await loadDirectory(lastHandle);
    } catch (err) {
      console.error('FolderPicker: reload last folder failed', err);
      setError('Could not reload the last folder.');
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg">
      <div className="flex w-[360px] flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-display text-textPrimary">Case Review Dashboard</h1>

        {lastHandle && (
          <button
            onClick={handleReloadLast}
            className="text-caption text-accent hover:underline"
          >
            Reload last folder
          </button>
        )}

        <button
          onClick={handleSelect}
          className="w-full rounded-md bg-accent px-4 py-2 text-body font-medium text-white hover:opacity-90"
        >
          Select Case Folder
        </button>

        <p className="text-caption text-textMuted">
          Choose the root folder containing your case subfolders.
        </p>

        {error && <p className="text-caption text-lowText">{error}</p>}
      </div>
    </div>
  );
}
