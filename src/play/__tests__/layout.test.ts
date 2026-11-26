/// <reference types="jest" />
import * as fc from 'fast-check';

import { CELL_MAX, CELL_MIN, FENCE, cellSize } from '../layout';

describe('cellSize (AC3 sizing)', () => {
  it('matches the prototype insets (14 wide, 26 high)', () => {
    // floor(min((343-14)/5, (500-26)/5)) = floor(min(65.8, 94.8)) = 65
    expect(cellSize(343, 500, 5, 5)).toBe(65);
  });

  it('iPhone SE estimate fits field 1 with its fence', () => {
    const c = cellSize(343, 500, 5, 5);
    expect(5 * c + 2 * FENCE).toBeLessThanOrEqual(343);
  });

  it('clamps a large area to CELL_MAX (76)', () => {
    expect(CELL_MAX).toBe(76);
    expect(cellSize(2000, 2000, 5, 5)).toBe(76);
  });

  it('clamps a tiny area to CELL_MIN (28)', () => {
    expect(CELL_MIN).toBe(28);
    expect(cellSize(100, 100, 5, 5)).toBe(28);
  });

  it('is limited by height when height is the tighter side', () => {
    // width allows floor((400-14)/5) = 77, height allows floor((300-26)/5) = 54
    expect(cellSize(400, 300, 5, 5)).toBe(54);
  });

  it('uses columns for width and rows for height', () => {
    // 6 cols x 4 rows: floor(min((314-14)/6, (226-26)/4)) = min(50, 50) = 50
    expect(cellSize(314, 226, 6, 4)).toBe(50);
    expect(cellSize(314, 1000, 6, 4)).toBe(50);
    expect(cellSize(1000, 226, 6, 4)).toBe(50);
  });

  it('property: board plus fence fits whenever the unclamped size is at least CELL_MIN', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3000 }),
        fc.integer({ min: 0, max: 3000 }),
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 3, max: 10 }),
        (w, h, cols, rows) => {
          const unclamped = Math.floor(Math.min((w - 14) / cols, (h - 26) / rows));
          const c = cellSize(w, h, cols, rows);
          expect(c).toBeGreaterThanOrEqual(CELL_MIN);
          expect(c).toBeLessThanOrEqual(CELL_MAX);
          expect(Number.isInteger(c)).toBe(true);
          if (unclamped >= CELL_MIN) {
            expect(cols * c + 2 * FENCE).toBeLessThanOrEqual(w);
            expect(rows * c + 2 * FENCE).toBeLessThanOrEqual(h);
          }
        },
      ),
    );
  });

  it('property: field 1 (5x5) fits for any area where the unclamped size is at least CELL_MIN', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 3000, noNaN: true }), fc.double({ min: 0, max: 3000, noNaN: true }), (w, h) => {
        const c = cellSize(w, h, 5, 5);
        if (Math.floor(Math.min((w - 14) / 5, (h - 26) / 5)) >= CELL_MIN) {
          expect(5 * c + 2 * FENCE).toBeLessThanOrEqual(w);
          expect(5 * c + 2 * FENCE).toBeLessThanOrEqual(h);
        }
      }),
    );
  });
});
