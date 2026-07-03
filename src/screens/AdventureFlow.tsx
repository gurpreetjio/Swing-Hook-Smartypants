import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { DoodleFigure } from '../components/DoodleFigure';
import { BigButton, Card } from '../components/ui';
import { findSkin } from '../data/cosmetics';
import { bandForLevel } from '../math/mathGen';
import { BAR_SIZE, RoundRewards, useStore } from '../state/store';
import { theme } from '../theme';
import { GameScreen, RoundStats } from './GameScreen';

/**
 * Adventure / Grapple loop: play level → math gate → reward card → next level.
 * Level number always comes from the profile, which completeRound advances.
 */
export function AdventureFlow({ mode, onHome }: { mode: 'swing' | 'grapple'; onHome: () => void }) {
  const { profile, completeRound } = useStore();
  const grade = profile.grade ?? 0;
  const progKey = mode === 'swing' ? 'adventure' : 'grapple';
  const prog = profile[progKey][grade] ?? { level: 1, completed: false };

  const [reward, setReward] = useState<{ rewards: RoundRewards; stats: RoundStats; level: number } | null>(null);

  if (reward) {
    const { rewards, stats } = reward;
    const unlocked = rewards.unlockedSkin ? findSkin(rewards.unlockedSkin) : null;
    const special = rewards.unlockedSpecial ? findSkin(rewards.unlockedSpecial) : null;
    return (
      <View style={styles.root}>
        <Text style={styles.big}>
          {stats.correct ? (stats.fast ? '⚡ LIGHTNING!' : '✅ NICE ONE!') : '💪 LEVEL CLEARED'}
        </Text>
        <Text style={styles.sub}>
          Level {reward.level} • answered in {(stats.answerMs / 1000).toFixed(1)}s
          {stats.correct ? '' : ' — no rewards without the right answer!'}
        </Text>

        <Card>
          <Row label="Coins earned" value={`🪙 +${rewards.coins}`} />
          <Row label="XP earned" value={`+${rewards.xp}`} />
          <Row label="Skin crate" value={`${profile.barProgress}/${BAR_SIZE}${profile.barFastCount === profile.barProgress && profile.barProgress > 0 ? ' ⚡' : ''}`} />
          <Row label="Retries used" value={`${stats.retries}`} />
        </Card>

        {unlocked && (
          <Card style={styles.unlockCard}>
            <Svg width={60} height={70} viewBox="-30 -18 60 70">
              <DoodleFigure skin={special ?? unlocked} pose="fly" />
            </Svg>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.unlockTitle}>NEW SKIN UNLOCKED!</Text>
              <Text style={styles.unlockName}>
                {unlocked.name}
                {special ? ` + special ${special.name}` : ''}
              </Text>
              {special ? <Text style={styles.unlockSpecial}>All {BAR_SIZE} answers were ⚡ fast — glow variant earned!</Text> : null}
            </View>
          </Card>
        )}

        {rewards.gradeCompleted && (
          <Card style={{ borderColor: theme.accent }}>
            <Text style={styles.gradeDone}>🎓 GRADE COMPLETE! +1000 coin bonus. Pick a new grade from the home screen!</Text>
          </Card>
        )}

        {!rewards.gradeCompleted && (
          <BigButton label="KEEP SWINGING →" color={theme.accent2} onPress={() => setReward(null)} />
        )}
        <BigButton label="Home" color={theme.panelLight} onPress={onHome} style={styles.homeBtn} />
      </View>
    );
  }

  return (
    <GameScreen
      mode={mode}
      grade={grade}
      level={prog.level}
      levelLabel={`Level ${prog.level}`}
      onExit={onHome}
      onRoundDone={(stats) => {
        const level = prog.level;
        const rewards = completeRound(progKey, bandForLevel(level), {
          correct: stats.correct,
          fast: stats.fast,
          answerMs: stats.answerMs,
        });
        setReward({ rewards, stats, level });
      }}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 22, paddingTop: 90 },
  big: { color: theme.text, fontSize: 34, fontWeight: '900', textAlign: 'center' },
  sub: { color: theme.textDim, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { color: theme.textDim, fontWeight: '700', fontSize: 15 },
  rowValue: { color: theme.text, fontWeight: '900', fontSize: 15 },
  unlockCard: { flexDirection: 'row', alignItems: 'center', borderColor: theme.accent },
  unlockTitle: { color: theme.accent, fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
  unlockName: { color: theme.text, fontWeight: '900', fontSize: 18, marginTop: 2 },
  unlockSpecial: { color: theme.purple, fontWeight: '700', fontSize: 12, marginTop: 4 },
  gradeDone: { color: theme.accent, fontWeight: '800', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  homeBtn: { marginTop: 4 },
});
