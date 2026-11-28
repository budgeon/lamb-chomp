import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { ClearOutcome } from '../play/progress';
import { palette } from '../theme/palette';

interface Props {
  outcome: ClearOutcome;
  /** The field's par, shown on screen as "Shepherd's best" (D7). */
  par: number;
  /** Opens the next field. Undefined on the last field: no Next button, Fields is primary. */
  onNext?: () => void;
  onOpenFields: () => void;
  /** Absolute placement, given by FieldScreen (layout C2). */
  style?: StyleProp<ViewStyle>;
}

/** "★★☆" for 2 stars. */
export const starGlyphs = (stars: number) => '★'.repeat(stars) + '☆'.repeat(3 - stars);

/**
 * The cleared card (layout C2): drawn over the hint area and the bottom of the
 * paddock, above the Undo / Restart bar, which stays usable (undo is free, D7).
 * It shows this clear's result, not the saved best. No entrance animation: a
 * Reanimated import here would stop the FieldScreen component tests loading
 * (they mock Sheep for the same reason), and the plan leaves it optional.
 */
export function ClearedCard({ outcome, par, onNext, onOpenFields, style }: Props) {
  const fieldsPrimary = onNext === undefined;
  return (
    <View testID="cleared-card" style={[styles.card, style]}>
      <View style={styles.headRow}>
        <Text testID="field-cleared" style={styles.title}>
          Field cleared
        </Text>
        <Text
          testID="clear-stars"
          accessibilityLabel={`${outcome.stars} of 3 stars`}
          style={styles.stars}
        >
          {starGlyphs(outcome.stars)}
        </Text>
      </View>

      {outcome.badge ? (
        <Text testID="clear-badge" style={styles.badge}>
          Shepherd&apos;s best!
        </Text>
      ) : null}
      {outcome.newBest ? (
        <Text testID="clear-new-best" style={styles.newBest}>
          New best
        </Text>
      ) : null}

      <View style={styles.infoRow}>
        <Text testID="clear-moves" style={styles.moves}>
          {`${outcome.moves} moves · Shepherd's best ${par}`}
        </Text>
        {outcome.coins > 0 ? (
          <Text testID="clear-coins" style={styles.coins}>
            {`+${outcome.coins} coins`}
          </Text>
        ) : null}
      </View>

      <View style={styles.buttons}>
        {onNext ? (
          <Pressable
            testID="next-field-button"
            accessibilityRole="button"
            accessibilityLabel="Next field"
            onPress={onNext}
            style={[styles.button, styles.buttonPrimary]}
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Next field</Text>
          </Pressable>
        ) : null}
        <Pressable
          testID="clear-fields-button"
          accessibilityRole="button"
          accessibilityLabel="Fields"
          onPress={onOpenFields}
          style={[styles.button, fieldsPrimary && styles.buttonPrimary]}
        >
          <Text style={[styles.buttonText, fieldsPrimary && styles.buttonTextPrimary]}>Fields</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Same as the Undo / Restart buttons: above the 44 pt minimum touch target. */
const BUTTON_HEIGHT = 48;
/** Prototype `.controls .btn` background, as in FieldScreen. */
const BUTTON_BG = '#1f4d41';

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.pageDeep,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BUTTON_BG,
    padding: 14,
    gap: 8,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: palette.butter,
    fontSize: 20,
    fontWeight: '800',
  },
  stars: {
    color: palette.butter,
    fontSize: 22,
    letterSpacing: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    color: palette.ink,
    backgroundColor: palette.butter,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 13,
    fontWeight: '800',
  },
  newBest: {
    color: palette.butter,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  moves: {
    color: palette.wool,
    fontSize: 15,
  },
  coins: {
    color: palette.butter,
    fontSize: 15,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  button: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUTTON_BG,
  },
  buttonPrimary: {
    backgroundColor: palette.butter,
  },
  buttonText: {
    color: palette.wool,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: palette.ink,
  },
});
