# Phase 40 — Hunt Zone Core

## Commands
- /hunt
- /hunt-next
- /hunt-pick
- /hunt-extract
- /hunt-abandon

## Wizard
Wizard is free. It gives 3 choices + Ignore.
Every wizard choice has a reasonable buff and a light debuff.
Buffs are Hunt-only and disappear after extract/death/abandon.

## Rewards
Corrupted Keys are extremely rare.
Main alternative rewards:
- Corrupted Fragments
- Corrupted Pity Shards
- Gold
- Ascension
- Memory Shards
- Void Crystals

## Install
cd ~/project/src
node scripts/phase40-apply-hunt-zone-core.js
node --check src/index.js
node --check src/systems/huntZoneSystem.js
GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
npm start
