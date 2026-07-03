import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { generateAdventureLevel, generateLevel, stageForLevel, STAGE_LABELS, themeForLevel, WORLD } from '../game/levelGen';
import { hashString } from '../game/rng';
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
const CONFETTI_COLORS = ['#ffd166', '#06d6a0', '#ef476f', '#4cc9f0', '#b388ff', '#ffffff', '#ff9e64'];

interface ConfettiBit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  c: string;
  w: number;
  h: number;
}

export function GameScreen({
  mode,
  grade,
  level,
  seedSalt,
  mathSeed,
  levelLabel,
  onExit,
  onRoundDone,
  endless,
  onRunEnd,
}: {
  mode: GameMode;
  grade: number;
  level: number; // in endless mode this is the run seed
  seedSalt?: string;
  mathSeed?: number;
  levelLabel: string;
  onExit: () => void;
  onRoundDone: (r: RoundStats) => void;
  endless?: boolean; // Adventure run: no finish line, distance in meters, death ends the run
  onRunEnd?: (meters: number) => void;
}) {
  const { width, height } = useWindowDimensions();
  const { profile } = useStore();
  const skin = findSkin(profile.equippedSkin);
  const rope = findRope(profile.equippedRope);
  const trail = findTrail(profile.equippedTrail);
  const trailEmojis = trail.emoji;

  const lvl = useMemo(
    () =>
      endless
        ? generateAdventureLevel(hashString(`run:${level}`))
        : generateLevel(grade, level, seedSalt ?? (mode === 'swing' ? 'adv' : 'grap')),
    [grade, level, seedSalt, mode, endless]
  );
  const world = themeForLevel(endless ? 1 : level);
  const stage = stageForLevel(level);

  const simRef = useRef<Sim>(newSim(lvl));
  const holdingRef = useRef(false);
  const camRef = useRef({ x: 0, y: 0 });
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const deadFlashRef = useRef(0);
  const confettiRef = useRef<ConfettiBit[]>([]);
  const clearedUntilRef = useRef(0);
  const runEndedRef = useRef(false);
  const spinRef = useRef(0);
  const [, setFrame] = useState(0);
  const [phase, setPhase] = useState<'play' | 'cleared' | 'math'>('play');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [hooksUsed, setHooksUsed] = useState(0);

  // reset sim when the level changes
  useEffect(() => {
    simRef.current = newSim(lvl);
    trailRef.current = [];
    camRef.current = { x: 0, y: 0 };
    runEndedRef.current = false;
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

      // celebration: freeze the sim, rain confetti, then open the math gate
      if (phaseRef.current === 'cleared') {
        for (const c of confettiRef.current) {
          c.vy += 820 * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.rot += c.vr * dt;
        }
        if (now >= clearedUntilRef.current) setPhase('math');
        setFrame((f) => (f + 1) & 1023);
        return;
      }
      if (phaseRef.current !== 'play') return;

      const sim = simRef.current;
      if (sim.status === 'dead') {
        deadWait += dt;
        deadFlashRef.current = Math.max(0, deadFlashRef.current - dt * 2.5);
        if (deadWait > 0.45) {
          deadWait = 0;
          if (endless) {
            // Adventure run: death ends the run — report the distance
            if (!runEndedRef.current) {
              runEndedRef.current = true;
              onRunEnd?.(Math.max(0, Math.round((sim.x - lvl.startX) / 10)));
            }
            return;
          }
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
        if (status === 'win' && endless) {
          // ran the entire endless course (!) — count it as the run distance
          if (!runEndedRef.current) {
            runEndedRef.current = true;
            onRunEnd?.(Math.max(0, Math.round((sim.x - lvl.startX) / 10)));
          }
          return;
        }
        if (status === 'win') {
          const bits: ConfettiBit[] = [];
          for (let i = 0; i < 46; i++) {
            bits.push({
              x: Math.random() * width,
              y: height * 0.55 + Math.random() * height * 0.45,
              vx: (Math.random() - 0.5) * 460,
              vy: -(380 + Math.random() * 640),
              rot: Math.random() * 360,
              vr: (Math.random() - 0.5) * 760,
              c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              w: 8 + Math.random() * 8,
              h: 5 + Math.random() * 5,
            });
          }
          confettiRef.current = bits;
          clearedUntilRef.current = now + 1600;
          setPhase('cleared');
        }
        const t = trailRef.current;
        t.push({ x: sim.x, y: sim.y });
        if (t.length > TRAIL_LEN) t.shift();

        // ball spin follows actual horizontal motion (rolling direction & speed)
        if (sim.hooked === null) spinRef.current = (spinRef.current + sim.vx * dt * 2.4) % 360;
      }

      // camera follow: keep the player dead-center so you can see what's
      // coming ahead and what's behind you equally
      const cam = camRef.current;
      const tx = sim.x - width * 0.5;
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

  const targetIdx = sim.hooked === null && sim.status === 'alive' ? findAnchor(sim, lvl, mode) : null;
  const hookedAnchor = sim.hooked !== null ? lvl.anchors[sim.hooked] : null;
  const tilt = Math.max(-28, Math.min(28, sim.vx * 0.02));

  // viewport culling: adventure courses have hundreds of entities — only
  // mount SVG nodes for what's near the camera, or the frame rate tanks
  const viewL = cam.x - 240;
  const viewR = cam.x + width + 240;
  const fireOnScreen = lvl.fire && sim.fireX > viewL - 200;
  const fireGap = lvl.fire ? sim.x - sim.fireX : Infinity;

  return (
    <View style={[styles.root, { backgroundColor: world.bg }]}>
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

          <G x={-cam.x} y={-cam.y}>
            {/* the ground: a row of thick striped planks fixed in the world
                (so it visibly scrolls past), with holes where planks are missing */}
            {lvl.floorPlanks.map((t, i) => {
              if (t.x1 < viewL || t.x0 > viewR) return null;
              return (
                <G key={`ft${i}`}>
                  <Rect x={t.x0 + 4} y={lvl.floorY - 2} width={t.x1 - t.x0 - 8} height={34} rx={17} fill="#0c0e28" />
                  <Line
                    x1={t.x0 + 20}
                    y1={lvl.floorY + 15}
                    x2={t.x1 - 20}
                    y2={lvl.floorY + 15}
                    stroke="#f2f3ff"
                    strokeWidth={20}
                    strokeDasharray="30,22"
                    strokeLinecap="round"
                    opacity={0.92}
                  />
                </G>
              );
            })}

            {/* bumper planks: horizontal bounce pads and vertical walls */}
            {lvl.planks.map((p, i) => {
              if (p.x + p.w < viewL || p.x > viewR) return null;
              const vertical = p.h > p.w;
              const thin = Math.min(p.w, p.h);
              return (
                <G key={`pl${i}`}>
                  <Rect x={p.x} y={p.y} width={p.w} height={p.h} rx={thin / 2} fill="#0c0e28" />
                  <Line
                    x1={vertical ? p.x + p.w / 2 : p.x + 10}
                    y1={vertical ? p.y + 10 : p.y + p.h / 2}
                    x2={vertical ? p.x + p.w / 2 : p.x + p.w - 10}
                    y2={vertical ? p.y + p.h - 10 : p.y + p.h / 2}
                    stroke="#f2f3ff"
                    strokeWidth={thin - 10}
                    strokeDasharray="16,13"
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                </G>
              );
            })}

            {/* finish gate */}
            <Rect x={lvl.finishX} y={lvl.floorY - 560} width={10} height={560} fill={theme.finish} opacity={0.9} rx={4} />
            <Polygon
              points={`${lvl.finishX + 10},${lvl.floorY - 560} ${lvl.finishX + 74},${lvl.floorY - 538} ${lvl.finishX + 10},${lvl.floorY - 516}`}
              fill={theme.accent}
            />

            {/* portals: zoom you fast to the right */}
            {lvl.portals.map((pt, i) => (
              pt.x < viewL || pt.x > viewR ? null : (
              <G key={`po${i}`}>
                <Circle cx={pt.x} cy={pt.y} r={pt.r + 8} fill={theme.accent2} opacity={0.16} />
                <Circle cx={pt.x} cy={pt.y} r={pt.r} fill={theme.bgDeep} opacity={0.75} />
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={pt.r - 4}
                  fill="none"
                  stroke={theme.accent2}
                  strokeWidth={3.5}
                  strokeDasharray="14,9"
                  rotation={(sim.t * 140) % 360}
                  origin={`${pt.x}, ${pt.y}`}
                />
                <Polygon
                  points={`${pt.x - 6},${pt.y - 9} ${pt.x + 9},${pt.y} ${pt.x - 6},${pt.y + 9}`}
                  fill={theme.accent2}
                  opacity={0.9}
                />
              </G>
              )
            ))}

            {/* anchors (diamonds); green = turbo spin, red = backward sling (one use) */}
            {lvl.anchors.map((a, i) => {
              if (a.x < viewL || a.x > viewR || sim.consumed.has(i)) return null;
              const active = i === sim.hooked;
              const target = i === targetIdx;
              const kindColor = a.kind === 'green' ? '#3ddc84' : a.kind === 'red' ? '#ff5252' : world.anchor;
              const r = active ? 14 : 12;
              const pts = `${a.x},${a.y - r} ${a.x + r},${a.y} ${a.x},${a.y + r} ${a.x - r},${a.y}`;
              return (
                <G key={`a${i}`}>
                  {/* dashed targeting ring, like the original's hook halos */}
                  {!target && !active ? (
                    <Circle cx={a.x} cy={a.y} r={26} fill="none" stroke={kindColor} strokeWidth={1.5} strokeDasharray="5,7" opacity={a.kind ? 0.55 : 0.3} />
                  ) : null}
                  {target ? <Circle cx={a.x} cy={a.y} r={22 + Math.sin(sim.t * 6) * 4} fill="none" stroke={theme.anchorActive} strokeWidth={2.5} strokeDasharray="6,5" opacity={0.9} /> : null}
                  <Polygon points={pts} fill={active ? theme.anchorActive : kindColor} opacity={active ? 1 : 0.9} />
                  <Circle cx={a.x} cy={a.y} r={3.5} fill={theme.bgDeep} />
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

            {/* trail: object followers (parachute pals etc.) or classic dots */}
            {trailEmojis
              ? trailRef.current.map((p, i) => {
                  if (i % 3 !== 0) return null;
                  const f = i / TRAIL_LEN;
                  return (
                    <SvgText
                      key={`t${i}`}
                      x={p.x}
                      y={p.y + 24}
                      fontSize={10 + f * 12}
                      opacity={0.3 + f * 0.65}
                      textAnchor="middle"
                    >
                      {trailEmojis[((i / 3) | 0) % trailEmojis.length]}
                    </SvgText>
                  );
                })
              : trail.colors.length > 0 &&
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

            {/* player: stickman on the rope, bouncy ball in the air */}
            <G x={sim.x} y={sim.y} rotation={sim.hooked !== null ? tilt : spinRef.current}>
              <DoodleFigure skin={skin} pose={sim.hooked !== null ? 'hooked' : 'ball'} />
            </G>

            {/* the fire cloud chasing from behind */}
            {fireOnScreen && (
              <G>
                <Rect x={viewL - 200} y={cam.y - 100} width={Math.max(0, sim.fireX - (viewL - 200))} height={height + 200} fill="#d00000" opacity={0.55} />
                <Rect x={sim.fireX - 90} y={cam.y - 100} width={90} height={height + 200} fill="#ff5722" opacity={0.6} />
                {Array.from({ length: 9 }, (_, i) => {
                  const fy = cam.y - 40 + i * ((height + 80) / 8);
                  const wob = Math.sin(sim.t * 7 + i * 1.7) * 16;
                  const r = 42 + Math.sin(sim.t * 9 + i * 2.3) * 14;
                  return (
                    <G key={`fl${i}`}>
                      <Circle cx={sim.fireX + wob - 12} cy={fy} r={r} fill="#ff5722" opacity={0.8} />
                      <Circle cx={sim.fireX + wob - 30} cy={fy + 12} r={r * 0.6} fill="#ffb703" opacity={0.75} />
                    </G>
                  );
                })}
              </G>
            )}
          </G>

          {/* confetti burst (screen space) */}
          {phase === 'cleared' &&
            confettiRef.current.map((c, i) => (
              <Rect
                key={`cf${i}`}
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx={2}
                fill={c.c}
                rotation={c.rot}
                origin={`${c.x}, ${c.y}`}
              />
            ))}
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
          {endless ? (
            <>
              <Text style={styles.metersText}>{Math.max(0, Math.round((sim.x - lvl.startX) / 10))}m</Text>
              <Text style={styles.modeText}>🌀 ADVENTURE RUN</Text>
            </>
          ) : (
            <>
              <Text style={styles.levelText}>{levelLabel}</Text>
              <View style={styles.progTrack}>
                <View style={[styles.progFill, { width: `${Math.min(100, Math.max(0, (sim.x / lvl.finishX) * 100))}%` }]} />
              </View>
              <Text style={styles.modeText}>
                {mode === 'swing' ? '🪝' : '🧲'} {world.name.toUpperCase()} • {STAGE_LABELS[stage].toUpperCase()}
              </Text>
            </>
          )}
        </View>
        <View style={styles.retryBadge}>
          <Text style={styles.retryText}>↻ {sim.retries}</Text>
        </View>
      </View>

      {/* fire proximity warning */}
      {phase === 'play' && sim.status === 'alive' && fireGap < 450 && sim.t > 1 && (
        <View pointerEvents="none" style={styles.fireWarn}>
          <Text style={[styles.fireWarnText, { opacity: 0.55 + 0.45 * Math.sin(sim.t * 12) }]}>🔥 RUN!</Text>
        </View>
      )}

      {hooksUsed === 0 && phase === 'play' && (
        <View pointerEvents="none" style={styles.hint}>
          <Text style={styles.hintText}>
            {mode === 'swing' ? 'HOLD anywhere to hook the glowing diamond\nRELEASE to fly!' : 'HOLD to grapple — it pulls you straight in.\nRELEASE to launch!'}
          </Text>
        </View>
      )}

      {phase === 'cleared' && (
        <View pointerEvents="none" style={styles.clearedWrap}>
          <Text style={styles.clearedText}>LEVEL CLEARED!</Text>
          <Text style={styles.clearedSub}>⚡ MATH GATE INCOMING…</Text>
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
  metersText: { color: theme.text, fontWeight: '900', fontSize: 26, letterSpacing: 1 },
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
  fireWarn: { position: 'absolute', top: '40%', left: 24 },
  fireWarnText: { fontSize: 30, fontWeight: '900', color: '#ffb703' },
  clearedWrap: { position: 'absolute', top: '22%', left: 0, right: 0, alignItems: 'center' },
  clearedText: {
    color: theme.text,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: '#00000088',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  clearedSub: { color: theme.accent, fontSize: 14, fontWeight: '900', letterSpacing: 3, marginTop: 8 },
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
