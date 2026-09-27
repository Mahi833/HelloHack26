import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LastDrinkPlaceholder } from '@/components/last-drink-placeholder';
import { useHydrationDevState } from '@/contexts/hydration-dev-state';
import { useIcupBle } from '@/contexts/icup-ble-context';

export default function HomeScreen() {
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [sipRemindersEnabled, setSipRemindersEnabled] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('Get a gentle reminder every 2 minutes.');
  const icupBle = useIcupBle();
  const {
    waterDrank,
    setWaterDrank,
    dailyGoal,
    setDailyGoal,
    minutesSinceDrink,
    setMinutesSinceDrink,
    isICupConnected,
    setIsICupConnected,
    icupBattery,
    setICupBattery,
  } = useHydrationDevState();
  const progress = dailyGoal > 0 ? Math.min(waterDrank / dailyGoal, 1) : 0;
  const remaining = Math.max(dailyGoal - waterDrank, 0);
  const bluetoothConnected = icupBle.isConnected || (__DEV__ && isICupConnected);

  useEffect(() => {
    let mounted = true;
    Notifications.getAllScheduledNotificationsAsync()
      .then((scheduled) => {
        const enabled = scheduled.some((item) => item.content.data?.kind === 'sip-reminder');
        if (mounted) setSipRemindersEnabled(enabled);
      })
      .catch(() => {
        if (mounted) setReminderMessage('Notifications are unavailable on this device.');
      });
    return () => { mounted = false; };
  }, []);

  const setSipReminders = async (enabled: boolean) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      if (enabled) {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('sip-reminders', {
            name: 'Sip reminders',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) {
          setSipRemindersEnabled(false);
          setReminderMessage('Allow notifications in Settings to turn on sip reminders.');
          return;
        }
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        await Promise.all(scheduled
          .filter((item) => item.content.data?.kind === 'sip-reminder')
          .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Time for a sip!',
            body: 'Take a moment to drink some water.',
            data: { kind: 'sip-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 120,
            repeats: true,
            ...(Platform.OS === 'android' ? { channelId: 'sip-reminders' } : {}),
          },
        });
        setSipRemindersEnabled(true);
        setReminderMessage('You’ll get “Time for a sip!” every 2 minutes.');
      } else {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        await Promise.all(scheduled
          .filter((item) => item.content.data?.kind === 'sip-reminder')
          .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
        setSipRemindersEnabled(false);
        setReminderMessage('Sip reminders are off.');
      }
    } catch {
      setReminderMessage('Could not update reminders. Please try again.');
      setSipRemindersEnabled(false);
    } finally {
      setReminderBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LastDrinkPlaceholder minutesSinceDrink={minutesSinceDrink} />

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.cardTitle}>TODAY&apos;S PROGRESS</Text>
            </View>
          </View>

          <View style={styles.fractionRow}>
            <Text style={styles.drunk}>{waterDrank.toLocaleString()}</Text>
            <Text style={styles.slash}>/</Text>
            <Text style={styles.goal}>{dailyGoal.toLocaleString()}</Text>
            <Text style={styles.unit}>ml</Text>
          </View>
          <Text style={styles.caption}>drank <Text style={styles.captionDot}>·</Text> daily goal</Text>

          <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressPercent}>{Math.round(progress * 100)}% of your goal</Text>
            <Text style={styles.remaining}>{remaining === 0 ? 'Goal reached!' : `${remaining.toLocaleString()} ml to go`}</Text>
          </View>
        </View>

        <View style={styles.connectionRow}>
          <View
            style={[styles.bluetoothBubble, bluetoothConnected ? styles.bluetoothBubbleConnected : styles.bluetoothBubbleDisconnected]}
            accessibilityRole="text"
            accessibilityLabel={`iCup Bluetooth is ${bluetoothConnected ? 'connected' : 'not connected'}`}>
            <Image
              source={require('@/assets/images/icup-bluetooth-badge.png')}
              resizeMode="contain"
              style={styles.bluetoothImage}
              accessibilityLabel="Bluetooth"
            />
            <View style={styles.connectionCopy}>
              <Text style={styles.connectionTitle}>Bluetooth</Text>
              <View style={styles.connectionStateLine}>
                <View style={[styles.statusDot, bluetoothConnected ? styles.connectedDot : styles.disconnectedDot]} />
                <Text style={[styles.connectionStatusText, bluetoothConnected && styles.connectedStatusText]}>
                  {bluetoothConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.batteryBubble} accessibilityRole="text" accessibilityLabel={`iCup battery ${icupBattery} percent`}>
            <View style={styles.batteryIcon}>
              <View style={styles.batteryCap} />
              <View style={styles.batteryOutline}>
                <View style={[styles.batteryFill, { width: `${icupBattery}%` }, icupBattery <= 20 && styles.batteryFillLow]} />
              </View>
            </View>
            <View>
              <Text style={styles.batteryLabel}>Battery</Text>
              <Text style={styles.batteryValue}>{icupBattery}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.bleControlCard}>
          <View style={styles.bleControlCopy}>
            <Text style={styles.bleControlTitle}>
              {icupBle.latestWeightGrams === null ? 'iCup live scale' : `${icupBle.latestWeightGrams.toFixed(1)} g`}
            </Text>
            <Text style={styles.bleControlMessage}>{icupBle.message}</Text>
          </View>
          <View style={styles.bleControlActions}>
            {icupBle.isConnected && (
              <Pressable accessibilityRole="button" onPress={() => void icupBle.tare()} style={styles.tareButton}>
                <Text style={styles.tareButtonText}>Tare</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={icupBle.isWorking}
              onPress={() => void (icupBle.isConnected ? icupBle.disconnect() : icupBle.connect())}
              style={[styles.bleConnectButton, icupBle.isConnected && styles.bleDisconnectButton, icupBle.isWorking && styles.bleButtonDisabled]}>
              {icupBle.isWorking ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.bleConnectButtonText}>{icupBle.isConnected ? 'Disconnect' : 'Connect'}</Text>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.reminderCard}>
          <View style={styles.reminderCopy}>
            <Text style={styles.reminderTitle}>Sip reminders</Text>
            <Text style={styles.reminderDescription}>{reminderMessage}</Text>
          </View>
          {reminderBusy ? (
            <ActivityIndicator color="#3188A8" />
          ) : (
            <Switch
              accessibilityLabel="Sip reminders every 2 minutes"
              value={sipRemindersEnabled}
              onValueChange={setSipReminders}
              trackColor={{ false: '#C5D5DB', true: '#8AC7A1' }}
              thumbColor={sipRemindersEnabled ? '#FFFFFF' : '#FFFFFF'}
            />
          )}
        </View>

        {__DEV__ && (
          <View style={styles.devPanel}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: devPanelOpen }}
              onPress={() => setDevPanelOpen((open) => !open)}
              style={styles.devPanelHeader}>
              <Text style={styles.devBadge}>DEV</Text>
              <Text style={styles.devPanelTitle}>Developer controls</Text>
              <Text style={styles.devChevron}>{devPanelOpen ? '−' : '+'}</Text>
            </Pressable>
            {devPanelOpen && (
              <View style={styles.devPanelContent}>
                <DevControlRow
                  label="Time since last drink"
                  value={minutesSinceDrink}
                  unit="min"
                  onDecrease={() => setMinutesSinceDrink((value) => Math.max(0, value - 5))}
                  onIncrease={() => setMinutesSinceDrink((value) => value + 5)}
                />
                <DevControlRow
                  label="Water drank today"
                  value={waterDrank}
                  unit="ml"
                  onDecrease={() => setWaterDrank((value) => Math.max(0, value - 250))}
                  onIncrease={() => setWaterDrank((value) => value + 250)}
                />
                <DevControlRow
                  label="Daily water goal"
                  value={dailyGoal}
                  unit="ml"
                  onDecrease={() => setDailyGoal((value) => Math.max(250, value - 250))}
                  onIncrease={() => setDailyGoal((value) => value + 250)}
                />
                <DevControlRow
                  label="iCup battery"
                  value={icupBattery}
                  unit="%"
                  onDecrease={() => setICupBattery((value) => Math.max(0, value - 10))}
                  onIncrease={() => setICupBattery((value) => Math.min(100, value + 10))}
                />
                <View style={styles.devBluetoothRow}>
                  <Text style={styles.devLabel}>iCup Bluetooth</Text>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: isICupConnected }}
                    onPress={() => setIsICupConnected((connected) => !connected)}
                    style={[styles.devToggle, isICupConnected && styles.devToggleOn]}>
                    <Text style={styles.devToggleText}>{isICupConnected ? 'Connected' : 'Disconnected'}</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => {
                    setMinutesSinceDrink(32);
                    setWaterDrank(1250);
                    setDailyGoal(2000);
                    setIsICupConnected(false);
                    setICupBattery(82);
                  }}
                  style={styles.resetButton}>
                  <Text style={styles.resetText}>Reset sample values</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DevControlRow({
  label,
  value,
  unit,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  unit: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.devRow}>
      <Text style={styles.devLabel}>{label}</Text>
      <View style={styles.devValueControls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={onDecrease} style={styles.devStepButton}>
          <Text style={styles.devStepText}>−</Text>
        </Pressable>
        <Text style={styles.devValue}>{value.toLocaleString()} {unit}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={onIncrease} style={styles.devStepButton}>
          <Text style={styles.devStepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4FAFC' },
  content: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 38, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  eyebrow: { color: '#7D9EAD', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  greeting: { color: '#163D52', fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 5, letterSpacing: -0.7 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2F3F8', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#429DBD', fontSize: 22 },
  summaryCard: { borderRadius: 28, backgroundColor: '#DDF3FA', padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#B9DEE9' },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardEyebrow: { color: '#5793A8', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  cardTitle: { color: '#163D52', fontSize: 17, fontWeight: '600', marginTop: 5 },
  dropBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#C6EAF5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#9FD3E2' },
  drop: { color: '#3188A8', fontSize: 16 },
  fractionRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 27 },
  drunk: { color: '#176C8C', fontSize: 52, lineHeight: 60, fontWeight: '700', letterSpacing: -2 },
  slash: { color: '#7BB3C7', fontSize: 36, marginHorizontal: 9, fontWeight: '300' },
  goal: { color: '#54859A', fontSize: 34, fontWeight: '500', letterSpacing: -1 },
  unit: { color: '#6E9AAA', fontSize: 15, marginLeft: 7, fontWeight: '600' },
  caption: { color: '#6795A6', fontSize: 12, marginTop: 2, marginBottom: 22 },
  captionDot: { color: '#A0C8D5' },
  progressTrack: { height: 10, borderRadius: 8, backgroundColor: '#C5E7F1', overflow: 'hidden', borderWidth: 1, borderColor: '#A9D6E3' },
  progressFill: { height: '100%', borderRadius: 8, backgroundColor: '#45A9C9' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 },
  progressPercent: { color: '#327E98', fontSize: 12, fontWeight: '700' },
  remaining: { color: '#6B96A6', fontSize: 12 },
  connectionRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 18 },
  bleControlCard: { minHeight: 76, marginTop: 14, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 19, backgroundColor: '#E7F5F9', borderWidth: 1, borderColor: '#BCDDE6' },
  bleControlCopy: { flex: 1 },
  bleControlTitle: { color: '#245267', fontSize: 14, fontWeight: '700' },
  bleControlMessage: { color: '#6E909D', fontSize: 10, marginTop: 4, lineHeight: 15 },
  bleControlActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bleConnectButton: { minWidth: 76, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#3188A8' },
  bleDisconnectButton: { backgroundColor: '#527582' },
  bleButtonDisabled: { opacity: 0.65 },
  bleConnectButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  tareButton: { minWidth: 50, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#A9CFDA' },
  tareButtonText: { color: '#327E98', fontSize: 11, fontWeight: '700' },
  reminderCard: { minHeight: 76, marginTop: 16, paddingHorizontal: 17, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 19, backgroundColor: '#E7F5F9', borderWidth: 1, borderColor: '#BCDDE6' },
  reminderCopy: { flex: 1, paddingRight: 12 },
  reminderTitle: { color: '#245267', fontSize: 14, fontWeight: '700' },
  reminderDescription: { color: '#6E909D', fontSize: 11, marginTop: 4, lineHeight: 16 },
  bluetoothBubble: { flex: 1, minWidth: 0, minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 19, borderWidth: 1 },
  bluetoothBubbleConnected: { backgroundColor: '#DDF3E6', borderColor: '#A9D7B8' },
  bluetoothBubbleDisconnected: { backgroundColor: '#FCE5E5', borderColor: '#E9B6B6' },
  bluetoothImage: { width: 44, height: 44 },
  connectionCopy: { marginLeft: 10, flex: 1 },
  connectionTitle: { color: '#245267', fontSize: 13, fontWeight: '700' },
  connectionStateLine: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  disconnectedDot: { backgroundColor: '#A7B8BE' },
  connectedDot: { backgroundColor: '#28A765' },
  connectionStatusText: { color: '#8299A2', fontSize: 10, fontWeight: '600' },
  connectedStatusText: { color: '#278452' },
  batteryBubble: { width: 112, minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 19, backgroundColor: '#E5F4F8', borderWidth: 1, borderColor: '#C5DFE7' },
  batteryIcon: { width: 22, height: 13, flexDirection: 'row', alignItems: 'center' },
  batteryOutline: { flex: 1, height: 12, padding: 2, justifyContent: 'center', borderRadius: 3, borderWidth: 1.5, borderColor: '#6D9EAD' },
  batteryCap: { width: 3, height: 6, borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: '#6D9EAD' },
  batteryFill: { height: '100%', borderRadius: 1, backgroundColor: '#42A6C2' },
  batteryFillLow: { backgroundColor: '#D89B47' },
  batteryLabel: { color: '#7F9CA7', fontSize: 9, fontWeight: '600' },
  batteryValue: { color: '#326277', fontSize: 13, fontWeight: '700', marginTop: 2 },
  devPanel: { marginTop: 28, borderRadius: 18, backgroundColor: '#EAF1F4', overflow: 'hidden', borderWidth: 1, borderColor: '#C2D1D7' },
  devPanelHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  devBadge: { color: '#FFFFFF', backgroundColor: '#718D99', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  devPanelTitle: { color: '#506E7A', fontSize: 12, fontWeight: '700', marginLeft: 9, flex: 1 },
  devChevron: { color: '#718D99', fontSize: 19, fontWeight: '500', paddingHorizontal: 5 },
  devPanelContent: { paddingHorizontal: 14, paddingBottom: 13 },
  devRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#DDE8EC' },
  devLabel: { color: '#607E89', fontSize: 11, fontWeight: '600', flex: 1 },
  devValueControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  devStepButton: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C1D3D9' },
  devStepText: { color: '#397F97', fontSize: 17, lineHeight: 20, fontWeight: '600' },
  devValue: { minWidth: 70, textAlign: 'center', color: '#365D6D', fontSize: 11, fontWeight: '700' },
  devBluetoothRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#DDE8EC' },
  devToggle: { minWidth: 104, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#DCE4E7', borderWidth: 1, borderColor: '#B5C6CC' },
  devToggleOn: { backgroundColor: '#CFEBD9', borderColor: '#A5D2B4' },
  devToggleText: { color: '#56727C', fontSize: 10, fontWeight: '700' },
  resetButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  resetText: { color: '#4A91A8', fontSize: 11, fontWeight: '700' },
});
