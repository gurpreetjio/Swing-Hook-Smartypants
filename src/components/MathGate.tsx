import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { generateQuestion, MathQuestion } from '../math/mathGen';
import { theme } from '../theme';

export interface MathGateResult {
  correct: boolean;
  fast: boolean;
  answerMs: number;
  timeFrac: number; // fraction of the limit used (1 = timed out)
}

/**
 * End-of-round timed quiz. The speed timer starts immediately; answering inside
 * the fast window earns the bonus. Timeout counts as a wrong answer.
 */
export function MathGate({
  grade,
  level,
  seed,
  onDone,
}: {
  grade: number;
  level: number;
  seed?: number;
  onDone: (r: MathGateResult) => void;
}) {
  const question: MathQuestion = useMemo(() => generateQuestion(grade, level, seed), [grade, level, seed]);
  const startRef = useRef(Date.now());
  const [msLeft, setMsLeft] = useState(question.timeLimitSec * 1000);
  const [picked, setPicked] = useState<number | null>(null);
  const doneRef = useRef(false);

  const finish = (idx: number | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const answerMs = Date.now() - startRef.current;
    const correct = idx === question.correctIndex;
    const fast = correct && answerMs <= question.fastWindowSec * 1000;
    setPicked(idx);
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    setTimeout(
      () =>
        onDone({
          correct,
          fast,
          answerMs,
          timeFrac: Math.min(1, answerMs / (question.timeLimitSec * 1000)),
        }),
      850
    );
  };

  useEffect(() => {
    const iv = setInterval(() => {
      const left = question.timeLimitSec * 1000 - (Date.now() - startRef.current);
      setMsLeft(Math.max(0, left));
      if (left <= 0 && !doneRef.current) {
        clearInterval(iv);
        finish(null);
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frac = msLeft / (question.timeLimitSec * 1000);
  const inFastWindow = Date.now() - startRef.current <= question.fastWindowSec * 1000;
  const barColor = frac > 0.5 ? theme.good : frac > 0.25 ? theme.accent : theme.bad;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.kicker}>MATH GATE {picked === null && inFastWindow ? '⚡ SPEED BONUS LIVE' : ''}</Text>
        <Text style={styles.question}>{question.text}</Text>

        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, { width: `${frac * 100}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={styles.timerText}>{(msLeft / 1000).toFixed(1)}s</Text>

        <View style={styles.grid}>
          {question.options.map((opt, i) => {
            const isCorrect = picked !== null && i === question.correctIndex;
            const isWrongPick = picked === i && i !== question.correctIndex;
            return (
              <Pressable
                key={i}
                disabled={picked !== null}
                onPress={() => finish(i)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && { opacity: 0.7 },
                  isCorrect && { backgroundColor: theme.good, borderColor: theme.good },
                  isWrongPick && { backgroundColor: theme.bad, borderColor: theme.bad },
                ]}
              >
                <Text style={[styles.optionText, (isCorrect || isWrongPick) && { color: '#081018' }]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>

        {picked !== null && (
          <Text style={styles.verdict}>
            {picked === question.correctIndex
              ? Date.now() - startRef.current <= question.fastWindowSec * 1000
                ? '⚡ LIGHTNING FAST!'
                : '✅ Correct!'
              : `❌ Answer: ${question.options[question.correctIndex]}`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090a20ee',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.panel,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.line,
  },
  kicker: { color: theme.accent, fontWeight: '900', fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  question: { color: theme.text, fontSize: 34, fontWeight: '900', marginBottom: 14 },
  timerTrack: { height: 10, borderRadius: 6, backgroundColor: theme.bgDeep, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 6 },
  timerText: { color: theme.textDim, fontSize: 12, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    width: '48%',
    backgroundColor: theme.panelLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    paddingVertical: 18,
    alignItems: 'center',
  },
  optionText: { color: theme.text, fontSize: 22, fontWeight: '900' },
  verdict: { color: theme.text, fontWeight: '900', fontSize: 16, marginTop: 14, textAlign: 'center' },
});
