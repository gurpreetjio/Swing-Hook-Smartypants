import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { DoodleFigure } from '../components/DoodleFigure';
import { BigButton, Card, CoinPill } from '../components/ui';
import { findSkin, WEEKLY_SKIN_COST, weeklyRotation } from '../data/cosmetics';
import { nextRank, rankForXp } from '../data/ranks';
import { isoWeekKey } from '../game/rng';
import { GRADE_LABELS } from '../math/mathGen';
import { BAR_SIZE, LEVELS_PER_GRADE, TOURNEY_FREE_PER_DAY, useStore } from '../state/store';
import { theme } from '../theme';

export type Route =
  | { name: 'home' }
  | { name: 'gradeSelect' }
  | { name: 'adventure'; mode: 'swing' | 'grapple' }
  | { name: 'tournament' }
  | { name: 'leaderboard' }
  | { name: 'locker' };

export function HomeScreen({ go }: { go: (r: Route) => void }) {
  const { profile, buy } = useStore();
  const grade = profile.grade ?? 0;
  const adv = profile.adventure[grade] ?? { level: 1, completed: false };
  const grap = profile.grapple[grade] ?? { level: 1, completed: false };
  const rank = rankForXp(profile.xp);
  const nxt = nextRank(profile.xp);
  const weekKey = isoWeekKey();
  const weekly = weeklyRotation(weekKey);
  const freeLeft = Math.max(0, TOURNEY_FREE_PER_DAY - profile.tournament.entriesToday);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>SWING HOOK</Text>
          <Text style={styles.logoSub}>SMARTYPANTS</Text>
        </View>
        <CoinPill coins={profile.coins} />
      </View>

      {/* rank + equipped doodle */}
      <Card style={styles.rankCard}>
        <Svg width={70} height={80} viewBox="-35 -20 70 80">
          <DoodleFigure skin={findSkin(profile.equippedSkin)} pose="fly" />
        </Svg>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.rankName, { color: rank.color }]}>
            {rank.icon} {rank.name}
          </Text>
          <Text style={styles.rankXp}>
            {profile.xp} XP{nxt ? ` • ${nxt.minXp - profile.xp} to ${nxt.name}` : ' • MAX RANK'}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(profile.barProgress / BAR_SIZE) * 100}%` }]} />
          </View>
          <Text style={styles.barLabel}>
            Skin crate: {profile.barProgress}/{BAR_SIZE} correct
            {profile.barFastCount === profile.barProgress && profile.barProgress > 0 ? ' — all ⚡ so far!' : ''}
          </Text>
        </View>
      </Card>

      {/* modes */}
      <BigButton
        label={
          adv.level > LEVELS_PER_GRADE
            ? `ADVENTURE  •  ⚡ CHALLENGE LV ${adv.level}`
            : `ADVENTURE  •  Level ${adv.level}/${LEVELS_PER_GRADE}`
        }
        sub={
          adv.completed
            ? `🎓 ${GRADE_LABELS[grade]} complete • endless challenge levels`
            : `${GRADE_LABELS[grade]} math • unlimited plays`
        }
        color={theme.accent2}
        onPress={() => go({ name: 'adventure', mode: 'swing' })}
      />
      <BigButton
        label={
          grap.level > LEVELS_PER_GRADE
            ? `GRAPPLE MODE  •  ⚡ CHALLENGE LV ${grap.level}`
            : `GRAPPLE MODE  •  Level ${grap.level}/${LEVELS_PER_GRADE}`
        }
        sub="No swinging — the hook pulls you straight!"
        color={theme.purple}
        onPress={() => go({ name: 'adventure', mode: 'grapple' })}
      />
      <BigButton
        label="WEEKLY TOURNAMENT"
        sub={freeLeft > 0 ? `${freeLeft} free run${freeLeft === 1 ? '' : 's'} left today` : 'Extra runs: 10 coins'}
        color={theme.accent}
        onPress={() => go({ name: 'tournament' })}
      />

      <View style={styles.row}>
        <BigButton label="🏆 Ranks" color={theme.good} style={{ flex: 1 }} onPress={() => go({ name: 'leaderboard' })} />
        <View style={{ width: 10 }} />
        <BigButton label="🎨 Locker" color={theme.bad} style={{ flex: 1 }} onPress={() => go({ name: 'locker' })} />
      </View>

      {/* weekly skins */}
      <Text style={styles.sectionTitle}>THIS WEEK ONLY — {weekKey}</Text>
      <View style={styles.weeklyRow}>
        {weekly.map((s) => {
          const owned = profile.skinsOwned.includes(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                if (!owned) buy('skin', s.id, WEEKLY_SKIN_COST);
              }}
              style={({ pressed }) => [styles.weeklyCard, pressed && { opacity: 0.75 }]}
            >
              <Svg width={54} height={64} viewBox="-27 -18 54 64">
                <DoodleFigure skin={s} pose="fly" scale={0.8} />
              </Svg>
              <Text style={styles.weeklyName}>{s.name}</Text>
              <Text style={[styles.weeklyPrice, owned && { color: theme.good }]}>
                {owned ? 'OWNED' : `🪙 ${WEEKLY_SKIN_COST}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => go({ name: 'gradeSelect' })} style={styles.gradeLink}>
        <Text style={styles.gradeLinkText}>Change grade ({GRADE_LABELS[grade]})</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logo: { color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  logoSub: { color: theme.accent, fontSize: 13, fontWeight: '900', letterSpacing: 5 },
  rankCard: { flexDirection: 'row', alignItems: 'center' },
  rankName: { fontSize: 18, fontWeight: '900' },
  rankXp: { color: theme.textDim, fontSize: 12, fontWeight: '700', marginTop: 2, marginBottom: 8 },
  barTrack: { height: 10, backgroundColor: theme.bgDeep, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 6 },
  barLabel: { color: theme.textDim, fontSize: 11, fontWeight: '700', marginTop: 4 },
  row: { flexDirection: 'row' },
  sectionTitle: { color: theme.textDim, fontWeight: '900', fontSize: 12, letterSpacing: 2, marginTop: 18, marginBottom: 8 },
  weeklyRow: { flexDirection: 'row', gap: 10 },
  weeklyCard: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: 'center',
    paddingVertical: 12,
  },
  weeklyName: { color: theme.text, fontWeight: '800', fontSize: 12, marginTop: 4 },
  weeklyPrice: { color: theme.accent, fontWeight: '900', fontSize: 12, marginTop: 2 },
  gradeLink: { alignItems: 'center', marginTop: 20 },
  gradeLinkText: { color: theme.accent2, fontWeight: '700', fontSize: 14 },
});
