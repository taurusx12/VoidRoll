# VoidRoll Reborn — FULL LAUNCH IMPLEMENTATION

هذا الباكيج هو الملف الواحد الكامل للتنفيذ، مو مرجع فقط.

## يحتوي على كل الأنظمة المتفق عليها
- نظام الرولات الكامل:
  - Free Rolls 30/30 تتعبى كل ساعة ولا تتكدس
  - Banked Normal Rolls تتكدس من المودات
  - Premium Rolls
  - Event Rolls
  - Corrupted Tickets
  - /rolls و /wallet يعرضون كل شيء
- Standard Roll أعلى شيء DIVINE، ولا يطلع Secret/Corrupted
- Premium Roll منفصل
- Event Roll للكوربتد
- إصلاح صور Corrupted العشرة
- Hunt Zones
- Wizard مجاني مع Buff + Debuff + Ignore
- Merchant
- Random Events
- Boss Contracts
- Abyss/Bounty logic base
- Bounty Board
- Corrupted Raid
- Event Shop
- Relics
- Traits
- Duplicate-friendly resource structure
- Official button routing for Hunt

## طريقة التركيب
فك الضغط وارفع الملفات بنفس المسارات داخل مشروعك، ثم شغل:

```bash
cd ~/project/src
node scripts/apply-full-launch-update.js
node --check src/index.js
node --check src/systems/rollBankSystem.js
node --check src/systems/huntZoneSystem.js
GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
node scripts/official-fix-corrupted-10-images.js
npm start
```

## اختبار
```txt
/wallet
/rolls
/rates
/roll amount:1
/premium-roll amount:1
/event-roll amount:1
/hunt
/bounty
/contracts
/event-shop
/corrupted-raid
/relics
/traits
/character name:Corrupted Gojo
```
