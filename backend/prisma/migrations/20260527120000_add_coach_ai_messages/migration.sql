CREATE TABLE "coach_ai_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coach_ai_messages_user_id_created_at_idx" ON "coach_ai_messages"("user_id", "created_at");

ALTER TABLE "coach_ai_messages"
ADD CONSTRAINT "coach_ai_messages_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
