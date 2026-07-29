# KGS Web Client — Claude Code Instructions

## Always-loaded references
@DEVELOPMENT_RULES.md
@DESIGN_RULES.md
@KGS_Protocol_Reference.md
@README.md

## On session start
Write in the console:
"Guidelines loaded: DEVELOPMENT_RULES.md ✓ DESIGN_RULES.md ✓ KGS_Protocol_Reference.md ✓ README.md ✓"

## Before writing any code
1. Read @DEVELOPMENT_RULES.md for coding conventions and architecture rules
2. Read @DESIGN_RULES.md for all color, layout, and component design decisions
3. Read @KGS_Protocol_Reference.md before implementing anything that communicates with the KGS server

## After making changes
- If the change affects architecture, setup, or workflow, update @WALKTHROUGH.md accordingly

## Rules summary
- Never call the network directly from UI or game logic — use `KgsClient.js`
- Always check the KGS protocol reference before implementing a new message type
- Keep `WALKTHROUGH.md` up to date as the project evolves