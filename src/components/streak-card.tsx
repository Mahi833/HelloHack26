import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Space, Surface, Type } from '@/constants/design';

export type StreakDay = {
  label: string;
  met: boolean;
  isToday: boolean;
};

export type StreakCardProps = {
  current: number;
  best: number;
  recent: StreakDay[];
};

export const StreakCard = ({ current, best, recent }: StreakCardProps) => (
  <View style={[Surface.glass, styles.card]}>
    <View style={styles.top}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>STREAK</Text>
        <View style={styles.countRow}>
          <Text style={styles.count}>{current}</Text>
          <Text style={styles.countUnit}>{current === 1 ? 'day' : 'days'}</Text>
        </View>
        <Text style={styles.note}>
          {current === 0 ? 'Hit your goal today to start one' : `Best run ${best} ${best === 1 ? 'day' : 'days'}`}
        </Text>
      </View>

      <View style={styles.week}>
        {recent.map((day, index) => (
          <View key={`${day.label}-${index}`} style={styles.dayColumn}>
            <View
              style={[
                styles.dayDot,
                day.met && styles.dayDotMet,
                day.isToday && styles.dayDotToday,
              ]}
            />
            <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>{day.label}</Text>
          </View>
        ))}
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: { marginTop: Space.md, padding: Space.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.lg },
  copy: { flexShrink: 1 },
  eyebrow: { ...Type.eyebrow, color: Palette.inkFaint },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: Space.xs, marginTop: Space.sm },
  count: { ...Type.display, fontSize: 40, lineHeight: 44, color: Palette.waterDeep },
  countUnit: { ...Type.body, color: Palette.inkMuted },
  note: { ...Type.caption, color: Palette.inkFaint, marginTop: Space.xs },
  week: { flexDirection: 'row', gap: 7 },
  dayColumn: { alignItems: 'center', gap: 6 },
  dayDot: {
    width: 13,
    height: 13,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  dayDotMet: { backgroundColor: Palette.water, borderColor: Palette.water },
  dayDotToday: { borderWidth: 2, borderColor: Palette.accent },
  dayLabel: { ...Type.caption, fontSize: 9, color: Palette.inkFaint },
  dayLabelToday: { color: Palette.accent, fontWeight: '700' },
});
