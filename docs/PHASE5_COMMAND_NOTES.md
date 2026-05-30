# Phase 5 Command Notes — Inventory Rework

## /inventory
Recommended options:
- name: string
- anime: string
- rarity: COMMON / RARE / EPIC / LEGENDARY / MYTHIC / DIVINE / VOIDBORN / SECRET
- element: FIRE / ICE / WATER / WIND / LIGHTNING / SHADOW / LIGHT / VOID
- role: TANK / DPS / SUPPORT / ASSASSIN / SUMMONER / CONTROL / HEALER
- variant: Base / Corrupted / Awakened / Fallen / Eclipse / True Form / etc.
- sort: power / rarity / level / name / anime / gear
- page: integer

## Examples
/inventory
/inventory anime:Bleach
/inventory rarity:SECRET
/inventory element:VOID
/inventory role:CONTROL
/inventory name:Makima
/inventory anime:Chainsaw Man rarity:DIVINE

## /view-card
Shows full card details:
- Name
- Variant
- Anime
- Rarity
- Element
- Role
- Level
- Power
- Built-in Gear
- Stats
- Passive
- Leader Passive
- Collection Passive

## Important
Do not display:
- Stars
- Fusion
- Character-specific shards

Inventory supports duplicate cards.
