import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onPress: () => void;
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconBackButton({ onPress, color, size = 22, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.base, style]}
      activeOpacity={0.7}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Ionicons name="chevron-back" size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
