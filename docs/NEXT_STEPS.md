# Next steps

The order agreed in the planning session. Steps 2 and 3 are the foundation; the rest builds on them.

## Before any code

- [x] Clear the name. Checked 25 Nov 2026: no app clash, domains free, Lamb Chop trademark risk accepted by the owner (D5). Still worth doing: register lambchomp.com and social handles.
- [x] ~~Play Grass Munchers~~. Not possible: delisted from Google Play by Nov 2026. What is known is in `MARKET_NOTES.md`.
- [x] Decide the business model: free, ad-light (rewarded hint ads), coins and cosmetics, coin packs, remove-ads (D6).
- [x] Decide the stack: React Native + Expo, TypeScript (D4).

## Build

1. [x] **Freeze v1 scope** (25 Nov 2026, D2). Rocks, tall grass, mud, flowerbeds, two sheep, stars against par, undo, restart, ~100 levels, coins and cosmetics shop. Everything else is parked.
2. [ ] **Move the prototype into a real project.** Port the rules (state, slide, win check) into a pure module with tests, separate from rendering. Prove it by replaying the solutions in `tools/check.js`.
3. [ ] **Build the level pipeline.** Turn `tools/gen.js` into a script that outputs candidates with a difficulty score, then hand-pick. Target about 100 levels, in worlds of 15–20 that each introduce one component.
4. [ ] **Wire monetization** according to the decision above. Solver-backed hints are the natural thing to sell or gate behind an ad.
5. [ ] **Add the feel.** Final art style, chewing and fattening animations, haptics on each bite, sound, a cleared-field finish.
6. [ ] **Add a reason to return.** Stars and world progression first, then the coin economy and cosmetics shop (in v1 scope). A daily field after launch.
7. [ ] **Playtest on TestFlight** with 10–20 people. Log level starts, completions, quits and moves against par. Fix the levels where people quit.
8. [ ] **Prepare the store listing.** Icon, screenshots and a 20-second gameplay clip.

## Suggested first session in Claude Code

1. ~~Confirm the stack and business model with the owner.~~ Done (D4, D6).
2. Scaffold the Expo project.
3. Port `slide()` and the win check, with tests that replay the eight par solutions.
4. Render field 1 and get one swipe working end to end.
