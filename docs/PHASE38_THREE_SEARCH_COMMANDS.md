# Phase 38 — Three Separate Search Commands

## المطلوب
ثلاث أوامر منفصلة:

```txt
/character = ابحث عن أي شخصية في قاعدة اللعبة
/my-card = ابحث في الكروت اللي عندك أنت
/who-has = مين يملك الشخصية
```

## التشغيل

```bash
cd ~/project/src
node scripts/phase38-three-search-commands.js
node --check src/index.js
GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
npm start
```

## الاستخدام
```txt
/character name:Naruto
/my-card card:Naruto
/who-has name:Naruto
```

## ملاحظة
`/view-card` يبقى موجود كأمر قديم، لكن الأمر الأساسي الجديد هو `/my-card`.
