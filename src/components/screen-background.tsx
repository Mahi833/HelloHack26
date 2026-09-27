import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/design';

export const ScreenBackground = ({ children }: { children: ReactNode }) => (
  <View style={styles.root}>
    <View pointerEvents="none" style={styles.ambient}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobRight]} />
      <View style={[styles.blob, styles.blobBottom]} />
    </View>
    {children}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobTop: { top: -110, left: -70, width: 320, height: 320, backgroundColor: Palette.ambientWarm },
  blobRight: { top: 150, right: -130, width: 300, height: 300, backgroundColor: Palette.ambientCool },
  blobBottom: { bottom: -150, left: -40, width: 380, height: 380, backgroundColor: Palette.ambientWarm },
});
