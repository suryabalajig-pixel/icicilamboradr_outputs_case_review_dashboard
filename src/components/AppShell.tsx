import { useEffect, useState } from 'react';
import { ChevronRight, FolderOpen, RefreshCw, Settings } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import SettingsPanel from './SettingsPanel';

const SIDEBAR_STORAGE_KEY = 'crd_sidebar';

interface AppShellProps {
  children: React.ReactNode;
  rootFolderName?: string;
  onChangeFolder?: () => void;
  onReselectFolder?: () => void;
  onRefresh?: () => void;
}

export default function AppShell({
  children,
  rootFolderName,
  onChangeFolder,
  onReselectFolder,
  onRefresh,
}: AppShellProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleSettingsPanel = useAppStore((s) => s.toggleSettingsPanel);

  // "Table" / "Insights" nav — trivial local view toggle, no real routing.
  const [activeView, setActiveView] = useState<'table' | 'insights'>('table');

  // Read stored collapse state on mount to initialize; falls back to the
  // store's default (false / collapsed) if nothing stored.
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      const shouldBeOpen = stored === 'true';
      if (shouldBeOpen !== sidebarOpen) {
        toggleSidebar();
      }
    }
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    toggleSidebar();
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!sidebarOpen));
  };

  const sidebarWidth = sidebarOpen ? 'w-[240px]' : 'w-[56px]';

  return (
    <div className="flex h-screen w-screen bg-bg text-textPrimary font-sans text-body">
      <aside
        className={`flex flex-shrink-0 flex-col border-r border-border bg-surface transition-all duration-150 ${sidebarWidth}`}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          {sidebarOpen && (
            <span className="truncate text-heading" title={rootFolderName}>
              {rootFolderName ?? 'No folder selected'}
            </span>
          )}
          <button
            onClick={handleToggle}
            className="ml-auto rounded p-1 text-textMuted hover:bg-rowHover"
            aria-label="Toggle sidebar"
          >
            <ChevronRight
              size={16}
              className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1 p-2">
          <button
            onClick={onChangeFolder}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-body text-textPrimary hover:bg-rowHover"
            title="Change folder"
          >
            <FolderOpen size={16} />
            {sidebarOpen && <span>Change folder</span>}
          </button>

          <button
            onClick={() => setActiveView('table')}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-body hover:bg-rowHover ${
              activeView === 'table' ? 'text-accent' : 'text-textPrimary'
            }`}
          >
            {sidebarOpen ? 'Table' : 'T'}
          </button>
          <button
            onClick={() => setActiveView('insights')}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-body hover:bg-rowHover ${
              activeView === 'insights' ? 'text-accent' : 'text-textPrimary'
            }`}
          >
            {sidebarOpen ? 'Insights' : 'I'}
          </button>
        </div>

        <div className="border-t border-border p-2">
          <button
            onClick={() => onReselectFolder?.()}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-body text-textPrimary hover:bg-rowHover"
            title="Re-select folder"
          >
            <FolderOpen size={16} />
            {sidebarOpen && <span>Re-select folder</span>}
          </button>
          <button
            onClick={() => onRefresh?.()}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-body text-textPrimary hover:bg-rowHover"
            title="Refresh"
          >
            <RefreshCw size={16} />
            {sidebarOpen && <span>Refresh</span>}
          </button>
          <button
            onClick={toggleSettingsPanel}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-body text-textPrimary hover:bg-rowHover"
            title="Settings"
          >
            <Settings size={16} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>

      <SettingsPanel />
    </div>
  );
}
