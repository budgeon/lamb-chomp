/// <reference types="jest" />
import * as fc from 'fast-check';

import { parseStartField, parseStartFieldOrNull } from '../startField';

const COUNT = 8;

const UNUSABLE: [string, unknown][] = [
  ['undefined', undefined],
  ['null', null],
  ['empty string', ''],
  ['non-numeric string', 'abc'],
  ['decimal string', '5.5'],
  ['decimal number', 5.5],
  ['zero', 0],
  ['negative', -1],
  ['above the count', 9],
  ['string above the count', '9'],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['boolean', true],
  ['array', [5]],
];

const USABLE: [unknown, number][] = [
  [1, 0],
  [5, 4],
  ['5', 4],
  [8, 7],
  ['8', 7],
];

describe('parseStartField (AC18: the start-field hook defaults to field 1)', () => {
  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['non-numeric string', 'abc'],
    ['decimal string', '5.5'],
    ['decimal number', 5.5],
    ['zero', 0],
    ['negative', -1],
    ['above the count', 9],
    ['string above the count', '9'],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['boolean', true],
    ['array', [5]],
  ])('%s gives field 1 (index 0)', (_name, raw) => {
    expect(parseStartField(raw, COUNT)).toBe(0);
  });

  it.each<[unknown, number]>([
    [1, 0],
    [5, 4],
    ['5', 4],
    [8, 7],
    ['8', 7],
  ])('%p gives index %i', (raw, expected) => {
    expect(parseStartField(raw, COUNT)).toBe(expected);
  });

  it('always returns an integer index in [0, count)', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const i = parseStartField(raw, COUNT);
        return Number.isInteger(i) && i >= 0 && i < COUNT;
      }),
    );
  });
});

describe('parseStartFieldOrNull (the launch rule applies when there is no hook value)', () => {
  it.each(UNUSABLE)('%s gives null', (_name, raw) => {
    expect(parseStartFieldOrNull(raw, COUNT)).toBeNull();
  });

  it.each(USABLE)('%p gives index %i', (raw, expected) => {
    expect(parseStartFieldOrNull(raw, COUNT)).toBe(expected);
  });

  it('is null exactly where parseStartField falls back to field 1, and agrees elsewhere', () => {
    fc.assert(
      fc.property(fc.oneof(fc.anything(), fc.integer({ min: -2, max: 10 }), fc.nat(10).map(String)), (raw) => {
        const i = parseStartFieldOrNull(raw, COUNT);
        if (i === null) return parseStartField(raw, COUNT) === 0;
        return Number.isInteger(i) && i >= 0 && i < COUNT && parseStartField(raw, COUNT) === i;
      }),
    );
  });
});
