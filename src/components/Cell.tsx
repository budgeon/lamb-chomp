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

/**
 * Tile background by kind. Rock, mud and flowerbed sit on soil or grass with a plain marker.
 * A trampled flowerbed gets its own crushed-petal tint so it reads around the sheep.
 */
function background(kind: CellKind, alt: boolean): string {
  switch (kind) {
    case 'grass':
    case 'flowerbed':
      return alt ? palette.grassAlt : palette.grass;
    case 'trampled flowerbed':
      return alt ? palette.trampledAlt : palette.trampled;
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

/** Marker position and rounding for rock, mud and an intact flowerbed. */
function markerBox(kind: CellKind, size: number) {
  const inset = Math.round(size * (kind === 'flowerbed' ? 0.3 : 0.12));
  const borderRadius = Math.round(size * (kind === 'rock' ? 0.28 : 0.5));
  return { top: inset, bottom: inset, left: inset, right: inset, borderRadius };
}

/**
 * Crushed-petal fragments on a trampled flowerbed: [left, top, width, height]
 * as fractions of the cell, plus a colour. The sheep always stands on this cell
 * after the fail and covers its middle, so the fragments sit along the edges and
 * corners, and the whole tile is tinted (prototype `.tile.tramp`: squashed petal
 * ellipses, one pale).
 */
const FRAGMENTS: readonly (readonly [number, number, number, number, string])[] = [
  [0.07, 0.07, 0.28, 0.1, palette.petalPale],
  [0.42, 0.03, 0.18, 0.08, palette.petalTrampled],
  [0.64, 0.1, 0.28, 0.1, palette.petalTrampled],
  [0.03, 0.46, 0.13, 0.09, palette.petalTrampled],
  [0.1, 0.8, 0.3, 0.1, palette.petalTrampled],
  [0.47, 0.88, 0.16, 0.07, palette.petalPale],
  [0.66, 0.79, 0.27, 0.1, palette.petalPale],
];

function TrampledPetals({ size }: { size: number }) {
  return FRAGMENTS.map(([x, y, w, h, color], k) => {
    const height = Math.max(2, Math.round(size * h));
    return (
      <View
        key={k}
        style={[
          styles.marker,
          {
            left: Math.round(size * x),
            top: Math.round(size * y),
            width: Math.round(size * w),
            height,
            borderRadius: height,
            backgroundColor: color,
          },
        ]}
      />
    );
  });
}

/**
 * One board tile. Its own accessibility element so Maestro can read its label.
 * Memoised: a swipe re-renders only tiles whose kind changed.
 */
function CellImpl({ kind, alt, size, testID, label }: Props) {
  const marker = markerColor(kind);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={{ width: size, height: size, backgroundColor: background(kind, alt) }}
    >
      {kind === 'trampled flowerbed' ? <TrampledPetals size={size} /> : null}
      {marker ? (
        <View
          style={[
            styles.marker,
            markerBox(kind, size),
            { backgroundColor: marker },
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
