import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, isoWeekKey, hashString, mulberry32 } from '../game/rng';
import { CLASSIC_SKINS, specialVariant } from '../data/cosmetics';

export const LEVELS_PER_GRADE = 200;
export const BAR_SIZE = 5; // correct answers to fill the progression bar
export const TOURNEY_FREE_PER_DAY = 3;
export const TOURNEY_RETRY_COST = 10;

export interface ModeProgress {
  level: number; // next level to play (1-based)
  completed: boolean; // finished all 200
}

export interface Profile {
  version: 1;
  playerName: string;
  grade: number | null; // 0=K .. 8
  coins: number;
  xp: number;
  adventure: Record<number, ModeProgress>;
  grapple: Record<number, ModeProgress>;
  barProgress: number; // 0..BAR_SIZE correct answers in current bar
  barFastCount: number; // how many of those were fast
  skinsOwned: string[];
  ropesOwned: string[];
  trailsOwned: string[];
  equippedSkin: string;
  equippedRope: string;
  equippedTrail: string;
  totalCorrect: number;
  totalFast: number;
  tournament: {
    weekKey: string;
    dayKey: string;
    entriesToday: number;
    bestScore: number;
    lastRewardWeek: string; // last week we paid out prizes for
  };
}

export function defaultProfile(): Profile {
  return {
    version: 1,
    playerName: 'You',
    grade: null,
    coins: 50,
    xp: 0,
    adventure: {},
    grapple: {},
    barProgress: 0,
    barFastCount: 0,
    skinsOwned: ['doodle'],
    ropesOwned: ['r_basic'],
    trailsOwned: ['t_none', 't_comet'],
    equippedSkin: 'doodle',
    equippedRope: 'r_basic',
    equippedTrail: 't_comet',
    totalCorrect: 0,
    totalFast: 0,
    tournament: {
      weekKey: isoWeekKey(),
      dayKey: dayKey(),
      entriesToday: 0,
      bestScore: 0,
      lastRewardWeek: '',
    },
  };
}

const KEY = 'shs:profile:v1';

export interface RoundResult {
  correct: boolean;
  fast: boolean;
  answerMs: number;
}

export interface RoundRewards {
  coins: number;
  xp: number;
  unlockedSkin?: string; // classic skin id
  unlockedSpecial?: string; // glow variant id
  gradeCompleted?: boolean;
}

interface StoreApi {
  profile: Profile;
  loaded: boolean;
  setGrade(grade: number): void;
  /** Apply an adventure/grapple round: advance level, bank rewards, roll progression bar. */
  completeRound(mode: 'adventure' | 'grapple', band: number, result: RoundResult): RoundRewards;
  spendCoins(amount: number): boolean;
  addCoins(amount: number): void;
  ownSkin(id: string): void;
  equip(kind: 'skin' | 'rope' | 'trail', id: string): void;
  buy(kind: 'skin' | 'rope' | 'trail', id: string, cost: number): boolean;
  useTournamentEntry(): 'free' | 'paid' | 'blocked';
  reportTournamentScore(score: number): void;
  resetAll(): void;
}

const Ctx = createContext<StoreApi | null>(null);

// Keeps week/day-scoped tournament state fresh and pays out last week's prize.
export function normalizeTournament(p: Profile, now = new Date()): { prize: number; placement: number } | null {
  const wk = isoWeekKey(now);
  const dk = dayKey(now);
  let payout: { prize: number; placement: number } | null = null;
  if (p.tournament.weekKey !== wk) {
    if (p.tournament.bestScore > 0 && p.tournament.lastRewardWeek !== p.tournament.weekKey) {
      const placement = placementForScore(p.tournament.weekKey, p.tournament.bestScore);
      const prize = placement <= 1 ? 500 : placement <= 3 ? 300 : placement <= 10 ? 150 : 50;
      p.coins += prize;
      payout = { prize, placement };
    }
    p.tournament.lastRewardWeek = p.tournament.weekKey;
    p.tournament.weekKey = wk;
    p.tournament.bestScore = 0;
    p.tournament.entriesToday = 0;
    p.tournament.dayKey = dk;
  } else if (p.tournament.dayKey !== dk) {
    p.tournament.dayKey = dk;
    p.tournament.entriesToday = 0;
  }
  return payout;
}

// Where a score lands against that week's simulated rivals (1-based).
export function placementForScore(weekKey: string, score: number): number {
  const rivals = rivalScores(weekKey);
  return rivals.filter((r) => r > score).length + 1;
}

export const RIVAL_NAMES = [
  'SwingKing', 'MathCometX', 'PixelPen', 'NumberNinja', 'HookedOnPi', 'ZoomZara',
  'AceOfSums', 'DoodleDan', 'GravityGia', 'TurboTess', 'LoopyLuis', 'QuickQuinn',
  'SkySwinger', 'PlusUltraP', 'RadicalRae',
];

export function rivalScores(weekKey: string): number[] {
  const rng = mulberry32(hashString('rivals:' + weekKey));
  return RIVAL_NAMES.map(() => 350 + Math.floor(rng() * 2400));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const saved = { ...defaultProfile(), ...(JSON.parse(raw) as Profile) };
          normalizeTournament(saved);
          setProfile(saved);
        }
      } catch {
        // corrupted storage — start fresh rather than crash
      }
      setLoaded(true);
    })();
  }, []);

  const persist = (p: Profile) => {
    setProfile(p);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
    }, 250);
  };

  const api = useMemo<StoreApi>(() => {
    const update = (fn: (p: Profile) => void) => {
      const p: Profile = JSON.parse(JSON.stringify(profile));
      fn(p);
      persist(p);
      return p;
    };

    return {
      profile,
      loaded,
      setGrade: (grade) =>
        update((p) => {
          p.grade = grade;
          if (!p.adventure[grade]) p.adventure[grade] = { level: 1, completed: false };
          if (!p.grapple[grade]) p.grapple[grade] = { level: 1, completed: false };
        }),

      completeRound: (mode, band, result) => {
        const rewards: RoundRewards = { coins: 0, xp: 0 };
        update((p) => {
          const g = p.grade ?? 0;
          const prog = (mode === 'adventure' ? p.adventure : p.grapple)[g] ?? { level: 1, completed: false };
          (mode === 'adventure' ? p.adventure : p.grapple)[g] = prog;

          rewards.coins += 5; // clearing the course
          if (result.correct) {
            rewards.coins += 10 + band * 2;
            rewards.xp += 20 + band * 4;
            p.totalCorrect += 1;
            if (result.fast) {
              rewards.coins += 10;
              rewards.xp += 15;
              p.totalFast += 1;
            }
            // progression bar only moves on correct answers
            p.barProgress += 1;
            if (result.fast) p.barFastCount += 1;
            if (p.barProgress >= BAR_SIZE) {
              const nextLocked = CLASSIC_SKINS.find((s) => !p.skinsOwned.includes(s.id));
              if (nextLocked) {
                p.skinsOwned.push(nextLocked.id);
                rewards.unlockedSkin = nextLocked.id;
                if (p.barFastCount >= BAR_SIZE) {
                  const sp = specialVariant(nextLocked);
                  p.skinsOwned.push(sp.id);
                  rewards.unlockedSpecial = sp.id;
                }
              } else {
                rewards.coins += 100; // all classics owned — coins instead
              }
              p.barProgress = 0;
              p.barFastCount = 0;
            }
          }

          // advance the level regardless of math result (math gates rewards, not progress)
          if (prog.level >= LEVELS_PER_GRADE && !prog.completed) {
            prog.completed = true;
            rewards.coins += 1000;
            rewards.gradeCompleted = true;
          } else if (prog.level < LEVELS_PER_GRADE) {
            prog.level += 1;
          }

          p.coins += rewards.coins;
          p.xp += rewards.xp;
        });
        return rewards;
      },

      spendCoins: (amount) => {
        if (profile.coins < amount) return false;
        update((p) => {
          p.coins -= amount;
        });
        return true;
      },

      addCoins: (amount) =>
        void update((p) => {
          p.coins += amount;
        }),

      ownSkin: (id) =>
        void update((p) => {
          if (!p.skinsOwned.includes(id)) p.skinsOwned.push(id);
        }),

      equip: (kind, id) =>
        void update((p) => {
          if (kind === 'skin' && p.skinsOwned.includes(id)) p.equippedSkin = id;
          if (kind === 'rope' && p.ropesOwned.includes(id)) p.equippedRope = id;
          if (kind === 'trail' && p.trailsOwned.includes(id)) p.equippedTrail = id;
        }),

      buy: (kind, id, cost) => {
        const owned =
          kind === 'skin' ? profile.skinsOwned : kind === 'rope' ? profile.ropesOwned : profile.trailsOwned;
        if (owned.includes(id) || profile.coins < cost) return false;
        update((p) => {
          p.coins -= cost;
          if (kind === 'skin') {
            p.skinsOwned.push(id);
            p.equippedSkin = id;
          } else if (kind === 'rope') {
            p.ropesOwned.push(id);
            p.equippedRope = id;
          } else {
            p.trailsOwned.push(id);
            p.equippedTrail = id;
          }
        });
        return true;
      },

      useTournamentEntry: () => {
        let kind: 'free' | 'paid' | 'blocked' = 'blocked';
        update((p) => {
          normalizeTournament(p);
          if (p.tournament.entriesToday < TOURNEY_FREE_PER_DAY) {
            p.tournament.entriesToday += 1;
            kind = 'free';
          } else if (p.coins >= TOURNEY_RETRY_COST) {
            p.coins -= TOURNEY_RETRY_COST;
            p.tournament.entriesToday += 1;
            kind = 'paid';
          }
        });
        return kind;
      },

      reportTournamentScore: (score) =>
        void update((p) => {
          normalizeTournament(p);
          if (score > p.tournament.bestScore) p.tournament.bestScore = score;
          p.xp += Math.round(score / 20);
        }),

      resetAll: () => {
        const fresh = defaultProfile();
        persist(fresh);
        AsyncStorage.removeItem(KEY).catch(() => {});
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loaded]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
