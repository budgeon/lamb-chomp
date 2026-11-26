/// <reference types="jest" />
import { LEVELS, parseLevel, slide } from '../../game';
import type { Level } from '../../game';
import { buildBoardView, cellKind } from '../boardView';
import type { BoardView, CellKind } from '../boardView';

/** Expected display kind for a row character, straight from the level legend. */
const KIND_OF: Record<string, CellKind> = {
  g: 'grass',
  G: 'tall grass',
  '.': 'soil',
  S: 'soil',
  '#': 'rock',
  m: 'mud',
  f: 'flowerbed',
};

function expectMatchesRows(view: BoardView, level: Level) {
  const rows = level.rows;
  expect(view.height).toBe(rows.length);
  expect(view.width).toBe(rows[0].length);
  expect(view.cells).toHaveLength(rows.length * rows[0].length);
  const expectedSheep: { x: number; y: number }[] = [];
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      const p = y * view.width + x;
      const cell = view.cells[p];
      expect(KIND_OF[c]).toBeDefined();
      expect({ id: cell.testID, p: cell.p, x: cell.x, y: cell.y, kind: cell.kind }).toEqual({
        id: `cell-${x}-${y}`,
        p,
        x,
        y,
        kind: KIND_OF[c],
      });
      expect(cell.label).toBe(`${KIND_OF[c]}, column ${x + 1}, row ${y + 1}`);
      if (c === 'S') expectedSheep.push({ x, y });
    }),
  );
  // Sheep views in scan order (left to right, top to bottom), as in the prototype.
  expect(view.sheep.map((s) => ({ i: s.i, x: s.x, y: s.y, testID: s.testID, label: s.label }))).toEqual(
    expectedSheep.map(({ x, y }, i) => ({
      i,
      x,
      y,
      testID: `sheep-${i}`,
      label: `Sheep, column ${x + 1}, row ${y + 1}`,
    })),
  );
}

const byId = (view: BoardView, id: string) => {
  const c = view.cells.find((cell) => cell.testID === id);
  if (!c) throw new Error(`no cell ${id}`);
  return c;
};

describe('buildBoardView: field 1 (AC2)', () => {
  const level = LEVELS[0];
  const view = buildBoardView(parseLevel(level));

  it('is built for field-01', () => {
    expect(level.id).toBe('field-01');
  });

  it('has 25 cells and 1 sheep', () => {
    expect(view.cells).toHaveLength(25);
    expect(view.sheep).toHaveLength(1);
  });

  it('every cell kind matches the level rows', () => {
    expectMatchesRows(view, level);
  });

  it('spot labels match the spec', () => {
    expect(byId(view, 'cell-0-0').label).toBe('grass, column 1, row 1');
    expect(byId(view, 'cell-1-1').label).toBe('rock, column 2, row 2');
    expect(byId(view, 'cell-1-2').label).toBe('soil, column 2, row 3');
    expect(byId(view, 'cell-3-1').label).toBe('grass, column 4, row 2');
    expect(view.sheep[0].testID).toBe('sheep-0');
    expect(view.sheep[0].label).toBe('Sheep, column 4, row 3');
  });
});

describe('buildBoardView: all shipped levels', () => {
  it('covers every cell kind somewhere in the shipped levels', () => {
    const kinds = new Set<CellKind>();
    for (const level of LEVELS) for (const c of buildBoardView(parseLevel(level)).cells) kinds.add(c.kind);
    // Guards that the sweep below really exercises tall grass, mud and flowerbeds.
    expect([...kinds].sort()).toEqual(['flowerbed', 'grass', 'mud', 'rock', 'soil', 'tall grass']);
  });

  it.each(LEVELS.map((l, i) => [i, l.id, l] as const))(
    'level %i (%s) maps every cell and sheep',
    (_i, _id, level) => {
      expectMatchesRows(buildBoardView(parseLevel(level)), level);
    },
  );
});

describe('buildBoardView after a slide (AC4 twin)', () => {
  it('up from launch grazes column 4 and moves the sheep to row 1', () => {
    const s = parseLevel(LEVELS[0]);
    const r = slide(s, 0, 'up');
    expect(r.moved).toBe(true);
    const view = buildBoardView(r.state);
    expect(byId(view, 'cell-3-1').label).toBe('soil, column 4, row 2');
    expect(byId(view, 'cell-3-0').label).toBe('soil, column 4, row 1');
    expect(byId(view, 'cell-4-1').label).toBe('grass, column 5, row 2');
    expect(view.sheep[0].label).toBe('Sheep, column 4, row 1');
    expect(view.sheep[0]).toMatchObject({ x: 3, y: 0, p: 3 });
  });
});

describe('cellKind', () => {
  it('reads grass amount before terrain', () => {
    const s = parseLevel({ id: 't', par: 1, rows: ['GgS.', '#mf.'] });
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((p) => cellKind(s, p))).toEqual([
      'tall grass',
      'grass',
      'soil',
      'soil',
      'rock',
      'mud',
      'flowerbed',
      'soil',
    ]);
  });
});
