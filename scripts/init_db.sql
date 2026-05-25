-- ============================================================
-- AI VEHICLE EXPIRY ENFORCEMENT SYSTEM — Database Initialization
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fast plate number fuzzy search
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Performance indexes (created after Alembic migrations)
-- These are hints for the migration system

-- Search optimization
-- CREATE INDEX CONCURRENTLY idx_detections_plate_trgm ON detections USING gin(detected_plate gin_trgm_ops);
-- CREATE INDEX CONCURRENTLY idx_vehicles_plate_trgm ON vehicles USING gin(plate_number gin_trgm_ops);
