/// <reference types="jest" />
/**
 * AC14: saved-progress fixtures. `progress-v1.json` locks today's schema so a
 * future version can prove its migration loses nothing. The other fixtures
 * cover the malformed and future-version cases the loader must survive.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

import { LEVELS } from '../../game';
import { ECONOMY } from '../../economy/config';
import { PROGRESS_VERSION, defaultProgress, parseProgress, serializeProgress } from '../progress';
import type { FieldBest, Progress } from '../progress';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

const DEFAULTS: Progress = { version: 1, coins: 0, fields: {} };

describe('parseProgress fixtures (AC14)', () => {
  it('schema version is 1 and defaults are empty', () => {
    expect(PROGRESS_VERSION).toBe(1);
    expect(defaultProgress()).toEqual(DEFAULTS);
    expect(defaultProgress()).not.toBe(defaultProgress()); // a fresh object each time
  });

  it('missing file (null): defaults, neither corrupt nor read-only', () => {
    expect(parseProgress(null)).toEqual({ progress: DEFAULTS, corrupt: false, readOnly: false });
  });

  it('progress-v1.json loads exactly', () => {
    expect(parseProgress(fixture('progress-v1.json'))).toEqual({
      progress: {
        version: 1,
        coins: 50,
        fields: {
          'field-01': { stars: 3, badge: true, bestMoves: 5 },
          'field-02': { stars: 2, badge: false, bestMoves: 11 },
          'field-03': { stars: 1, badge: false, bestMoves: 20 },
        },
      },
      corrupt: false,
      readOnly: false,
    });
  });

  it('progress-v1.json round-trips byte-stable through serialize', () => {
    const text = fixture('progress-v1.json');
    expect(serializeProgress(parseProgress(text).progress)).toBe(text);
  });

  it('serialize sorts ids and fixes key order whatever the in-memory order', () => {
    const entry = (stars: 1 | 2 | 3, badge: boolean, bestMoves: number) =>
      ({ bestMoves, badge, stars }) as unknown as FieldBest; // keys deliberately reversed
    const scrambled = {
      fields: {
        'field-03': entry(1, false, 20),
        'field-01': entry(3, true, 5),
        'field-02': entry(2, false, 11),
      },
      coins: 50,
      version: 1,
    } as unknown as Progress;
    expect(Object.keys(scrambled.fields)[0]).toBe('field-03');
    expect(serializeProgress(scrambled)).toBe(fixture('progress-v1.json'));
  });

  it('progress-corrupt.txt (not JSON): defaults and corrupt', () => {
    expect(parseProgress(fixture('progress-corrupt.txt'))).toEqual({
      progress: DEFAULTS,
      corrupt: true,
      readOnly: false,
    });
  });

  it.each<[string, string]>([
    ['empty text', ''],
    ['JSON null', 'null'],
    ['a number', '42'],
    ['a string', '"progress"'],
    ['an array', '[{"version": 1}]'],
    ['no version (P: corrupt)', '{"coins": 25, "fields": {}}'],
    ['version as a string', '{"version": "1", "coins": 25, "fields": {}}'],
    ['fractional version', '{"version": 1.5, "coins": 25, "fields": {}}'],
    ['version 0 (no migration)', '{"version": 0, "coins": 25, "fields": {}}'],
  ])('%s: defaults and corrupt', (_name, raw) => {
    expect(parseProgress(raw)).toEqual({ progress: DEFAULTS, corrupt: true, readOnly: false });
  });

  it('progress-bad-entries.json: bad entries dropped, badge cleared below 3 stars, good ones kept', () => {
    const result = parseProgress(fixture('progress-bad-entries.json'));
    expect(result.corrupt).toBe(false);
    expect(result.readOnly).toBe(false);
    expect(result.progress).toEqual({
      version: 1,
      coins: 40, // valid, so kept as saved
      fields: {
        // field-01 stars 0, field-02 stars 4, field-03 stars "3": dropped
        'field-04': { stars: 2, badge: false, bestMoves: 12 }, // badge with 2 stars: cleared
        // field-05 bestMoves 5.5, field-06 bestMoves 9 < par 10, field-08 not an object: dropped
        'field-07': { stars: 3, badge: true, bestMoves: 12 },
        // field-96 bestMoves 0, field-98 no bestMoves: dropped
        'field-97': { stars: 3, badge: false, bestMoves: 7 }, // non-boolean badge: not earned
        'field-99': { stars: 1, badge: false, bestMoves: 4 }, // unknown id: integer >= 1 is enough
      },
    });
  });

  it('a non-object fields gives no entries', () => {
    for (const fields of ['"x"', '[]', 'null', '7']) {
      const r = parseProgress(`{"version": 1, "coins": 5, "fields": ${fields}}`);
      expect(r).toEqual({ progress: { version: 1, coins: 5, fields: {} }, corrupt: false, readOnly: false });
    }
  });

  it('progress-bad-coins.json: coins -3 rebuilt from the entries', () => {
    // field-01 {3, badge} 25 + field-02 {2} 15 + field-99 {1} 10
    expect(parseProgress(fixture('progress-bad-coins.json')).progress.coins).toBe(50);
  });

  it.each<[string, unknown]>([
    ['"x"', 'x'],
    ['2.5', 2.5],
    ['null', null],
    ['missing', undefined],
  ])('coins %s rebuilt from the entries', (_name, coins) => {
    const doc = JSON.parse(fixture('progress-bad-coins.json'));
    doc.coins = coins;
    const r = parseProgress(JSON.stringify(doc));
    expect(r.progress.coins).toBe(50);
    expect(Object.keys(r.progress.fields)).toEqual(['field-01', 'field-02', 'field-99']);
  });

  it('progress-v2.json (newer app): defaults and read-only, not corrupt', () => {
    expect(parseProgress(fixture('progress-v2.json'))).toEqual({
      progress: DEFAULTS,
      corrupt: false,
      readOnly: true,
    });
  });

  it('unknown field id field-99 survives parse and serialize', () => {
    const text = serializeProgress(parseProgress(fixture('progress-bad-entries.json')).progress);
    expect(JSON.parse(text).fields['field-99']).toEqual({ stars: 1, badge: false, bestMoves: 4 });
    expect(parseProgress(text).progress.fields['field-99']).toEqual({ stars: 1, badge: false, bestMoves: 4 });
  });

  it('an id of "__proto__" is kept as plain data and does not touch the prototype', () => {
    const r = parseProgress('{"version": 1, "coins": 10, "fields": {"__proto__": {"stars": 1, "badge": false, "bestMoves": 3}}}');
    expect(Object.getPrototypeOf(r.progress.fields)).toBe(Object.prototype);
    expect(Object.keys(r.progress.fields)).toEqual(['__proto__']);
    expect(JSON.parse(serializeProgress(r.progress)).fields).toEqual(
      JSON.parse('{"__proto__": {"stars": 1, "badge": false, "bestMoves": 3}}'),
    );
  });
});

describe('parseProgress property', () => {
  const ids = [...LEVELS.map((l) => l.id), 'field-99', 'other'];
  const pars = new Map(LEVELS.map((l) => [l.id, l.par]));
  const looseEntry = fc.record(
    {
      stars: fc.oneof(fc.integer({ min: -1, max: 4 }), fc.constant('3'), fc.constant(null)),
      badge: fc.oneof(fc.boolean(), fc.constant('yes'), fc.constant(1)),
      bestMoves: fc.oneof(fc.integer({ min: -2, max: 60 }), fc.double({ noNaN: false }), fc.constant('7')),
    },
    { requiredKeys: [] },
  );
  const looseDoc = fc.record(
    {
      version: fc.oneof(fc.constant(1), fc.constant(1), fc.integer({ min: -1, max: 3 }), fc.constant('1')),
      coins: fc.oneof(fc.integer({ min: -5, max: 500 }), fc.double(), fc.constant('x')),
      fields: fc.oneof(fc.dictionary(fc.constantFrom(...ids), fc.oneof(looseEntry, fc.anything())), fc.anything()),
    },
    { requiredKeys: [] },
  );

  it('never throws, and what it returns is valid and stable through serialize', () => {
    fc.assert(
      fc.property(fc.oneof(looseDoc.map((d) => JSON.stringify(d)), fc.string(), fc.jsonValue().map((v) => JSON.stringify(v))), (raw) => {
        const r = parseProgress(raw);
        const p = r.progress;
        expect(p.version).toBe(1);
        expect(Number.isSafeInteger(p.coins) && p.coins >= 0).toBe(true);
        for (const [id, e] of Object.entries(p.fields)) {
          expect([1, 2, 3]).toContain(e.stars);
          expect(typeof e.badge).toBe('boolean');
          if (e.badge) expect(e.stars).toBe(3);
          expect(Number.isInteger(e.bestMoves) && e.bestMoves >= Math.max(1, pars.get(id) ?? 1)).toBe(true);
        }
        if (r.corrupt || r.readOnly) expect(p).toEqual(DEFAULTS);
        // Saving what was loaded and loading it again changes nothing.
        const text = serializeProgress(p);
        expect(parseProgress(text, LEVELS, ECONOMY.earn)).toEqual({ progress: p, corrupt: false, readOnly: false });
        expect(serializeProgress(parseProgress(text).progress)).toBe(text);
      }),
      { numRuns: 500 },
    );
  });
});
