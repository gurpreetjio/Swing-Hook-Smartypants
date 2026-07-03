import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

export function BigButton({
  label,
  sub,
  color = theme.accent2,
  onPress,
  disabled,
  style,
}: {
  label: string;
  sub?: string;
  color?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.bigBtn,
        { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={styles.bigBtnLabel}>{label}</Text>
      {sub ? <Text style={styles.bigBtnSub}>{sub}</Text> : null}
    </Pressable>
  );
}

export function CoinPill({ coins }: { coins: number }) {
  return (
    <View style={styles.coinPill}>
      <Text style={styles.coinText}>🪙 {coins}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  bigBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginVertical: 6,
  },
  bigBtnLabel: { color: '#081018', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  bigBtnSub: { color: '#081018', fontSize: 12, fontWeight: '700', opacity: 0.75, marginTop: 2 },
  coinPill: {
    backgroundColor: theme.panelLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.line,
  },
  coinText: { color: theme.accent, fontWeight: '900', fontSize: 15 },
  card: {
    backgroundColor: theme.panel,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.line,
    marginVertical: 8,
  },
});
