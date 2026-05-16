CREATE TABLE "nutrition_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "calories" INTEGER,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nutrition_logs_user_id_date_key" ON "nutrition_logs"("user_id", "date");
CREATE INDEX "nutrition_logs_user_id_idx" ON "nutrition_logs"("user_id");
CREATE INDEX "nutrition_logs_user_id_date_idx" ON "nutrition_logs"("user_id", "date");

ALTER TABLE "nutrition_logs"
ADD CONSTRAINT "nutrition_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
