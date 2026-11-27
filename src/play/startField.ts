/**
 * Hidden test hook: which field the app opens on.
 *
 * Maestro passes `launchApp: { arguments: { startField: 5 } }`. On iOS those launch
 * arguments land in the app's NSUserDefaults argument domain, which React Native's
 * `Settings.get('startField')` reads. The value may arrive as a number or as a
 * string, so both are accepted.
 *
 * Pure: no React or platform imports. The caller does the `Settings` read.
 */

/**
 * Turns the raw `startField` value (1-based field number) into a 0-based index
 * into LEVELS. An integer, or a string of digits, `n` in `1..count` gives `n - 1`.
 * Anything else (missing, not an integer, out of range) gives 0, i.e. field 1.
 */
export function parseStartField(raw: unknown, count: number): number {
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    n = Number(raw);
  } else {
    return 0;
  }
  if (!Number.isInteger(n) || n < 1 || n > count) return 0;
  return n - 1;
}
