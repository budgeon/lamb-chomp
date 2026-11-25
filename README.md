# Lamb Chomp handoff bundle

Context from the planning session of 10–13 Nov 2026, packaged so Claude Code can pick up where it left off.

## Use it

1. Unzip this folder where you want the project to live.
2. Open a terminal in the folder and start Claude Code there.
3. Claude Code reads `CLAUDE.md` at the project root on its own. Ask it to read `docs/` before it proposes anything.

A good first prompt:

> Read CLAUDE.md and everything in docs/. Summarize the open decisions, then ask me the questions you need answered before scaffolding the project.

## Try the prototype

Open `prototype/index.html` in a browser. Swipe or use the arrow keys. Z undoes, R restarts, Space switches sheep.

It loads two fonts from Google Fonts and falls back to system fonts offline.

## Check the levels

```
node tools/check.js
```

Needs Node only, no packages. Every field should report `cleared: true` at par.

## What is in here

See the Layout section of `CLAUDE.md`.
