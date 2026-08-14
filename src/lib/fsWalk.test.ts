import { describe, expect, it } from 'vitest';
import { listJsonFiles, listSubdirectories, readJsonFile } from './fsWalk';

// Minimal mocks for the File System Access API handles. We only implement the
// members these functions actually touch and cast the rest away — the ambient
// interfaces declared in vite-env.d.ts pull in a lot of surface area
// (isSameEntry, queryPermission, etc.) that is irrelevant to this behavior.

function makeDirHandle(
  name: string,
  entries: (FileSystemFileHandle | FileSystemDirectoryHandle)[]
): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const entry of entries) {
        yield entry;
      }
    },
  } as unknown as FileSystemDirectoryHandle;
}

function makeFileHandle(name: string, contents: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    async getFile() {
      return {
        text: async () => contents,
      } as unknown as File;
    },
  } as unknown as FileSystemFileHandle;
}

describe('listSubdirectories', () => {
  it('returns only directory entries', async () => {
    const fileA = makeFileHandle('a.json', '{}');
    const dirB = makeDirHandle('caseB', []);
    const dirC = makeDirHandle('caseC', []);
    const root = makeDirHandle('root', [fileA, dirB, dirC]);

    const result = await listSubdirectories(root);

    expect(result.map((d) => d.name)).toEqual(['caseB', 'caseC']);
    expect(result.every((d) => d.kind === 'directory')).toBe(true);
  });

  it('returns an empty array when there are no subdirectories', async () => {
    const root = makeDirHandle('root', [makeFileHandle('a.json', '{}')]);
    const result = await listSubdirectories(root);
    expect(result).toEqual([]);
  });
});

describe('listJsonFiles', () => {
  it('returns only .json files, excluding specified names', async () => {
    const jsonA = makeFileHandle('categorisation.json', '{}');
    const jsonB = makeFileHandle('summary.json', '{}');
    const textFile = makeFileHandle('notes.txt', 'hello');
    const subdir = makeDirHandle('nested', []);
    const dir = makeDirHandle('case1', [jsonA, jsonB, textFile, subdir]);

    const result = await listJsonFiles(dir, ['summary.json']);

    expect(result.map((f) => f.name)).toEqual(['categorisation.json']);
  });

  it('returns an empty array when nothing matches', async () => {
    const dir = makeDirHandle('case1', [makeFileHandle('notes.txt', 'hello')]);
    const result = await listJsonFiles(dir, []);
    expect(result).toEqual([]);
  });

  it('does not exclude anything when the exclude list is empty', async () => {
    const jsonA = makeFileHandle('a.json', '{}');
    const jsonB = makeFileHandle('b.json', '{}');
    const dir = makeDirHandle('case1', [jsonA, jsonB]);

    const result = await listJsonFiles(dir, []);

    expect(result.map((f) => f.name)).toEqual(['a.json', 'b.json']);
  });
});

describe('readJsonFile', () => {
  it('reads and parses valid JSON', async () => {
    const handle = makeFileHandle('categorisation.json', '{"stage":"categorisation","score":0.938}');
    const result = await readJsonFile(handle);
    expect(result).toEqual({ stage: 'categorisation', score: 0.938 });
  });

  it('throws when the file contains invalid JSON', async () => {
    const handle = makeFileHandle('broken.json', '{not valid json');
    await expect(readJsonFile(handle)).rejects.toBeInstanceOf(SyntaxError);
  });
});
