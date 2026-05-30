# Phase 12 Command Notes — Banner Rework

## /roll
Normal character roll.

Options:
- amount: 1 or 10

## /banner
Shows active featured/limited banners.

Should display:
- Banner title
- Featured character
- Rarity
- Cost
- Pity
- Duration
- Quote

## /pack or /banner-pull
Pulls from selected banner.

Recommended options:
- banner: banner id
- amount: 1 or 10

## /pity
Shows current pity for active banners.

## Reveal connection
When result rarity is:
- DIVINE: use revealSystem DIVINE_REVEAL
- VOIDBORN: use revealSystem VOIDBORN_BOTTOM_UP
- SECRET: use revealSystem SECRET_BOTTOM_UP

## Removed commands
Do not add:
- /item-roll
- /relic-pull
- /aura-pull
- /fuse
- /star-upgrade
