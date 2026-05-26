CREATE TABLE "coach_weekly_reports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "source_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_weekly_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coach_weekly_reports_user_id_week_start_key" ON "coach_weekly_reports"("user_id", "week_start");
CREATE INDEX "coach_weekly_reports_user_id_week_start_idx" ON "coach_weekly_reports"("user_id", "week_start");

ALTER TABLE "coach_weekly_reports"
ADD CONSTRAINT "coach_weekly_reports_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
