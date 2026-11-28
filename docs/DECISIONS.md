# Decision log

Newest first. Each entry says what was decided, why, and what is still open.

## D7. Shepherd's best and the star tiers

- **Date:** 27 Nov 2026
- **Status:** Decided by the owner. Replaces the star rule in D2's "stars against par".
- **Decision:**
  - **Name.** On screen, par is called **Shepherd's best**: the true minimum number of moves, found by breadth-first search. Code, level data and tools keep the name `par`.
  - **Rating.** With `best` = the shepherd's best and `moves` = the moves used to clear:

    | Result | Condition |
    |---|---|
    | 3 stars and the **shepherd's best badge** | `moves == best` |
    | 3 stars | `moves <= best + max(1, ceil(0.15 × best))` |
    | 2 stars | `moves <= best + max(3, ceil(0.40 × best))` |
    | 1 star | any clear |

    For example, best 5: 3★ at 6, 2★ at 7–8. Best 9: 3★ at 10–11, 2★ at 12–13. Best 14: 3★ at 15–17, 2★ at 18–20.

    Compute the margins in integers, as `ceil(15 × best / 100)` and `ceil(40 × best / 100)`. For 15% and 40% the floating-point form happens to give the same result for every best up to 100,000, but other percentages do not: `0.07 × 100` is `7.000000000000001`, which would round up to 8. Integer maths keeps the result independent of float rounding if the percentages are ever tuned. (Corrected 27 Nov 2026: an earlier version of this entry wrongly said `0.15 × 20` was `3.0000000000000004`.)
  - **Badge.** The badge (for example a golden crook) is separate from the stars, so the familiar 3-star scale stays. The best result per field is kept: its star count, and whether the badge was earned.
  - **Undo and hints are free.** The rating depends only on the final move count. Undo restores the move count, and a field cleared with a solver hint can still earn 3 stars and the badge.
  - **Coins.** Reaching the shepherd's best pays a small extra bonus on top of the 3-star bonus, once per field. A replay that first reaches it pays the bonus as an upgrade, in line with `replay: 'star-upgrade-only'`.
- **Why:**
  - A fixed par + 2 was harsh on short fields and loose on long ones; margins that scale with the field are fairer as fields grow toward 100.
  - Making the exact minimum a separate badge gives expert players a goal without making 3 stars feel out of reach.
  - Undo is a thinking tool in a puzzle game, so it should not cost stars.
- **Still to do:** in the progression feature, with the `rules`, `ui`, `economy` and `save` flags:
  - add the rating function to the pure module with tests (boundary cases at each tier);
  - rename the on-screen PAR label;
  - show the targets on screen, since scaled margins need explaining;
  - store the best stars and badge per field;
  - add and tune the bonus in `src/economy/config.ts`, so the economy gate's balance simulation still passes.
- **Known consequence:** hints and undo can hand out 3 stars and the badge, so coin rewards must stay once per field. That was already the rule.

## D6. Business model: free, ad-light, with coins and cosmetics

- **Date:** 25 Nov 2026
- **Status:** Decided by the owner.
- **Decision:** Free to download. Rewarded ads for solver hints only (no forced interstitials). Coins are earned by playing and spent on cosmetics (sheep skins, fences, paddock themes). Optional coin packs, plus a "remove ads" purchase.
- **Why:** Paid installs (~$2.32 CPI on iOS) make full hybrid-casual a money pit without a publisher. A play-earned coin economy works as a retention layer with organic players. The full hybrid-casual version (interstitials, coin pressure, offers) was rejected.
- **Cost to plan for:** a shop, coin balancing, and art for every cosmetic.

## D5. The game is called Lamb Chomp

- **Update (25 Nov 2026):** Name check done. No app named Lamb Chomp turned up on the App Store, Google Play or itch.io (web search). lambchomp.com/.app/.game appear unregistered. Risk confirmed: Classic Media (NBCUniversal) has pending "Lamb Chop" filings in US class 9 (serial 98502379, 2024) and class 28 (serial 99370593, 2025), plus a UK filing covering classes 9/28/41. **The owner keeps the name and accepts the risk.** Alternative names are being brainstormed as a backup. Fallback notes: "Sheep Sweep" is now a 2025 Steam game, and meadowmunch.com is taken.

- **Date:** 13 Nov 2026
- **Status:** Decided by the owner.
- **Decision:** The name is **Lamb Chomp**. "Ewe Turn" was only the working title of the first prototype and is retired.
- **How we got here:** A brainstorm produced about fifteen candidates. The owner's shortlist was Sheep Sweep, Lamb Chomp and Meadow Munch. Claude's pick was Sheep Sweep (descriptive, has "sheep" in the title for store search), with Lamb Chomp as runner-up for personality. The owner chose Lamb Chomp.
- **What a quick web search found (11 Nov 2026):** no existing game with the exact name Lamb Chomp. This was a web search only, not an App Store, Google Play or trademark search.
- **Open risk:** the name is one letter away from Lamb Chop, the well-known puppet character. This is the one trademark concern raised across the shortlist. It was flagged from general knowledge, not from a search, and nobody involved is a lawyer.
- **Still to do before anything public carries the name:**
  1. Search the App Store and Google Play directly for "Lamb Chomp".
  2. Run the name through the USPTO trademark search, looking at games and entertainment classes, and at Lamb Chop marks.
  3. Check domain and social handle availability.
  4. If any of these comes back badly, the fallbacks are Sheep Sweep, then Meadow Munch (which has near neighbours: a classroom game called Munch Meadow and an iOS game called Meow Munch).

## D4. Tech stack: React Native + Expo

- **Date:** 11 Nov 2026 (options); decided 25 Nov 2026
- **Status:** Decided by the owner.
- **Decision:** **React Native with Expo, TypeScript.** Rules and solver in a pure, tested TS module (port `slide()` first, prove it against `tools/check.js`). Native rendering and animation via Reanimated and/or React Native Skia. Ads through Google Mobile Ads (AdMob, rewarded only); coin packs and remove-ads through RevenueCat.
- **Why:** The owner wants a truly native mobile app. React Native renders natively while keeping TypeScript, so the rules module and solver port directly. Capacitor (embedded browser view) was the faster path but not native. Unity's ad-mediation advantage doesn't matter for the ad-light model (D6).
- **Options discussed:**
  - **Unity 6, 2D, C#.** Claude's answer to "ideal stack". Chosen for monetization tooling: the major ad and mediation providers ship official Unity integrations. Free until $200,000 in revenue or funding. Suggested companions: AppLovin MAX or Unity LevelPlay for ads, Unity IAP, Firebase for analytics, crash reporting and remote config, DOTween for animation, levels as JSON.
  - **React/TypeScript with Capacitor.** The prototype is already web code, so it carries over most directly. Rules in a pure TypeScript module, rendering in DOM/SVG or canvas.
  - **Godot.** Best fit if the game goes premium or ad-free. Light, free, strong 2D. Ads go through community plugins, and no mediation platform ships its own Godot SDK.
- **The deciding question was** the business model (D6), plus the wish to go native.

## D3. Build it regardless of the market read

- **Date:** 11 Nov 2026
- **Status:** Decided by the owner.
- **Decision:** Build the game even though the honest market read is "big genre, hard distribution". See `MARKET_NOTES.md`.
- **Note:** A Google Play game called Grass Munchers already uses nearly the same slide-and-eat mechanic. Mechanics cannot be owned, so this does not block anything, but it should be played before going further to find where Lamb Chomp can differ.
- **Update (25 Nov 2026):** Grass Munchers has been delisted from Google Play, so it can't be played. See `MARKET_NOTES.md` for what is known.

## D2. v1 scope

- **Date:** 11 Nov 2026
- **Status:** Frozen by the owner, 25 Nov 2026.
- **In:** rocks, tall grass, mud, flowerbeds, two sheep, stars against par, undo, restart, plus the coin economy and cosmetics shop from D6.
- **Parked:** regrowing grass, gates and pressure plates, wolves, cliffs, sheep breeds that eat only one grass type, herding with a sheepdog.
- **Target:** about 100 levels at launch, in worlds of 15–20 that each introduce one component.

## D1. Core mechanic is slide-to-graze

- **Date:** 10 Nov 2026
- **Status:** Decided. The owner played the prototype and said all the mechanics feel good.
- **Decision:** Swipe, and the sheep runs until something stops it, eating everything it crosses.
- **Alternatives considered:** draw-the-path (one continuous route over every grass tile; calmer, less distinctive) and herding (control a sheepdog, sheep flee; most personality, hardest to make fair).
