import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LastDrinkPlaceholder } from '@/components/last-drink-placeholder';
import { useHydrationDevState } from '@/contexts/hydration-dev-state';

type Range = 'Past day' | 'Past week' | 'Past month' | 'Custom range';
type RecordItem = { date: Date; amount: number };

const GOAL = 2000;
const RANGES: Range[] = ['Past day', 'Past week', 'Past month', 'Custom range'];
const today = new Date();
const records: RecordItem[] = Array.from({ length: 45 }, (_, index) => {
  const date = new Date(today);
  date.setDate(today.getDate() - index);
  // Seeded sample records make the history chart useful before real data storage is connected.
  const amount = 1250 + ((index * 379 + 263) % 1250);
  return { date, amount };
});
const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en', options).format(date);
const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HistoryScreen() {
  const [range, setRange] = useState<Range>('Past week');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [startText, setStartText] = useState(toDateInput(new Date(today.getTime() - 6 * 86400000)));
  const [endText, setEndText] = useState(toDateInput(today));
  const { waterDrank, minutesSinceDrink } = useHydrationDevState();

  const visibleRecords = useMemo(() => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    if (range === 'Past day') start.setDate(start.getDate() - 1);
    if (range === 'Past week') start.setDate(start.getDate() - 6);
    if (range === 'Past month') start.setDate(start.getDate() - 29);
    let filteredRecords = records.filter(({ date }) => date >= start);
    if (range === 'Custom range') {
      const customStart = new Date(`${startText}T00:00:00`);
      const customEnd = new Date(`${endText}T23:59:59`);
      if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
        filteredRecords = records.filter(({ date }) => date >= customStart && date <= customEnd);
      } else {
        filteredRecords = [];
      }
    }
    return filteredRecords.map((record) => ({
      ...record,
      amount: toDateInput(record.date) === toDateInput(today) ? waterDrank : record.amount,
    })).reverse();
  }, [range, startText, endText, waterDrank]);

  const chartRecords = range === 'Past day'
    ? [
        { label: '6a', amount: 200 }, { label: '9a', amount: 500 }, { label: '12p', amount: 800 },
        { label: '3p', amount: 1150 }, { label: '6p', amount: 1450 }, { label: '9p', amount: 1700 },
      ]
    : visibleRecords.slice(-7).map(({ date, amount }) => ({ label: formatDate(date, { weekday: 'short' }), amount }));
  const average = visibleRecords.length
    ? Math.round(visibleRecords.reduce((sum, item) => sum + item.amount, 0) / visibleRecords.length)
    : 0;
  const maxChartAmount = Math.max(GOAL, ...chartRecords.map((item) => item.amount));

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
            <Text style={styles.dateSeparator}>—</Text>
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
            <View style={styles.goalTag}><View style={styles.goalDot} /><Text style={styles.goalLabel}>2,000 ml goal</Text></View>
          </View>

          <View style={styles.chart}>
            <View style={styles.gridLine} />
            <View style={[styles.gridLine, styles.gridLineMiddle]} />
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
            <Text style={styles.emptyState}>No records in this date range.</Text>
          ) : visibleRecords.map(({ date, amount }, index) => (
            <View key={toDateInput(date)} style={[styles.recordRow, index === visibleRecords.length - 1 && styles.lastRecordRow]}>
              <View style={styles.recordIcon}><Text style={styles.recordDrop}>●</Text></View>
              <View style={styles.recordDetails}>
                <Text style={styles.recordDay}>{index === visibleRecords.length - 1 && toDateInput(date) === toDateInput(today) ? 'Today' : formatDate(date, { weekday: 'long' })}</Text>
                <Text style={styles.recordDate}>{formatDate(date, { month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={styles.recordTotal}>
                <Text style={styles.recordAmount}>{amount.toLocaleString()} ml</Text>
                <Text style={styles.recordGoal}>{Math.round((amount / GOAL) * 100)}% of goal</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.sampleNote}>Sample history shown until intake tracking is connected to saved records.</Text>
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
  sampleNote: { textAlign: 'center', color: '#A0B4BC', fontSize: 10, lineHeight: 15, marginTop: 14, paddingHorizontal: 12 },
});
