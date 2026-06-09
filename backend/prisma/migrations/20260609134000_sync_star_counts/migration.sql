-- Sync existing star counts from the program_stars relation table
UPDATE "programs" p
SET "star_count" = (
    SELECT COUNT(*)::integer
    FROM "program_stars" ps
    WHERE ps."program_id" = p."id"
);
