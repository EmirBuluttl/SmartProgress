# SmartProgress Data Safety Notes

Bu dosya Play Console Data Safety ve App Store privacy formu için teknik nottur; nihai hukuki metin değildir.

## Collected Data

- Account data: email, first name, last name, optional nickname, optional avatar.
- Fitness data: workout logs, program data, exercise logs, RPE/RIR, cardio logs, body measurements, nutrition logs.
- App activity: coach signals, notifications, usage metadata for AI/coach features.
- Purchase data: subscription entitlement state via RevenueCat.

## Purpose

- Account management and authentication.
- Fitness progress tracking and workout history.
- Personalized program and coach signal generation.
- Subscription entitlement validation.
- Support, account recovery and password reset.

## Deletion

- In-app deletion path: Profile > Hesabı ve Verileri Sil.
- Web deletion resource: `https://smartprogress.online/account-deletion`.
- Backend account deletion removes the user and related relational data through cascade rules.

## Third Parties

- RevenueCat for subscription entitlement and purchase status.
- Resend or Brevo for password reset email delivery, depending on production env.
- OpenAI or configured AI provider only when AI provider features are enabled.
