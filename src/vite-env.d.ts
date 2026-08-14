/// <reference types="vite/client" />

// ============================================================
// File System Access API — TypeScript Ambient Declarations
// ============================================================
// The File System Access API is a Chromium-only browser feature.
// These declarations extend the global Window interface so TypeScript
// knows about showDirectoryPicker() and the FileSystem* handle types.

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string | WriteParams): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

type WriteCommandType = 'write' | 'seek' | 'truncate';

interface WriteParams {
  type: WriteCommandType;
  data?: BufferSource | Blob | string;
  position?: number;
  size?: number;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
}

interface FileSystemGetFileOptions {
  create?: boolean;
}

interface FileSystemGetDirectoryOptions {
  create?: boolean;
}

interface FileSystemRemoveOptions {
  recursive?: boolean;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  id?: string;
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

interface SaveFilePickerOptions {
  excludeAcceptAllOption?: boolean;
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  id?: string;
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
