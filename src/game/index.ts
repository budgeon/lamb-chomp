export type { Dir, Level, Move, SlideResult, State, Terrain } from './types';
export { parseLevel, slide, isCleared, grassRemaining, validateLevel, DIRS, LEGEND, MAX_SHEEP } from './rules';
export { solve } from './solver';
export type { SolveResult } from './solver';
export { LEVELS } from './levels';
