/**
 * The save store: loads saved progress once and writes it after each clear.
 *
 * The file IO is injected (`ProgressIO`), so this module imports no Expo and
 * Jest runs it against an in-memory IO. `progressFile.ts` supplies the real IO.
 *
 * Rules (AC15):
 * - `load()` reads once; later calls return the same result. A read that
 *   throws counts as corrupt data.
 * - `save()` never writes over a file from a newer app version (`readOnly`).
 * - Before the first write over corrupt data, the bad file is backed up.
 * - A write that throws returns false instead of crashing. Progress stays in
 *   memory and the next clear writes it again.
 */
import { defaultProgress, parseProgress, serializeProgress } from '../play/progress';
import type { LoadResult, Progress } from '../play/progress';

export interface ProgressIO {
  /** The saved text, or null when there is no save. May throw. */
  read(): string | null;
  /** Replaces the save with `text`. May throw. */
  write(text: string): void;
  /** Copies the current (corrupt) save aside, overwriting any older backup. May throw. */
  backupCorrupt(): void;
}

export interface ProgressStore {
  load(): LoadResult;
  /** Writes `p`. Returns false when nothing was written (read-only save or a failed write). */
  save(p: Progress): boolean;
}

export function createProgressStore(io: ProgressIO): ProgressStore {
  let loaded: LoadResult | null = null;
  // Set once the backup has been tried, so a later save never copies our own
  // good file over the backup of the corrupt one.
  let backupDone = false;

  function load(): LoadResult {
    if (loaded) return loaded;
    try {
      loaded = parseProgress(io.read());
    } catch {
      loaded = { progress: defaultProgress(), corrupt: true, readOnly: false };
    }
    return loaded;
  }

  function save(p: Progress): boolean {
    const { corrupt, readOnly } = load();
    if (readOnly) return false;
    if (corrupt && !backupDone) {
      backupDone = true;
      try {
        io.backupCorrupt();
      } catch {
        // Losing the backup must not also lose this clear.
      }
    }
    try {
      io.write(serializeProgress(p));
      return true;
    } catch {
      return false;
    }
  }

  return { load, save };
}
