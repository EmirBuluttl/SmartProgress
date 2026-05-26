CREATE TABLE "ai_usage_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_micros" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_events_user_id_created_at_idx" ON "ai_usage_events"("user_id", "created_at");
CREATE INDEX "ai_usage_events_feature_idx" ON "ai_usage_events"("feature");

ALTER TABLE "ai_usage_events"
ADD CONSTRAINT "ai_usage_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
