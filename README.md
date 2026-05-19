# Anime Card Bot Global Edition

بوت ديسكورد جاهز كبنية Production-ready: Gacha cards, low prints, inventory, AFK farming, equipment upgrade, market, PostgreSQL, Redis-ready, Docker, healthcheck.

## التشغيل المحلي
```bash
cp .env.example .env
# عدل DISCORD_TOKEN و DISCORD_CLIENT_ID
npm install
npm run db:push
npm run seed
npm run commands:deploy
npm start
```

## تشغيل Docker
```bash
cp .env.example .env
docker compose up -d --build
```

## الأوامر
/profile, /daily, /roll, /inventory, /deploy, /claim, /market, /sell, /buy, /equipment, /upgrade

## أنظمة موجودة
- Global print numbers لكل شخصية
- Rarity drop rates
- Shiny + traits
- AFK farming zones
- Marketplace tax
- Equipment rarity and upgrade failure
- PostgreSQL schema جاهز للتوسع
- Health endpoint: /health

## قبل النشر العالمي الحقيقي
- حط Privacy Policy و Terms
- لا تربط PayPal داخل البوت مباشرة إلا بنظام قانوني واضح
- سو Test Server قبل فتح global commands
- راقب الاقتصاد، الduplication، والmacro abuse
- استعمل S3/Cloudflare R2 للصور بدل روابط عشوائية

## ملاحظة حقوق
استخدام شخصيات أنمي رسمية في بوت تجاري قد يحتاج ترخيص من أصحاب الحقوق. المشروع تقنيًا يسمح بإضافة أي بيانات، لكن مسؤولية المحتوى والنشر عليك.
