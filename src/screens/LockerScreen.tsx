import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { DoodleFigure } from '../components/DoodleFigure';
import { BigButton, CoinPill } from '../components/ui';
import { CLASSIC_SKINS, ROPES, specialVariant, TRAILS, WEEKLY_SKINS } from '../data/cosmetics';
import { useStore } from '../state/store';
import { theme } from '../theme';

export function LockerScreen({ onHome }: { onHome: () => void }) {
  const { profile, equip, buy } = useStore();

  const allSkins = [
    ...CLASSIC_SKINS,
    ...CLASSIC_SKINS.map(specialVariant),
    ...WEEKLY_SKINS,
  ].filter((s) => profile.skinsOwned.includes(s.id) || !s.weekly);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>LOCKER</Text>
        <CoinPill coins={profile.coins} />
      </View>

      <Text style={styles.section}>SKINS — unlock by filling the crate bar with correct answers</Text>
      <View style={styles.grid}>
        {allSkins.map((s) => {
          const owned = profile.skinsOwned.includes(s.id);
          const equipped = profile.equippedSkin === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => owned && equip('skin', s.id)}
              style={[styles.skinCell, equipped && styles.equipped, !owned && { opacity: 0.35 }]}
            >
              <Svg width={44} height={54} viewBox="-22 -16 44 54">
                <DoodleFigure skin={s} pose="fly" scale={0.68} />
              </Svg>
              <Text style={styles.skinName} numberOfLines={1}>
                {owned ? s.name : '🔒'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>ROPES</Text>
      {ROPES.map((r) => {
        const owned = profile.ropesOwned.includes(r.id);
        const equipped = profile.equippedRope === r.id;
        return (
          <Pressable
            key={r.id}
            onPress={() => (owned ? equip('rope', r.id) : buy('rope', r.id, r.cost))}
            style={[styles.itemRow, equipped && styles.equipped]}
          >
            <Svg width={44} height={20}>
              <Line x1={2} y1={10} x2={42} y2={10} stroke={r.color} strokeWidth={4} strokeDasharray={r.dash} strokeLinecap="round" />
            </Svg>
            <Text style={styles.itemName}>{r.name}</Text>
            <Text style={[styles.itemPrice, owned && { color: theme.good }]}>
              {equipped ? 'EQUIPPED' : owned ? 'TAP TO EQUIP' : `🪙 ${r.cost}`}
            </Text>
          </Pressable>
        );
      })}

      <Text style={styles.section}>TRAILS</Text>
      {TRAILS.map((t) => {
        const owned = profile.trailsOwned.includes(t.id);
        const equipped = profile.equippedTrail === t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => (owned ? equip('trail', t.id) : buy('trail', t.id, t.cost))}
            style={[styles.itemRow, equipped && styles.equipped]}
          >
            {t.emoji ? (
              <Text style={{ width: 44, fontSize: 15 }} numberOfLines={1}>
                {Array.from({ length: 3 }, (_, i) => t.emoji![i % t.emoji!.length]).join('')}
              </Text>
            ) : (
              <Svg width={44} height={20}>
                {t.colors.length === 0 ? (
                  <Line x1={6} y1={10} x2={38} y2={10} stroke={theme.line} strokeWidth={2} strokeDasharray="2,4" />
                ) : (
                  t.colors.slice(0, 5).map((c, i) => <Circle key={i} cx={8 + i * 8} cy={10} r={3 + i * 0.6} fill={c} />)
                )}
              </Svg>
            )}
            <Text style={styles.itemName}>{t.name}</Text>
            <Text style={[styles.itemPrice, owned && { color: theme.good }]}>
              {equipped ? 'EQUIPPED' : owned ? 'TAP TO EQUIP' : `🪙 ${t.cost}`}
            </Text>
          </Pressable>
        );
      })}

      <View style={{ height: 12 }} />
      <BigButton label="Home" color={theme.panelLight} onPress={onHome} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: theme.text, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  section: { color: theme.textDim, fontWeight: '900', fontSize: 12, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skinCell: {
    width: '18%',
    aspectRatio: 0.82,
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipped: { borderColor: theme.accent, borderWidth: 2 },
  skinName: { color: theme.textDim, fontSize: 9, fontWeight: '700', marginTop: 2 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  itemName: { color: theme.text, fontWeight: '800', flex: 1, fontSize: 14 },
  itemPrice: { color: theme.accent, fontWeight: '900', fontSize: 12 },
});
