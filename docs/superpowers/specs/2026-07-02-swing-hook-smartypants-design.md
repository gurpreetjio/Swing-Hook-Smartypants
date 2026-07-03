# Swing Hook Smartypants — Design Spec

Date: 2026-07-02
Status: Built autonomously from the user's detailed voice-note requirements. Decisions
that weren't specified are marked **[decision]** and are easy to change later.

## Concept

A physics swinging game inspired by Stickman Hook, but visually distinct: a dark
"night arcade" neon look, a round glow-headed stick character called a **Doodle**,
diamond-shaped hook anchors, and a comet trail. The core loop rewards math:
every cleared level ends with a timed math question. Answering correctly — and
fast — is how you earn coins, XP, and skin unlocks. Goal: get better at math
while chasing an addictive swing loop. **No ads, no real-money purchases.**

## Platform & Tech

- **Expo (React Native, TypeScript)**, runs in **Expo Go** on Android and iOS.
- Only Expo-Go-bundled libraries: `react-native-svg` (game renderer + character art),
  `@react-native-async-storage/async-storage` (persistence). No custom native code.
- Custom game loop (`requestAnimationFrame`) + hand-rolled physics (a point mass on a
  rope constraint — no physics engine dependency). SVG scene redrawn per frame with a
  camera that follows the player. **[decision]** Chosen over Skia/matter-js for
  maximum Expo Go reliability and a small dependency surface.
- Screens are a simple state machine in the root component (no navigation lib needed).

## Game Modes

### Adventure (unlimited plays)
- 200 procedurally generated levels per grade (seeded by grade+level → deterministic).
- Swing physics: hold to attach to the best anchor ahead, release to fly.
  Rope is a hard constraint (slack allowed); gravity + slight air drag; bounce pads;
  spinning hazards in later levels; fall off screen = retry (instant, no penalty).
- Reaching the finish gate triggers the **Math Gate** (below).
- Difficulty ramps: anchor spacing/height variance, hazards, and gap width grow with level.
- After level 200 the grade is **completed** (badge + big coin bonus); the player can
  pick a new grade or replay.

### Grapple Mode (unlimited plays)
- Same worlds, different traversal: instead of swinging, holding fires a grapple that
  **pulls you straight toward the anchor** (spring impulse — pushes you up/along).
  Momentum-based, more like a zip-pull than a pendulum. Separate progress track
  **[decision]**: grapple progress shares the grade's level list but stores its own
  "furthest level" so both modes stay playable.

### Weekly Tournament ("Drops", 3 free plays/day)
- Week-long event (Mon–Sun, ISO week). A fixed seeded gauntlet of 5 levels + 5 math
  questions; score = swing style (airtime, no-retry bonus) + math speed/accuracy.
- **3 free entries per day.** Additional entries cost **10 coins each** (unlimited
  paid retries). Best score of the week counts.
- Weekly leaderboard (see below) and end-of-week coin prizes by placement.

## The Math Gate (end of every round)

- One question per level; a **speed timer** starts immediately.
- Rewards: correct = coins + XP + progression-bar fill. Answer within the **Fast
  window** (~35% of the time limit) → bonus coins and, on milestone levels, unlocks
  the **special reward** variant (see skins). Wrong answer: level still counts, but
  no coins/XP and the progression bar doesn't fill — replay the level to try again
  **[decision]** (keeps it low-punishment but makes math the only path to rewards).
- Difficulty = f(grade, level band). Grade selected at first launch (K–8)
  **[decision: K–8 bands]**, changeable in settings. Within a grade, questions get
  harder every 25 levels (8 bands across 200 levels): e.g. Grade 3 goes from
  single-digit multiplication → multi-digit → division with remainders → simple
  fractions. Grade 7–8 reach negatives, exponents, percent, one-step algebra.
- Multiple choice (4 answers) with plausible distractors — fast to tap mid-game.

## Progression & Rewards

- **Progression bar**: fills with each correct answer; every full bar (5 correct)
  = a skin crate from the classic line. 20 classic Doodle skins across 200 levels.
- **Speed rewards**: filling a bar with all-Fast answers upgrades the crate to a
  **special reward** (glow/animated variant skin).
- **Ranks**: XP ladder with 10 ranks (Pebble → Comet → … → Mythic) shown on home
  screen and leaderboard. XP comes from math (weighted by speed) and tournaments.
- **Weekly skins**: 3 limited-time skins on the home screen, rotating every ISO week
  (deterministic from week number), purchasable with coins only that week.
- **Customization**: ropes (color/style) and trails (comet, rainbow, bubbles, etc.)
  bought with coins in the Locker; equipped independently of skins.
- **Coins**: earned from math answers, level completion, grade completion, and
  tournament placement. Spent on weekly skins, ropes, trails, tournament retries.

## Leaderboard

- Local-first **[decision]**: weekly tournament board and all-time XP board, populated
  with seeded simulated rivals (names + scores scale with the player so the board
  always feels contested). Player rows persist. Architecture keeps a `Leaderboard`
  service interface so a real backend can drop in later — Expo Go can't ship one
  without a server anyway.

## Persistence

Single JSON blob in AsyncStorage (versioned, migratable): grade, per-mode progress,
coins, XP/rank, owned/equipped skins+ropes+trails, tournament state (entries used
today, best score this week), leaderboard rows, settings.

## Not Doing (YAGNI)

Ads (explicitly excluded), IAP, accounts/auth, sound assets (haptics only via
`expo-haptics` if bundled — else visual feedback), multiplayer, cloud sync.
