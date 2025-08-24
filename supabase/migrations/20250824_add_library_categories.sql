-- Add new library categories for comprehensive coverage
-- This migration adds security, testing, infrastructure, and other categories

-- Add new categories to the enum
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'security';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'testing';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'infrastructure';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'database';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'backend';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'frontend';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'desktop';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'middleware';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'analytics';
ALTER TYPE library_category ADD VALUE IF NOT EXISTS 'cloud';