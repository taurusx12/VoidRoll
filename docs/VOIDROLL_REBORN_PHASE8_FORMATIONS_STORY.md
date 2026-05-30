# VoidRoll Reborn — Phase 8 Formations + Multi-Team Story

## الهدف
ربط التقدم في الستوري بعدد التشكيلات المطلوبة.

اللاعب يقدر يضبط تشكيلاته بنفسه، لكن الستوري كل ما تقدم يطلب تشكيلات أكثر.
والعدو يصير عنده نفس عدد التشكيلات المطلوبة.

## نظام التشكيلات
- الحد الأقصى: 6 تشكيلات.
- كل تشكيلة: 6 شخصيات.
- اللاعب يضبط التشكيلات بنفسه.
- التكرار مسموح إذا عندك أكثر من نسخة.
- نفس نسخة الكرت لا تدخل في تشكيلتين بنفس الوقت.
- الـVariants تعتبر شخصيات مستقلة.

## فتح التشكيلات حسب الستوري

### Chapter 1–9
- اللاعب يحتاج 1 Formation
- العدو عنده 1 Formation

### Chapter 10–19
- اللاعب يحتاج 2 Formations
- العدو عنده 2 Formations

### Chapter 20–34
- اللاعب يحتاج 3 Formations
- العدو عنده 3 Formations

### Chapter 35–49
- اللاعب يحتاج 4 Formations
- العدو عنده 4 Formations

### Chapter 50–59
- اللاعب يحتاج 5 Formations
- العدو عنده 5 Formations

### Chapter 60+
- اللاعب يحتاج 6 Formations
- العدو عنده 6 Formations

## طريقة قتال الستوري
كل Formation يقاتل Formation مقابله.

مثال Chapter 10:
- Team 1 vs Enemy Team 1
- Team 2 vs Enemy Team 2

مثال Chapter 35:
- Team 1 vs Enemy Team 1
- Team 2 vs Enemy Team 2
- Team 3 vs Enemy Team 3
- Team 4 vs Enemy Team 4

## شروط الفوز
- المراحل العادية: Majority Win
- مراحل البوس: All Win

مثال:
إذا المرحلة تطلب 3 تشكيلات:
- مرحلة عادية: تحتاج تفوز 2 من 3
- بوس: تحتاج تفوز 3 من 3

## Scaling العدو
العدو يزيد حسب:
- رقم التشابتر
- رقم الستيج
- عدد التشكيلات المطلوبة
- هل المرحلة بوس
- هل المرحلة في Void Realm

## الملفات المضافة
- src/config/formation_story_config.json
- src/systems/formationSystem.js
- src/systems/storyFormationSystem.js
- docs/VOIDROLL_REBORN_PHASE8_FORMATIONS_STORY.md
- docs/PHASE8_COMMAND_NOTES.md
- INSTALL_PHASE8_PATCH.txt
- PHASE8_APPLIED.txt

## الخطوة القادمة
Phase 9 — Character Evolution Tree Commands

راح نضيف:
- /character-tree
- /upgrade
- Core Tree
- Skill Tree
- Gear Tree
- Trait Tree
- Bond Tree
- Transformation Tree
- تكاليف التطوير باستخدام الموارد الجديدة
