-- Add manual premium subscription fields for Pro / Coach+ MVP testing.
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'COACH_PLUS');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRIAL');

ALTER TABLE "users"
ADD COLUMN "subscription_tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE';
