# Swing Hook Smartypants 🪝⚡

A physics swinging game where **math makes you rich**. Swing your glow-headed
Doodle through neon night levels, then beat the timed **Math Gate** at the end of
every round — answer fast for bonus rewards. No ads, ever.

## Play it on your phone (Expo Go)

1. Install **Expo Go** from the App Store (iOS) or Play Store (Android).
2. On your computer:
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code in the terminal — camera app on iOS, the Expo Go app on Android.
   (Phone and computer must be on the same Wi-Fi; use `npx expo start --tunnel` if not.)

## How it works

- **Pick your grade (K–8)** on first launch. Math Gate questions are tuned to that
  grade and get harder every 25 levels across the 200-level journey. Finish level
  200 to complete the grade and bank a 1000-coin bonus.
- **Adventure** — classic swinging: hold to hook the glowing diamond, release to
  fly. Unlimited plays. Levels follow the classic difficulty arc through **10
  themed locations** (a new world every 20 levels):
  - *Beginner (1–20)*: simple hooks and bounce pads, minimal obstacles
  - *Intermediate (21–50)*: more bounce pads, tighter hooks, floor spikes
  - *Advanced (51–100)*: longer gaps, moving obstacles
  - *Expert (101–200)*: far-apart hooks, unpredictable pads, momentum-killing walls
  - *Challenge (201+)*: endless levels with extreme, misleading hook angles
- **Grapple Mode** — no pendulum: the hook *pulls you straight in*. Same worlds,
  totally different feel, its own progress track.
- **Math Gate** — one timed question after every level. Correct = coins + XP +
  crate progress. Answer inside the ⚡ fast window for bonus coins — fill a whole
  crate with fast answers and the unlocked skin comes with a special glow variant.
- **Weekly Tournament** — the same seeded 5-stage course for everyone all week.
  **3 free runs a day**, extra runs cost 10 coins. Best run counts; prizes pay out
  when the week rolls over.
- **Weekly skins** — 3 limited-time skins rotate onto the home screen each week.
- **Ranks & Locker** — climb 10 ranks (Pebble → Mythic) on math XP, and customize
  your rope and trail.

## Development

```bash
npm run typecheck    # TypeScript
npm run test:logic   # math/level/physics logic tests (12k+ generated questions)
```

Everything is pure TypeScript + `react-native-svg` + AsyncStorage — no custom
native code, so it runs in stock Expo Go on both platforms. The leaderboard is
local with simulated rivals (`src/state/store.tsx` — `rivalScores`); swap that
service for a real backend later without touching the screens.
