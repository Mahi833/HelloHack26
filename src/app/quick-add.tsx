import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LastDrinkPlaceholder } from '@/components/last-drink-placeholder';
import { useClock, useHydrationStore } from '@/store/hydration-store';

const SERVINGS = [
  { amount: 150, label: 'Small' },
  { amount: 250, label: 'Glass' },
  { amount: 350, label: 'Large' },
];

export default function QuickAddScreen() {
  const { todayMl, dailyGoalMl, lastDrinkAt, addDrink } = useHydrationStore();
  const now = useClock();
  const minutesSinceDrink =
    lastDrinkAt === null ? null : Math.max(0, Math.floor((now - lastDrinkAt) / 60000));

  const logServing = (amount: number) => {
    addDrink(amount, 'manual').catch((error: unknown) =>
      console.warn('Could not save that drink', error),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LastDrinkPlaceholder minutesSinceDrink={minutesSinceDrink} />

        <Text style={styles.eyebrow}>LOG A DRINK</Text>
        <Text style={styles.title}>Quick add</Text>
        <Text style={styles.subtitle}>Choose a serving to add it to today&apos;s water total.</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TODAY&apos;S INTAKE</Text>
          <Text style={styles.totalValue}>{todayMl.toLocaleString()} <Text style={styles.totalUnit}>ml</Text></Text>
          <Text style={styles.goalText}>Daily goal: {dailyGoalMl.toLocaleString()} ml</Text>
        </View>

        <View style={styles.servings}>
          {SERVINGS.map(({ amount, label }, index) => (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityLabel={`Add ${amount} milliliters of water`}
              onPress={() => logServing(amount)}
              style={({ pressed }) => [styles.serving, pressed && styles.pressed]}>
              <View style={[styles.glass, index === 1 && styles.glassSelected]}>
                <View style={[styles.water, { height: `${35 + index * 18}%` }]} />
              </View>
              <Text style={styles.amount}>{amount} ml</Text>
              <Text style={styles.label}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.hint}>Tap a serving to add it to your daily intake.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4FAFC' },
  content: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 38, maxWidth: 560, width: '100%', alignSelf: 'center' },
  eyebrow: { color: '#7D9EAD', fontSize: 10, letterSpacing: 1.4, fontWeight: '700', marginTop: 7 },
  title: { color: '#163D52', fontSize: 30, lineHeight: 37, fontWeight: '700', marginTop: 4, letterSpacing: -0.8 },
  subtitle: { color: '#7797A4', fontSize: 13, lineHeight: 19, marginTop: 6 },
  totalCard: { marginTop: 25, padding: 22, borderRadius: 24, backgroundColor: '#DDF3FA', borderWidth: 1, borderColor: '#B9DEE9' },
  totalLabel: { color: '#5793A8', fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  totalValue: { color: '#176C8C', fontSize: 36, fontWeight: '700', letterSpacing: -1, marginTop: 7 },
  totalUnit: { color: '#54859A', fontSize: 16, fontWeight: '500' },
  goalText: { color: '#6B96A6', fontSize: 12, marginTop: 3 },
  servings: { flexDirection: 'row', gap: 12, marginTop: 22 },
  serving: { flex: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9DDE3' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  glass: { width: 34, height: 42, borderWidth: 2, borderColor: '#A6D7E4', borderTopWidth: 0, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, overflow: 'hidden', justifyContent: 'flex-end' },
  glassSelected: { borderColor: '#62B6D0' },
  water: { width: '100%', backgroundColor: '#B5E5F0' },
  amount: { color: '#326277', fontSize: 14, fontWeight: '700', marginTop: 13 },
  label: { color: '#9AB0B9', fontSize: 11, marginTop: 4 },
  hint: { color: '#91AAB4', fontSize: 12, textAlign: 'center', marginTop: 20 },
});
