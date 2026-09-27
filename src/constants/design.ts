import { Platform, StyleSheet } from 'react-native';

export const Palette = {
  canvas: '#F4FAFC',
  canvasDeep: '#E4F2F8',
  ambientWarm: 'rgba(86, 190, 222, 0.44)',
  ambientCool: 'rgba(38, 116, 148, 0.28)',
  glass: 'rgba(255, 255, 255, 0.62)',
  glassStrong: 'rgba(255, 255, 255, 0.82)',
  glassTint: 'rgba(221, 243, 250, 0.72)',
  hairline: 'rgba(255, 255, 255, 0.85)',
  border: 'rgba(120, 175, 196, 0.34)',
  water: '#45A9C9',
  waterDeep: '#176C8C',
  waterSoft: '#C5E7F1',
  accent: '#3188A8',
  accentMuted: '#527582',
  ink: '#163D52',
  inkSoft: '#3D6B80',
  inkMuted: '#6E909D',
  inkFaint: '#9AB0B9',
  onAccent: '#FFFFFF',
  positive: '#4FA97F',
  warning: '#C98A2E',
} as const;

export const Radius = {
  small: 12,
  medium: 18,
  large: 24,
  xlarge: 30,
  pill: 999,
} as const;

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
} as const;

const family = Platform.select({ ios: 'ui-rounded', default: undefined });

export const Type = StyleSheet.create({
  display: { fontFamily: family, fontSize: 52, lineHeight: 58, fontWeight: '700', letterSpacing: -1.6, fontVariant: ['tabular-nums'] },
  title: { fontFamily: family, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.7 },
  heading: { fontFamily: family, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  subheading: { fontFamily: family, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontFamily: family, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  callout: { fontFamily: family, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontFamily: family, fontSize: 11, lineHeight: 15, fontWeight: '500' },
  eyebrow: { fontFamily: family, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2 },
});

export const Surface = StyleSheet.create({
  glass: {
    backgroundColor: Palette.glass,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    shadowColor: '#2E6678',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  glassStrong: {
    backgroundColor: Palette.glassStrong,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    shadowColor: '#2E6678',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  glassTint: {
    backgroundColor: Palette.glassTint,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
});
