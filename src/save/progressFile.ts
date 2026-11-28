/**
 * The real save file: `progress.json` in the app's Documents directory, which
 * survives app updates and is included in device backups.
 *
 * This is the only module that imports `expo-file-system` (the purity test
 * checks this). The calls are the synchronous SDK 58 `File` API, so the save is
 * read at startup before the first render and written in one JSI call at a
 * clear. Not unit-tested: Jest mocks this module; Maestro covers it on device.
 */
import { File, Paths } from 'expo-file-system';

import { createProgressStore } from './progressStore';
import type { ProgressIO, ProgressStore } from './progressStore';

const SAVE_NAME = 'progress.json';
const BACKUP_NAME = 'progress.corrupt.json';

export const fileProgressIO: ProgressIO = {
  read() {
    const file = new File(Paths.document, SAVE_NAME);
    return file.exists ? file.textSync() : null;
  },
  write(text) {
    new File(Paths.document, SAVE_NAME).writeSync(text);
  },
  backupCorrupt() {
    const file = new File(Paths.document, SAVE_NAME);
    // copy() returns a Promise in 58.0.14; copySync is the synchronous form.
    if (file.exists) file.copySync(new File(Paths.document, BACKUP_NAME), { overwrite: true });
  },
};

export const progressStore: ProgressStore = createProgressStore(fileProgressIO);
