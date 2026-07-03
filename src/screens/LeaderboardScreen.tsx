import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BigButton, Card } from '../components/ui';
import { rankForXp, RANKS } from '../data/ranks';
import { hashString, isoWeekKey, mulberry32 } from '../game/rng';
import { RIVAL_NAMES, rivalScores, useStore } from '../state/store';
import { theme } from '../theme';

// All-time XP rivals: fixed forever (seeded once) so climbing past them is real progress.
function allTimeRivals(): { name: string; xp: number }[] {
  const rng = mulberry32(hashString('alltime-xp'));
  return RIVAL_NAMES.map((name) => ({ name, xp: 100 + Math.floor(rng() * 8800) }));
}

export function LeaderboardScreen({ onHome }: { onHome: () => void }) {
  const { profile } = useStore();
  const [tab, setTab] = useState<'week' | 'alltime'>('week');
  const weekKey = isoWeekKey();

  const rows =
    tab === 'week'
      ? [
          ...RIVAL_NAMES.map((name, i) => ({ name, value: rivalScores(weekKey)[i] })),
          { name: profile.playerName + ' (you)', value: profile.tournament.bestScore },
        ]
      : [
          ...allTimeRivals().map((r) => ({ name: r.name, value: r.xp })),
          { name: profile.playerName + ' (you)', value: profile.xp },
        ];
  rows.sort((a, b) => b.value - a.value);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>RANKS & LEADERBOARD</Text>
      <Text style={styles.sub}>
        Your rank: {rankForXp(profile.xp).icon} {rankForXp(profile.xp).name} • {profile.xp} XP • {profile.totalCorrect} correct ({profile.totalFast} ⚡)
      </Text>

      <View style={styles.tabs}>
        {(['week', 'alltime'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && { color: '#081018' }]}>
              {t === 'week' ? `THIS WEEK (${weekKey})` : 'ALL-TIME XP'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card>
        {rows.map((row, i) => {
          const you = row.name.endsWith('(you)');
          return (
            <View key={row.name} style={[styles.row, you && styles.youRow]}>
              <Text style={[styles.pos, you && { color: theme.accent }]}>{i + 1}</Text>
              <Text style={[styles.name, you && { color: theme.accent }]}>
                {tab === 'alltime' ? `${rankForXp(row.value).icon} ` : ''}
                {row.name}
              </Text>
              <Text style={[styles.score, you && { color: theme.accent }]}>{row.value}</Text>
            </View>
          );
        })}
      </Card>

      <Text style={styles.rankTitle}>RANK LADDER</Text>
      <Card>
        {RANKS.map((r) => {
          const here = rankForXp(profile.xp).name === r.name;
          return (
            <View key={r.name} style={[styles.row, here && styles.youRow]}>
              <Text style={styles.rankIcon}>{r.icon}</Text>
              <Text style={[styles.name, { color: here ? theme.accent : r.color }]}>{r.name}</Text>
              <Text style={styles.score}>{r.minXp} XP</Text>
            </View>
          );
        })}
      </Card>

      <BigButton label="Home" color={theme.panelLight} onPress={onHome} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  title: { color: theme.text, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  sub: { color: theme.textDim, fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.line,
  },
  tabActive: { backgroundColor: theme.accent2, borderColor: theme.accent2 },
  tabText: { color: theme.textDim, fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  youRow: { backgroundColor: theme.panelLight, borderRadius: 8, paddingHorizontal: 6 },
  pos: { color: theme.textDim, width: 28, fontWeight: '900' },
  name: { color: theme.text, flex: 1, fontWeight: '700' },
  score: { color: theme.textDim, fontWeight: '900' },
  rankTitle: { color: theme.textDim, fontWeight: '900', fontSize: 12, letterSpacing: 2, marginTop: 18, marginBottom: 4 },
  rankIcon: { width: 28, fontSize: 14 },
});
