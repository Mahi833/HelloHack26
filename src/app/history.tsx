import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LastDrinkPlaceholder } from '@/components/last-drink-placeholder';
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
  const { ready, dailyGoalMl, lastDrinkAt, dayTotals, eventsSince } = useHydrationStore();
  const [range, setRange] = useState<Range>('Past week');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [startText, setStartText] = useState(() => localDayKey(Date.now() - 6 * 86400000));
  const [endText, setEndText] = useState(() => localDayKey(Date.now()));

  const now = useClock();
  const todayKey = localDayKey(now);
  const minutesSinceDrink =
    lastDrinkAt === null ? null : Math.max(0, Math.floor((now - lastDrinkAt) / 60000));

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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LastDrinkPlaceholder minutesSinceDrink={minutesSinceDrink} />

        <View style={styles.filterWrap}>
          <Pressable style={styles.rangeButton} onPress={() => setRangeMenuOpen((open) => !open)} accessibilityRole="button">
            <Text style={styles.rangeButtonText}>{range}</Text>
            <Text style={styles.chevron}>{rangeMenuOpen ? '⌃' : '⌄'}</Text>
          </Pressable>
          {rangeMenuOpen && (
            <View style={styles.menu}>
              {RANGES.map((option) => (
                <Pressable key={option} onPress={() => { setRange(option); setRangeMenuOpen(false); }} style={styles.menuItem}>
                  <Text style={[styles.menuText, range === option && styles.menuTextSelected]}>{option}</Text>
                  {range === option && <Text style={styles.check}>✓</Text>}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {range === 'Custom range' && (
          <View style={styles.customRange}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>FROM</Text>
              <TextInput value={startText} onChangeText={setStartText} placeholder="YYYY-MM-DD" style={styles.dateInput} accessibilityLabel="Start date, YYYY-MM-DD" />
            </View>
            <Text style={styles.dateSeparator}>–</Text>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>TO</Text>
              <TextInput value={endText} onChangeText={setEndText} placeholder="YYYY-MM-DD" style={styles.dateInput} accessibilityLabel="End date, YYYY-MM-DD" />
            </View>
          </View>
        )}

        <View style={styles.chartCard}>
          <View style={styles.chartHeading}>
            <View>
              <Text style={styles.cardEyebrow}>DAILY AVERAGE</Text>
              <Text style={styles.average}>{average.toLocaleString()} <Text style={styles.averageUnit}>ml</Text></Text>
            </View>
            <View style={styles.goalTag}><View style={styles.goalDot} /><Text style={styles.goalLabel}>{dailyGoalMl.toLocaleString()} ml goal</Text></View>
          </View>

          <View style={styles.chart}>
            <View style={styles.gridLine} />
            <View style={[styles.gridLine, styles.gridLineMiddle]} />
            {chartRecords.length === 0 ? (
              <Text style={styles.chartEmpty}>{ready ? 'No water logged in this range yet.' : 'Loading your saved drinks…'}</Text>
            ) : (
              <View style={styles.barRow}>
                {chartRecords.map((item, index) => (
                  <View key={`${item.label}-${index}`} style={styles.barColumn}>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: `${Math.max(8, Math.min(item.amount / maxChartAmount, 1) * 100)}%` }, index === chartRecords.length - 1 && styles.barLatest]} />
                    </View>
                    <Text style={styles.barLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={styles.chartFootnote}>
            <View style={styles.legend}><View style={styles.legendDot} /><Text style={styles.legendText}>Water intake</Text></View>
            <Text style={styles.recordCount}>{visibleRecords.length} {visibleRecords.length === 1 ? 'record' : 'records'}</Text>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Daily records</Text>
          <Text style={styles.listCaption}>{range === 'Custom range' ? `${startText} – ${endText}` : range}</Text>
        </View>
        <View style={styles.recordsCard}>
          {visibleRecords.length === 0 ? (
            <Text style={styles.emptyState}>{ready ? 'No records in this date range.' : 'Loading your saved drinks…'}</Text>
          ) : visibleRecords.map(({ day, ml }, index) => (
            <View key={day} style={[styles.recordRow, index === visibleRecords.length - 1 && styles.lastRecordRow]}>
              <View style={styles.recordIcon}><Text style={styles.recordDrop}>●</Text></View>
              <View style={styles.recordDetails}>
                <Text style={styles.recordDay}>{day === todayKey ? 'Today' : formatDay(day, { weekday: 'long' })}</Text>
                <Text style={styles.recordDate}>{formatDay(day, { month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={styles.recordTotal}>
                <Text style={styles.recordAmount}>{ml.toLocaleString()} ml</Text>
                <Text style={styles.recordGoal}>{dailyGoalMl > 0 ? Math.round((ml / dailyGoalMl) * 100) : 0}% of goal</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4FAFC' },
  content: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 36, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 23 },
  eyebrow: { color: '#7D9EAD', fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  title: { color: '#163D52', fontSize: 30, lineHeight: 37, fontWeight: '700', marginTop: 4, letterSpacing: -0.8 },
  headerIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2F3F8' },
  headerIconText: { fontSize: 22, color: '#4BA5C0' },
  filterWrap: { zIndex: 2, alignSelf: 'flex-start', marginBottom: 16 },
  rangeButton: { minWidth: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 43, borderRadius: 14, backgroundColor: '#FFFFFF', borderColor: '#BBD6DE', borderWidth: 1 },
  rangeButtonText: { color: '#326277', fontSize: 13, fontWeight: '600' },
  chevron: { color: '#76A9B8', fontSize: 17, marginLeft: 15, marginTop: -3 },
  menu: { position: 'absolute', top: 49, left: 0, width: 190, padding: 6, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BBD6DE', shadowColor: '#386678', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  menuItem: { minHeight: 42, paddingHorizontal: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuText: { color: '#668793', fontSize: 13 },
  menuTextSelected: { color: '#287E9B', fontWeight: '700' },
  check: { color: '#44A6C3', fontWeight: '700' },
  customRange: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: -3, marginBottom: 16 },
  dateField: { flex: 1, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, backgroundColor: '#FFFFFF', borderColor: '#BBD6DE', borderWidth: 1 },
  dateLabel: { color: '#8EABB5', fontSize: 9, letterSpacing: 1, fontWeight: '700', marginBottom: 5 },
  dateInput: { color: '#326277', fontSize: 12, padding: 0, minHeight: 18 },
  dateSeparator: { color: '#8EABB5' },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#C2DAE1' },
  chartHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardEyebrow: { color: '#85A5B0', fontSize: 9, letterSpacing: 1.3, fontWeight: '700' },
  average: { color: '#1D526A', fontSize: 28, fontWeight: '700', marginTop: 5, letterSpacing: -0.6 },
  averageUnit: { color: '#81A6B2', fontSize: 13, fontWeight: '500' },
  goalTag: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#F0F8FA', borderWidth: 1, borderColor: '#C7DDE3' },
  goalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9CCBD8', marginRight: 6 },
  goalLabel: { color: '#7495A1', fontSize: 10, fontWeight: '600' },
  chart: { height: 174, marginTop: 19, position: 'relative', justifyContent: 'flex-end' },
  chartEmpty: { height: 150, paddingTop: 62, textAlign: 'center', color: '#91AAB4', fontSize: 13 },
  gridLine: { position: 'absolute', left: 0, right: 0, top: 24, height: 1, backgroundColor: '#EFF5F7' },
  gridLineMiddle: { top: 91 },
  barRow: { height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: 22, height: 120, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 8, backgroundColor: '#F1F8FA', borderWidth: 1, borderColor: '#D5E6EB' },
  bar: { width: '100%', borderRadius: 8, backgroundColor: '#A9DCE8' },
  barLatest: { backgroundColor: '#48A8C5' },
  barLabel: { color: '#91AAB4', fontSize: 9, marginTop: 8 },
  chartFootnote: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  legend: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#48A8C5', marginRight: 7 },
  legendText: { color: '#829FAA', fontSize: 10 },
  recordCount: { color: '#9BB0B8', fontSize: 10 },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 27, marginBottom: 12 },
  listTitle: { color: '#183F53', fontSize: 19, fontWeight: '700' },
  listCaption: { color: '#91AAB4', fontSize: 10 },
  recordsCard: { paddingHorizontal: 15, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C2DAE1' },
  recordRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F5F7' },
  lastRecordRow: { borderBottomWidth: 0 },
  recordIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF8FA', borderWidth: 1, borderColor: '#C4DFE6' },
  recordDrop: { color: '#55ABC4', fontSize: 12 },
  recordDetails: { flex: 1, marginLeft: 11 },
  recordDay: { color: '#355D6E', fontSize: 13, fontWeight: '600' },
  recordDate: { color: '#9BB0B8', fontSize: 10, marginTop: 4 },
  recordTotal: { alignItems: 'flex-end' },
  recordAmount: { color: '#326277', fontSize: 13, fontWeight: '700' },
  recordGoal: { color: '#91AAB4', fontSize: 10, marginTop: 4 },
  emptyState: { textAlign: 'center', color: '#91AAB4', paddingVertical: 25, fontSize: 13 },
});
