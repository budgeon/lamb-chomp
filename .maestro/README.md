# Maestro flows

End-to-end flows that drive the iOS Simulator build of Lamb Chomp (`appId: com.lambchomp.app`). The `feature-verifier` runs every flow here on an iPhone SE and a Pro Max simulator during Verify. See `.claude/skills/deliver-feature/references/native-verification.md` for the full procedure.

## Setup

1. Xcode with an iOS Simulator runtime, and Java 17+ (`java -version`).
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

## Writing flows

- One flow per player journey. Rules and edge cases belong in Jest, not here.
- Target elements by `id:` (a React Native `testID`), not by on-screen copy, wherever a testID exists.
- Start from a known state with `launchApp: { clearState: true }`, unless the flow tests saved progress.
- Take a `takeScreenshot` at each state worth reviewing; the verifier inspects them.
- Swipes: `swipe: { start: "50%,60%", end: "90%,60%", duration: 150 }` uses screen percentages. For a specific sheep, swipe from its element: `swipe: { from: { id: "sheep-0" }, direction: RIGHT }`.

## Flows

| Flow | Status |
|---|---|
| `smoke.yaml`: launch and render | Done (asserts scaffold text until the root view has a testID) |
| `field-1.yaml`: open field 1, play the par solution `U L D R U`, assert cleared and three stars | TODO |
| `blocked-swipe.yaml`: swipe into the fence, assert no move counted | TODO |
| `flowerbed-fail.yaml`: trample a flowerbed, assert fail state, undo restores | TODO |
| `two-sheep.yaml`: select each sheep by tap and by swipe start | TODO |
| `progress-persists.yaml`: clear a field, relaunch without clearState, stars remain | TODO |
