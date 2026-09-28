import { View, Text, StyleSheet } from 'react-native';
import { getHoursStatus } from '@/lib/hours';

interface Props {
  hours?: string | null;
  utcOffsetMinutes?: number | null;
  /** `compact` is for list rows: dot plus one word, no schedule line. */
  compact?: boolean;
}

/**
 * Open/closed at a glance, so you don't dial a shop that shut an hour ago.
 * Renders nothing when the schedule is unknown rather than showing a grey
 * "unknown" chip — a badge that is usually meaningless trains you to ignore it,
 * and then you miss the one time it says Closed.
 */
export default function HoursBadge({ hours, utcOffsetMinutes, compact }: Props) {
  const { state, detail, todayLabel } = getHoursStatus(hours, utcOffsetMinutes);
  if (state === 'unknown') return null;

  const open = state === 'open';
  const tint = open ? '#1a8f52' : '#b2453c';
  const bg = open ? '#e8f7ee' : '#fdecea';

  if (compact) {
    return (
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <Text style={[styles.pillText, { color: tint }]}>{open ? 'Open' : 'Closed'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <Text style={[styles.pillText, { color: tint }]}>{detail}</Text>
      </View>
      {!!todayLabel && <Text style={styles.today}>Today: {todayLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  today: { fontSize: 12, color: '#777' },
});
