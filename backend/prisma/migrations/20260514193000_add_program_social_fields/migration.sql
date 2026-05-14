ALTER TABLE "programs" ADD COLUMN "source_program_id" UUID;

CREATE TABLE "program_stars" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_stars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_stars_user_id_program_id_key" ON "program_stars"("user_id", "program_id");
CREATE INDEX "program_stars_program_id_idx" ON "program_stars"("program_id");
CREATE INDEX "program_stars_user_id_idx" ON "program_stars"("user_id");
CREATE INDEX "programs_source_program_id_idx" ON "programs"("source_program_id");

ALTER TABLE "program_stars" ADD CONSTRAINT "program_stars_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_stars" ADD CONSTRAINT "program_stars_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
