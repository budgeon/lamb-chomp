# Market notes

Summary of web research done on 11 Nov 2026. Figures are as reported by the linked sources and were not independently verified. Re-check anything that a decision depends on.

## Bottom line

There is a large market for the genre. The hard part for a solo developer is distribution, not making a good game. The advice given was to run a cheap test (a 20-second gameplay clip, a small ad test or an organic post) before a big build. The owner decided to build regardless.

## What the market looks like

- Puzzle is the largest casual genre: about $4.9 billion in player spending in the first half of 2026, roughly 44% of casual spending (AppMagic, via Outlook Respawn).
- Entry is hard: over half of the top 300 games by installs launched before 2024, and installs overall are falling (PocketGamer.biz).
- Breakouts still happen with simple logic mechanics: arrow-puzzle newcomers reached the Google Play top 15 in June 2026 with more than 7.5 million downloads each that month (FoxData).
- The growth pocket is hybrid-casual puzzle (sort, screw, block), up 46% in revenue. These pair a simple core with a meta layer and in-app purchases (AppMagic H1 2026 summary).
- Paid installs for puzzle games were quoted at roughly $2.32 on iOS and $0.69 on Android. This benchmark may be dated (Business of Apps figures, via Click Vision).

## Competitors and neighbours

- **Grass Munchers** (Google Play, package `djs.game.slide`): animals munch grass in the swiped direction until they hit an obstacle. This is nearly the same core mechanic. **Update (25 Nov 2026): delisted. The Play listing returns 404, and no reviews or videos were found.** From a GameDev.net project page (search excerpts only): one swipe may move all animals together; stars and coins scale with how much grass is eaten (no full-clear requirement, no fail state); a regrow-grass power-up, a coin shop for animals and power-ups, leaderboards and achievements; claimed 10,000 levels, retro pixel art. Lamb Chomp differs with full-clear against proven par, individual sheep control, tall grass, mud and flowerbeds, and undo instead of power-ups.
- Sheep-themed puzzlers on the stores are mostly traffic-jam and escape games (Sheep Out, Sheep Dash, Sheep Away, Sheep Control). No graze-to-clear sheep game turned up in a quick search.
- Sheep a Sheep (China, 2022) is the famous sheep-themed viral hit. It is a tile-matching game spread through WeChat, so it is a theme precedent, not a mechanic precedent.

## Realistic paths discussed

1. Publisher test with a hybrid-casual publisher: highest ceiling, most rejection.
2. Small premium or ad-light indie release: modest income at best, but a finished shipped game.
3. Organic short-form video: the fattening sheep is good clip material, but it is a lottery.

## Engine notes

- Unity is the standard for ad- and IAP-driven mobile games because ad and mediation providers ship official Unity integrations. Unity Personal is free up to $200,000 in revenue or funding.
- Godot is free and strong at 2D, but ads rely on community plugins and no mediation platform ships a first-party Godot SDK.

## Sources

- https://respawn.outlookindia.com/gaming/gaming-news/top-mobile-puzzle-games-ruling-the-global-grossing-charts-in-2026
- https://www.pocketgamer.biz/puzzle-games-rise-as-mobile-genres-compete-for-attention-in-2026/
- https://foxdata.com/en/blogs/global-mobile-game-rankings-june-2026-top-15-downloads-revenue/
- https://gameindustrylibrary.com/documents/appmagic-mobile-casual-games-in-h1-2026-powered-by-mellow
- https://click-vision.com/mobile-game-marketing-statistics
- https://gamedev.net/projects/614-grass-munchers
- https://thechinaproject.com/2022/09/16/sheep-a-sheep-is-the-new-viral-game-that-wechat-is-going-bonkers-over/
- https://appradar.com/blog/mobile-game-engines-development-platforms
- https://ziva.sh/blogs/godot-mobile
- https://unity.com/en/products/pricing-updates
