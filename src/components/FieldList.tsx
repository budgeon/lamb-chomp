import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Level } from '../game';
import { isUnlocked } from '../play/progress';
import type { FieldBest, Progress } from '../play/progress';
import { palette } from '../theme/palette';
import { starGlyphs } from './ClearedCard';

interface Props {
  levels: readonly Level[];
  progress: Progress;
  /** Opens field `index` (0-based) with a fresh session. Only called for open fields. */
  onOpenField: (index: number) => void;
  /** Closes the list, back to the field underneath. */
  onBack: () => void;
}

const PER_ROW = 4;

/** The tile's accessibility label (AC10). */
export function tileLabel(n: number, best: FieldBest | undefined, unlocked: boolean): string {
  if (best) {
    return `Field ${n}, ${best.stars} of 3 stars${best.badge ? ", shepherd's best" : ''}`;
  }
  return unlocked ? `Field ${n}, not cleared` : `Field ${n}, locked`;
}

/**
 * The field list (layout L1): a full-screen grid, four tiles per row, each with
 * the field number and its best stars, the shepherd's best pill, or a lock.
 * Unlocks come from the saved results (`isUnlocked`), never from stored flags.
 *
 * App draws it as an opaque absolute-fill sibling over the field screen, not
 * inside the paddock's GestureDetector, so native hit-testing gives every touch
 * on the list to the list: a swipe here never reaches the pan.
 */
export function FieldList({ levels, progress, onOpenField, onBack }: Props) {
  const insets = useSafeAreaInsets();

  const rows: number[][] = [];
  for (let i = 0; i < levels.length; i += PER_ROW) {
    rows.push(levels.slice(i, i + PER_ROW).map((_, k) => i + k));
  }

  return (
    <View
      testID="field-list"
      accessibilityViewIsModal
      style={[
        styles.root,
        { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          testID="field-list-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={8}
          style={styles.back}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Fields
        </Text>
        <Text
          testID="coin-balance"
          accessibilityLabel={`${progress.coins} coins`}
          style={styles.coins}
          numberOfLines={1}
        >
          {`${progress.coins} coins`}
        </Text>
      </View>

      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0]} style={styles.row}>
            {row.map((i) => {
              const level = levels[i];
              const n = i + 1;
              const best = Object.prototype.hasOwnProperty.call(progress.fields, level.id)
                ? progress.fields[level.id]
                : undefined;
              const unlocked = isUnlocked(progress, levels, i);
              return (
                <Pressable
                  key={level.id}
                  testID={`field-tile-${n}`}
                  accessibilityRole="button"
                  accessibilityLabel={tileLabel(n, best, unlocked)}
                  accessibilityState={{ disabled: !unlocked }}
                  disabled={!unlocked}
                  onPress={() => onOpenField(i)}
                  style={[styles.tile, !unlocked && styles.tileLocked]}
                >
                  <Text style={[styles.number, !unlocked && styles.dim]}>{String(n)}</Text>
                  {best ? (
                    <Text style={styles.stars}>{starGlyphs(best.stars)}</Text>
                  ) : (
                    <Text style={styles.status}>{unlocked ? 'Play' : 'Locked'}</Text>
                  )}
                  {best?.badge ? <Text style={styles.badge}>Best!</Text> : null}
                </Pressable>
              );
            })}
            {/* Keep the last row's tiles the same size as the others. */}
            {Array.from({ length: PER_ROW - row.length }, (_, k) => (
              <View key={`gap-${k}`} style={styles.tileGap} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Prototype `.controls .btn` background, as in FieldScreen. */
const BUTTON_BG = '#1f4d41';

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: palette.page,
    paddingHorizontal: 16,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  back: {
    minHeight: 44,
    minWidth: 72,
    justifyContent: 'center',
  },
  backText: {
    color: palette.butter,
    fontSize: 17,
    fontWeight: '700',
  },
  title: {
    color: palette.butter,
    fontSize: 28,
    fontWeight: '900',
  },
  coins: {
    minWidth: 72,
    textAlign: 'right',
    color: palette.wool,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  grid: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: BUTTON_BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileLocked: {
    opacity: 0.45,
  },
  tileGap: {
    flex: 1,
  },
  number: {
    color: palette.wool,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  dim: {
    color: palette.woolDim,
  },
  stars: {
    color: palette.butter,
    fontSize: 14,
    letterSpacing: 1,
  },
  status: {
    color: palette.woolDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badge: {
    color: palette.ink,
    backgroundColor: palette.butter,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 6,
    fontSize: 10,
    fontWeight: '800',
  },
});
