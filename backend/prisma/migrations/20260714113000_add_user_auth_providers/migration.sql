CREATE TABLE "user_auth_providers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_auth_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_auth_providers_provider_provider_user_id_key"
ON "user_auth_providers"("provider", "provider_user_id");

CREATE UNIQUE INDEX "user_auth_providers_user_id_provider_key"
ON "user_auth_providers"("user_id", "provider");

CREATE INDEX "user_auth_providers_user_id_idx"
ON "user_auth_providers"("user_id");

CREATE INDEX "user_auth_providers_email_idx"
ON "user_auth_providers"("email");

ALTER TABLE "user_auth_providers"
ADD CONSTRAINT "user_auth_providers_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
