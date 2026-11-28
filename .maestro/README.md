# Maestro flows

End-to-end flows that drive the iOS Simulator build of Lamb Chomp (`appId: com.lambchomp.app`). The `feature-verifier` runs every flow here on an iPhone SE and a Pro Max simulator during Verify. See `.claude/skills/deliver-feature/references/native-verification.md` for the full procedure.

## Setup

1. Xcode with an iOS Simulator runtime, and Java 17+ (`java -version`). Homebrew's `openjdk@17` is keg-only. If `java -version` can't find it, either run the `sudo ln -sfn …` step from `brew info openjdk@17`, or prefix Maestro commands with `JAVA_HOME=/opt/homebrew/opt/openjdk@17`.
2. Install Maestro: `brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro`, or `curl -fsSL "https://get.maestro.mobile.dev" | bash`. Check: `maestro --version`.
3. Boot a simulator: `xcrun simctl boot "iPhone SE (3rd generation)" && open -a Simulator`.
4. Build and install the app:
   - Debug, with Metro and fast refresh: `npx expo run:ios`
   - Release, no Metro (what Verify uses): `npx expo run:ios --configuration Release`

## Run

```bash
maestro test .maestro/                       # all flows on the booted simulator
maestro test .maestro/smoke.yaml             # one flow
maestro --device <udid> test .maestro/ --test-output-dir .delivery/evidence/maestro-se
maestro studio                               # inspect the view hierarchy and build selectors
```

Against a **Debug** build, point `--test-output-dir` at `.delivery/evidence/` or outside the repo. Metro watches the repo, and a new screenshot file anywhere else in it can reload the app and reset the field mid-flow. `metro.config.js` blocks `.delivery/` from Metro. Release builds don't use Metro, so this doesn't affect them. A Debug build on a non-default Metro port also needs `RCT_jsLocation` set on the simulator; see `native-verification.md`, preflight step 5.

## Writing flows

- One flow per player journey. Rules and edge cases belong in Jest, not here.
- Target elements by `id:` (a React Native `testID`), not by on-screen copy, wherever a testID exists.
- Start from a known state with `launchApp: { clearState: true }`, unless the flow tests saved progress. On the iOS Simulator `clearState` also deletes the save (`progress.json` in the app's Documents folder), so flows don't depend on run order.
- Take a `takeScreenshot` at each state worth reviewing; the verifier inspects them.
- Swipes: `swipe: { start: "50%,60%", end: "90%,60%", duration: 150 }` uses screen percentages. For a specific sheep, swipe from its element: `swipe: { from: { id: "sheep-0" }, direction: RIGHT }`.

## Flows

| Flow | Status |
|---|---|
| `smoke.yaml`: launch and render | Done (asserts `id: "app-root"`) |
| `field-1.yaml`: open field 1, check the board against `field-01`, the "SHEPHERD'S BEST" caption (no "PAR") and the star targets; play the par solution `U L D R U`, assert every cell grazed and the cleared card (3 of 3 stars, badge, +25 coins, Next and Fields); a later swipe is ignored | Done (`star-targets` is matched on its accessibility label, which replaces the visible text on iOS) |
| `blocked-swipe.yaml`: swipe into the fence, assert no move counted; two quick swipes `U` then `L`, assert both applied; a ~8 pt swipe is ignored and a ~24 pt swipe is a move (16 pt threshold measured from touch-down) | Done (the buffer mechanism itself is guarded by Jest, `src/play/__tests__/session.test.ts`) |
| `undo-restart.yaml`: field 1, both buttons disabled at launch; swipe UP, Undo restores the sheep and grass; two moves, Restart restores the starting field and disables both buttons; corners and controls on screen | Done (disabled state read with `enabled: false`) |
| `flowerbed-fail.yaml`: open field 5 with the hidden `startField: 5` launch argument, assert its star targets (12 and 14); trample the flowerbed (RIGHT, UP), assert "Flowers trampled", the trampled tile and no hint; a later swipe is ignored; Undo restores and the field accepts swipes; fail again and Restart restores the starting field | Done |
| `progress-persists.yaml`: clear field 1 at par (3 stars, badge, +25), Next opens Field 2; `stopApp`, relaunch without clearState: Field 2 opens; the field list shows tile 1 with 3 stars and the badge, tile 2 open, tile 3 locked, 25 coins; tile 1 reopens field 1 with the saved best | Done (the only flow that relaunches without clearState) |
| `field-list.yaml`: one move on field 1, open the list (only tile 1 open, 0 coins), a swipe and a locked-tile tap change nothing, Back returns to field 1 with the move and board unchanged | Done |
| `field-7-to-8.yaml`: open field 7 with `startField: 7` (7 rows), targets 14 and 17, corners on screen; play `L D R U R D L R U D L D`, cleared card with 3 stars, badge and +25, corners still in the tree; Next opens Field 8 fresh with targets 15 and 19 | Done |
| `two-sheep.yaml`: select each sheep by tap and by swipe start | TODO |
