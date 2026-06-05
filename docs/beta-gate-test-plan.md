# SmartProgress Beta Gate Test Plan

Bu kapı geçmeden Google Play / App Store public launch yapılmaz.

## Automated Checks

Frontend:
- `npx tsc --noEmit`
- `npm run test:coach-engine`
- `npm run test:progress-engine`
- `npm run test:workout-metrics`
- `npm run store:check`

Backend:
- `npm run build`
- `npm run test:coach-signals`
- `npx prisma migrate status`
- Production health: `curl -fsS https://api.smartprogress.online/health`

## Manual Regression

Test hesapları:
- Yeni kullanıcı: onboarding, app tour, ücretsiz wizard hakkı, Premium kilidi.
- Dolu kullanıcı: programlar, log geçmişi, coach sinyalleri, progress grafikleri.

Kritik akışlar:
- Auth: register, login, forgot password, logout, hesap silme.
- Program: oluştur, düzenle, gün detay, public/private, kütüphaneye ekle, kaynak güncelle.
- Workout: aktif session koruması, sekmeden çıkıp dönme, finish/cancel/save exit.
- Warmup: program gününe rutin bağla, başlat, atla, yarıda kaydet/çık.
- Loglama: kg/BW, tekrar/süre, RPE/RIR, L/R unilateral, hareket/set ekleme.
- Cardio: stage ekleme, notlar, düzenleme, workout özetinde görünme.
- Coach: wizard, weekly report, permanent signals, plato/regression/progress.
- MyProgress: hareket/kas filtreleri, PR/En İyi Setlerim, ölçü ve nutrition grafikleri.
- Profile: avatar, settings, theme, app tour replay, legal links, account deletion.

## Store Gate

- Android production AAB build alınır.
- iOS production build/TestFlight build alınır.
- RevenueCat entitlement `premium` aktif test edilir.
- Store trial, restore purchases ve expired entitlement senaryoları doğrulanır.
- Privacy/support/account deletion URL'leri açılır ve uygulama adını içerir.
- Final smoke: login, Premium unlock, workout finish, coach report, account deletion.
