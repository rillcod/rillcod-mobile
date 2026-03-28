import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MotiView } from 'moti';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { t } from '../../i18n';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsub;
  }, []);

  if (!isOffline) return null;

  return (
    <MotiView
      from={{ translateY: -60 }}
      animate={{ translateY: 0 }}
      exit={{ translateY: -60 }}
      transition={{ type: 'spring', damping: 20 }}
      style={[styles.banner, { top: Platform.OS === 'ios' ? 56 : 8 }]}
    >
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>{t('common.offline')}</Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    backgroundColor: '#92400e',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  icon: { fontSize: 14 },
  text: {
    color: '#fef3c7',
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.sm,
    flex: 1,
  },
});
