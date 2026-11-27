/// <reference types="jest" />
import * as fc from 'fast-check';

import { parseStartField } from '../startField';

const COUNT = 8;

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
