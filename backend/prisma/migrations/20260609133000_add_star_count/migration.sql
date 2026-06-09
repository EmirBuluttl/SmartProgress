-- AlterTable
ALTER TABLE "programs" ADD COLUMN "star_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "programs_star_count_idx" ON "programs"("star_count");
