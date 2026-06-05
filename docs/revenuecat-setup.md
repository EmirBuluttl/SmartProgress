# RevenueCat Setup

## Identifiers

- Entitlement: `premium`
- Offering: `default`
- Monthly product id: `smartprogress_premium_monthly`

## Dashboard Steps

1. Create the SmartProgress project in RevenueCat.
2. Add iOS app with bundle id `com.smartprogress.app`.
3. Add Android app with package `com.smartprogress.app`.
4. Create entitlement `premium`.
5. Attach App Store / Play Store subscription products to that entitlement.
6. Create offering `default` and add the Premium package.
7. Copy app-specific public SDK keys for EAS secrets.
8. Copy secret API key for backend production env.

## Backend Env

Set these on the server:

```env
REVENUECAT_SECRET_API_KEY=
REVENUECAT_PREMIUM_ENTITLEMENT_ID=premium
```

## Frontend EAS Secrets

```powershell
cd frontend
npx eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value <ios_public_key>
npx eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value <android_public_key>
npx eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_PREMIUM_ENTITLEMENT_ID --value premium
```

## Test Matrix

- Free user sees Premium CTA and free wizard uses.
- Premium purchase activates `premium` entitlement.
- Restore purchases reactivates Premium on a fresh install.
- Expired subscription downgrades backend profile to `FREE/INACTIVE` after sync.
- Web build does not crash; RevenueCat purchase action shows configuration/unsupported state.
