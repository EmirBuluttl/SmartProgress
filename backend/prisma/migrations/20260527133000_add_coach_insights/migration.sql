CREATE TABLE "coach_insights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "exercise_name" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "flags" JSONB,
    "current_best" JSONB,
    "previous_best" JSONB,
    "source_log_id" UUID NOT NULL,
    "signal_date" DATE NOT NULL,
    "week_start" DATE NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_insights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coach_insights_user_id_type_exercise_name_source_log_id_key" ON "coach_insights"("user_id", "type", "exercise_name", "source_log_id");
CREATE INDEX "coach_insights_user_id_signal_date_idx" ON "coach_insights"("user_id", "signal_date");
CREATE INDEX "coach_insights_user_id_type_idx" ON "coach_insights"("user_id", "type");

ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
