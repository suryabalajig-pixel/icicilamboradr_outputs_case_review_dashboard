// File System Access API helpers.
// The ambient FileSystemDirectoryHandle/FileSystemFileHandle types are declared
// globally in src/vite-env.d.ts — no import needed.

// List all immediate sub-directories of a handle
export async function listSubdirectories(
  handle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle[]> {
  const dirs: FileSystemDirectoryHandle[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'directory') {
      dirs.push(entry);
    }
  }
  return dirs;
}

// List all *.json file handles in a directory, excluding specified names
export async function listJsonFiles(
  dirHandle: FileSystemDirectoryHandle,
  exclude: string[]
): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.json') && !exclude.includes(entry.name)) {
      files.push(entry);
    }
  }
  return files;
}

// Read and parse a single JSON file handle.
// Lets JSON.parse throw on failure — the caller is responsible for catching
// and marking hasErrors (see Task 4's useDirectoryLoader).
export async function readJsonFile(fileHandle: FileSystemFileHandle): Promise<unknown> {
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}
