import { StyleSheet, Text, View } from 'react-native';

const describeElapsed = (minutes: number): string => {
  if (minutes < 1) return 'You just drank water';
  if (minutes < 60) {
    return `It's been ${minutes} minute${minutes === 1 ? '' : 's'} since you last drank water`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) {
    return `It's been ${hours} hour${hours === 1 ? '' : 's'} since you last drank water`;
  }
  return `It's been ${hours}h ${rest}m since you last drank water`;
};

export function LastDrinkPlaceholder({ minutesSinceDrink }: { minutesSinceDrink: number | null }) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>
        {minutesSinceDrink === null ? 'No water logged yet. Take a sip to get started.' : describeElapsed(minutesSinceDrink)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    borderRadius: 17,
    backgroundColor: '#E5F4F8',
    borderWidth: 1,
    borderColor: '#B9DCE5',
  },
  message: {
    flex: 1,
    color: '#326277',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
