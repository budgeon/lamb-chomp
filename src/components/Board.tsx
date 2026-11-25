import { StyleSheet, View } from 'react-native';

import type { BoardView } from '../play/boardView';
import { FENCE } from '../play/layout';
import type { Run } from '../play/session';
import { palette } from '../theme/palette';
import { Cell } from './Cell';
import { Sheep } from './Sheep';

interface Props {
  board: BoardView;
  cell: number;
  run: Run | null;
  onRunEnd: (runId: number) => void;
}

/**
 * The fenced grid. Tiles render from the committed state; sheep are positioned
 * absolutely over them. Not an accessibility element itself, so every cell and
 * sheep stays visible to Maestro.
 */
export function Board({ board, cell, run, onRunEnd }: Props) {
  const innerW = board.width * cell;
  const innerH = board.height * cell;
  return (
    <View testID="board" style={[styles.fence, { width: innerW + 2 * FENCE }]}>
      <View style={[styles.grid, { width: innerW, height: innerH }]}>
        {board.cells.map((c) => (
          <Cell
            key={c.p}
            kind={c.kind}
            alt={(c.x + c.y) % 2 === 1}
            size={cell}
            testID={c.testID}
            label={c.label}
          />
        ))}
        {board.sheep.map((s) => (
          <Sheep
            key={s.i}
            view={s}
            cell={cell}
            cols={board.width}
            run={run && run.sheep === s.i ? run : null}
            onRunEnd={onRunEnd}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fence: {
    borderWidth: FENCE,
    borderColor: palette.fence,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: palette.soil,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
