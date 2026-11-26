/// <reference types="jest" />
import * as fc from 'fast-check';

import { SWIPE_MIN_DISTANCE, swipeBetween, swipeDirection } from '../swipe';

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

// Guards verify F1: the swipe is measured from touch-down to lift, so 16 pt of
// finger travel is enough (the gesture runtime's translation would drop the
// first 16 pt and need about 32 pt).
describe('swipeBetween', () => {
  it.each([
    [{ x: 187, y: 400 }, { x: 187, y: 384 }, 'up'], // exactly 16 pt
    [{ x: 187, y: 400 }, { x: 187, y: 380 }, 'up'], // 20 pt
    [{ x: 187, y: 400 }, { x: 187, y: 426 }, 'down'], // 26 pt
    [{ x: 187, y: 400 }, { x: 165, y: 400 }, 'left'], // 22 pt
    [{ x: 187, y: 400 }, { x: 219, y: 400 }, 'right'], // 32 pt
    [{ x: 187, y: 400 }, { x: 187, y: 392 }, null], // 8 pt
    [{ x: 187, y: 400 }, { x: 187, y: 384.01 }, null], // just under 16 pt
    [{ x: 187, y: 400 }, { x: 187, y: 400 }, null],
  ] as const)('%p -> %p gives %p', (start, end, dir) => {
    expect(swipeBetween(start, end)).toBe(dir);
  });

  it('measures end minus start, not the absolute positions', () => {
    // Same 20 pt left swipe anywhere on screen.
    expect(swipeBetween({ x: 300, y: 600 }, { x: 280, y: 600 })).toBe('left');
    expect(swipeBetween({ x: 20, y: 120 }, { x: 0, y: 120 })).toBe('left');
    // A start far from the origin must not leak into the length.
    expect(swipeBetween({ x: 300, y: 600 }, { x: 300, y: 590 })).toBeNull();
  });

  it('property: equals swipeDirection of the delta', () => {
    const c = fc.double({ min: -1000, max: 1000, noNaN: true });
    fc.assert(
      fc.property(c, c, c, c, (x0, y0, x1, y1) => {
        expect(swipeBetween({ x: x0, y: y0 }, { x: x1, y: y1 })).toBe(
          swipeDirection(x1 - x0, y1 - y0),
        );
      }),
      { numRuns: 500 },
    );
  });
});
