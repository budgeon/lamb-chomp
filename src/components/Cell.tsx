import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CellKind } from '../play/boardView';
import { palette } from '../theme/palette';

interface Props {
  kind: CellKind;
  /** Checkerboard shade, as in the prototype's `.alt` tiles. */
  alt: boolean;
  size: number;
  testID: string;
  label: string;
}

/** Tile background by kind. Rock, mud and flowerbed sit on soil or grass with a plain marker. */
function background(kind: CellKind, alt: boolean): string {
  switch (kind) {
    case 'grass':
    case 'flowerbed':
      return alt ? palette.grassAlt : palette.grass;
    case 'tall grass':
      return alt ? palette.tallAlt : palette.tall;
    default:
      return alt ? palette.soilAlt : palette.soil;
  }
}

function markerColor(kind: CellKind): string | null {
  switch (kind) {
    case 'rock':
      return palette.rock;
    case 'mud':
      return palette.mud;
    case 'flowerbed':
      return palette.petal;
    default:
      return null;
  }
}

/**
 * One board tile. Its own accessibility element so Maestro can read its label.
 * Memoised: a swipe re-renders only tiles whose kind changed.
 */
function CellImpl({ kind, alt, size, testID, label }: Props) {
  const marker = markerColor(kind);
  const inset = Math.round(size * (kind === 'flowerbed' ? 0.3 : 0.12));
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={{ width: size, height: size, backgroundColor: background(kind, alt) }}
    >
      {marker ? (
        <View
          style={[
            styles.marker,
            { top: inset, left: inset, right: inset, bottom: inset, backgroundColor: marker },
            { borderRadius: Math.round(size * (kind === 'rock' ? 0.28 : 0.5)) },
          ]}
        />
      ) : null}
    </View>
  );
}

export const Cell = memo(CellImpl);

const styles = StyleSheet.create({
  marker: { position: 'absolute' },
});
