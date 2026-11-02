# HIYOBON CAFE — onlayn boshqaruv tizimi (MVP)

## Nimalar ishlaydi
- Xodimlar uchun alohida login/parol va rollar: direktor, administrator, kassir, oshxona, kuryer.
- Markaziy serverdagi SQLite ma'lumotlar bazasi.
- Mahsulotlar/menyu, buyurtma yaratish, buyurtma holatlari, to'lov holati.
- Telefon va kompyuterga mos web interfeys.
- Brauzerlar server bilan 7 soniyada yangilanadi.

## Muhim cheklov
Bu MVP. Click/Payme/terminalga real pul yechish yoki bank bilan integratsiya qilmaydi; faqat to'lov usuli va to'langan/to'lanmagan holatini qayd etadi. Ombor, tex-karta, gramovka, tannarx, kuryer tayinlash, fiskal chek va Uzum/Yandex integratsiyalari keyingi ishlab chiqish bosqichlari. Internetda hammaga ochish uchun hosting, domen, HTTPS va server backup sozlanishi shart.

## Kompyuterda ishga tushirish (Windows)
1. Node.js 20 yoki undan yangisini o'rnating: https://nodejs.org/
2. Ushbu papkani VS Code'da oching.
3. Terminal oching va `npm install` bajaring.
4. `.env.example` faylidan nusxa olib `.env` nom bering.
5. `.env` ichida `SESSION_SECRET` va `ADMIN_PASSWORD` ni kuchli maxfiy qiymatlarga almashtiring.
6. `npm start` bajaring.
7. Brauzerda `http://localhost:3000` ni oching.

## Birinchi kirish
Login va parol `.env` ichidagi `ADMIN_USERNAME` va `ADMIN_PASSWORD`. Standart qiymatlarni internetga chiqarmang; albatta o'zgartiring. Birinchi ishga tushishdan oldin `.env` ni sozlang.

## Internetga joylash
Node.js qo'llaydigan hosting (masalan, Render/Railway/VPS) kerak. Hostingda:
- `npm install` / start command `npm start`
- Environment variables: `NODE_ENV=production`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- Doimiy disk kerak: `data/` papkasi saqlanib qolishi lozim, aks holda buyurtma bazasi yo'qoladi.
- HTTPS yoqilsin.
- `data/` papkasini muntazam backup qiling.

Hostingga joylashtirilmaguncha telefon va boshqa kompyuterlar internet orqali kira olmaydi. Lokal tarmoqdan vaqtincha foydalanish uchun server ishlayotgan kompyuterning LAN IP manzili va bir xil Wi-Fi kerak bo'ladi; xavfsizlik devorida port ochish talab qilinishi mumkin.

## Rollar
- Direktor: barcha bo'limlar.
- Administrator: operatsion bo'limlar va xodimlar.
- Kassir: buyurtma va to'lovlar.
- Oshxona: oshxona buyurtmalari va tayyorlash holati.
- Kuryer: yetkazib berish buyurtmalari.

## Xavfsizlik
- Har bir xodimga alohida hisob oching; umumiy login ishlatmang.
- Har bir parol kamida 10 belgili bo'lsin.
- `.env` faylini hech kimga yubormang va GitHub'ga joylamang.
- Production'da faqat HTTPS ishlating.
