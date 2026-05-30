# VoidRoll Reborn — Phase 7 Battle Engine Foundation

## الهدف
تأسيس قتال حقيقي بدل نظام Power فقط.

## الجديد

### Stats-Based Combat
القتال يعتمد على:
- HP
- ATK
- DEF
- SPD
- Crit Rate
- Crit Damage
- Effect Chance
- Effect Resistance
- Dodge
- Counter
- Healing Bonus
- Shield Power
- Mana
- Energy / Ultimate Bar

### Status Effects
تم تجهيز:
- Bleed
- Burn
- Freeze
- Silence
- Stun
- DEF Break
- ATK Down
- Void Bind

### Roles
تم تجهيز أدوار القتال:
- Tank
- DPS
- Support
- Assassin
- Summoner
- Control
- Healer

### Elements
تم تجهيز علاقة العناصر:
- Fire
- Ice
- Water
- Wind
- Lightning
- Shadow
- Light
- Void

### Formation Rules
يدعم:
- 6 تشكيلات كحد أقصى
- كل تشكيلة 6 شخصيات
- النسخ المكررة مسموحة
- نفس نسخة الكرت لا تدخل في تشكيلتين بنفس الوقت

## المحذوف
لا يوجد:
- Power-only win logic
- Stars
- Fusion
- Item Rolls

## الملفات المضافة
- src/config/battle_config.json
- src/systems/battleEngine.js
- docs/VOIDROLL_REBORN_PHASE7_BATTLE_ENGINE.md
- docs/PHASE7_COMMAND_NOTES.md
- INSTALL_PHASE7_PATCH.txt
- PHASE7_APPLIED.txt

## الخطوة القادمة
Phase 8 — Formations + Multi-Team Story Foundation

راح نضيف:
- Formation system
- 6 teams × 6 characters
- فتح التشكيلات حسب الستوري
- منع نفس نسخة الكرت من الدخول في أكثر من تشكيله
- تجهيز Story stages التي تحتاج أكثر من Formation
