# Lamb Chomp Impact Flags and Risks

Set every flag that applies. Each adds required plan tasks, tests, and verification. `npm run gate` runs for every change regardless of flags.

## `rules`
Touches the pure game module in `src/game/` (slide, grazing, mud, flowerbeds, sheep blocking, win check, par, stars, undo/restart state).
- The module stays pure: no React, React Native, Expo, timers, or storage imports.
- Golden replays: the eight prototype par solutions (from `tools/check.js`) still clear their fields at par.
- Prototype parity: the TS `slide()` matches `prototype/index.html` / `tools/gen.js` on the parity test's states. These must stay identical in behaviour.
- fast-check properties still hold (for example: grass never increases, a sheep never ends on a rock or another sheep, a zero-cell swipe is not a move, undo restores the exact previous state).
- The core rules in `CLAUDE.md` cannot change without the owner's explicit approval. A spec that changes one says so as an open question.
- Required: `npm run gate:rules` plus the full `npm run gate`.

## `levels`
Adds or changes anything in `src/game/levels/`, the level format, or the solver.
- Every level is solver-verified and its stored par equals the true BFS minimum: `npm run gate:levels`.
- Worlds hold 15–20 levels and each introduces one component (D2). New components must matter: removing flowerbeds or mud should change par, and two-sheep levels should need both sheep.
- Changing a shipped level's layout or id needs owner approval, because saved stars attach to it (also set `save`).
- Use `/new-levels` for new level content rather than this workflow.

## `ui`
Touches screens, components, gestures, animation, haptics, sound, or layout.
- Maestro flows and screenshots on iPhone SE (smallest supported screen) and the current Pro Max simulator. Check clipping, safe areas, notch/Dynamic Island, and that the paddock fits without scrolling.
- Swipe feel: short and fast swipes register, a blocked swipe gives feedback, the one-swipe input buffer still works, two-sheep selection by tap or swipe-start works.
- 60fps sanity: run animations on the UI thread (Reanimated worklets or Skia), not via JS-thread `setState` per frame. Check with the Perf Monitor in a Debug build; a device feel check is `MANUAL`.
- For a visible layout change, the spec offers two or three options with a recommendation.

## `economy`
Touches coins, rewards, prices, the shop, cosmetics, ads, or purchases (D6).
- `npm run gate:economy` passes, including the coin balance simulation (earn rates vs. cosmetic prices stay within the configured bounds).
- Only rewarded ads, only for solver hints. No interstitial, app-open, or banner formats anywhere: the reviewer greps for them.
- Remove-ads and coin packs go through RevenueCat. Never test with real purchases; use sandbox or mocks.
- Coins never go negative and a reward is granted once per completed ad, even across app backgrounding.

## `save`
Touches anything persisted: progress, stars, coins, owned cosmetics, settings, or their schema.
- Data from a previous app version must still load. Add a migration test that loads a fixture in the previous format and proves nothing is lost.
- Missing or malformed values the change reads or writes are handled without throwing or overwriting good data.
- Bump the schema version when the shape changes, and never delete a migration.
- Verifier upgrade check: install the `origin/main` build, make progress, install the branch build over it without uninstalling, and confirm progress and coins survive (see `native-verification.md`).

## `native`
Touches `app.json`/`app.config.*`, config plugins, native modules, permissions, icons/splash, EAS config, or adds a package with native code.
- Install packages with `npx expo install`, never plain `npm install`.
- `npx expo-doctor` passes.
- `npx expo prebuild --clean` succeeds and `npx expo run:ios` builds and launches on the simulator. `/ios` and `/android` are generated and git-ignored; never commit them.
- Installed builds need a store release to change native code; JS-only changes do not. Note the release path at the PR gate.
- Android build is `MANUAL` unless an emulator is set up.

## Every change, at spec time

- Check Expo APIs against the SDK 58 docs (`AGENTS.md`), not memory.
- Note whether the change needs a new native build or is JS-only.
