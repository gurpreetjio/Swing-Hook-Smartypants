import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GRADE_LABELS } from '../math/mathGen';
import { useStore } from '../state/store';
import { theme } from '../theme';

export function GradeSelectScreen({ onDone }: { onDone: () => void }) {
  const { setGrade, profile } = useStore();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pick your grade</Text>
      <Text style={styles.sub}>
        Math Gates are tuned to your grade and get tougher as you climb all 200 levels. You can change this later.
      </Text>
      <View style={styles.grid}>
        {GRADE_LABELS.map((label, g) => (
          <Pressable
            key={g}
            onPress={() => {
              setGrade(g);
              onDone();
            }}
            style={({ pressed }) => [
              styles.cell,
              profile.grade === g && { borderColor: theme.accent, borderWidth: 2 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.cellBig}>{g === 0 ? 'K' : g}</Text>
            <Text style={styles.cellLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 24, paddingTop: 80, paddingBottom: 60 },
  title: { color: theme.text, fontSize: 32, fontWeight: '900' },
  sub: { color: theme.textDim, fontSize: 15, marginTop: 8, marginBottom: 24, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: {
    width: '30%',
    aspectRatio: 0.95,
    backgroundColor: theme.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellBig: { color: theme.accent2, fontSize: 34, fontWeight: '900' },
  cellLabel: { color: theme.textDim, fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },
});
