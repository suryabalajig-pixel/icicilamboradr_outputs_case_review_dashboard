// Persistence for the last-used directory handle, via idb-keyval.
// The ambient FileSystemDirectoryHandle/PermissionState types are declared
// globally in src/vite-env.d.ts — no import needed.
import { get, set } from 'idb-keyval';

const DIR_HANDLE_KEY = 'crd_dir_handle';

export async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await set(DIR_HANDLE_KEY, handle);
}

// Resolves to undefined when no handle has been stored yet — idb-keyval's
// `get` resolves to undefined when the key is absent. That is the normal
// "no stored folder yet" case, not an error.
export async function loadDirHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return get<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);
}

export async function queryDirHandlePermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  return handle.queryPermission({ mode: 'read' });
}
