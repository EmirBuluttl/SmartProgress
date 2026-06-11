-- Store-safe moderation MVP: user reports and user blocks.
-- Additive only; does not modify or delete existing user data.

CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_user_id" UUID,
    "target_program_id" UUID,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL,
    "blocker_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_reports_reporter_id_created_at_idx" ON "content_reports"("reporter_id", "created_at");
CREATE INDEX "content_reports_target_user_id_status_idx" ON "content_reports"("target_user_id", "status");
CREATE INDEX "content_reports_target_program_id_status_idx" ON "content_reports"("target_program_id", "status");
CREATE INDEX "content_reports_target_type_status_idx" ON "content_reports"("target_type", "status");

CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_user_id_key" ON "user_blocks"("blocker_id", "blocked_user_id");
CREATE INDEX "user_blocks_blocked_user_id_idx" ON "user_blocks"("blocked_user_id");

ALTER TABLE "content_reports"
ADD CONSTRAINT "content_reports_reporter_id_fkey"
FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_reports"
ADD CONSTRAINT "content_reports_target_user_id_fkey"
FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_reports"
ADD CONSTRAINT "content_reports_target_program_id_fkey"
FOREIGN KEY ("target_program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_blocks"
ADD CONSTRAINT "user_blocks_blocker_id_fkey"
FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_blocks"
ADD CONSTRAINT "user_blocks_blocked_user_id_fkey"
FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
