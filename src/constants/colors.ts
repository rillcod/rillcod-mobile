export interface ColorPalette {
  primary: string;
  primaryLight: string;
  primaryMid: string;
  primaryPale: string;
  primaryGlow: string;
  secondary: string;
  accent: string;
  accentLight: string;
  accentGlow: string;
  bg: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  borderGlow: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  admin: string;
  teacher: string;
  student: string;
  school: string;
  white100: string;
  white80: string;
  white40: string;
  white08: string;
  white05: string;
  gold: string;
  goldLight: string;
  goldGlow: string;
  gradPrimary: readonly [string, string, ...string[]];
  gradGold: readonly [string, string, ...string[]];
}

export const LIGHT_COLORS: ColorPalette = {
  primary: '#E8742B',
  primaryLight: '#F2954B',
  primaryMid: '#CB5E1B',
  primaryPale: '#FFF0E6',
  primaryGlow: 'rgba(232,116,43,0.2)',
  secondary: '#E8EEF7',
  accent: '#B92D34',
  accentLight: '#D94B52',
  accentGlow: 'rgba(185,45,52,0.16)',
  bg: '#F4F7FB',
  bgCard: '#FFFFFF',
  textPrimary: '#172439',
  textSecondary: '#42546F',
  textMuted: '#6D7C93',
  border: '#D7E0EC',
  borderLight: '#EAF0F6',
  borderGlow: 'rgba(23,36,57,0.08)',
  success: '#10B981',
  error: '#B92D34',
  warning: '#D89B2E',
  info: '#2F6FDD',
  admin: '#E8742B',
  teacher: '#243B63',
  student: '#10B981',
  school: '#2F6FDD',
  white100: '#FFFFFF',
  white80: 'rgba(255,255,255,0.8)',
  white40: 'rgba(255,255,255,0.4)',
  white08: 'rgba(255,255,255,0.08)',
  white05: 'rgba(255,255,255,0.05)',
  gold: '#D89B2E',
  goldLight: '#F1CF7A',
  goldGlow: 'rgba(216,155,46,0.18)',
  gradPrimary: ['#F2954B', '#E8742B'],
  gradGold: ['#F1CF7A', '#D89B2E'],
};

export const DARK_COLORS: ColorPalette = {
  primary: '#F08C3A',
  primaryLight: '#F4A866',
  primaryMid: '#D86F20',
  primaryPale: '#27170C',
  primaryGlow: 'rgba(240,140,58,0.24)',
  secondary: '#141C28',
  accent: '#D1494E',
  accentLight: '#E46A6F',
  accentGlow: 'rgba(209,73,78,0.2)',
  bg: '#0C1624',
  bgCard: '#111E30',
  textPrimary: '#E7EDF7',
  textSecondary: '#9FB0C8',
  textMuted: '#74839B',
  border: '#22314A',
  borderLight: '#182336',
  borderGlow: 'rgba(47,111,221,0.12)',
  success: '#10B981',
  error: '#D1494E',
  warning: '#D89B2E',
  info: '#6FA3FF',
  admin: '#F08C3A',
  teacher: '#365A96',
  student: '#34D399',
  school: '#6FA3FF',
  white100: '#FFFFFF',
  white80: 'rgba(255,255,255,0.8)',
  white40: 'rgba(255,255,255,0.4)',
  white08: 'rgba(255,255,255,0.08)',
  white05: 'rgba(255,255,255,0.05)',
  gold: '#D89B2E',
  goldLight: '#F1CF7A',
  goldGlow: 'rgba(216,155,46,0.2)',
  gradPrimary: ['#F4A866', '#F08C3A'],
  gradGold: ['#F1CF7A', '#D89B2E'],
};

export const COLORS: ColorPalette = LIGHT_COLORS;

