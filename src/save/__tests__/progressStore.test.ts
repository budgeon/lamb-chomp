/// <reference types="jest" />
/**
 * AC15: the save store over an injected in-memory IO. Covers read-once, the
 * corrupt-file backup before the first write, never writing over a newer
 * version's file, and write failures that must not crash.
 */
import * as fs from 'fs';
import * as path from 'path';

import { defaultProgress, serializeProgress } from '../../play/progress';
import type { Progress } from '../../play/progress';
import { createProgressStore } from '../progressStore';
import type { ProgressIO } from '../progressStore';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../../play/__tests__/fixtures', name), 'utf8');

/** In-memory IO that records every call in order. */
function memoryIO(initial: string | null) {
  const calls: string[] = [];
  const state = { text: initial, backup: null as string | null };
  const io: ProgressIO = {
    read: jest.fn(() => {
      calls.push('read');
      return state.text;
    }),
    write: jest.fn((text: string) => {
      calls.push('write');
      state.text = text;
    }),
    backupCorrupt: jest.fn(() => {
      calls.push('backup');
      state.backup = state.text;
    }),
  };
  return { io, calls, state };
}

const CLEARED: Progress = {
  version: 1,
  coins: 25,
  fields: { 'field-01': { stars: 3, badge: true, bestMoves: 5 } },
};

describe('createProgressStore (AC15)', () => {
  it('load reads exactly once and returns the same result after', () => {
    const { io } = memoryIO(fixture('progress-v1.json'));
    const store = createProgressStore(io);
    const first = store.load();
    expect(store.load()).toBe(first);
    store.save(first.progress);
    expect(io.read).toHaveBeenCalledTimes(1);
    expect(first.progress.coins).toBe(50);
  });

  it('missing file: defaults, and the first save writes the serialized text', () => {
    const { io, state, calls } = memoryIO(null);
    const store = createProgressStore(io);
    expect(store.load()).toEqual({ progress: defaultProgress(), corrupt: false, readOnly: false });
    expect(store.save(CLEARED)).toBe(true);
    expect(state.text).toBe(serializeProgress(CLEARED));
    expect(calls).toEqual(['read', 'write']); // no backup when nothing was corrupt
  });

  it('corrupt file: the first save backs it up before writing; the second save does not back up again', () => {
    const corrupt = fixture('progress-corrupt.txt');
    const { io, calls, state } = memoryIO(corrupt);
    const store = createProgressStore(io);
    expect(store.load()).toEqual({ progress: defaultProgress(), corrupt: true, readOnly: false });

    expect(store.save(CLEARED)).toBe(true);
    expect(calls).toEqual(['read', 'backup', 'write']);
    expect(state.backup).toBe(corrupt);

    expect(store.save({ ...CLEARED, coins: 30 })).toBe(true);
    expect(calls).toEqual(['read', 'backup', 'write', 'write']);
    expect(state.backup).toBe(corrupt); // the backup still holds the corrupt text
  });

  it('a write that throws: save returns false without throwing, and the next save writes again', () => {
    const { io, state } = memoryIO(null);
    (io.write as jest.Mock).mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const store = createProgressStore(io);
    let first: boolean | undefined;
    expect(() => {
      first = store.save(CLEARED);
    }).not.toThrow();
    expect(first).toBe(false);
    expect(state.text).toBeNull();

    expect(store.save(CLEARED)).toBe(true);
    expect(io.write).toHaveBeenCalledTimes(2);
    expect(state.text).toBe(serializeProgress(CLEARED));
  });

  it('a backup that throws still writes', () => {
    const { io, calls, state } = memoryIO('not json');
    (io.backupCorrupt as jest.Mock).mockImplementation(() => {
      calls.push('backup');
      throw new Error('copy failed');
    });
    const store = createProgressStore(io);
    expect(store.save(CLEARED)).toBe(true);
    expect(calls).toEqual(['read', 'backup', 'write']);
    expect(state.text).toBe(serializeProgress(CLEARED));
  });

  it('a newer version (readOnly): save never writes or backs up', () => {
    const v2 = fixture('progress-v2.json');
    const { io, state } = memoryIO(v2);
    const store = createProgressStore(io);
    expect(store.load()).toMatchObject({ corrupt: false, readOnly: true });
    expect(store.save(CLEARED)).toBe(false);
    expect(store.save(CLEARED)).toBe(false);
    expect(io.write).not.toHaveBeenCalled();
    expect(io.backupCorrupt).not.toHaveBeenCalled();
    expect(state.text).toBe(v2);
  });

  it('a read that throws: defaults with corrupt true', () => {
    const { io } = memoryIO(null);
    (io.read as jest.Mock).mockImplementation(() => {
      throw new Error('permission denied');
    });
    const store = createProgressStore(io);
    expect(store.load()).toEqual({ progress: defaultProgress(), corrupt: true, readOnly: false });
    expect(io.read).toHaveBeenCalledTimes(1);
  });

  it('save before load loads first, so the readOnly guard still applies', () => {
    const { io } = memoryIO(fixture('progress-v2.json'));
    const store = createProgressStore(io);
    expect(store.save(CLEARED)).toBe(false);
    expect(io.read).toHaveBeenCalledTimes(1);
    expect(io.write).not.toHaveBeenCalled();
  });
});
