import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/components/screen-background';
import { ScreenHeader } from '@/components/screen-header';
import { Palette, Radius, Space, Surface, Type } from '@/constants/design';
import { useClock, useHydrationStore } from '@/store/hydration-store';
import { localDayKey } from '@/store/types';

type Range = 'Past day' | 'Past week' | 'Past month' | 'Custom range';
type ChartBar = { label: string; amount: number };

const RANGES: Range[] = ['Past day', 'Past week', 'Past month', 'Custom range'];
const DAYS_BACK: Record<Exclude<Range, 'Custom range'>, number> = {
  'Past day': 1,
  'Past week': 6,
  'Past month': 29,
};
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_BUCKET_COUNT = 8;
const HOUR_BUCKET_MS = 3 * 60 * 60 * 1000;
const CHART_BAR_LIMIT = 7;

const startOfDay = (at: number) => {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const dayKeyToDate = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
};
const formatDay = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en', options).format(dayKeyToDate(day));
const formatHour = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'a' : 'p'}`;
const isDayKey = (value: string) =>
  DAY_KEY_PATTERN.test(value) && !Number.isNaN(dayKeyToDate(value).getTime());

export default function HistoryScreen() {
  const { ready, dailyGoalMl, dayTotals, eventsSince } = useHydrationStore();
  const [range, setRange] = useState<Range>('Past week');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [startText, setStartText] = useState(() => localDayKey(Date.now() - 6 * 86400000));
  const [endText, setEndText] = useState(() => localDayKey(Date.now()));

  const now = useClock();
  const todayKey = localDayKey(now);

  const visibleRecords = useMemo(() => {
    if (range === 'Custom range') {
      if (!isDayKey(startText) || !isDayKey(endText) || startText > endText) return [];
      return dayTotals(startText, endText);
    }
    const start = startOfDay(now);
    start.setDate(start.getDate() - DAYS_BACK[range]);
    return dayTotals(localDayKey(start.getTime()), localDayKey(now));
  }, [range, startText, endText, dayTotals, now]);

  const chartRecords = useMemo<ChartBar[]>(() => {
    if (range !== 'Past day') {
      return visibleRecords
        .slice(-CHART_BAR_LIMIT)
        .map(({ day, ml }) => ({ label: formatDay(day, { weekday: 'short' }), amount: ml }));
    }
    const dayStart = startOfDay(now).getTime();
    const events = eventsSince(dayStart);
    if (events.length === 0) return [];
    return Array.from({ length: HOUR_BUCKET_COUNT }, (_, index) => {
      const bucketEnd = dayStart + (index + 1) * HOUR_BUCKET_MS;
      return {
        label: formatHour(new Date(dayStart + index * HOUR_BUCKET_MS).getHours()),
        amount: events.reduce((sum, event) => (event.at < bucketEnd ? sum + event.ml : sum), 0),
      };
    });
  }, [range, visibleRecords, eventsSince, now]);

  const average = visibleRecords.length
    ? Math.round(visibleRecords.reduce((sum, item) => sum + item.ml, 0) / visibleRecords.length)
    : 0;
  const maxChartAmount = Math.max(dailyGoalMl, ...chartRecords.map((item) => item.amount));

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader subtitle="Your intake" title="History" />

          <View style={styles.filterWrap}>
            <Pressable
              style={({ pressed }) => [Surface.glassStrong, styles.rangeButton, pressed && styles.pressed]}
              onPress={() => setRangeMenuOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: rangeMenuOpen }}>
              <Text style={styles.rangeButtonText}>{range}</Text>
              <Text style={styles.chevron}>{rangeMenuOpen ? '‹' : '›'}</Text>
            </Pressable>
            {rangeMenuOpen && (
              <View style={[Surface.glassStrong, styles.menu]}>
                {RANGES.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setRange(option);
                      setRangeMenuOpen(false);
                    }}
                    style={styles.menuItem}>
                    <Text style={[styles.menuText, range === option && styles.menuTextSelected]}>{option}</Text>
                    {range === option && <Text style={styles.check}>{'✓'}</Text>}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {range === 'Custom range' && (
            <View style={styles.customRange}>
              <View style={[Surface.glassStrong, styles.dateField]}>
                <Text style={styles.dateLabel}>FROM</Text>
                <TextInput
                  value={startText}
                  onChangeText={setStartText}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Palette.inkFaint}
                  style={styles.dateInput}
                  accessibilityLabel="Start date, YYYY-MM-DD"
                />
              </View>
              <Text style={styles.dateSeparator}>{'–'}</Text>
              <View style={[Surface.glassStrong, styles.dateField]}>
                <Text style={styles.dateLabel}>TO</Text>
                <TextInput
                  value={endText}
                  onChangeText={setEndText}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Palette.inkFaint}
                  style={styles.dateInput}
                  accessibilityLabel="End date, YYYY-MM-DD"
                />
              </View>
            </View>
          )}

          <View style={[Surface.glass, styles.chartCard]}>
            <View style={styles.chartHeading}>
              <View>
                <Text style={styles.cardEyebrow}>DAILY AVERAGE</Text>
                <Text style={styles.average}>
                  {average.toLocaleString()} <Text style={styles.averageUnit}>ml</Text>
                </Text>
              </View>
              <View style={[Surface.glassTint, styles.goalTag]}>
                <View style={styles.goalDot} />
                <Text style={styles.goalLabel}>{dailyGoalMl.toLocaleString()} ml goal</Text>
              </View>
            </View>

            <View style={styles.chart}>
              <View style={styles.gridLine} />
              <View style={[styles.gridLine, styles.gridLineMiddle]} />
              {chartRecords.length === 0 ? (
                <Text style={styles.chartEmpty}>
                  {ready ? 'No water logged in this range yet.' : 'Loading your saved drinks'}
                </Text>
              ) : (
                <View style={styles.barRow}>
                  {chartRecords.map((item, index) => (
                    <View key={`${item.label}-${index}`} style={styles.barColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            { height: `${Math.max(8, Math.min(item.amount / maxChartAmount, 1) * 100)}%` },
                            index === chartRecords.length - 1 && styles.barLatest,
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.chartFootnote}>
              <View style={styles.legend}>
                <View style={styles.legendDot} />
                <Text style={styles.legendText}>Water intake</Text>
              </View>
              <Text style={styles.recordCount}>
                {visibleRecords.length} {visibleRecords.length === 1 ? 'record' : 'records'}
              </Text>
            </View>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Daily records</Text>
            <Text style={styles.listCaption}>
              {range === 'Custom range' ? `${startText} to ${endText}` : range}
            </Text>
          </View>
          <View style={[Surface.glass, styles.recordsCard]}>
            {visibleRecords.length === 0 ? (
              <Text style={styles.emptyState}>
                {ready ? 'No records in this date range.' : 'Loading your saved drinks'}
              </Text>
            ) : (
              visibleRecords.map(({ day, ml }, index) => (
                <View
                  key={day}
                  style={[styles.recordRow, index === visibleRecords.length - 1 && styles.lastRecordRow]}>
                  <View style={styles.recordIcon}>
                    <View style={styles.recordDrop} />
                  </View>
                  <View style={styles.recordDetails}>
                    <Text style={styles.recordDay}>
                      {day === todayKey ? 'Today' : formatDay(day, { weekday: 'long' })}
                    </Text>
                    <Text style={styles.recordDate}>{formatDay(day, { month: 'short', day: 'numeric' })}</Text>
                  </View>
                  <View style={styles.recordTotal}>
                    <Text style={styles.recordAmount}>{ml.toLocaleString()} ml</Text>
                    <Text style={styles.recordGoal}>
                      {dailyGoalMl > 0 ? Math.round((ml / dailyGoalMl) * 100) : 0}% of goal
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: Space.xl, paddingTop: Space.lg, paddingBottom: 36, maxWidth: 560, width: '100%', alignSelf: 'center' },
  pressed: { opacity: 0.75 },
  filterWrap: { zIndex: 2, alignSelf: 'flex-start', marginBottom: Space.lg },
  rangeButton: { minWidth: 160, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.lg, height: 44, borderRadius: Radius.medium },
  rangeButtonText: { ...Type.callout, color: Palette.inkSoft },
  chevron: { ...Type.callout, color: Palette.accent, marginLeft: Space.md, transform: [{ rotate: '90deg' }] },
  menu: { position: 'absolute', top: 50, left: 0, width: 196, padding: 6, borderRadius: Radius.medium },
  menuItem: { minHeight: 42, paddingHorizontal: Space.md, borderRadius: Radius.small, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuText: { ...Type.callout, color: Palette.inkMuted, fontWeight: '500' },
  menuTextSelected: { color: Palette.accent, fontWeight: '700' },
  check: { ...Type.callout, color: Palette.water, fontWeight: '700' },
  customRange: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.lg },
  dateField: { flex: 1, paddingHorizontal: Space.md, paddingVertical: Space.sm, borderRadius: Radius.small },
  dateLabel: { ...Type.eyebrow, fontSize: 9, color: Palette.inkFaint, marginBottom: 4 },
  dateInput: { ...Type.caption, color: Palette.inkSoft, padding: 0, minHeight: 18 },
  dateSeparator: { ...Type.caption, color: Palette.inkFaint },
  chartCard: { padding: Space.xl },
  chartHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardEyebrow: { ...Type.eyebrow, fontSize: 9, color: Palette.inkFaint },
  average: { ...Type.title, color: Palette.waterDeep, marginTop: Space.xs },
  averageUnit: { ...Type.callout, color: Palette.inkMuted },
  goalTag: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.small, paddingHorizontal: Space.sm, paddingVertical: 7 },
  goalDot: { width: 7, height: 7, borderRadius: Radius.pill, backgroundColor: Palette.water, marginRight: 6 },
  goalLabel: { ...Type.caption, color: Palette.inkSoft, fontWeight: '600' },
  chart: { height: 174, marginTop: Space.xl, position: 'relative', justifyContent: 'flex-end' },
  chartEmpty: { ...Type.callout, height: 150, paddingTop: 62, textAlign: 'center', color: Palette.inkFaint },
  gridLine: { position: 'absolute', left: 0, right: 0, top: 24, height: StyleSheet.hairlineWidth, backgroundColor: Palette.border },
  gridLineMiddle: { top: 91 },
  barRow: { height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: 22, height: 120, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: Radius.small, backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  bar: { width: '100%', borderRadius: Radius.small, backgroundColor: Palette.waterSoft },
  barLatest: { backgroundColor: Palette.water },
  barLabel: { ...Type.caption, fontSize: 9, color: Palette.inkFaint, marginTop: Space.sm },
  chartFootnote: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space.md },
  legend: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Palette.water, marginRight: 7 },
  legendText: { ...Type.caption, color: Palette.inkMuted },
  recordCount: { ...Type.caption, color: Palette.inkFaint },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: Space.xxl, marginBottom: Space.md },
  listTitle: { ...Type.heading, color: Palette.ink },
  listCaption: { ...Type.caption, color: Palette.inkFaint },
  recordsCard: { paddingHorizontal: Space.lg },
  recordRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  lastRecordRow: { borderBottomWidth: 0 },
  recordIcon: { width: 36, height: 36, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  recordDrop: { width: 10, height: 10, borderRadius: Radius.pill, backgroundColor: Palette.water },
  recordDetails: { flex: 1, marginLeft: Space.md },
  recordDay: { ...Type.callout, color: Palette.inkSoft },
  recordDate: { ...Type.caption, color: Palette.inkFaint, marginTop: 3 },
  recordTotal: { alignItems: 'flex-end' },
  recordAmount: { ...Type.callout, color: Palette.waterDeep, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordGoal: { ...Type.caption, color: Palette.inkFaint, marginTop: 3 },
  emptyState: { ...Type.callout, textAlign: 'center', color: Palette.inkFaint, paddingVertical: 25 },
});
