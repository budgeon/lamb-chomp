/// <reference types="jest" />
import * as fc from 'fast-check';

import { SWIPE_MIN_DISTANCE, swipeDirection } from '../swipe';

describe('swipeDirection', () => {
  it('uses the prototype threshold of 16 pt', () => {
    expect(SWIPE_MIN_DISTANCE).toBe(16);
  });

  it.each([
    [40, 0, 'right'],
    [-40, 0, 'left'],
    [0, 40, 'down'],
    [0, -40, 'up'],
  ] as const)('classifies (%p, %p) as %p', (dx, dy, dir) => {
    expect(swipeDirection(dx, dy)).toBe(dir);
  });

  describe('threshold', () => {
    it.each([
      [15.99, 0, null],
      [16, 0, 'right'],
      [0, -16, 'up'],
      [11, 11, null], // hypot ~ 15.56
      [12, 12, 'down'], // hypot ~ 16.97, tie goes vertical
      [0, 0, null],
    ] as const)('(%p, %p) gives %p', (dx, dy, dir) => {
      expect(swipeDirection(dx, dy)).toBe(dir);
    });

    it('respects a custom minDistance', () => {
      expect(swipeDirection(20, 0, 30)).toBeNull();
      expect(swipeDirection(30, 0, 30)).toBe('right');
      expect(swipeDirection(5, 0, 4)).toBe('right');
      expect(swipeDirection(0, -3.9, 4)).toBeNull();
    });
  });

  describe('diagonals on both sides of 45 degrees', () => {
    it.each([
      [30, 29, 'right'],
      [29, 30, 'down'],
      [-30, 29, 'left'],
      [-29, -30, 'up'],
    ] as const)('(%p, %p) gives %p', (dx, dy, dir) => {
      expect(swipeDirection(dx, dy)).toBe(dir);
    });
  });

  it.each([
    [NaN, 0],
    [0, NaN],
    [Infinity, 0],
    [0, -Infinity],
    [Infinity, Infinity],
  ])('non-finite (%p, %p) gives null', (dx, dy) => {
    expect(swipeDirection(dx, dy)).toBeNull();
  });

  it('property: null iff hypot < 16, else dominant axis with matching sign', () => {
    // Weighted toward the 16 pt boundary so both sides of the threshold are sampled often.
    const coord = fc.oneof(
      fc.double({ min: -24, max: 24, noNaN: true }),
      fc.double({ min: -1000, max: 1000, noNaN: true }),
    );
    fc.assert(
      fc.property(coord, coord, (dx, dy) => {
        const d = swipeDirection(dx, dy);
        if (Math.hypot(dx, dy) < 16) {
          expect(d).toBeNull();
          return;
        }
        expect(d).not.toBeNull();
        if (Math.abs(dx) > Math.abs(dy)) {
          expect(d).toBe(dx > 0 ? 'right' : 'left');
        } else {
          expect(d).toBe(dy > 0 ? 'down' : 'up');
        }
      }),
      { numRuns: 1000 },
    );
  });
});
