import { StyleSheet, Text, View } from 'react-native';

export function LastDrinkPlaceholder({ minutesSinceDrink }: { minutesSinceDrink: number }) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>
        It&apos;s been {minutesSinceDrink} minute{minutesSinceDrink === 1 ? '' : 's'} since you last drank water
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
