import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BigButton, Card, CoinPill } from '../components/ui';
import { isoWeekKey } from '../game/rng';
import {
  placementForScore,
  RIVAL_NAMES,
  rivalScores,
  TOURNEY_FREE_PER_DAY,
  TOURNEY_RETRY_COST,
  useStore,
} from '../state/store';
import { theme } from '../theme';
import { GameScreen, RoundStats } from './GameScreen';

// The gauntlet: 5 fixed mid-difficulty levels, layouts seeded by the ISO week
// so everyone plays the same course all week. Math questions stay random so
// paid retries can't just memorize answers.
const GAUNTLET_LEVELS = [40, 60, 80, 100, 120];

function scoreRound(stats: RoundStats): number {
  let s = 100; // clearing the course
  if (stats.correct) s += 75;
  s += Math.round((1 - stats.timeFrac) * 125); // math speed
  s += Math.max(0, 60 - stats.retries * 30); // clean swinging
  s += Math.min(50, Math.round(stats.airtime * 5)); // style: airtime
  return s;
}

export function TournamentScreen({ onHome }: { onHome: () => void }) {
  const { profile, useTournamentEntry, reportTournamentScore } = useStore();
  const weekKey = isoWeekKey();
  const [run, setRun] = useState<{ stage: number; score: number } | null>(null);
  const [interlude, setInterlude] = useState<{ stage: number; score: number; last: number } | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);

  const freeLeft = Math.max(0, TOURNEY_FREE_PER_DAY - profile.tournament.entriesToday);
  const grade = profile.grade ?? 0;

  const startRun = () => {
    const kind = useTournamentEntry();
    if (kind === 'blocked') {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    setFinalScore(null);
    setRun({ stage: 0, score: 0 });
  };

  // mid-run interstitial
  if (interlude) {
    const isLast = interlude.stage >= GAUNTLET_LEVELS.length;
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.bigScore}>+{interlude.last}</Text>
        <Text style={styles.runProgress}>
          Stage {Math.min(interlude.stage, GAUNTLET_LEVELS.length)}/{GAUNTLET_LEVELS.length} • total {interlude.score}
        </Text>
        <BigButton
          label={isLast ? 'SEE RESULTS' : `STAGE ${interlude.stage + 1} →`}
          color={theme.accent}
          onPress={() => {
            if (isLast) {
              reportTournamentScore(interlude.score);
              setFinalScore(interlude.score);
              setInterlude(null);
              setRun(null);
            } else {
              setRun({ stage: interlude.stage, score: interlude.score });
              setInterlude(null);
            }
          }}
        />
      </View>
    );
  }

  if (run) {
    const levelNum = GAUNTLET_LEVELS[run.stage];
    return (
      <GameScreen
        mode="swing"
        grade={grade}
        level={levelNum}
        seedSalt={`tourney:${weekKey}:${run.stage}`}
        levelLabel={`Stage ${run.stage + 1}/${GAUNTLET_LEVELS.length}`}
        onExit={() => {
          // quitting forfeits the run (entry already spent)
          setRun(null);
        }}
        onRoundDone={(stats) => {
          const pts = scoreRound(stats);
          setInterlude({ stage: run.stage + 1, score: run.score + pts, last: pts });
          setRun(null);
        }}
      />
    );
  }

  // lobby
  const rivals = RIVAL_NAMES.map((name, i) => ({ name, score: rivalScores(weekKey)[i] }));
  const board = [...rivals, { name: profile.playerName + ' (you)', score: profile.tournament.bestScore }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  const placement = profile.tournament.bestScore > 0 ? placementForScore(weekKey, profile.tournament.bestScore) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>WEEKLY TOURNAMENT</Text>
        <CoinPill coins={profile.coins} />
      </View>
      <Text style={styles.weekLabel}>{weekKey} • same 5-stage course for everyone, all week</Text>

      {finalScore !== null && (
        <Card style={{ borderColor: theme.accent }}>
          <Text style={styles.finalScore}>RUN SCORE: {finalScore}</Text>
          <Text style={styles.finalSub}>
            {finalScore >= profile.tournament.bestScore ? 'New weekly best!' : `Weekly best: ${profile.tournament.bestScore}`}
          </Text>
        </Card>
      )}

      <Card>
        <Text style={styles.infoLine}>🎟️ Free runs today: {freeLeft}/{TOURNEY_FREE_PER_DAY}</Text>
        <Text style={styles.infoLine}>🪙 Extra runs: {TOURNEY_RETRY_COST} coins each (as many as you like)</Text>
        <Text style={styles.infoLine}>🏆 Best run of the week counts • prizes pay out when the week ends</Text>
        {placement ? <Text style={[styles.infoLine, { color: theme.accent }]}>Current placement: #{placement}</Text> : null}
      </Card>

      {blocked && <Text style={styles.blocked}>Not enough coins for an extra run — earn more in Adventure!</Text>}

      <BigButton
        label={freeLeft > 0 ? 'START RUN (FREE)' : `START RUN — 🪙 ${TOURNEY_RETRY_COST}`}
        color={theme.accent}
        onPress={startRun}
      />

      <Text style={styles.boardTitle}>THIS WEEK'S STANDINGS</Text>
      <Card>
        {board.map((row, i) => {
          const you = row.name.endsWith('(you)');
          return (
            <View key={row.name} style={[styles.boardRow, you && styles.youRow]}>
              <Text style={[styles.boardPos, you && { color: theme.accent }]}>{i + 1}</Text>
              <Text style={[styles.boardName, you && { color: theme.accent }]}>{row.name}</Text>
              <Text style={[styles.boardScore, you && { color: theme.accent }]}>{row.score}</Text>
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
  centerRoot: { flex: 1, backgroundColor: theme.bg, alignItems: 'stretch', justifyContent: 'center', padding: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: theme.text, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  weekLabel: { color: theme.textDim, fontSize: 12, fontWeight: '700', marginTop: 4, marginBottom: 10 },
  bigScore: { color: theme.good, fontSize: 56, fontWeight: '900', textAlign: 'center' },
  runProgress: { color: theme.textDim, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  finalScore: { color: theme.accent, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  finalSub: { color: theme.textDim, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  infoLine: { color: theme.text, fontSize: 14, fontWeight: '700', paddingVertical: 3 },
  blocked: { color: theme.bad, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  boardTitle: { color: theme.textDim, fontWeight: '900', fontSize: 12, letterSpacing: 2, marginTop: 18, marginBottom: 4 },
  boardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  youRow: { backgroundColor: theme.panelLight, borderRadius: 8, paddingHorizontal: 6 },
  boardPos: { color: theme.textDim, width: 28, fontWeight: '900' },
  boardName: { color: theme.text, flex: 1, fontWeight: '700' },
  boardScore: { color: theme.textDim, fontWeight: '900' },
});
