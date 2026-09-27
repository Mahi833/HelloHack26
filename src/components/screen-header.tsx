import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Space, Surface, Type } from '@/constants/design';

export type ScreenHeaderProps = {
  title: string;
  subtitle: string;
  status?: { connected: boolean; label: string };
  onPressSettings?: () => void;
};

const SlidersGlyph = () => (
  <View style={styles.glyph}>
    <View style={styles.glyphRow}>
      <View style={styles.glyphTrack} />
      <View style={[styles.glyphKnob, styles.glyphKnobRight]} />
    </View>
    <View style={styles.glyphRow}>
      <View style={styles.glyphTrack} />
      <View style={[styles.glyphKnob, styles.glyphKnobLeft]} />
    </View>
    <View style={styles.glyphRow}>
      <View style={styles.glyphTrack} />
      <View style={[styles.glyphKnob, styles.glyphKnobCenter]} />
    </View>
  </View>
);

export const ScreenHeader = ({ title, subtitle, status, onPressSettings }: ScreenHeaderProps) => (
  <View style={styles.header}>
    <View style={styles.leading}>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>

    <View style={styles.trailing}>
      {status !== undefined && (
        <View style={[Surface.glassTint, styles.statusPill]} accessibilityLabel={status.label}>
          <View style={[styles.statusDot, status.connected ? styles.statusDotOn : styles.statusDotOff]} />
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
      )}
      {onPressSettings !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={onPressSettings}
          style={({ pressed }) => [Surface.glassStrong, styles.gear, pressed && styles.pressed]}>
          <SlidersGlyph />
        </Pressable>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Space.xl, gap: Space.md },
  leading: { flex: 1 },
  subtitle: { ...Type.eyebrow, color: Palette.inkFaint, textTransform: 'uppercase' },
  title: { ...Type.title, color: Palette.ink, marginTop: Space.xs },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingTop: Space.xs },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: Radius.pill },
  statusDot: { width: 7, height: 7, borderRadius: Radius.pill },
  statusDotOn: { backgroundColor: Palette.positive },
  statusDotOff: { backgroundColor: Palette.inkFaint },
  statusText: { ...Type.caption, color: Palette.inkSoft, fontWeight: '600' },
  gear: { width: 38, height: 38, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  glyph: { width: 18, height: 14, justifyContent: 'space-between' },
  glyphRow: { flexDirection: 'row', alignItems: 'center', height: 2 },
  glyphTrack: { flex: 1, height: 2, borderRadius: Radius.pill, backgroundColor: Palette.accent, opacity: 0.4 },
  glyphKnob: { position: 'absolute', width: 6, height: 6, borderRadius: Radius.pill, backgroundColor: Palette.accent },
  glyphKnobRight: { left: 11 },
  glyphKnobLeft: { left: 2 },
  glyphKnobCenter: { left: 7 },
});
