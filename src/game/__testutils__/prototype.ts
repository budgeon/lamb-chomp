/// <reference types="node" />
/**
 * Loads the reference rules straight out of prototype/index.html, the same way
 * tools/check.js does (slice LEVELS, DIRS, parse and slide out of the inline
 * <script>), and evaluates them in an isolated node `vm` context.
 *
 * The prototype's `move()`/`undo()` are tied to the DOM, so the small driver
 * below mirrors their state logic line for line (early return when won/failed,
 * non-move when the path is empty, snapshot to history, graze, move sheep,
 * trample => failed, cleared check; undo pops the snapshot and clears failed).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

import type { Dir } from '../types';

export interface ProtoSnapshot {
  grass: number[];
  sheep: number[];
  moves: number;
  failed: boolean;
  won: boolean;
  moved: boolean;
}

export interface ProtoLevel {
  par: number;
  hint: string;
  rows: string[];
}

export interface Prototype {
  LEVELS: ProtoLevel[];
  /** Replays moves; after each move pushes a snapshot. With undoOnFail, a failing move is followed by undo and a second snapshot. */
  run(levelIndex: number, moves: [number, Dir][], undoOnFail: boolean): ProtoSnapshot[];
}

const DIR_LETTER: Record<Dir, string> = { up: 'U', down: 'D', left: 'L', right: 'R' };

const DRIVER = `
function __run(i, moves, undoOnFail){
  const P=parse(i);L=P.L;
  const S={grass:P.grass,sheep:P.sheep,moves:0,hist:[],failed:false,won:false};
  const out=[];
  const snapOut=(moved)=>out.push({grass:S.grass.slice(),sheep:S.sheep.slice(),moves:S.moves,failed:S.failed,won:S.won,moved});
  for(const [si,d] of moves){
    let moved=false;
    if(!(S.won||S.failed)){
      const r=slide(S.sheep,si,d);
      if(r.path.length){
        S.hist.push(JSON.stringify({grass:S.grass,sheep:S.sheep,moves:S.moves}));S.moves++;
        r.path.forEach(p=>{if(S.grass[p])S.grass[p]--});
        S.sheep[si]=r.path[r.path.length-1];
        if(r.trample)S.failed=true;
        if(!S.failed&&S.grass.every(v=>!v))S.won=true;
        moved=true;
      }
    }
    snapOut(moved);
    if(undoOnFail&&S.failed){Object.assign(S,JSON.parse(S.hist.pop()));S.failed=false;S.won=false;snapOut(false)}
  }
  return JSON.stringify(out);
}
`;

let cached: Prototype | null = null;

export function loadPrototype(): Prototype {
  if (cached) return cached;
  const file = path.resolve(__dirname, '../../../prototype/index.html');
  const html = fs.readFileSync(file, 'utf8');
  const src = html.split('<script>')[1].split('</script>')[0];
  const lv = src.slice(src.indexOf('const LEVELS='), src.indexOf('const DIRS='));
  const core =
    src.slice(src.indexOf('const DIRS='), src.indexOf('const $=')) +
    'let L;' +
    src.slice(src.indexOf('function parse'), src.indexOf('/* ---------- drawing'));
  if (!lv || !core.includes('function slide')) throw new Error('could not extract rules from prototype');

  const ctx = vm.createContext({});
  vm.runInContext(
    lv + core + DRIVER + ';globalThis.__levels=JSON.stringify(LEVELS);globalThis.__runFn=__run;',
    ctx,
    { filename: 'prototype-rules.js' },
  );
  const LEVELS = JSON.parse((ctx as { __levels: string }).__levels) as ProtoLevel[];
  cached = {
    LEVELS,
    run(levelIndex, moves, undoOnFail) {
      const encoded = JSON.stringify(moves.map(([s, d]) => [s, DIR_LETTER[d]]));
      // Pass data in as JSON so no host-realm objects leak into the sandbox.
      vm.runInContext(`globalThis.__moves=JSON.parse(${JSON.stringify(encoded)})`, ctx);
      const out = vm.runInContext(`__runFn(${levelIndex}, __moves, ${undoOnFail})`, ctx) as string;
      return JSON.parse(out) as ProtoSnapshot[];
    },
  };
  return cached;
}

/** The eight par solutions from tools/check.js, verbatim. "1R" = sheep 1 right; bare letter = sheep 0. */
export const CHECK_SOLUTIONS = [
  'U L D R U',
  'R U L R D L U R',
  'D U L D R U R D L',
  'R D U L D L U R D',
  'R L U L R U L D R U',
  '0R 0U 1U 1D 1R 1U 1D 1L 1U 1R',
  'L D R U R D L R U D L D',
  '1R 1U 0D 0U 0R 0L 0D 0L 0U 0R 0L 0D 0R',
];

const LETTER_DIR: Record<string, Dir> = { U: 'up', D: 'down', L: 'left', R: 'right' };

export function parseSolution(sol: string): { sheep: number; dir: Dir }[] {
  return sol.split(' ').map((m) => ({
    sheep: m.length > 1 ? Number(m[0]) : 0,
    dir: LETTER_DIR[m[m.length - 1]],
  }));
}
