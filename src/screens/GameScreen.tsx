import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect } from 'react-native-svg';
import { generateLevel, WORLD } from '../game/levelGen';
import { findAnchor, GameMode, newSim, respawn, Sim, step } from '../game/physics';
import { findRope, findSkin, findTrail } from '../data/cosmetics';
import { useStore } from '../state/store';
import { DoodleFigure } from '../components/DoodleFigure';
import { MathGate, MathGateResult } from '../components/MathGate';
import { theme } from '../theme';

export interface RoundStats extends MathGateResult {
  retries: number;
  airtime: number;
  levelTimeSec: number;
}

const TRAIL_LEN = 16;

export function GameScreen({
  mode,
  grade,
  level,
  seedSalt,
  mathSeed,
  levelLabel,
  onExit,
  onRoundDone,
}: {
  mode: GameMode;
  grade: number;
  level: number;
  seedSalt?: string;
  mathSeed?: number;
  levelLabel: string;
  onExit: () => void;
  onRoundDone: (r: RoundStats) => void;
}) {
  const { width, height } = useWindowDimensions();
  const { profile } = useStore();
  const skin = findSkin(profile.equippedSkin);
  const rope = findRope(profile.equippedRope);
  const trail = findTrail(profile.equippedTrail);

  const lvl = useMemo(
    () => generateLevel(grade, level, seedSalt ?? (mode === 'swing' ? 'adv' : 'grap')),
    [grade, level, seedSalt, mode]
  );

  const simRef = useRef<Sim>(newSim(lvl));
  const holdingRef = useRef(false);
  const camRef = useRef({ x: 0, y: 0 });
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const deadFlashRef = useRef(0);
  const [, setFrame] = useState(0);
  const [phase, setPhase] = useState<'play' | 'math'>('play');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [hooksUsed, setHooksUsed] = useState(0);

  // reset sim when the level changes
  useEffect(() => {
    simRef.current = newSim(lvl);
    trailRef.current = [];
    camRef.current = { x: 0, y: 0 };
    setPhase('play');
    setHooksUsed(0);
  }, [lvl]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let deadWait = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!last) last = now;
      let dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (phaseRef.current !== 'play') return;

      const sim = simRef.current;
      if (sim.status === 'dead') {
        deadWait += dt;
        deadFlashRef.current = Math.max(0, deadFlashRef.current - dt * 2.5);
        if (deadWait > 0.45) {
          deadWait = 0;
          respawn(sim, lvl);
          trailRef.current = [];
        }
      } else {
        // two substeps per frame for a stabler rope constraint
        step(sim, lvl, mode, holdingRef.current, dt / 2);
        step(sim, lvl, mode, holdingRef.current, dt / 2);
        // read via helper: step() mutates sim, which TS's narrowing can't see
        const status = ((s: Sim) => s.status)(sim);
        if (status === 'dead') deadFlashRef.current = 1;
        if (status === 'win') {
          setPhase('math');
        }
        const t = trailRef.current;
        t.push({ x: sim.x, y: sim.y });
        if (t.length > TRAIL_LEN) t.shift();
      }

      // camera follow
      const cam = camRef.current;
      const tx = sim.x - width * 0.32;
      const ty = sim.y - height * 0.52;
      cam.x += (tx - cam.x) * 0.12;
      cam.y += (ty - cam.y) * 0.12;
      const minY = Math.min(-120, lvl.floorY - height + 60);
      cam.y = Math.max(minY, Math.min(lvl.floorY - height + 60, cam.y));

      setFrame((f) => (f + 1) & 1023);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lvl, mode, width, height]);

  const sim = simRef.current;
  const cam = camRef.current;

  // spike strips as triangle fans, precomputed per level
  const spikePolys = useMemo(() => {
    const polys: string[] = [];
    for (const s of lvl.floorSpikes) {
      for (let x = s.x0; x < s.x1; x += 22) {
        polys.push(`${x},${lvl.floorY} ${x + 11},${lvl.floorY - 20} ${x + 22},${lvl.floorY}`);
      }
    }
    return polys;
  }, [lvl]);

  const targetIdx = sim.hooked === null && sim.status === 'alive' ? findAnchor(sim, lvl, mode) : null;
  const hookedAnchor = sim.hooked !== null ? lvl.anchors[sim.hooked] : null;
  const tilt = Math.max(-28, Math.min(28, sim.vx * 0.02));

  return (
    <View style={styles.root}>
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onResponderGrant={() => {
          holdingRef.current = true;
          setHooksUsed((h) => h + 1);
        }}
        onResponderRelease={() => {
          holdingRef.current = false;
        }}
        onResponderTerminate={() => {
          holdingRef.current = false;
        }}
      >
        <Svg width={width} height={height}>
          {/* parallax stars */}
          {lvl.stars.map((s, i) => {
            const sx = s.x - cam.x * 0.35;
            const sy = s.y - cam.y * 0.35;
            if (sx < -10 || sx > width + 10) return null;
            return <Circle key={`st${i}`} cx={sx} cy={sy} r={s.r} fill="#ffffff" opacity={s.o} />;
          })}

          {/* trampoline floor */}
          <Rect x={0} y={lvl.floorY - cam.y} width={width} height={Math.max(0, height - (lvl.floorY - cam.y))} fill={theme.floor} />
          <Rect x={0} y={lvl.floorY - cam.y} width={width} height={7} fill={theme.floorBounce} />

          {/* spike strips */}
          <G x={-cam.x} y={-cam.y}>
            {spikePolys.map((p, i) => (
              <Polygon key={`sp${i}`} points={p} fill={theme.hazard} />
            ))}

            {/* finish gate */}
            <Rect x={lvl.finishX} y={lvl.floorY - 560} width={10} height={560} fill={theme.finish} opacity={0.9} rx={4} />
            <Polygon
              points={`${lvl.finishX + 10},${lvl.floorY - 560} ${lvl.finishX + 74},${lvl.floorY - 538} ${lvl.finishX + 10},${lvl.floorY - 516}`}
              fill={theme.accent}
            />

            {/* anchors (diamonds) */}
            {lvl.anchors.map((a, i) => {
              const active = i === sim.hooked;
              const target = i === targetIdx;
              const r = active ? 14 : 12;
              const pts = `${a.x},${a.y - r} ${a.x + r},${a.y} ${a.x},${a.y + r} ${a.x - r},${a.y}`;
              return (
                <G key={`a${i}`}>
                  {/* dashed targeting ring, like the original's hook halos */}
                  {!target && !active ? (
                    <Circle cx={a.x} cy={a.y} r={26} fill="none" stroke={theme.anchor} strokeWidth={1.5} strokeDasharray="5,7" opacity={0.3} />
                  ) : null}
                  {target ? <Circle cx={a.x} cy={a.y} r={22 + Math.sin(sim.t * 6) * 4} fill="none" stroke={theme.anchorActive} strokeWidth={2.5} strokeDasharray="6,5" opacity={0.9} /> : null}
                  <Polygon points={pts} fill={active ? theme.anchorActive : theme.anchor} opacity={active ? 1 : 0.9} />
                  <Circle cx={a.x} cy={a.y} r={3.5} fill={theme.bgDeep} />
                </G>
              );
            })}

            {/* air hazards */}
            {lvl.airHazards.map((h, i) => {
              const hy = h.y + (h.oscAmp ? Math.sin(sim.t * h.oscSpeed + h.phase) * h.oscAmp : 0);
              return (
                <G key={`h${i}`}>
                  <Circle cx={h.x} cy={hy} r={h.r} fill={theme.hazard} opacity={0.9} />
                  <Circle cx={h.x} cy={hy} r={h.r * 0.55} fill={theme.bgDeep} opacity={0.6} />
                </G>
              );
            })}

            {/* rope */}
            {hookedAnchor ? (
              <Line
                x1={sim.x}
                y1={sim.y + (mode === 'swing' ? 8 : 0)}
                x2={hookedAnchor.x}
                y2={hookedAnchor.y}
                stroke={rope.color}
                strokeWidth={3}
                strokeDasharray={rope.dash}
                strokeLinecap="round"
              />
            ) : null}

            {/* trail */}
            {trail.colors.length > 0 &&
              trailRef.current.map((p, i) => {
                const f = i / TRAIL_LEN;
                return (
                  <Circle
                    key={`t${i}`}
                    cx={p.x}
                    cy={p.y + 14}
                    r={2 + f * 6}
                    fill={trail.colors[i % trail.colors.length]}
                    opacity={f * 0.5}
                  />
                );
              })}

            {/* player */}
            <G x={sim.x} y={sim.y} rotation={tilt}>
              <DoodleFigure skin={skin} pose={sim.hooked !== null ? 'hooked' : 'fly'} />
            </G>
          </G>
        </Svg>

        {/* death flash */}
        {deadFlashRef.current > 0 && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.bad, opacity: deadFlashRef.current * 0.3 }]} />
        )}
      </View>

      {/* HUD */}
      <View style={styles.hud} pointerEvents="box-none">
        <Pressable onPress={onExit} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕</Text>
        </Pressable>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{levelLabel}</Text>
          <View style={styles.progTrack}>
            <View style={[styles.progFill, { width: `${Math.min(100, Math.max(0, (sim.x / lvl.finishX) * 100))}%` }]} />
          </View>
          <Text style={styles.modeText}>{mode === 'swing' ? '🪝 SWING' : '🧲 GRAPPLE'}</Text>
        </View>
        <View style={styles.retryBadge}>
          <Text style={styles.retryText}>↻ {sim.retries}</Text>
        </View>
      </View>

      {hooksUsed === 0 && phase === 'play' && (
        <View pointerEvents="none" style={styles.hint}>
          <Text style={styles.hintText}>
            {mode === 'swing' ? 'HOLD anywhere to hook the glowing diamond\nRELEASE to fly!' : 'HOLD to grapple — it pulls you straight in.\nRELEASE to launch!'}
          </Text>
        </View>
      )}

      {phase === 'math' && (
        <MathGate
          grade={grade}
          level={level}
          seed={mathSeed}
          onDone={(r) =>
            onRoundDone({ ...r, retries: sim.retries, airtime: sim.airtime, levelTimeSec: sim.t })
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  hud: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.panelLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.line,
  },
  exitText: { color: theme.text, fontSize: 16, fontWeight: '900' },
  levelBadge: { alignItems: 'center' },
  levelText: { color: theme.text, fontWeight: '900', fontSize: 17 },
  progTrack: { width: 130, height: 5, borderRadius: 3, backgroundColor: '#1a1d4acc', marginTop: 4, marginBottom: 2, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 3 },
  modeText: { color: theme.textDim, fontWeight: '700', fontSize: 11, letterSpacing: 1.5 },
  retryBadge: {
    backgroundColor: theme.panelLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.line,
  },
  retryText: { color: theme.textDim, fontWeight: '800', fontSize: 13 },
  hint: { position: 'absolute', bottom: 90, left: 0, right: 0, alignItems: 'center' },
  hintText: {
    color: theme.text,
    backgroundColor: '#1a1d4acc',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    overflow: 'hidden',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
