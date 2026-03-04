ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "receptionist_date_overrides" JSONB NOT NULL DEFAULT '{}';
