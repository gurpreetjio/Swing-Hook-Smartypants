import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MathGate } from '../components/MathGate';
import { BigButton, Card, CoinPill } from '../components/ui';
import { bandForLevel } from '../math/mathGen';
import { RoundRewards, useStore } from '../state/store';
import { theme } from '../theme';
import { GameScreen } from './GameScreen';

/**
 * Adventure mode: one endless run, scored in meters. Portals zoom you right,
 * green hooks turbo-charge your spin, red hooks sling you backward. When you
 * fall, a Math Gate (tuned to how far you got) banks your rewards.
 */
export function AdventureRunScreen({ onHome }: { onHome: () => void }) {
  const { profile, reportAdventureRun } = useStore();
  const grade = profile.grade ?? 0;
  const [stage, setStage] = useState<'ready' | 'run' | 'gate' | 'done'>('ready');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [meters, setMeters] = useState(0);
  const [rewards, setRewards] = useState<RoundRewards | null>(null);

  // further = harder math (every 15m ≈ one Classic level of difficulty)
  const mathLevel = Math.max(1, Math.min(200, Math.round(meters / 15)));

  if (stage === 'run') {
    return (
      <GameScreen
        mode="swing"
        grade={grade}
        level={seed}
        endless
        levelLabel="Adventure"
        onExit={onHome}
        onRoundDone={() => {}}
        onRunEnd={(m) => {
          setMeters(m);
          setStage('gate');
        }}
      />
    );
  }

  if (stage === 'gate') {
    return (
      <View style={styles.gateWrap}>
        <Text style={styles.gateMeters}>{meters}m</Text>
        <MathGate
          grade={grade}
          level={mathLevel}
          onDone={(r) => {
            setRewards(reportAdventureRun(meters, bandForLevel(mathLevel), { correct: r.correct, fast: r.fast, answerMs: r.answerMs }));
            setStage('done');
          }}
        />
      </View>
    );
  }

  const isNewBest = stage === 'done' && meters >= profile.adventureBest && meters > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🌀 ADVENTURE</Text>
        <CoinPill coins={profile.coins} />
      </View>
      <Text style={styles.sub}>One endless run. How far can you fly?</Text>

      {stage === 'done' && (
        <Card style={{ borderColor: isNewBest ? theme.accent : theme.line }}>
          <Text style={styles.doneMeters}>{meters}m</Text>
          {isNewBest ? <Text style={styles.newBest}>🏅 NEW BEST!</Text> : null}
          {rewards ? (
            <Text style={styles.rewardLine}>
              🪙 +{rewards.coins} • +{rewards.xp} XP
              {rewards.unlockedSkin ? ' • 🎁 new skin!' : ''}
            </Text>
          ) : null}
        </Card>
      )}

      <Card>
        <Text style={styles.infoLine}>📏 Best distance: {profile.adventureBest}m</Text>
        <Text style={styles.infoLine}>🌀 Portals zoom you really fast to the right</Text>
        <Text style={styles.infoLine}>🟢 Green hooks speed up your spin</Text>
        <Text style={styles.infoLine}>🔴 Red hooks sling you the opposite way — careful!</Text>
        <Text style={styles.infoLine}>🧮 The further you get, the harder (and richer) the Math Gate</Text>
      </Card>

      <BigButton
        label={stage === 'done' ? 'RUN AGAIN →' : 'START RUN →'}
        color={theme.accent2}
        onPress={() => {
          setSeed(Math.floor(Math.random() * 1e9));
          setStage('run');
        }}
      />
      <BigButton label="Home" color={theme.panelLight} onPress={onHome} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: theme.text, fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  sub: { color: theme.textDim, fontSize: 14, fontWeight: '700', marginTop: 4, marginBottom: 10 },
  gateWrap: { flex: 1, backgroundColor: theme.bg },
  gateMeters: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: theme.accent,
    fontSize: 40,
    fontWeight: '900',
  },
  doneMeters: { color: theme.text, fontSize: 44, fontWeight: '900', textAlign: 'center' },
  newBest: { color: theme.accent, fontWeight: '900', fontSize: 16, textAlign: 'center', marginTop: 4 },
  rewardLine: { color: theme.good, fontWeight: '800', fontSize: 15, textAlign: 'center', marginTop: 8 },
  infoLine: { color: theme.text, fontSize: 14, fontWeight: '700', paddingVertical: 3 },
});
