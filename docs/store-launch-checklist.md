# SmartProgress Store Launch Checklist

## Product Positioning

- Launch paketi: Premium aktif, Coach+ pasif/yakında.
- Premium vaadi: Akıllı Program Wizard, haftalık rapor, progress/plato/regresyon takibi, kullanıcı onaylı aksiyon adayları.
- AI soru-cevap launch kapsamı dışında.

## RevenueCat

- Entitlement id: `premium`.
- Store-managed free trial kullanılacak.
- RevenueCat dashboard'da Android ve iOS app-specific public keys oluşturulacak.
- Backend için `REVENUECAT_SECRET_API_KEY` production env içine eklenecek.
- Frontend için EAS secrets:
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_PREMIUM_ENTITLEMENT_ID=premium`

## Google Play

- Package: `com.smartprogress.app`.
- AAB production build alınacak.
- Data Safety formu doldurulacak.
- App account deletion soruları tamamlanacak.
- Privacy policy URL, support URL ve account deletion URL girilecek.

## App Store

- Bundle id: `com.smartprogress.app`.
- Subscription metadata ve free trial App Store Connect içinde oluşturulacak.
- Restore purchases uygulama içinde görünür olacak.
- Privacy policy ve support URL App Store Connect içinde girilecek.

## Legal / Support URLs

Varsayılan launch URL'leri:
- Privacy: `https://smartprogress.online/privacy`
- Support: `mailto:support@smartprogress.online`
- Account deletion: `https://smartprogress.online/account-deletion`

Bu sayfalar public launch öncesi canlı ve erişilebilir olmalı.
