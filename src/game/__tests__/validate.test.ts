/// <reference types="jest" />
/// <reference types="node" />
import { LEVELS, parseLevel, validateLevel } from '../index';

const ok = { id: 'ok', par: 3, rows: ['Sgg', 'g#.'] };

describe('validateLevel', () => {
  it('accepts every shipped level and a minimal good one', () => {
    for (const l of LEVELS) expect(validateLevel(l)).toEqual([]);
    expect(validateLevel(ok)).toEqual([]);
    expect(validateLevel({ ...ok, hint: 'hi' })).toEqual([]);
  });

  it.each([
    ['not an object', null],
    ['array', []],
    ['missing id', { par: 3, rows: ok.rows }],
    ['bad legend', { ...ok, rows: ['Sgx', 'g#.'] }],
    ['lowercase s', { ...ok, rows: ['sgg', 'gSg'] }],
    ['ragged rows', { ...ok, rows: ['Sgg', 'g#'] }],
    ['empty rows', { ...ok, rows: [] }],
    ['empty row strings', { ...ok, rows: [''] }],
    ['non-string row', { ...ok, rows: ['Sgg', 5] }],
    ['missing sheep', { ...ok, rows: ['ggg', 'g#.'] }],
    ['too many sheep', { ...ok, rows: ['SSg', 'gS.'] }],
    ['no grass', { ...ok, rows: ['S..', '.#.'] }],
    ['zero par', { ...ok, par: 0 }],
    ['negative par', { ...ok, par: -2 }],
    ['fractional par', { ...ok, par: 1.5 }],
    ['missing par', { id: 'x', rows: ok.rows }],
    ['non-string hint', { ...ok, hint: 4 }],
  ])('rejects %s', (_name, level) => {
    expect(validateLevel(level).length).toBeGreaterThan(0);
  });

  it('two sheep is allowed', () => {
    expect(validateLevel({ ...ok, rows: ['SSg', 'g#.'] })).toEqual([]);
  });

  it('parseLevel throws on invalid levels', () => {
    expect(() => parseLevel({ ...ok, rows: ['Sgx'] })).toThrow(/unknown cell/);
  });
});
