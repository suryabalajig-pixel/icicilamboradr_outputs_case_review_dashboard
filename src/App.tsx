import { useEffect, useRef, useState } from 'react';
import AppShell from './components/AppShell';
import FolderPicker from './components/FolderPicker';
import CaseTable from './components/CaseTable';
import InsightsBar from './components/InsightsBar';
import JsonDetailModal from './components/JsonDetailModal';
import ExcludedCasesModal from './components/ExcludedCasesModal';
import { useAppStore } from './store/appStore';
import { usePersistedSettings } from './hooks/usePersistedSettings';
import { loadDirHandle, queryDirHandlePermission } from './lib/dirHandleStore';

function DashboardView() {
  return (
    <div className="flex h-full flex-col">
      <InsightsBar />
      <div className="flex-1 overflow-hidden">
        <CaseTable />
      </div>
    </div>
  );
}

export default function App() {
  const allCaseRows = useAppStore((s) => s.allCaseRows);
  const loadingProgress = useAppStore((s) => s.loadingProgress);
  const loadDirectory = useAppStore((s) => s.loadDirectory);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [rootFolderName, setRootFolderName] = useState<string | undefined>(undefined);
  const lastHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const [persistedSettings] = usePersistedSettings();

  // Seed the store's settings from localStorage once on mount, and try to
  // recall the last-used directory handle (for the "Refresh" / re-select
  // actions in AppShell's sidebar — FolderPicker does its own independent
  // mount-time check for its "Reload last folder" link, so this does not
  // duplicate that UI, it just keeps a handle around for App-level actions).
  useEffect(() => {
    updateSettings(persistedSettings);

    (async () => {
      try {
        const handle = await loadDirHandle();
        if (!handle) return;
        const permission = await queryDirHandlePermission(handle);
        if (permission === 'denied') return;
        lastHandleRef.current = handle;
        setRootFolderName(handle.name);
      } catch {
        // No stored handle, or permission query failed — ignore.
      }
    })();
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      lastHandleRef.current = handle;
      setRootFolderName(handle.name);
      await loadDirectory(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('App: showDirectoryPicker failed', err);
    }
  };

  const handleRefresh = async () => {
    if (!lastHandleRef.current) return;
    await loadDirectory(lastHandleRef.current);
  };

  return (
    <>
      <AppShell
        rootFolderName={rootFolderName}
        onChangeFolder={pickFolder}
        onReselectFolder={pickFolder}
        onRefresh={handleRefresh}
      >
        {allCaseRows.length === 0 && loadingProgress === null && <FolderPicker />}
        {loadingProgress !== null && (
          <div className="flex h-full w-full items-center justify-center">
            <p className="text-body text-textMuted">
              Parsing {loadingProgress.done} / {loadingProgress.total} cases…
            </p>
          </div>
        )}
        {allCaseRows.length > 0 && loadingProgress === null && <DashboardView />}
      </AppShell>
      <JsonDetailModal />
      <ExcludedCasesModal />
    </>
  );
}
