# SmartProgress Store Launch Checklist

## Product Positioning

- Launch paketi: Premium aktif, Coach+ pasif/yakında.
- Premium vaadi: Akıllı Program Wizard, haftalık rapor, progress/plato/regresyon takibi, kullanıcı onaylı aksiyon adayları.
- AI soru-cevap launch kapsamı dışında.

## RevenueCat

- Entitlement id: `premium`.
- Store-managed free trial kullanılacak.
- Product ids önerisi:
  - Apple subscription product: `smartprogress_premium_monthly`
  - Google Play base subscription id: `smartprogress_premium_monthly`
  - RevenueCat offering id: `default`
  - RevenueCat entitlement id: `premium`
- RevenueCat dashboard'da Android ve iOS app-specific public keys oluşturulacak.
- Backend için `REVENUECAT_SECRET_API_KEY` production env içine eklenecek.
- Frontend için EAS secrets:
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_PREMIUM_ENTITLEMENT_ID=premium`
- EAS secret komutları:
  - `cd frontend && npx eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value <ios_public_key>`
  - `cd frontend && npx eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value <android_public_key>`
  - `cd frontend && npx eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_PREMIUM_ENTITLEMENT_ID --value premium`

## Google Play

- Package: `com.smartprogress.app`.
- AAB production build alınacak.
- Build komutu: `cd frontend && npm run eas:build:android:production`.
- Data Safety formu doldurulacak.
- App account deletion soruları tamamlanacak.
- Privacy policy URL, support URL ve account deletion URL girilecek.

## App Store

- Bundle id: `com.smartprogress.app`.
- Subscription metadata ve free trial App Store Connect içinde oluşturulacak.
- Build komutu: `cd frontend && npm run eas:build:ios:production`.
- Restore purchases uygulama içinde görünür olacak.
- Privacy policy ve support URL App Store Connect içinde girilecek.

## Legal / Support URLs

Varsayılan launch URL'leri:
- Privacy: `https://app.smartprogress.online/privacy`
- Support: `https://app.smartprogress.online/support`
- Account deletion: `https://app.smartprogress.online/account-deletion`

Bu sayfalar public launch öncesi canlı ve erişilebilir olmalı.

## Local Checks

- `cd frontend && npm run store:check`
- `cd frontend && npm run expo:config`
- `cd frontend && npm run eas:version`
- `cd frontend && npx eas whoami`
