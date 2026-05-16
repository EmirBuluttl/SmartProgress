CREATE TABLE "body_measurements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "weight" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "chest" DOUBLE PRECISION,
    "arm" DOUBLE PRECISION,
    "leg" DOUBLE PRECISION,
    "hip" DOUBLE PRECISION,
    "shoulder" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "body_measurements_user_id_date_key" ON "body_measurements"("user_id", "date");
CREATE INDEX "body_measurements_user_id_idx" ON "body_measurements"("user_id");
CREATE INDEX "body_measurements_user_id_date_idx" ON "body_measurements"("user_id", "date");

ALTER TABLE "body_measurements"
ADD CONSTRAINT "body_measurements_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
